import { useState, useEffect } from "react";
import { Link2, Clipboard, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface UrlInputProps {
  value: string;
  onChange: (url: string) => void;
  onPageDetected: (page: number | null) => void;
}

export default function UrlInput({ value, onChange, onPageDetected }: UrlInputProps) {
  const [detectedPage, setDetectedPage] = useState<number | null>(null);

  const parseUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/parse-url", { url });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.currentPage) {
        setDetectedPage(data.currentPage);
        onPageDetected(data.currentPage);
      }
    },
    onError: () => {
      setDetectedPage(null);
      onPageDetected(null);
    },
  });

  useEffect(() => {
    if (value && value.includes("vipergirls.to")) {
      parseUrlMutation.mutate(value);
    } else {
      setDetectedPage(null);
      onPageDetected(null);
    }
  }, [value]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (error) {
      console.error("Failed to read clipboard:", error);
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Link2 className="text-primary mr-2" />
          Thread URL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://vipergirls.to/threads/example-thread.12345/"
            className="font-mono text-sm pr-12"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
            onClick={handlePasteFromClipboard}
            title="Paste from clipboard"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        </div>

        {detectedPage && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Detected page <strong>{detectedPage}</strong> from URL
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
