import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { History, Trash2, RotateCcw, FolderOpen, Download, Calendar, Image as ImageIcon, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DownloadSession } from "@shared/schema";

export default function DownloadHistory() {
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["/api/downloads"],
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      await apiRequest("DELETE", `/api/downloads/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({
        title: "Session deleted",
        description: "Download session has been removed from history.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete session",
        variant: "destructive",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const completedSessions = sessions?.filter((s: DownloadSession) => s.status === "completed") || [];
      await Promise.all(
        completedSessions.map((session: DownloadSession) =>
          apiRequest("DELETE", `/api/downloads/${session.id}`)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({
        title: "History cleared",
        description: "All completed download sessions have been removed.",
      });
    },
  });

  const downloadZipMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/downloads/${sessionId}/zip`);
      if (!response.ok) throw new Error("Failed to download ZIP");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vripper_session_${sessionId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error) => {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download ZIP file",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="text-primary mr-2" />
            Download History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-pulse">Loading history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const downloadSessions = (sessions as DownloadSession[]) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <History className="text-primary mr-2" />
            Download History
          </CardTitle>
          {downloadSessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear History
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {downloadSessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No download history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {downloadSessions.map((session) => (
              <HistoryItem
                key={session.id}
                session={session}
                onDelete={() => deleteMutation.mutate(session.id)}
                onDownloadZip={() => downloadZipMutation.mutate(session.id)}
                isDeleting={deleteMutation.isPending}
                isDownloadingZip={downloadZipMutation.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface HistoryItemProps {
  session: DownloadSession;
  onDelete: () => void;
  onDownloadZip: () => void;
  isDeleting: boolean;
  isDownloadingZip: boolean;
}

function HistoryItem({ session, onDelete, onDownloadZip, isDeleting, isDownloadingZip }: HistoryItemProps) {
  const getStatusBadge = () => {
    switch (session.status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "active":
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDuration = (start: Date | null, end: Date | null) => {
    if (!start || !end) return "Unknown";
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Unknown";
    const now = new Date();
    const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    const days = Math.round(diffHours / 24);
    return `${days} days ago`;
  };

  const threadTitle = session.threadTitle || `Thread - Pages ${session.fromPage}-${session.toPage}`;

  return (
    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-2">
          <div className="font-medium text-foreground">{threadTitle}</div>
          {getStatusBadge()}
        </div>
        <div className="text-sm text-muted-foreground flex items-center space-x-4">
          <span className="flex items-center">
            <ImageIcon className="mr-1 h-3 w-3" />
            {session.totalImages || 0} images
          </span>
          {session.startedAt && session.completedAt && (
            <span className="flex items-center">
              <Clock className="mr-1 h-3 w-3" />
              {formatDuration(session.startedAt, session.completedAt)}
            </span>
          )}
          <span className="flex items-center">
            <Calendar className="mr-1 h-3 w-3" />
            {formatDate(session.startedAt)}
          </span>
        </div>
        {session.status === "failed" && session.errorMessage && (
          <div className="mt-2 text-sm text-red-600 flex items-center">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {session.errorMessage}
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {session.status === "failed" && (
          <Button variant="ghost" size="sm" title="Retry download">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" title="Show files">
          <FolderOpen className="h-4 w-4" />
        </Button>
        {session.status === "completed" && session.outputFormat === "zip" && (
          <Button
            size="sm"
            onClick={onDownloadZip}
            disabled={isDownloadingZip}
            title="Download ZIP"
          >
            <Download className="mr-1 h-4 w-4" />
            ZIP
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete session"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
