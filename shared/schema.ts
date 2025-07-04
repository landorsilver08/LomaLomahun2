import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const downloadSessions = pgTable("download_sessions", {
  id: serial("id").primaryKey(),
  threadUrl: text("thread_url").notNull(),
  threadTitle: text("thread_title"),
  fromPage: integer("from_page").notNull(),
  toPage: integer("to_page").notNull(),
  totalImages: integer("total_images").default(0),
  completedImages: integer("completed_images").default(0),
  failedImages: integer("failed_images").default(0),
  status: text("status").notNull().default("pending"), // pending, active, completed, failed, cancelled
  outputFormat: text("output_format").notNull().default("individual"), // individual, zip
  downloadLocation: text("download_location").notNull().default("local"), // local, google-drive
  customDirectory: text("custom_directory"), // Custom local directory path
  googleDriveFolder: text("google_drive_folder"), // Google Drive folder ID
  concurrentLimit: integer("concurrent_limit").default(3),
  retryEnabled: boolean("retry_enabled").default(true),
  preserveFilenames: boolean("preserve_filenames").default(true),
  skipExisting: boolean("skip_existing").default(false),
  selectedImages: text("selected_images"), // JSON string of selected images
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

export const downloadedImages = pgTable("downloaded_images", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  originalUrl: text("original_url").notNull(),
  hostingSite: text("hosting_site"),
  filename: text("filename").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending"), // pending, downloading, completed, failed
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
});

export const insertDownloadSessionSchema = createInsertSchema(downloadSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertDownloadedImageSchema = createInsertSchema(downloadedImages).omit({
  id: true,
});

export type InsertDownloadSession = z.infer<typeof insertDownloadSessionSchema>;
export type InsertDownloadedImage = z.infer<typeof insertDownloadedImageSchema>;
export type DownloadSession = typeof downloadSessions.$inferSelect;
export type DownloadedImage = typeof downloadedImages.$inferSelect;

// API types
export type DownloadRequest = {
  threadUrl: string;
  fromPage: number;
  toPage: number;
  outputFormat: "individual" | "zip";
  downloadLocation: "local";
  customDirectory?: string;
  concurrentLimit: number;
  retryEnabled: boolean;
  preserveFilenames: boolean;
  skipExisting: boolean;
  selectedImages?: {
    previewUrl: string;
    hostingPage: string;
    hostingSite: string;
    pageNumber: number;
  }[];
};

export type DownloadProgress = {
  sessionId: number;
  stage: "parsing" | "extracting" | "downloading" | "archiving" | "completed";
  overallProgress: number;
  currentStage: string;
  completedImages: number;
  totalImages: number;
  failedImages: number;
  activeDownloads: Array<{
    filename: string;
    hostingSite: string;
    progress: number;
  }>;
  downloadSpeed: string;
};
