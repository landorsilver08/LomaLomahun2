import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { downloadManager } from "./services/downloader";
import { mobileDownloadManager } from "./services/mobile-download-manager";
import { ViperGirlsScraper } from "./services/scraper";
import { googleDriveService } from "./services/google-drive";
import { insertDownloadSessionSchema, type DownloadRequest } from "@shared/schema";
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

export async function registerRoutes(app: Express): Promise<Server> {
  const scraper = new ViperGirlsScraper();

  // Parse thread URL and detect page
  app.post("/api/parse-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log('Parsing URL:', url);
      const parsed = await scraper.parseThreadUrl(url);
      console.log('Parsed result:', parsed);
      res.json(parsed);
    } catch (error) {
      console.error('URL parsing error:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to parse URL" 
      });
    }
  });

  // Extract ImageBam and Imgbox images from ViperGirls thread
  app.post("/api/extract-images", async (req, res) => {
    try {
      const { threadUrl, pageCount = 3 } = req.body;
      
      if (!threadUrl) {
        return res.status(400).json({ error: "Thread URL is required" });
      }

      console.log(`Extracting ImageBam/Imgbox images from: ${threadUrl} (${pageCount} pages)`);
      
      const { threadId, currentPage } = await scraper.parseThreadUrl(threadUrl);
      const startPage = currentPage || 1;
      const allImages = [];
      const pageTexts = [];
      
      // Scan multiple pages for comprehensive image extraction
      for (let page = startPage; page < startPage + pageCount; page++) {
        try {
          console.log(`Scraping page ${page}...`);
          const pageImages = await scraper.scrapeThreadPage(threadId, page);
          allImages.push(...pageImages);
          
          // Extract page text summary
          const pageText = await scraper.extractPageText(threadId, page);
          if (pageText) {
            pageTexts.push({
              page,
              summary: pageText.substring(0, 200) + (pageText.length > 200 ? '...' : ''),
              fullText: pageText
            });
          }
        } catch (pageError) {
          console.log(`Page ${page} not found or error, stopping scan`);
          break;
        }
      }

      // Transform scraped images to match frontend interface
      const transformedImages = allImages.map((img, index) => ({
        url: img.hostingPage,
        previewUrl: img.previewUrl,
        hostingSite: img.hostingSite,
        fileName: `${img.hostingSite.replace('.com', '')}_${img.pageNumber}_${index + 1}.jpg`,
        isValid: true,
        pageNumber: img.pageNumber
      }));

      console.log(`Found ${transformedImages.length} ImageBam/Imgbox images across ${pageTexts.length} pages`);
      res.json({ 
        images: transformedImages, 
        totalImages: transformedImages.length,
        pageTexts,
        scannedPages: pageTexts.length
      });
    } catch (error) {
      console.error('Extract images error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to extract images" 
      });
    }
  });

  // Download individual image from ImageBam or Imgbox
  app.post("/api/download-image", async (req, res) => {
    try {
      const { url, fileName, hostingSite } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      console.log('Downloading image from:', url);
      
      // Get full resolution URL
      const fullResUrl = await scraper.getFullResolutionUrl(url);
      
      // Download the image
      const response = await axios.get(fullResUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 30000
      });

      // Set appropriate headers for download
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Pipe the image data to response
      response.data.pipe(res);
      
    } catch (error) {
      console.error('Download image error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to download image" 
      });
    }
  });

  // Start a new download
  app.post("/api/downloads", async (req, res) => {
    try {
      const downloadRequest: DownloadRequest = req.body;
      
      // Validate the request
      const validatedData = insertDownloadSessionSchema.parse({
        threadUrl: downloadRequest.threadUrl,
        fromPage: downloadRequest.fromPage,
        toPage: downloadRequest.toPage,
        outputFormat: downloadRequest.outputFormat,
        downloadLocation: downloadRequest.downloadLocation,
        customDirectory: downloadRequest.customDirectory,
        googleDriveFolder: downloadRequest.googleDriveFolder,
        concurrentLimit: downloadRequest.concurrentLimit,
        retryEnabled: downloadRequest.retryEnabled,
        preserveFilenames: downloadRequest.preserveFilenames,
        skipExisting: downloadRequest.skipExisting,
        selectedImages: downloadRequest.selectedImages ? JSON.stringify(downloadRequest.selectedImages) : null,
        status: 'pending',
        totalImages: 0,
        completedImages: 0,
        failedImages: 0,
      });

      // Create download session
      const session = await storage.createDownloadSession(validatedData);
      
      // Start download in background
      downloadManager.startDownload(session.id).catch(error => {
        console.error(`Download ${session.id} failed:`, error);
      });

      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to start download" 
      });
    }
  });

  // Get download progress
  app.get("/api/downloads/:id/progress", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const progress = await downloadManager.getDownloadProgress(sessionId);
      res.json(progress);
    } catch (error) {
      res.status(404).json({ 
        error: error instanceof Error ? error.message : "Progress not found" 
      });
    }
  });

  // Cancel download
  app.post("/api/downloads/:id/cancel", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      await downloadManager.cancelDownload(sessionId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to cancel download" 
      });
    }
  });

  // Get all download sessions (history)
  app.get("/api/downloads", async (req, res) => {
    try {
      const sessions = await storage.getAllDownloadSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch downloads" 
      });
    }
  });

  // Delete download session
  app.delete("/api/downloads/:id", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const deleted = await storage.deleteDownloadSession(sessionId);
      if (!deleted) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete session" 
      });
    }
  });

  // Download ZIP file
  app.get("/api/downloads/:id/zip", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id, 10);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const zipPath = await downloadManager.getZipDownloadPath(sessionId);
      const filename = `vripper_session_${sessionId}.zip`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/zip');
      
      const stream = fs.createReadStream(zipPath);
      stream.pipe(res);
    } catch (error) {
      res.status(404).json({ 
        error: error instanceof Error ? error.message : "ZIP file not found" 
      });
    }
  });

  // Google Drive authentication URL
  app.get("/api/google-drive/auth-url", (req, res) => {
    try {
      const authUrl = googleDriveService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate auth URL" 
      });
    }
  });

  // Exchange authorization code for tokens
  app.post("/api/google-drive/auth", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Authorization code is required" });
      }

      const tokens = await googleDriveService.getTokens(code);
      res.json(tokens);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to exchange authorization code" 
      });
    }
  });

  // List Google Drive folders
  app.post("/api/google-drive/folders", async (req, res) => {
    try {
      const { accessToken, refreshToken } = req.body;
      if (!accessToken || !refreshToken) {
        return res.status(400).json({ error: "Access and refresh tokens are required" });
      }

      await googleDriveService.setCredentials(accessToken, refreshToken);
      const folders = await googleDriveService.listFolders();
      res.json(folders);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to list folders" 
      });
    }
  });

  // Create Google Drive folder
  app.post("/api/google-drive/create-folder", async (req, res) => {
    try {
      const { name, parentFolderId, accessToken, refreshToken } = req.body;
      if (!name || !accessToken || !refreshToken) {
        return res.status(400).json({ error: "Folder name, access token, and refresh token are required" });
      }

      await googleDriveService.setCredentials(accessToken, refreshToken);
      const folderId = await googleDriveService.createFolder(name, parentFolderId);
      res.json({ folderId });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to create folder" 
      });
    }
  });

  // Placeholder image endpoint
  app.get("/api/placeholder/:width/:height", (req, res) => {
    const { width, height } = req.params;
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" dy=".3em">
        ${width}x${height}
      </text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });

  const httpServer = createServer(app);
  return httpServer;
}
