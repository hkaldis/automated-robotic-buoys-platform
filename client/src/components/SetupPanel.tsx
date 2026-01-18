import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronRight, ChevronLeft, Check, Flag, FlagTriangleRight, Play, Pencil, MapPin, Anchor, Ship, Save, RotateCw, RotateCcw, Maximize2, Move, Ruler, Clock, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Event, Buoy, Mark, Course, MarkRole } from "@shared/schema";
import { cn } from "@/lib/utils";

type SetupPhase = "start_line" | "marks" | "finish_line" | "summary" | "assign_buoys" | "ready";

interface SetupPanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  savedCourses?: Course[];
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
}

export function SetupPanel({
  event,
  marks,
  buoys,
  savedCourses = [],
  onMarkSelect,
  onDeployCourse,
  onSaveMark,
  onPlaceMarkOnMap,
  onSaveCourse,
  onLoadCourse,
  onTransformCourse,
  onFinishLinePreview,
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

  // Phase order for comparison - NEW ORDER with summary
  const phaseOrder: SetupPhase[] = ["start_line", "marks", "finish_line", "summary", "assign_buoys", "ready"];
  
  // Get minimum required phase based on completion status - NEW ORDER
  const getMinPhase = (): SetupPhase => {
    if (!hasStartLine) return "start_line";
    if (!hasCourseMarks) return "marks";
    if (!hasFinishLine) return "finish_line";
    // Summary phase is optional - user can proceed after finish line is set
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
  
  // Sync phase with data - only force phase back if current phase is invalid
  // But don't reset from summary/assign_buoys if user explicitly confirmed the finish line
  useEffect(() => {
    const minPhase = getMinPhase();
    const currentIdx = phaseOrder.indexOf(phase);
    const minIdx = phaseOrder.indexOf(minPhase);
    
    // Allow staying in summary/assign_buoys if finish was confirmed by user
    // (even if async mark updates haven't completed yet)
    if (finishConfirmed && (phase === "summary" || phase === "assign_buoys" || phase === "ready")) {
      return;
    }
    
    if (currentIdx > minIdx) {
      setPhase(minPhase);
    }
  }, [hasStartLine, hasCourseMarks, hasFinishLine, allAssigned, phase, finishConfirmed]);

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
    setPhase("summary");
  };

  // Calculate course statistics
  const courseStats = useMemo(() => {
    const startCenter = startLineMarks.length >= 2 ? {
      lat: startLineMarks.reduce((s, m) => s + m.lat, 0) / startLineMarks.length,
      lng: startLineMarks.reduce((s, m) => s + m.lng, 0) / startLineMarks.length,
    } : null;
    
    const finishCenter = finishLineMarks.length >= 2 ? {
      lat: finishLineMarks.reduce((s, m) => s + m.lat, 0) / finishLineMarks.length,
      lng: finishLineMarks.reduce((s, m) => s + m.lng, 0) / finishLineMarks.length,
    } : null;

    const sortedCourseMarks = [...courseMarks].sort((a, b) => a.order - b.order);
    
    // Haversine distance calculation
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 3440.065; // Earth radius in nautical miles
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let totalDistance = 0;
    
    // Start line length
    let startLineLength = 0;
    if (startLineMarks.length >= 2) {
      startLineLength = haversine(startLineMarks[0].lat, startLineMarks[0].lng, startLineMarks[1].lat, startLineMarks[1].lng);
    }

    // Start center to M1
    if (startCenter && sortedCourseMarks.length > 0) {
      totalDistance += haversine(startCenter.lat, startCenter.lng, sortedCourseMarks[0].lat, sortedCourseMarks[0].lng);
    }

    // Between course marks
    for (let i = 0; i < sortedCourseMarks.length - 1; i++) {
      totalDistance += haversine(sortedCourseMarks[i].lat, sortedCourseMarks[i].lng, sortedCourseMarks[i + 1].lat, sortedCourseMarks[i + 1].lng);
    }

    // Last mark to finish center
    if (finishCenter && sortedCourseMarks.length > 0) {
      const lastMark = sortedCourseMarks[sortedCourseMarks.length - 1];
      totalDistance += haversine(lastMark.lat, lastMark.lng, finishCenter.lat, finishCenter.lng);
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
    };
  }, [startLineMarks, finishLineMarks, courseMarks]);

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

  // Updated phases for new order with summary
  const phases = [
    { id: "start_line", label: "Start", number: 1 },
    { id: "marks", label: "Marks", number: 2 },
    { id: "finish_line", label: "Finish", number: 3 },
    { id: "summary", label: "Review", number: 4 },
    { id: "assign_buoys", label: "Buoys", number: 5 },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === phase);

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phase) {
      case "start_line":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
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
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
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
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
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

      case "summary":
        return (
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                <Ruler className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold">Course Summary</h2>
              <p className="text-muted-foreground">
                Review your race course details
              </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4">
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
                  onClick={() => { setFinishConfirmed(false); setPhase("finish_line"); }}
                  data-testid="button-back-finish-summary"
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
          <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden">
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
                  {marks.filter(m => !m.assignedBuoyId).length} marks still need buoys
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
