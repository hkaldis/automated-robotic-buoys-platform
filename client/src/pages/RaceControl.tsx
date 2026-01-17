import { useState, useMemo, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { LeafletMap } from "@/components/LeafletMap";
import { SidePanel } from "@/components/SidePanel";
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
  useUpdateCourse,
  useCreateEvent,
  useCreateCourse,
} from "@/hooks/use-api";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useToast } from "@/hooks/use-toast";

const MIKROLIMANO_CENTER = { lat: 37.9376, lng: 23.6917 };
const DEFAULT_CENTER = MIKROLIMANO_CENTER;

export default function RaceControl() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [isPlacingMark, setIsPlacingMark] = useState(false);
  const [pendingMarkData, setPendingMarkData] = useState<{ name: string; role: MarkRole } | null>(null);
  const [repositioningMarkId, setRepositioningMarkId] = useState<string | null>(null);
  const { toast } = useToast();

  const { enabled: demoMode, toggleDemoMode, demoBuoys, sendCommand: sendDemoCommand } = useDemoMode();

  const { data: apiBuoys = [], isLoading: buoysLoading } = useBuoys();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: weatherData, isLoading: weatherLoading } = useWeatherData();
  
  const currentEvent = events[0];
  const currentCourse = courses[0];
  
  const courseId = currentCourse?.id ?? "";
  const { data: marks = [], isLoading: marksLoading } = useMarks(courseId);
  const buoyCommand = useBuoyCommand();
  const updateMark = useUpdateMark(courseId);
  const createMark = useCreateMark(courseId);
  const deleteMark = useDeleteMark(courseId);
  const updateCourse = useUpdateCourse();
  const createEvent = useCreateEvent();
  const createCourse = useCreateCourse();

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
    updateMark.mutate({ id, data }, {
      onSuccess: () => {
        toast({
          title: "Mark Updated",
          description: "Mark has been saved successfully.",
        });
      },
    });
  }, [updateMark, toast]);

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
    setPendingMarkData(data);
    setIsPlacingMark(true);
    toast({
      title: "Place Mark",
      description: "Click on the map to place the mark.",
    });
  }, [toast]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isPlacingMark && pendingMarkData && currentCourse) {
      createMark.mutate({
        courseId: currentCourse.id,
        name: pendingMarkData.name,
        role: pendingMarkData.role,
        order: marks.length,
        lat,
        lng,
      }, {
        onSuccess: () => {
          toast({
            title: "Mark Created",
            description: `${pendingMarkData.name} has been placed on the map.`,
          });
          setIsPlacingMark(false);
          setPendingMarkData(null);
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
  }, [isPlacingMark, pendingMarkData, currentCourse, marks.length, createMark, repositioningMarkId, updateMark, toast]);

  const handleRepositionMark = useCallback((markId: string) => {
    if (repositioningMarkId === markId) {
      setRepositioningMarkId(null);
    } else {
      setRepositioningMarkId(markId);
      toast({
        title: "Reposition Mark",
        description: "Click on the map to set the new position.",
      });
    }
  }, [repositioningMarkId, toast]);

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
      const course = await createCourse.mutateAsync({
        name: data.courseName,
        shape: data.courseShape,
        centerLat: DEFAULT_CENTER.lat,
        centerLng: DEFAULT_CENTER.lng,
        rotation: 0,
        scale: 1,
      });

      await createEvent.mutateAsync({
        name: data.name,
        type: data.type,
        sailClubId: "e026546d-c0b6-480e-b154-2d69fd341c11",
        boatClass: data.boatClass,
        targetDuration: data.targetDuration,
        courseId: course.id,
      });

      toast({
        title: "Race Created",
        description: `${data.name} has been created with a ${data.courseShape} course.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create race. Please try again.",
        variant: "destructive",
      });
    }
  }, [createCourse, createEvent, toast]);

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
          />
        </main>

        <aside className="w-96 xl:w-[440px] border-l shrink-0 hidden lg:block">
          <SidePanel 
            event={displayEvent}
            course={currentCourse}
            buoys={buoys}
            marks={marks}
            selectedBuoy={selectedBuoy}
            selectedMark={selectedMark}
            weatherData={activeWeatherData}
            isRepositioningMark={!!repositioningMarkId}
            onBuoySelect={setSelectedBuoyId}
            onMarkSelect={setSelectedMarkId}
            onDeployCourse={handleDeployCourse}
            onSaveMark={handleSaveMark}
            onDeleteMark={handleDeleteMark}
            onAddMark={handleAddMark}
            onPlaceMarkOnMap={handlePlaceMarkOnMap}
            onRepositionMark={handleRepositionMark}
            onUpdateCourse={handleUpdateCourse}
            onUpdateMarks={handleUpdateMarks}
          />
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
