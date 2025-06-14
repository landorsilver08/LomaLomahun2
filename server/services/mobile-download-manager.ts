import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import JSZip from 'jszip';
import { ViperGirlsScraper, type ScrapedImage } from './scraper';

import { storage } from '../storage';
import type { DownloadSession, DownloadedImage, DownloadProgress } from '@shared/schema';

const pipelineAsync = promisify(pipeline);

export class MobileDownloadManager {
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
        startedAt: new Date(),
      });

      // Stage 1: Parse thread and extract image URLs
      await this.updateProgress(session.id, 'parsing', 'Parsing thread pages...');
      
      const allImages: ScrapedImage[] = [];
      for (let page = session.fromPage; page <= session.toPage; page++) {
        const images = await this.scraper.scrapeThreadPage(
          session.threadUrl.match(/threads\/(\d+)/)?.[1] || '',
          page
        );
        allImages.push(...images);
      }

      // Store images in database
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

      await storage.updateDownloadSession(session.id, {
        totalImages: allImages.length,
      });

      // Stage 2: Download images
      await this.updateProgress(session.id, 'downloading', 'Downloading images...');
      await this.downloadImagesWithConcurrency(session);

      // Stage 3: Create ZIP or handle mobile storage
      if (session.outputFormat === 'zip') {
        await this.updateProgress(session.id, 'archiving', 'Creating archive...');
        await this.createMobileArchive(session);
      }

      // Complete the download
      await storage.updateDownloadSession(session.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      await this.updateProgress(session.id, 'completed', 'Download completed!');

    } catch (error) {
      console.error(`Download ${session.id} failed:`, error);
      
      await storage.updateDownloadSession(session.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async downloadImagesWithConcurrency(session: DownloadSession): Promise<void> {
    const images = await storage.getDownloadedImagesForSession(session.id);
    const pendingImages = images.filter(img => img.status === 'pending');
    const concurrentLimit = session.concurrentLimit || 3;

    let imageIndex = 0;
    const downloadPromises: Promise<void>[] = [];

    while (imageIndex < pendingImages.length || downloadPromises.length > 0) {
      // Start new downloads up to the concurrent limit
      while (downloadPromises.length < concurrentLimit && imageIndex < pendingImages.length) {
        const image = pendingImages[imageIndex];
        imageIndex++;

        const downloadPromise = this.downloadSingleImage(session, image)
          .then(() => {
            // Remove from active downloads
            const index = downloadPromises.indexOf(downloadPromise);
            if (index > -1) {
              downloadPromises.splice(index, 1);
            }
          })
          .catch(() => {
            // Remove from active downloads even on error
            const index = downloadPromises.indexOf(downloadPromise);
            if (index > -1) {
              downloadPromises.splice(index, 1);
            }
          });
        
        downloadPromises.push(downloadPromise);
      }

      // Wait for at least one download to complete before starting new ones
      if (downloadPromises.length > 0) {
        await Promise.race(downloadPromises);
      }
    }
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

      // Handle Google Drive upload for mobile
      if (session.downloadLocation === 'google-drive') {
        try {
          // For mobile, we'll return the file data so the frontend can handle it
          // via the File System Access API or Google Drive API
          await this.uploadToGoogleDriveMobile(filePath, image.filename, session);
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



  private async createMobileArchive(session: DownloadSession): Promise<void> {
    const zip = new JSZip();
    const sessionDir = this.getSessionDownloadDir(session);
    
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
        const fileData = fs.readFileSync(filePath);
        zip.file(`${pageDir}/${file}`, fileData);
      }
    }

    // Generate ZIP file
    const zipData = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = path.join(sessionDir, `vripper_session_${session.id}.zip`);
    fs.writeFileSync(zipPath, zipData);

    // For mobile, we could also upload the ZIP to Google Drive
    if (session.downloadLocation === 'google-drive' && session.googleDriveFolder) {
      try {
        await googleDriveService.uploadBuffer(
          zipData, 
          `vripper_session_${session.id}.zip`, 
          'application/zip',
          session.googleDriveFolder
        );
      } catch (error) {
        console.error('Failed to upload ZIP to Google Drive:', error);
      }
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

  private generateFilename(scrapedImage: ScrapedImage): string {
    const url = scrapedImage.previewUrl;
    const extension = path.extname(new URL(url).pathname) || '.jpg';
    const basename = path.basename(new URL(url).pathname, extension) || 'image';
    return `${basename}_${scrapedImage.hostingSite}_p${scrapedImage.pageNumber}${extension}`;
  }

  private async updateProgress(sessionId: number, stage: string, message: string): Promise<void> {
    // This would typically emit progress updates via WebSocket or similar
    console.log(`Session ${sessionId}: ${stage} - ${message}`);
  }

  async getDownloadProgress(sessionId: number): Promise<DownloadProgress> {
    const session = await storage.getDownloadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const images = await storage.getDownloadedImagesForSession(sessionId);
    const completedImages = images.filter(img => img.status === 'completed').length;
    const failedImages = images.filter(img => img.status === 'failed').length;
    const activeDownloads = images.filter(img => img.status === 'downloading');

    const overallProgress = session.totalImages > 0 
      ? Math.round((completedImages / session.totalImages) * 100) 
      : 0;

    return {
      sessionId,
      stage: session.status === 'completed' ? 'completed' : 'downloading',
      overallProgress,
      currentStage: `${completedImages}/${session.totalImages} images completed`,
      completedImages,
      totalImages: session.totalImages,
      failedImages,
      activeDownloads: activeDownloads.map(img => ({
        filename: img.filename,
        hostingSite: img.hostingSite || 'unknown',
        progress: img.progress || 0,
      })),
      downloadSpeed: '0 MB/s', // Would calculate based on recent progress
    };
  }

  async cancelDownload(sessionId: number): Promise<void> {
    await storage.updateDownloadSession(sessionId, { status: 'cancelled' });
    this.activeDownloads.delete(sessionId);
  }

  async getZipDownloadPath(sessionId: number): Promise<string> {
    const session = await storage.getDownloadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const sessionDir = this.getSessionDownloadDir(session);
    const zipPath = path.join(sessionDir, `vripper_session_${sessionId}.zip`);
    
    if (!fs.existsSync(zipPath)) {
      throw new Error('ZIP file not found');
    }
    
    return zipPath;
  }
}

export const mobileDownloadManager = new MobileDownloadManager();