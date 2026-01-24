import { useState, useMemo } from "react";
import { Zap, Triangle, Square, ArrowUpDown, Check, Star, Building2, User, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ALL_SHAPE_TEMPLATES, type ShapeTemplate } from "@/lib/shape-templates";
import { useCourseSnapshots, type CourseSnapshot } from "@/hooks/use-api";
import { getCategoryLabel } from "@/lib/course-thumbnail";
import type { TemplateCategory } from "@shared/schema";

interface QuickStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ShapeTemplate) => void;
  onLoadCourse?: (snapshot: CourseSnapshot, mode: "exact" | "shape_only") => void;
  hasWindData: boolean;
}

const BUILTIN_TEMPLATES = [
  { 
    id: "triangle_60_60_60", 
    name: "Triangle 60°",
    description: "Classic equilateral",
    icon: Triangle,
    category: "triangle" as TemplateCategory,
  },
  { 
    id: "triangle_45_90_45", 
    name: "Right Triangle",
    description: "90° at wing mark",
    icon: Triangle,
    category: "triangle" as TemplateCategory,
  },
  { 
    id: "trapezoid_60", 
    name: "Trapezoid 60°",
    description: "With leeward gate",
    icon: Square,
    category: "trapezoid" as TemplateCategory,
  },
  { 
    id: "windward_leeward", 
    name: "Windward-Leeward",
    description: "Pure up/down",
    icon: ArrowUpDown,
    category: "windward_leeward" as TemplateCategory,
  },
];

const CATEGORY_ORDER: TemplateCategory[] = ["triangle", "trapezoid", "windward_leeward", "other"];

const CATEGORY_ICONS: Record<TemplateCategory, typeof Triangle> = {
  triangle: Triangle,
  trapezoid: Square,
  windward_leeward: ArrowUpDown,
  other: Sparkles,
};

