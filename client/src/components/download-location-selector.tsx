import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Cloud, Plus, ExternalLink } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DownloadLocationData {
  downloadLocation: "local" | "google-drive";
  customDirectory?: string;
  googleDriveFolder?: string;
  googleDriveFolderName?: string;
}

interface DownloadLocationSelectorProps {
  location: DownloadLocationData;
  onLocationChange: (location: DownloadLocationData) => void;
}

interface GoogleDriveFolder {
  id: string;
  name: string;
}

interface GoogleDriveTokens {
  access_token: string;
  refresh_token: string;
}

export default function DownloadLocationSelector({ 
  location, 
  onLocationChange 
}: DownloadLocationSelectorProps) {
  const [isGoogleDriveDialogOpen, setIsGoogleDriveDialogOpen] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<GoogleDriveTokens | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const { toast } = useToast();

  // Get Google Drive auth URL
  const { data: authUrlData } = useQuery({
    queryKey: ['/api/google-drive/auth-url'],
    enabled: false
  });

  // Get Google Drive folders
  const { data: folders, refetch: refetchFolders } = useQuery({
    queryKey: ['/api/google-drive/folders'],
    enabled: false
  });

  // Exchange auth code for tokens
  const exchangeTokensMutation = useMutation({
    mutationFn: async (code: string) => {
      return await apiRequest('/api/google-drive/auth', 'POST', { code });
    },
    onSuccess: (tokens: GoogleDriveTokens) => {
      setGoogleTokens(tokens);
      toast({
        title: "Success",
        description: "Google Drive authenticated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to authenticate with Google Drive",
        variant: "destructive"
      });
    }
  });

  // List folders mutation
  const listFoldersMutation = useMutation({
    mutationFn: async () => {
      if (!googleTokens) throw new Error("Not authenticated");
      return await apiRequest('/api/google-drive/folders', 'POST', {
        accessToken: googleTokens.access_token,
        refreshToken: googleTokens.refresh_token
      });
    },
    onSuccess: (folders: GoogleDriveFolder[]) => {
      // Update query cache
      refetchFolders();
    }
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      if (!googleTokens) throw new Error("Not authenticated");
      return await apiRequest('/api/google-drive/create-folder', 'POST', {
        name: folderName,
        accessToken: googleTokens.access_token,
        refreshToken: googleTokens.refresh_token
      });
    },
    onSuccess: () => {
      setNewFolderName("");
      listFoldersMutation.mutate();
      toast({
        title: "Success",
        description: "Folder created successfully"
      });
    }
  });

  const handleLocationChange = (value: "local" | "google-drive") => {
    onLocationChange({
      ...location,
      downloadLocation: value
    });
  };

  const handleCustomDirectoryChange = (directory: string) => {
    onLocationChange({
      ...location,
      customDirectory: directory
    });
  };

  const handleGoogleDriveFolderSelect = (folderId: string, folderName: string) => {
    onLocationChange({
      ...location,
      googleDriveFolder: folderId,
      googleDriveFolderName: folderName
    });
  };

  const openGoogleDriveAuth = async () => {
    try {
      const response = await apiRequest('/api/google-drive/auth-url');
      window.open(response.authUrl, '_blank');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get Google Drive auth URL",
        variant: "destructive"
      });
    }
  };

  const handleAuthCodeSubmit = () => {
    if (authCode.trim()) {
      exchangeTokensMutation.mutate(authCode.trim());
      setAuthCode("");
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Download Location
        </CardTitle>
        <CardDescription>
          Choose where to save your downloaded images
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup 
          value={location.downloadLocation} 
          onValueChange={handleLocationChange}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="local" id="local" />
            <Label htmlFor="local" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Local Storage
            </Label>
          </div>
          
          {location.downloadLocation === "local" && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="custom-directory">Custom Directory (optional)</Label>
              <Input
                id="custom-directory"
                placeholder="/path/to/your/directory"
                value={location.customDirectory || ""}
                onChange={(e) => handleCustomDirectoryChange(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Leave empty to use default downloads folder
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="google-drive" id="google-drive" />
            <Label htmlFor="google-drive" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Google Drive
            </Label>
          </div>

          {location.downloadLocation === "google-drive" && (
            <div className="ml-6 space-y-2">
              <Dialog open={isGoogleDriveDialogOpen} onOpenChange={setIsGoogleDriveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    {location.googleDriveFolderName ? (
                      <span>Selected: {location.googleDriveFolderName}</span>
                    ) : (
                      <span>Select Google Drive Folder</span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Google Drive Setup</DialogTitle>
                    <DialogDescription>
                      Authenticate with Google Drive and select a folder for downloads
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {!googleTokens ? (
                      <div className="space-y-3">
                        <Button onClick={openGoogleDriveAuth} className="w-full">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Authenticate with Google Drive
                        </Button>
                        <div className="space-y-2">
                          <Label htmlFor="auth-code">Authorization Code</Label>
                          <Input
                            id="auth-code"
                            placeholder="Paste the authorization code here"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                          />
                          <Button 
                            onClick={handleAuthCodeSubmit} 
                            disabled={!authCode.trim() || exchangeTokensMutation.isPending}
                            className="w-full"
                          >
                            {exchangeTokensMutation.isPending ? "Authenticating..." : "Submit Code"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-green-600">
                            Authenticated
                          </Badge>
                          <Button 
                            onClick={() => listFoldersMutation.mutate()} 
                            disabled={listFoldersMutation.isPending}
                            size="sm"
                          >
                            {listFoldersMutation.isPending ? "Loading..." : "Load Folders"}
                          </Button>
                        </div>

                        {folders && (
                          <div className="space-y-2">
                            <Label>Select Folder</Label>
                            <Select 
                              onValueChange={(value) => {
                                const folder = folders.find((f: GoogleDriveFolder) => f.id === value);
                                if (folder) {
                                  handleGoogleDriveFolderSelect(folder.id, folder.name);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a folder" />
                              </SelectTrigger>
                              <SelectContent>
                                {folders.map((folder: GoogleDriveFolder) => (
                                  <SelectItem key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="new-folder">Create New Folder</Label>
                          <div className="flex gap-2">
                            <Input
                              id="new-folder"
                              placeholder="Folder name"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                            />
                            <Button 
                              onClick={handleCreateFolder}
                              disabled={!newFolderName.trim() || createFolderMutation.isPending}
                              size="sm"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button 
                      onClick={() => setIsGoogleDriveDialogOpen(false)}
                      disabled={location.downloadLocation === "google-drive" && !location.googleDriveFolder}
                    >
                      Done
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {location.googleDriveFolder && (
                <p className="text-sm text-muted-foreground">
                  Images will be uploaded to: {location.googleDriveFolderName}
                </p>
              )}
            </div>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}