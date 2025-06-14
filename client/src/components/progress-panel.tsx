import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Loader2, BarChart3, Image, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getQueryFn } from "@/lib/queryClient";
import type { DownloadProgress } from "@shared/schema";

export default function ProgressPanel() {
  // Get the most recent active session ID
  const { data: sessions } = useQuery({
    queryKey: ["/api/downloads"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 2000,
  });

  const activeSession = sessions?.find((s: any) => s.status === "active");
  const sessionId = activeSession?.id;

  const { data: progress } = useQuery({
    queryKey: ["/api/downloads", sessionId, "progress"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!sessionId,
    refetchInterval: 1000,
  });

  if (!sessionId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="text-primary mr-2" />
            Current Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Ready to start downloading</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const downloadProgress = progress as DownloadProgress;

  return (
    <div className="space-y-6">
      {/* Current Progress Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="text-primary mr-2" />
            Current Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {downloadProgress?.overallProgress || 0}%
              </span>
            </div>
            <Progress value={downloadProgress?.overallProgress || 0} className="h-3" />
          </div>

          {/* Current stage */}
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <AlertDescription className="text-blue-800">
              {downloadProgress?.currentStage || "Initializing..."}
            </AlertDescription>
          </Alert>

          {/* Stage breakdown */}
          <div className="space-y-2">
            <StageItem
              icon={CheckCircle}
              text="Parse pages"
              status={downloadProgress?.stage === "completed" || downloadProgress?.totalImages > 0 ? "completed" : "pending"}
            />
            <StageItem
              icon={CheckCircle}
              text="Extract links"
              status={downloadProgress?.stage === "completed" || downloadProgress?.stage === "downloading" || downloadProgress?.stage === "archiving" ? "completed" : downloadProgress?.stage === "extracting" ? "active" : "pending"}
            />
            <StageItem
              icon={Loader2}
              text="Download images"
              status={downloadProgress?.stage === "completed" ? "completed" : downloadProgress?.stage === "downloading" ? "active" : "pending"}
              progress={downloadProgress?.completedImages && downloadProgress?.totalImages ? `${downloadProgress.completedImages}/${downloadProgress.totalImages}` : undefined}
            />
            <StageItem
              icon={CheckCircle}
              text="Create archive"
              status={downloadProgress?.stage === "completed" ? "completed" : downloadProgress?.stage === "archiving" ? "active" : "pending"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Image className="text-primary mr-2" />
            Active Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {downloadProgress?.activeDownloads?.length > 0 ? (
            <div className="space-y-3">
              {downloadProgress.activeDownloads.map((download, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Image className="text-blue-600 h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{download.filename}</div>
                    <div className="text-xs text-muted-foreground">{download.hostingSite}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{download.progress}%</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active downloads</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Download Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="text-primary mr-2" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {downloadProgress?.completedImages || 0}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">
                {downloadProgress?.totalImages && downloadProgress?.completedImages
                  ? downloadProgress.totalImages - downloadProgress.completedImages
                  : 0}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {downloadProgress?.failedImages || 0}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {downloadProgress?.downloadSpeed || "0 MB/s"}
              </div>
              <div className="text-xs text-muted-foreground">Speed</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StageItemProps {
  icon: any;
  text: string;
  status: "completed" | "active" | "pending";
  progress?: string;
}

function StageItem({ icon: Icon, text, status, progress }: StageItemProps) {
  const getIconColor = () => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "active":
        return "text-primary";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center">
        <Icon className={`mr-2 h-4 w-4 ${getIconColor()} ${status === "active" ? "animate-spin" : ""}`} />
        {text}
      </span>
      <span className={getIconColor()}>
        {status === "completed" ? "✓" : progress || (status === "active" ? "..." : "Pending")}
      </span>
    </div>
  );
}
