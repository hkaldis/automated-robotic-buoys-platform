import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Minus, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Check, Flag, FlagTriangleRight, Play, Pencil, MapPin, Anchor, Ship, Save, RotateCw, RotateCcw, Maximize2, Move, Ruler, Clock, Download, Upload, List, X, Undo2, Trash2, AlertTriangle, MoreVertical, FolderOpen, Compass, Navigation, Sailboat, Wind, Radio, Battery, Wifi, Navigation2, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Event, Buoy, Mark, Course, MarkRole, RaceTimeEstimate } from "@shared/schema";
import { cn } from "@/lib/utils";
import { AutoAdjustWizard, OriginalPosition } from "./AutoAdjustWizard";
import { useBoatClass, useBoatClasses, useCourseSnapshots, type CourseSnapshot } from "@/hooks/use-api";
import { estimateRaceTime, buildLegsFromRoundingSequence, estimateLineCrossingTime } from "@/lib/race-time-estimation";
import { calculateWindAngle, formatWindRelative } from "@/lib/course-bearings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import { ALL_SHAPE_TEMPLATES, TRIANGLE_TEMPLATES, TRAPEZOID_TEMPLATES, type ShapeTemplate } from "@/lib/shape-templates";

type SetupPhase = "start_line" | "marks" | "finish_line" | "sequence" | "summary" | "assign_buoys" | "ready";

