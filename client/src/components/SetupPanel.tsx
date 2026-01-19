import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronRight, ChevronLeft, Check, Flag, FlagTriangleRight, Play, Pencil, MapPin, Anchor, Ship, Save, RotateCw, RotateCcw, Maximize2, Move, Ruler, Clock, Download, Upload, List, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

type SetupPhase = "start_line" | "marks" | "finish_line" | "sequence" | "summary" | "assign_buoys" | "ready";

interface SetupPanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  savedCourses?: Course[];
  roundingSequence?: string[];
  windDirection?: number;
  onMarkSelect?: (markId: string | null) => void;
  onBuoySelect?: (buoyId: string | null) => void;
  onDeployCourse?: () => void;
  onSaveMark?: (id: string, data: Partial<Mark>) => void;
  onAddMark?: (data: { name: string; role: MarkRole; lat?: number; lng?: number; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
  onPlaceMarkOnMap?: (data: { name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
  onSaveCourse?: (name: string) => void;
  onLoadCourse?: (courseId: string) => void;
  onTransformCourse?: (transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number }) => void;
  onFinishLinePreview?: (selectedMarkIds: Set<string>) => void;
  onUpdateSequence?: (sequence: string[]) => void;
  onAutoAssignBuoys?: () => void;
  onPhaseChange?: (phase: SetupPhase) => void;
}

export function SetupPanel({
  event,
  marks,
  buoys,
  savedCourses = [],
  roundingSequence = [],
  windDirection,
  onMarkSelect,
  onDeployCourse,
  onSaveMark,
  onPlaceMarkOnMap,
  onSaveCourse,
  onLoadCourse,
  onTransformCourse,
  onFinishLinePreview,
  onUpdateSequence,
  onAutoAssignBuoys,
  onPhaseChange,
}: SetupPanelProps) {
  // Categorize marks
  const startLineMarks = useMemo(() => marks.filter(m => m.isStartLine), [marks]);
  const finishLineMarks = useMemo(() => marks.filter(m => m.isFinishLine), [marks]);
  const courseMarks = useMemo(() => marks.filter(m => m.isCourseMark === true), [marks]);
  
  // Phase completion checks - NEW ORDER: start_line → marks → finish_line → assign_buoys
  const hasStartLine = startLineMarks.length >= 2;
  const hasCourseMarks = courseMarks.length >= 1;
  const hasFinishLine = finishLineMarks.length >= 2;
  
  // Check if all buoys are assigned (gates need 2 buoys, regular marks need 1)
  const allAssigned = marks.length > 0 && marks.every(m => {
    if (m.isGate) {
      return m.gatePortBuoyId && m.gateStarboardBuoyId;
    }
    return m.assignedBuoyId;
  });
  
  // Count unassigned marks (gates count as 2 if neither assigned, 1 if partially assigned)
  const getUnassignedCount = () => {
    let count = 0;
    for (const m of marks) {
      if (m.isGate) {
        if (!m.gatePortBuoyId) count++;
        if (!m.gateStarboardBuoyId) count++;
      } else {
        if (!m.assignedBuoyId) count++;
      }
    }
    return count;
  };

  // Phase order for comparison - with sequence step
  const phaseOrder: SetupPhase[] = ["start_line", "marks", "finish_line", "sequence", "summary", "assign_buoys", "ready"];
  
  // Check if sequence is valid (has start, finish, and at least one course mark)
  const hasCourseMarkInSequence = roundingSequence.filter(e => e !== "start" && e !== "finish").length > 0;
  const hasSequence = roundingSequence.length >= 3 && 
    roundingSequence.includes("start") && 
    roundingSequence.includes("finish") &&
    hasCourseMarkInSequence;
  
  // Get minimum required phase based on completion status
  const getMinPhase = (): SetupPhase => {
    if (!hasStartLine) return "start_line";
    if (!hasCourseMarks) return "marks";
    if (!hasFinishLine) return "finish_line";
    // Sequence phase - user defines the rounding order
    if (!hasSequence) return "sequence";
    // Summary phase is optional - user can proceed after sequence is set
    if (!allAssigned) return "summary";
    return "ready";
  };

  // State for save course dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [courseName, setCourseName] = useState("");
  
  // State for load course dialog
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  const [phase, setPhase] = useState<SetupPhase>(getMinPhase);
  const [selectedLineMarkIds, setSelectedLineMarkIds] = useState<Set<string>>(new Set());
  const [finishConfirmed, setFinishConfirmed] = useState(false);
  
  // Notify parent of phase changes
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);
  
  // Sync phase with data - only force phase back if current phase is invalid
  // But don't reset from later phases if user has progressed through the workflow
  useEffect(() => {
    const minPhase = getMinPhase();
    const currentIdx = phaseOrder.indexOf(phase);
    const minIdx = phaseOrder.indexOf(minPhase);
    
    // Allow staying in sequence/summary/assign_buoys/ready if:
    // 1. User confirmed finish line (async mark updates may still be pending)
    // 2. User has a valid sequence (means they've progressed through the workflow)
    const canStayInLaterPhase = finishConfirmed || hasSequence;
    if (canStayInLaterPhase && (phase === "sequence" || phase === "summary" || phase === "assign_buoys" || phase === "ready")) {
      // Only reset if we've lost essential prerequisites (start/marks/finish)
      if (!hasStartLine || !hasCourseMarks || !hasFinishLine) {
        const essentialMinIdx = !hasStartLine ? 0 : !hasCourseMarks ? 1 : 2;
        if (currentIdx > essentialMinIdx) {
          setPhase(phaseOrder[essentialMinIdx]);
        }
      }
      return;
    }
    
    if (currentIdx > minIdx) {
      setPhase(minPhase);
    }
  }, [hasStartLine, hasCourseMarks, hasFinishLine, hasSequence, allAssigned, phase, finishConfirmed]);

  // Initialize selection when entering finish line phase
  useEffect(() => {
    if (phase === "finish_line") {
      setSelectedLineMarkIds(new Set(marks.filter(m => m.isFinishLine).map(m => m.id)));
    }
  }, [phase, marks]);

  // Send finish line preview to map when selection changes
  useEffect(() => {
    if (phase === "finish_line") {
      onFinishLinePreview?.(selectedLineMarkIds);
    } else {
      onFinishLinePreview?.(new Set());
    }
  }, [phase, selectedLineMarkIds, onFinishLinePreview]);

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
    setFinishConfirmed(true);
    setPhase("sequence");
  };
  
  // Sequence management functions
  const addToSequence = (markId: string) => {
    const newSequence = [...roundingSequence, markId];
    onUpdateSequence?.(newSequence);
  };
  
  const removeFromSequence = (index: number) => {
    const newSequence = [...roundingSequence];
    newSequence.splice(index, 1);
    onUpdateSequence?.(newSequence);
  };
  
  const undoLastSequence = () => {
    if (roundingSequence.length > 0) {
      onUpdateSequence?.(roundingSequence.slice(0, -1));
    }
  };
  
  const clearSequence = () => {
    onUpdateSequence?.([]);
  };
  
  const autoGenerateSequence = () => {
    // Auto-generate a simple sequential course: Start → M1 → M2 → ... → Finish
    const sortedCourseMarkIds = [...courseMarks]
      .sort((a, b) => a.order - b.order)
      .map(m => m.id);
    const startMarkId = startLineMarks.length > 0 ? "start" : null;
    const finishMarkId = finishLineMarks.length > 0 ? "finish" : null;
    
    const sequence: string[] = [];
    if (startMarkId) sequence.push(startMarkId);
    sequence.push(...sortedCourseMarkIds);
    if (finishMarkId) sequence.push(finishMarkId);
    
    onUpdateSequence?.(sequence);
  };

  // Calculate course statistics based on rounding sequence
  const courseStats = useMemo(() => {
    const startCenter = startLineMarks.length >= 2 ? {
      lat: startLineMarks.reduce((s, m) => s + m.lat, 0) / startLineMarks.length,
      lng: startLineMarks.reduce((s, m) => s + m.lng, 0) / startLineMarks.length,
    } : null;
    
    const finishCenter = finishLineMarks.length >= 2 ? {
      lat: finishLineMarks.reduce((s, m) => s + m.lat, 0) / finishLineMarks.length,
      lng: finishLineMarks.reduce((s, m) => s + m.lng, 0) / finishLineMarks.length,
    } : null;
    
    // Haversine distance calculation
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 3440.065; // Earth radius in nautical miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    
    // Get position for a sequence entry (mark ID, "start", or "finish")
    const getPosition = (entry: string): { lat: number; lng: number } | null => {
      if (entry === "start") return startCenter;
      if (entry === "finish") return finishCenter;
      const mark = marks.find(m => m.id === entry);
      return mark ? { lat: mark.lat, lng: mark.lng } : null;
    };

    // Bearing calculation
    const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
      return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
    };

    // Calculate legs based on sequence
    const legs: { from: string; to: string; distance: number; bearing: number }[] = [];
    let totalDistance = 0;
    
    if (roundingSequence.length >= 2) {
      for (let i = 0; i < roundingSequence.length - 1; i++) {
        const fromPos = getPosition(roundingSequence[i]);
        const toPos = getPosition(roundingSequence[i + 1]);
        if (fromPos && toPos) {
          const distance = haversine(fromPos.lat, fromPos.lng, toPos.lat, toPos.lng);
          const bearing = calculateBearing(fromPos.lat, fromPos.lng, toPos.lat, toPos.lng);
          legs.push({
            from: roundingSequence[i],
            to: roundingSequence[i + 1],
            distance,
            bearing
          });
          totalDistance += distance;
        }
      }
    }
    
    // Start line length
    let startLineLength = 0;
    if (startLineMarks.length >= 2) {
      startLineLength = haversine(startLineMarks[0].lat, startLineMarks[0].lng, startLineMarks[1].lat, startLineMarks[1].lng);
    }

    // Finish line length
    let finishLineLength = 0;
    if (finishLineMarks.length >= 2) {
      finishLineLength = haversine(finishLineMarks[0].lat, finishLineMarks[0].lng, finishLineMarks[1].lat, finishLineMarks[1].lng);
    }

    // Estimated race time (assuming 4.5 knots average speed)
    const estimatedTime = totalDistance > 0 ? (totalDistance / 4.5) * 60 : 0;

    return {
      startLineLength,
      finishLineLength,
      totalDistance,
      estimatedTime,
      startMarksCount: startLineMarks.length,
      courseMarksCount: courseMarks.length,
      finishMarksCount: finishLineMarks.length,
      legs,
    };
  }, [startLineMarks, finishLineMarks, marks, roundingSequence]);
  
  // Helper to get mark name for sequence display
  const getSequenceEntryName = (entry: string): string => {
    if (entry === "start") return "Start";
    if (entry === "finish") return "Finish";
    const mark = marks.find(m => m.id === entry);
    return mark?.name ?? "Unknown";
  };

  const handleSaveCourse = () => {
    if (courseName.trim() && onSaveCourse) {
      onSaveCourse(courseName.trim());
      setShowSaveDialog(false);
      setCourseName("");
    }
  };

  const handleLoadCourse = (courseId: string) => {
    onLoadCourse?.(courseId);
    setShowLoadDialog(false);
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

  // Updated phases with sequence step
  const phases = [
    { id: "start_line", label: "Start", number: 1 },
    { id: "marks", label: "Marks", number: 2 },
    { id: "finish_line", label: "Finish", number: 3 },
    { id: "sequence", label: "Route", number: 4 },
    { id: "summary", label: "Review", number: 5 },
    { id: "assign_buoys", label: "Buoys", number: 6 },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === phase);

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phase) {
      case "start_line":
        return (
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                <Flag className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Start Line</h2>
                <p className="text-xs text-muted-foreground">Add Pin End & Committee Boat</p>
              </div>
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
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Course Marks</h2>
                <p className="text-xs text-muted-foreground">Add marks (M1, M2, M3...)</p>
              </div>
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
                  onClick={() => { setFinishConfirmed(false); setPhase("finish_line"); }}
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
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                <FlagTriangleRight className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Finish Line</h2>
                <p className="text-xs text-muted-foreground">Select 2 marks (can reuse start marks)</p>
              </div>
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

      case "sequence":
        return (
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                <List className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Set Route</h2>
                <p className="text-xs text-muted-foreground">Tap marks in rounding order</p>
              </div>
            </div>

            {/* Available marks to add */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Tap to add:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  variant={roundingSequence.includes("start") ? "secondary" : "outline"}
                  className="gap-2"
                  onClick={() => addToSequence("start")}
                  data-testid="button-add-start-to-sequence"
                >
                  <Flag className="w-4 h-4 text-green-600" />
                  Start
                </Button>
                {courseMarks.map(mark => (
                  <Button
                    key={mark.id}
                    size="lg"
                    variant="outline"
                    className="gap-2"
                    onClick={() => addToSequence(mark.id)}
                    data-testid={`button-add-mark-${mark.id}-to-sequence`}
                  >
                    <MapPin className="w-4 h-4" />
                    {mark.name}
                  </Button>
                ))}
                <Button
                  size="lg"
                  variant={roundingSequence.includes("finish") ? "secondary" : "outline"}
                  className="gap-2"
                  onClick={() => addToSequence("finish")}
                  data-testid="button-add-finish-to-sequence"
                >
                  <FlagTriangleRight className="w-4 h-4 text-blue-600" />
                  Finish
                </Button>
              </div>
            </div>

            {/* Current sequence */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Route ({roundingSequence.length} waypoints)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={undoLastSequence}
                      disabled={roundingSequence.length === 0}
                      data-testid="button-undo-sequence"
                    >
                      <Undo2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSequence}
                      disabled={roundingSequence.length === 0}
                      data-testid="button-clear-sequence"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {roundingSequence.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground bg-muted/30 rounded-lg">
                    <p>No waypoints added yet.</p>
                    <p className="text-sm mt-1">Tap "Start" to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {roundingSequence.map((entry, index) => {
                      const name = getSequenceEntryName(entry);
                      const isStart = entry === "start";
                      const isFinish = entry === "finish";
                      const legDistance = index > 0 ? courseStats.legs[index - 1]?.distance : null;
                      
                      return (
                        <div
                          key={`${entry}-${index}`}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg",
                            isStart ? "bg-green-50 dark:bg-green-900/20" :
                            isFinish ? "bg-blue-50 dark:bg-blue-900/20" :
                            "bg-muted/50"
                          )}
                          data-testid={`sequence-item-${index}`}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                            isStart ? "bg-green-500 text-white" :
                            isFinish ? "bg-blue-500 text-white" :
                            "bg-muted-foreground/20"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{name}</p>
                            {legDistance !== null && legDistance !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                {legDistance.toFixed(2)} nm from previous
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeFromSequence(index)}
                            data-testid={`button-remove-sequence-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {roundingSequence.length >= 2 && (
                  <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <p className="text-sm font-medium">Total Distance</p>
                    <p className="text-2xl font-bold" data-testid="text-sequence-total">
                      {courseStats.totalDistance.toFixed(2)} nm
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              {roundingSequence.length === 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2"
                  onClick={autoGenerateSequence}
                  data-testid="button-auto-sequence"
                >
                  <Play className="w-4 h-4" />
                  Auto-Generate Simple Route
                </Button>
              )}
              {/* Validation messages */}
              {roundingSequence.length > 0 && (
                <>
                  {!roundingSequence.includes("start") && (
                    <p className="text-center text-amber-600 text-sm">
                      Route must include Start
                    </p>
                  )}
                  {!roundingSequence.includes("finish") && (
                    <p className="text-center text-amber-600 text-sm">
                      Route must include Finish
                    </p>
                  )}
                  {roundingSequence.includes("start") && roundingSequence.includes("finish") && 
                   roundingSequence.filter(e => e !== "start" && e !== "finish").length === 0 && (
                    <p className="text-center text-amber-600 text-sm">
                      Add at least one course mark
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => { setFinishConfirmed(false); setPhase("finish_line"); }}
                  data-testid="button-back-finish"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  disabled={
                    roundingSequence.length < 3 || 
                    !roundingSequence.includes("start") || 
                    !roundingSequence.includes("finish") ||
                    roundingSequence.filter(e => e !== "start" && e !== "finish").length === 0
                  }
                  onClick={() => setPhase("summary")}
                  data-testid="button-continue-summary"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "summary":
        return (
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                <Ruler className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Course Review</h2>
                <p className="text-xs text-muted-foreground">Review distances & adjust course</p>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4">
                {/* Leg Breakdown */}
                {courseStats.legs.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <List className="w-4 h-4" />
                        Route Legs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {courseStats.legs.map((leg, index) => {
                        // Calculate wind-relative bearing if wind data available
                        let windRelative: number | null = null;
                        if (windDirection !== undefined) {
                          let rel = leg.bearing - windDirection;
                          while (rel > 180) rel -= 360;
                          while (rel < -180) rel += 360;
                          windRelative = rel;
                        }
                        
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
                            data-testid={`leg-${index}`}
                          >
                            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm">
                                {getSequenceEntryName(leg.from)} → {getSequenceEntryName(leg.to)}
                              </div>
                              <div className="text-xs text-muted-foreground flex gap-2">
                                <span>{leg.bearing.toFixed(0)}°</span>
                                {windRelative !== null && (
                                  <span className="text-amber-600 dark:text-amber-400">
                                    ({windRelative >= 0 ? "+" : ""}{windRelative.toFixed(0)}° to wind)
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium">{leg.distance.toFixed(2)} nm</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Course Statistics */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Course Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Total Distance</p>
                        <p className="text-xl font-bold" data-testid="text-summary-distance">
                          {courseStats.totalDistance.toFixed(2)} nm
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Est. Race Time</p>
                        <p className="text-xl font-bold flex items-center gap-1" data-testid="text-summary-time">
                          <Clock className="w-4 h-4" />
                          {Math.round(courseStats.estimatedTime)} min
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Start Line</p>
                        <p className="text-lg font-semibold">
                          {(courseStats.startLineLength * 1852).toFixed(0)} m
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Finish Line</p>
                        <p className="text-lg font-semibold">
                          {(courseStats.finishLineLength * 1852).toFixed(0)} m
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Marks Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Marks ({marks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {startLineMarks.map(m => (
                        <Badge key={m.id} className="bg-green-500">{m.name}</Badge>
                      ))}
                      {courseMarks.map(m => (
                        <Badge key={m.id} variant="secondary">{m.name}</Badge>
                      ))}
                      {finishLineMarks.filter(m => !m.isStartLine).map(m => (
                        <Badge key={m.id} className="bg-blue-500">{m.name}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Course Transformation Controls */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Move className="w-4 h-4" />
                      Adjust Course
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ scale: 1.1 })}
                        data-testid="button-scale-up"
                      >
                        <Maximize2 className="w-5 h-5" />
                        <span className="text-xs">Larger</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ scale: 0.9 })}
                        data-testid="button-scale-down"
                      >
                        <Maximize2 className="w-5 h-5 rotate-180" />
                        <span className="text-xs">Smaller</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ rotation: -5 })}
                        data-testid="button-rotate-ccw"
                      >
                        <RotateCcw className="w-5 h-5" />
                        <span className="text-xs">-5°</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ rotation: 5 })}
                        data-testid="button-rotate-cw"
                      >
                        <RotateCw className="w-5 h-5" />
                        <span className="text-xs">+5°</span>
                      </Button>
                    </div>
                    
                    {/* Move controls - directional pad */}
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Move Course</p>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onTransformCourse?.({ translateLat: 0.001 })}
                        data-testid="button-move-north"
                      >
                        <ChevronLeft className="w-4 h-4 rotate-90" />
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onTransformCourse?.({ translateLng: -0.001 })}
                          data-testid="button-move-west"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="w-9 h-9 flex items-center justify-center text-xs text-muted-foreground">
                          <Move className="w-4 h-4" />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onTransformCourse?.({ translateLng: 0.001 })}
                          data-testid="button-move-east"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onTransformCourse?.({ translateLat: -0.001 })}
                        data-testid="button-move-south"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </Button>
                    </div>
                    
                    <p className="text-xs text-center text-muted-foreground">
                      Drag marks on the map to reposition them
                    </p>
                  </CardContent>
                </Card>

                {/* Save/Load Course */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save / Load Course
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        className="gap-2"
                        onClick={() => setShowSaveDialog(true)}
                        data-testid="button-save-course"
                      >
                        <Download className="w-4 h-4" />
                        Save Course
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="gap-2"
                        onClick={() => setShowLoadDialog(true)}
                        disabled={savedCourses.length === 0}
                        data-testid="button-load-course"
                      >
                        <Upload className="w-4 h-4" />
                        Load Course
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <div className="pt-4 border-t space-y-3">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase("sequence")}
                  data-testid="button-back-sequence"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 text-lg gap-2"
                  onClick={() => setPhase("assign_buoys")}
                  data-testid="button-continue-buoys"
                >
                  Assign Buoys
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "assign_buoys":
        return (
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <Anchor className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Assign Buoys</h2>
                <p className="text-xs text-muted-foreground">Tap marks to assign robotic buoys</p>
              </div>
              {onAutoAssignBuoys && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAutoAssignBuoys}
                  className="gap-1"
                  data-testid="button-auto-assign-buoys"
                >
                  <Play className="w-4 h-4" />
                  Auto
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-2">
                {marks.map((mark) => {
                  if (mark.isGate) {
                    const portBuoy = buoys.find(b => b.id === mark.gatePortBuoyId);
                    const starboardBuoy = buoys.find(b => b.id === mark.gateStarboardBuoyId);
                    const bothAssigned = portBuoy && starboardBuoy;
                    const partialAssigned = portBuoy || starboardBuoy;
                    
                    return (
                      <div
                        key={mark.id}
                        className={cn(
                          "w-full p-4 rounded-xl space-y-3",
                          bothAssigned ? "bg-green-50 dark:bg-green-900/20" : 
                          partialAssigned ? "bg-amber-50 dark:bg-amber-900/20" : "bg-muted/50"
                        )}
                        data-testid={`gate-assign-${mark.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            bothAssigned ? "bg-green-500 text-white" : 
                            partialAssigned ? "bg-amber-500 text-white" : "bg-muted-foreground/20"
                          )}>
                            {bothAssigned ? <Check className="w-5 h-5" /> : <Anchor className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{mark.name}</p>
                            <p className="text-xs text-orange-600">Gate (2 buoys required)</p>
                          </div>
                          <div className="flex gap-1">
                            {mark.isStartLine && <Badge className="bg-green-500">S</Badge>}
                            {mark.isFinishLine && <Badge className="bg-blue-500">F</Badge>}
                            <Badge className="bg-orange-500">Gate</Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => onMarkSelect?.(`${mark.id}:port`)}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg text-left hover-elevate",
                              portBuoy ? "bg-green-100 dark:bg-green-900/30" : "bg-background"
                            )}
                            data-testid={`button-assign-gate-port-${mark.id}`}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              portBuoy ? "bg-green-500 text-white" : "bg-muted-foreground/20"
                            )}>
                              P
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Port</p>
                              <p className={cn("text-sm font-medium truncate", portBuoy ? "text-green-600" : "text-amber-600")}>
                                {portBuoy ? portBuoy.name : "Tap to assign"}
                              </p>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => onMarkSelect?.(`${mark.id}:starboard`)}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg text-left hover-elevate",
                              starboardBuoy ? "bg-green-100 dark:bg-green-900/30" : "bg-background"
                            )}
                            data-testid={`button-assign-gate-starboard-${mark.id}`}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                              starboardBuoy ? "bg-green-500 text-white" : "bg-muted-foreground/20"
                            )}>
                              S
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">Starboard</p>
                              <p className={cn("text-sm font-medium truncate", starboardBuoy ? "text-green-600" : "text-amber-600")}>
                                {starboardBuoy ? starboardBuoy.name : "Tap to assign"}
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
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
                  onClick={() => setPhase("summary")}
                  data-testid="button-back-summary"
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
                  {getUnassignedCount()} buoy assignments remaining
                </p>
              )}
            </div>
          </div>
        );

      case "ready":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
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
    <div className="h-full flex flex-col overflow-hidden bg-card" data-testid="setup-panel">
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

      {/* Save Course Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Race Course</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter course name..."
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              data-testid="input-course-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCourse} disabled={!courseName.trim()} data-testid="button-confirm-save">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Course Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Race Course</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {savedCourses.length === 0 ? (
              <p className="text-center text-muted-foreground">No saved courses</p>
            ) : (
              savedCourses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleLoadCourse(course.id)}
                  className="w-full p-3 rounded-lg bg-muted/50 hover-elevate text-left"
                  data-testid={`button-load-course-${course.id}`}
                >
                  <p className="font-semibold">{course.name}</p>
                  <p className="text-sm text-muted-foreground">{course.shape}</p>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
