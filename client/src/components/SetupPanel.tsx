import { useState, useEffect } from "react";
import { Plus, ChevronRight, ChevronLeft, Check, Flag, FlagTriangleRight, Play, Pencil, MapPin, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

type SetupPhase = "marks" | "start_line" | "finish_line" | "assign_buoys" | "ready";

interface SetupPanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  onMarkSelect?: (markId: string | null) => void;
  onBuoySelect?: (buoyId: string | null) => void;
  onDeployCourse?: () => void;
  onSaveMark?: (id: string, data: Partial<Mark>) => void;
  onAddMark?: (data: { name: string; role: MarkRole; lat?: number; lng?: number }) => void;
  onPlaceMarkOnMap?: (data: { name: string; role: MarkRole }) => void;
}

export function SetupPanel({
  event,
  marks,
  buoys,
  onMarkSelect,
  onBuoySelect,
  onDeployCourse,
  onSaveMark,
  onPlaceMarkOnMap,
}: SetupPanelProps) {
  // Determine current phase based on state
  const hasMarks = marks.length >= 2;
  const hasStartLine = marks.filter(m => m.isStartLine).length >= 2;
  const hasFinishLine = marks.filter(m => m.isFinishLine).length >= 2;
  const allAssigned = marks.length > 0 && marks.every(m => m.assignedBuoyId);

  // Phase order for comparison
  const phaseOrder: SetupPhase[] = ["marks", "start_line", "finish_line", "assign_buoys", "ready"];
  
  // Get minimum required phase based on completion status
  const getMinPhase = (): SetupPhase => {
    if (!hasMarks) return "marks";
    if (!hasStartLine) return "start_line";
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
    
    // If current phase is ahead of what data supports, force back
    if (currentIdx > minIdx) {
      setPhase(minPhase);
    }
  }, [hasMarks, hasStartLine, hasFinishLine, allAssigned, phase]);

  // Initialize selection when entering line phases
  useEffect(() => {
    if (phase === "start_line") {
      setSelectedLineMarkIds(new Set(marks.filter(m => m.isStartLine).map(m => m.id)));
    } else if (phase === "finish_line") {
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

  const confirmLineSelection = () => {
    const isStartLine = phase === "start_line";
    marks.forEach(mark => {
      const isSelected = selectedLineMarkIds.has(mark.id);
      const currentFlag = isStartLine ? mark.isStartLine : mark.isFinishLine;
      if (currentFlag !== isSelected) {
        onSaveMark?.(mark.id, isStartLine ? { isStartLine: isSelected } : { isFinishLine: isSelected });
      }
    });
    // Move to next phase
    if (phase === "start_line") {
      setPhase("finish_line");
    } else if (phase === "finish_line") {
      setPhase(allAssigned ? "ready" : "assign_buoys");
    }
  };

  const handlePlaceMarkOnMap = () => {
    const markNumber = marks.length + 1;
    onPlaceMarkOnMap?.({ 
      name: `Mark ${markNumber}`, 
      role: markNumber <= 2 ? "start_boat" : "turning_mark" 
    });
  };

  const phases = [
    { id: "marks", label: "Marks", number: 1 },
    { id: "start_line", label: "Start", number: 2 },
    { id: "finish_line", label: "Finish", number: 3 },
    { id: "assign_buoys", label: "Buoys", number: 4 },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === phase);

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phase) {
      case "marks":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Add Course Marks</h2>
              <p className="text-muted-foreground">
                Tap the map to place marks, or use the button below
              </p>
            </div>

            <Button
              size="lg"
              className="w-full text-lg gap-3"
              onClick={handlePlaceMarkOnMap}
              data-testid="button-add-mark"
            >
              <Plus className="w-6 h-6" />
              Add Mark on Map
            </Button>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {marks.map((mark, index) => (
                  <button
                    key={mark.id}
                    onClick={() => onMarkSelect?.(mark.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover-elevate text-left"
                    data-testid={`button-mark-${mark.id}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                      {index + 1}
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
                {marks.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No marks yet</p>
                    <p className="text-sm">Tap the map or button above</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t">
              <Button
                size="lg"
                className="w-full text-lg gap-3"
                disabled={marks.length < 2}
                onClick={() => setPhase("start_line")}
                data-testid="button-continue-start-line"
              >
                Continue to Start Line
                <ChevronRight className="w-6 h-6" />
              </Button>
              {marks.length < 2 && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  Add at least 2 marks to continue
                </p>
              )}
            </div>
          </div>
        );

      case "start_line":
      case "finish_line":
        const isStart = phase === "start_line";
        const canConfirm = selectedLineMarkIds.size >= 2;
        
        return (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="text-center space-y-2">
              <div className={cn(
                "w-16 h-16 rounded-full mx-auto flex items-center justify-center",
                isStart ? "bg-green-100 dark:bg-green-900/30" : "bg-blue-100 dark:bg-blue-900/30"
              )}>
                {isStart ? (
                  <Flag className="w-8 h-8 text-green-600" />
                ) : (
                  <FlagTriangleRight className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <h2 className="text-2xl font-bold">
                Select {isStart ? "Start" : "Finish"} Line
              </h2>
              <p className="text-muted-foreground">
                Tap 2 marks that form the {isStart ? "start" : "finish"} line
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {marks.map((mark) => {
                  const isSelected = selectedLineMarkIds.has(mark.id);
                  return (
                    <button
                      key={mark.id}
                      onClick={() => toggleMarkSelection(mark.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all",
                        isSelected
                          ? isStart
                            ? "bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500"
                            : "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500"
                          : "bg-muted/50 hover-elevate"
                      )}
                      data-testid={`button-select-mark-${mark.id}`}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center border-4",
                        isSelected
                          ? isStart
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-blue-500 border-blue-500 text-white"
                          : "bg-background border-muted-foreground/30"
                      )}>
                        {isSelected && <Check className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{mark.name}</p>
                        <p className="text-sm text-muted-foreground">{mark.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              {!canConfirm && (
                <p className="text-center text-amber-600 font-medium">
                  Select at least 2 marks
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase(isStart ? "marks" : "start_line")}
                  data-testid="button-back"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  disabled={!canConfirm}
                  onClick={confirmLineSelection}
                  data-testid="button-confirm-line"
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
                Tap a mark to assign a buoy to it
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
                  data-testid="button-back"
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
                  <Badge variant="secondary" className="text-base px-3 py-1">{marks.length}</Badge>
                  marks configured
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Badge className="bg-green-500 text-base px-3 py-1">
                    {marks.filter(m => m.isStartLine).length}
                  </Badge>
                  start line marks
                </p>
                <p className="flex items-center justify-center gap-2">
                  <Badge className="bg-blue-500 text-base px-3 py-1">
                    {marks.filter(m => m.isFinishLine).length}
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
                onClick={() => setPhase("marks")}
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

      {/* Progress indicator */}
      {phase !== "ready" && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-2">
            {phases.map((p, idx) => {
              const isComplete = idx < currentPhaseIndex;
              const isCurrent = p.id === phase;
              return (
                <div key={p.id} className="flex-1 flex flex-col items-center gap-1">
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
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Phase content */}
      {renderPhaseContent()}
    </div>
  );
}
