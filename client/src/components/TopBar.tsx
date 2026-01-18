import { Wind, Wifi, Settings, Menu, Play, ToggleLeft, ToggleRight, ArrowUp, Maximize, Minimize } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getFullscreenElement = useCallback(() => {
    const doc = document as any;
    return document.fullscreenElement || doc.webkitFullscreenElement;
  }, []);

  const updateFullscreenState = useCallback(() => {
    setIsFullscreen(!!getFullscreenElement());
  }, [getFullscreenElement]);

  useEffect(() => {
    updateFullscreenState();
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    };
  }, [updateFullscreenState]);

  const toggleFullscreen = useCallback(() => {
    const docEl = document.documentElement as any;
    const doc = document as any;
    
    if (!getFullscreenElement()) {
      const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      if (requestFs) {
        const promise = requestFs.call(docEl);
        if (promise && promise.then) {
          promise.then(updateFullscreenState).catch(() => {});
        }
      }
    } else {
      const exitFs = document.exitFullscreen || doc.webkitExitFullscreen;
      if (exitFs) {
        const promise = exitFs.call(document);
        if (promise && promise.then) {
          promise.then(updateFullscreenState).catch(() => {});
        }
      }
    }
  }, [getFullscreenElement, updateFullscreenState]);

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

      <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-background border" data-testid="weather-widget">
        <Wind className="w-5 h-5 text-chart-1 shrink-0" />
        <div className="flex items-center gap-2">
          <div 
            className="transition-transform"
            style={{ transform: `rotate(${(weatherData?.windDirection ?? 0) + 180}deg)` }}
            title={weatherData ? `Wind blows toward ${((weatherData.windDirection + 180) % 360).toFixed(0)}°` : "No wind data"}
          >
            <ArrowUp className="w-4 h-4 text-chart-1" />
          </div>
          <div className="text-sm">
            <span className="font-mono font-medium" data-testid="text-wind-speed">
              {weatherData ? formatSpeed(weatherData.windSpeed) : "--"}
            </span>
            <span className="text-muted-foreground ml-1 text-xs">from</span>
            <span className="text-muted-foreground ml-1 font-mono" data-testid="text-wind-direction">
              {weatherData ? formatBearing(weatherData.windDirection) : "--"}
            </span>
          </div>
        </div>
        {weatherData && (
          <span className="text-xs text-muted-foreground capitalize hidden sm:inline">
            ({weatherData.source})
          </span>
        )}
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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
