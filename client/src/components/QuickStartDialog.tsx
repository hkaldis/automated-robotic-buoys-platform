import { useState } from "react";
import { Zap, Triangle, Square, ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ALL_SHAPE_TEMPLATES, type ShapeTemplate } from "@/lib/shape-templates";

interface QuickStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ShapeTemplate) => void;
  hasWindData: boolean;
}

const QUICK_TEMPLATES = [
  { 
    id: "triangle_60_60_60", 
    name: "Triangle",
    description: "Classic equilateral",
    icon: Triangle,
    angles: "60-60-60"
  },
  { 
    id: "triangle_45_90_45", 
    name: "Right Triangle",
    description: "90° turn at wing",
    icon: Triangle,
    angles: "45-90-45"
  },
  { 
    id: "trapezoid_60", 
    name: "Trapezoid",
    description: "With leeward gate",
    icon: Square,
    angles: "60° reaches"
  },
  { 
    id: "windward_leeward", 
    name: "Windward-Leeward",
    description: "Pure up/down",
    icon: ArrowUpDown,
    angles: "No reaching"
  },
];

export function QuickStartDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  hasWindData,
}: QuickStartDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedId) return;
    
    const template = ALL_SHAPE_TEMPLATES.find(t => t.id === selectedId);
    if (template) {
      onSelectTemplate(template);
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Start
          </DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground">
          Select a course shape to get started quickly. The course will be positioned at map center and aligned to wind.
        </p>

        {!hasWindData && (
          <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-md text-sm">
            Wind data required. Templates will use default 225° wind direction.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-4">
          {QUICK_TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedId === template.id;
            
            return (
              <Card
                key={template.id}
                className={cn(
                  "cursor-pointer transition-all hover-elevate",
                  isSelected && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => setSelectedId(template.id)}
                data-testid={`card-template-${template.id}`}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    {isSelected ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {template.angles}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedId}
            className="gap-2"
            data-testid="button-confirm-quick-start"
          >
            <Zap className="h-4 w-4" />
            Create Course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
