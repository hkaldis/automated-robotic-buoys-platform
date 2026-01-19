import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { TopBar } from "@/components/TopBar";
import { LeafletMap } from "@/components/LeafletMap";
import { SetupPanel } from "@/components/SetupPanel";
import { BuoyDetailPanel } from "@/components/BuoyDetailPanel";
import { MarkEditPanel } from "@/components/MarkEditPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AlertBanner } from "@/components/AlertBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Event, Buoy, Mark, Course, MarkRole, CourseShape, EventType } from "@shared/schema";
import { 
  useBuoys, 
  useEvents, 
  useCourses, 
  useMarks, 
  useWeatherData, 
  useWeatherByLocation,
  useBuoyCommand,
  useUpdateMark,
  useCreateMark,
  useDeleteMark,
  useDeleteAllMarks,
  useUpdateCourse,
  useCreateEvent,
  useCreateCourse,
} from "@/hooks/use-api";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useDemoModeContext } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
import { executeAutoAssignWithRecovery } from "@/lib/batchedMutations";

const MIKROLIMANO_CENTER = { lat: 37.9376, lng: 23.6917 };
const DEFAULT_CENTER = MIKROLIMANO_CENTER;

/**
 * Generates marks for standard sailing race course shapes per World Sailing standards.
 * 
 * COURSE GEOMETRY (initial orientation with wind from north/0°):
 * - Start line at south end, perpendicular to wind direction
 * - Committee boat at STARBOARD end of start line (east/+lng)
 * - Pin mark at PORT end of start line (west/-lng)
 * - Windward mark (Mark 1) directly upwind from start line center
 * - Wing mark (Mark 2) to STARBOARD of centerline (east/+lng)
 * - Leeward gate/mark at south end of course (at start line latitude)
 * 
 * SAILING DIRECTION - PORT ROUNDING (counter-clockwise):
 * Boats leave marks on their PORT (left) side when rounding.
 * 
 * Triangle course example (wind from north):
 *   1. Start: Boats cross start line heading NORTH (upwind)
 *   2. Beat to Mark 1 (Windward): Heading ~0° (north)
 *   3. Round Mark 1 to PORT: Turn RIGHT, now heading ~120° (SE)
 *   4. Reach to Mark 2 (Wing): Heading SE toward wing mark on starboard side
 *   5. Round Mark 2 to PORT: Turn RIGHT, now heading ~240° (SW)
 *   6. Run to Mark 3 (Leeward): Heading SW toward leeward/start area
 *   7. Round Mark 3 to PORT: Turn RIGHT, now heading ~0° (N) for next beat
 * 
 * Why wing mark is on STARBOARD (+lng) for PORT rounding:
 * - From windward mark, boats bear off onto PORT tack (wind over left shoulder)
 * - They sail SE toward the wing mark which is to their RIGHT (starboard)
 * - When they reach the wing mark, they round it leaving it on their LEFT (port)
 * - This is port rounding - the mark is left to port as they turn right around it
 * 
 * World Sailing Mark Naming Convention:
 * - Mark 1: Windward mark (weather/top mark)
 * - Mark 2: Wing/gybe mark (on reaching leg, starboard of centerline)
 * - Mark 3: Leeward mark or Gate (3s=starboard half, 3p=port half)
 * - Offset: Spreader mark near windward for tactical downwind sailing
 */
