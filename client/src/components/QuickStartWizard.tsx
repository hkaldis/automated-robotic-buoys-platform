import { useState, useMemo, useCallback } from "react";
import { 
  Zap, Triangle, Square, ArrowUpDown, Sparkles, Loader2, Plus, 
  Users, Anchor, Flag, Minus, FolderOpen, ChevronRight, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useCourseSnapshots, type CourseSnapshot } from "@/hooks/use-api";
import { getCategoryLabel } from "@/lib/course-thumbnail";
import type { TemplateCategory } from "@shared/schema";

type WizardStep = "source" | "template" | "fleet" | "loading";
type SourceType = "templates" | "my_courses" | "custom";
type RaceType = "fleet" | "match" | "team";

export interface FleetConfig {
  raceType: "fleet" | "match" | "team";
  boatCount?: number;
}

interface QuickStartWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadCourse: (snapshot: CourseSnapshot, mode: "exact" | "shape_only", fleetConfig?: FleetConfig) => void;
  onCreateCustom: (fleetConfig?: FleetConfig) => void;
  hasWindData: boolean;
  isNewEvent?: boolean;
}

const CATEGORIES: { id: TemplateCategory; label: string; icon: typeof Triangle; description: string }[] = [
  { id: "triangle", label: "Triangle", icon: Triangle, description: "Olympic triangle courses" },
  { id: "trapezoid", label: "Trapezoid", icon: Square, description: "Courses with leeward gate" },
  { id: "windward_leeward", label: "Windward-Leeward", icon: ArrowUpDown, description: "Pure upwind/downwind" },
  { id: "other", label: "Other", icon: Sparkles, description: "Custom course shapes" },
];

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "source", label: "Choose" },
  { id: "template", label: "Select" },
  { id: "fleet", label: "Configure" },
];