function calculateStartLineLength(pinMark: Mark | undefined, cbMark: Mark | undefined): number {
  if (!pinMark || !cbMark) return 0;
  const R = 6371e3;
  const lat1 = pinMark.lat * Math.PI / 180;
  const lat2 = cbMark.lat * Math.PI / 180;
  const dLat = (cbMark.lat - pinMark.lat) * Math.PI / 180;
  const dLon = (cbMark.lng - pinMark.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateStartLineBearing(pinMark: Mark | undefined, cbMark: Mark | undefined): number {
  if (!pinMark || !cbMark) return 0;
  const lat1 = pinMark.lat * Math.PI / 180;
  const lat2 = cbMark.lat * Math.PI / 180;
  const dLon = (cbMark.lng - pinMark.lng) * Math.PI / 180;
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = Math.atan2(x, y) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

interface SetupPanelProps {
  event: Event;
  course?: Course | null;
  buoys: Buoy[];
  marks: Mark[];
  roundingSequence?: string[];
  windDirection?: number;
  windSpeed?: number;
  mapBearing?: number; // Current map rotation in degrees (0 = north up)
  onMarkSelect?: (markId: string | null) => void;
  onBuoySelect?: (buoyId: string | null) => void;
  onDeployCourse?: () => void;
  onSaveMark?: (id: string, data: Partial<Mark>) => void | Promise<void>;
  onAddMark?: (data: { name: string; role: MarkRole; lat?: number; lng?: number; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
  onPlaceMarkOnMap?: (data: { name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => void;
  onSaveCourse?: (name: string) => void;
  onLoadCourse?: (snapshot: CourseSnapshot, mode: "exact" | "shape_only") => void;
  mapCenter?: { lat: number; lng: number };
  onTransformCourse?: (transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number }) => void;
  onFinishLinePreview?: (selectedMarkIds: Set<string>) => void;
  onUpdateSequence?: (sequence: string[]) => void;
  onAutoAssignBuoys?: () => void;
  onPhaseChange?: (phase: SetupPhase) => void;
  onClearAllMarks?: () => void;
  onAutoAdjustMark?: (markId: string, lat: number, lng: number) => void;
  onAutoAdjustStartLine?: (pinLat: number, pinLng: number, cbLat: number, cbLng: number) => void;
  onAutoAdjustComplete?: (originalPositions: OriginalPosition[]) => void;
  lastAutoAdjust?: { positions: Array<{ id: string; lat: number; lng: number }>; timestamp: number } | null;
  onUndoAutoAdjust?: () => void;
  moveCourseMode?: boolean;
  onSetMoveCourseMode?: (enabled: boolean) => void;
  onDeleteCourse?: (snapshotId: string) => void;
  onApplyTemplate?: (template: ShapeTemplate) => void;
  externalSaveDialogOpen?: boolean;
  onExternalSaveDialogChange?: (open: boolean) => void;
  externalLoadDialogOpen?: boolean;
  onExternalLoadDialogChange?: (open: boolean) => void;
  onAlignCourseToWind?: () => void;
}

export function SetupPanel({
  event,
  marks,
  buoys,
  roundingSequence = [],
  windDirection,
  windSpeed,
  mapBearing = 0,
  onMarkSelect,
  onBuoySelect,
  onDeployCourse,
  onSaveMark,
  onPlaceMarkOnMap,
  onSaveCourse,
  onLoadCourse,
  mapCenter,
  onTransformCourse,
  onFinishLinePreview,
  onUpdateSequence,
  onAutoAssignBuoys,
  onPhaseChange,
  onClearAllMarks,
  onAutoAdjustMark,
  onAutoAdjustStartLine,
  onAutoAdjustComplete,
  lastAutoAdjust,
  onUndoAutoAdjust,
  moveCourseMode,
  onSetMoveCourseMode,
  onDeleteCourse,
  onApplyTemplate,
  externalSaveDialogOpen,
  onExternalSaveDialogChange,
  externalLoadDialogOpen,
  onExternalLoadDialogChange,
  onAlignCourseToWind,
}: SetupPanelProps) {
  // Fetch boat classes for race time estimation
  const { data: eventBoatClass } = useBoatClass(event.boatClassId);
  const { data: boatClassesData } = useBoatClasses();
  const boatClasses = boatClassesData || [];
  
  // Start line adjustment settings and distance formatting
  const { startLineResizeMode, startLineFixBearingMode, courseAdjustmentSettings, formatDistance } = useSettings();
  
  // Transform visual direction to geographic lat/lng delta based on map bearing
  // When map is rotated, visual "up" is not geographic north
  const getTransformedCourseMove = useCallback((
    visualDirection: "north" | "south" | "east" | "west",
    moveAmount: number
  ): { translateLat: number; translateLng: number } => {
    // Convert visual direction to angle (0 = up/north on screen, clockwise)
    let visualAngle = 0;
    switch (visualDirection) {
      case "north": visualAngle = 0; break;   // Up on screen
      case "east": visualAngle = 90; break;   // Right on screen
      case "south": visualAngle = 180; break; // Down on screen
      case "west": visualAngle = 270; break;  // Left on screen
    }
    
    // Geographic direction = visual direction - map bearing
    // When map is rotated clockwise by B degrees, visual "up" points to geographic (360-B)
    const geoAngle = ((visualAngle - mapBearing) % 360 + 360) % 360;
    const geoAngleRad = (geoAngle * Math.PI) / 180;
    
    // Convert angle to lat/lng delta
    // 0° = North (+lat), 90° = East (+lng), 180° = South (-lat), 270° = West (-lng)
    const translateLat = moveAmount * Math.cos(geoAngleRad);
    const translateLng = moveAmount * Math.sin(geoAngleRad);
    
    return { translateLat, translateLng };
  }, [mapBearing]);
  
  // Allow override of boat class in Review phase for quick at-sea comparisons
  // Initialize to event's boat class ID so dropdown shows event's selection by default
  const [boatClassOverrideId, setBoatClassOverrideId] = useState<string>(event.boatClassId || "");
  
  // Update override when event's boat class changes
  useEffect(() => {
    if (event.boatClassId && !boatClassOverrideId) {
      setBoatClassOverrideId(event.boatClassId);
    }
  }, [event.boatClassId, boatClassOverrideId]);
  
  const overrideBoatClass = boatClasses.find(bc => bc.id === boatClassOverrideId);
  const boatClass = overrideBoatClass || eventBoatClass;
  
  // Categorize marks
  const startLineMarks = useMemo(() => marks.filter(m => m.isStartLine), [marks]);
  const finishLineMarks = useMemo(() => marks.filter(m => m.isFinishLine), [marks]);
  const courseMarks = useMemo(() => 
    marks.filter(m => m.isCourseMark === true).sort((a, b) => a.order - b.order), 
  [marks]);
  
  // Phase completion checks - NEW ORDER: start_line → marks → finish_line → assign_buoys
  const hasStartLine = startLineMarks.length >= 2;
  const hasCourseMarks = courseMarks.length >= 1;
  const hasFinishLine = finishLineMarks.length >= 2;
  
  // Check if start and finish lines share the same marks (common in short courses)
  const hasSharedStartFinishMarks = startLineMarks.some(m => m.isFinishLine);
  
  // Check if all buoys are assigned (gates need 2 buoys, regular marks need 1)
  const allAssigned = marks.length > 0 && marks.every(m => {
    if (m.isGate) {
      return m.gatePortBuoyId && m.gateStarboardBuoyId;
    }
    return m.assignedBuoyId;
  });
  
  // Timer state to force re-render for undo button expiry
  const [, setUndoTick] = useState(0);
  
  // Effect to auto-hide undo button after 60 seconds
  useEffect(() => {
    if (!lastAutoAdjust) return;
    
    const remainingTime = 60000 - (Date.now() - lastAutoAdjust.timestamp);
    if (remainingTime <= 0) return;
    
    const timer = setTimeout(() => {
      setUndoTick((t) => t + 1); // Force re-render to hide button
    }, remainingTime);
    
    return () => clearTimeout(timer);
  }, [lastAutoAdjust]);
  
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

  // State for save course dialog - supports external control from TopBar
  const [internalShowSaveDialog, setInternalShowSaveDialog] = useState(false);
  const showSaveDialog = externalSaveDialogOpen ?? internalShowSaveDialog;
  const setShowSaveDialog = (open: boolean) => {
    if (onExternalSaveDialogChange) {
      onExternalSaveDialogChange(open);
    } else {
      setInternalShowSaveDialog(open);
    }
  };
  const [courseName, setCourseName] = useState("");
  
  // State for load course dialog - supports external control from TopBar
  const [internalShowLoadDialog, setInternalShowLoadDialog] = useState(false);
  const showLoadDialog = externalLoadDialogOpen ?? internalShowLoadDialog;
  const setShowLoadDialog = (open: boolean) => {
    if (onExternalLoadDialogChange) {
      onExternalLoadDialogChange(open);
    } else {
      setInternalShowLoadDialog(open);
    }
  };

  const [phase, setPhase] = useState<SetupPhase>(getMinPhase);
  const [selectedLineMarkIds, setSelectedLineMarkIds] = useState<Set<string>>(new Set());
  const [finishConfirmed, setFinishConfirmed] = useState(false);
  const [pendingFinishUpdate, setPendingFinishUpdate] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showAutoAdjustDialog, setShowAutoAdjustDialog] = useState(false);
  const [showCourseCoordinatesDialog, setShowCourseCoordinatesDialog] = useState(false);
  const [courseCoordLat, setCourseCoordLat] = useState("");
  const [courseCoordLng, setCourseCoordLng] = useState("");
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  const [legsExpanded, setLegsExpanded] = useState(false);
  const [courseDetailsOpen, setCourseDetailsOpen] = useState(false);
  
  // Track all current mark IDs for reconciliation
  const currentMarkIds = useMemo(() => new Set(marks.map(m => m.id)), [marks]);
  
  // Clear pendingFinishUpdate when marks actually reflect the finish line (data-driven, not timeout-driven)
  useEffect(() => {
    if (pendingFinishUpdate && finishConfirmed && hasFinishLine) {
      // React Query has caught up - finish line marks are now reflected in data
      setPendingFinishUpdate(false);
    }
  }, [pendingFinishUpdate, finishConfirmed, hasFinishLine]);
  
  // Reset finishConfirmed when finish marks are lost - but only if we're back in finish_line phase
  // This prevents race condition where React Query refetch is slower than the pendingFinishUpdate timeout
  useEffect(() => {
    if (finishConfirmed && !hasFinishLine && !pendingFinishUpdate && phase === "finish_line") {
      setFinishConfirmed(false);
    }
  }, [finishConfirmed, hasFinishLine, pendingFinishUpdate, phase]);
  
  // Reconcile selectedLineMarkIds with current marks - prune deleted mark IDs
  useEffect(() => {
    setSelectedLineMarkIds(prev => {
      const pruned = new Set(Array.from(prev).filter(id => currentMarkIds.has(id)));
      if (pruned.size !== prev.size) {
        return pruned;
      }
      return prev;
    });
  }, [currentMarkIds]);
  
  // Notify parent of phase changes
  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);
  
  // Sync phase with data - only force phase back if current phase is invalid
  // But don't reset from later phases if user has progressed through the workflow
  // Fleet ("ready") phase is always accessible - it's independent of the course setup workflow
  useEffect(() => {
    // Don't sync phase during pending finish update to avoid oscillation
    if (pendingFinishUpdate) return;
    
    // Fleet view is always accessible - never auto-reset from it
    if (phase === "ready") return;
    
    const minPhase = getMinPhase();
    const currentIdx = phaseOrder.indexOf(phase);
    const minIdx = phaseOrder.indexOf(minPhase);
    
    // Allow staying in sequence/summary/assign_buoys if:
    // 1. User confirmed finish line (async mark updates may still be pending)
    // 2. User has a valid sequence (means they've progressed through the workflow)
    // For shared start/finish marks, we need confirmation OR valid finish line
    const canStayInLaterPhase = finishConfirmed || hasSequence || (hasSharedStartFinishMarks && hasFinishLine);
    if (canStayInLaterPhase && (phase === "sequence" || phase === "summary" || phase === "assign_buoys")) {
      // Only reset if we've truly lost essential prerequisites
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
  }, [hasStartLine, hasCourseMarks, hasFinishLine, hasSequence, allAssigned, phase, finishConfirmed, hasSharedStartFinishMarks, pendingFinishUpdate]);

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

  const confirmFinishLineSelection = async () => {
    // Set pending flag to prevent phase sync oscillation during async updates
    setPendingFinishUpdate(true);
    
    try {
      // Batch all mark updates
      const updates: Promise<void>[] = [];
      marks.forEach(mark => {
        const isSelected = selectedLineMarkIds.has(mark.id);
        const wasFinishLine = mark.isFinishLine;
        const wasCourseMarkOnly = mark.isCourseMark && !mark.isStartLine && !mark.isFinishLine;
        
        if (wasFinishLine !== isSelected) {
          // Build the update data
          const updateData: Partial<Mark> = { isFinishLine: isSelected };
          
          if (isSelected) {
            // When selecting a mark for finish line:
            // - If it was a course mark (not start line), convert it to a finish line mark
            if (wasCourseMarkOnly) {
              updateData.role = "finish";
              updateData.isCourseMark = false;
            }
            // If it's a start line mark being reused, keep its role but add finish line flag
          } else {
            // When deselecting a finish line mark:
            // - If the mark has role="finish" (pure finish line mark, not shared with start)
            //   we need to convert it back to a turning_mark if it was converted from course mark
            // - For marks that were originally "finish" role (placed as finish), convert to turning_mark
            if (mark.role === "finish" && !mark.isStartLine) {
              updateData.role = "turning_mark";
              updateData.isCourseMark = true;
            }
          }
          
          // onSaveMark may return a promise
          const result = onSaveMark?.(mark.id, updateData);
          if (result instanceof Promise) {
            updates.push(result);
          }
        }
      });
      
      // Wait for all updates to complete
      if (updates.length > 0) {
        await Promise.all(updates);
      }
      
      setFinishConfirmed(true);
      setPhase("sequence");
      // pendingFinishUpdate will be cleared data-driven when hasFinishLine becomes true
      // See the useEffect that monitors hasFinishLine state
    } catch (error) {
      // On error, reset pending flag immediately
      setPendingFinishUpdate(false);
    }
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
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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
  
  // VMG-based race time estimation using boat class performance data
  const raceTimeEstimate = useMemo((): RaceTimeEstimate | null => {
    if (!boatClass || !roundingSequence.length || windSpeed === undefined || windDirection === undefined) {
      return null;
    }
    
    const startCenter = startLineMarks.length >= 2 ? {
      lat: startLineMarks.reduce((s, m) => s + m.lat, 0) / startLineMarks.length,
      lng: startLineMarks.reduce((s, m) => s + m.lng, 0) / startLineMarks.length,
    } : undefined;
    
    const legs = buildLegsFromRoundingSequence(roundingSequence, marks, startCenter);
    if (legs.length === 0) return null;
    
    return estimateRaceTime(legs, boatClass, windSpeed, windDirection);
  }, [boatClass, roundingSequence, marks, startLineMarks, windSpeed, windDirection]);
  
  // Calculate start line crossing time
  const startLineCrossingTime = useMemo(() => {
    if (!boatClass || startLineMarks.length < 2 || windSpeed === undefined || windDirection === undefined) {
      return null;
    }
    
    const cbMark = startLineMarks.find(m => m.role === "start_boat");
    const pinMarkFound = startLineMarks.find(m => m.role === "pin");
    
    if (!cbMark || !pinMarkFound) return null;
    
    return estimateLineCrossingTime(
      { lat: cbMark.lat, lng: cbMark.lng },
      { lat: pinMarkFound.lat, lng: pinMarkFound.lng },
      boatClass,
      windSpeed,
      windDirection
    );
  }, [boatClass, startLineMarks, windSpeed, windDirection]);
  
  // Format leg time for display
  const formatLegTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (minutes === 0) return `${secs}s`;
    return `${minutes}m ${secs}s`;
  };
  
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

  // State for load course selection
  const [selectedLoadCourse, setSelectedLoadCourse] = useState<CourseSnapshot | null>(null);
  const [snapshotSearch, setSnapshotSearch] = useState("");
  
  // Fetch course snapshots with search filter
  const { data: snapshotsData, isLoading: isLoadingSnapshots } = useCourseSnapshots({
    search: snapshotSearch || undefined,
    limit: 50,
  });
  const snapshots = snapshotsData?.snapshots || [];
  
  const handleLoadCourse = (mode: "exact" | "shape_only") => {
    if (selectedLoadCourse) {
      onLoadCourse?.(selectedLoadCourse, mode);
      setShowLoadDialog(false);
      setSelectedLoadCourse(null);
    }
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

  // Get pin and committee boat marks for start line operations
  const pinMark = useMemo(() => startLineMarks.find(m => m.role === "pin"), [startLineMarks]);
  const committeeMark = useMemo(() => startLineMarks.find(m => m.role === "start_boat"), [startLineMarks]);
  const startLineLength = useMemo(() => calculateStartLineLength(pinMark, committeeMark), [pinMark, committeeMark]);

  // Resize start line (make bigger or smaller)
  const handleResizeStartLine = useCallback((increase: boolean) => {
    if (!pinMark || !committeeMark) return;
    
    const scaleFactor = increase ? (1 + courseAdjustmentSettings.resizePercent / 100) : (1 - courseAdjustmentSettings.resizePercent / 100);
    const centerLat = (pinMark.lat + committeeMark.lat) / 2;
    const centerLng = (pinMark.lng + committeeMark.lng) / 2;
    
    if (startLineResizeMode === "both") {
      const newPinLat = centerLat + (pinMark.lat - centerLat) * scaleFactor;
      const newPinLng = centerLng + (pinMark.lng - centerLng) * scaleFactor;
      const newCbLat = centerLat + (committeeMark.lat - centerLat) * scaleFactor;
      const newCbLng = centerLng + (committeeMark.lng - centerLng) * scaleFactor;
      onSaveMark?.(pinMark.id, { lat: newPinLat, lng: newPinLng });
      onSaveMark?.(committeeMark.id, { lat: newCbLat, lng: newCbLng });
    } else if (startLineResizeMode === "pin") {
      const newPinLat = committeeMark.lat + (pinMark.lat - committeeMark.lat) * scaleFactor;
      const newPinLng = committeeMark.lng + (pinMark.lng - committeeMark.lng) * scaleFactor;
      onSaveMark?.(pinMark.id, { lat: newPinLat, lng: newPinLng });
    } else {
      const newCbLat = pinMark.lat + (committeeMark.lat - pinMark.lat) * scaleFactor;
      const newCbLng = pinMark.lng + (committeeMark.lng - pinMark.lng) * scaleFactor;
      onSaveMark?.(committeeMark.id, { lat: newCbLat, lng: newCbLng });
    }
  }, [pinMark, committeeMark, startLineResizeMode, onSaveMark, courseAdjustmentSettings.resizePercent]);

  // Fix bearing to be perpendicular to wind using geodesic destination-point formula
  const handleFixBearing = useCallback(() => {
    if (!pinMark || !committeeMark || windDirection === undefined) return;
    
    const distanceM = startLineLength;
    // Current bearing from committee boat TO pin (direction we need to preserve)
    const bearingPinToCommittee = calculateStartLineBearing(pinMark, committeeMark);
    const bearingCommitteeToPin = (bearingPinToCommittee + 180) % 360;
    
    // Choose which perpendicular bearing is closer to current (preserves pin's relative position)
    const option1 = (windDirection + 90 + 360) % 360;
    const option2 = (windDirection - 90 + 360) % 360;
    
    // Calculate angular difference (0-180 range)
    const angleDiff = (a: number, b: number) => {
      let diff = Math.abs(a - b) % 360;
      return diff > 180 ? 360 - diff : diff;
    };
    
    const delta1 = angleDiff(bearingCommitteeToPin, option1);
    const delta2 = angleDiff(bearingCommitteeToPin, option2);
    const targetBearing = delta1 <= delta2 ? option1 : option2;
    
    const R = 6371e3;
    
    if (startLineFixBearingMode === "pin") {
      const lat1 = committeeMark.lat * Math.PI / 180;
      const lng1 = committeeMark.lng * Math.PI / 180;
      const brng = targetBearing * Math.PI / 180;
      const angularDist = distanceM / R;
      
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(angularDist) +
        Math.cos(lat1) * Math.sin(angularDist) * Math.cos(brng)
      );
      const lng2 = lng1 + Math.atan2(
        Math.sin(brng) * Math.sin(angularDist) * Math.cos(lat1),
        Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
      );
      
      onSaveMark?.(pinMark.id, { 
        lat: lat2 * 180 / Math.PI, 
        lng: lng2 * 180 / Math.PI 
      });
    } else {
      const reverseBearing = (targetBearing + 180) % 360;
      const lat1 = pinMark.lat * Math.PI / 180;
      const lng1 = pinMark.lng * Math.PI / 180;
      const brng = reverseBearing * Math.PI / 180;
      const angularDist = distanceM / R;
      
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(angularDist) +
        Math.cos(lat1) * Math.sin(angularDist) * Math.cos(brng)
      );
      const lng2 = lng1 + Math.atan2(
        Math.sin(brng) * Math.sin(angularDist) * Math.cos(lat1),
        Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
      );
      
      onSaveMark?.(committeeMark.id, { 
        lat: lat2 * 180 / Math.PI, 
        lng: lng2 * 180 / Math.PI 
      });
    }
  }, [pinMark, committeeMark, windDirection, startLineLength, startLineFixBearingMode, onSaveMark]);

  // Nudge entire start line (move both marks together) - uses map bearing for correct screen direction
  const handleNudgeStartLine = useCallback((direction: "north" | "south" | "east" | "west") => {
    if (!pinMark || !committeeMark) return;
    
    // Use 10 meter nudge (~0.00009 degrees at typical latitudes)
    const nudgeAmount = 0.00009;
    const { translateLat, translateLng } = getTransformedCourseMove(direction, nudgeAmount);
    
    onSaveMark?.(pinMark.id, { lat: pinMark.lat + translateLat, lng: pinMark.lng + translateLng });
    onSaveMark?.(committeeMark.id, { lat: committeeMark.lat + translateLat, lng: committeeMark.lng + translateLng });
  }, [pinMark, committeeMark, onSaveMark, getTransformedCourseMove]);

  // Move course to GPS position (places committee boat at current position)
  const handleMoveCourseToGPS = useCallback(() => {
    if (!committeeMark || !navigator.geolocation) return;
    
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const translateLat = newLat - committeeMark.lat;
        const translateLng = newLng - committeeMark.lng;
        onTransformCourse?.({ translateLat, translateLng });
        setIsGpsLocating(false);
      },
      (error) => {
        console.error("GPS error:", error);
        setIsGpsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [committeeMark, onTransformCourse]);

  // Move course to specific coordinates (places committee boat at given position)
  const handleMoveCourseToCoordinates = useCallback((lat: number, lng: number) => {
    if (!committeeMark) return;
    const translateLat = lat - committeeMark.lat;
    const translateLng = lng - committeeMark.lng;
    onTransformCourse?.({ translateLat, translateLng });
  }, [committeeMark, onTransformCourse]);

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
      role: "finish" as MarkRole,
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
    { id: "marks", label: "Points", number: 2 },
    { id: "finish_line", label: "Finish", number: 3 },
    { id: "sequence", label: "Route", number: 4 },
    { id: "summary", label: "Course", number: 5 },
    { id: "assign_buoys", label: "Assign", number: 6 },
    { id: "ready", label: "Fleet", number: 7 },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === phase);

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phase) {
      case "start_line":
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                <Flag className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Start Line</h2>
                <p className="text-xs text-muted-foreground">Add Pin End & Committee Boat</p>
              </div>
            </div>

            <div className="space-y-2">
              {/* Committee Boat row - use committeeMark directly for consistent detection */}
              <div className="flex items-center gap-2">
                <Button
                  variant={committeeMark ? "secondary" : "default"}
                  className={cn(
                    "flex-1 gap-2 justify-start",
                    committeeMark && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  )}
                  onClick={() => committeeMark ? onMarkSelect?.(committeeMark.id) : handleAddStartLineMark("committee_boat")}
                  data-testid="button-add-committee-boat"
                >
                  {committeeMark ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Ship className="w-4 h-4" />
                  )}
                  Committee Boat
                </Button>
                {committeeMark && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onMarkSelect?.(committeeMark.id)}
                    data-testid="button-edit-committee-boat"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Pin End row - use pinMark directly for consistent detection */}
              <div className="flex items-center gap-2">
                <Button
                  variant={pinMark ? "secondary" : "default"}
                  className={cn(
                    "flex-1 gap-2 justify-start",
                    pinMark && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  )}
                  onClick={() => pinMark ? onMarkSelect?.(pinMark.id) : handleAddStartLineMark("pin")}
                  data-testid="button-add-pin-end"
                >
                  {pinMark ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Pin End
                </Button>
                {pinMark && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onMarkSelect?.(pinMark.id)}
                    data-testid="button-edit-pin-end"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {hasStartLine && (
              <div className="space-y-3 pt-2">
                {/* Move Start Line controls */}
                <div className="p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Move className="w-3 h-3" />
                    Move Start Line
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <Button 
                      variant="outline" 
                      className="h-10 w-10 p-0" 
                      onClick={() => handleNudgeStartLine("west")} 
                      data-testid="button-nudge-startline-west"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col gap-1">
                      <Button 
                        variant="outline" 
                        className="h-10 w-10 p-0" 
                        onClick={() => handleNudgeStartLine("north")} 
                        data-testid="button-nudge-startline-north"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-10 w-10 p-0" 
                        onClick={() => handleNudgeStartLine("south")} 
                        data-testid="button-nudge-startline-south"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-10 w-10 p-0" 
                      onClick={() => handleNudgeStartLine("east")} 
                      data-testid="button-nudge-startline-east"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Line Length widget */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Line Length</p>
                    <p className="text-sm font-semibold">{startLineLength.toFixed(0)} m</p>
                    {boatClass?.lengthMeters && (
                      <p className="text-xs text-muted-foreground">
                        ({(startLineLength / boatClass.lengthMeters).toFixed(1)} boat lengths)
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleResizeStartLine(false)}
                      data-testid="button-shrink-line"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleResizeStartLine(true)}
                      data-testid="button-grow-line"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {startLineCrossingTime && (
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Crossing time
                    </p>
                    <p className="text-sm font-semibold">{startLineCrossingTime.timeFormatted}</p>
                    <p className="text-xs text-muted-foreground">
                      ({startLineCrossingTime.pointOfSail.replace("_", " ")} @ {windSpeed?.toFixed(0) ?? "?"} kts wind)
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleFixBearing}
                  disabled={windDirection === undefined}
                  data-testid="button-fix-bearing"
                >
                  <Compass className="w-4 h-4" />
                  Fix Bearing to Wind
                </Button>
              </div>
            )}

            <div className="pt-3 border-t mt-auto">
              <Button
                className="w-full gap-2"
                disabled={!hasStartLine}
                onClick={() => setPhase("marks")}
                data-testid="button-continue-marks"
              >
                Continue to Course Points
                <ChevronRight className="w-4 h-4" />
              </Button>
              {!hasStartLine && (
                <p className="text-center text-xs text-muted-foreground mt-1.5">
                  Add both points to continue
                </p>
              )}
            </div>
          </div>
        );

      case "marks":
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Course Points</h2>
                <p className="text-xs text-muted-foreground">Add points or use a template</p>
              </div>
            </div>

            {courseMarks.length === 0 && onApplyTemplate && windDirection !== undefined && (
              <div className="space-y-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Quick Start with Template</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Triangles</p>
                    {TRIANGLE_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 h-9 text-xs"
                        onClick={() => onApplyTemplate(template)}
                        data-testid={`button-template-${template.id}`}
                      >
                        <span className="truncate">{template.name.replace("Triangle ", "")}</span>
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Trapezoids</p>
                    {TRAPEZOID_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 h-9 text-xs"
                        onClick={() => onApplyTemplate(template)}
                        data-testid={`button-template-${template.id}`}
                      >
                        <span className="truncate">{template.name.replace("Trapezoid ", "")}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Marks placed relative to wind - adjust with drag or "Adjust to Shape"</p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleAddCourseMark}
              data-testid="button-add-course-mark"
            >
              <Plus className="w-4 h-4" />
              Add Course Point (M{courseMarks.length + 1})
            </Button>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1.5">
                {courseMarks.map((mark, index) => (
                  <button
                    key={mark.id}
                    onClick={() => onMarkSelect?.(mark.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover-elevate text-left"
                    data-testid={`button-course-mark-${mark.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      M{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mark.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {mark.lat.toFixed(4)}, {mark.lng.toFixed(4)}
                      </p>
                    </div>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
                {courseMarks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No course points yet</p>
                    <p className="text-xs">Tap the button above to add points</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-3 border-t space-y-2 mt-auto">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setPhase("start_line")}
                  data-testid="button-back-start"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!hasCourseMarks}
                  onClick={() => { setFinishConfirmed(false); setPhase("finish_line"); }}
                  data-testid="button-continue-finish"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {!hasCourseMarks && (
                <p className="text-center text-xs text-muted-foreground">
                  Add at least 1 course point to continue
                </p>
              )}
            </div>
          </div>
        );

      case "finish_line":
        const canConfirmFinish = selectedLineMarkIds.size >= 2;
        
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                <FlagTriangleRight className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Finish Line</h2>
                <p className="text-xs text-muted-foreground">Select 2 marks (can reuse start marks)</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleAddFinishMark}
              data-testid="button-add-finish-mark"
            >
              <Plus className="w-4 h-4" />
              Add New Finish Mark
            </Button>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Select any 2 marks for the finish line:
                </p>
                {[...marks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((mark) => {
                  const isSelected = selectedLineMarkIds.has(mark.id);
                  const isStartLineMark = mark.isStartLine;
                  return (
                    <button
                      key={mark.id}
                      onClick={() => toggleMarkSelection(mark.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                        isSelected
                          ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500"
                          : "bg-muted/50 hover-elevate"
                      )}
                      data-testid={`button-select-finish-mark-${mark.id}`}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center border-2",
                        isSelected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-background border-muted-foreground/30"
                      )}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{mark.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {mark.isCourseMark ? "Course Point" : mark.role}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {isStartLineMark && (
                          <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-600">S</Badge>
                        )}
                        {isSelected && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-600">F</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {canConfirmFinish && courseStats.finishLineLength > 0 && (
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-xs text-muted-foreground">Line Length</p>
                <p className="text-sm font-semibold">{(courseStats.finishLineLength * 1852).toFixed(0)} m</p>
                {boatClass?.lengthMeters && (
                  <p className="text-xs text-muted-foreground">
                    ({((courseStats.finishLineLength * 1852) / boatClass.lengthMeters).toFixed(1)} boat lengths)
                  </p>
                )}
              </div>
            )}

            <div className="pt-3 border-t space-y-2 mt-auto">
              {!canConfirmFinish && (
                <p className="text-center text-xs text-amber-600 font-medium">
                  Select at least 2 marks for the finish line
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setPhase("marks")}
                  data-testid="button-back-marks"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!canConfirmFinish}
                  onClick={confirmFinishLineSelection}
                  data-testid="button-confirm-finish"
                >
                  <Check className="w-4 h-4" />
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        );

      case "sequence":
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30">
                <List className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Set Route</h2>
                <p className="text-xs text-muted-foreground">Tap marks in rounding order</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tap to add:</p>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={roundingSequence.includes("start") ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={() => addToSequence("start")}
                  data-testid="button-add-start-to-sequence"
                >
                  <Flag className="w-3 h-3 text-green-600" />
                  Start
                </Button>
                {courseMarks.map(mark => (
                  <Button
                    key={mark.id}
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => addToSequence(mark.id)}
                    data-testid={`button-add-mark-${mark.id}-to-sequence`}
                  >
                    <MapPin className="w-3 h-3" />
                    {mark.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={roundingSequence.includes("finish") ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={() => addToSequence("finish")}
                  data-testid="button-add-finish-to-sequence"
                >
                  <FlagTriangleRight className="w-3 h-3 text-blue-600" />
                  Finish
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Route ({roundingSequence.length} waypoints)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={undoLastSequence}
                      disabled={roundingSequence.length === 0}
                      data-testid="button-undo-sequence"
                    >
                      <Undo2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={clearSequence}
                      disabled={roundingSequence.length === 0}
                      data-testid="button-clear-sequence"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {roundingSequence.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg">
                    <p className="text-sm">No waypoints added yet.</p>
                    <p className="text-xs mt-1">Tap "Start" to begin.</p>
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
                            "flex items-center gap-2 p-2 rounded-md",
                            isStart ? "bg-green-50 dark:bg-green-900/20" :
                            isFinish ? "bg-blue-50 dark:bg-blue-900/20" :
                            "bg-muted/50"
                          )}
                          data-testid={`sequence-item-${index}`}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            isStart ? "bg-green-500 text-white" :
                            isFinish ? "bg-blue-500 text-white" :
                            "bg-muted-foreground/20"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            {legDistance !== null && legDistance !== undefined && (
                              <p className="text-[10px] text-muted-foreground">
                                {formatDistance(legDistance)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFromSequence(index)}
                            data-testid={`button-remove-sequence-${index}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {roundingSequence.length >= 2 && (
                  <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-md">
                    <p className="text-xs font-medium">Total Distance</p>
                    <p className="text-lg font-bold" data-testid="text-sequence-total">
                      {formatDistance(courseStats.totalDistance)}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="pt-3 border-t space-y-2 mt-auto">
              {roundingSequence.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={autoGenerateSequence}
                  data-testid="button-auto-sequence"
                >
                  <Play className="w-3 h-3" />
                  Auto-Generate Simple Route
                </Button>
              )}
              {roundingSequence.length > 0 && (
                <>
                  {!roundingSequence.includes("start") && (
                    <p className="text-center text-amber-600 text-xs">Route must include Start</p>
                  )}
                  {!roundingSequence.includes("finish") && (
                    <p className="text-center text-amber-600 text-xs">Route must include Finish</p>
                  )}
                  {roundingSequence.includes("start") && roundingSequence.includes("finish") && 
                   roundingSequence.filter(e => e !== "start" && e !== "finish").length === 0 && (
                    <p className="text-center text-amber-600 text-xs">Add at least one course point</p>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => { setFinishConfirmed(false); setPhase("finish_line"); }}
                  data-testid="button-back-finish"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
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
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "summary":
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                <Ruler className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Course</h2>
                <p className="text-xs text-muted-foreground">Review distances & adjust course</p>
              </div>
            </div>

            {/* Quick Estimate - Compact boxes */}
            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
              <div className="bg-primary/10 border border-primary/20 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Distance</p>
                <p className="text-lg font-bold" data-testid="text-summary-distance">
                  {formatDistance(courseStats.totalDistance)}
                </p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  Est. Time
                </p>
                <p className="text-lg font-bold" data-testid="text-summary-time">
                  {raceTimeEstimate 
                    ? raceTimeEstimate.totalTimeFormatted
                    : `${Math.round(courseStats.estimatedTime)} min`
                  }
                </p>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3">
                {/* Course Transformation Controls - First */}
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
                        onClick={() => onTransformCourse?.({ scale: 1 + courseAdjustmentSettings.resizePercent / 100 })}
                        data-testid="button-scale-up"
                      >
                        <Maximize2 className="w-5 h-5" />
                        <span className="text-xs">+{courseAdjustmentSettings.resizePercent}%</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ scale: 1 - courseAdjustmentSettings.resizePercent / 100 })}
                        data-testid="button-scale-down"
                      >
                        <Maximize2 className="w-5 h-5 rotate-180" />
                        <span className="text-xs">-{courseAdjustmentSettings.resizePercent}%</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ rotation: -courseAdjustmentSettings.rotationDegrees })}
                        data-testid="button-rotate-ccw"
                      >
                        <RotateCcw className="w-5 h-5" />
                        <span className="text-xs">-{courseAdjustmentSettings.rotationDegrees}°</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="flex-col gap-1 h-auto py-3"
                        onClick={() => onTransformCourse?.({ rotation: courseAdjustmentSettings.rotationDegrees })}
                        data-testid="button-rotate-cw"
                      >
                        <RotateCw className="w-5 h-5" />
                        <span className="text-xs">+{courseAdjustmentSettings.rotationDegrees}°</span>
                      </Button>
                    </div>
                    
                    {/* Move controls - directional pad */}
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onTransformCourse?.(getTransformedCourseMove("north", 0.001))}
                        data-testid="button-move-north"
                      >
                        <ChevronLeft className="w-4 h-4 rotate-90" />
                      </Button>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onTransformCourse?.(getTransformedCourseMove("west", 0.001))}
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
                          onClick={() => onTransformCourse?.(getTransformedCourseMove("east", 0.001))}
                          data-testid="button-move-east"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onTransformCourse?.(getTransformedCourseMove("south", 0.001))}
                        data-testid="button-move-south"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </Button>
                    </div>
                    
                    {/* Tap to Move, GPS, and Coordinates - 3 icon buttons */}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant={moveCourseMode ? "default" : "outline"}
                        size="icon"
                        onClick={() => onSetMoveCourseMode?.(!moveCourseMode)}
                        title="Tap to Move"
                        data-testid="button-tap-to-move"
                      >
                        <Navigation2 className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleMoveCourseToGPS}
                        disabled={isGpsLocating || !committeeMark}
                        title="Move to GPS"
                        data-testid="button-course-to-gps"
                      >
                        <Crosshair className={`w-5 h-5 ${isGpsLocating ? 'animate-pulse' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (committeeMark) {
                            setCourseCoordLat(committeeMark.lat.toString());
                            setCourseCoordLng(committeeMark.lng.toString());
                          }
                          setShowCourseCoordinatesDialog(true);
                        }}
                        disabled={!committeeMark}
                        title="Enter Coordinates"
                        data-testid="button-course-to-coordinates"
                      >
                        <MapPin className="w-5 h-5" />
                      </Button>
                    </div>
                    
                    <p className="text-xs text-center text-muted-foreground">
                      {moveCourseMode 
                        ? "Tap anywhere on the map to relocate the course"
                        : "Committee boat moves to position, rest follows"
                      }
                    </p>
                    
                    {windDirection !== undefined && (onAutoAdjustMark || onAlignCourseToWind) && (
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant="default"
                            className="gap-1"
                            onClick={() => setShowAutoAdjustDialog(true)}
                            disabled={!onAutoAdjustMark || !onAutoAdjustStartLine || !onAutoAdjustComplete}
                            data-testid="button-points-to-wind"
                          >
                            <Compass className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">Marks</span>
                          </Button>
                          <Button
                            variant="default"
                            className="gap-1"
                            onClick={onAlignCourseToWind}
                            disabled={!onAlignCourseToWind}
                            data-testid="button-course-to-wind"
                          >
                            <Wind className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">Align</span>
                          </Button>
                        </div>
                        
                        {lastAutoAdjust && onUndoAutoAdjust && (Date.now() - lastAutoAdjust.timestamp) < 60000 && (
                          <Button
                            variant="outline"
                            className="w-full gap-2 border-orange-500 text-orange-600"
                            onClick={onUndoAutoAdjust}
                            data-testid="button-undo-auto-adjust"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Undo
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Course Details - Collapsible (default closed) */}
                <Collapsible open={courseDetailsOpen} onOpenChange={setCourseDetailsOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader 
                        className="pb-2 cursor-pointer hover-elevate rounded-t-lg min-h-12"
                        data-testid="button-toggle-course-details"
                      >
                        <CardTitle className="text-base flex items-center gap-2">
                          <List className="w-4 h-4" />
                          <span className="flex-1">Course Details</span>
                          <ChevronDown className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            courseDetailsOpen && "rotate-180"
                          )} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-3 pt-0">
                        {/* Boat Class Selector */}
                        <div className="flex items-center gap-2">
                          <Sailboat className="w-4 h-4 text-muted-foreground" />
                          <Select 
                            value={boatClassOverrideId || event.boatClassId || ""} 
                            onValueChange={setBoatClassOverrideId}
                          >
                            <SelectTrigger className="flex-1 min-h-10" data-testid="select-boat-class-override">
                              <SelectValue placeholder="Select boat class" />
                            </SelectTrigger>
                            <SelectContent className="z-[10000] max-h-60">
                              {[...boatClasses].sort((a, b) => a.name.localeCompare(b.name)).map((bc) => (
                                <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Route Legs */}
                        {courseStats.legs.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Route Legs ({courseStats.legs.length})</p>
                            {courseStats.legs.map((leg, index) => {
                              const windAngle = windDirection !== undefined 
                                ? calculateWindAngle(leg.bearing, windDirection)
                                : null;
                              const legEstimate = raceTimeEstimate?.legs[index];
                              
                              return (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg"
                                  data-testid={`leg-${index}`}
                                >
                                  <div className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs truncate">
                                      {getSequenceEntryName(leg.from)} → {getSequenceEntryName(leg.to)}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                                      <span>{leg.bearing.toFixed(0)}°</span>
                                      {legEstimate && (
                                        <Badge 
                                          variant="outline" 
                                          className={cn(
                                            "text-[10px] px-1 py-0",
                                            legEstimate.pointOfSail === "upwind" && "border-red-400 text-red-600 dark:text-red-400",
                                            legEstimate.pointOfSail === "downwind" && "border-blue-400 text-blue-600 dark:text-blue-400",
                                            (legEstimate.pointOfSail === "beam_reach" || legEstimate.pointOfSail === "close_reach" || legEstimate.pointOfSail === "broad_reach") && "border-green-400 text-green-600 dark:text-green-400"
                                          )}
                                        >
                                          {legEstimate.pointOfSail.replace("_", " ")}
                                        </Badge>
                                      )}
                                      {windAngle !== null && !legEstimate && (
                                        <span className="text-amber-600 dark:text-amber-400">
                                          ({formatWindRelative(windAngle.signedRelative)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right text-xs">
                                    <span className="font-medium">{formatDistance(leg.distance)}</span>
                                    {legEstimate && (
                                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                                        <Clock className="w-2.5 h-2.5" />
                                        {formatLegTime(legEstimate.legTimeSeconds)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Line Lengths */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Start Line</p>
                            <p className="text-sm font-semibold">
                              {(courseStats.startLineLength * 1852).toFixed(0)} m
                            </p>
                            {boatClass?.lengthMeters && (
                              <p className="text-[10px] text-muted-foreground">
                                ({((courseStats.startLineLength * 1852) / boatClass.lengthMeters).toFixed(1)} boat lengths)
                              </p>
                            )}
                            {startLineCrossingTime && (
                              <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {startLineCrossingTime.timeFormatted}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Finish Line</p>
                            <p className="text-sm font-semibold">
                              {(courseStats.finishLineLength * 1852).toFixed(0)} m
                            </p>
                            {boatClass?.lengthMeters && (
                              <p className="text-[10px] text-muted-foreground">
                                ({((courseStats.finishLineLength * 1852) / boatClass.lengthMeters).toFixed(1)} boat lengths)
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Marks Summary */}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Marks ({marks.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {startLineMarks.map(m => (
                              <Badge key={m.id} className="bg-green-500 text-xs">{m.name}</Badge>
                            ))}
                            {courseMarks.map(m => (
                              <Badge key={m.id} variant="secondary" className="text-xs">{m.name}</Badge>
                            ))}
                            {finishLineMarks.filter(m => !m.isStartLine).map(m => (
                              <Badge key={m.id} className="bg-blue-500 text-xs">{m.name}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Export Course Data */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => setShowExportDialog(true)}
                          data-testid="button-export-course"
                        >
                          <Download className="w-4 h-4" />
                          Export Mark Locations
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

              </div>
            </ScrollArea>

            <div className="pt-3 border-t mt-auto">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setPhase("sequence")}
                  data-testid="button-back-sequence"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => setPhase("assign_buoys")}
                  data-testid="button-continue-buoys"
                >
                  Assign Buoys
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );

      case "assign_buoys":
        return (
          <div className="flex-1 flex flex-col p-3 gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <Anchor className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold">Assign Buoys</h2>
                <p className="text-xs text-muted-foreground">Tap points to assign robotic buoys</p>
              </div>
              {onAutoAssignBuoys && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAutoAssignBuoys}
                  className="gap-1 h-7 text-xs"
                  data-testid="button-auto-assign-buoys"
                >
                  <Play className="w-3 h-3" />
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
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left hover-elevate min-h-[48px]",
                        assignedBuoy ? "bg-green-50 dark:bg-green-900/20" : "bg-muted/50"
                      )}
                      data-testid={`button-assign-mark-${mark.id}`}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        assignedBuoy ? "bg-green-500 text-white" : "bg-muted-foreground/20"
                      )}>
                        {assignedBuoy ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Anchor className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{mark.name}</p>
                        <p className={cn(
                          "text-xs",
                          assignedBuoy ? "text-green-600" : "text-amber-600"
                        )}>
                          {assignedBuoy ? `Buoy: ${assignedBuoy.name}` : "Tap to assign buoy"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {mark.isStartLine && (
                          <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-600">S</Badge>
                        )}
                        {mark.isFinishLine && (
                          <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-600">F</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="pt-3 border-t space-y-2 mt-auto">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => setPhase("summary")}
                  data-testid="button-back-summary"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!allAssigned}
                  onClick={() => setPhase("ready")}
                  data-testid="button-continue-ready"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {!allAssigned && (
                <p className="text-center text-xs text-muted-foreground">
                  {getUnassignedCount()} buoy assignments remaining
                </p>
              )}
            </div>
          </div>
        );

      case "ready":
        // Build buoy status data with assignments
        const assignedBuoyIds = new Set<string>();
        const buoyToMarkMap = new Map<string, { markName: string; markRole: string }>();
        
        marks.forEach(mark => {
          if (mark.isGate) {
            if (mark.gatePortBuoyId) {
              assignedBuoyIds.add(mark.gatePortBuoyId);
              buoyToMarkMap.set(mark.gatePortBuoyId, { markName: `${mark.name} (Port)`, markRole: mark.role });
            }
            if (mark.gateStarboardBuoyId) {
              assignedBuoyIds.add(mark.gateStarboardBuoyId);
              buoyToMarkMap.set(mark.gateStarboardBuoyId, { markName: `${mark.name} (Stbd)`, markRole: mark.role });
            }
          } else if (mark.assignedBuoyId) {
            assignedBuoyIds.add(mark.assignedBuoyId);
            buoyToMarkMap.set(mark.assignedBuoyId, { markName: mark.name, markRole: mark.role });
          }
        });
        
        // Get assigned buoys with their data
        const assignedBuoys = buoys.filter(b => assignedBuoyIds.has(b.id));
        
        // Get unassigned buoys
        const unassignedBuoys = buoys.filter(b => !assignedBuoyIds.has(b.id));
        
        // GoTo buoys: moving to target but NOT assigned to a mark
        const gotoBuoys = unassignedBuoys.filter(b => 
          b.state === "moving_to_target" && b.targetLat != null && b.targetLng != null
        );
        
        // Available buoys: idle and not moving, not assigned
        const availableBuoys = unassignedBuoys.filter(b => 
          (b.state === "idle" || b.state === "holding_position") && 
          !gotoBuoys.includes(b)
        );
        
        // Issue buoys: fault or unavailable (from all buoys)
        const issueBuoys = buoys.filter(b => b.state === "fault" || b.state === "unavailable");
        
        // Calculate fleet status counts (for ALL buoys)
        const allMovingBuoys = buoys.filter(b => b.state === "moving_to_target");
        const allOnStationBuoys = buoys.filter(b => b.state === "holding_position");
        const allFaultBuoys = buoys.filter(b => b.state === "fault" || b.state === "unavailable");
        const allLowBatteryBuoys = buoys.filter(b => b.battery < 20);
        const allIdleBuoys = buoys.filter(b => b.state === "idle");
        
        // Calculate maximum ETA across assigned buoys (for course setup)
        const maxEtaSeconds = Math.max(0, ...assignedBuoys.map(b => b.eta ?? 0));
        const maxEtaMinutes = Math.floor(maxEtaSeconds / 60);
        const maxEtaSecondsRemainder = maxEtaSeconds % 60;
        
        // Format ETA helper
        const formatEta = (etaSeconds: number | null | undefined) => {
          if (!etaSeconds || etaSeconds <= 0) return null;
          const mins = Math.floor(etaSeconds / 60);
          const secs = etaSeconds % 60;
          return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        };
        
        // Get buoy state display info
        const getBuoyStateInfo = (state: string) => {
          switch (state) {
            case "moving_to_target":
              return { label: "Moving", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30" };
            case "holding_position":
              return { label: "On Station", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" };
            case "idle":
              return { label: "Idle", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" };
            case "fault":
              return { label: "Fault", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" };
            case "unavailable":
              return { label: "Offline", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800/30" };
            default:
              return { label: state, color: "text-muted-foreground", bgColor: "bg-muted/50" };
          }
        };
        
        // Render a buoy card
        const renderBuoyCard = (buoy: Buoy, subtitle: string) => {
          const stateInfo = getBuoyStateInfo(buoy.state);
          const etaFormatted = formatEta(buoy.eta);
          
          return (
            <div
              key={buoy.id}
              className={cn(
                "p-2.5 rounded-lg cursor-pointer hover-elevate",
                stateInfo.bgColor
              )}
              onClick={() => onBuoySelect?.(buoy.id)}
              data-testid={`buoy-status-${buoy.id}`}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  buoy.state === "fault" || buoy.state === "unavailable" 
                    ? "bg-red-500 text-white" 
                    : buoy.state === "moving_to_target"
                    ? "bg-amber-500 text-white"
                    : buoy.state === "idle"
                    ? "bg-blue-500 text-white"
                    : "bg-green-500 text-white"
                )}>
                  <Anchor className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{buoy.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
                  <span className={cn("font-mono", buoy.battery < 20 ? "text-red-500" : "text-muted-foreground")}>
                    {buoy.battery}%
                  </span>
                  {buoy.state === "moving_to_target" && (
                    <>
                      <span className="font-mono text-amber-600">{buoy.speed?.toFixed(1) ?? 0}kts</span>
                      {etaFormatted && <span className="font-mono font-medium text-amber-600">{etaFormatted}</span>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        };
        
        return (
          <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10">
                <Radio className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold">Fleet Status</h2>
                <p className="text-xs text-muted-foreground">{buoys.length} buoys total</p>
              </div>
            </div>

            {/* Status Summary - counts for ALL buoys */}
            <div className="grid grid-cols-5 gap-1.5" data-testid="fleet-status-summary">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-1.5 text-center" data-testid="status-on-station">
                <p className="text-base font-bold text-green-600" data-testid="count-on-station">{allOnStationBuoys.length}</p>
                <p className="text-[9px] text-muted-foreground">Station</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-1.5 text-center" data-testid="status-moving">
                <p className="text-base font-bold text-amber-600" data-testid="count-moving">{allMovingBuoys.length}</p>
                <p className="text-[9px] text-muted-foreground">Moving</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-1.5 text-center" data-testid="status-idle">
                <p className="text-base font-bold text-blue-600" data-testid="count-idle">{allIdleBuoys.length}</p>
                <p className="text-[9px] text-muted-foreground">Idle</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5 text-center" data-testid="status-fault">
                <p className="text-base font-bold text-red-600" data-testid="count-fault">{allFaultBuoys.length}</p>
                <p className="text-[9px] text-muted-foreground">Fault</p>
              </div>
              <div className={cn(
                "rounded-lg p-1.5 text-center",
                allLowBatteryBuoys.length > 0 ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"
              )} data-testid="status-low-battery">
                <p className={cn("text-base font-bold", allLowBatteryBuoys.length > 0 ? "text-orange-600" : "text-muted-foreground")} data-testid="count-low-battery">
                  {allLowBatteryBuoys.length}
                </p>
                <p className="text-[9px] text-muted-foreground">Low Bat</p>
              </div>
            </div>

            {/* Max ETA for Course Setup */}
            {maxEtaSeconds > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 flex items-center gap-2" data-testid="course-setup-eta">
                <Clock className="w-4 h-4 text-amber-600" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">Course Ready In</p>
                  <p className="text-base font-bold text-amber-600" data-testid="text-max-eta">
                    {maxEtaMinutes > 0 ? `${maxEtaMinutes}m ${maxEtaSecondsRemainder}s` : `${maxEtaSecondsRemainder}s`}
                  </p>
                </div>
              </div>
            )}

            {/* Buoy List - organized by category */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-3">
                {/* Assigned to Marks */}
                {assignedBuoys.length > 0 && (
                  <div className="space-y-1.5" data-testid="section-assigned">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      Assigned to Points ({assignedBuoys.length})
                    </p>
                    {assignedBuoys.map(buoy => {
                      const assignment = buoyToMarkMap.get(buoy.id);
                      return renderBuoyCard(buoy, assignment?.markName ?? "Point");
                    })}
                  </div>
                )}
                
                {/* GoTo Commands */}
                {gotoBuoys.length > 0 && (
                  <div className="space-y-1.5" data-testid="section-goto">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      GoTo Target ({gotoBuoys.length})
                    </p>
                    {gotoBuoys.map(buoy => renderBuoyCard(buoy, "Manual GoTo"))}
                  </div>
                )}
                
                {/* Available */}
                {availableBuoys.length > 0 && (
                  <div className="space-y-1.5" data-testid="section-available">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      Available ({availableBuoys.length})
                    </p>
                    {availableBuoys.map(buoy => renderBuoyCard(buoy, "Ready"))}
                  </div>
                )}
                
                {/* Issues */}
                {issueBuoys.length > 0 && (
                  <div className="space-y-1.5" data-testid="section-issues">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                      Issues ({issueBuoys.length})
                    </p>
                    {issueBuoys.map(buoy => {
                      const stateInfo = getBuoyStateInfo(buoy.state);
                      return renderBuoyCard(buoy, stateInfo.label);
                    })}
                  </div>
                )}
                
                {buoys.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Anchor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No buoys in fleet</p>
                  </div>
                )}
              </div>
            </ScrollArea>

          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card" data-testid="setup-panel">
      {/* Compact progress stepper */}
      <div className="px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-1">
          {phases.map((p, idx) => {
            const minPhase = getMinPhase();
            const minPhaseIdx = phaseOrder.indexOf(minPhase);
            const isComplete = idx < currentPhaseIndex;
            const isCurrent = p.id === phase;
            // Fleet (ready) phase is always accessible regardless of previous steps
            const canNavigate = (p.id === "ready" || idx <= minPhaseIdx) && !isCurrent;
            
            return (
              <button
                key={p.id}
                onClick={() => canNavigate && setPhase(p.id as SetupPhase)}
                disabled={!canNavigate && !isCurrent}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 transition-opacity",
                  canNavigate ? "cursor-pointer hover:opacity-80" : "",
                  !canNavigate && !isCurrent && idx > minPhaseIdx && p.id !== "ready" ? "opacity-40" : ""
                )}
                data-testid={`button-phase-${p.id}`}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center font-semibold text-xs transition-colors",
                  isComplete ? "bg-green-500 text-white" :
                  isCurrent ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isComplete ? <Check className="w-3.5 h-3.5" /> : p.number}
                </div>
                <span className={cn(
                  "text-[10px] font-medium",
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
      <Dialog open={showLoadDialog} onOpenChange={(open) => {
        setShowLoadDialog(open);
        if (!open) {
          setSelectedLoadCourse(null);
          setSnapshotSearch("");
        }
      }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Load Race Course</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
            {selectedLoadCourse ? (
              // Step 2: Choose load mode
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Loading: <span className="font-semibold text-foreground">{selectedLoadCourse.name}</span>
                  {selectedLoadCourse.visibilityScope === "global" && (
                    <Badge variant="secondary" className="ml-2 text-xs">Template</Badge>
                  )}
                </p>
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => handleLoadCourse("shape_only")}
                    data-testid="button-load-shape-only"
                  >
                    <MapPin className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold">Shape Only</p>
                      <p className="text-xs text-muted-foreground">Place marks at current map center</p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full justify-start gap-3 h-auto py-3"
                    onClick={() => handleLoadCourse("exact")}
                    data-testid="button-load-exact"
                  >
                    <Navigation className="w-5 h-5 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold">Exact Location</p>
                      <p className="text-xs text-muted-foreground">Load marks at their saved positions</p>
                    </div>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLoadCourse(null)}
                  className="w-full"
                >
                  Back to course list
                </Button>
              </div>
            ) : (
              // Step 1: Select a course
              <div className="space-y-3">
                {/* Search input */}
                <Input
                  type="text"
                  placeholder="Search courses..."
                  value={snapshotSearch}
                  onChange={(e) => setSnapshotSearch(e.target.value)}
                  data-testid="input-search-courses"
                />
                
                {isLoadingSnapshots ? (
                  <p className="text-center text-muted-foreground py-4">Loading...</p>
                ) : snapshots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {snapshotSearch ? "No courses match your search" : "No saved courses"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {snapshots.map((snapshot) => {
                      const hasMarks = snapshot.snapshotMarks && snapshot.snapshotMarks.length > 0;
                      const isTemplate = snapshot.visibilityScope === "global";
                      return (
                        <div 
                          key={snapshot.id}
                          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover-elevate"
                        >
                          <button
                            onClick={() => setSelectedLoadCourse(snapshot)}
                            className="flex-1 text-left"
                            data-testid={`button-select-course-${snapshot.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{snapshot.name}</p>
                              {isTemplate && (
                                <Badge variant="secondary" className="text-xs">Template</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{snapshot.shape}</span>
                              {hasMarks ? (
                                <span>({snapshot.snapshotMarks.length} points)</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-500">(No points)</span>
                              )}
                              {snapshot.sailClubName && (
                                <span className="text-xs">• {snapshot.sailClubName}</span>
                              )}
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCourse?.(snapshot.id);
                            }}
                            data-testid={`button-delete-course-${snapshot.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLoadDialog(false);
              setSelectedLoadCourse(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Course Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Course Export - Mark Locations
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Course Diagram */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="text-sm font-semibold mb-3">Course Diagram</h3>
              <svg 
                viewBox="0 0 400 300" 
                className="w-full h-48 bg-blue-50 dark:bg-blue-950/30 rounded-lg"
                data-testid="course-diagram"
              >
                {/* Draw course area */}
                {(() => {
                  if (marks.length === 0) return null;
                  
                  // Find bounds
                  const lats = marks.map(m => m.lat);
                  const lngs = marks.map(m => m.lng);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  const minLng = Math.min(...lngs);
                  const maxLng = Math.max(...lngs);
                  const padding = 0.1;
                  const latRange = (maxLat - minLat) || 0.001;
                  const lngRange = (maxLng - minLng) || 0.001;
                  
                  // Scale to SVG coordinates with padding
                  const scaleX = (lng: number) => 40 + ((lng - minLng) / (lngRange * (1 + padding * 2))) * 320;
                  const scaleY = (lat: number) => 260 - ((lat - minLat) / (latRange * (1 + padding * 2))) * 220;
                  
                  // Draw rounding sequence path
                  const pathPoints: { x: number; y: number; label: string }[] = [];
                  for (const entry of roundingSequence) {
                    if (entry === "start") {
                      const startMarks = marks.filter(m => m.isStartLine);
                      if (startMarks.length >= 2) {
                        const midLat = (startMarks[0].lat + startMarks[1].lat) / 2;
                        const midLng = (startMarks[0].lng + startMarks[1].lng) / 2;
                        pathPoints.push({ x: scaleX(midLng), y: scaleY(midLat), label: "S" });
                      }
                    } else if (entry === "finish") {
                      const finishMarks = marks.filter(m => m.isFinishLine);
                      if (finishMarks.length >= 2) {
                        const midLat = (finishMarks[0].lat + finishMarks[1].lat) / 2;
                        const midLng = (finishMarks[0].lng + finishMarks[1].lng) / 2;
                        pathPoints.push({ x: scaleX(midLng), y: scaleY(midLat), label: "F" });
                      }
                    } else {
                      const mark = marks.find(m => m.id === entry);
                      if (mark) {
                        pathPoints.push({ x: scaleX(mark.lng), y: scaleY(mark.lat), label: mark.name });
                      }
                    }
                  }
                  
                  return (
                    <>
                      {/* Course path */}
                      {pathPoints.length > 1 && (
                        <path
                          d={`M ${pathPoints.map(p => `${p.x},${p.y}`).join(" L ")}`}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2"
                          strokeDasharray="5,3"
                        />
                      )}
                      
                      {/* Draw marks */}
                      {marks.map((mark, i) => {
                        const x = scaleX(mark.lng);
                        const y = scaleY(mark.lat);
                        const color = mark.isStartLine ? "#22c55e" : mark.isFinishLine ? "#3b82f6" : "#f59e0b";
                        
                        return (
                          <g key={mark.id}>
                            <circle cx={x} cy={y} r="8" fill={color} stroke="#fff" strokeWidth="2" />
                            <text x={x} y={y - 12} textAnchor="middle" fontSize="10" fill="currentColor" className="font-medium">
                              {mark.name}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* North arrow */}
                      <g transform="translate(370, 30)">
                        <polygon points="0,-15 5,5 -5,5" fill="#64748b" />
                        <text x="0" y="18" textAnchor="middle" fontSize="10" fill="#64748b">N</text>
                      </g>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Marks Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Point</th>
                    <th className="text-left p-2 font-medium">Latitude</th>
                    <th className="text-left p-2 font-medium">Longitude</th>
                    <th className="text-left p-2 font-medium">Bearing (°N)</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Calculate bearing from first mark (or center) to each mark
                    if (marks.length === 0) return null;
                    
                    // Sort marks: Committee Boat first, Pin second, then course marks in placement order
                    const committeeBoat = marks.find(m => m.role === "start_boat");
                    const pin = marks.find(m => m.role === "pin");
                    const otherMarks = marks.filter(m => m.role !== "start_boat" && m.role !== "pin");
                    const sortedMarks = [
                      ...(committeeBoat ? [committeeBoat] : []),
                      ...(pin ? [pin] : []),
                      ...otherMarks
                    ];
                    
                    // Use course center as reference point
                    const centerLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
                    const centerLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
                    
                    const calcBearing = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
                      const dLng = (toLng - fromLng) * Math.PI / 180;
                      const lat1 = fromLat * Math.PI / 180;
                      const lat2 = toLat * Math.PI / 180;
                      const y = Math.sin(dLng) * Math.cos(lat2);
                      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
                      let bearing = Math.atan2(y, x) * 180 / Math.PI;
                      return (bearing + 360) % 360;
                    };
                    
                    return sortedMarks.map((mark, i) => {
                      const bearing = calcBearing(centerLat, centerLng, mark.lat, mark.lng);
                      const typeLabel = mark.isStartLine && mark.isFinishLine 
                        ? "(S/F)" 
                        : mark.isStartLine 
                          ? "(Start)" 
                          : mark.isFinishLine 
                            ? "(Finish)" 
                            : "";
                      
                      return (
                        <tr key={mark.id} className="border-t">
                          <td className="p-2 font-medium">
                            {mark.name} <span className="text-muted-foreground text-xs">{typeLabel}</span>
                          </td>
                          <td className="p-2 font-mono text-xs">{mark.lat.toFixed(6)}</td>
                          <td className="p-2 font-mono text-xs">{mark.lng.toFixed(6)}</td>
                          <td className="p-2 font-mono">{bearing.toFixed(1)}°</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Plain text export */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <h3 className="text-sm font-semibold mb-2">Plain Text (Copy)</h3>
              <pre className="text-xs font-mono whitespace-pre-wrap select-all bg-background p-3 rounded border overflow-x-auto" data-testid="export-text">
{(() => {
  if (marks.length === 0) return "No marks defined";
  
  // Sort marks: Committee Boat first, Pin second, then course marks in placement order
  const committeeBoat = marks.find(m => m.role === "start_boat");
  const pin = marks.find(m => m.role === "pin");
  const otherMarks = marks.filter(m => m.role !== "start_boat" && m.role !== "pin");
  const sortedMarks = [
    ...(committeeBoat ? [committeeBoat] : []),
    ...(pin ? [pin] : []),
    ...otherMarks
  ];
  
  const centerLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
  const centerLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
  
  const calcBearing = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    const dLng = (toLng - fromLng) * Math.PI / 180;
    const lat1 = fromLat * Math.PI / 180;
    const lat2 = toLat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  };
  
  const lines = [`RACE COURSE MARKS - ${event.name}`, `Date: ${new Date().toLocaleDateString()}`, ""];
  
  sortedMarks.forEach((mark, i) => {
    const bearing = calcBearing(centerLat, centerLng, mark.lat, mark.lng);
    const typeLabel = mark.isStartLine && mark.isFinishLine 
      ? "[Start/Finish]" 
      : mark.isStartLine 
        ? "[Start]" 
        : mark.isFinishLine 
          ? "[Finish]" 
          : "";
    
    lines.push(`${mark.name} ${typeLabel}`);
    lines.push(`  GPS: ${mark.lat.toFixed(6)}, ${mark.lng.toFixed(6)}`);
    lines.push(`  Bearing from center: ${bearing.toFixed(1)}°N`);
    lines.push("");
  });
  
  return lines.join("\n");
})()}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {onAutoAdjustMark && onAutoAdjustStartLine && onAutoAdjustComplete && windDirection !== undefined && (
        <AutoAdjustWizard
          open={showAutoAdjustDialog}
          onOpenChange={setShowAutoAdjustDialog}
          marks={marks}
          roundingSequence={roundingSequence}
          windDirection={windDirection}
          onApplyMark={onAutoAdjustMark}
          onApplyStartLine={onAutoAdjustStartLine}
          onComplete={onAutoAdjustComplete}
        />
      )}

      {/* Course Coordinates Dialog */}
      <Dialog open={showCourseCoordinatesDialog} onOpenChange={setShowCourseCoordinatesDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move Course to Coordinates</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the new position for the committee boat. The entire course will move relative to this point.
          </p>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course-coord-lat">Latitude</Label>
              <Input
                id="course-coord-lat"
                type="number"
                step="0.0001"
                value={courseCoordLat}
                onChange={(e) => setCourseCoordLat(e.target.value)}
                placeholder="e.g. 51.5074"
                className="text-lg font-mono"
                data-testid="input-course-coord-lat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-coord-lng">Longitude</Label>
              <Input
                id="course-coord-lng"
                type="number"
                step="0.0001"
                value={courseCoordLng}
                onChange={(e) => setCourseCoordLng(e.target.value)}
                placeholder="e.g. -0.1278"
                className="text-lg font-mono"
                data-testid="input-course-coord-lng"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCourseCoordinatesDialog(false)} data-testid="button-course-coord-cancel">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const parsedLat = parseFloat(courseCoordLat);
                const parsedLng = parseFloat(courseCoordLng);
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                  handleMoveCourseToCoordinates(parsedLat, parsedLng);
                  setShowCourseCoordinatesDialog(false);
                }
              }}
              disabled={isNaN(parseFloat(courseCoordLat)) || isNaN(parseFloat(courseCoordLng))}
              data-testid="button-place-course-at-coordinates"
            >
              Move Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
