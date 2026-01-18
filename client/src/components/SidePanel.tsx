import { useState } from "react";
import { Play, Anchor, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { CourseShapeSelector } from "./CourseShapeSelector";
import { MarksList } from "./MarksList";
import { BuoyCard } from "./BuoyCard";
import { WindIndicator } from "./WindIndicator";
import { BuoyDetailPanel } from "./BuoyDetailPanel";
import { MarkEditPanel } from "./MarkEditPanel";
import { AddMarkDialog } from "./AddMarkDialog";
import { CourseControls } from "./CourseControls";
import { CourseStats } from "./CourseStats";
import type { CourseShape, Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

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
  const [selectedShape, setSelectedShape] = useState<CourseShape>(course?.shape as CourseShape || "triangle");
  const [buoysExpanded, setBuoysExpanded] = useState(true);

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
          <div className="flex justify-center py-2">
            <WindIndicator size="md" weatherData={weatherData} />
          </div>

          <Separator />

          <CourseShapeSelector 
            selectedShape={selectedShape} 
            onSelect={setSelectedShape} 
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
