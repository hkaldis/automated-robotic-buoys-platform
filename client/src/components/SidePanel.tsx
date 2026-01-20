import { useState, useEffect } from "react";
import { Play, Anchor, ChevronDown, ChevronUp, Plus, Flag, FlagTriangleRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { CourseShapeSelector } from "./CourseShapeSelector";
import { MarksList } from "./MarksList";
import { BuoyCard } from "./BuoyCard";
import { BuoyDetailPanel } from "./BuoyDetailPanel";
import { MarkEditPanel } from "./MarkEditPanel";
import { AddMarkDialog } from "./AddMarkDialog";
import { CourseControls } from "./CourseControls";
import { CourseStats } from "./CourseStats";
import type { CourseShape, Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

type LineSetupMode = "none" | "start" | "finish";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  source: string;
}

interface SidePanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  roundingSequence?: string[];
  selectedBuoy: Buoy | null;
  selectedMark: Mark | null;
  weatherData?: WeatherData | null;
  isRepositioningMark?: boolean;
  onBuoySelect?: (buoyId: string | null) => void;
  onMarkSelect?: (markId: string | null) => void;
  onDeployCourse?: () => void;
  onSaveMark?: (id: string, data: Partial<Mark>) => void;
  onDeleteMark?: (id: string) => void;
  onAddMark?: (data: { name: string; role: MarkRole; lat?: number; lng?: number }) => void;
  onPlaceMarkOnMap?: (data: { name: string; role: MarkRole }) => void;
  onRepositionMark?: (markId: string) => void;
  onUpdateCourse?: (data: Partial<Course>) => void;
  onUpdateMarks?: (marks: Mark[]) => void;
}

