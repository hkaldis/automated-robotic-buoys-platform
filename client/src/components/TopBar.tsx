import { Wind, Wifi, Settings, Menu, Play, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/hooks/use-settings";
import { CreateRaceDialog } from "./CreateRaceDialog";
import type { CourseShape, EventType } from "@shared/schema";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  currentSpeed: number;
  currentDirection: number;
  source: string;
}

interface TopBarProps {
  eventName: string;
  clubName: string;
  weatherData?: WeatherData | null;
  demoMode?: boolean;
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
  onToggleDemoMode?: () => void;
  onCreateRace?: (data: {
    name: string;
    type: EventType;
    boatClass: string;
    targetDuration: number;
    courseShape: CourseShape;
    courseName: string;
  }) => void;
}

export function TopBar({ 
  eventName, 
  clubName, 
  weatherData, 
  demoMode,
  onMenuClick, 
  onSettingsClick,
  onToggleDemoMode,
  onCreateRace,
}: TopBarProps) {
  const { formatSpeed, formatBearing } = useSettings();

  return (
    <header className="h-16 border-b bg-card flex items-center px-4 gap-4 shrink-0 sticky top-0 z-50" data-testid="topbar">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onMenuClick}
        className="lg:hidden"
        data-testid="button-menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-primary">RB</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate" data-testid="text-event-name">{eventName}</h1>
          <p className="text-xs text-muted-foreground truncate">{clubName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background border">
        <div 
          className="transition-transform"
          style={{ transform: `rotate(${(weatherData?.windDirection ?? 0) + 180}deg)` }}
        >
          <Wind className="w-5 h-5 text-chart-1" />
        </div>
        <div className="text-sm">
          <span className="font-mono font-medium" data-testid="text-wind-speed">
            {weatherData ? formatSpeed(weatherData.windSpeed) : "--"}
          </span>
          <span className="text-muted-foreground ml-2 font-mono" data-testid="text-wind-direction">
            {weatherData ? formatBearing(weatherData.windDirection) : "--"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onToggleDemoMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={demoMode ? "default" : "outline"} 
                size="sm"
                onClick={onToggleDemoMode}
                className="gap-2"
                data-testid="button-demo-toggle"
              >
                {demoMode ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Demo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {demoMode ? "Demo mode ON - using simulated buoys" : "Enable demo mode"}
            </TooltipContent>
          </Tooltip>
        )}

        {demoMode && (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            DEMO
          </Badge>
        )}

        {onCreateRace && (
          <CreateRaceDialog onCreateRace={onCreateRace} />
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wifi className={`w-4 h-4 ${demoMode ? "text-yellow-500" : "text-green-500"}`} />
              <span className="hidden sm:inline">{demoMode ? "Simulated" : "Connected"}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {demoMode ? "Using simulated buoys" : "All buoys connected"}
          </TooltipContent>
        </Tooltip>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
