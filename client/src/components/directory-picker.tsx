import { useState } from "react";
import { Folder, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DirectoryPickerProps {
  onDirectorySelected: (handle: FileSystemDirectoryHandle | null) => void;
  selectedDirectory: FileSystemDirectoryHandle | null;
}

export default function DirectoryPicker({ onDirectorySelected, selectedDirectory }: DirectoryPickerProps) {
  const [isSupported, setIsSupported] = useState(
    'showDirectoryPicker' in window
  );

  const handleSelectDirectory = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const directoryHandle = await window.showDirectoryPicker({
          mode: 'readwrite'
        });
        onDirectorySelected(directoryHandle);
      }
    } catch (error) {
      console.error('Directory selection cancelled or failed:', error);
    }
  };

  const handleClearDirectory = () => {
    onDirectorySelected(null);
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Folder className="text-primary mr-2" />
            Download Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Browser directory selection is not supported. Downloads will be saved to your default download folder.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Folder className="text-primary mr-2" />
          Download Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedDirectory ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <FolderOpen className="h-5 w-5 text-green-600" />
              <span className="text-green-800 font-medium">
                {selectedDirectory.name}
              </span>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={handleSelectDirectory} 
                variant="outline" 
                className="flex-1"
              >
                Change Directory
              </Button>
              <Button 
                onClick={handleClearDirectory} 
                variant="outline"
                className="flex-1"
              >
                Use Default
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                Downloads will be saved to your browser's default download folder, or you can select a specific directory.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleSelectDirectory} 
              className="w-full"
              variant="outline"
            >
              <Folder className="mr-2 h-4 w-4" />
              Select Download Directory
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}