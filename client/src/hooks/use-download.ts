import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DownloadRequest } from "@shared/schema";

export function useDownload() {
  const { toast } = useToast();

  const startDownloadMutation = useMutation({
    mutationFn: async (request: DownloadRequest) => {
      const response = await apiRequest("POST", "/api/downloads", request);
      return response.json();
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({
        title: "Download started",
        description: `Started downloading pages ${session.fromPage}-${session.toPage}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to start download",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    },
  });

  return {
    startDownload: startDownloadMutation.mutate,
    isStarting: startDownloadMutation.isPending,
  };
}
