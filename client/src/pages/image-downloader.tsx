import { useState, useEffect } from "react";
import { Download, Eye, Copy, CheckCircle2, AlertCircle, Loader2, Image, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import PWAInstallButton from "@/components/pwa-install-button";

interface ImageData {
  url: string;
  previewUrl: string;
  hostingSite: string;
  fileName: string;
  isValid: boolean;
  pageNumber?: number;
}

interface PageText {
  page: number;
  summary: string;
  fullText: string;
}

interface DownloadProgress {
  url: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
}

export default function ImageDownloaderPage() {
  const [inputUrl, setInputUrl] = useState("");
  const [images, setImages] = useState<ImageData[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [pageTexts, setPageTexts] = useState<PageText[]>([]);
  const [scannedPages, setScannedPages] = useState(0);
  const { toast } = useToast();

  const extractImagesMutation = useMutation({
    mutationFn: async (threadUrl: string) => {
      const response = await fetch('/api/extract-images', {
        method: 'POST',
        body: JSON.stringify({ threadUrl }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to extract images');
      return response.json();
    },
    onSuccess: (data) => {
      setImages(data.images || []);
      setPageTexts(data.pageTexts || []);
      setScannedPages(data.scannedPages || 0);
      if (data.images?.length > 0) {
        toast({
          title: "Images extracted",
          description: `Found ${data.images.length} images across ${data.scannedPages} pages`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Failed to extract images",
        variant: "destructive"
      });
    }
  });

  const downloadImageMutation = useMutation({
    mutationFn: async (imageData: ImageData) => {
      const response = await fetch('/api/download-image', {
        method: 'POST',
        body: JSON.stringify({ 
          url: imageData.url,
          fileName: imageData.fileName,
          hostingSite: imageData.hostingSite
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to download image');
      return response.blob();
    },
    onSuccess: (blob, imageData) => {
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = imageData.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update download status
      setDownloads(prev => prev.map(d => 
        d.url === imageData.url 
          ? { ...d, progress: 100, status: 'completed' }
          : d
      ));

      toast({
        title: "Download completed",
        description: `${imageData.fileName} downloaded successfully`,
      });
    },
    onError: (error, imageData) => {
      setDownloads(prev => prev.map(d => 
        d.url === imageData.url 
          ? { ...d, status: 'error' }
          : d
      ));
      
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download image",
        variant: "destructive"
      });
    }
  });

  const parseViperGirlsUrl = (input: string): string | null => {
    const urlRegex = /https?:\/\/(?:www\.)?vipergirls\.to\/threads\/[^\s]+/;
    const match = input.match(urlRegex);
    return match ? match[0] : null;
  };

  const handleExtractImages = () => {
    const threadUrl = parseViperGirlsUrl(inputUrl);
    if (!threadUrl) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid ViperGirls thread URL",
        variant: "destructive"
      });
      return;
    }
    extractImagesMutation.mutate(threadUrl);
  };

  const handleDownloadImage = (image: ImageData) => {
    if (!downloads.find(d => d.url === image.url)) {
      setDownloads(prev => [...prev, {
        url: image.url,
        progress: 0,
        status: 'downloading'
      }]);
    }
    downloadImageMutation.mutate(image);
  };

  const handleDownloadAll = () => {
    const validImages = images.filter(img => img.isValid);
    validImages.forEach(image => {
      if (!downloads.find(d => d.url === image.url)) {
        setDownloads(prev => [...prev, {
          url: image.url,
          progress: 0,
          status: 'downloading'
        }]);
      }
    });
    
    // Download images with delay to avoid overwhelming the server
    validImages.forEach((image, index) => {
      setTimeout(() => {
        downloadImageMutation.mutate(image);
      }, index * 1000);
    });
  };

  const handleCopyUrls = () => {
    const imageUrls = images.filter(img => img.isValid).map(img => img.url).join('\n');
    navigator.clipboard.writeText(imageUrls);
    toast({
      title: "URLs copied",
      description: "Image URLs copied to clipboard",
    });
  };

  const validImages = images.filter(img => img.isValid);
  const completedDownloads = downloads.filter(d => d.status === 'completed').length;

  return (
    <div className="min-h-screen bg-background smooth-scroll">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl gradient-bg">
                <Image className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">VRipper</h1>
            </div>
            <div className="flex items-center gap-2">
              <PWAInstallButton />
              <Badge variant="secondary" className="px-3 py-1">
                PWA Ready
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* URL Input Section */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2">
              <ExternalLink className="h-5 w-5 text-primary" />
              <span>Enter Image URLs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste ViperGirls thread URL here (e.g., https://vipergirls.to/threads/thread-name.123456/)..."
                className="w-full min-h-[120px] p-4 rounded-xl bg-input border border-border resize-none text-sm"
              />
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>Will extract ImageBam images</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full bg-info"></div>
                  <span>Will extract Imgbox images</span>
                </span>
              </div>
            </div>
            
            <Button
              onClick={handleExtractImages}
              disabled={!inputUrl.trim() || extractImagesMutation.isPending}
              className="w-full touch-button gradient-bg font-semibold"
              size="lg"
            >
              {extractImagesMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Extracting Images...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-5 w-5" />
                  Extract Images from Thread
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Page Summary Section */}
        {pageTexts.length > 0 && (
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <ExternalLink className="h-5 w-5 text-info" />
                <span>Thread Summary ({scannedPages} pages scanned)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pageTexts.map((pageText, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        Page {pageText.page}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {pageText.summary}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {images.length > 0 && (
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Image className="h-5 w-5 text-primary" />
                  <span>Found Images ({validImages.length})</span>
                </CardTitle>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleCopyUrls}
                    variant="outline"
                    size="sm"
                    className="touch-button"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URLs
                  </Button>
                  <Button
                    onClick={handleDownloadAll}
                    disabled={validImages.length === 0 || downloadImageMutation.isPending}
                    size="sm"
                    className="touch-button gradient-bg"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download All
                  </Button>
                </div>
              </div>
              {downloads.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Download Progress</span>
                    <span>{completedDownloads}/{downloads.length}</span>
                  </div>
                  <Progress value={(completedDownloads / downloads.length) * 100} className="h-2" />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image, index) => {
                  const downloadStatus = downloads.find(d => d.url === image.url);
                  return (
                    <div key={index} className="relative">
                      <Card className={`overflow-hidden transition-all hover:scale-105 ${
                        image.isValid ? 'border-primary/20' : 'border-destructive/20'
                      }`}>
                        <div className="aspect-square relative bg-muted">
                          {image.isValid ? (
                            <img
                              src={image.previewUrl}
                              alt={image.fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = `data:image/svg+xml,${encodeURIComponent(`
                                  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
                                    <rect width="200" height="200" fill="#374151"/>
                                    <text x="100" y="100" text-anchor="middle" fill="#9CA3AF" font-size="14">
                                      No Preview
                                    </text>
                                  </svg>
                                `)}`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <AlertCircle className="h-8 w-8 text-destructive" />
                            </div>
                          )}
                          
                          {downloadStatus && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              {downloadStatus.status === 'downloading' && (
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                              )}
                              {downloadStatus.status === 'completed' && (
                                <CheckCircle2 className="h-8 w-8 text-success" />
                              )}
                              {downloadStatus.status === 'error' && (
                                <AlertCircle className="h-8 w-8 text-destructive" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1">
                                <Badge 
                                  variant={image.hostingSite === 'imagebam.com' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {image.hostingSite}
                                </Badge>
                                {image.pageNumber && (
                                  <Badge variant="outline" className="text-xs">
                                    P{image.pageNumber}
                                  </Badge>
                                )}
                              </div>
                              {image.isValid && (
                                <Button
                                  onClick={() => handleDownloadImage(image)}
                                  disabled={downloadStatus?.status === 'downloading'}
                                  size="sm"
                                  className="touch-button h-8 px-3"
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate" title={image.fileName}>
                              {image.fileName}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Section */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This downloader works with ImageBam and Imgbox URLs. Simply paste the URLs and click "Extract Images" to preview and download them.
            The app is optimized for mobile browsers and supports batch downloading.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}