import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function MobileAuthHandler() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Check if we're returning from Google OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      toast({
        title: "Authentication Failed",
        description: "Google Drive connection was cancelled or failed.",
        variant: "destructive"
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && !isProcessing) {
      handleGoogleCallback(code, state);
    }
  }, []);

  const handleGoogleCallback = async (code: string, state: string | null) => {
    setIsProcessing(true);
    
    try {
      // Exchange code for tokens
      const response = await apiRequest('POST', '/api/google-drive/auth', { code });
      const tokens = await response.json();

      // Store tokens securely in localStorage for this session
      localStorage.setItem('google_drive_tokens', JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000)
      }));

      // Notify parent about successful connection
      window.dispatchEvent(new CustomEvent('google-drive-connected', {
        detail: { tokens }
      }));

      toast({
        title: "Success",
        description: "Google Drive connected successfully! You can now select it as your download location."
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect Google Drive. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't render anything, this is just a handler
  return null;
}

// Utility functions for mobile directory handling
export class MobileDirectoryManager {
  private static directoryHandle: FileSystemDirectoryHandle | null = null;
  private static googleTokens: any = null;

  static async selectDirectory(): Promise<{ handle: FileSystemDirectoryHandle; name: string } | null> {
    try {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported');
      }

      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      this.directoryHandle = handle;
      return { handle, name: handle.name };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return null; // User cancelled
      }
      throw error;
    }
  }

  static async saveFileToSelectedDirectory(fileName: string, data: Blob): Promise<boolean> {
    try {
      if (!this.directoryHandle) {
        throw new Error('No directory selected');
      }

      const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();

      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }

  static getSelectedDirectoryName(): string | null {
    return this.directoryHandle?.name || null;
  }

  static setGoogleTokens(tokens: any) {
    this.googleTokens = tokens;
    localStorage.setItem('google_drive_tokens', JSON.stringify(tokens));
  }

  static getGoogleTokens(): any {
    if (this.googleTokens) return this.googleTokens;
    
    const stored = localStorage.getItem('google_drive_tokens');
    if (stored) {
      const tokens = JSON.parse(stored);
      // Check if tokens are still valid
      if (tokens.expires_at && Date.now() < tokens.expires_at) {
        this.googleTokens = tokens;
        return tokens;
      } else {
        localStorage.removeItem('google_drive_tokens');
      }
    }
    return null;
  }

  static isGoogleDriveConnected(): boolean {
    return !!this.getGoogleTokens();
  }

  static disconnectGoogleDrive() {
    this.googleTokens = null;
    localStorage.removeItem('google_drive_tokens');
  }
}