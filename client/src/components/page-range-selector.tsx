import { useEffect } from "react";
import { Layers, Plus, Minus, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PageRange {
  from: number;
  to: number;
}

interface PageRangeSelectorProps {
  detectedPage: number | null;
  pageRange: PageRange;
  onPageRangeChange: (range: PageRange) => void;
}

export default function PageRangeSelector({
  detectedPage,
  pageRange,
  onPageRangeChange,
}: PageRangeSelectorProps) {
  // Auto-center range around detected page
  useEffect(() => {
    if (detectedPage) {
      onPageRangeChange({
        from: Math.max(1, detectedPage - 1),
        to: detectedPage + 1,
      });
    }
  }, [detectedPage, onPageRangeChange]);

  const currentPage = detectedPage || pageRange.from;
  const pageCount = pageRange.to - pageRange.from + 1;

  const handleFromPageChange = (value: number) => {
    onPageRangeChange({
      ...pageRange,
      from: Math.max(1, value),
    });
  };

  const handleToPageChange = (value: number) => {
    onPageRangeChange({
      ...pageRange,
      to: Math.max(1, value),
    });
  };

  const setQuickRange = (totalPages: number) => {
    const halfRange = Math.floor((totalPages - 1) / 2);
    onPageRangeChange({
      from: Math.max(1, currentPage - halfRange),
      to: currentPage + halfRange,
    });
  };

  return (
    <Card className="animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Layers className="text-primary mr-2" />
          Page Range Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current page display */}
        <div className="flex items-center justify-center bg-muted rounded-lg p-4">
          <span className="text-sm text-muted-foreground mr-2">Current page:</span>
          <span className="text-xl font-semibold text-primary">{currentPage}</span>
        </div>

        {/* Range controls */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2">From Page</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleFromPageChange(pageRange.from - 1)}
                disabled={pageRange.from <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                value={pageRange.from}
                onChange={(e) => handleFromPageChange(parseInt(e.target.value) || 1)}
                className="text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleFromPageChange(pageRange.from + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2">To Page</Label>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleToPageChange(pageRange.to - 1)}
                disabled={pageRange.to <= pageRange.from}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={pageRange.from}
                value={pageRange.to}
                onChange={(e) => handleToPageChange(parseInt(e.target.value) || pageRange.from)}
                className="text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleToPageChange(pageRange.to + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Quick range buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuickRange(1)}
            className="text-xs"
          >
            Current page only
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuickRange(3)}
            className="text-xs"
          >
            ±1 page
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuickRange(5)}
            className="text-xs"
          >
            ±2 pages
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setQuickRange(11)}
            className="text-xs"
          >
            ±5 pages
          </Button>
        </div>

        {/* Pages summary */}
        <Alert className="bg-amber-50 border-amber-200">
          <Calculator className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Will download from <strong>{pageCount}</strong> pages ({pageRange.from}-{pageRange.to})
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
