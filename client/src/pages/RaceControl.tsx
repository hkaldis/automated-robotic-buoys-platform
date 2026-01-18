import { useState, useMemo, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { LeafletMap } from "@/components/LeafletMap";
import { SetupPanel } from "@/components/SetupPanel";
import { BuoyDetailPanel } from "@/components/BuoyDetailPanel";
import { MarkEditPanel } from "@/components/MarkEditPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AlertBanner } from "@/components/AlertBanner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event, Buoy, Mark, Course, MarkRole, CourseShape, EventType } from "@shared/schema";
import { 
  useBuoys, 
  useEvents, 
  useCourses, 
  useMarks, 
  useWeatherData, 
  useBuoyCommand,
  useUpdateMark,
  useCreateMark,
  useDeleteMark,
  useDeleteAllMarks,
  useUpdateCourse,
  useCreateEvent,
  useCreateCourse,
} from "@/hooks/use-api";
import { queryClient } from "@/lib/queryClient";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useToast } from "@/hooks/use-toast";

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
function generateShapeMarks(shape: CourseShape, centerLat: number, centerLng: number): Array<{ name: string; role: MarkRole; lat: number; lng: number; order: number; isStartLine: boolean; isFinishLine: boolean }> {
  // Course leg length in degrees (approximately 400-500 meters)
  const legLength = 0.004;
  // Start line half-width (approximately 150 meters total line)
  const startLineHalfWidth = 0.0015;
  // Gate width (approximately 60 meters between marks - 3-4 boat lengths)
  const gateHalfWidth = 0.0006;
  
  // Trigonometric constants for 60° angles (equilateral triangle / trapezoid reaching legs)
  const cos60 = Math.cos(60 * Math.PI / 180); // 0.5
  const sin60 = Math.sin(60 * Math.PI / 180); // ~0.866
  
  // Base position - center of start line is the reference point
  // Wind assumed from north (0°/360°), so upwind is +lat, starboard is +lng
  const startLat = centerLat;
  const startLng = centerLng;
  
  switch (shape) {
    case "triangle":
      // Olympic Triangle Course (TL/TW - equilateral 60-60-60°)
      // Course: Start → Mark 1 (Windward) → Mark 2 (Wing) → Mark 3 (Leeward) → repeat/Finish
      // All three legs are equal length, forming a true equilateral triangle
      // Rounding to port (counter-clockwise): windward→wing is broad reach, wing→leeward is close reach
      // Start and Finish lines use same marks (Committee Boat + Pin)
      return [
        // Start line - Committee boat at STARBOARD (+lng), Pin at PORT (-lng)
        // Both marks serve as start AND finish line
        { name: "Committee Boat", role: "start_boat", lat: startLat, lng: startLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: true },
        { name: "Pin Mark", role: "pin", lat: startLat, lng: startLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: true },
        // Mark 1 - Windward mark (one leg length directly upwind from start)
        { name: "Mark 1 (Windward)", role: "windward", lat: startLat + legLength, lng: startLng, order: 2, isStartLine: false, isFinishLine: false },
        // Mark 2 - Wing mark (60° to STARBOARD, equal leg length from windward)
        // Position: halfway up in lat, offset to starboard by sin(60°)*legLength
        { name: "Mark 2 (Wing)", role: "wing", lat: startLat + legLength * cos60, lng: startLng + legLength * sin60, order: 3, isStartLine: false, isFinishLine: false },
        // Mark 3 - Leeward mark (at bottom/downwind, on centerline near start)
        // Equal leg length from wing mark back to leeward completes the equilateral
        { name: "Mark 3 (Leeward)", role: "leeward", lat: startLat, lng: startLng, order: 4, isStartLine: false, isFinishLine: false },
      ];
      
    case "trapezoid":
      // Outer Trapezoid Course (O - 60° reaching legs)
      // Course: Start → Mark 1 (Windward) → Mark 2 (Wing) → Gate → repeat
      // Standard ILCA/Olympic format with reaching legs at 60° angles
      // Creates upwind beat, reaching leg to wing, run to gate
      // Start and Finish lines use same marks (Committee Boat + Pin)
      return [
        // Start line - Committee boat at STARBOARD (+lng), Pin at PORT (-lng)
        // Both marks serve as start AND finish line
        { name: "Committee Boat", role: "start_boat", lat: startLat, lng: startLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: true },
        { name: "Pin Mark", role: "pin", lat: startLat, lng: startLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: true },
        // Mark 1 - Windward mark (one leg length directly upwind)
        { name: "Mark 1 (Windward)", role: "windward", lat: startLat + legLength, lng: startLng, order: 2, isStartLine: false, isFinishLine: false },
        // Offset mark - slightly below windward, offset to starboard for tactical options
        { name: "Offset Mark", role: "offset", lat: startLat + legLength * 0.9, lng: startLng + legLength * 0.15, order: 3, isStartLine: false, isFinishLine: false },
        // Mark 2 - Wing mark (60° reaching leg to starboard from windward)
        { name: "Mark 2 (Wing)", role: "wing", lat: startLat + legLength * 0.5, lng: startLng + legLength * sin60, order: 4, isStartLine: false, isFinishLine: false },
        // Gate marks at leeward end - starboard mark at +lng, port at -lng
        { name: "Mark 3s (Gate Starboard)", role: "gate", lat: startLat, lng: startLng + gateHalfWidth, order: 5, isStartLine: false, isFinishLine: false },
        { name: "Mark 3p (Gate Port)", role: "gate", lat: startLat, lng: startLng - gateHalfWidth, order: 6, isStartLine: false, isFinishLine: false },
      ];
      
    case "windward_leeward":
      // Windward-Leeward Course (L - leeward finish)
      // Course: Start → Mark 1 (Windward) → Gate → repeat → Finish at leeward
      // Pure upwind/downwind racing - most common modern format
      // Simplest course: beat to windward, run through gate, repeat
      // Start and Finish lines use same marks (Committee Boat + Pin)
      return [
        // Start line - Committee boat at STARBOARD (+lng), Pin at PORT (-lng)
        // Both marks serve as start AND finish line
        { name: "Committee Boat", role: "start_boat", lat: startLat, lng: startLng + startLineHalfWidth, order: 0, isStartLine: true, isFinishLine: true },
        { name: "Pin Mark", role: "pin", lat: startLat, lng: startLng - startLineHalfWidth, order: 1, isStartLine: true, isFinishLine: true },
        // Mark 1 - Windward mark (one leg length directly upwind from start line center)
        { name: "Mark 1 (Windward)", role: "windward", lat: startLat + legLength, lng: startLng, order: 2, isStartLine: false, isFinishLine: false },
        // Gate marks at leeward end (at start line latitude, straddling centerline)
        // Starboard mark at +lng, Port at -lng
        { name: "Mark 3s (Gate Starboard)", role: "gate", lat: startLat, lng: startLng + gateHalfWidth, order: 3, isStartLine: false, isFinishLine: false },
        { name: "Mark 3p (Gate Port)", role: "gate", lat: startLat, lng: startLng - gateHalfWidth, order: 4, isStartLine: false, isFinishLine: false },
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

export default function RaceControl() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [isPlacingMark, setIsPlacingMark] = useState(false);
  const [pendingMarkData, setPendingMarkData] = useState<{ name: string; role: MarkRole } | null>(null);
  const [repositioningMarkId, setRepositioningMarkId] = useState<string | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const { toast } = useToast();

  const { enabled: demoMode, toggleDemoMode, demoBuoys, sendCommand: sendDemoCommand } = useDemoMode();

  const { data: apiBuoys = [], isLoading: buoysLoading } = useBuoys();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: weatherData, isLoading: weatherLoading } = useWeatherData();
  
  // If no active course/event is set, use the first one from the list
  const currentEvent = activeEventId ? events.find(e => e.id === activeEventId) : events[0];
  const currentCourse = activeCourseId ? courses.find(c => c.id === activeCourseId) : courses[0];
  
  const courseId = currentCourse?.id ?? "";
  const { data: marks = [], isLoading: marksLoading } = useMarks(courseId);
  const buoyCommand = useBuoyCommand();
  const updateMark = useUpdateMark(courseId);
  const createMark = useCreateMark(courseId);
  const deleteMark = useDeleteMark(courseId);
  const updateCourse = useUpdateCourse();
  const createEvent = useCreateEvent();
  const createCourse = useCreateCourse();
  const deleteAllMarks = useDeleteAllMarks();

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

  const handleDeployCourse = useCallback(() => {
    toast({
      title: "Course Deployed",
      description: "All buoys are moving to their assigned positions.",
    });
    
    marks.forEach((mark) => {
      if (mark.assignedBuoyId) {
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
  }, [marks, demoMode, sendDemoCommand, buoyCommand, toast]);

  const handleRotateCourse = useCallback(() => {
    toast({
      title: "Course Rotation",
      description: "Adjusting course to align with current wind direction.",
    });
    setAlertDismissed(true);
  }, [toast]);

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

  const handleSaveMark = useCallback((id: string, data: Partial<Mark>) => {
    const mark = marks.find(m => m.id === id);
    const previousBuoyId = mark?.assignedBuoyId;
    const newBuoyId = data.assignedBuoyId;
    
    updateMark.mutate({ id, data }, {
      onSuccess: () => {
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
      },
    });
  }, [updateMark, marks, demoMode, sendDemoCommand, buoyCommand, toast]);

  const handleDeleteMark = useCallback((id: string) => {
    deleteMark.mutate(id, {
      onSuccess: () => {
        setSelectedMarkId(null);
        toast({
          title: "Mark Deleted",
          description: "Mark has been removed from the course.",
        });
      },
    });
  }, [deleteMark, toast]);

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
    }, {
      onSuccess: () => {
        toast({
          title: "Mark Created",
          description: `${data.name} has been added to the course.`,
        });
      },
    });
  }, [currentCourse, marks.length, createMark, toast]);

  const handlePlaceMarkOnMap = useCallback((data: { name: string; role: MarkRole }) => {
    if (repositioningMarkId) {
      setRepositioningMarkId(null);
    }
    setPendingMarkData(data);
    setIsPlacingMark(true);
    toast({
      title: "Place Mark",
      description: "Click on the map to place the mark.",
    });
  }, [repositioningMarkId, toast]);

  const [continuousPlacement, setContinuousPlacement] = useState(false);
  const [markCounter, setMarkCounter] = useState(1);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isPlacingMark && pendingMarkData && currentCourse) {
      const markName = continuousPlacement ? `Mark ${markCounter}` : pendingMarkData.name;
      createMark.mutate({
        courseId: currentCourse.id,
        name: markName,
        role: pendingMarkData.role,
        order: marks.length,
        lat,
        lng,
      }, {
        onSuccess: () => {
          toast({
            title: "Mark Created",
            description: `${markName} has been placed on the map.`,
          });
          if (continuousPlacement) {
            setMarkCounter(prev => prev + 1);
          } else {
            setIsPlacingMark(false);
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
    }
  }, [isPlacingMark, pendingMarkData, currentCourse, marks.length, createMark, repositioningMarkId, updateMark, toast, continuousPlacement, markCounter]);

  const handleStopPlacement = useCallback(() => {
    setIsPlacingMark(false);
    setPendingMarkData(null);
    setContinuousPlacement(false);
    setMarkCounter(1);
  }, []);

  const handleRepositionMark = useCallback((markId: string) => {
    if (repositioningMarkId === markId) {
      setRepositioningMarkId(null);
    } else {
      if (isPlacingMark) {
        setIsPlacingMark(false);
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

  const handleCreateRace = useCallback(async (data: {
    name: string;
    type: EventType;
    boatClass: string;
    targetDuration: number;
    courseShape: CourseShape;
    courseName: string;
  }) => {
    try {
      if (currentCourse) {
        await deleteAllMarks.mutateAsync(currentCourse.id);
      }
      
      const course = await createCourse.mutateAsync({
        name: data.courseName,
        shape: data.courseShape,
        centerLat: DEFAULT_CENTER.lat,
        centerLng: DEFAULT_CENTER.lng,
        rotation: 0,
        scale: 1,
      });

      const event = await createEvent.mutateAsync({
        name: data.name,
        type: data.type,
        sailClubId: "e026546d-c0b6-480e-b154-2d69fd341c11",
        boatClass: data.boatClass,
        targetDuration: data.targetDuration,
        courseId: course.id,
      });
      
      setActiveEventId(event.id);

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
        });
      }

      // Set the active course and event to the newly created ones
      setActiveCourseId(course.id);
      
      // Force refresh all queries to ensure UI shows new data
      await queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", course.id, "marks"] });

      if (data.courseShape === "custom") {
        setIsPlacingMark(true);
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
  }, [createCourse, createEvent, createMark, deleteAllMarks, currentCourse, toast, setActiveCourseId, setActiveEventId]);

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
        weatherData={activeWeatherData}
        demoMode={demoMode}
        onSettingsClick={() => setSettingsOpen(true)}
        onToggleDemoMode={toggleDemoMode}
        onCreateRace={handleCreateRace}
      />

      {!alertDismissed && (
        <AlertBanner 
          onDismiss={() => setAlertDismissed(true)}
          onRotateCourse={handleRotateCourse}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
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
              updateMark.mutate({ id: markId, data: { lat, lng } });
            }}
            isPlacingMark={isPlacingMark || !!repositioningMarkId}
            isContinuousPlacement={continuousPlacement}
            onStopPlacement={handleStopPlacement}
          />
        </main>

        <aside className="w-96 xl:w-[440px] border-l shrink-0 hidden lg:block">
          {selectedBuoy ? (
            <BuoyDetailPanel 
              buoy={selectedBuoy} 
              onClose={() => setSelectedBuoyId(null)} 
            />
          ) : selectedMark ? (
            <MarkEditPanel
              mark={selectedMark}
              buoys={buoys}
              onClose={() => setSelectedMarkId(null)}
              onSave={(data) => handleSaveMark(selectedMark.id, data)}
              onDelete={() => handleDeleteMark(selectedMark.id)}
              onReposition={() => handleRepositionMark(selectedMark.id)}
              isRepositioning={!!repositioningMarkId}
            />
          ) : (
            <SetupPanel 
              event={displayEvent}
              course={currentCourse}
              buoys={buoys}
              marks={marks}
              onMarkSelect={setSelectedMarkId}
              onBuoySelect={setSelectedBuoyId}
              onDeployCourse={handleDeployCourse}
              onSaveMark={handleSaveMark}
              onAddMark={handleAddMark}
              onPlaceMarkOnMap={handlePlaceMarkOnMap}
            />
          )}
        </aside>
      </div>

      <SettingsDialog 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        buoys={buoys}
      />
    </div>
  );
}
