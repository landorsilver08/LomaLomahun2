import { useState } from "react";
import { Settings2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DownloadOptionsData {
  outputFormat: "individual" | "zip";
  concurrentLimit: number;
  retryEnabled: boolean;
  preserveFilenames: boolean;
  skipExisting: boolean;
}

interface DownloadOptionsProps {
  options: DownloadOptionsData;
  onOptionsChange: (options: DownloadOptionsData) => void;
}

export default function DownloadOptions({ options, onOptionsChange }: DownloadOptionsProps) {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const updateOption = <K extends keyof DownloadOptionsData>(
    key: K,
    value: DownloadOptionsData[K]
  ) => {
    onOptionsChange({ ...options, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings2 className="text-primary mr-2" />
          Download Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Output format */}
        <div>
          <Label className="text-sm font-medium mb-2">Output Format</Label>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                options.outputFormat === "individual"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => updateOption("outputFormat", "individual")}
            >
              <div
                className={`w-4 h-4 border-2 rounded-full mr-3 flex items-center justify-center ${
                  options.outputFormat === "individual"
                    ? "border-primary"
                    : "border-muted-foreground"
                }`}
              >
                {options.outputFormat === "individual" && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">Individual Files</div>
                <div className="text-xs text-muted-foreground">Download images separately</div>
              </div>
            </div>
            
            <div
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                options.outputFormat === "zip"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted"
              }`}
              onClick={() => updateOption("outputFormat", "zip")}
            >
              <div
                className={`w-4 h-4 border-2 rounded-full mr-3 flex items-center justify-center ${
                  options.outputFormat === "zip"
                    ? "border-primary"
                    : "border-muted-foreground"
                }`}
              >
                {options.outputFormat === "zip" && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
              <div>
                <div className="font-medium text-sm">ZIP Archive</div>
                <div className="text-xs text-muted-foreground">Compressed download</div>
              </div>
            </div>
          </div>
        </div>

        {/* Concurrent downloads */}
        <div>
          <Label className="text-sm font-medium mb-2">
            Concurrent Downloads: <span className="font-semibold text-primary">{options.concurrentLimit}</span>
          </Label>
          <Slider
            value={[options.concurrentLimit]}
            onValueChange={(values) => updateOption("concurrentLimit", values[0])}
            min={1}
            max={8}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>1 (Slower)</span>
            <span>8 (Faster)</span>
          </div>
        </div>

        {/* Advanced options toggle */}
        <Collapsible open={advancedExpanded} onOpenChange={setAdvancedExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="secondary" className="w-full justify-between">
              <span className="text-sm font-medium">Advanced Options</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  advancedExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Retry failed downloads</Label>
              <Switch
                checked={options.retryEnabled}
                onCheckedChange={(checked) => updateOption("retryEnabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Preserve original filenames</Label>
              <Switch
                checked={options.preserveFilenames}
                onCheckedChange={(checked) => updateOption("preserveFilenames", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Skip existing files</Label>
              <Switch
                checked={options.skipExisting}
                onCheckedChange={(checked) => updateOption("skipExisting", checked)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