export function QuickStartDialog({
  open,
  onOpenChange,
  onSelectTemplate,
  onLoadCourse,
  hasWindData,
}: QuickStartDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"builtin" | "saved">("builtin");
  const [activeTab, setActiveTab] = useState<"templates" | "my_courses">("templates");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: snapshotsData } = useCourseSnapshots({ search: searchQuery || undefined });
  
  const globalTemplates = useMemo(() => {
    return snapshotsData?.snapshots.filter(s => s.visibilityScope === "global") || [];
  }, [snapshotsData]);

  const clubCourses = useMemo(() => {
    return snapshotsData?.snapshots.filter(s => s.visibilityScope === "club") || [];
  }, [snapshotsData]);

  const userCourses = useMemo(() => {
    return snapshotsData?.snapshots.filter(s => s.visibilityScope === "user") || [];
  }, [snapshotsData]);

  const templatesByCategory = useMemo(() => {
    const grouped: Record<TemplateCategory, CourseSnapshot[]> = {
      triangle: [],
      trapezoid: [],
      windward_leeward: [],
      other: [],
    };
    globalTemplates.forEach(t => {
      const cat = (t.category as TemplateCategory) || "other";
      if (grouped[cat]) {
        grouped[cat].push(t);
      } else {
        grouped.other.push(t);
      }
    });
    return grouped;
  }, [globalTemplates]);

  const handleConfirm = () => {
    if (!selectedId) return;
    
    if (selectedType === "builtin") {
      const template = ALL_SHAPE_TEMPLATES.find(t => t.id === selectedId);
      if (template) {
        onSelectTemplate(template);
        onOpenChange(false);
        resetState();
      }
    } else if (selectedType === "saved" && onLoadCourse) {
      const snapshot = snapshotsData?.snapshots.find(s => s.id === selectedId);
      if (snapshot) {
        onLoadCourse(snapshot, "shape_only");
        onOpenChange(false);
        resetState();
      }
    }
  };

  const resetState = () => {
    setSelectedId(null);
    setSelectedType("builtin");
    setSearchQuery("");
    setActiveTab("templates");
  };

  const handleSelectBuiltin = (id: string) => {
    setSelectedId(id);
    setSelectedType("builtin");
  };

  const handleSelectSaved = (id: string) => {
    setSelectedId(id);
    setSelectedType("saved");
  };

  const hasGlobalTemplates = globalTemplates.length > 0;
  const hasMyCourses = clubCourses.length > 0 || userCourses.length > 0;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Start
          </DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground">
          Select a course template to get started quickly. The course will be positioned at map center.
        </p>

        {!hasWindData && (
          <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-md text-sm">
            Wind data required. Templates will use default 225° wind direction.
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "my_courses")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 h-16 p-1">
            <TabsTrigger value="templates" className="gap-2 h-14 text-sm" data-testid="tab-templates">
              <Star className="h-5 w-5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="my_courses" className="gap-2 h-14 text-sm" data-testid="tab-my-courses">
              <User className="h-5 w-5" />
              My Courses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[320px] pr-2">
              {hasGlobalTemplates ? (
                <div className="space-y-4">
                  {CATEGORY_ORDER.map((category) => {
                    const templates = templatesByCategory[category];
                    if (templates.length === 0) return null;
                    const Icon = CATEGORY_ICONS[category];
                    
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          {getCategoryLabel(category).toUpperCase()}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {templates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              id={template.id}
                              name={template.name}
                              description={template.description}
                              thumbnailSvg={template.thumbnailSvg}
                              badge="Official"
                              badgeIcon={<Star className="h-3 w-3" />}
                              isSelected={selectedId === template.id && selectedType === "saved"}
                              onClick={() => handleSelectSaved(template.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    No official templates yet. Use these built-in shapes:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {BUILTIN_TEMPLATES.map((template) => {
                      const Icon = template.icon;
                      const isSelected = selectedId === template.id && selectedType === "builtin";
                      
                      return (
                        <Card
                          key={template.id}
                          className={cn(
                            "cursor-pointer transition-all hover-elevate",
                            isSelected && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => handleSelectBuiltin(template.id)}
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
                              Built-in
                            </Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {hasGlobalTemplates && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">BUILT-IN SHAPES</p>
                  <div className="grid grid-cols-4 gap-2">
                    {BUILTIN_TEMPLATES.map((template) => {
                      const Icon = template.icon;
                      const isSelected = selectedId === template.id && selectedType === "builtin";
                      
                      return (
                        <Button
                          key={template.id}
                          variant={isSelected ? "default" : "outline"}
                          className={cn("h-14 flex-col gap-1", isSelected && "ring-2 ring-offset-2")}
                          onClick={() => handleSelectBuiltin(template.id)}
                          data-testid={`button-builtin-${template.id}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[10px] truncate max-w-full">{template.name.split(" ")[0]}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="my_courses" className="flex-1 min-h-0 mt-3">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-courses"
                />
              </div>
              
              <ScrollArea className="h-[280px] pr-2">
                {hasMyCourses ? (
                  <div className="space-y-4">
                    {clubCourses.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          CLUB COURSES
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {clubCourses.map((course) => (
                            <TemplateCard
                              key={course.id}
                              id={course.id}
                              name={course.name}
                              description={course.sailClubName || undefined}
                              thumbnailSvg={course.thumbnailSvg}
                              badge="Club"
                              badgeIcon={<Building2 className="h-3 w-3" />}
                              isSelected={selectedId === course.id && selectedType === "saved"}
                              onClick={() => handleSelectSaved(course.id)}
                              createdAt={course.createdAt}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {userCourses.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <User className="h-4 w-4" />
                          MY COURSES
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {userCourses.map((course) => (
                            <TemplateCard
                              key={course.id}
                              id={course.id}
                              name={course.name}
                              description={course.description || undefined}
                              thumbnailSvg={course.thumbnailSvg}
                              badge="Mine"
                              badgeIcon={<User className="h-3 w-3" />}
                              isSelected={selectedId === course.id && selectedType === "saved"}
                              onClick={() => handleSelectSaved(course.id)}
                              createdAt={course.createdAt}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No saved courses yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a course and save it to see it here
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
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
            {selectedType === "saved" ? "Load Course" : "Create Course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TemplateCardProps {
  id: string;
  name: string;
  description?: string | null;
  thumbnailSvg?: string | null;
  badge?: string;
  badgeIcon?: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
  createdAt?: string | null;
}

function TemplateCard({
  id,
  name,
  description,
  thumbnailSvg,
  badge,
  badgeIcon,
  isSelected,
  onClick,
  createdAt,
}: TemplateCardProps) {
  const formattedDate = createdAt 
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover-elevate overflow-hidden",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onClick}
      data-testid={`card-course-${id}`}
    >
      <CardContent className="p-3 flex flex-col items-center gap-2 text-center min-h-[120px]">
        <div className="w-16 h-16 flex-shrink-0 bg-muted/50 rounded flex items-center justify-center overflow-hidden">
          {thumbnailSvg ? (
            <div 
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
            />
          ) : (
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <h3 className="font-semibold text-xs truncate">{name}</h3>
          {description && (
            <p className="text-[10px] text-muted-foreground truncate">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {badge && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5">
              {badgeIcon}
              {badge}
            </Badge>
          )}
          {formattedDate && (
            <span className="text-[9px] text-muted-foreground">{formattedDate}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
