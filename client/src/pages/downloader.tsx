import { useState, useEffect } from "react";
import { Download, Settings, HelpCircle, Eye } from "lucide-react";
import UrlInput from "@/components/url-input";
import PageRangeSelector from "@/components/page-range-selector";
import DownloadOptions from "@/components/download-options";
import DirectoryPicker from "@/components/directory-picker";
import ImagePreview from "@/components/image-preview";
import ProgressPanel from "@/components/progress-panel";
import DownloadHistory from "@/components/download-history";
import { Button } from "@/components/ui/button";
import { useDownload } from "@/hooks/use-download";
import type { DownloadRequest } from "@shared/schema";

export default function DownloaderPage() {
  const [threadUrl, setThreadUrl] = useState("");
  const [detectedPage, setDetectedPage] = useState<number | null>(null);
  const [pageRange, setPageRange] = useState({ from: 1, to: 1 });
  const [showPreview, setShowPreview] = useState(false);
  const [selectedImages, setSelectedImages] = useState<any[]>([]);
  const [downloadOptions, setDownloadOptions] = useState({
    outputFormat: "individual" as "individual" | "zip",
    concurrentLimit: 3,
    retryEnabled: true,
    preserveFilenames: true,
    skipExisting: false,
  });

  const [downloadLocation, setDownloadLocation] = useState("local" as "local");

  const { startDownload, isStarting } = useDownload();

  const handleStartDownload = async () => {
    if (!threadUrl) return;

    const request: DownloadRequest = {
      threadUrl,
      fromPage: pageRange.from,
      toPage: pageRange.to,
      ...downloadOptions,
      downloadLocation: downloadLocation,
      selectedImages: selectedImages.length > 0 ? selectedImages : undefined,
    };

    await startDownload(request);
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  const handleImagesSelected = (images: any[]) => {
    setSelectedImages(images);
  };

  const isFormValid = threadUrl && pageRange.from <= pageRange.to;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Download className="text-primary text-2xl" />
              <h1 className="text-xl font-semibold text-foreground">VRipper</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Help">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Input Panel */}
          <div className="lg:col-span-2 space-y-6">
            <UrlInput
              value={threadUrl}
              onChange={setThreadUrl}
              onPageDetected={setDetectedPage}
            />

            <PageRangeSelector
              detectedPage={detectedPage}
              pageRange={pageRange}
              onPageRangeChange={setPageRange}
            />

            <DownloadOptions
              options={downloadOptions}
              onOptionsChange={setDownloadOptions}
            />

            <div className="flex space-x-4">
              <Button
                onClick={handlePreviewToggle}
                disabled={!isFormValid}
                variant="outline"
                className="flex-1 h-12 text-base font-semibold"
                size="lg"
              >
                <Eye className="mr-2 h-5 w-5" />
                {showPreview ? "Hide Preview" : "Preview Images"}
              </Button>
              
              <Button
                onClick={handleStartDownload}
                disabled={!isFormValid || isStarting}
                className="flex-1 h-12 text-base font-semibold"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                {isStarting ? "Starting Download..." : "Start Download"}
              </Button>
            </div>
          </div>

          {/* Progress Sidebar */}
          <div className="space-y-6">
            <ProgressPanel />
          </div>
        </div>

        {/* Image Preview */}
        {showPreview && isFormValid && (
          <div className="mt-8">
            <ImagePreview
              threadUrl={threadUrl}
              fromPage={pageRange.from}
              toPage={pageRange.to}
              onImagesSelected={handleImagesSelected}
            />
          </div>
        )}

        {/* Download History */}
        <div className="mt-8">
          <DownloadHistory />
        </div>
      </main>
    </div>
  );
}
