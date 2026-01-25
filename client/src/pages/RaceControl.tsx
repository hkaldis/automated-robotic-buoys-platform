import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { LeafletMap } from "@/components/LeafletMap";
import { SetupPanel } from "@/components/SetupPanel";
import { BuoyDetailPanel } from "@/components/BuoyDetailPanel";
import { MarkEditPanel } from "@/components/MarkEditPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/use-settings";
import type { Event, Buoy, Mark, Course, MarkRole, CourseShape, EventType, SiblingBuoy } from "@shared/schema";
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
  useUpdateEvent,
  useSaveCourseSnapshot,
  useDeleteCourseSnapshot,
  useBoatClasses,
  type CourseSnapshot,
  type SnapshotMark,
} from "@/hooks/use-api";
import { QuickStartDialog } from "@/components/QuickStartDialog";
import { QuickStartWizard } from "@/components/QuickStartWizard";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import { useDemoModeContext } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
import { executeAutoAssignWithRecovery } from "@/lib/batchedMutations";
import { useBuoyFollow } from "@/hooks/use-buoy-follow";
import { generateTemplateMarks, type ShapeTemplate } from "@/lib/shape-templates";
import { WindShiftAlert } from "@/components/WindShiftAlert";
import { FloatingActionBar } from "@/components/FloatingActionBar";
import { FleetStatusPanel } from "@/components/FleetStatusPanel";
import { BoatCountDialog } from "@/components/BoatCountDialog";

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
        { name: "Pin", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: true, isCourseMark: false },
        // Point 1 - Windward point (one leg length directly upwind from base)
        { name: "Point 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Point 2 - Wing point (60° to STARBOARD, equal leg length from windward)
        // Position: halfway up in lat, offset to starboard by sin(60°)*legLength
        { name: "Point 2 (Wing)", role: "wing", lat: baseLat + windwardLegLength * cosReach, lng: baseLng + windwardLegLength * sinReach, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Point 3 - Leeward point (at bottom/downwind, on centerline)
        // Equal leg length from wing point back to leeward completes the equilateral
        { name: "Point 3 (Leeward)", role: "leeward", lat: baseLat, lng: baseLng, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
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
        { name: "Pin", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: false, isCourseMark: false },
        // Point 1 - Windward point (one leg length directly upwind)
        { name: "Point 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Point 2 - Wing point (60° reaching leg to starboard from windward at 67% length)
        // Position: cos(60°) up from base, sin(60°) to starboard
        { name: "Point 2 (Wing)", role: "wing", lat: baseLat + reachLegLength * cosReach, lng: baseLng + reachLegLength * sinReach, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Leeward gate (3s/3p) - square to wind, 10 hull lengths wide
        { name: "Point 3s (Gate Starboard)", role: "gate", lat: leewardGateLat, lng: baseLng + gateHalfWidth, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
        { name: "Point 3p (Gate Port)", role: "gate", lat: leewardGateLat, lng: baseLng - gateHalfWidth, order: 5, isStartLine: false, isFinishLine: false, isCourseMark: true },
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
        { name: "Pin", role: "pin", lat: startLineLat, lng: baseLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: false, isCourseMark: false },
        // Point 1 - Windward point (one leg length directly upwind from start line center)
        { name: "Point 1 (Windward)", role: "windward", lat: baseLat + windwardLegLength, lng: baseLng, order: 2, isStartLine: false, isFinishLine: false, isCourseMark: true },
        // Gate points at leeward end (at base latitude, straddling centerline)
        // Starboard point at +lng, Port at -lng
        { name: "Point 3s (Gate Starboard)", role: "gate", lat: leewardGateLat, lng: baseLng + gateHalfWidth, order: 3, isStartLine: false, isFinishLine: false, isCourseMark: true },
        { name: "Point 3p (Gate Port)", role: "gate", lat: leewardGateLat, lng: baseLng - gateHalfWidth, order: 4, isStartLine: false, isFinishLine: false, isCourseMark: true },
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
  const { mapLayer, showSeaMarks, showSiblingBuoys, integrationSettings } = useSettings();
  const [, setLocation] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [courseMenuSaveOpen, setCourseMenuSaveOpen] = useState(false);
  const [courseMenuLoadOpen, setCourseMenuLoadOpen] = useState(false);
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
  
  // Sync activeEventId with URL parameter when it changes (navigation or refresh)
  // Using ref to track previous propEventId to avoid infinite loops
  const prevPropEventIdRef = useRef(propEventId);
  useEffect(() => {
    if (propEventId !== prevPropEventIdRef.current) {
      prevPropEventIdRef.current = propEventId;
      if (propEventId) {
        setActiveEventId(propEventId);
        // Reset course and selection state when event changes
        setActiveCourseId(null);
        setLocalRoundingSequence([]);
        setSelectedMarkId(null);
        setSelectedBuoyId(null);
        setFinishLinePreviewIds(new Set());
      }
    }
  }, [propEventId]);
  const [finishLinePreviewIds, setFinishLinePreviewIds] = useState<Set<string>>(new Set());
  const [mapOrientation, setMapOrientation] = useState<"north" | "head-to-wind">("north");
  const [localRoundingSequence, setLocalRoundingSequence] = useState<string[]>([]);
  const [showLabels, setShowLabels] = useState(true);
  const [showWindArrows, setShowWindArrows] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isSetupPanelCollapsed, setIsSetupPanelCollapsed] = useState(false);
  const [showFleetPanel, setShowFleetPanel] = useState(false);
  
  // Undo state for last mark position change
  const [lastMarkMove, setLastMarkMove] = useState<{ markId: string; prevLat: number; prevLng: number; timestamp: number } | null>(null);
  const [isGpsLocating, setIsGpsLocating] = useState(false);
  
  // Undo state for auto-adjust
  const [lastAutoAdjust, setLastAutoAdjust] = useState<{ positions: Array<{ id: string; lat: number; lng: number }>; timestamp: number } | null>(null);
  
  // Undo state for course transform (move/rotate/scale)
  const [lastCourseTransform, setLastCourseTransform] = useState<{ positions: Array<{ id: string; lat: number; lng: number }>; timestamp: number } | null>(null);
  
  // Current map center for loading courses at current location
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
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
  
  // Move course mode - when enabled, clicking on map moves entire course to that location
  const [moveCourseMode, setMoveCourseMode] = useState(false);
  
  // Wind direction when course was last aligned - for wind shift detection
  const [courseSetupWindDirection, setCourseSetupWindDirection] = useState<number | null>(null);
  
  // Template loading workflow state
  const [showBoatCountDialog, setShowBoatCountDialog] = useState(false);
  const [pendingTemplateSetup, setPendingTemplateSetup] = useState<{
    step: "fetch_weather" | "align_wind" | "boat_count" | "resize_start";
    snapshotId?: string;
    fleetConfig?: { raceType: "fleet" | "match" | "team"; boatCount?: number };
  } | null>(null);
  
  const { toast } = useToast();

  const { enabled: demoMode, toggleDemoMode, demoBuoys, demoSiblingBuoys, demoBoats, sendCommand: sendDemoCommand, updateDemoWeather, repositionDemoBuoys, repositionDemoBoats } = useDemoModeContext();

  const { data: allBuoys = [], isLoading: allBuoysLoading } = useBuoys();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: boatClasses = [] } = useBoatClasses();
  
  const { data: eventBuoys = [], isLoading: eventBuoysLoading } = useQuery<Buoy[]>({
    queryKey: [`/api/events/${activeEventId}/buoys`],
    enabled: !!activeEventId && !demoMode,
  });

  const { data: apiSiblingBuoys = [] } = useQuery<SiblingBuoy[]>({
    queryKey: [`/api/events/${activeEventId}/sibling-buoys`],
    enabled: !!activeEventId && !demoMode,
  });
  const siblingBuoys = demoMode ? demoSiblingBuoys : apiSiblingBuoys;
  
  const buoysLoading = activeEventId ? eventBuoysLoading : allBuoysLoading;
  const apiBuoys = activeEventId ? eventBuoys : allBuoys;
  const { data: weatherData, isLoading: weatherLoading } = useWeatherData();
  const weatherByLocation = useWeatherByLocation();
  
  // Only use explicitly set course/event - never fall back to first item to avoid showing wrong marks
  const currentEvent = activeEventId ? events.find(e => e.id === activeEventId) : undefined;
  const currentCourse = activeCourseId ? courses.find(c => c.id === activeCourseId) : undefined;
  
  // Get the boat class for the current event (used for start line sizing)
  const currentBoatClass = useMemo(() => {
    if (!currentEvent?.boatClassId) return null;
    return boatClasses.find(bc => bc.id === currentEvent.boatClassId) || null;
  }, [currentEvent?.boatClassId, boatClasses]);
  
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
  const updateEvent = useUpdateEvent(mutationErrorHandler);
  const saveCourseSnapshot = useSaveCourseSnapshot(mutationErrorHandler);
  const deleteCourseSnapshot = useDeleteCourseSnapshot(mutationErrorHandler);
  const deleteAllMarks = useDeleteAllMarks(mutationErrorHandler);

  const handleBulkBuoyCommand = useCallback((buoyIds: string[], command: "hold_position" | "cancel") => {
    buoyIds.forEach(buoyId => {
      if (demoMode) {
        sendDemoCommand(buoyId, command);
      } else {
        buoyCommand.mutate({ id: buoyId, command });
      }
    });
    toast({
      title: command === "hold_position" ? "All Loitering" : "All Idle",
      description: `Sent command to ${buoyIds.length} buoys`,
    });
  }, [demoMode, sendDemoCommand, buoyCommand, toast]);

  // State for no-course dialog
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

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

  // Deploy All: Send all assigned buoys to their mark positions
  const [isDeployingAll, setIsDeployingAll] = useState(false);
  const handleDeployAll = useCallback(() => {
    const deploymentsToMake: Array<{ buoyId: string; targetLat: number; targetLng: number; markName: string }> = [];
    
    marks.forEach(mark => {
      const windDir = activeWeatherData?.windDirection ?? 225;
      
      if (mark.isGate) {
        // Gate marks need two buoys
        const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
        const halfWidthDeg = (gateWidth / 2) / 111000;
        const perpAngle = (windDir + 90) % 360;
        const perpRad = perpAngle * Math.PI / 180;
        
        if (mark.gatePortBuoyId) {
          const portLat = mark.lat + halfWidthDeg * Math.cos(perpRad);
          const portLng = mark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
          deploymentsToMake.push({ buoyId: mark.gatePortBuoyId, targetLat: portLat, targetLng: portLng, markName: `${mark.name} (Port)` });
        }
        if (mark.gateStarboardBuoyId) {
          const stbdLat = mark.lat - halfWidthDeg * Math.cos(perpRad);
          const stbdLng = mark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
          deploymentsToMake.push({ buoyId: mark.gateStarboardBuoyId, targetLat: stbdLat, targetLng: stbdLng, markName: `${mark.name} (Starboard)` });
        }
      } else if (mark.assignedBuoyId) {
        deploymentsToMake.push({ buoyId: mark.assignedBuoyId, targetLat: mark.lat, targetLng: mark.lng, markName: mark.name });
      }
    });
    
    if (deploymentsToMake.length === 0) {
      toast({
        title: "No Buoys to Deploy",
        description: "Assign buoys to marks first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsDeployingAll(true);
    deploymentsToMake.forEach(({ buoyId, targetLat, targetLng }) => {
      if (demoMode) {
        sendDemoCommand(buoyId, "move_to_target", targetLat, targetLng);
      } else {
        buoyCommand.mutate({ id: buoyId, command: "move_to_target", targetLat, targetLng });
      }
    });
    
    toast({
      title: "Deploying All Buoys",
      description: `Sending ${deploymentsToMake.length} buoys to their marks.`,
    });
    
    setTimeout(() => setIsDeployingAll(false), 2000);
  }, [marks, activeWeatherData, demoMode, sendDemoCommand, buoyCommand, toast]);

  // Hold All: Emergency stop all moving buoys
  const handleHoldAll = useCallback(() => {
    const movingBuoyIds = buoys.filter(b => b.state === "moving_to_target").map(b => b.id);
    const allAssignedBuoyIds = new Set<string>();
    
    marks.forEach(mark => {
      if (mark.assignedBuoyId) allAssignedBuoyIds.add(mark.assignedBuoyId);
      if (mark.gatePortBuoyId) allAssignedBuoyIds.add(mark.gatePortBuoyId);
      if (mark.gateStarboardBuoyId) allAssignedBuoyIds.add(mark.gateStarboardBuoyId);
    });
    
    const buoysToHold = movingBuoyIds.length > 0 ? movingBuoyIds : Array.from(allAssignedBuoyIds);
    
    if (buoysToHold.length === 0) {
      toast({
        title: "No Buoys to Hold",
        description: "No assigned or moving buoys found.",
      });
      return;
    }
    
    buoysToHold.forEach(buoyId => {
      if (demoMode) {
        sendDemoCommand(buoyId, "hold_position");
      } else {
        buoyCommand.mutate({ id: buoyId, command: "hold_position" });
      }
    });
    
    toast({
      title: "Hold All",
      description: `Sent hold command to ${buoysToHold.length} buoys.`,
    });
  }, [buoys, marks, demoMode, sendDemoCommand, buoyCommand, toast]);

  // Calculate map bearing for nudge direction transformation
  // When in head-to-wind mode, visual "up" on screen is not geographic north
  const mapBearing = useMemo(() => {
    if (mapOrientation === "head-to-wind" && activeWeatherData) {
      // Wind direction is where wind comes FROM
      // To put wind source at top of screen, we rotate by -windDirection
      // Normalize to 0-360 range
      const rawBearing = -activeWeatherData.windDirection;
      return ((rawBearing % 360) + 360) % 360;
    }
    return 0;
  }, [mapOrientation, activeWeatherData]);

  // Transform visual nudge direction to geographic lat/lng delta based on map bearing
  // When map is rotated, visual "up" is not geographic north
  const getTransformedNudgeDelta = useCallback((
    visualDirection: "north" | "south" | "east" | "west",
    nudgeAmount: number
  ): { latDelta: number; lngDelta: number } => {
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
    const latDelta = nudgeAmount * Math.cos(geoAngleRad);
    const lngDelta = nudgeAmount * Math.sin(geoAngleRad);
    
    return { latDelta, lngDelta };
  }, [mapBearing]);

  const { handleMarkMoved, getPendingDeployments, deployAllPending, buoyDeployMode } = useBuoyFollow({
    marks,
    buoys,
    demoSendCommand: sendDemoCommand,
    courseId: courseId || undefined,
    windDirection: activeWeatherData?.windDirection ?? 225,
    enabled: !!courseId,
  });

  const pendingDeployments = useMemo(() => {
    if (buoyDeployMode !== "manual") return [];
    return getPendingDeployments();
  }, [buoyDeployMode, getPendingDeployments, marks, buoys]);

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

  // NOTE: Auto-course creation was removed to prevent data contamination.
  // Courses must now be created via the NoCourseDialog which properly links them to events.

  // Simple course initialization and validation:
  // 1. If activeCourseId is set but no longer valid (course deleted), clear it
  // 2. If no activeCourseId but event has a linked course, use it
  // 3. If no course, show dialog (handled by showNoCourseDialog state)
  useEffect(() => {
    if (coursesLoading) return;
    
    // Check if current activeCourseId is still valid
    if (activeCourseId) {
      const stillExists = courses.some(c => c.id === activeCourseId);
      if (!stillExists) {
        // Course was deleted - reset to null (will trigger no-course dialog)
        setActiveCourseId(null);
        setLocalRoundingSequence([]);
        return;
      }
      return; // Valid course, nothing to do
    }
    
    // No active course - only set from event's linked course, never fall back to random course
    if (currentEvent?.courseId) {
      setActiveCourseId(currentEvent.courseId);
    }
    // If event has no course, leave activeCourseId as null - dialog will show
  }, [coursesLoading, courses, activeCourseId, currentEvent?.courseId]);

  // Reposition demo boats near the committee boat when boat tracking is enabled
  useEffect(() => {
    if (!demoMode) return;
    if (!integrationSettings.vakaros.enabled && !integrationSettings.tractrac.enabled) return;
    if (marks.length === 0) return;
    
    const committeeBoat = marks.find(m => m.role === "start_boat" || m.name === "Committee Boat" || m.name === "Start Boat");
    if (committeeBoat) {
      repositionDemoBoats(committeeBoat.lat, committeeBoat.lng);
    } else {
      // Fall back to course center if no committee boat
      const avgLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
      const avgLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
      repositionDemoBoats(avgLat, avgLng);
    }
  }, [demoMode, integrationSettings.vakaros.enabled, integrationSettings.tractrac.enabled, marks.length > 0, repositionDemoBoats]);

  // Capture wind direction when start line is first completed (for wind shift detection)
  // This handles manual course setup scenarios where align/template/load aren't used
  const startLineMarkCount = useMemo(() => marks.filter(m => m.isStartLine).length, [marks]);
  useEffect(() => {
    // Only capture when start line becomes complete (2 marks) and we haven't set setup wind yet
    if (startLineMarkCount >= 2 && courseSetupWindDirection === null && activeWeatherData) {
      setCourseSetupWindDirection(activeWeatherData.windDirection);
    }
  }, [startLineMarkCount, courseSetupWindDirection, activeWeatherData]);

  // Template setup workflow effect - handles the automated steps after loading a template
  // Workflow order: fetch weather → boat count dialog → resize start line → align to wind (LAST)
  // This is a simple state machine that runs once per step transition
  const templateSetupProcessedRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!pendingTemplateSetup) {
      templateSetupProcessedRef.current = null;
      return;
    }
    
    // Prevent re-processing the same step
    const stepKey = `${pendingTemplateSetup.step}-${marks.length}`;
    if (templateSetupProcessedRef.current === stepKey) return;
    
    // Step 1a: Show boat count dialog when no fleet config provided
    if (pendingTemplateSetup.step === "boat_count") {
      // Guard: need marks to proceed
      if (marks.length === 0) return;
      
      templateSetupProcessedRef.current = stepKey;
      setShowBoatCountDialog(true);
    }
    
    // Step 1b: Align to wind FIRST (before resize, so rotation doesn't overwrite the start line size)
    if (pendingTemplateSetup.step === "align_wind" && pendingTemplateSetup.fleetConfig) {
      // Guard: need weather and marks to proceed
      if (!activeWeatherData || marks.length === 0) return;
      
      templateSetupProcessedRef.current = stepKey;
      
      const windDirection = activeWeatherData.windDirection;
      const startMarks = marks.filter(m => m.isStartLine);
      const windwardMark = marks.find(m => m.role === "windward" || (m.isCourseMark && m.name === "M1"));
      
      // If we have valid start line and windward mark, try to align
      if (startMarks.length >= 2 && windwardMark) {
        const startCenter = {
          lat: startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length,
          lng: startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length,
        };
        const latRad = startCenter.lat * Math.PI / 180;
        const lngScale = Math.cos(latRad);
        const dLat = windwardMark.lat - startCenter.lat;
        const dLng = (windwardMark.lng - startCenter.lng) * lngScale;
        let currentCourseAngle = Math.atan2(dLng, dLat) * 180 / Math.PI;
        currentCourseAngle = ((currentCourseAngle % 360) + 360) % 360;
        let rotationDelta = windDirection - currentCourseAngle;
        while (rotationDelta > 180) rotationDelta -= 360;
        while (rotationDelta < -180) rotationDelta += 360;
        
        // Only align if rotation needed is more than 5 degrees
        if (Math.abs(rotationDelta) > 5) {
          const pivotLat = startCenter.lat;
          const pivotLng = startCenter.lng;
          const rotationRad = rotationDelta * Math.PI / 180;
          
          // Batch all updates with Promise.all for consistency
          Promise.all(marks.map(mark => {
            const relLat = mark.lat - pivotLat;
            const relLng = (mark.lng - pivotLng) * lngScale;
            const newRelLat = relLat * Math.cos(rotationRad) - relLng * Math.sin(rotationRad);
            const newRelLng = relLat * Math.sin(rotationRad) + relLng * Math.cos(rotationRad);
            const newLat = pivotLat + newRelLat;
            const newLng = pivotLng + newRelLng / lngScale;
            return apiRequest("PATCH", `/api/marks/${mark.id}`, { lat: newLat, lng: newLng });
          })).then(async () => {
            await queryClient.refetchQueries({ queryKey: ["/api/courses", courseId, "marks"] });
            setCourseSetupWindDirection(windDirection);
            // Move to resize step AFTER align is complete
            setPendingTemplateSetup({ step: "resize_start", fleetConfig: pendingTemplateSetup.fleetConfig });
          });
        } else {
          // Already aligned, move directly to resize
          setCourseSetupWindDirection(windDirection);
          setPendingTemplateSetup({ step: "resize_start", fleetConfig: pendingTemplateSetup.fleetConfig });
        }
      } else {
        // No valid alignment possible, skip to resize
        setPendingTemplateSetup({ step: "resize_start", fleetConfig: pendingTemplateSetup.fleetConfig });
      }
    }
    
    // Step 2: Resize start line AFTER align to wind (so resize is the final operation)
    if (pendingTemplateSetup.step === "resize_start" && pendingTemplateSetup.fleetConfig) {
      // Guard: need start line marks to proceed
      const startLineMarks = marks.filter(m => m.isStartLine);
      const pinMark = startLineMarks.find(m => m.role === "pin");
      const cbMark = startLineMarks.find(m => m.role === "start_boat");
      
      if (!pinMark || !cbMark) {
        return;
      }
      
      templateSetupProcessedRef.current = stepKey;
      const { raceType, boatCount = 10 } = pendingTemplateSetup.fleetConfig;
      
      // Resize the start line based on fleet config (this is now the FINAL step)
      resizeStartLine({ raceType, boatCount });
      
      // Workflow complete
      setPendingTemplateSetup(null);
      toast({
        title: "Course Ready",
        description: "Course aligned to wind and start line sized.",
      });
    }
  }, [pendingTemplateSetup, activeWeatherData, marks, courseId, toast]);

  // Determine if we should show the no-course dialog
  const showNoCourseDialog = !coursesLoading && !eventsLoading && currentEvent && !currentEvent.courseId && !activeCourseId;

  // Handler for creating a custom course from the no-course dialog
  const handleCreateCustomCourse = useCallback(async () => {
    if (!currentEvent) return;
    
    setIsCreatingCourse(true);
    try {
      const newCourse = await createCourse.mutateAsync({
        name: `${currentEvent.name} Course`,
        shape: "custom",
        centerLat: mapCenter.lat,
        centerLng: mapCenter.lng,
        rotation: 0,
        scale: 1,
      });
      
      // Link the course to the event
      await updateEvent.mutateAsync({
        id: currentEvent.id,
        data: { courseId: newCourse.id },
      });
      
      setActiveCourseId(newCourse.id);
      invalidateRelatedQueries("events");
      
      toast({
        title: "Course Created",
        description: "New course created. Start by setting up your start line.",
      });
    } catch (error) {
      toast({
        title: "Failed to Create Course",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCourse(false);
    }
  }, [currentEvent, createCourse, updateEvent, mapCenter, toast]);

  // Handler for loading a saved course from the no-course dialog (creates course first)
  const handleLoadSavedCourse = useCallback(async (
    snapshot: CourseSnapshot, 
    _mode?: "exact" | "shape_only",
    fleetConfig?: { raceType: "fleet" | "match" | "team"; boatCount?: number }
  ) => {
    if (!currentEvent) return;
    
    setIsLoadingCourse(true);
    try {
      // Create a new course from the snapshot
      const newCourse = await createCourse.mutateAsync({
        name: snapshot.name,
        shape: snapshot.shape as CourseShape,
        centerLat: mapCenter.lat,
        centerLng: mapCenter.lng,
        rotation: snapshot.rotation,
        scale: snapshot.scale,
      });
      
      // Link the course to the event
      await updateEvent.mutateAsync({
        id: currentEvent.id,
        data: { courseId: newCourse.id },
      });
      
      setActiveCourseId(newCourse.id);
      
      // Calculate offset to recenter marks to current map position
      const sourceMarks = snapshot.snapshotMarks || [];
      if (sourceMarks.length > 0) {
        const sourceCenter = {
          lat: sourceMarks.reduce((sum, m) => sum + m.lat, 0) / sourceMarks.length,
          lng: sourceMarks.reduce((sum, m) => sum + m.lng, 0) / sourceMarks.length,
        };
        const offsetLat = mapCenter.lat - sourceCenter.lat;
        const offsetLng = mapCenter.lng - sourceCenter.lng;
        
        // Create marks from snapshot
        const newMarkIds: string[] = [];
        for (const sourceMark of sourceMarks) {
          const newMark = await createMark.mutateAsync({
            courseId: newCourse.id,
            name: sourceMark.name,
            role: sourceMark.role as MarkRole,
            order: sourceMark.order,
            lat: sourceMark.lat + offsetLat,
            lng: sourceMark.lng + offsetLng,
            isStartLine: sourceMark.isStartLine ?? false,
            isFinishLine: sourceMark.isFinishLine ?? false,
            isCourseMark: sourceMark.isCourseMark ?? false,
            isGate: sourceMark.isGate ?? false,
            gateWidthBoatLengths: sourceMark.gateWidthBoatLengths,
            boatLengthMeters: sourceMark.boatLengthMeters,
            gateSide: sourceMark.gateSide,
          });
          newMarkIds.push(newMark.id);
        }
        
        // Rebuild rounding sequence with new mark IDs
        // Preserve "start" and "finish" as special entries
        if (snapshot.roundingSequence && snapshot.roundingSequence.length > 0) {
          const nameToNewId = new Map<string, string>();
          sourceMarks.forEach((sourceMark, index) => {
            if (newMarkIds[index]) {
              nameToNewId.set(sourceMark.name, newMarkIds[index]);
            }
          });
          
          const newSequence: string[] = [];
          for (const item of snapshot.roundingSequence) {
            if (item === "start" || item === "finish") {
              // Preserve special entries as-is
              newSequence.push(item);
            } else {
              // Try to map mark name to new ID
              const newId = nameToNewId.get(item);
              if (newId) {
                newSequence.push(newId);
              }
              // Skip items that can't be mapped (legacy UUIDs)
            }
          }
          
          if (newSequence.length > 0) {
            await updateCourse.mutateAsync({
              id: newCourse.id,
              data: { roundingSequence: newSequence },
            });
            setLocalRoundingSequence(newSequence);
          }
        }
      }
      
      invalidateRelatedQueries("events");
      invalidateRelatedQueries("courses", newCourse.id);
      
      // CRITICAL: Wait for marks to fully load before proceeding with template setup
      // This ensures resizeStartLine has access to the newly created marks
      await queryClient.refetchQueries({ queryKey: ["/api/courses", newCourse.id, "marks"] });
      
      toast({
        title: "Course Loaded",
        description: `Loaded "${snapshot.name}" with ${sourceMarks.length} points.`,
      });
      
      // Start the automated template setup workflow
      // Order: fetch weather → boat count dialog (if no fleetConfig) → align to wind → resize (LAST)
      // If fleetConfig is provided from wizard, skip boat_count step and go directly to align
      const nextStep = fleetConfig ? "align_wind" : "boat_count";
      
      if (!activeWeatherData) {
        setPendingTemplateSetup({ step: "fetch_weather", fleetConfig });
        weatherByLocation.mutate({ lat: mapCenter.lat, lng: mapCenter.lng }, {
          onSuccess: () => {
            setPendingTemplateSetup({ step: nextStep, fleetConfig });
          },
          onError: () => {
            setPendingTemplateSetup({ step: nextStep, fleetConfig });
          }
        });
      } else {
        setPendingTemplateSetup({ step: nextStep, fleetConfig });
      }
    } catch (error) {
      toast({
        title: "Failed to Load Course",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCourse(false);
    }
  }, [currentEvent, createCourse, createMark, updateEvent, updateCourse, mapCenter, toast, activeWeatherData, weatherByLocation]);

  // Handler to update sequence (persists to course)
  const handleUpdateSequence = useCallback((newSequence: string[]) => {
    setLocalRoundingSequence(newSequence);
    if (currentCourse) {
      updateCourse.mutate({ id: currentCourse.id, data: { roundingSequence: newSequence } });
    }
  }, [currentCourse, updateCourse]);

  const handleDeployCourse = useCallback(() => {
    // Ensure buoys data is loaded before validating
    if (buoys.length === 0) {
      toast({
        title: "Cannot Deploy",
        description: "Buoy data is still loading. Please wait and try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Pre-deploy validation: Check that all marks have buoys assigned
    const unassignedMarks: string[] = [];
    const unavailableBuoys: string[] = [];
    
    marks.forEach((mark) => {
      if (mark.isGate) {
        if (!mark.gatePortBuoyId) unassignedMarks.push(`${mark.name} (Port)`);
        if (!mark.gateStarboardBuoyId) unassignedMarks.push(`${mark.name} (Starboard)`);
        
        // Check buoy availability
        if (mark.gatePortBuoyId) {
          const buoy = buoys.find(b => b.id === mark.gatePortBuoyId);
          if (buoy && (buoy.state === "fault" || buoy.state === "maintenance" || buoy.state === "unavailable")) {
            unavailableBuoys.push(`${buoy.name} (${buoy.state})`);
          }
        }
        if (mark.gateStarboardBuoyId) {
          const buoy = buoys.find(b => b.id === mark.gateStarboardBuoyId);
          if (buoy && (buoy.state === "fault" || buoy.state === "maintenance" || buoy.state === "unavailable")) {
            unavailableBuoys.push(`${buoy.name} (${buoy.state})`);
          }
        }
      } else {
        if (!mark.assignedBuoyId) unassignedMarks.push(mark.name);
        
        if (mark.assignedBuoyId) {
          const buoy = buoys.find(b => b.id === mark.assignedBuoyId);
          if (buoy && (buoy.state === "fault" || buoy.state === "maintenance" || buoy.state === "unavailable")) {
            unavailableBuoys.push(`${buoy.name} (${buoy.state})`);
          }
        }
      }
    });
    
    if (unassignedMarks.length > 0) {
      toast({
        title: "Cannot Deploy",
        description: `Missing buoy assignments: ${unassignedMarks.slice(0, 3).join(", ")}${unassignedMarks.length > 3 ? ` and ${unassignedMarks.length - 3} more` : ""}`,
        variant: "destructive",
      });
      return;
    }
    
    if (unavailableBuoys.length > 0) {
      toast({
        title: "Warning: Some Buoys Unavailable",
        description: `${unavailableBuoys.join(", ")} - Proceeding with deployment anyway.`,
        variant: "destructive",
      });
    }
    
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
  }, [marks, buoys, demoMode, sendDemoCommand, buoyCommand, toast, activeWeatherData]);

  const handleRotateCourse = useCallback(() => {
    toast({
      title: "Course Rotation",
      description: "Adjusting course to align with current wind direction.",
    });
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
    setShowFleetPanel(false);
  }, []);

  const handleMarkClick = useCallback((markId: string) => {
    if (repositioningMarkId) {
      return;
    }
    setSelectedMarkId(markId);
    setSelectedBuoyId(null);
    setShowFleetPanel(false);
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
            
            // Dispatch port buoy on new assignment
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
            
            // Dispatch starboard buoy on new assignment
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
            
            // Position changed without new assignment - use buoy follow
            if ((data.lat !== undefined || data.lng !== undefined)) {
              const targetLat = data.lat ?? mark.lat;
              const targetLng = data.lng ?? mark.lng;
              handleMarkMoved(id, targetLat, targetLng);
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
          } else if ((data.lat !== undefined || data.lng !== undefined) && mark) {
            // Position changed without new buoy assignment - use buoy follow
            const targetLat = data.lat ?? mark.lat;
            const targetLng = data.lng ?? mark.lng;
            handleMarkMoved(id, targetLat, targetLng);
          }
          resolve();
        },
      });
    });
  }, [updateMark, marks, demoMode, sendDemoCommand, buoyCommand, toast, activeWeatherData, handleMarkMoved]);

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
          title: "Point Deleted",
          description: "Point has been removed from the course.",
        });
      },
    });
  }, [deleteMark, toast, currentCourse, updateCourse]);

  const handleAddMark = useCallback((data: { name: string; role: MarkRole; lat?: number; lng?: number }) => {
    if (!currentCourse) {
      toast({
        title: "Error",
        description: "No course available to add point to.",
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

  const [continuousPlacement, setContinuousPlacement] = useState(false);
  const [markCounter, setMarkCounter] = useState(1);

  // Track if placement was auto-enabled by phase change (vs manual button click)
  const [autoPlacementEnabled, setAutoPlacementEnabled] = useState(false);

  const handlePlaceMarkOnMap = useCallback((data: { name: string; role: MarkRole; isStartLine?: boolean; isFinishLine?: boolean; isCourseMark?: boolean }) => {
    if (repositioningMarkId) {
      setRepositioningMarkId(null);
    }
    setPendingMarkData(data);
    // Enable continuous placement for course marks so Done button appears
    if (data.isCourseMark) {
      setContinuousPlacement(true);
      const courseMarksCount = marks.filter(m => m.isCourseMark === true).length;
      setMarkCounter(courseMarksCount + 1);
    }
  }, [repositioningMarkId, marks]);

  // Track if a transform is in progress to prevent race conditions
  const [isTransforming, setIsTransforming] = useState(false);

  // Apply course transformation (called directly or after confirmation)
  const applyCourseTransform = useCallback(async (transform: { scale?: number; rotation?: number; translateLat?: number; translateLng?: number }) => {
    if (marks.length === 0 || isTransforming) return;

    setIsTransforming(true);

    try {
      // Take a snapshot of current positions to prevent race conditions
      const markSnapshot = marks.map(m => ({ ...m }));
      
      // Save positions for undo
      setLastCourseTransform({
        positions: markSnapshot.map(m => ({ id: m.id, lat: m.lat, lng: m.lng })),
        timestamp: Date.now(),
      });

      // Find the committee boat (pivot point for rotation)
      const committeeBoat = markSnapshot.find(m => m.role === "start_boat" || m.name === "Committee Boat" || m.name === "Start Boat");
      
      // For rotation: use committee boat as pivot. For scale: use course center
      const pivotLat = committeeBoat?.lat ?? markSnapshot.reduce((sum, m) => sum + m.lat, 0) / markSnapshot.length;
      const pivotLng = committeeBoat?.lng ?? markSnapshot.reduce((sum, m) => sum + m.lng, 0) / markSnapshot.length;
      
      // For scaling, always use center of course
      const centerLat = markSnapshot.reduce((sum, m) => sum + m.lat, 0) / markSnapshot.length;
      const centerLng = markSnapshot.reduce((sum, m) => sum + m.lng, 0) / markSnapshot.length;

      // Calculate new positions for all marks from the snapshot
      const newPositions = markSnapshot.map(mark => {
        let newLat = mark.lat;
        let newLng = mark.lng;

        // Apply scaling (relative to center)
        if (transform.scale) {
          const dLat = mark.lat - centerLat;
          const dLng = mark.lng - centerLng;
          newLat = centerLat + dLat * transform.scale;
          newLng = centerLng + dLng * transform.scale;
        }

        // Apply rotation (relative to committee boat pivot - committee boat stays fixed)
        if (transform.rotation) {
          // Committee boat doesn't move during rotation
          if (committeeBoat && mark.id === committeeBoat.id) {
            return { mark, newLat: mark.lat, newLng: mark.lng };
          }
          
          // Longitude degrees are "smaller" than latitude degrees at most locations
          // 1° lat = ~111km everywhere, 1° lng = ~111km * cos(lat)
          // We must scale lng to equal-distance space before rotation, then scale back
          const lngScale = Math.cos(pivotLat * Math.PI / 180);
          
          const dLat = newLat - pivotLat;
          const dLng = (newLng - pivotLng) * lngScale; // Scale to equal-distance space
          
          const angle = transform.rotation * Math.PI / 180;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          const rotatedDLat = dLat * cosA - dLng * sinA;
          const rotatedDLng = dLat * sinA + dLng * cosA;
          
          newLat = pivotLat + rotatedDLat;
          newLng = pivotLng + rotatedDLng / lngScale; // Scale back to degrees
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

      // Update all mark positions atomically using Promise.all
      await Promise.all(
        newPositions.map(({ mark, newLat, newLng }) =>
          updateMark.mutateAsync({ id: mark.id, data: { lat: newLat, lng: newLng } })
        )
      );

      // Trigger buoy follow for all marks after atomic update
      for (const { mark, newLat, newLng } of newPositions) {
        handleMarkMoved(mark.id, newLat, newLng);
      }

      toast({
        title: "Course Adjusted",
        description: transform.scale ? (transform.scale > 1 ? "Course enlarged." : "Course reduced.") :
                     transform.rotation ? "Course rotated." : "Course moved.",
      });
    } finally {
      setIsTransforming(false);
    }
  }, [marks, updateMark, handleMarkMoved, toast, isTransforming]);

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
          description: "Please wait for the course to load before placing points.",
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
    } else if (moveCourseMode && marks.length > 0) {
      // Move entire course: calculate delta from committee boat to clicked location
      const committeeBoat = marks.find(m => m.role === "start_boat" || m.name === "Committee Boat" || m.name === "Start Boat");
      const pivotMark = committeeBoat || marks[0];
      
      const translateLat = lat - pivotMark.lat;
      const translateLng = lng - pivotMark.lng;
      
      applyCourseTransform({ translateLat, translateLng });
      setMoveCourseMode(false);
      
      toast({
        title: "Course Moved",
        description: "Course relocated to new position.",
      });
    }
  }, [isPlacingMark, pendingMarkData, currentCourse, marks.length, createMark, repositioningMarkId, updateMark, toast, continuousPlacement, markCounter, gotoMapClickMarkId, gotoMapClickBuoyId, marks, buoyCommand, moveCourseMode, applyCourseTransform]);

  // Long press handler - directly place a course mark for wet-finger operation
  // Only active when not in any other placement/editing mode
  const handleLongPress = useCallback((lat: number, lng: number) => {
    // Skip if in any other mode
    if (isPlacingMark || repositioningMarkId || gotoMapClickMarkId || gotoMapClickBuoyId || moveCourseMode) {
      return;
    }
    
    if (!currentCourse) {
      toast({
        title: "No Course Available",
        description: "Please wait for the course to load.",
        variant: "destructive",
      });
      return;
    }
    
    const courseMarksCount = marks.filter(m => m.isCourseMark === true).length;
    const markName = `M${courseMarksCount + 1}`;
    
    createMark.mutate({
      courseId: currentCourse.id,
      name: markName,
      role: "course" as MarkRole,
      order: marks.length,
      lat,
      lng,
      isStartLine: false,
      isFinishLine: false,
      isCourseMark: true,
    }, {
      onSuccess: () => {
        toast({
          title: "Mark Placed",
          description: `${markName} placed at long-press location`,
        });
      },
    });
  }, [currentCourse, marks, createMark, toast, isPlacingMark, repositioningMarkId, gotoMapClickMarkId, gotoMapClickBuoyId, moveCourseMode]);

  const handleStopPlacement = useCallback(() => {
    setPendingMarkData(null);
    setContinuousPlacement(false);
    setAutoPlacementEnabled(false);
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
        title: "Reposition Point",
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
          description: "Assign a buoy to this point first.",
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
        description: "Assign a buoy to this point first.",
        variant: "destructive",
      });
      return;
    }
    const buoy = buoys.find(b => b.id === buoyId);
    if (!buoy) return;
    
    const NUDGE_AMOUNT = 0.0005; // Approx 55 meters - larger for buoy movement
    const baseLat = buoy.targetLat ?? buoy.lat;
    const baseLng = buoy.targetLng ?? buoy.lng;
    
    // Transform visual direction to geographic based on map rotation
    const { latDelta, lngDelta } = getTransformedNudgeDelta(direction, NUDGE_AMOUNT);
    const targetLat = baseLat + latDelta;
    const targetLng = baseLng + lngDelta;
    
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
  }, [marks, buoys, buoyCommand, toast, getTransformedNudgeDelta]);

  const handleNudgeMark = useCallback((markId: string, direction: "north" | "south" | "east" | "west") => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    const NUDGE_AMOUNT = 0.0001; // Approx 11 meters
    // Transform visual direction to geographic based on map rotation
    const { latDelta, lngDelta } = getTransformedNudgeDelta(direction, NUDGE_AMOUNT);
    const newLat = mark.lat + latDelta;
    const newLng = mark.lng + lngDelta;
    
    updateMark.mutate({ id: markId, data: { lat: newLat, lng: newLng } }, {
      onSuccess: () => handleMarkMoved(markId, newLat, newLng),
    });
  }, [marks, updateMark, handleMarkMoved, getTransformedNudgeDelta]);

  const handleAdjustMarkToWind = useCallback((markId: string, newLat: number, newLng: number) => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    setLastMarkMove({
      markId,
      prevLat: mark.lat,
      prevLng: mark.lng,
      timestamp: Date.now(),
    });
    
    updateMark.mutate({ id: markId, data: { lat: newLat, lng: newLng } }, {
      onSuccess: () => {
        handleMarkMoved(markId, newLat, newLng);
        toast({
          title: "Point Adjusted",
          description: "Point position adjusted relative to wind.",
        });
      },
    });
  }, [marks, updateMark, toast, handleMarkMoved]);
  
  const handleAdjustMarkToShape = useCallback((markId: string, newLat: number, newLng: number) => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    setLastMarkMove({
      markId,
      prevLat: mark.lat,
      prevLng: mark.lng,
      timestamp: Date.now(),
    });
    
    updateMark.mutate({ id: markId, data: { lat: newLat, lng: newLng } }, {
      onSuccess: () => {
        handleMarkMoved(markId, newLat, newLng);
        toast({
          title: "Shape Adjusted",
          description: "Point moved to achieve target angle.",
        });
      },
    });
  }, [marks, updateMark, toast, handleMarkMoved]);

  const handleUndoMarkMove = useCallback(() => {
    if (!lastMarkMove) return;
    
    updateMark.mutate({ id: lastMarkMove.markId, data: { lat: lastMarkMove.prevLat, lng: lastMarkMove.prevLng } }, {
      onSuccess: () => {
        handleMarkMoved(lastMarkMove.markId, lastMarkMove.prevLat, lastMarkMove.prevLng);
        setLastMarkMove(null);
        toast({
          title: "Undone",
          description: "Point position restored.",
        });
      },
    });
  }, [lastMarkMove, updateMark, toast, handleMarkMoved]);
  
  const handleMoveMarkToGPS = useCallback((markId: string) => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    if (!navigator.geolocation) {
      toast({
        title: "GPS Not Available",
        description: "Your device doesn't support GPS location.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGpsLocating(false);
        const { latitude, longitude } = position.coords;
        setLastMarkMove({ markId, prevLat: mark.lat, prevLng: mark.lng, timestamp: Date.now() });
        updateMark.mutate({ id: markId, data: { lat: latitude, lng: longitude } }, {
          onSuccess: () => {
            handleMarkMoved(markId, latitude, longitude);
            toast({
              title: "Point Moved",
              description: "Point moved to your current GPS position.",
            });
          },
        });
      },
      (error) => {
        setIsGpsLocating(false);
        toast({
          title: "GPS Error",
          description: error.message || "Could not get your location.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [marks, updateMark, toast, handleMarkMoved]);
  
  const handleMoveMarkToCoordinates = useCallback((markId: string, lat: number, lng: number) => {
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    
    setLastMarkMove({ markId, prevLat: mark.lat, prevLng: mark.lng, timestamp: Date.now() });
    updateMark.mutate({ id: markId, data: { lat, lng } }, {
      onSuccess: () => {
        handleMarkMoved(markId, lat, lng);
        toast({
          title: "Point Moved",
          description: `Point moved to ${lat.toFixed(5)}, ${lng.toFixed(5)}.`,
        });
      },
    });
  }, [marks, updateMark, toast, handleMarkMoved]);

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
    const baseLat = buoy.targetLat ?? buoy.lat;
    const baseLng = buoy.targetLng ?? buoy.lng;
    
    // Transform visual direction to geographic based on map rotation
    const { latDelta, lngDelta } = getTransformedNudgeDelta(direction, NUDGE_AMOUNT);
    const targetLat = baseLat + latDelta;
    const targetLng = baseLng + lngDelta;
    
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
  }, [buoys, buoyCommand, toast, getTransformedNudgeDelta]);

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

  // Save course as immutable snapshot
  const handleSaveCourse = useCallback(async (data: { name: string; category?: string; description?: string; thumbnailSvg?: string }) => {
    console.log("[DEBUG CLIENT] handleSaveCourse called with data:", data);
    console.log("[DEBUG CLIENT] category value:", data.category, "type:", typeof data.category);
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
        title: "No Points",
        description: "Add points to the course before saving.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const savePayload = {
        courseId: currentCourse.id,
        name: data.name,
        category: data.category,
        description: data.description,
        thumbnailSvg: data.thumbnailSvg,
      };
      console.log("[DEBUG CLIENT] Sending to API:", savePayload);
      await saveCourseSnapshot.mutateAsync(savePayload);
      
      toast({
        title: "Course Saved",
        description: `Race course "${data.name}" has been saved.`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save the course. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentCourse, marks, saveCourseSnapshot, toast]);

  // Delete a saved course snapshot
  const handleDeleteCourse = useCallback(async (snapshotId: string) => {
    try {
      await deleteCourseSnapshot.mutateAsync(snapshotId);
      toast({
        title: "Course Deleted",
        description: "The saved course has been removed.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the course. Please try again.",
        variant: "destructive",
      });
    }
  }, [deleteCourseSnapshot, toast]);

  // Load a saved course from snapshot
  const handleLoadCourse = useCallback(async (snapshot: CourseSnapshot, mode: "exact" | "shape_only") => {
    const sourceMarks = snapshot.snapshotMarks;
    
    if (!sourceMarks || sourceMarks.length === 0) {
      toast({
        title: "No Points",
        description: "The selected course has no points to load.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentCourse) {
      toast({
        title: "No Active Course",
        description: "Please create or select a course first.",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate offset based on mode
    let offsetLat = 0;
    let offsetLng = 0;
    
    if (mode === "shape_only") {
      // Calculate the offset to recenter marks to current map position
      const sourceCenter = {
        lat: sourceMarks.reduce((sum, m) => sum + m.lat, 0) / sourceMarks.length,
        lng: sourceMarks.reduce((sum, m) => sum + m.lng, 0) / sourceMarks.length,
      };
      offsetLat = mapCenter.lat - sourceCenter.lat;
      offsetLng = mapCenter.lng - sourceCenter.lng;
    }
    
    // Clear existing marks first using the bulk delete endpoint
    // This properly clears the rounding sequence before deleting marks,
    // avoiding race conditions that occur with individual deletions
    if (marks.length > 0) {
      await deleteAllMarks.mutateAsync(currentCourse.id);
    }
    
    // Create new marks from snapshot data
    // For snapshots, we don't have mark IDs since they're serialized data
    // We'll track by index for rounding sequence mapping
    const newMarkIds: string[] = [];
    
    for (const sourceMark of sourceMarks) {
      // Copy shape and metadata but NOT buoy assignments (those are location-specific)
      const newMark = await createMark.mutateAsync({
        courseId: currentCourse.id,
        name: sourceMark.name,
        role: sourceMark.role,
        order: sourceMark.order,
        lat: sourceMark.lat + offsetLat,
        lng: sourceMark.lng + offsetLng,
        isStartLine: sourceMark.isStartLine ?? false,
        isFinishLine: sourceMark.isFinishLine ?? false,
        isCourseMark: sourceMark.isCourseMark ?? false,
        isGate: sourceMark.isGate ?? false,
        gateWidthBoatLengths: sourceMark.gateWidthBoatLengths,
        boatLengthMeters: sourceMark.boatLengthMeters,
        gateSide: sourceMark.gateSide,
      });
      newMarkIds.push(newMark.id);
    }
    
    // Build new rounding sequence from the loaded marks
    // Snapshot roundingSequence contains mark names (not IDs) for portability
    // Also supports backward compatibility with old snapshots that used IDs
    if (snapshot.roundingSequence && snapshot.roundingSequence.length > 0) {
      // Create maps for multiple lookup strategies
      const nameToNewId = new Map<string, string>();
      const orderToNewId = new Map<number, string>();
      
      sourceMarks.forEach((sourceMark, index) => {
        if (newMarkIds[index]) {
          nameToNewId.set(sourceMark.name, newMarkIds[index]);
          orderToNewId.set(sourceMark.order, newMarkIds[index]);
        }
      });
      
      // Map the saved rounding sequence to new IDs
      // Try multiple strategies: name match, order match, index match
      const newRoundingSequence: string[] = [];
      for (const item of snapshot.roundingSequence) {
        if (item === "start" || item === "finish") {
          newRoundingSequence.push(item);
        } else {
          // Strategy 1: Try name match (new snapshots)
          let newId = nameToNewId.get(item);
          
          // Strategy 2: Try order match (if item looks like a number)
          if (!newId) {
            const orderNum = parseInt(item, 10);
            if (!isNaN(orderNum)) {
              newId = orderToNewId.get(orderNum);
            }
          }
          
          // Strategy 3: Try finding by index in source marks (legacy with UUIDs)
          if (!newId) {
            const sourceIndex = sourceMarks.findIndex(m => m.name === item);
            if (sourceIndex !== -1 && newMarkIds[sourceIndex]) {
              newId = newMarkIds[sourceIndex];
            }
          }
          
          if (newId) {
            newRoundingSequence.push(newId);
          }
        }
      }
      
      if (newRoundingSequence.length > 0) {
        setLocalRoundingSequence(newRoundingSequence);
        await updateCourse.mutateAsync({
          id: currentCourse.id,
          data: { roundingSequence: newRoundingSequence }
        });
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/courses", currentCourse.id, "marks"] });
    
    // Capture current wind direction as the "setup" wind for shift detection
    if (activeWeatherData) {
      setCourseSetupWindDirection(activeWeatherData.windDirection);
    }
    
    toast({
      title: mode === "exact" ? "Course Loaded" : "Course Shape Loaded",
      description: mode === "exact" 
        ? "Race course has been loaded at its saved location."
        : "Course shape has been placed at your current map location.",
    });
    
    // Start the automated template setup workflow
    // Order: fetch weather → boat count dialog → resize → align to wind (LAST)
    if (!activeWeatherData) {
      setPendingTemplateSetup({ step: "fetch_weather" });
      // Trigger weather fetch at map center
      weatherByLocation.mutate({ lat: mapCenter.lat, lng: mapCenter.lng }, {
        onSuccess: () => {
          // Weather fetched, move to boat count dialog
          setPendingTemplateSetup({ step: "boat_count" });
        },
        onError: () => {
          // Weather fetch failed, still show boat count dialog
          setPendingTemplateSetup({ step: "boat_count" });
        }
      });
    } else {
      // Weather available, proceed to boat count dialog
      setPendingTemplateSetup({ step: "boat_count" });
    }
  }, [currentCourse, marks, mapCenter, createMark, deleteAllMarks, updateCourse, activeWeatherData, toast, weatherByLocation]);

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
        description: "All points have been removed and buoys set to idle.",
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Could not clear the course. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentCourse, marks, demoMode, sendDemoCommand, buoyCommand, deleteAllMarks, updateCourse, toast]);

  // Apply a shape template to auto-generate course marks
  const handleApplyTemplate = useCallback(async (template: ShapeTemplate) => {
    if (!currentCourse) return;
    
    // Get start line center
    const startMarks = marks.filter(m => m.isStartLine);
    if (startMarks.length < 2) {
      toast({
        title: "Start Line Required",
        description: "Please set up the start line before using a template.",
        variant: "destructive",
      });
      return;
    }
    
    const startCenterLat = startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length;
    const startCenterLng = startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length;
    
    // Get wind direction (required for template placement)
    const windDir = activeWeatherData?.windDirection;
    if (windDir === undefined) {
      toast({
        title: "Wind Data Required",
        description: "Templates need wind direction to position marks correctly.",
        variant: "destructive",
      });
      return;
    }
    
    // Default course length - 500m is typical for small boat racing
    const courseLengthMeters = 500;
    
    try {
      // Generate marks from template
      const generatedMarks = generateTemplateMarks(
        template,
        startCenterLat,
        startCenterLng,
        windDir,
        courseLengthMeters
      );
      
      // Create marks in the database with proper ordering
      const baseOrder = marks.length;
      for (let i = 0; i < generatedMarks.length; i++) {
        const genMark = generatedMarks[i];
        await createMark.mutateAsync({
          courseId: currentCourse.id,
          name: genMark.name,
          role: genMark.role,
          order: baseOrder + i,
          lat: genMark.lat,
          lng: genMark.lng,
          isStartLine: false,
          isFinishLine: false,
          isCourseMark: true,
        });
      }
      
      // Capture current wind direction as the "setup" wind for shift detection
      setCourseSetupWindDirection(windDir);
      
      toast({
        title: "Template Applied",
        description: `${template.name} - ${generatedMarks.length} course points added.`,
      });
    } catch (error) {
      toast({
        title: "Template Failed",
        description: "Could not create course marks. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentCourse, marks, activeWeatherData, createMark, toast]);

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
      
      // Apply latitude-based longitude scaling for accurate angle calculation
      const latRad = startCenter.lat * Math.PI / 180;
      const lngScale = Math.cos(latRad);
      
      const dLat = windwardMark.lat - startCenter.lat;
      const dLng = (windwardMark.lng - startCenter.lng) * lngScale;
      
      // Calculate bearing from start center to windward mark
      currentCourseAngle = Math.atan2(dLng, dLat) * 180 / Math.PI;
      // Normalize to 0-360
      currentCourseAngle = ((currentCourseAngle % 360) + 360) % 360;
    }
    
    // Calculate exact rotation needed
    const targetAngle = windDirection;
    let rotationDelta = targetAngle - currentCourseAngle;
    
    // Normalize to -180 to 180 for shortest rotation
    while (rotationDelta > 180) rotationDelta -= 360;
    while (rotationDelta < -180) rotationDelta += 360;
    
    handleTransformCourse({ rotation: rotationDelta });
    
    // Save the wind direction when course was aligned for wind shift detection
    setCourseSetupWindDirection(windDirection);
    
    toast({
      title: "Course Aligned to Wind",
      description: `Rotated ${Math.abs(rotationDelta).toFixed(1)}° to align with wind from ${windDirection.toFixed(0)}°`,
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
      invalidateRelatedQueries("courses", course.id);
      invalidateRelatedQueries("events");

      if (data.courseShape === "custom") {
        setPendingMarkData({ name: "Point 1", role: "turning_mark" });
        setContinuousPlacement(true);
        setMarkCounter(1);
        toast({
          title: "Custom Course",
          description: "Click on the map to add points. Press 'Done' when finished.",
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
    // In demo mode, reposition buoys near the course center before assigning
    if (demoMode && marks.length > 0) {
      const avgLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
      const avgLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
      repositionDemoBuoys(avgLat, avgLng);
    }
    
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
        description: "All points already have buoys assigned.",
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
    
    // Calculate max ETA based on distance and estimated buoy speed (2.5 kts typical for robotic buoys)
    const BUOY_SPEED_KTS = 2.5;
    const distances = assignments.map(a => a.distance);
    const maxDistNm = distances.length > 0 ? Math.max(...distances) : 0;
    // Time in seconds: distance (nm) / speed (kts) * 3600
    const maxEtaSeconds = maxDistNm > 0 ? Math.round((maxDistNm / BUOY_SPEED_KTS) * 3600) : 0;
    const maxEtaMinutes = Math.floor(maxEtaSeconds / 60);
    const maxEtaRemainder = maxEtaSeconds % 60;
    const etaDisplay = maxEtaSeconds > 0 
      ? (maxEtaMinutes > 0 ? `${maxEtaMinutes}m ${maxEtaRemainder}s` : `${maxEtaRemainder}s`)
      : "immediate";
    
    toast({
      title: "Auto-Assigning Buoys",
      description: `Assigning ${assignmentOps.length} buoys. Est. setup: ${etaDisplay}`,
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
          description: `Assigned ${assignmentOps.length} buoys. Est. setup: ${etaDisplay}`,
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
  }, [marks, buoys, activeWeatherData, courseId, demoMode, sendDemoCommand, repositionDemoBuoys, toast]);

  const handleAutoAdjustMark = useCallback(async (markId: string, lat: number, lng: number) => {
    try {
      await apiRequest("PATCH", `/api/marks/${markId}`, { lat, lng });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      handleMarkMoved(markId, lat, lng);
    } catch (error) {
      toast({
        title: "Adjustment Failed",
        description: error instanceof Error ? error.message : "Failed to adjust point",
        variant: "destructive",
      });
    }
  }, [courseId, toast, handleMarkMoved]);

  const handleAutoAdjustStartLine = useCallback(async (pinLat: number, pinLng: number, cbLat: number, cbLng: number) => {
    const pinMark = marks.find(m => m.role === "pin");
    const cbMark = marks.find(m => m.role === "start_boat");
    
    try {
      if (pinMark) {
        await apiRequest("PATCH", `/api/marks/${pinMark.id}`, { lat: pinLat, lng: pinLng });
        handleMarkMoved(pinMark.id, pinLat, pinLng);
      }
      if (cbMark) {
        await apiRequest("PATCH", `/api/marks/${cbMark.id}`, { lat: cbLat, lng: cbLng });
        handleMarkMoved(cbMark.id, cbLat, cbLng);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
    } catch (error) {
      toast({
        title: "Adjustment Failed",
        description: error instanceof Error ? error.message : "Failed to adjust start line",
        variant: "destructive",
      });
    }
  }, [courseId, marks, toast, handleMarkMoved]);

  const handleAutoAdjustComplete = useCallback((originalPositions: Array<{ id: string; lat: number; lng: number }>) => {
    if (originalPositions.length > 0) {
      setLastAutoAdjust({ positions: originalPositions, timestamp: Date.now() });
      toast({
        title: "Adjustment Complete",
        description: `${originalPositions.length} items adjusted. Tap Undo to revert.`,
      });
    }
  }, [toast]);
  
  // Undo auto-adjust handler
  const handleUndoAutoAdjust = useCallback(async () => {
    if (!lastAutoAdjust) return;
    
    try {
      for (const pos of lastAutoAdjust.positions) {
        await apiRequest("PATCH", `/api/marks/${pos.id}`, {
          lat: pos.lat,
          lng: pos.lng,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      setLastAutoAdjust(null);
      
      toast({
        title: "Undo Complete",
        description: "Points restored to previous positions",
      });
    } catch (error) {
      toast({
        title: "Undo Failed",
        description: error instanceof Error ? error.message : "Failed to restore points",
        variant: "destructive",
      });
    }
  }, [lastAutoAdjust, courseId, toast]);

  // Undo course transform handler (for move/rotate/scale)
  const handleUndoCourseTransform = useCallback(async () => {
    if (!lastCourseTransform) return;
    
    try {
      for (const pos of lastCourseTransform.positions) {
        await apiRequest("PATCH", `/api/marks/${pos.id}`, {
          lat: pos.lat,
          lng: pos.lng,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      setLastCourseTransform(null);
      
      toast({
        title: "Undo Complete",
        description: "Course restored to previous position",
      });
    } catch (error) {
      toast({
        title: "Undo Failed",
        description: "Failed to restore course position",
        variant: "destructive",
      });
    }
  }, [lastCourseTransform, courseId, toast]);

  // Resize start line based on boat count or crossing time target
  const resizeStartLine = useCallback(async (params: { 
    raceType: "fleet" | "match" | "team";
    boatCount?: number;
  }) => {
    const pinMark = marks.find(m => m.role === "pin");
    const cbMark = marks.find(m => m.role === "start_boat");
    
    if (!pinMark || !cbMark) {
      toast({
        title: "No Start Line",
        description: "Please set up the start line first.",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate current start line properties using average lat for cos correction
    const avgLat = (pinMark.lat + cbMark.lat) / 2;
    const cosLat = Math.cos(avgLat * Math.PI / 180);
    const dLatMeters = (cbMark.lat - pinMark.lat) * 111000;
    const dLngMeters = (cbMark.lng - pinMark.lng) * 111000 * cosLat;
    const currentLength = Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters);
    
    // Guard against zero or near-zero length (overlapping marks)
    if (currentLength < 1) {
      toast({
        title: "Invalid Start Line",
        description: "Start line marks are too close together. Please reposition them.",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate target length
    let targetLengthMeters: number;
    // Use actual boat class length if available, otherwise default to 4.5m (ILCA 7)
    const boatLengthMeters = currentBoatClass?.lengthMeters ?? 4.5;
    
    if (params.raceType === "fleet" && params.boatCount) {
      // Fleet race: boats × 1.5 boat lengths
      targetLengthMeters = params.boatCount * boatLengthMeters * 1.5;
    } else {
      // Match/Team race: 25 seconds crossing at 2 knots broad reach
      // Speed: 2 knots = 1.03 m/s
      // Distance = speed × time = 1.03 × 25 = 25.75 meters
      targetLengthMeters = 25.75;
    }
    
    // Calculate scale factor with reasonable bounds
    const scaleFactor = Math.min(Math.max(targetLengthMeters / currentLength, 0.1), 10);
    
    // Calculate start line center
    const centerLat = (pinMark.lat + cbMark.lat) / 2;
    const centerLng = (pinMark.lng + cbMark.lng) / 2;
    
    // Scale pin and CB from center
    const pinOffset = {
      lat: (pinMark.lat - centerLat) * scaleFactor,
      lng: (pinMark.lng - centerLng) * scaleFactor,
    };
    const cbOffset = {
      lat: (cbMark.lat - centerLat) * scaleFactor,
      lng: (cbMark.lng - centerLng) * scaleFactor,
    };
    
    const newPinLat = centerLat + pinOffset.lat;
    const newPinLng = centerLng + pinOffset.lng;
    const newCbLat = centerLat + cbOffset.lat;
    const newCbLng = centerLng + cbOffset.lng;
    
    try {
      await Promise.all([
        apiRequest("PATCH", `/api/marks/${pinMark.id}`, { lat: newPinLat, lng: newPinLng }),
        apiRequest("PATCH", `/api/marks/${cbMark.id}`, { lat: newCbLat, lng: newCbLng }),
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      
      toast({
        title: "Start Line Sized",
        description: params.raceType === "fleet" 
          ? `Start line set for ${params.boatCount} boats (${Math.round(targetLengthMeters)}m)`
          : `Start line set for ${params.raceType} racing (${Math.round(targetLengthMeters)}m)`,
      });
    } catch (error) {
      toast({
        title: "Resize Failed",
        description: "Could not resize start line",
        variant: "destructive",
      });
    }
  }, [marks, courseId, toast, currentBoatClass]);

  // Handle boat count dialog confirmation
  const handleBoatCountConfirm = useCallback(async (result: { raceType: "fleet" | "match" | "team"; boatCount?: number }) => {
    // Switch to course view (marks phase)
    setCurrentSetupPhase("marks");
    setShowBoatCountDialog(false);
    
    // Trigger align to wind FIRST, then resize (align_wind step with fleetConfig will chain to resize)
    setPendingTemplateSetup({ step: "align_wind", fleetConfig: result });
  }, []);

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
    boatClass: "ILCA 7",
    boatClassId: null,
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
        weatherData={activeWeatherData}
        onSettingsClick={() => setSettingsOpen(true)}
        onToggleDemoMode={toggleDemoMode}
        onBackClick={() => {
          if (user?.role === "super_admin") {
            setLocation("/admin");
          } else if (user?.role === "club_manager") {
            setLocation("/club");
          } else if (user?.role === "event_manager") {
            setLocation("/events");
          }
        }}
        onClearCourse={() => setShowClearCourseConfirm(true)}
        onSaveCourse={() => setCourseMenuSaveOpen(true)}
        onLoadCourse={() => setCourseMenuLoadOpen(true)}
        pendingDeployments={buoyDeployMode === "manual" ? pendingDeployments.length : 0}
        onDeployBuoys={() => {
          const count = deployAllPending();
          toast({
            title: "Deploying Buoys",
            description: `Sending ${count} buoy${count !== 1 ? 's' : ''} to their target positions`,
          });
        }}
        onFetchWeather={() => handleFetchWeatherAtLocation(mapCenter.lat, mapCenter.lng)}
        isWeatherLoading={weatherByLocation.isPending}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <main className="flex-1 relative min-w-0 overflow-hidden">
          {/* Wind Shift Alert - shows when wind shifts >10° from course setup */}
          {courseSetupWindDirection !== null && activeWeatherData && (
            <WindShiftAlert
              setupWindDirection={courseSetupWindDirection}
              currentWindDirection={activeWeatherData.windDirection}
              onRealign={handleAlignCourseToWind}
            />
          )}
          
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
              if (mark) {
                setLastMarkMove({ markId, prevLat: mark.lat, prevLng: mark.lng, timestamp: Date.now() });
              }
              const hasAssignedBuoy = !!(mark?.assignedBuoyId || mark?.gatePortBuoyId || mark?.gateStarboardBuoyId);
              if (hasAssignedBuoy) {
                setPendingMarkMove({ markId, lat, lng, hasAssignedBuoy: true });
              } else {
                updateMark.mutate({ id: markId, data: { lat, lng } }, {
                  onSuccess: () => handleMarkMoved(markId, lat, lng),
                });
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
            showWindArrows={showWindArrows}
            showSidebar={showSidebar}
            isSidebarCollapsed={isSetupPanelCollapsed}
            onToggleSidebar={() => setShowSidebar(!showSidebar)}
            lastMarkMove={lastMarkMove}
            onUndoMarkMove={() => {
              if (lastMarkMove) {
                updateMark.mutate({ id: lastMarkMove.markId, data: { lat: lastMarkMove.prevLat, lng: lastMarkMove.prevLng } }, {
                  onSuccess: () => handleMarkMoved(lastMarkMove.markId, lastMarkMove.prevLat, lastMarkMove.prevLng),
                });
                setLastMarkMove(null);
              }
            }}
            lastCourseTransform={lastCourseTransform}
            onUndoCourseTransform={handleUndoCourseTransform}
            onMapMoveEnd={(lat, lng) => setMapCenter({ lat, lng })}
            mapLayer={mapLayer}
            showSeaMarks={showSeaMarks}
            pendingDeployments={pendingDeployments}
            siblingBuoys={siblingBuoys}
            showSiblingBuoys={showSiblingBuoys}
            onLongPress={handleLongPress}
            trackedBoats={demoMode ? demoBoats.filter(b => 
              (b.source === 'vakaros' && integrationSettings.vakaros.enabled) || 
              (b.source === 'tractrac' && integrationSettings.tractrac.enabled)
            ) : []}
            showBoats={demoMode && (integrationSettings.vakaros.enabled || integrationSettings.tractrac.enabled)}
          />
          
          {/* Floating Action Bar - always visible critical actions */}
          <FloatingActionBar
            onAlignToWind={handleAlignCourseToWind}
            onDeployAll={handleDeployCourse}
            onHoldAll={handleHoldAll}
            onUndo={() => {
              if (lastMarkMove) {
                updateMark.mutate({ id: lastMarkMove.markId, data: { lat: lastMarkMove.prevLat, lng: lastMarkMove.prevLng } });
                setLastMarkMove(null);
              } else if (lastCourseTransform && Date.now() - lastCourseTransform.timestamp < 30000) {
                handleUndoCourseTransform();
              } else if (lastAutoAdjust && Date.now() - lastAutoAdjust.timestamp < 30000) {
                handleUndoAutoAdjust();
              }
            }}
            onFleetClick={() => {
              setShowFleetPanel(!showFleetPanel);
              setSelectedBuoyId(null);
              setSelectedMarkId(null);
            }}
            canAlign={!!activeWeatherData && marks.length > 0}
            canDeploy={marks.some(m => m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId)}
            canHold={buoys.some(b => b.state === "moving_to_target") || marks.some(m => m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId)}
            canUndo={!!lastMarkMove || (!!lastCourseTransform && Date.now() - lastCourseTransform.timestamp < 30000) || (!!lastAutoAdjust && Date.now() - lastAutoAdjust.timestamp < 30000)}
            isDeploying={isDeployingAll}
            deployingCount={marks.filter(m => m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId).length}
            totalBuoys={marks.filter(m => m.assignedBuoyId || m.gatePortBuoyId || m.gateStarboardBuoyId).length}
            onStationCount={(() => {
              const THRESHOLD_METERS = 15;
              const windDir = activeWeatherData?.windDirection ?? 225;
              let count = 0;
              marks.forEach(mark => {
                if (mark.isGate) {
                  const gateWidth = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
                  const halfWidthDeg = (gateWidth / 2) / 111000;
                  const perpAngle = (windDir + 90) % 360;
                  const perpRad = perpAngle * Math.PI / 180;
                  if (mark.gatePortBuoyId) {
                    const buoy = buoys.find(b => b.id === mark.gatePortBuoyId);
                    if (buoy) {
                      const targetLat = mark.lat + halfWidthDeg * Math.cos(perpRad);
                      const targetLng = mark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
                      const dist = Math.sqrt(Math.pow((buoy.lat - targetLat) * 111000, 2) + Math.pow((buoy.lng - targetLng) * 111000 * Math.cos(buoy.lat * Math.PI / 180), 2));
                      if (dist < THRESHOLD_METERS) count++;
                    }
                  }
                  if (mark.gateStarboardBuoyId) {
                    const buoy = buoys.find(b => b.id === mark.gateStarboardBuoyId);
                    if (buoy) {
                      const targetLat = mark.lat - halfWidthDeg * Math.cos(perpRad);
                      const targetLng = mark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(mark.lat * Math.PI / 180);
                      const dist = Math.sqrt(Math.pow((buoy.lat - targetLat) * 111000, 2) + Math.pow((buoy.lng - targetLng) * 111000 * Math.cos(buoy.lat * Math.PI / 180), 2));
                      if (dist < THRESHOLD_METERS) count++;
                    }
                  }
                } else if (mark.assignedBuoyId) {
                  const buoy = buoys.find(b => b.id === mark.assignedBuoyId);
                  if (buoy) {
                    const dist = Math.sqrt(Math.pow((buoy.lat - mark.lat) * 111000, 2) + Math.pow((buoy.lng - mark.lng) * 111000 * Math.cos(buoy.lat * Math.PI / 180), 2));
                    if (dist < THRESHOLD_METERS) count++;
                  }
                }
              });
              return count;
            })()}
            movingCount={buoys.filter(b => b.state === "moving_to_target").length}
            needsWindAlignment={(() => {
              if (!activeWeatherData || marks.length === 0) return false;
              const windDirection = activeWeatherData.windDirection;
              const startMarks = marks.filter(m => m.isStartLine);
              const windwardMark = marks.find(m => m.role === "windward" || (m.isCourseMark && m.name === "M1"));
              if (startMarks.length < 2 || !windwardMark) return false;
              const startCenter = {
                lat: startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length,
                lng: startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length,
              };
              const latRad = startCenter.lat * Math.PI / 180;
              const lngScale = Math.cos(latRad);
              const dLat = windwardMark.lat - startCenter.lat;
              const dLng = (windwardMark.lng - startCenter.lng) * lngScale;
              let currentCourseAngle = Math.atan2(dLng, dLat) * 180 / Math.PI;
              currentCourseAngle = ((currentCourseAngle % 360) + 360) % 360;
              let rotationDelta = windDirection - currentCourseAngle;
              if (rotationDelta > 180) rotationDelta -= 360;
              if (rotationDelta < -180) rotationDelta += 360;
              return Math.abs(rotationDelta) > 5;
            })()}
            showFleet={showFleetPanel}
            hasFaultOrLowBattery={buoys.some(b => b.state === "fault" || (b.batteryLevel !== null && b.batteryLevel < 20))}
          />
        </main>

        <aside className={`${showSidebar ? (isSetupPanelCollapsed && !selectedBuoy && !selectedMark && !showFleetPanel ? 'w-14' : 'w-80 xl:w-96') : 'w-0'} shrink-0 hidden lg:flex lg:flex-col h-full overflow-hidden transition-[width] duration-300 bg-card border-l`}>
          {showFleetPanel ? (
            <FleetStatusPanel
              buoys={buoys}
              marks={marks}
              onBuoySelect={(buoyId) => {
                setSelectedBuoyId(buoyId);
                setShowFleetPanel(false);
              }}
              onBulkBuoyCommand={handleBulkBuoyCommand}
              onClose={() => setShowFleetPanel(false)}
            />
          ) : selectedBuoy ? (() => {
            const assignedMark = marks.find(m => 
              m.assignedBuoyId === selectedBuoy.id || 
              m.gatePortBuoyId === selectedBuoy.id || 
              m.gateStarboardBuoyId === selectedBuoy.id
            );
            let markLat: number | undefined;
            let markLng: number | undefined;
            let markName: string | undefined;
            if (assignedMark) {
              markName = assignedMark.name;
              if (assignedMark.gatePortBuoyId === selectedBuoy.id) {
                const gateWidth = (assignedMark.gateWidthBoatLengths ?? 8) * (assignedMark.boatLengthMeters ?? 6);
                const halfWidthDeg = (gateWidth / 2) / 111000;
                const windDir = activeWeatherData?.windDirection ?? 225;
                const perpAngle = (windDir + 90) % 360;
                const perpRad = perpAngle * Math.PI / 180;
                markLat = assignedMark.lat + halfWidthDeg * Math.cos(perpRad);
                markLng = assignedMark.lng + halfWidthDeg * Math.sin(perpRad) / Math.cos(assignedMark.lat * Math.PI / 180);
                markName = `${assignedMark.name} (Port)`;
              } else if (assignedMark.gateStarboardBuoyId === selectedBuoy.id) {
                const gateWidth = (assignedMark.gateWidthBoatLengths ?? 8) * (assignedMark.boatLengthMeters ?? 6);
                const halfWidthDeg = (gateWidth / 2) / 111000;
                const windDir = activeWeatherData?.windDirection ?? 225;
                const perpAngle = (windDir + 90) % 360;
                const perpRad = perpAngle * Math.PI / 180;
                markLat = assignedMark.lat - halfWidthDeg * Math.cos(perpRad);
                markLng = assignedMark.lng - halfWidthDeg * Math.sin(perpRad) / Math.cos(assignedMark.lat * Math.PI / 180);
                markName = `${assignedMark.name} (Starboard)`;
              } else {
                markLat = assignedMark.lat;
                markLng = assignedMark.lng;
              }
            }
            return (
              <BuoyDetailPanel 
                buoy={selectedBuoy} 
                onClose={() => { setSelectedBuoyId(null); setGotoMapClickBuoyId(null); }}
                demoSendCommand={sendDemoCommand}
                onTapMapToGoto={() => handleBuoyGotoMapClick(selectedBuoy.id)}
                isTapMapMode={gotoMapClickBuoyId === selectedBuoy.id}
                onNudgeBuoy={(direction) => handleNudgeBuoyDirect(selectedBuoy.id, direction)}
                assignedMarkName={markName}
                assignedMarkLat={markLat}
                assignedMarkLng={markLng}
              />
            );
          })() : selectedMark ? (
            <MarkEditPanel
              mark={selectedMark}
              buoys={buoys}
              allMarks={marks}
              roundingSequence={roundingSequence}
              windDirection={activeWeatherData?.windDirection}
              onClose={() => { setSelectedMarkId(null); setGotoMapClickMarkId(null); }}
              onSave={(data) => handleSaveMark(selectedMark.id, data)}
              onDelete={() => handleDeleteMark(selectedMark.id)}
              onMoveToGPS={() => handleMoveMarkToGPS(selectedMark.id)}
              onMoveToCoordinates={(lat, lng) => handleMoveMarkToCoordinates(selectedMark.id, lat, lng)}
              onNudge={(direction) => handleNudgeMark(selectedMark.id, direction)}
              onAdjustToWind={(lat, lng) => handleAdjustMarkToWind(selectedMark.id, lat, lng)}
              onAdjustToShape={(lat, lng) => handleAdjustMarkToShape(selectedMark.id, lat, lng)}
              lastMovePosition={lastMarkMove && lastMarkMove.markId === selectedMark.id ? {
                originalLat: lastMarkMove.prevLat,
                originalLng: lastMarkMove.prevLng,
                timestamp: lastMarkMove.timestamp
              } : null}
              onUndoMove={handleUndoMarkMove}
              isGpsLocating={isGpsLocating}
            />
          ) : (
            <SetupPanel 
              event={displayEvent}
              course={currentCourse}
              buoys={buoys}
              marks={marks}
              roundingSequence={roundingSequence}
              windDirection={activeWeatherData?.windDirection}
              windSpeed={activeWeatherData?.windSpeed}
              mapBearing={mapBearing}
              onMarkSelect={handleMarkSelectFromPanel}
              onBuoySelect={setSelectedBuoyId}
              onDeployCourse={handleDeployCourse}
              onSaveMark={handleSaveMark}
              onAddMark={handleAddMark}
              onPlaceMarkOnMap={handlePlaceMarkOnMap}
              onSaveCourse={handleSaveCourse}
              onLoadCourse={handleLoadCourse}
              mapCenter={mapCenter}
              onTransformCourse={handleTransformCourse}
              onFinishLinePreview={handleFinishLinePreview}
              onUpdateSequence={handleUpdateSequence}
              onAutoAssignBuoys={handleAutoAssignBuoys}
              onPhaseChange={handlePhaseChange}
              onClearAllMarks={handleClearAllMarks}
              onAutoAdjustMark={handleAutoAdjustMark}
              onAutoAdjustStartLine={handleAutoAdjustStartLine}
              onAutoAdjustComplete={handleAutoAdjustComplete}
              lastAutoAdjust={lastAutoAdjust}
              onUndoAutoAdjust={handleUndoAutoAdjust}
              moveCourseMode={moveCourseMode}
              onSetMoveCourseMode={setMoveCourseMode}
              onDeleteCourse={handleDeleteCourse}
              onApplyTemplate={handleApplyTemplate}
              externalSaveDialogOpen={courseMenuSaveOpen}
              onExternalSaveDialogChange={setCourseMenuSaveOpen}
              externalLoadDialogOpen={courseMenuLoadOpen}
              onExternalLoadDialogChange={setCourseMenuLoadOpen}
              onAlignCourseToWind={handleAlignCourseToWind}
              onBulkBuoyCommand={handleBulkBuoyCommand}
              isCollapsed={isSetupPanelCollapsed}
              onToggleCollapse={() => setIsSetupPanelCollapsed(!isSetupPanelCollapsed)}
            />
          )}
        </aside>
      </div>

      <SettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        buoys={buoys}
        showWindArrows={showWindArrows}
        onToggleWindArrows={() => setShowWindArrows(!showWindArrows)}
        mapOrientation={mapOrientation}
        onOrientationChange={setMapOrientation}
        onAlignCourseToWind={handleAlignCourseToWind}
        hasMarks={marks.length > 0}
        hasWeatherData={!!activeWeatherData}
      />

      {/* Quick Start wizard for events without a course - non-cancellable for new events */}
      <QuickStartWizard
        open={!!showNoCourseDialog}
        onOpenChange={() => {}}
        onLoadCourse={handleLoadSavedCourse}
        onCreateCustom={handleCreateCustomCourse}
        hasWindData={!!activeWeatherData}
        isNewEvent={true}
      />

      {/* Boat count dialog for template setup workflow */}
      <BoatCountDialog
        open={showBoatCountDialog}
        onOpenChange={setShowBoatCountDialog}
        onConfirm={handleBoatCountConfirm}
        isCriticalPath={!!pendingTemplateSetup}
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
                  updateMark.mutate({ 
                    id: pendingMarkMove.markId, 
                    data: { lat: pendingMarkMove.lat, lng: pendingMarkMove.lng } 
                  }, {
                    onSuccess: () => {
                      handleMarkMoved(pendingMarkMove.markId, pendingMarkMove.lat, pendingMarkMove.lng);
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