export function QuickStartWizard({
  open,
  onOpenChange,
  onLoadCourse,
  onCreateCustom,
  hasWindData,
  isNewEvent = false,
}: QuickStartWizardProps) {
  const [step, setStep] = useState<WizardStep>("source");
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<CourseSnapshot | null>(null);
  const [raceType, setRaceType] = useState<RaceType>("fleet");
  const [boatCount, setBoatCount] = useState(10);
  const [activeTab, setActiveTab] = useState<"templates" | "saved">("templates");

  const { data: snapshotsData, isLoading } = useCourseSnapshots({});

  const globalTemplates = useMemo(() => {
    return snapshotsData?.snapshots.filter(s => s.visibilityScope === "global") || [];
  }, [snapshotsData]);

  const userCourses = useMemo(() => {
    return snapshotsData?.snapshots.filter(s => s.visibilityScope !== "global") || [];
  }, [snapshotsData]);

  const templatesByCategory = useMemo(() => {
    const grouped: Record<TemplateCategory, CourseSnapshot[]> = {
      triangle: [], trapezoid: [], windward_leeward: [], other: [],
    };
    globalTemplates.forEach(t => {
      const cat = (t.category as TemplateCategory) || "other";
      if (grouped[cat]) grouped[cat].push(t);
      else grouped.other.push(t);
    });
    return grouped;
  }, [globalTemplates]);

  const categoryCounts = useMemo(() => {
    const counts: Record<TemplateCategory, number> = { triangle: 0, trapezoid: 0, windward_leeward: 0, other: 0 };
    CATEGORIES.forEach(cat => { counts[cat.id] = templatesByCategory[cat.id].length; });
    return counts;
  }, [templatesByCategory]);

  const currentTemplates = selectedCategory ? templatesByCategory[selectedCategory] : [];

  const resetState = useCallback(() => {
    setStep("source");
    setSourceType(null);
    setSelectedCategory(null);
    setSelectedSnapshot(null);
    setRaceType("fleet");
    setBoatCount(10);
    setActiveTab("templates");
  }, []);

  const handleClose = useCallback(() => {
    if (!isNewEvent) {
      onOpenChange(false);
      resetState();
    }
  }, [isNewEvent, onOpenChange, resetState]);

  const handleSelectCategory = (category: TemplateCategory) => {
    setSelectedCategory(category);
  };

  const handleSelectTemplate = (snapshot: CourseSnapshot) => {
    setSelectedSnapshot(snapshot);
    setStep("fleet");
  };

  const handleSelectSavedCourse = (snapshot: CourseSnapshot) => {
    setSelectedSnapshot(snapshot);
    setStep("fleet");
  };

  const handleCustom = () => {
    setStep("loading");
    const fleetConfig: FleetConfig = {
      raceType,
      boatCount: raceType === "fleet" ? boatCount : undefined,
    };
    onCreateCustom(fleetConfig);
    resetState();
  };

  const handleConfirm = () => {
    if (!selectedSnapshot) return;
    setStep("loading");
    const fleetConfig: FleetConfig = {
      raceType,
      boatCount: raceType === "fleet" ? boatCount : undefined,
    };
    onLoadCourse(selectedSnapshot, "shape_only", fleetConfig);
    resetState();
  };

  const handleBack = () => {
    if (step === "fleet") {
      setSelectedSnapshot(null);
      if (sourceType === "my_courses") {
        setStep("source");
        setActiveTab("saved");
      } else if (selectedCategory) {
        setStep("template");
      } else {
        setStep("source");
      }
    } else if (step === "template") {
      if (selectedCategory) {
        setSelectedCategory(null);
      } else {
        setStep("source");
      }
    }
  };

  const incrementCount = () => setBoatCount(prev => Math.min(prev + 1, 200));
  const decrementCount = () => setBoatCount(prev => Math.max(prev - 1, 2));

  const currentStepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isNewEvent || !isOpen) {
        if (!isNewEvent) onOpenChange(isOpen);
        if (!isOpen) resetState();
      }
    }}>
      <DialogContent 
        className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0"
        onPointerDownOutside={(e) => isNewEvent && e.preventDefault()}
        onEscapeKeyDown={(e) => isNewEvent && e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2" data-testid="title-quick-start-wizard">
            <Zap className="h-5 w-5" />
            {step === "loading" ? "Setting Up..." : "Quick Start"}
          </DialogTitle>
          
          {step !== "loading" && (
            <div className="flex items-center gap-2 mt-3" data-testid="wizard-progress">
              {STEPS.map((s, index) => (
                <div key={s.id} className="flex items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    index < currentStepIndex && "bg-primary text-primary-foreground",
                    index === currentStepIndex && "bg-primary text-primary-foreground",
                    index > currentStepIndex && "bg-muted text-muted-foreground"
                  )}>
                    {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={cn(
                    "ml-2 text-sm hidden sm:inline",
                    index === currentStepIndex ? "font-medium" : "text-muted-foreground"
                  )}>{s.label}</span>
                  {index < STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center h-64 gap-4" data-testid="wizard-loading">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Creating your course...</p>
            </div>
          )}

          {step === "source" && (
            <div className="space-y-4">
              {!hasWindData && (
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-md text-sm" data-testid="wind-warning">
                  Wind data will be fetched. Templates will align to current wind.
                </div>
              )}

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "templates" | "saved")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12">
                  <TabsTrigger value="templates" className="text-sm gap-2" data-testid="tab-templates">
                    <Zap className="h-4 w-4" />
                    Templates
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="text-sm gap-2" data-testid="tab-saved">
                    <FolderOpen className="h-4 w-4" />
                    My Courses ({userCourses.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {isNewEvent && (
                        <Card
                          className="cursor-pointer hover-elevate border-2 border-dashed"
                          onClick={handleCustom}
                          data-testid="card-create-custom"
                        >
                          <CardContent className="p-4 flex flex-col items-center gap-2 text-center min-h-[120px] justify-center">
                            <div className="w-12 h-12 rounded-full bg-accent/50 flex items-center justify-center">
                              <Plus className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">Custom</h3>
                              <p className="text-xs text-muted-foreground">Build from scratch</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {CATEGORIES.map((category) => {
                        const Icon = category.icon;
                        const count = categoryCounts[category.id];
                        const isEmpty = count === 0;
                        
                        return (
                          <Card
                            key={category.id}
                            className={cn(
                              "cursor-pointer hover-elevate transition-opacity",
                              isEmpty && "opacity-50"
                            )}
                            onClick={() => {
                              if (!isEmpty) {
                                setSourceType("templates");
                                handleSelectCategory(category.id);
                                setStep("template");
                              }
                            }}
                            data-testid={`card-category-${category.id}`}
                          >
                            <CardContent className="p-4 flex flex-col items-center gap-2 text-center min-h-[120px] justify-center">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Icon className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-sm">{category.label}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {isEmpty ? "No templates" : `${count} template${count !== 1 ? "s" : ""}`}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="saved" className="mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : userCourses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FolderOpen className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">No saved courses yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Save courses from events to reuse them later
                      </p>
                      {isNewEvent && (
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="mt-4"
                          onClick={handleCustom}
                          data-testid="button-custom-from-empty"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Custom Course
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2 pr-2">
                        {userCourses.map((course) => (
                          <Card
                            key={course.id}
                            className="cursor-pointer hover-elevate"
                            onClick={() => {
                              setSourceType("my_courses");
                              handleSelectSavedCourse(course);
                            }}
                            data-testid={`card-saved-${course.id}`}
                          >
                            <CardContent className="p-4 flex items-center gap-4 min-h-[72px]">
                              <div className="w-14 h-14 flex-shrink-0 bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
                                {course.thumbnailSvg ? (
                                  <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: course.thumbnailSvg }} />
                                ) : (
                                  <Triangle className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm truncate">{course.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                  {course.shape} {course.snapshotMarks?.length ? `- ${course.snapshotMarks.length} marks` : ""}
                                </p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === "template" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedCategory ? `Select a ${getCategoryLabel(selectedCategory).toLowerCase()} template` : "Select a template"}
              </p>

              <ScrollArea className="h-[320px]">
                {currentTemplates.length > 0 ? (
                  <div className="space-y-2 pr-2">
                    {currentTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => handleSelectTemplate(template)}
                        data-testid={`card-template-${template.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-4 min-h-[80px]">
                          <div className="w-16 h-16 flex-shrink-0 bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
                            {template.thumbnailSvg ? (
                              <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: template.thumbnailSvg }} />
                            ) : (
                              <Triangle className="h-7 w-7 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base truncate">{template.name}</h3>
                            {template.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{template.description}</p>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                    
                    {isNewEvent && (
                      <Card
                        className="cursor-pointer hover-elevate border-2 border-dashed mt-4"
                        onClick={handleCustom}
                        data-testid="card-custom-in-category"
                      >
                        <CardContent className="p-4 flex items-center gap-4 min-h-[72px]">
                          <div className="w-14 h-14 flex-shrink-0 bg-accent/50 rounded-lg flex items-center justify-center">
                            <Plus className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">Create Custom Instead</h3>
                            <p className="text-xs text-muted-foreground">Build your own course from scratch</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No templates in this category</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try another category or create a custom course
                    </p>
                    {isNewEvent && (
                      <Button 
                        variant="outline" 
                        size="lg"
                        className="mt-4"
                        onClick={handleCustom}
                        data-testid="button-custom-from-empty-category"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Custom Course
                      </Button>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {step === "fleet" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0 bg-background rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedSnapshot?.thumbnailSvg ? (
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: selectedSnapshot.thumbnailSvg }} />
                  ) : (
                    <Triangle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate" data-testid="text-selected-template">{selectedSnapshot?.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedSnapshot?.shape}</p>
                </div>
                <Badge variant="secondary" className="flex-shrink-0">Selected</Badge>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-medium" data-testid="label-race-type">Race Type</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className={cn(
                      "flex flex-col gap-1 py-4 min-h-[80px] toggle-elevate",
                      raceType === "fleet" && "toggle-elevated ring-2 ring-primary"
                    )}
                    onClick={() => setRaceType("fleet")}
                    data-testid="button-race-type-fleet"
                  >
                    <Users className="h-6 w-6" />
                    <span className="text-xs font-medium">Fleet Race</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className={cn(
                      "flex flex-col gap-1 py-4 min-h-[80px] toggle-elevate",
                      raceType === "match" && "toggle-elevated ring-2 ring-primary"
                    )}
                    onClick={() => setRaceType("match")}
                    data-testid="button-race-type-match"
                  >
                    <Flag className="h-6 w-6" />
                    <span className="text-xs font-medium">Match Race</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className={cn(
                      "flex flex-col gap-1 py-4 min-h-[80px] toggle-elevate",
                      raceType === "team" && "toggle-elevated ring-2 ring-primary"
                    )}
                    onClick={() => setRaceType("team")}
                    data-testid="button-race-type-team"
                  >
                    <Anchor className="h-6 w-6" />
                    <span className="text-xs font-medium">Team Race</span>
                  </Button>
                </div>
              </div>

              {raceType === "fleet" && (
                <div className="space-y-3">
                  <p className="text-sm font-medium" data-testid="label-boat-count">Number of Boats</p>
                  <div className="flex items-center justify-center gap-6">
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-h-[56px] min-w-[56px]"
                      onClick={decrementCount}
                      disabled={boatCount <= 2}
                      data-testid="button-decrement-boats"
                    >
                      <Minus className="h-6 w-6" />
                    </Button>
                    <div className="w-24 text-center">
                      <span className="text-4xl font-bold" data-testid="text-boat-count">{boatCount}</span>
                      <p className="text-xs text-muted-foreground mt-1">boats</p>
                    </div>
                    <Button
                      size="lg"
                      variant="outline"
                      className="min-h-[56px] min-w-[56px]"
                      onClick={incrementCount}
                      disabled={boatCount >= 200}
                      data-testid="button-increment-boats"
                    >
                      <Plus className="h-6 w-6" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center" data-testid="text-start-line-formula">
                    Start line: {boatCount} boats x 1.5 lengths = ~{Math.round(boatCount * 4.5 * 1.5)}m
                  </p>
                </div>
              )}

              {(raceType === "match" || raceType === "team") && (
                <div className="bg-muted/50 rounded-lg p-4 text-center" data-testid="info-race-type">
                  <p className="text-sm text-muted-foreground">
                    Start line sized for {raceType === "match" ? "2-boat match" : "team"} racing
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    25-second crossing time at broad reach (~26m)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {step !== "loading" && (
          <DialogFooter className="px-6 py-4 border-t gap-2">
            {(step !== "source" || !isNewEvent) && (
              <Button 
                variant="outline" 
                size="lg"
                onClick={step === "source" ? handleClose : handleBack}
                data-testid="button-back"
              >
                {step === "source" ? "Cancel" : "Back"}
              </Button>
            )}
            {step === "fleet" && (
              <Button 
                size="lg"
                className="gap-2 flex-1"
                onClick={handleConfirm}
                data-testid="button-create-course"
              >
                <Zap className="h-5 w-5" />
                Create Course
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
