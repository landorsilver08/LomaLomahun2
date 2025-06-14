import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { downloadManager } from "./services/downloader";
import { ViperGirlsScraper } from "./services/scraper";
import { insertDownloadSessionSchema, type DownloadRequest } from "@shared/schema";
import * as path from 'path';
import * as fs from 'fs';

export async function registerRoutes(app: Express): Promise<Server> {
  const scraper = new ViperGirlsScraper();

  // Parse thread URL and detect page
  app.post("/api/parse-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      const parsed = await scraper.parseThreadUrl(url);
      res.json(parsed);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to parse URL" 
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
        concurrentLimit: downloadRequest.concurrentLimit,
        retryEnabled: downloadRequest.retryEnabled,
        preserveFilenames: downloadRequest.preserveFilenames,
        skipExisting: downloadRequest.skipExisting,
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

  const httpServer = createServer(app);
  return httpServer;
}
