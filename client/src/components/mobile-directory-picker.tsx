import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Cloud, Smartphone, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MobileDirectoryData {
  downloadLocation: "local" | "google-drive";
  selectedDirectory?: FileSystemDirectoryHandle;
  directoryName?: string;
  googleDriveConnected?: boolean;
  googleDriveAccessToken?: string;
}

interface MobileDirectoryPickerProps {
  location: MobileDirectoryData;
  onLocationChange: (location: MobileDirectoryData) => void;
}

export default function MobileDirectoryPicker({ 
  location, 
  onLocationChange 
}: MobileDirectoryPickerProps) {
  const [isPickingDirectory, setIsPickingDirectory] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const { toast } = useToast();

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = 'showDirectoryPicker' in window;

  const handleLocalDirectoryPicker = async () => {
    if (!isFileSystemAccessSupported) {
      toast({
        title: "Not Supported",
        description: "Your browser doesn't support native directory selection. This feature works best on mobile devices.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsPickingDirectory(true);
      
      // Open native directory picker
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      onLocationChange({
        ...location,
        downloadLocation: "local",
        selectedDirectory: directoryHandle,
        directoryName: directoryHandle.name
      });

      toast({
        title: "Directory Selected",
        description: `Selected folder: ${directoryHandle.name}`
      });

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({
          title: "Error",
          description: "Failed to select directory. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsPickingDirectory(false);
    }
  };

  const handleGoogleDriveAuth = async () => {
    try {
      setIsConnectingDrive(true);

      // Create a more mobile-friendly OAuth flow
      const authParams = new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-client-id',
        redirect_uri: window.location.origin + '/auth/google/callback',
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file',
        access_type: 'offline',
        prompt: 'consent',
        state: Math.random().toString(36).substring(2, 15)
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams}`;
      
      // On mobile, this will open the native Google OAuth dialog
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        // Mobile: Open in same window for better UX
        window.location.href = authUrl;
      } else {
        // Desktop: Open in popup
        const popup = window.open(
          authUrl,
          'google-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for popup completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setIsConnectingDrive(false);
          }
        }, 1000);
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to Google Drive. Please try again.",
        variant: "destructive"
      });
      setIsConnectingDrive(false);
    }
  };

  const handleLocationChange = (value: "local" | "google-drive") => {
    onLocationChange({
      ...location,
      downloadLocation: value
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Storage Options
        </CardTitle>
        <CardDescription>
          Choose where to save your downloaded images with native mobile integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup 
          value={location.downloadLocation} 
          onValueChange={handleLocationChange}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="local" id="mobile-local" />
            <Label htmlFor="mobile-local" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Phone Storage
            </Label>
          </div>
          
          {location.downloadLocation === "local" && (
            <div className="ml-6 space-y-3">
              <Button
                onClick={handleLocalDirectoryPicker}
                disabled={isPickingDirectory}
                variant="outline"
                className="w-full"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {isPickingDirectory ? "Opening File Picker..." : "Select Folder on Phone"}
              </Button>
              
              {location.directoryName && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    Selected: {location.directoryName}
                  </Badge>
                </div>
              )}
              
              {!isFileSystemAccessSupported && (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  Native directory picker not available. Using default downloads folder.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="google-drive" id="mobile-drive" />
            <Label htmlFor="mobile-drive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Google Drive
            </Label>
          </div>

          {location.downloadLocation === "google-drive" && (
            <div className="ml-6 space-y-3">
              {!location.googleDriveConnected ? (
                <Button
                  onClick={handleGoogleDriveAuth}
                  disabled={isConnectingDrive}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {isConnectingDrive ? "Connecting..." : "Connect Google Drive"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-green-600">
                    Google Drive Connected
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Images will be uploaded to your Google Drive
                  </p>
                </div>
              )}
              
              <p className="text-sm text-muted-foreground">
                This will open your phone's Google login screen to safely connect your account.
              </p>
            </div>
          )}
        </RadioGroup>

        {/* Mobile-specific instructions */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            Mobile Features:
          </h4>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Phone Storage: Opens your device's native file manager</li>
            <li>• Google Drive: Uses your phone's Google account integration</li>
            <li>• All selections are saved securely on your device</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}