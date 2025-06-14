import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FolderOpen } from "lucide-react";

interface DownloadLocationData {
  downloadLocation: "local";
  customDirectory: string | undefined;
}

interface DownloadLocationSelectorProps {
  location: DownloadLocationData;
  onLocationChange: (location: DownloadLocationData) => void;
}

export default function DownloadLocationSelector({ 
  location, 
  onLocationChange 
}: DownloadLocationSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Download Location
        </CardTitle>
        <CardDescription>
          Specify where downloaded images should be saved
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="custom-directory">Custom Directory (Optional)</Label>
          <Input
            id="custom-directory"
            placeholder="e.g., /path/to/downloads"
            value={location.customDirectory || ""}
            onChange={(e) => onLocationChange({
              ...location,
              customDirectory: e.target.value || undefined
            })}
          />
          <p className="text-sm text-muted-foreground">
            Leave empty to use default downloads directory
          </p>
        </div>
      </CardContent>
    </Card>
  );