function generateShapeMarks(shape: CourseShape, centerLat: number, centerLng: number): Array<{ name: string; role: MarkRole; lat: number; lng: number; order: number; isStartLine: boolean; isFinishLine: boolean; isCourseMark: boolean }> {
  /**
   * World Sailing Trapezoid Course Specifications:
   * - 60°/120° Course: For boats with spinnakers (reach angle 60° between marks)
   * - 70°/110° Course: For non-spinnaker boats (ILCA/Lasers, windsurfers)
   * - Reaching leg (1-2): 67% of windward leg length
   * - Gate widths: ~10 hull lengths wide, square to wind
   * - Start line: ~0.05nm (100m) below leeward gate
   * 
   * Mark numbering (per World Sailing):
   * - Mark 1: Windward mark (top)
   * - Mark 2: Wing/reach mark
   * - Marks 3s/3p: Leeward gate (starboard/port)
   * - Marks 4s/4p: Start/finish gate (below leeward gate)
   */
  
  // Course dimensions in degrees
  // Windward leg length (approximately 0.25nm = 460m)
  const windwardLegLength = 0.004;
  // Reaching leg is 67% of windward leg per World Sailing standards
  const reachingLegRatio = 0.67;
  
  // Gate and line widths (in degrees latitude/longitude)
  const gateHalfWidth = 0.0008; // ~10 hull lengths for dinghies (~80m total)
  const startLineHalfWidth = 0.0015; // ~150m start line
  
  // Start line offset below leeward gate (0.05nm = ~90m)
  const startLineOffset = 0.0008;
  
  // Trigonometric constants for 60° reach angles (spinnaker courses)
  // For non-spinnaker (70°), use Math.cos/sin(70 * Math.PI / 180)
  const reachAngle = 60; // degrees off wind
  const cosReach = Math.cos(reachAngle * Math.PI / 180); // 0.5
  const sinReach = Math.sin(reachAngle * Math.PI / 180); // 0.866
  
  // Base position - center of course
  // Wind assumed from north (0°/360°), so upwind is +lat, starboard is +lng
  const baseLat = centerLat;
  const baseLng = centerLng;
  
  // Calculate leeward gate position (at the base)
  const leewardGateLat = baseLat;
  
  // Calculate start/finish line position (0.05nm below leeward gate)
  const startLineLat = leewardGateLat - startLineOffset;
  
  // Calculate reaching leg length
  const reachLegLength = windwardLegLength * reachingLegRatio;
  
  switch (shape) {
    case "triangle":
      // Olympic Triangle Course (TL/TW - equilateral 60-60-60°)
      // Course: Start → Mark 1 (Windward) → Mark 2 (Wing) → Mark 3 (Leeward) → repeat/Finish
      // All three legs are equal length, forming a true equilateral triangle
      // Rounding to port (counter-clockwise): windward→wing is broad reach, wing→leeward is close reach
      // Start and Finish lines are separate from course marks
      return [
        // Start/Finish line marks - Committee boat at STARBOARD (+lng), Pin at PORT (-lng)
        // These are NOT course marks (isCourseMark: false) - they define start/finish only
        { name: "Committee Boat", role: "start_boat", lat: startLineLat, lng: baseLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: true, isCourseMark: false },
        { name: "Pin Mark", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: true, isCourseMark: false },
        // Mark 1 - Windward mark (one leg length directly upwind from base)
        { name: "Mark 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Mark 2 - Wing mark (60° to STARBOARD, equal leg length from windward)
        // Position: halfway up in lat, offset to starboard by sin(60°)*legLength
        { name: "Mark 2 (Wing)", role: "wing", lat: baseLat + windwardLegLength * cosReach, lng: baseLng + windwardLegLength * sinReach, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Mark 3 - Leeward mark (at bottom/downwind, on centerline)
        // Equal leg length from wing mark back to leeward completes the equilateral
        { name: "Mark 3 (Leeward)", role: "leeward", lat: baseLat, lng: baseLng, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
      ];
      
    case "trapezoid":
      // Outer Trapezoid Course (O - 60°/120° reaching legs per World Sailing)
      // Course: Start → Mark 1 (Windward) → Mark 2 (Wing) → Gate 3 → repeat
      // Standard Olympic/ILCA format:
      // - Windward leg parallel to wind
      // - Reaching leg at 60° (or 70° for non-spinnaker) at 67% of windward leg length
      // - Leeward gate (3s/3p) square to wind, 10 hull lengths wide
      // - Start/finish line 0.05nm below leeward gate
      // 
      // Per diagram: O course has separate start gate (4s/4p) from leeward gate (3s/3p)
      // I course shares start with leeward gate
      return [
        // Start/Finish line marks - 0.05nm below leeward gate, separate from course
        // These are NOT course marks (isCourseMark: false)
        { name: "Start Boat", role: "start_boat", lat: startLineLat, lng: baseLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: false, isCourseMark: false },
        { name: "Pin Mark", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: false, isCourseMark: false },
        // Mark 1 - Windward mark (one leg length directly upwind)
        { name: "Mark 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Mark 2 - Wing mark (60° reaching leg to starboard from windward at 67% length)
        // Position: cos(60°) up from base, sin(60°) to starboard
        { name: "Mark 2 (Wing)", role: "wing", lat: baseLat + reachLegLength * cosReach, lng: baseLng + reachLegLength * sinReach, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Leeward gate (3s/3p) - square to wind, 10 hull lengths wide
        { name: "Mark 3s (Gate Starboard)", role: "gate", lat: leewardGateLat, lng: baseLng + gateHalfWidth, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
        { name: "Mark 3p (Gate Port)", role: "gate", lat: leewardGateLat, lng: baseLng - gateHalfWidth, order: 5, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Finish line marks - near leeward gate but separate
        { name: "Finish Boat", role: "finish", lat: leewardGateLat - startLineOffset * 0.5, lng: baseLng + startLineHalfWidth * 0.7, order: 6, isStartLine: false, isFinishLine: true, isCourseMark: false },
        { name: "Finish Pin", role: "finish", lat: leewardGateLat - startLineOffset * 0.5, lng: baseLng - startLineHalfWidth * 0.7, order: 7, isStartLine: false, isFinishLine: true, isCourseMark: false },
      ];
      
    case "windward_leeward":
      // Windward-Leeward Course (L - leeward finish)
      // Course: Start → Mark 1 (Windward) → Gate → repeat → Finish at leeward
      // Pure upwind/downwind racing - most common modern format
      // Simplest course: beat to windward, run through gate, repeat
      // Start and Finish lines are separate from course marks
      return [
        // Start line marks - 0.05nm below leeward gate
        { name: "Start Boat", role: "start_boat", lat: startLineLat, lng: baseLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: false, isCourseMark: false },
        { name: "Pin Mark", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: false, isCourseMark: false },
        // Mark 1 - Windward mark (one leg length directly upwind from start line center)
        { name: "Mark 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Gate marks at leeward end (at base latitude, straddling centerline)
        // Starboard mark at +lng, Port at -lng
        { name: "Mark 3s (Gate Starboard)", role: "gate", lat: leewardGateLat, lng: baseLng + gateHalfWidth, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        { name: "Mark 3p (Gate Port)", role: "gate", lat: leewardGateLat, lng: baseLng - gateHalfWidth, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Finish line marks - near leeward gate but separate
        { name: "Finish Boat", role: "finish", lat: leewardGateLat - startLineOffset * 0.5, lng: baseLng + startLineHalfWidth * 0.7, order: 5, isStartLine: false, isFinishLine: true, isCourseMark: false },
        { name: "Finish Pin", role: "finish", lat: leewardGateLat - startLineOffset * 0.5, lng: baseLng - startLineHalfWidth * 0.7, order: 6, isStartLine: false, isFinishLine: true, isCourseMark: false },
      ];
      
    case "custom":
    default:
      // Custom courses - user places marks manually on the map
      // Return empty array, user adds marks via map clicks
      return [];
  }
}

/**
 * Calculates the total distance of a course based on mark positions.
 * Returns distance in nautical miles.
 */
function calculateCourseDistance(marks: Mark[]): number {
  if (marks.length < 2) return 0;
  
  // Sort marks by order to get the correct sailing sequence
  const sortedMarks = [...marks].sort((a, b) => a.order - b.order);
  
  // Find course marks (excluding start line marks for initial leg calculation)
  const startLineMarks = sortedMarks.filter(m => m.isStartLine);
  const courseMarks = sortedMarks.filter(m => !m.isStartLine || m.role === 'start_boat');
  
  let totalDistance = 0;
  
  // Calculate distance between consecutive marks
  for (let i = 0; i < courseMarks.length - 1; i++) {
    const from = courseMarks[i];
    const to = courseMarks[i + 1];
    totalDistance += haversineDistance(from.lat, from.lng, to.lat, to.lng);
  }
  
  // Add distance from last course mark back to finish (if finish is start line)
  if (courseMarks.length > 0) {
    const lastMark = courseMarks[courseMarks.length - 1];
    const finishMark = startLineMarks.find(m => m.role === 'start_boat') || courseMarks[0];
    if (lastMark.id !== finishMark.id) {
      totalDistance += haversineDistance(lastMark.lat, lastMark.lng, finishMark.lat, finishMark.lng);
    }
  }
  
  return totalDistance;
}

/**
 * Haversine formula to calculate distance between two lat/lng points.
 * Returns distance in nautical miles.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimates race time based on course distance and typical boat speeds.
 * Returns estimated time in minutes.
 */
function estimateRaceTime(distanceNm: number, boatClass: string): number {
  // Average speed estimates by boat class (knots)
  const avgSpeeds: Record<string, number> = {
    'Laser': 4.5,
    'Optimist': 3.5,
    '420': 5.0,
    '470': 5.5,
    '49er': 8.0,
    'Finn': 5.0,
    'RS Feva': 4.0,
    'default': 4.5,
  };
  
  const speed = avgSpeeds[boatClass] || avgSpeeds['default'];
  // Time = Distance / Speed, convert to minutes
  return (distanceNm / speed) * 60;
}

interface RaceControlProps {
  eventId?: string;
}

export default function RaceControl({ eventId: propEventId }: RaceControlProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  // Placement state: pendingMarkData being non-null means we're placing a mark
  const [pendingMarkData, setPendingMarkData] = useState<{ name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean } | null>(null);
  const isPlacingMark = pendingMarkData !== null;
  const [repositioningMarkId, setRepositioningMarkId] = useState<string | null>(null);
  const [gotoMapClickMarkId, setGotoMapClickMarkId] = useState<string | null>(null);
  const [gotoMapClickBuoyId, setGotoMapClickBuoyId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(propEventId || null);
  const [finishLinePreviewIds, setFinishLinePreviewIds] = useState<Set<string>>(new Set());
  const [mapOrientation, setMapOrientation] = useState<"north" | "head-to-wind">("north");
  const [localRoundingSequence, setLocalRoundingSequence] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [currentSetupPhase, setCurrentSetupPhase] = useState<string>("start_line");
  
  // Confirmation dialog state for mark movement with assigned buoys
  const [pendingMarkMove, setPendingMarkMove] = useState<{ 
    markId: string; 
    lat: number; 
    lng: number;
    hasAssignedBuoy: boolean;
  } | null>(null);
  
  // Confirmation dialog state for course transformation with assigned buoys
  const [pendingCourseTransform, setPendingCourseTransform] = useState<{
    transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number };
    hasAssignedBuoys: boolean;
  } | null>(null);
  
  // Confirmation dialog state for clearing course from top bar
  const [showClearCourseConfirm, setShowClearCourseConfirm] = useState(false);
  
  const { toast } = useToast();

  const { enabled: demoMode, toggleDemoMode, demoBuoys, sendCommand: sendDemoCommand, updateDemoWeather } = useDemoModeContext();

  const { data: apiBuoys = [], isLoading: buoysLoading } = useBuoys();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: weatherData, isLoading: weatherLoading } = useWeatherData();
  const weatherByLocation = useWeatherByLocation();
  
  // Only use explicitly set course/event - never fall back to first item to avoid showing wrong marks
  const currentEvent = activeEventId ? events.find(e => e.id === activeEventId) : undefined;
  const currentCourse = activeCourseId ? courses.find(c => c.id === activeCourseId) : undefined;
  
  // Only fetch marks for explicitly selected course - empty string disables the query
  const courseId = activeCourseId ?? "";
  const { data: marks = [], isLoading: marksLoading } = useMarks(courseId);
  const buoyCommandErrorHandler = useCallback((error: Error) => {
    toast({
      title: "Buoy Command Failed",
      description: error.message || "Failed to execute buoy command",
      variant: "destructive",
    });
  }, [toast]);
  const buoyCommand = useBuoyCommand(sendDemoCommand, courseId, buoyCommandErrorHandler);
  const mutationErrorHandler = useCallback((error: Error) => {
    toast({
      title: "Operation Failed",
      description: error.message || "An error occurred",
      variant: "destructive",
    });
  }, [toast]);
  const updateMark = useUpdateMark(courseId, mutationErrorHandler);
  const createMark = useCreateMark(courseId, mutationErrorHandler);
  const deleteMark = useDeleteMark(courseId, mutationErrorHandler);
  const updateCourse = useUpdateCourse(courseId, mutationErrorHandler);
  const createEvent = useCreateEvent();
  const createCourse = useCreateCourse();
  const deleteAllMarks = useDeleteAllMarks(mutationErrorHandler);

  const buoys = demoMode ? demoBuoys : apiBuoys;

  const demoWeatherData = useMemo(() => {
    if (!demoMode) return null;
    const avgWindSpeed = demoBuoys.reduce((sum, b) => sum + (b.windSpeed ?? 0), 0) / demoBuoys.length;
    const avgWindDirection = demoBuoys.reduce((sum, b) => sum + (b.windDirection ?? 0), 0) / demoBuoys.length;
    return {
      windSpeed: avgWindSpeed,
      windDirection: avgWindDirection,
      currentSpeed: 0.8,
      currentDirection: 180,
      source: "demo",
      timestamp: new Date().toISOString(),
    };
  }, [demoMode, demoBuoys]);

  const activeWeatherData = demoMode ? demoWeatherData : weatherData;

  const selectedBuoy = useMemo(() => {
    if (!selectedBuoyId) return null;
    return buoys.find(b => b.id === selectedBuoyId) ?? null;
  }, [buoys, selectedBuoyId]);

  const selectedMark = useMemo(() => {
    if (!selectedMarkId) return null;
    return marks.find(m => m.id === selectedMarkId) ?? null;
  }, [marks, selectedMarkId]);

  // Derive roundingSequence from course data, fallback to local state
  const roundingSequence = useMemo(() => {
    return currentCourse?.roundingSequence ?? localRoundingSequence;
  }, [currentCourse?.roundingSequence, localRoundingSequence]);

  // Sync local sequence when course or its roundingSequence changes
  useEffect(() => {
    if (currentCourse?.roundingSequence) {
      setLocalRoundingSequence(currentCourse.roundingSequence);
    } else {
      setLocalRoundingSequence([]);
    }
  }, [currentCourse?.id, currentCourse?.roundingSequence]);

  // Auto-create a default course if none exists
  const [courseCreationAttempted, setCourseCreationAttempted] = useState(false);
  useEffect(() => {
    if (!coursesLoading && courses.length === 0 && !courseCreationAttempted) {
      setCourseCreationAttempted(true);
      createCourse.mutate({
        name: "Race Course",
        shape: "custom",
        centerLat: 37.8044,
        centerLng: -122.4196,
        rotation: 0,
        scale: 1,
      }, {
        onSuccess: (newCourse) => {
          setActiveCourseId(newCourse.id);
          toast({
            title: "Course Created",
            description: "A new course has been created. You can now add marks.",
          });
        },
      });
    }
  }, [courses.length, coursesLoading, courseCreationAttempted, createCourse, toast]);

  // Simple course initialization and validation:
  // 1. If activeCourseId is set but no longer valid (course deleted), clear it
  // 2. If no activeCourseId, set from event or first available course
  useEffect(() => {
    if (coursesLoading) return;
    
    // Check if current activeCourseId is still valid
    if (activeCourseId) {
      const stillExists = courses.some(c => c.id === activeCourseId);
      if (!stillExists) {
        // Course was deleted - reset to first available or empty
        const nextCourse = courses[0];
        setActiveCourseId(nextCourse?.id ?? null);
        setLocalRoundingSequence([]);
        return;
      }
      return; // Valid course, nothing to do
    }
    
    // No active course - try to set one
    if (currentEvent?.courseId) {
      setActiveCourseId(currentEvent.courseId);
    } else if (courses.length > 0) {
      setActiveCourseId(courses[0].id);
    }
  }, [coursesLoading, courses, activeCourseId, currentEvent?.courseId]);

  // Handler to update sequence (persists to course)
  const handleUpdateSequence = useCallback((newSequence: string[]) => {
    setLocalRoundingSequence(newSequence);
    if (currentCourse) {
      updateCourse.mutate({ id: currentCourse.id, data: { roundingSequence: newSequence } });
    }
  }, [currentCourse, updateCourse]);

  const handleDeployCourse = useCallback(() => {
    toast({
      title: "Course Deployed",
      description: "All buoys are moving to their assigned positions.",
    });
    
    const windDir = activeWeatherData?.windDirection ?? 225;
    
    marks.forEach((mark) => {
      // Handle gate marks with two buoys
      if (mark.isGate) {
        const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
        const halfWidthDeg = (gateWidth / 2) / 111000;
        const perpAngle = (windDir + 90) % 360;
        const perpRad = perpAngle * Math.PI / 180;
        
        const portLat = mark.lat + halfWidthDeg * Math.cos(perpRad);
        const portLng = mark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
        const starboardLat = mark.lat - halfWidthDeg * Math.cos(perpRad);
        const starboardLng = mark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
        
        if (mark.gatePortBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gatePortBuoyId, "move_to_target", portLat, portLng);
          } else {
            buoyCommand.mutate({
              id: mark.gatePortBuoyId,
              command: "move_to_target",
              targetLat: portLat,
              targetLng: portLng,
            });
          }
        }
        
        if (mark.gateStarboardBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gateStarboardBuoyId, "move_to_target", starboardLat, starboardLng);
          } else {
            buoyCommand.mutate({
              id: mark.gateStarboardBuoyId,
              command: "move_to_target",
              targetLat: starboardLat,
              targetLng: starboardLng,
            });
          }
        }
      } else if (mark.assignedBuoyId) {
        // Handle regular marks with single buoy
        if (demoMode) {
          sendDemoCommand(mark.assignedBuoyId, "move_to_target", mark.lat, mark.lng);
        } else {
          buoyCommand.mutate({
            id: mark.assignedBuoyId,
            command: "move_to_target",
            targetLat: mark.lat,
            targetLng: mark.lng,
          });
        }
      }
    });
  }, [marks, demoMode, sendDemoCommand, buoyCommand, toast, activeWeatherData]);

  const handleRotateCourse = useCallback(() => {
    toast({
      title: "Course Rotation",
      description: "Adjusting course to align with current wind direction.",
    });
    setAlertDismissed(true);
  }, [toast]);

  const handleFetchWeatherAtLocation = useCallback((lat: number, lng: number) => {
    weatherByLocation.mutate({ lat, lng }, {
      onSuccess: (data) => {
        // In demo mode, update demo buoys with the fetched weather so everything stays in sync
        if (demoMode && data.windSpeed !== undefined && data.windDirection !== undefined) {
          updateDemoWeather(data.windSpeed, data.windDirection);
        }
        toast({
          title: "Weather Updated",
          description: `Wind: ${data.windSpeed?.toFixed(1) ?? '--'} kn from ${data.windDirection?.toFixed(0) ?? '--'}° (Open-Meteo)`,
        });
      },
      onError: () => {
        toast({
          title: "Weather Fetch Failed",
          description: "Could not fetch weather data for this location.",
          variant: "destructive",
        });
      },
    });
  }, [weatherByLocation, toast, demoMode, updateDemoWeather]);

  const handleBuoyClick = useCallback((buoyId: string) => {
    setSelectedBuoyId(buoyId);
    setSelectedMarkId(null);
  }, []);

  const handleMarkClick = useCallback((markId: string) => {
    if (repositioningMarkId) {
      return;
    }
    setSelectedMarkId(markId);
    setSelectedBuoyId(null);
  }, [repositioningMarkId]);

  // Handle mark selection from SetupPanel (supports gate slot format: "markId:port" or "markId:starboard")
  const handleMarkSelectFromPanel = useCallback((markIdOrSlot: string | null) => {
    if (!markIdOrSlot) {
      setSelectedMarkId(null);
      return;
    }
    
    // Parse gate slot selection format (e.g., "markId:port") to get just the mark ID
    let markId = markIdOrSlot;
    if (markIdOrSlot.includes(":port")) {
      markId = markIdOrSlot.replace(":port", "");
    } else if (markIdOrSlot.includes(":starboard")) {
      markId = markIdOrSlot.replace(":starboard", "");
    }
    
    setSelectedMarkId(markId);
    setSelectedBuoyId(null);
  }, []);

  const handleSaveMark = useCallback((id: string, data: Partial<Mark>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const mark = marks.find(m => m.id === id);
      const previousBuoyId = mark?.assignedBuoyId;
      const newBuoyId = data.assignedBuoyId;
      
      // Handle gate buoy assignments
      const newGatePortBuoyId = data.gatePortBuoyId;
      const newGateStarboardBuoyId = data.gateStarboardBuoyId;
      const previousGatePortBuoyId = mark?.gatePortBuoyId;
      const previousGateStarboardBuoyId = mark?.gateStarboardBuoyId;
      
      updateMark.mutate({ id, data }, {
        onError: (error) => {
          reject(error);
        },
        onSuccess: () => {
          // For gates, calculate port and starboard positions
          if (mark?.isGate) {
            const windDir = activeWeatherData?.windDirection ?? 225;
            const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
            const halfWidthDeg = (gateWidth / 2) / 111000;
            const perpAngle = (windDir + 90) % 360;
            const perpRad = perpAngle * Math.PI / 180;
            
            const portLat = mark.lat + halfWidthDeg * Math.cos(perpRad);
            const portLng = mark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
            const starboardLat = mark.lat - halfWidthDeg * Math.cos(perpRad);
            const starboardLng = mark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
            
            // Dispatch port buoy
            if (newGatePortBuoyId && newGatePortBuoyId !== previousGatePortBuoyId) {
              if (demoMode) {
                sendDemoCommand(newGatePortBuoyId, "move_to_target", portLat, portLng);
              } else {
                buoyCommand.mutate({
                  id: newGatePortBuoyId,
                  command: "move_to_target",
                  targetLat: portLat,
                  targetLng: portLng,
                });
              }
              toast({
                title: "Port Buoy Dispatched",
                description: `Buoy is moving to ${mark.name} (Port).`,
              });
            }
            
            // Dispatch starboard buoy
            if (newGateStarboardBuoyId && newGateStarboardBuoyId !== previousGateStarboardBuoyId) {
              if (demoMode) {
                sendDemoCommand(newGateStarboardBuoyId, "move_to_target", starboardLat, starboardLng);
              } else {
                buoyCommand.mutate({
                  id: newGateStarboardBuoyId,
                  command: "move_to_target",
                  targetLat: starboardLat,
                  targetLng: starboardLng,
                });
              }
              toast({
                title: "Starboard Buoy Dispatched",
                description: `Buoy is moving to ${mark.name} (Starboard).`,
              });
            }
            
            resolve();
            return;
          }
          
          // If a buoy was assigned to this mark, send it to the mark position
          if (newBuoyId && newBuoyId !== previousBuoyId && mark) {
            const targetLat = data.lat ?? mark.lat;
            const targetLng = data.lng ?? mark.lng;
            
            if (demoMode) {
              sendDemoCommand(newBuoyId, "move_to_target", targetLat, targetLng);
              toast({
                title: "Buoy Dispatched",
                description: `Buoy is moving to ${mark.name} at 3.25 knots.`,
              });
            } else {
              buoyCommand.mutate({
                id: newBuoyId,
                command: "move_to_target",
                targetLat,
                targetLng,
              });
              toast({
                title: "Buoy Dispatched",
                description: `Buoy is moving to ${mark.name}.`,
              });
            }
          } else {
            toast({
              title: "Mark Updated",
              description: "Mark has been saved successfully.",
            });
          }
          resolve();
        },
      });
    });
  }, [updateMark, marks, demoMode, sendDemoCommand, buoyCommand, toast, activeWeatherData]);

  const handleDeleteMark = useCallback((id: string) => {
    deleteMark.mutate(id, {
      onSuccess: () => {
        setSelectedMarkId(null);
        
        // Clean up rounding sequence - remove references to deleted mark
        if (currentCourse && currentCourse.roundingSequence) {
          const cleanedSequence = currentCourse.roundingSequence.filter(entry => entry !== id);
          if (cleanedSequence.length !== currentCourse.roundingSequence.length) {
            updateCourse.mutate({ id: currentCourse.id, data: { roundingSequence: cleanedSequence } });
          }
        }
        
        toast({
          title: "Mark Deleted",
          description: "Mark has been removed from the course.",
        });
      },
    });
  }, [deleteMark, toast, currentCourse, updateCourse]);

  const handleAddMark = useCallback((data: { name: string; role: MarkRole; lat?: number; lng?: number }) => {
    if (!currentCourse) {
      toast({
        title: "Error",
        description: "No course available to add mark to.",
        variant: "destructive",
      });
      return;
    }

    const lat = data.lat ?? DEFAULT_CENTER.lat;
    const lng = data.lng ?? DEFAULT_CENTER.lng;
    const order = marks.length;

    createMark.mutate({
      courseId: currentCourse.id,
      name: data.name,
      role: data.role,
      order,
      lat,
      lng,
    });
  }, [currentCourse, marks.length, createMark]);

  const handlePlaceMarkOnMap = useCallback((data: { name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => {
    if (repositioningMarkId) {
      setRepositioningMarkId(null);
    }
    setPendingMarkData(data);
  }, [repositioningMarkId]);

  const [continuousPlacement, setContinuousPlacement] = useState(false);
  const [markCounter, setMarkCounter] = useState(1);

  // Track if placement was auto-enabled by phase change (vs manual button click)
  const [autoPlacementEnabled, setAutoPlacementEnabled] = useState(false);

  // Handle phase changes from SetupPanel - auto-enable placement in marks phase
  const handlePhaseChange = useCallback((phase: string) => {
    setCurrentSetupPhase(phase);
    if (phase === "marks") {
      // Only auto-enable if not already placing marks manually
      if (!isPlacingMark) {
        // Auto-enable continuous placement for course marks
        const courseMarksCount = marks.filter(m => m.isCourseMark === true).length;
        setPendingMarkData({
          name: `M${courseMarksCount + 1}`,
          role: "turning_mark" as MarkRole,
          isStartLine: false,
          isFinishLine: false,
          isCourseMark: true,
        });
        setContinuousPlacement(true);
        setAutoPlacementEnabled(true);
        setMarkCounter(courseMarksCount + 1);
      }
    } else {
      // Exiting marks phase - only stop if it was auto-enabled
      if (autoPlacementEnabled) {
        setPendingMarkData(null);
        setContinuousPlacement(false);
        setAutoPlacementEnabled(false);
        setMarkCounter(1);
      }
    }
  }, [marks, isPlacingMark, autoPlacementEnabled]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isPlacingMark && pendingMarkData) {
      // Require a course to place marks
      if (!currentCourse) {
        toast({
          title: "No Course Available",
          description: "Please wait for the course to load before placing marks.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (isPlacingMark && pendingMarkData && currentCourse) {
      // Use current course marks count for naming in continuous mode
      const courseMarksCount = marks.filter(m => m.isCourseMark === true).length;
      const markName = continuousPlacement ? `M${courseMarksCount + 1}` : pendingMarkData.name;
      createMark.mutate({
        courseId: currentCourse.id,
        name: markName,
        role: pendingMarkData.role,
        order: marks.length,
        lat,
        lng,
        isStartLine: pendingMarkData.isStartLine ?? false,
        isFinishLine: pendingMarkData.isFinishLine ?? false,
        isCourseMark: pendingMarkData.isCourseMark ?? true,
      }, {
        onSuccess: () => {
          if (continuousPlacement) {
            setMarkCounter(prev => prev + 1);
          } else {
            setPendingMarkData(null);
          }
        },
      });
    } else if (repositioningMarkId) {
      updateMark.mutate({ 
        id: repositioningMarkId, 
        data: { lat, lng } 
      }, {
        onSuccess: () => {
          toast({
            title: "Mark Repositioned",
            description: "Mark position has been updated.",
          });
          setRepositioningMarkId(null);
        },
      });
    } else if (gotoMapClickMarkId) {
      const mark = marks.find(m => m.id === gotoMapClickMarkId);
      const buoyId = mark?.assignedBuoyId;
      if (buoyId) {
        buoyCommand.mutate(
          { id: buoyId, command: "move_to_target", targetLat: lat, targetLng: lng },
          {
            onSuccess: () => {
              toast({
                title: "Buoy Dispatched",
                description: `Buoy sent to ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              });
            },
            onError: () => {
              toast({
                title: "Command Failed",
                description: "Failed to send buoy to location",
                variant: "destructive",
              });
            },
          }
        );
      }
      setGotoMapClickMarkId(null);
    } else if (gotoMapClickBuoyId) {
      buoyCommand.mutate(
        { id: gotoMapClickBuoyId, command: "move_to_target", targetLat: lat, targetLng: lng },
        {
          onSuccess: () => {
            toast({
              title: "Buoy Dispatched",
              description: `Buoy sent to ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            });
          },
          onError: () => {
            toast({
              title: "Command Failed",
              description: "Failed to send buoy to location",
              variant: "destructive",
            });
          },
        }
      );
      setGotoMapClickBuoyId(null);
    }
  }, [isPlacingMark, pendingMarkData, currentCourse, marks.length, createMark, repositioningMarkId, updateMark, toast, continuousPlacement, markCounter, gotoMapClickMarkId, gotoMapClickBuoyId, marks, buoyCommand]);

  const handleStopPlacement = useCallback(() => {
    setPendingMarkData(null);
    setContinuousPlacement(false);
    setMarkCounter(1);
  }, []);

  const handleRepositionMark = useCallback((markId: string) => {
    if (repositioningMarkId === markId) {
      setRepositioningMarkId(null);
    } else {
      if (isPlacingMark) {
        setPendingMarkData(null);
        setContinuousPlacement(false);
        setMarkCounter(1);
      }
      setRepositioningMarkId(markId);
      toast({
        title: "Reposition Mark",
        description: "Click on the map to set the new position.",
      });
    }
  }, [repositioningMarkId, isPlacingMark, toast]);

  const handleGotoMapClick = useCallback((markId: string) => {
    if (gotoMapClickMarkId === markId) {
      setGotoMapClickMarkId(null);
    } else {
      const mark = marks.find(m => m.id === markId);
      if (!mark?.assignedBuoyId) {
        toast({
          title: "No buoy assigned",
          description: "Assign a buoy to this mark first.",
          variant: "destructive",
        });
        return;
      }
      if (isPlacingMark) {
        setPendingMarkData(null);
        setContinuousPlacement(false);
        setMarkCounter(1);
      }
      if (repositioningMarkId) {
        setRepositioningMarkId(null);
      }
      setGotoMapClickMarkId(markId);
      toast({
        title: "Tap Map to Go",
        description: "Click on the map to send the buoy there.",
      });
    }
  }, [gotoMapClickMarkId, isPlacingMark, repositioningMarkId, marks, toast]);

  const handleNudgeBuoy = useCallback((markId: string, direction: "north" | "south" | "east" | "west") => {
    const mark = marks.find(m => m.id === markId);
    const buoyId = mark?.assignedBuoyId;
    if (!buoyId) {
      toast({
        title: "No buoy assigned",
        description: "Assign a buoy to this mark first.",
        variant: "destructive",
      });
      return;
    }
    const buoy = buoys.find(b => b.id === buoyId);
    if (!buoy) return;
    
    const NUDGE_AMOUNT = 0.0005; // Approx 55 meters - larger for buoy movement
    let targetLat = buoy.targetLat ?? buoy.lat;
    let targetLng = buoy.targetLng ?? buoy.lng;
    
    switch (direction) {
      case "north": targetLat += NUDGE_AMOUNT; break;
      case "south": targetLat -= NUDGE_AMOUNT; break;
      case "east": targetLng += NUDGE_AMOUNT; break;
      case "west": targetLng -= NUDGE_AMOUNT; break;
    }
    
    buoyCommand.mutate(
      { id: buoyId, command: "move_to_target", targetLat, targetLng },
      {
        onSuccess: () => {
          toast({
            title: "Buoy Nudged",
            description: `Buoy moved ${direction}`,
          });
        },
      }
    );
  }, [marks, buoys, buoyCommand, toast]);

  const handleNudgeMark = useCallback((markId: string, direction: "north" | "south" | "east" | "west") => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    const NUDGE_AMOUNT = 0.0001; // Approx 11 meters
    let newLat = mark.lat;
    let newLng = mark.lng;
    
    switch (direction) {
      case "north": newLat += NUDGE_AMOUNT; break;
      case "south": newLat -= NUDGE_AMOUNT; break;
      case "east": newLng += NUDGE_AMOUNT; break;
      case "west": newLng -= NUDGE_AMOUNT; break;
    }
    
    updateMark.mutate({ id: markId, data: { lat: newLat, lng: newLng } });
  }, [marks, updateMark]);

  const handleBuoyGotoMapClick = useCallback((buoyId: string) => {
    if (gotoMapClickBuoyId === buoyId) {
      setGotoMapClickBuoyId(null);
    } else {
      if (isPlacingMark) {
        setPendingMarkData(null);
        setContinuousPlacement(false);
        setMarkCounter(1);
      }
      if (repositioningMarkId) {
        setRepositioningMarkId(null);
      }
      if (gotoMapClickMarkId) {
        setGotoMapClickMarkId(null);
      }
      setGotoMapClickBuoyId(buoyId);
      toast({
        title: "Tap Map to Go",
        description: "Click on the map to send the buoy there.",
      });
    }
  }, [gotoMapClickBuoyId, isPlacingMark, repositioningMarkId, gotoMapClickMarkId, toast]);

  const handleNudgeBuoyDirect = useCallback((buoyId: string, direction: "north" | "south" | "east" | "west") => {
    const buoy = buoys.find(b => b.id === buoyId);
    if (!buoy) return;
    
    const NUDGE_AMOUNT = 0.0005; // Approx 55 meters
    let targetLat = buoy.targetLat ?? buoy.lat;
    let targetLng = buoy.targetLng ?? buoy.lng;
    
    switch (direction) {
      case "north": targetLat += NUDGE_AMOUNT; break;
      case "south": targetLat -= NUDGE_AMOUNT; break;
      case "east": targetLng += NUDGE_AMOUNT; break;
      case "west": targetLng -= NUDGE_AMOUNT; break;
    }
    
    buoyCommand.mutate(
      { id: buoyId, command: "move_to_target", targetLat, targetLng },
      {
        onSuccess: () => {
          toast({
            title: "Buoy Nudged",
            description: `Buoy moved ${direction}`,
          });
        },
      }
    );
  }, [buoys, buoyCommand, toast]);

  const handleUpdateCourse = useCallback((data: Partial<Course>) => {
    if (!currentCourse) return;
    updateCourse.mutate({ id: currentCourse.id, data });
  }, [currentCourse, updateCourse]);

  const handleUpdateMarks = useCallback((updatedMarks: Mark[]) => {
    updatedMarks.forEach(mark => {
      const original = marks.find(m => m.id === mark.id);
      if (original && (original.lat !== mark.lat || original.lng !== mark.lng)) {
        updateMark.mutate({ id: mark.id, data: { lat: mark.lat, lng: mark.lng } });
      }
    });
  }, [marks, updateMark]);

  // Save course with a name - duplicates the course with all marks
  const handleSaveCourse = useCallback(async (name: string) => {
    if (!currentCourse) {
      toast({
        title: "No Course",
        description: "No course available to save.",
        variant: "destructive",
      });
      return;
    }
    
    if (marks.length === 0) {
      toast({
        title: "No Marks",
        description: "Add marks to the course before saving.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Calculate course center from marks
      const centerLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
      const centerLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
      
      // Create new course with the name
      const newCourse = await createCourse.mutateAsync({
        name,
        shape: currentCourse.shape || "custom",
        centerLat,
        centerLng,
        rotation: currentCourse.rotation || 0,
        scale: currentCourse.scale || 1,
      });
      
      // Copy all marks to the new course using apiRequest for proper error handling
      for (const mark of marks) {
        const res = await apiRequest("POST", "/api/marks", {
          courseId: newCourse.id,
          name: mark.name,
          role: mark.role,
          order: mark.order,
          lat: mark.lat,
          lng: mark.lng,
          isStartLine: mark.isStartLine,
          isFinishLine: mark.isFinishLine,
          isCourseMark: mark.isCourseMark,
          isGate: mark.isGate,
          gateWidthBoatLengths: mark.gateWidthBoatLengths,
          boatLengthMeters: mark.boatLengthMeters,
          gateSide: mark.gateSide,
          gatePartnerId: mark.gatePartnerId,
        });
        if (!res.ok) {
          throw new Error("Failed to copy mark");
        }
      }
      
      // Update the new course with the rounding sequence
      if (roundingSequence.length > 0) {
        await updateCourse.mutateAsync({ 
          id: newCourse.id, 
          data: { roundingSequence } 
        });
      }
      
      // Invalidate courses query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      
      toast({
        title: "Course Saved",
        description: `Race course "${name}" has been saved as a template.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save the course. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentCourse, marks, roundingSequence, createCourse, updateCourse, toast]);

  // Load a saved course
  const handleLoadCourse = useCallback((courseId: string) => {
    setActiveCourseId(courseId);
    toast({
      title: "Course Loaded",
      description: "Race course has been loaded.",
    });
  }, [toast]);

  // Clear all marks from the current course and set assigned buoys to idle
  const handleClearAllMarks = useCallback(async () => {
    if (!currentCourse) return;
    
    try {
      // First, cancel any assigned buoys (set them to idle)
      for (const mark of marks) {
        // Cancel regular assigned buoy
        if (mark.assignedBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.assignedBuoyId, "cancel");
          } else {
            await buoyCommand.mutateAsync({
              id: mark.assignedBuoyId,
              command: "cancel",
            });
          }
        }
        // Cancel gate port buoy
        if (mark.gatePortBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gatePortBuoyId, "cancel");
          } else {
            await buoyCommand.mutateAsync({
              id: mark.gatePortBuoyId,
              command: "cancel",
            });
          }
        }
        // Cancel gate starboard buoy
        if (mark.gateStarboardBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gateStarboardBuoyId, "cancel");
          } else {
            await buoyCommand.mutateAsync({
              id: mark.gateStarboardBuoyId,
              command: "cancel",
            });
          }
        }
      }
      
      // Delete all marks
      await deleteAllMarks.mutateAsync(currentCourse.id);
      
      // Clear the rounding sequence
      if (currentCourse) {
        await updateCourse.mutateAsync({ id: currentCourse.id, data: { roundingSequence: [] } });
      }
      
      // Reset all local state
      setSelectedMarkId(null);
      setLocalRoundingSequence([]);
      setPendingMarkData(null);
      
      toast({
        title: "Course Cleared",
        description: "All marks have been removed and buoys set to idle.",
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Could not clear the course. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentCourse, marks, demoMode, sendDemoCommand, buoyCommand, deleteAllMarks, updateCourse, toast]);

  // Apply course transformation (called directly or after confirmation)
  const applyCourseTransform = useCallback(async (transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number }) => {
    if (marks.length === 0) return;

    // Calculate course center
    const centerLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
    const centerLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;

    // Calculate new positions for all marks
    const newPositions = marks.map(mark => {
      let newLat = mark.lat;
      let newLng = mark.lng;

      // Apply scaling (relative to center)
      if (transform.scale) {
        const dLat = mark.lat - centerLat;
        const dLng = mark.lng - centerLng;
        newLat = centerLat + dLat * transform.scale;
        newLng = centerLng + dLng * transform.scale;
      }

      // Apply rotation (relative to center)
      if (transform.rotation) {
        const dLat = newLat - centerLat;
        const dLng = newLng - centerLng;
        const angle = transform.rotation * Math.PI / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotatedDLat = dLat * cosA - dLng * sinA;
        const rotatedDLng = dLat * sinA + dLng * cosA;
        newLat = centerLat + rotatedDLat;
        newLng = centerLng + rotatedDLng;
      }

      // Apply translation
      if (transform.translateLat) {
        newLat += transform.translateLat;
      }
      if (transform.translateLng) {
        newLng += transform.translateLng;
      }

      return { mark, newLat, newLng };
    });

    // Update all mark positions
    for (const { mark, newLat, newLng } of newPositions) {
      await updateMark.mutateAsync({ id: mark.id, data: { lat: newLat, lng: newLng } });
      
      // If mark has assigned buoy, dispatch it to new position
      if (mark.assignedBuoyId) {
        if (demoMode) {
          sendDemoCommand(mark.assignedBuoyId, "move_to_target", newLat, newLng);
        } else {
          buoyCommand.mutate({
            id: mark.assignedBuoyId,
            command: "move_to_target",
            targetLat: newLat,
            targetLng: newLng,
          });
        }
      }
      
      // Handle gate buoys
      if (mark.isGate && (mark.gatePortBuoyId || mark.gateStarboardBuoyId)) {
        const windDir = activeWeatherData?.windDirection ?? 225;
        const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
        const halfWidthDeg = (gateWidth / 2) / 111000;
        const perpAngle = (windDir + 90) % 360;
        const perpRad = perpAngle * Math.PI / 180;
        
        const portLat = newLat + halfWidthDeg * Math.cos(perpRad);
        const portLng = newLng + halfWidthDeg * Math.sin(perpRad) / Math.cos(newLat * Math.PI / 180);
        const starboardLat = newLat - halfWidthDeg * Math.cos(perpRad);
        const starboardLng = newLng - halfWidthDeg * Math.sin(perpRad) / Math.cos(newLat * Math.PI / 180);
        
        if (mark.gatePortBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gatePortBuoyId, "move_to_target", portLat, portLng);
          } else {
            buoyCommand.mutate({
              id: mark.gatePortBuoyId,
              command: "move_to_target",
              targetLat: portLat,
              targetLng: portLng,
            });
          }
        }
        if (mark.gateStarboardBuoyId) {
          if (demoMode) {
            sendDemoCommand(mark.gateStarboardBuoyId, "move_to_target", starboardLat, starboardLng);
          } else {
            buoyCommand.mutate({
              id: mark.gateStarboardBuoyId,
              command: "move_to_target",
              targetLat: starboardLat,
              targetLng: starboardLng,
            });
          }
        }
      }
    }

    toast({
      title: "Course Adjusted",
      description: transform.scale ? (transform.scale > 1 ? "Course enlarged." : "Course reduced.") :
                   transform.rotation ? "Course rotated." : "Course moved.",
    });
  }, [marks, updateMark, demoMode, sendDemoCommand, buoyCommand, activeWeatherData, toast]);

  // Transform course (scale, rotate, move) - shows confirmation if buoys are assigned
  const handleTransformCourse = useCallback((transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number }) => {
    if (marks.length === 0) return;

    // Check if any marks have assigned buoys
    const hasAssignedBuoys = marks.some(m => 
      m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId
    );

    if (hasAssignedBuoys) {
      // Show confirmation dialog
      setPendingCourseTransform({ transform, hasAssignedBuoys: true });
    } else {
      // Apply transformation directly
      applyCourseTransform(transform);
    }
  }, [marks, applyCourseTransform]);

  const handleAlignCourseToWind = useCallback(() => {
    if (!activeWeatherData || marks.length === 0) return;
    
    const windDirection = activeWeatherData.windDirection;
    
    const startMarks = marks.filter(m => m.isStartLine);
    const windwardMark = marks.find(m => m.role === "windward" || (m.isCourseMark && m.name === "M1"));
    
    let currentCourseAngle = 0;
    if (startMarks.length >= 2 && windwardMark) {
      const startCenter = {
        lat: startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length,
        lng: startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length,
      };
      const dLat = windwardMark.lat - startCenter.lat;
      const dLng = windwardMark.lng - startCenter.lng;
      currentCourseAngle = Math.atan2(dLng, dLat) * 180 / Math.PI;
    }
    
    const targetAngle = windDirection;
    const rotationDelta = targetAngle - currentCourseAngle;
    
    handleTransformCourse({ rotation: rotationDelta });
    
    toast({
      title: "Course Aligned to Wind",
      description: `Course rotated to align with wind from ${windDirection.toFixed(0)}°`,
    });
  }, [activeWeatherData, marks, handleTransformCourse, toast]);

  // Handle finish line preview callback
  const handleFinishLinePreview = useCallback((selectedMarkIds: Set<string>) => {
    setFinishLinePreviewIds(selectedMarkIds);
  }, []);

  const handleCreateRace = useCallback(async (data: {
    name: string;
    type: EventType;
    boatClass: string;
    targetDuration: number;
    courseShape: CourseShape;
    courseName: string;
  }) => {
    try {
      // First create the new course
      const course = await createCourse.mutateAsync({
        name: data.courseName,
        shape: data.courseShape,
        centerLat: DEFAULT_CENTER.lat,
        centerLng: DEFAULT_CENTER.lng,
        rotation: 0,
        scale: 1,
      });

      // Immediately set the active course to the new one BEFORE creating marks
      // This ensures the UI won't show stale marks from previous course
      setActiveCourseId(course.id);
      
      // Clear any cached marks for the new course to start fresh
      queryClient.removeQueries({ queryKey: ["/api/courses", course.id, "marks"] });

      const event = await createEvent.mutateAsync({
        name: data.name,
        type: data.type,
        sailClubId: "e026546d-c0b6-480e-b154-2d69fd341c11",
        boatClass: data.boatClass,
        targetDuration: data.targetDuration,
        courseId: course.id,
      });
      
      setActiveEventId(event.id);

      // Create marks for the new course
      const shapeMarks = generateShapeMarks(data.courseShape, DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      for (const mark of shapeMarks) {
        await createMark.mutateAsync({
          courseId: course.id,
          name: mark.name,
          role: mark.role,
          order: mark.order,
          lat: mark.lat,
          lng: mark.lng,
          isStartLine: mark.isStartLine,
          isFinishLine: mark.isFinishLine,
          isCourseMark: mark.isCourseMark,
        });
      }
      
      // Force refresh all queries to ensure UI shows new data
      await queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", course.id, "marks"] });

      if (data.courseShape === "custom") {
        setPendingMarkData({ name: "Mark 1", role: "turning_mark" });
        setContinuousPlacement(true);
        setMarkCounter(1);
        toast({
          title: "Custom Course",
          description: "Click on the map to add marks. Press 'Done' when finished.",
        });
      } else {
        toast({
          title: "Race Created",
          description: `${data.name} has been created with a ${data.courseShape} course.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create race. Please try again.",
        variant: "destructive",
      });
    }
  }, [createCourse, createEvent, createMark, toast, setActiveCourseId, setActiveEventId]);

  // Auto-assign buoys to minimize maximum deployment time (bottleneck assignment)
  const handleAutoAssignBuoys = useCallback(() => {
    // Build list of slots that need buoys
    interface Slot {
      markId: string;
      markName: string;
      lat: number;
      lng: number;
      type: 'regular' | 'port' | 'starboard';
      currentBuoyId?: string;
    }
    
    const slots: Slot[] = [];
    const windDir = activeWeatherData?.windDirection ?? 225;
    
    marks.forEach(mark => {
      if (mark.isGate) {
        // Gate needs two positions
        const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
        const halfWidthDeg = (gateWidth / 2) / 111000;
        const perpAngle = (windDir + 90) % 360;
        const perpRad = perpAngle * Math.PI / 180;
        
        const portLat = mark.lat + halfWidthDeg * Math.cos(perpRad);
        const portLng = mark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
        const starboardLat = mark.lat - halfWidthDeg * Math.cos(perpRad);
        const starboardLng = mark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
        
        if (!mark.gatePortBuoyId) {
          slots.push({ markId: mark.id, markName: mark.name, lat: portLat, lng: portLng, type: 'port' });
        }
        if (!mark.gateStarboardBuoyId) {
          slots.push({ markId: mark.id, markName: mark.name, lat: starboardLat, lng: starboardLng, type: 'starboard' });
        }
      } else if (!mark.assignedBuoyId) {
        slots.push({ markId: mark.id, markName: mark.name, lat: mark.lat, lng: mark.lng, type: 'regular' });
      }
    });
    
    if (slots.length === 0) {
      toast({
        title: "All Assigned",
        description: "All marks already have buoys assigned.",
      });
      return;
    }
    
    // Get available buoys (not already assigned)
    const assignedBuoyIds = new Set<string>();
    marks.forEach(mark => {
      if (mark.assignedBuoyId) assignedBuoyIds.add(mark.assignedBuoyId);
      if (mark.gatePortBuoyId) assignedBuoyIds.add(mark.gatePortBuoyId);
      if (mark.gateStarboardBuoyId) assignedBuoyIds.add(mark.gateStarboardBuoyId);
    });
    
    const availableBuoys = buoys.filter(b => !assignedBuoyIds.has(b.id));
    
    if (availableBuoys.length < slots.length) {
      toast({
        title: "Not Enough Buoys",
        description: `Need ${slots.length} buoys but only ${availableBuoys.length} available.`,
        variant: "destructive",
      });
      return;
    }
    
    // Greedy assignment to minimize maximum distance
    // For each slot, assign the closest available buoy
    const assignments: { slot: Slot; buoyId: string; distance: number }[] = [];
    const usedBuoys = new Set<string>();
    
    // Sort slots by minimum distance to any buoy (descending) - assign hardest first
    const slotsWithMinDist = slots.map(slot => {
      const minDist = Math.min(...availableBuoys.map(b => 
        haversineDistance(slot.lat, slot.lng, b.lat, b.lng)
      ));
      return { slot, minDist };
    });
    slotsWithMinDist.sort((a, b) => b.minDist - a.minDist);
    
    for (const { slot } of slotsWithMinDist) {
      // Find closest available buoy
      let bestBuoy: typeof availableBuoys[0] | null = null;
      let bestDist = Infinity;
      
      for (const buoy of availableBuoys) {
        if (usedBuoys.has(buoy.id)) continue;
        const dist = haversineDistance(slot.lat, slot.lng, buoy.lat, buoy.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestBuoy = buoy;
        }
      }
      
      if (bestBuoy) {
        assignments.push({ slot, buoyId: bestBuoy.id, distance: bestDist });
        usedBuoys.add(bestBuoy.id);
      }
    }
    
    // Build assignment operations with proper structure for batch execution
    const assignmentOps = assignments.map(({ slot, buoyId, distance }) => {
      const updateData: Partial<Mark> = {};
      if (slot.type === 'port') {
        updateData.gatePortBuoyId = buoyId;
      } else if (slot.type === 'starboard') {
        updateData.gateStarboardBuoyId = buoyId;
      } else {
        updateData.assignedBuoyId = buoyId;
      }
      
      return {
        markId: slot.markId,
        markName: slot.markName,
        updateData,
        buoyId,
        targetLat: slot.lat,
        targetLng: slot.lng,
        distance,
      };
    });
    
    const maxDist = Math.max(...assignments.map(a => a.distance));
    const estimatedTime = maxDist / 0.5;
    
    toast({
      title: "Auto-Assigning Buoys",
      description: `Assigning ${assignmentOps.length} buoys...`,
    });

    executeAutoAssignWithRecovery(assignmentOps, {
      courseId: courseId,
      updateMarkFn: async (markId, data) => {
        const res = await apiRequest("PATCH", `/api/marks/${markId}`, data);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to update mark");
        }
      },
      clearMarkAssignmentFn: async (markId, data) => {
        const res = await apiRequest("PATCH", `/api/marks/${markId}`, data);
        if (!res.ok) {
          console.error("Failed to rollback mark assignment");
        }
      },
      sendBuoyCommandFn: async (buoyId, lat, lng) => {
        if (demoMode) {
          sendDemoCommand(buoyId, "move_to_target", lat, lng);
          return;
        }
        const res = await apiRequest("POST", `/api/buoys/${buoyId}/command`, {
          command: "move_to_target",
          targetLat: lat,
          targetLng: lng,
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to send buoy command");
        }
      },
    }).then((result) => {
      invalidateRelatedQueries("marks", courseId);
      invalidateRelatedQueries("buoys", courseId);
      
      if (result.success) {
        toast({
          title: "Auto-Assignment Complete",
          description: `Assigned ${assignmentOps.length} buoys. Max deployment: ${Math.round(estimatedTime / 60)} min.`,
        });
      } else {
        let description = `Completed ${result.completed} of ${assignmentOps.length * 2} operations. ${result.failed} failed.`;
        if (result.marksAssignedWithoutBuoyCommand.length > 0) {
          description += ` Marks assigned but buoys not dispatched: ${result.marksAssignedWithoutBuoyCommand.join(", ")}`;
        }
        toast({
          title: "Auto-Assignment Partial",
          description,
          variant: "destructive",
        });
      }
    }).catch((error) => {
      toast({
        title: "Auto-Assignment Failed",
        description: error.message || "An error occurred during auto-assignment",
        variant: "destructive",
      });
    });
  }, [marks, buoys, activeWeatherData, courseId, demoMode, sendDemoCommand, toast]);

  const isLoading = buoysLoading || eventsLoading || coursesLoading;

  if (isLoading && !demoMode) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="race-control-loading">
        <div className="h-16 border-b bg-card flex items-center px-4 gap-4">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex-1" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="flex-1 flex">
          <div className="flex-1 p-4">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
          <div className="w-96 border-l p-4 space-y-4 hidden lg:block">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const displayEvent: Event = currentEvent ?? {
    id: "default",
    name: "New Event",
    type: "race",
    sailClubId: "default",
    boatClass: "Laser",
    targetDuration: 40,
    courseId: null,
    createdAt: new Date(),
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="race-control-page">
      <TopBar
        eventName={displayEvent.name}
        clubName="Oakland Yacht Club"
        demoMode={demoMode}
        userRole={user?.role}
        onSettingsClick={() => setSettingsOpen(true)}
        onToggleDemoMode={toggleDemoMode}
        onBackClick={() => {
          if (user?.role === "super_admin") {
            setLocation("/admin");
          } else if (user?.role === "club_manager") {
            setLocation("/clubs/" + user?.sailClubId);
          }
        }}
        onClearCourse={() => setShowClearCourseConfirm(true)}
      />

      {!alertDismissed && (
        <AlertBanner 
          onDismiss={() => setAlertDismissed(true)}
          onRotateCourse={handleRotateCourse}
        />
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        <main className="flex-1 relative min-w-0 overflow-hidden">
          <LeafletMap 
            buoys={buoys}
            marks={marks}
            selectedBuoyId={selectedBuoyId}
            selectedMarkId={selectedMarkId}
            weatherData={activeWeatherData}
            onBuoyClick={handleBuoyClick}
            onMarkClick={handleMarkClick}
            onMapClick={handleMapClick}
            onMarkDragEnd={(markId, lat, lng) => {
              const mark = marks.find(m => m.id === markId);
              const hasAssignedBuoy = !!(mark?.assignedBuoyId || mark?.gatePortBuoyId || mark?.gateStarboardBuoyId);
              if (hasAssignedBuoy) {
                // Show confirmation dialog for marks with assigned buoys
                setPendingMarkMove({ markId, lat, lng, hasAssignedBuoy: true });
              } else {
                // Directly update marks without assigned buoys
                updateMark.mutate({ id: markId, data: { lat, lng } });
              }
            }}
            isPlacingMark={isPlacingMark || !!repositioningMarkId || !!gotoMapClickMarkId || !!gotoMapClickBuoyId}
            isContinuousPlacement={continuousPlacement}
            onStopPlacement={handleStopPlacement}
            finishLinePreviewIds={finishLinePreviewIds}
            mapOrientation={mapOrientation}
            onOrientationChange={setMapOrientation}
            onFetchWeatherAtLocation={handleFetchWeatherAtLocation}
            isWeatherLoading={weatherByLocation.isPending}
            onAlignCourseToWind={handleAlignCourseToWind}
            roundingSequence={roundingSequence}
            showLabels={showLabels}
            onToggleLabels={() => setShowLabels(!showLabels)}
          />
        </main>

        <aside className="w-96 xl:w-[440px] border-l shrink-0 hidden lg:flex lg:flex-col h-full overflow-hidden">
          {selectedBuoy ? (
            <BuoyDetailPanel 
              buoy={selectedBuoy} 
              onClose={() => { setSelectedBuoyId(null); setGotoMapClickBuoyId(null); }}
              demoSendCommand={sendDemoCommand}
              onTapMapToGoto={() => handleBuoyGotoMapClick(selectedBuoy.id)}
              isTapMapMode={gotoMapClickBuoyId === selectedBuoy.id}
              onNudgeBuoy={(direction) => handleNudgeBuoyDirect(selectedBuoy.id, direction)}
            />
          ) : selectedMark ? (
            <MarkEditPanel
              mark={selectedMark}
              buoys={buoys}
              onClose={() => { setSelectedMarkId(null); setGotoMapClickMarkId(null); }}
              onSave={(data) => handleSaveMark(selectedMark.id, data)}
              onDelete={() => handleDeleteMark(selectedMark.id)}
              onReposition={() => handleRepositionMark(selectedMark.id)}
              onNudge={(direction) => handleNudgeMark(selectedMark.id, direction)}
              isRepositioning={!!repositioningMarkId}
            />
          ) : (
            <SetupPanel 
              event={displayEvent}
              course={currentCourse}
              buoys={buoys}
              marks={marks}
              savedCourses={courses}
              roundingSequence={roundingSequence}
              windDirection={weatherData?.windDirection}
              onMarkSelect={handleMarkSelectFromPanel}
              onBuoySelect={setSelectedBuoyId}
              onDeployCourse={handleDeployCourse}
              onSaveMark={handleSaveMark}
              onAddMark={handleAddMark}
              onPlaceMarkOnMap={handlePlaceMarkOnMap}
              onSaveCourse={handleSaveCourse}
              onLoadCourse={handleLoadCourse}
              onTransformCourse={handleTransformCourse}
              onFinishLinePreview={handleFinishLinePreview}
              onUpdateSequence={handleUpdateSequence}
              onAutoAssignBuoys={handleAutoAssignBuoys}
              onPhaseChange={handlePhaseChange}
              onClearAllMarks={handleClearAllMarks}
            />
          )}
        </aside>
      </div>

      <SettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        buoys={buoys}
      />

      {/* Confirmation dialog for moving marks with assigned buoys */}
      <AlertDialog open={!!pendingMarkMove} onOpenChange={(open) => !open && setPendingMarkMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Move Buoy to New Position?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const mark = pendingMarkMove ? marks.find(m => m.id === pendingMarkMove.markId) : null;
                const buoyName = mark?.assignedBuoyId 
                  ? buoys.find(b => b.id === mark.assignedBuoyId)?.name 
                  : mark?.gatePortBuoyId 
                    ? "Gate buoys" 
                    : "Assigned buoy";
                return (
                  <>
                    This mark has <span className="font-semibold">{buoyName}</span> assigned to it.
                    <span className="block mt-2">
                      The buoy will be dispatched to the new position when you confirm.
                    </span>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-move-mark">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMarkMove) {
                  // Update the mark position
                  updateMark.mutate({ 
                    id: pendingMarkMove.markId, 
                    data: { lat: pendingMarkMove.lat, lng: pendingMarkMove.lng } 
                  }, {
                    onSuccess: () => {
                      // Dispatch the assigned buoys to the new position
                      const mark = marks.find(m => m.id === pendingMarkMove.markId);
                      if (mark?.assignedBuoyId) {
                        if (demoMode) {
                          sendDemoCommand(mark.assignedBuoyId, "move_to_target", pendingMarkMove.lat, pendingMarkMove.lng);
                        } else {
                          buoyCommand.mutate({
                            id: mark.assignedBuoyId,
                            command: "move_to_target",
                            targetLat: pendingMarkMove.lat,
                            targetLng: pendingMarkMove.lng,
                          });
                        }
                      }
                      // Handle gate buoys
                      if (mark?.isGate && (mark.gatePortBuoyId || mark.gateStarboardBuoyId)) {
                        const windDir = activeWeatherData?.windDirection ?? 225;
                        const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
                        const halfWidthDeg = (gateWidth / 2) / 111000;
                        const perpAngle = (windDir + 90) % 360;
                        const perpRad = perpAngle * Math.PI / 180;
                        
                        const portLat = pendingMarkMove.lat + halfWidthDeg * Math.cos(perpRad);
                        const portLng = pendingMarkMove.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(pendingMarkMove.lat * Math.PI / 180);
                        const starboardLat = pendingMarkMove.lat - halfWidthDeg * Math.cos(perpRad);
                        const starboardLng = pendingMarkMove.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(pendingMarkMove.lat * Math.PI / 180);
                        
                        if (mark.gatePortBuoyId) {
                          if (demoMode) {
                            sendDemoCommand(mark.gatePortBuoyId, "move_to_target", portLat, portLng);
                          } else {
                            buoyCommand.mutate({
                              id: mark.gatePortBuoyId,
                              command: "move_to_target",
                              targetLat: portLat,
                              targetLng: portLng,
                            });
                          }
                        }
                        if (mark.gateStarboardBuoyId) {
                          if (demoMode) {
                            sendDemoCommand(mark.gateStarboardBuoyId, "move_to_target", starboardLat, starboardLng);
                          } else {
                            buoyCommand.mutate({
                              id: mark.gateStarboardBuoyId,
                              command: "move_to_target",
                              targetLat: starboardLat,
                              targetLng: starboardLng,
                            });
                          }
                        }
                      }
                      toast({
                        title: "Mark Moved",
                        description: "Buoy dispatched to new position.",
                      });
                    },
                  });
                  setPendingMarkMove(null);
                }
              }}
              data-testid="button-confirm-move-mark"
            >
              Move Buoy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog for course transformation with assigned buoys */}
      <AlertDialog open={!!pendingCourseTransform} onOpenChange={(open) => !open && setPendingCourseTransform(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Transform Course with Assigned Buoys?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const assignedCount = marks.filter(m => 
                  m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId
                ).length;
                const transformType = pendingCourseTransform?.transform.scale 
                  ? (pendingCourseTransform.transform.scale > 1 ? "enlarge" : "reduce")
                  : pendingCourseTransform?.transform.rotation 
                    ? "rotate" 
                    : "move";
                return (
                  <>
                    You are about to <span className="font-semibold">{transformType}</span> the course.
                    <span className="block mt-2">
                      <span className="font-semibold">{assignedCount}</span> mark{assignedCount !== 1 ? 's have' : ' has'} assigned buoys that will be dispatched to their new positions.
                    </span>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-transform">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingCourseTransform) {
                  applyCourseTransform(pendingCourseTransform.transform);
                  setPendingCourseTransform(null);
                }
              }}
              data-testid="button-confirm-transform"
            >
              Transform Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation dialog for clearing course from top bar */}
      <AlertDialog open={showClearCourseConfirm} onOpenChange={setShowClearCourseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Clear Course?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all marks and reset the course. Any assigned buoys will be set to idle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear-course">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                handleClearAllMarks();
                setShowClearCourseConfirm(false);
              }}
              data-testid="button-confirm-clear-course"
            >
              Clear Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
