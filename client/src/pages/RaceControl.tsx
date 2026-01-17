import { useState, useEffect, useMemo } from "react";
import { TopBar } from "@/components/TopBar";
import { MapView } from "@/components/MapView";
import { SidePanel } from "@/components/SidePanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { AlertBanner } from "@/components/AlertBanner";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event, Buoy, Mark, Course } from "@shared/schema";
import { useBuoys, useEvents, useCourses, useMarks, useWeatherData, useBuoyCommand } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

export default function RaceControl() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: buoys = [], isLoading: buoysLoading } = useBuoys();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: weatherData, isLoading: weatherLoading } = useWeatherData();
  
  const currentEvent = events[0];
  const currentCourse = courses[0];
  
  const { data: marks = [], isLoading: marksLoading } = useMarks(currentCourse?.id ?? "");
  const buoyCommand = useBuoyCommand();

  const selectedBuoy = useMemo(() => {
    if (!selectedBuoyId) return null;
    return buoys.find(b => b.id === selectedBuoyId) ?? null;
  }, [buoys, selectedBuoyId]);

  const handleDeployCourse = () => {
    toast({
      title: "Course Deployed",
      description: "All buoys are moving to their assigned positions.",
    });
    
    marks.forEach((mark) => {
      if (mark.assignedBuoyId) {
        buoyCommand.mutate({
          id: mark.assignedBuoyId,
          command: "move_to_target",
          targetLat: mark.lat,
          targetLng: mark.lng,
        });
      }
    });
  };

  const handleRotateCourse = () => {
    toast({
      title: "Course Rotation",
      description: "Adjusting course to align with current wind direction.",
    });
    setAlertDismissed(true);
  };

  const handleBuoyClick = (buoyId: string) => {
    setSelectedBuoyId(buoyId);
  };

  const handleMarkClick = (markId: string) => {
    console.log("Mark clicked:", markId);
  };

  const isLoading = buoysLoading || eventsLoading || coursesLoading;

  if (isLoading) {
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
        onSettingsClick={() => setSettingsOpen(true)}
        weatherData={weatherData}
      />

      {!alertDismissed && (
        <AlertBanner 
          onDismiss={() => setAlertDismissed(true)}
          onRotateCourse={handleRotateCourse}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative">
          <MapView 
            buoys={buoys}
            marks={marks}
            selectedBuoyId={selectedBuoyId}
            weatherData={weatherData}
            onBuoyClick={handleBuoyClick}
            onMarkClick={handleMarkClick}
          />
        </main>

        <aside className="w-96 xl:w-[440px] border-l shrink-0 hidden lg:block">
          <SidePanel 
            event={displayEvent}
            buoys={buoys}
            marks={marks}
            selectedBuoy={selectedBuoy}
            weatherData={weatherData}
            onBuoySelect={setSelectedBuoyId}
            onDeployCourse={handleDeployCourse}
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
