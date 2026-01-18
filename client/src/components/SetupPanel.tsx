import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronRight, ChevronLeft, Check, Flag, FlagTriangleRight, Play, Pencil, MapPin, Anchor, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

type SetupPhase = "start_line" | "marks" | "finish_line" | "assign_buoys" | "ready";

interface SetupPanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  onMarkSelect?: (markId: string | null) => void;
  onBuoySelect?: (buoyId: string | null) => void;
  onDeployCourse?: () => void;
  onSaveMark?: (id: string, data: Partial<Mark>) => void;
  onAddMark?: (data: { name: string; role: MarkRole; lat?: number; lng?: number; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
  onPlaceMarkOnMap?: (data: { name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
}

export function SetupPanel({
  event,
  marks,
  buoys,
  onMarkSelect,
  onDeployCourse,
  onSaveMark,
  onPlaceMarkOnMap,
}: SetupPanelProps) {
  // Categorize marks
  const startLineMarks = useMemo(() => marks.filter(m => m.isStartLine), [marks]);
  const finishLineMarks = useMemo(() => marks.filter(m => m.isFinishLine), [marks]);
  const courseMarks = useMemo(() => marks.filter(m => m.isCourseMark === true), [marks]);
  
  // Phase completion checks - NEW ORDER: start_line → marks → finish_line → assign_buoys
  const hasStartLine = startLineMarks.length >= 2;
  const hasCourseMarks = courseMarks.length >= 1;
  const hasFinishLine = finishLineMarks.length >= 2;
  const allAssigned = marks.length > 0 && marks.every(m => m.assignedBuoyId);

  // Phase order for comparison - NEW ORDER
  const phaseOrder: SetupPhase[] = ["start_line", "marks", "finish_line", "assign_buoys", "ready"];
  
  // Get minimum required phase based on completion status - NEW ORDER
  const getMinPhase = (): SetupPhase => {
    if (!hasStartLine) return "start_line";
    if (!hasCourseMarks) return "marks";
    if (!hasFinishLine) return "finish_line";
    if (!allAssigned) return "assign_buoys";
    return "ready";
  };

  const [phase, setPhase] = useState<SetupPhase>(getMinPhase);
  const [selectedLineMarkIds, setSelectedLineMarkIds] = useState<Set<string>>(new Set());
  
  // Sync phase with data - only force phase back if current phase is invalid
  useEffect(() => {
    const minPhase = getMinPhase();
    const currentIdx = phaseOrder.indexOf(phase);
    const minIdx = phaseOrder.indexOf(minPhase);
    
    if (currentIdx > minIdx) {
      setPhase(minPhase);
    }
  }, [hasStartLine, hasCourseMarks, hasFinishLine, allAssigned, phase]);

  // Initialize selection when entering finish line phase
  useEffect(() => {
    if (phase === "finish_line") {
      setSelectedLineMarkIds(new Set(marks.filter(m => m.isFinishLine).map(m => m.id)));
    }
  }, [phase, marks]);

  const toggleMarkSelection = (markId: string) => {
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

  const confirmFinishLineSelection = () => {
    marks.forEach(mark => {
      const isSelected = selectedLineMarkIds.has(mark.id);
      if (mark.isFinishLine !== isSelected) {
        onSaveMark?.(mark.id, { isFinishLine: isSelected });
      }
    });
    setPhase(allAssigned ? "ready" : "assign_buoys");
  };

  // Add start line mark (Pin End or Committee Boat/Starboard)
  const handleAddStartLineMark = (type: "pin" | "committee_boat") => {
    const name = type === "pin" ? "Pin End" : "Committee Boat";
    const role = type === "pin" ? "pin" : "start_boat";
    onPlaceMarkOnMap?.({
      name,
      role: role as MarkRole,
      isStartLine: true,
      isFinishLine: false,
      isCourseMark: false,
    });
  };

  // Add course mark (M1, M2, M3, etc.)
  const handleAddCourseMark = () => {
    const markNumber = courseMarks.length + 1;
    onPlaceMarkOnMap?.({ 
      name: `M${markNumber}`, 
      role: "turning_mark",
      isStartLine: false,
      isFinishLine: false,
      isCourseMark: true,
    });
  };
  
  // Add finish line mark
  const handleAddFinishMark = () => {
    const existingFinishMarks = marks.filter(m => m.isFinishLine && m.isCourseMark === false);
    const markNumber = existingFinishMarks.length + 1;
    const name = markNumber === 1 ? "Finish Pin" : "Finish Boat";
    onPlaceMarkOnMap?.({
      name,
      role: markNumber === 1 ? "pin" : "start_boat" as MarkRole,
      isStartLine: false,
      isFinishLine: true,
      isCourseMark: false,
    });
  };

  // Check if specific start line marks exist
  const hasPinEnd = startLineMarks.some(m => m.role === "pin" || m.name.toLowerCase().includes("pin"));
  const hasCommitteeBoat = startLineMarks.some(m => m.role === "start_boat" || m.name.toLowerCase().includes("committee") || m.name.toLowerCase().includes("starboard"));

  // Updated phases for new order
  const phases = [
    { id: "start_line", label: "Start", number: 1 },
    { id: "marks", label: "Marks", number: 2 },
    { id: "finish_line", label: "Finish", number: 3 },
    { id: "assign_buoys", label: "Buoys", number: 4 },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === phase);

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phase) {
      case "start_line":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                <Flag className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold">Set Starting Line</h2>
              <p className="text-muted-foreground">
                Add the Pin End and Committee Boat marks
              </p>
            </div>

            <div className="space-y-3">
              <Button
                size="lg"
                variant={hasPinEnd ? "secondary" : "default"}
                className={cn(
                  "w-full text-lg gap-3 justify-start",
                  hasPinEnd && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                )}
                onClick={() => handleAddStartLineMark("pin")}
                disabled={hasPinEnd}
                data-testid="button-add-pin-end"
              >
                {hasPinEnd ? (
                  <Check className="w-6 h-6 text-green-600" />
                ) : (
                  <Plus className="w-6 h-6" />
                )}
                Pin End (Port)
                {hasPinEnd && (
                  <Badge className="ml-auto bg-green-500">Added</Badge>
                )}
              </Button>

              <Button
                size="lg"
                variant={hasCommitteeBoat ? "secondary" : "default"}
                className={cn(
                  "w-full text-lg gap-3 justify-start",
                  hasCommitteeBoat && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                )}
                onClick={() => handleAddStartLineMark("committee_boat")}
                disabled={hasCommitteeBoat}
                data-testid="button-add-committee-boat"
              >
                {hasCommitteeBoat ? (
                  <Check className="w-6 h-6 text-green-600" />
                ) : (
                  <Ship className="w-6 h-6" />
                )}
                Committee Boat (Starboard)
                {hasCommitteeBoat && (
                  <Badge className="ml-auto bg-green-500">Added</Badge>
                )}
              </Button>
            </div>

            {startLineMarks.length > 0 && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-muted-foreground">Start Line Marks:</p>
                  {startLineMarks.map((mark) => (
                    <button
                      key={mark.id}
                      onClick={() => onMarkSelect?.(mark.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 hover-elevate text-left"
                      data-testid={`button-start-mark-${mark.id}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <Flag className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{mark.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {mark.lat.toFixed(4)}, {mark.lng.toFixed(4)}
                        </p>
                      </div>
                      <Pencil className="w-5 h-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="pt-4 border-t">
              <Button
                size="lg"
                className="w-full text-lg gap-3"
                disabled={!hasStartLine}
                onClick={() => setPhase("marks")}
                data-testid="button-continue-marks"
              >
                Continue to Course Marks
                <ChevronRight className="w-6 h-6" />
              </Button>
              {!hasStartLine && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Add both Pin End and Committee Boat to continue
                </p>
              )}
            </div>
          </div>
        );

      case "marks":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-primary/10">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Add Course Marks</h2>
              <p className="text-muted-foreground">
                Add the race course marks (M1, M2, M3, etc.)
              </p>
            </div>

            <Button
              size="lg"
              className="w-full text-lg gap-3"
              onClick={handleAddCourseMark}
              data-testid="button-add-course-mark"
            >
              <Plus className="w-6 h-6" />
              Add Course Mark (M{courseMarks.length + 1})
            </Button>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {courseMarks.map((mark, index) => (
                  <button
                    key={mark.id}
                    onClick={() => onMarkSelect?.(mark.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover-elevate text-left"
                    data-testid={`button-course-mark-${mark.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      M{index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-lg">{mark.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {mark.lat.toFixed(4)}, {mark.lng.toFixed(4)}
                      </p>
                    </div>
                    <Pencil className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
                {courseMarks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No course marks yet</p>
                    <p className="text-sm">Tap the button above to add marks</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase("start_line")}
                  data-testid="button-back-start"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  disabled={!hasCourseMarks}
                  onClick={() => setPhase("finish_line")}
                  data-testid="button-continue-finish"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              {!hasCourseMarks && (
                <p className="text-center text-sm text-muted-foreground">
                  Add at least 1 course mark to continue
                </p>
              )}
            </div>
          </div>
        );

      case "finish_line":
        const canConfirmFinish = selectedLineMarkIds.size >= 2;
        
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                <FlagTriangleRight className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold">Set Finish Line</h2>
              <p className="text-muted-foreground">
                Select 2 marks for the finish line (can reuse start line marks)
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full text-lg gap-2"
              onClick={handleAddFinishMark}
              data-testid="button-add-finish-mark"
            >
              <Plus className="w-5 h-5" />
              Add New Finish Mark
            </Button>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Select any 2 marks for the finish line:
                </p>
                {marks.map((mark) => {
                  const isSelected = selectedLineMarkIds.has(mark.id);
                  const isStartLineMark = mark.isStartLine;
                  return (
                    <button
                      key={mark.id}
                      onClick={() => toggleMarkSelection(mark.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all",
                        isSelected
                          ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500"
                          : "bg-muted/50 hover-elevate"
                      )}
                      data-testid={`button-select-finish-mark-${mark.id}`}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center border-4",
                        isSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-background border-muted-foreground/30"
                      )}>
                        {isSelected && <Check className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{mark.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {mark.isCourseMark ? "Course Mark" : mark.role}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {isStartLineMark && (
                          <Badge className="bg-green-500">S</Badge>
                        )}
                        {isSelected && (
                          <Badge className="bg-blue-500">F</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              {!canConfirmFinish && (
                <p className="text-center text-amber-600 font-medium">
                  Select at least 2 marks for the finish line
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase("marks")}
                  data-testid="button-back-marks"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  disabled={!canConfirmFinish}
                  onClick={confirmFinishLineSelection}
                  data-testid="button-confirm-finish"
                >
                  <Check className="w-5 h-5" />
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        );

      case "assign_buoys":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <Anchor className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold">Assign Buoys</h2>
              <p className="text-muted-foreground">
                Tap a mark to assign a robotic buoy to it
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {marks.map((mark) => {
                  const assignedBuoy = buoys.find(b => b.id === mark.assignedBuoyId);
                  return (
                    <button
                      key={mark.id}
                      onClick={() => onMarkSelect?.(mark.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl text-left hover-elevate",
                        assignedBuoy ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/50"
                      )}
                      data-testid={`button-assign-mark-${mark.id}`}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        assignedBuoy ? "bg-green-500 text-white" : "bg-muted-foreground/20"
                      )}>
                        {assignedBuoy ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <Anchor className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{mark.name}</p>
                        <p className={cn(
                          "text-sm",
                          assignedBuoy ? "text-green-600" : "text-amber-600"
                        )}>
                          {assignedBuoy ? `Buoy: ${assignedBuoy.name}` : "Tap to assign buoy"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {mark.isStartLine && (
                          <Badge className="bg-green-500">S</Badge>
                        )}
                        {mark.isFinishLine && (
                          <Badge className="bg-blue-500">F</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase("finish_line")}
                  data-testid="button-back-finish"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  disabled={!allAssigned}
                  onClick={() => setPhase("ready")}
                  data-testid="button-continue-ready"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              {!allAssigned && (
                <p className="text-center text-sm text-muted-foreground">
                  {marks.filter(m => !m.assignedBuoyId).length} marks still need buoys
                </p>
              )}
            </div>
          </div>
        );

      case "ready":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-4 flex-1 flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold">Ready to Deploy!</h2>
              <div className="space-y-2 text-lg">
                <p className="flex items-center justify-center gap-2">
                  <Badge className="bg-green-500 text-base px-3 py-1">
                    {startLineMarks.length}
                  </Badge>
                  start line marks
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {courseMarks.length}
                  </Badge>
                  course marks
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Badge className="bg-blue-500 text-base px-3 py-1">
                    {finishLineMarks.length}
                  </Badge>
                  finish line marks
                </p>
              </div>
            </div>

            <div className="pt-4 border-t space-y-3">
              <Button
                size="lg"
                className="w-full text-xl gap-3"
                onClick={onDeployCourse}
                data-testid="button-deploy-course"
              >
                <Play className="w-8 h-8" />
                Deploy Course
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full text-lg gap-2"
                onClick={() => setPhase("start_line")}
                data-testid="button-edit-course"
              >
                <Pencil className="w-5 h-5" />
                Edit Course
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-card" data-testid="setup-panel">
      {/* Header with event info */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant={event.type === "race" ? "default" : "secondary"} className="mb-1">
              {event.type === "race" ? "Race" : "Training"}
            </Badge>
            <h1 className="text-xl font-bold">{event.name}</h1>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{event.boatClass}</p>
            <p>{event.targetDuration} min</p>
          </div>
        </div>
      </div>

      {/* Clickable progress indicator for navigation */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          {phases.map((p, idx) => {
            const minPhase = getMinPhase();
            const minPhaseIdx = phaseOrder.indexOf(minPhase);
            const isComplete = idx < currentPhaseIndex;
            const isCurrent = p.id === phase;
            const canNavigate = idx <= minPhaseIdx && !isCurrent;
            
            return (
              <button
                key={p.id}
                onClick={() => canNavigate && setPhase(p.id as SetupPhase)}
                disabled={!canNavigate && !isCurrent}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 transition-opacity",
                  canNavigate ? "cursor-pointer hover:opacity-80" : "",
                  !canNavigate && !isCurrent && idx > minPhaseIdx ? "opacity-50" : ""
                )}
                data-testid={`button-phase-${p.id}`}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors",
                  isComplete ? "bg-green-500 text-white" :
                  isCurrent ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isComplete ? <Check className="w-5 h-5" /> : p.number}
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase content */}
      {renderPhaseContent()}
    </div>
  );
}
