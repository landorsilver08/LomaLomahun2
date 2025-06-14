import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import JSZip from 'jszip';
import { ViperGirlsScraper, type ScrapedImage } from './scraper';
import { googleDriveService } from './google-drive';
import { storage } from '../storage';
import type { DownloadSession, DownloadedImage, DownloadProgress } from '@shared/schema';

const pipelineAsync = promisify(pipeline);

export class DownloadManager {
  private scraper: ViperGirlsScraper;
  private activeDownloads: Map<number, Promise<void>>;
  private downloadDir: string;

  constructor() {
    this.scraper = new ViperGirlsScraper();
    this.activeDownloads = new Map();
    this.downloadDir = path.join(process.cwd(), 'downloads');
    
    // Ensure downloads directory exists
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  private getSessionDownloadDir(session: DownloadSession): string {
    if (session.customDirectory) {
      // Use custom directory if specified
      const customDir = path.join(session.customDirectory, `session_${session.id}`);
      if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
      }
      return customDir;
    }
    
    // Default to downloads directory
    const sessionDir = path.join(this.downloadDir, `session_${session.id}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  async startDownload(sessionId: number): Promise<void> {
    const session = await storage.getDownloadSession(sessionId);
    if (!session) {
      throw new Error('Download session not found');
    }

    // Prevent multiple downloads of the same session
    if (this.activeDownloads.has(sessionId)) {
      throw new Error('Download already in progress');
    }

    const downloadPromise = this.executeDownload(session);
    this.activeDownloads.set(sessionId, downloadPromise);

    try {
      await downloadPromise;
    } finally {
      this.activeDownloads.delete(sessionId);
    }
  }

  private async executeDownload(session: DownloadSession): Promise<void> {
    try {
      await storage.updateDownloadSession(session.id, { 
        status: 'active',
        startedAt: new Date() 
      });

      // Stage 1: Parse thread URL and extract basic info
      const { threadId } = await this.scraper.parseThreadUrl(session.threadUrl);
      
      // Stage 2: Scrape all pages to collect image links
      const allImages: ScrapedImage[] = [];
      
      for (let page = session.fromPage; page <= session.toPage; page++) {
        const pageImages = await this.scraper.scrapeThreadPage(threadId, page);
        allImages.push(...pageImages);
      }

      await storage.updateDownloadSession(session.id, { 
        totalImages: allImages.length 
      });

      // Stage 3: Create download records for all images
      for (const scrapedImage of allImages) {
        await storage.createDownloadedImage({
          sessionId: session.id,
          pageNumber: scrapedImage.pageNumber,
          originalUrl: scrapedImage.hostingPage,
          hostingSite: scrapedImage.hostingSite,
          filename: this.generateFilename(scrapedImage),
          status: 'pending',
          progress: 0,
        });
      }

      // Stage 4: Download images with concurrency control
      await this.downloadImagesWithConcurrency(session);

      // Stage 5: Create ZIP archive if requested
      if (session.outputFormat === 'zip') {
        await this.createZipArchive(session);
      }

      await storage.updateDownloadSession(session.id, {
        status: 'completed',
        completedAt: new Date(),
      });

    } catch (error) {
      await storage.updateDownloadSession(session.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async downloadImagesWithConcurrency(session: DownloadSession): Promise<void> {
    const images = await storage.getDownloadedImagesForSession(session.id);
    const pendingImages = images.filter(img => img.status === 'pending');
    
    // Create a pool of concurrent downloads
    const concurrentLimit = session.concurrentLimit || 3;
    const downloadPromises: Promise<void>[] = [];
    
    let activeDownloads = 0;
    let imageIndex = 0;

    while (imageIndex < pendingImages.length || activeDownloads > 0) {
      // Start new downloads up to the concurrent limit
      while (activeDownloads < concurrentLimit && imageIndex < pendingImages.length) {
        const image = pendingImages[imageIndex];
        imageIndex++;
        activeDownloads++;

        const downloadPromise = this.downloadSingleImage(session, image)
          .finally(() => {
            activeDownloads--;
          });
        
        downloadPromises.push(downloadPromise);
      }

      // Wait for at least one download to complete before starting new ones
      if (activeDownloads >= concurrentLimit) {
        await Promise.race(downloadPromises.filter(p => p !== undefined));
      }
    }

    // Wait for all downloads to complete
    await Promise.allSettled(downloadPromises);
  }

  private async downloadSingleImage(session: DownloadSession, image: DownloadedImage): Promise<void> {
    try {
      await storage.updateDownloadedImage(image.id, { status: 'downloading' });

      // Get full resolution URL
      const fullImageUrl = await this.scraper.getFullResolutionUrl(image.originalUrl);
      
      // Get session directory
      const sessionDir = this.getSessionDownloadDir(session);

      // Create page subdirectory
      const pageDir = path.join(sessionDir, `page_${image.pageNumber}`);
      if (!fs.existsSync(pageDir)) {
        fs.mkdirSync(pageDir, { recursive: true });
      }

      const filePath = path.join(pageDir, image.filename);

      // Skip if file already exists and skipExisting is enabled
      if (session.skipExisting && fs.existsSync(filePath)) {
        await storage.updateDownloadedImage(image.id, { 
          status: 'completed',
          progress: 100 
        });
        return;
      }

      // Download the image
      const response = await axios({
        method: 'GET',
        url: fullImageUrl,
        responseType: 'stream',
        timeout: 60000,
      });

      const fileSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      // Track download progress
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const progress = fileSize > 0 ? Math.round((downloadedBytes / fileSize) * 100) : 0;
        storage.updateDownloadedImage(image.id, { progress });
      });

      // Save file locally first
      const writeStream = fs.createWriteStream(filePath);
      await pipelineAsync(response.data, writeStream);

      // If Google Drive upload is enabled, upload the file
      if (session.downloadLocation === 'google-drive' && session.googleDriveFolder) {
        try {
          // Upload to Google Drive
          await googleDriveService.uploadFile(filePath, image.filename, session.googleDriveFolder);
          
          // Delete local file after successful upload (optional)
          // fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Failed to upload to Google Drive:', error);
          // Continue with local storage if Google Drive fails
        }
      }

      await storage.updateDownloadedImage(image.id, {
        status: 'completed',
        progress: 100,
        fileSize: downloadedBytes,
      });

      // Update session progress
      const sessionImages = await storage.getDownloadedImagesForSession(session.id);
      const completedCount = sessionImages.filter(img => img.status === 'completed').length;
      await storage.updateDownloadSession(session.id, { 
        completedImages: completedCount 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      
      await storage.updateDownloadedImage(image.id, {
        status: 'failed',
        errorMessage,
      });

      // Update session failed count
      const sessionImages = await storage.getDownloadedImagesForSession(session.id);
      const failedCount = sessionImages.filter(img => img.status === 'failed').length;
      await storage.updateDownloadSession(session.id, { 
        failedImages: failedCount 
      });

      // Retry if enabled
      if (session.retryEnabled) {
        setTimeout(() => {
          this.downloadSingleImage(session, image);
        }, 5000);
      }
    }
  }

  private async createZipArchive(session: DownloadSession): Promise<void> {
    const zip = new JSZip();
    const sessionDir = path.join(this.downloadDir, `session_${session.id}`);
    
    if (!fs.existsSync(sessionDir)) {
      throw new Error('Session download directory not found');
    }

    // Add all files to zip organized by page
    const pageDirectories = fs.readdirSync(sessionDir).filter(item => 
      fs.statSync(path.join(sessionDir, item)).isDirectory()
    );

    for (const pageDir of pageDirectories) {
      const pagePath = path.join(sessionDir, pageDir);
      const files = fs.readdirSync(pagePath);
      
      for (const file of files) {
        const filePath = path.join(pagePath, file);
        const fileContent = fs.readFileSync(filePath);
        zip.file(`${pageDir}/${file}`, fileContent);
      }
    }

    // Generate zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(this.downloadDir, `session_${session.id}.zip`);
    fs.writeFileSync(zipPath, zipBuffer);
  }

  private generateFilename(scrapedImage: ScrapedImage): string {
    // Extract filename from URL or generate one
    try {
      const url = new URL(scrapedImage.hostingPage);
      const pathSegments = url.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      
      if (lastSegment && lastSegment.includes('.')) {
        return lastSegment;
      }
      
      // Generate filename with hosting site and timestamp
      const timestamp = Date.now();
      return `${scrapedImage.hostingSite}_${timestamp}.jpg`;
    } catch {
      const timestamp = Date.now();
      return `image_${timestamp}.jpg`;
    }
  }

  async getDownloadProgress(sessionId: number): Promise<DownloadProgress> {
    const session = await storage.getDownloadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const images = await storage.getDownloadedImagesForSession(sessionId);
    const activeDownloads = await storage.getActiveDownloadsForSession(sessionId);

    const totalImages = session.totalImages || 0;
    const completedImages = session.completedImages || 0;
    const failedImages = session.failedImages || 0;

    let stage: DownloadProgress['stage'] = 'parsing';
    let currentStage = 'Initializing...';
    let overallProgress = 0;

    if (session.status === 'completed') {
      stage = 'completed';
      currentStage = 'Download completed';
      overallProgress = 100;
    } else if (session.status === 'active') {
      if (totalImages === 0) {
        stage = 'parsing';
        currentStage = 'Parsing thread pages...';
        overallProgress = 10;
      } else if (activeDownloads.length > 0) {
        stage = 'downloading';
        currentStage = `Downloading images (${completedImages}/${totalImages})`;
        overallProgress = totalImages > 0 ? Math.round((completedImages / totalImages) * 80) + 15 : 15;
      } else if (session.outputFormat === 'zip' && completedImages === totalImages) {
        stage = 'archiving';
        currentStage = 'Creating ZIP archive...';
        overallProgress = 95;
      }
    }

    return {
      sessionId,
      stage,
      overallProgress,
      currentStage,
      completedImages,
      totalImages,
      failedImages,
      activeDownloads: activeDownloads.map(img => ({
        filename: img.filename,
        hostingSite: img.hostingSite || 'unknown',
        progress: img.progress || 0,
      })),
      downloadSpeed: '0 MB/s', // TODO: Calculate actual speed
    };
  }

  async cancelDownload(sessionId: number): Promise<void> {
    const downloadPromise = this.activeDownloads.get(sessionId);
    if (downloadPromise) {
      this.activeDownloads.delete(sessionId);
      await storage.updateDownloadSession(sessionId, { 
        status: 'cancelled',
        completedAt: new Date() 
      });
    }
  }

  async getZipDownloadPath(sessionId: number): Promise<string> {
    const zipPath = path.join(this.downloadDir, `session_${sessionId}.zip`);
    if (fs.existsSync(zipPath)) {
      return zipPath;
    }
    throw new Error('ZIP file not found');
  }
}

export const downloadManager = new DownloadManager();