export function SidePanel({ 
  event, 
  course,
  buoys, 
  marks, 
  roundingSequence = [],
  selectedBuoy, 
  selectedMark,
  weatherData, 
  isRepositioningMark,
  onBuoySelect, 
  onMarkSelect,
  onDeployCourse,
  onSaveMark,
  onDeleteMark,
  onAddMark,
  onPlaceMarkOnMap,
  onRepositionMark,
  onUpdateCourse,
  onUpdateMarks,
}: SidePanelProps) {
  // Use the actual course shape, default to "custom" if no course or shape is unset
  const [selectedShape, setSelectedShape] = useState<CourseShape>(
    (course?.shape as CourseShape) || "custom"
  );
  const [buoysExpanded, setBuoysExpanded] = useState(true);
  const [lineSetupMode, setLineSetupMode] = useState<LineSetupMode>("none");
  const [selectedLineMarkIds, setSelectedLineMarkIds] = useState<Set<string>>(new Set());

  // Sync selectedShape with course.shape when course changes
  useEffect(() => {
    if (course?.shape) {
      setSelectedShape(course.shape as CourseShape);
    }
  }, [course?.shape]);

  // Initialize selected marks when entering line setup mode
  useEffect(() => {
    if (lineSetupMode === "start") {
      setSelectedLineMarkIds(new Set(marks.filter(m => m.isStartLine).map(m => m.id)));
    } else if (lineSetupMode === "finish") {
      setSelectedLineMarkIds(new Set(marks.filter(m => m.isFinishLine).map(m => m.id)));
    } else {
      setSelectedLineMarkIds(new Set());
    }
  }, [lineSetupMode, marks]);

  const toggleMarkForLine = (markId: string) => {
    setSelectedLineMarkIds(prev => {
      const next = new Set(prev);
      if (next.has(markId)) {
        next.delete(markId);
      } else {
        next.add(markId);
      }
      return next;
    });
  };

  const handleLineSetupDone = () => {
    // Update all marks' start/finish line flags based on selection
    marks.forEach(mark => {
      const isSelected = selectedLineMarkIds.has(mark.id);
      if (lineSetupMode === "start") {
        if (mark.isStartLine !== isSelected) {
          onSaveMark?.(mark.id, { isStartLine: isSelected });
        }
      } else if (lineSetupMode === "finish") {
        if (mark.isFinishLine !== isSelected) {
          onSaveMark?.(mark.id, { isFinishLine: isSelected });
        }
      }
    });
    setLineSetupMode("none");
  };

  const handleCancelLineSetup = () => {
    setLineSetupMode("none");
  };

  if (selectedBuoy) {
    return (
      <BuoyDetailPanel 
        buoy={selectedBuoy} 
        onClose={() => onBuoySelect?.(null)} 
      />
    );
  }

  if (selectedMark) {
    return (
      <MarkEditPanel
        mark={selectedMark}
        buoys={buoys}
        allMarks={marks}
        roundingSequence={roundingSequence}
        onClose={() => onMarkSelect?.(null)}
        onSave={(data) => onSaveMark?.(selectedMark.id, data)}
        onDelete={() => onDeleteMark?.(selectedMark.id)}
        onReposition={() => onRepositionMark?.(selectedMark.id)}
        isRepositioning={isRepositioningMark}
      />
    );
  }

  const assignedCount = marks.filter(m => m.assignedBuoyId).length;
  const totalMarks = marks.length;
  const allAssigned = totalMarks > 0 && assignedCount === totalMarks;
  const hasStartLine = marks.some(m => m.isStartLine);
  const hasFinishLine = marks.some(m => m.isFinishLine);
  const linesValid = hasStartLine && hasFinishLine;
  const canDeploy = allAssigned && linesValid && totalMarks > 0;

  return (
    <div className="h-full flex flex-col bg-card" data-testid="side-panel">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={event.type === "race" ? "default" : "secondary"}>
            {event.type === "race" ? "Race" : "Training"}
          </Badge>
          <span className="text-sm text-muted-foreground">{event.boatClass}</span>
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-event-name-panel">{event.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Target: {event.targetDuration} min
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <CourseShapeSelector 
            selectedShape={selectedShape} 
            onSelect={(shape) => {
              setSelectedShape(shape);
              if (course && onUpdateCourse) {
                onUpdateCourse({ shape });
              }
            }} 
          />

          {course && onUpdateCourse && onUpdateMarks && (
            <CourseControls
              course={course}
              marks={marks}
              windDirection={weatherData?.windDirection}
              onUpdateCourse={onUpdateCourse}
              onUpdateMarks={onUpdateMarks}
            />
          )}

          <CourseStats 
            marks={marks}
            boatClass={event.boatClass}
            targetDuration={event.targetDuration}
          />

          {/* Line Setup Section */}
          {lineSetupMode !== "none" ? (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {lineSetupMode === "start" ? (
                    <>
                      <Flag className="w-4 h-4 text-green-600" />
                      Set Start Line
                    </>
                  ) : (
                    <>
                      <FlagTriangleRight className="w-4 h-4 text-blue-600" />
                      Set Finish Line
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select marks that form the {lineSetupMode} line:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {marks.map(mark => (
                    <div
                      key={mark.id}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-md text-sm border",
                        selectedLineMarkIds.has(mark.id)
                          ? "border-primary bg-primary/10"
                          : "border-transparent"
                      )}
                    >
                      <button
                        onClick={() => toggleMarkForLine(mark.id)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center shrink-0 hover-elevate",
                          selectedLineMarkIds.has(mark.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                        data-testid={`button-line-mark-${mark.id}`}
                      >
                        {selectedLineMarkIds.has(mark.id) && <Check className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => onMarkSelect?.(mark.id)}
                        className="flex-1 text-left hover-elevate rounded px-1"
                        data-testid={`button-edit-mark-${mark.id}`}
                      >
                        {mark.name}
                      </button>
                      <Badge variant="outline" className="text-xs">{mark.role}</Badge>
                    </div>
                  ))}
                </div>
                {selectedLineMarkIds.size < 2 && (
                  <p className="text-xs text-amber-600">Select at least 2 marks for the line</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelLineSetup}
                    className="flex-1"
                    data-testid="button-cancel-line-setup"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleLineSetupDone}
                    disabled={selectedLineMarkIds.size < 2}
                    className="flex-1"
                    data-testid="button-done-line-setup"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Start/Finish Lines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Start Line</span>
                  </div>
                  {hasStartLine ? (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      {marks.filter(m => m.isStartLine).length} marks
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setLineSetupMode("start")}
                  disabled={marks.length === 0}
                  data-testid="button-set-start-line"
                >
                  {hasStartLine ? "Edit Start Line" : "Set Start Line"}
                </Button>
                
                <Separator className="my-2" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlagTriangleRight className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Finish Line</span>
                  </div>
                  {hasFinishLine ? (
                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                      {marks.filter(m => m.isFinishLine).length} marks
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Not set</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setLineSetupMode("finish")}
                  disabled={marks.length === 0}
                  data-testid="button-set-finish-line"
                >
                  {hasFinishLine ? "Edit Finish Line" : "Set Finish Line"}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Course Marks</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{marks.length}</Badge>
                  {onAddMark && onPlaceMarkOnMap && (
                    <AddMarkDialog 
                      onAdd={onAddMark} 
                      onPlaceOnMap={onPlaceMarkOnMap}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-6 w-6" data-testid="button-add-mark-header">
                          <Plus className="w-4 h-4" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MarksList 
                marks={marks}
                buoys={buoys}
                selectedMarkId={null}
                onSelectMark={(id) => onMarkSelect?.(id)}
              />
            </CardContent>
          </Card>

          <Collapsible open={buoysExpanded} onOpenChange={setBuoysExpanded}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover-elevate rounded-t-lg">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Anchor className="w-4 h-4" />
                      Available Buoys
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{buoys.length}</Badge>
                      {buoysExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {buoys.slice(0, 7).map((buoy) => (
                    <BuoyCard
                      key={buoy.id}
                      buoy={buoy}
                      compact
                      isSelected={false}
                      onClick={() => onBuoySelect?.(buoy.id)}
                    />
                  ))}
                  {buoys.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No buoys available
                    </p>
                  )}
                  {buoys.length > 7 && (
                    <Button variant="ghost" className="w-full text-sm">
                      View all {buoys.length} buoys
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Marks assigned</span>
          <span className={cn(
            "font-medium",
            allAssigned ? "text-green-500" : "text-muted-foreground"
          )}>
            {assignedCount} / {totalMarks}
          </span>
        </div>

        <Button 
          className="w-full h-12 gap-2 text-base" 
          size="lg"
          disabled={!canDeploy}
          onClick={onDeployCourse}
          data-testid="button-deploy-course"
        >
          <Play className="w-5 h-5" />
          Deploy Course
        </Button>
        {!linesValid && totalMarks > 0 && (
          <p className="text-xs text-destructive text-center" data-testid="text-lines-warning">
            Define start and finish lines to deploy
          </p>
        )}
      </div>
    </div>
  );
}
