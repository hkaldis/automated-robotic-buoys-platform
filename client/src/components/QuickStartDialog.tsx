import { useState, useMemo } from "react";
import { Zap, Triangle, Square, ArrowUpDown, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCourseSnapshots, type CourseSnapshot } from "@/hooks/use-api";
import { getCategoryLabel } from "@/lib/course-thumbnail";
import type { TemplateCategory } from "@shared/schema";

interface QuickStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadCourse?: (snapshot: CourseSnapshot, mode: "exact" | "shape_only") => void;
  hasWindData: boolean;
}

const CATEGORIES: { id: TemplateCategory; label: string; icon: typeof Triangle; description: string }[] = [
  { 
    id: "triangle", 
    label: "Triangle", 
    icon: Triangle,
    description: "Olympic triangle courses"
  },
  { 
    id: "trapezoid", 
    label: "Trapezoid", 
    icon: Square,
    description: "Courses with leeward gate"
  },
  { 
    id: "windward_leeward", 
    label: "Windward-Leeward", 
    icon: ArrowUpDown,
    description: "Pure upwind/downwind"
  },
  { 
    id: "other", 
    label: "Other", 
    icon: Sparkles,
    description: "Custom course shapes"
  },
];

export function QuickStartDialog({
  open,
  onOpenChange,
  onLoadCourse,
  hasWindData,
}: QuickStartDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data: snapshotsData, isLoading } = useCourseSnapshots({});
  
  const templatesByCategory = useMemo(() => {
    const grouped: Record<TemplateCategory, CourseSnapshot[]> = {
      triangle: [],
      trapezoid: [],
      windward_leeward: [],
      other: [],
    };
    const globalTemplates = snapshotsData?.snapshots.filter(s => s.visibilityScope === "global") || [];
    globalTemplates.forEach(t => {
      const cat = (t.category as TemplateCategory) || "other";
      if (grouped[cat]) {
        grouped[cat].push(t);
      } else {
        grouped.other.push(t);
      }
    });
    return grouped;
  }, [snapshotsData]);

  const categoryCounts = useMemo(() => {
    const counts: Record<TemplateCategory, number> = {
      triangle: 0,
      trapezoid: 0,
      windward_leeward: 0,
      other: 0,
    };
    CATEGORIES.forEach(cat => {
      counts[cat.id] = templatesByCategory[cat.id].length;
    });
    return counts;
  }, [templatesByCategory]);

  const currentTemplates = selectedCategory ? templatesByCategory[selectedCategory] : [];
  const hasTemplates = currentTemplates.length > 0;

  const handleConfirm = () => {
    if (!selectedTemplateId || !onLoadCourse) return;
    
    const snapshot = snapshotsData?.snapshots.find(s => s.id === selectedTemplateId);
    if (snapshot) {
      onLoadCourse(snapshot, "shape_only");
      onOpenChange(false);
      resetState();
    }
  };

  const resetState = () => {
    setSelectedCategory(null);
    setSelectedTemplateId(null);
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setSelectedTemplateId(null);
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) resetState();
    }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {selectedCategory 
              ? getCategoryLabel(selectedCategory)
              : "Quick Start"
            }
          </DialogTitle>
        </DialogHeader>
        
        {!selectedCategory ? (
          <>
            <p className="text-sm text-muted-foreground">
              Select a course category to browse templates.
            </p>

            {!hasWindData && (
              <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-md text-sm">
                Wind data required. Templates will use default 225° wind direction.
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 py-2">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const count = categoryCounts[category.id];
                  
                  return (
                    <Card
                      key={category.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedCategory(category.id)}
                      data-testid={`card-category-${category.id}`}
                    >
                      <CardContent className="p-4 flex flex-col items-center gap-3 text-center min-h-[140px] justify-center">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <Icon className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">{category.label}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {count} {count === 1 ? "template" : "templates"}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Select a template to create your course.
            </p>

            <ScrollArea className="flex-1 h-[320px] pr-2">
              {hasTemplates ? (
                <div className="grid grid-cols-1 gap-3 py-2">
                  {currentTemplates.map((template) => (
                    <TemplateListItem
                      key={template.id}
                      id={template.id}
                      name={template.name}
                      description={template.description}
                      thumbnailSvg={template.thumbnailSvg}
                      isSelected={selectedTemplateId === template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No templates in this category</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Super admins can create templates here
                  </p>
                </div>
              )}
            </ScrollArea>
          </>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              if (selectedCategory) {
                handleBack();
              } else {
                onOpenChange(false);
              }
            }}
            className="h-14"
            data-testid="button-cancel"
          >
            {selectedCategory ? "Back" : "Cancel"}
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedTemplateId}
            className="gap-2 h-14 flex-1"
            data-testid="button-confirm-quick-start"
          >
            <Zap className="h-5 w-5" />
            Create Course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateListItemProps {
  id: string;
  name: string;
  description?: string | null;
  thumbnailSvg?: string | null;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateListItem({
  id,
  name,
  description,
  thumbnailSvg,
  isSelected,
  onClick,
}: TemplateListItemProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover-elevate overflow-hidden",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onClick}
      data-testid={`card-template-${id}`}
    >
      <CardContent className="p-4 flex items-center gap-4 min-h-[80px]">
        <div className="w-16 h-16 flex-shrink-0 bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
          {thumbnailSvg ? (
            <div 
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
            />
          ) : (
            <Triangle className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{name}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{description}</p>
          )}
        </div>
        {isSelected && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
