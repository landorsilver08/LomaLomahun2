import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { downloadSessions, downloadedImages } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { DownloadSession, DownloadedImage, InsertDownloadSession, InsertDownloadedImage } from "@shared/schema";

export interface IStorage {
  // Download Sessions
  createDownloadSession(session: InsertDownloadSession): Promise<DownloadSession>;
  getDownloadSession(id: number): Promise<DownloadSession | undefined>;
  updateDownloadSession(id: number, updates: Partial<DownloadSession>): Promise<DownloadSession | undefined>;
  getAllDownloadSessions(): Promise<DownloadSession[]>;
  deleteDownloadSession(id: number): Promise<boolean>;

  // Downloaded Images
  createDownloadedImage(image: InsertDownloadedImage): Promise<DownloadedImage>;
  getDownloadedImagesForSession(sessionId: number): Promise<DownloadedImage[]>;
  updateDownloadedImage(id: number, updates: Partial<DownloadedImage>): Promise<DownloadedImage | undefined>;
  getActiveDownloadsForSession(sessionId: number): Promise<DownloadedImage[]>;
}

class PostgresStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const client = postgres(process.env.DATABASE_URL!);
    this.db = drizzle(client);
  }

  async createDownloadSession(session: InsertDownloadSession): Promise<DownloadSession> {
    const [result] = await this.db.insert(downloadSessions).values(session).returning();
    return result;
  }

  async getDownloadSession(id: number): Promise<DownloadSession | undefined> {
    const [result] = await this.db.select().from(downloadSessions).where(eq(downloadSessions.id, id));
    return result;
  }

  async updateDownloadSession(id: number, updates: Partial<DownloadSession>): Promise<DownloadSession | undefined> {
    const [result] = await this.db.update(downloadSessions).set(updates).where(eq(downloadSessions.id, id)).returning();
    return result;
  }

  async getAllDownloadSessions(): Promise<DownloadSession[]> {
    return await this.db.select().from(downloadSessions).orderBy(desc(downloadSessions.id));
  }

  async deleteDownloadSession(id: number): Promise<boolean> {
    try {
      // Delete associated images first
      await this.db.delete(downloadedImages).where(eq(downloadedImages.sessionId, id));
      // Delete the session
      const result = await this.db.delete(downloadSessions).where(eq(downloadSessions.id, id));
      return Array.isArray(result) ? result.length > 0 : true;
    } catch (error) {
      console.error('Delete session error:', error);
      return false;
    }
  }

  async createDownloadedImage(image: InsertDownloadedImage): Promise<DownloadedImage> {
    const [result] = await this.db.insert(downloadedImages).values(image).returning();
    return result;
  }

  async getDownloadedImagesForSession(sessionId: number): Promise<DownloadedImage[]> {
    return await this.db.select().from(downloadedImages).where(eq(downloadedImages.sessionId, sessionId));
  }

  async updateDownloadedImage(id: number, updates: Partial<DownloadedImage>): Promise<DownloadedImage | undefined> {
    const [result] = await this.db.update(downloadedImages).set(updates).where(eq(downloadedImages.id, id)).returning();
    return result;
  }

  async getActiveDownloadsForSession(sessionId: number): Promise<DownloadedImage[]> {
    return await this.db.select().from(downloadedImages).where(eq(downloadedImages.sessionId, sessionId));
  }
}

export const storage = new PostgresStorage();