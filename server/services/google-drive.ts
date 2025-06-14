import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

export interface GoogleDriveConfig {
  accessToken: string;
  refreshToken: string;
  folderId?: string;
}

export class GoogleDriveService {
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
    );

    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth2Client
    });
  }

  async setCredentials(accessToken: string, refreshToken: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }

  async createFolder(name: string, parentFolderId?: string) {
    try {
      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async uploadFile(filePath: string, fileName: string, folderId?: string) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined
      };

      const media = {
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      return response.data.id;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async uploadBuffer(buffer: Buffer, fileName: string, mimeType: string, folderId?: string) {
    try {
      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined
      };

      const media = {
        mimeType: mimeType,
        body: buffer
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      return response.data.id;
    } catch (error) {
      console.error('Error uploading buffer:', error);
      throw error;
    }
  }

  async listFolders(query?: string) {
    try {
      const response = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder'${query ? ` and ${query}` : ''}`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  }

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async getTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }
}

export const googleDriveService = new GoogleDriveService();