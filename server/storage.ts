import { 
  downloadSessions, 
  downloadedImages,
  type DownloadSession, 
  type DownloadedImage,
  type InsertDownloadSession,
  type InsertDownloadedImage 
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private downloadSessions: Map<number, DownloadSession>;
  private downloadedImages: Map<number, DownloadedImage>;
  private currentSessionId: number;
  private currentImageId: number;

  constructor() {
    this.downloadSessions = new Map();
    this.downloadedImages = new Map();
    this.currentSessionId = 1;
    this.currentImageId = 1;
  }

  async createDownloadSession(insertSession: InsertDownloadSession): Promise<DownloadSession> {
    const id = this.currentSessionId++;
    const session: DownloadSession = {
      ...insertSession,
      id,
      startedAt: new Date(),
      completedAt: null,
    };
    this.downloadSessions.set(id, session);
    return session;
  }

  async getDownloadSession(id: number): Promise<DownloadSession | undefined> {
    return this.downloadSessions.get(id);
  }

  async updateDownloadSession(id: number, updates: Partial<DownloadSession>): Promise<DownloadSession | undefined> {
    const session = this.downloadSessions.get(id);
    if (session) {
      const updatedSession = { ...session, ...updates };
      this.downloadSessions.set(id, updatedSession);
      return updatedSession;
    }
    return undefined;
  }

  async getAllDownloadSessions(): Promise<DownloadSession[]> {
    return Array.from(this.downloadSessions.values()).sort((a, b) => 
      (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0)
    );
  }

  async deleteDownloadSession(id: number): Promise<boolean> {
    // Also delete related images
    const images = Array.from(this.downloadedImages.values()).filter(img => img.sessionId === id);
    images.forEach(img => this.downloadedImages.delete(img.id));
    
    return this.downloadSessions.delete(id);
  }

  async createDownloadedImage(insertImage: InsertDownloadedImage): Promise<DownloadedImage> {
    const id = this.currentImageId++;
    const image: DownloadedImage = {
      ...insertImage,
      id,
    };
    this.downloadedImages.set(id, image);
    return image;
  }

  async getDownloadedImagesForSession(sessionId: number): Promise<DownloadedImage[]> {
    return Array.from(this.downloadedImages.values()).filter(img => img.sessionId === sessionId);
  }

  async updateDownloadedImage(id: number, updates: Partial<DownloadedImage>): Promise<DownloadedImage | undefined> {
    const image = this.downloadedImages.get(id);
    if (image) {
      const updatedImage = { ...image, ...updates };
      this.downloadedImages.set(id, updatedImage);
      return updatedImage;
    }
    return undefined;
  }

  async getActiveDownloadsForSession(sessionId: number): Promise<DownloadedImage[]> {
    return Array.from(this.downloadedImages.values()).filter(
      img => img.sessionId === sessionId && img.status === "downloading"
    );
  }
}

export const storage = new MemStorage();
