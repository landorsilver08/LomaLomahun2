import { useState, useEffect } from "react";
import { Eye, Download, X, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ScrapedImage {
  previewUrl: string;
  hostingPage: string;
  hostingSite: string;
  pageNumber: number;
}

interface ImagePreviewProps {
  threadUrl: string;
  fromPage: number;
  toPage: number;
  onImagesSelected: (selectedImages: ScrapedImage[]) => void;
}

export default function ImagePreview({ threadUrl, fromPage, toPage, onImagesSelected }: ImagePreviewProps) {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<ScrapedImage[]>([]);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/preview-images", {
        threadUrl,
        fromPage,
        toPage
      });
      return response.json();
    },
    onSuccess: (data) => {
      setImages(data.images || []);
      // Select all images by default
      const allImageIds = new Set<string>((data.images || []).map((img: ScrapedImage) => img.hostingPage));
      setSelectedImages(allImageIds);
      onImagesSelected(data.images || []);
    },
    onError: (error) => {
      console.error('Preview failed:', error);
      setImages([]);
    }
  });

  useEffect(() => {
    if (threadUrl && fromPage && toPage) {
      previewMutation.mutate();
    }
  }, [threadUrl, fromPage, toPage]);

  const handleImageToggle = (hostingPage: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(hostingPage)) {
      newSelected.delete(hostingPage);
    } else {
      newSelected.add(hostingPage);
    }
    setSelectedImages(newSelected);
    
    // Update parent with selected images
    const selected = images.filter(img => newSelected.has(img.hostingPage));
    onImagesSelected(selected);
  };

  const handleSelectAll = () => {
    const allImageIds = new Set<string>(images.map(img => img.hostingPage));
    setSelectedImages(allImageIds);
    onImagesSelected(images);
  };

  const handleDeselectAll = () => {
    setSelectedImages(new Set());
    onImagesSelected([]);
  };

  const groupedImages = images.reduce((acc, img) => {
    if (!acc[img.pageNumber]) {
      acc[img.pageNumber] = [];
    }
    acc[img.pageNumber].push(img);
    return acc;
  }, {} as Record<number, ScrapedImage[]>);

  if (previewMutation.isPending) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center">
            <RefreshCw className="text-primary mr-2 animate-spin" />
            Loading Preview...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p>Scanning pages {fromPage} to {toPage}...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (previewMutation.isError) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <X className="mr-2" />
            Preview Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-50 border-red-200">
            <AlertDescription className="text-red-800">
              Failed to load images. Please check the URL and try again.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => previewMutation.mutate()} 
            variant="outline" 
            className="mt-4"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card className="animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="text-primary mr-2" />
            No Images Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              No images were found in the specified page range. Try adjusting the page numbers.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Eye className="text-primary mr-2" />
            Image Preview ({images.length} images)
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">
              {selectedImages.size} selected
            </Badge>
            <Button size="sm" variant="outline" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button size="sm" variant="outline" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedImages)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([pageNum, pageImages]) => (
              <div key={pageNum} className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                  Page {pageNum}
                  <Badge variant="outline" className="ml-2">
                    {pageImages.length} images
                  </Badge>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {pageImages.map((image, index) => {
                    const isSelected = selectedImages.has(image.hostingPage);
                    return (
                      <div
                        key={`${image.hostingPage}-${index}`}
                        className={`relative border rounded-lg overflow-hidden cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleImageToggle(image.hostingPage)}
                      >
                        <div className="aspect-square bg-gray-100 relative">
                          <img
                            src={image.previewUrl}
                            alt={`Preview from ${image.hostingSite}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/api/placeholder/150/150';
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            {isSelected ? (
                              <CheckCircle2 className="h-5 w-5 text-blue-600 bg-white rounded-full" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-400 bg-white rounded-full" />
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2">
                            <div className="text-xs">
                              <Badge variant="secondary" className="text-xs">
                                {image.hostingSite}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}