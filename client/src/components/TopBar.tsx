import { Wifi, Settings, Menu, ToggleLeft, ToggleRight, Maximize, Minimize, ArrowLeft, Trash2, Wind } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/hooks/use-settings";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  source: string;
}

interface TopBarProps {
  eventName: string;
  clubName: string;
  demoMode?: boolean;
  userRole?: string;
  weatherData?: WeatherData | null;
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
  onToggleDemoMode?: () => void;
  onBackClick?: () => void;
  onClearCourse?: () => void;
}

export function TopBar({ 
  eventName, 
  clubName, 
  demoMode,
  userRole,
  weatherData,
  onMenuClick, 
  onSettingsClick,
  onToggleDemoMode,
  onBackClick,
  onClearCourse,
}: TopBarProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { formatSpeed, formatBearing } = useSettings();

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
    <header className="h-14 border-b bg-card flex items-center px-4 gap-3 shrink-0 sticky top-0 z-[9999]" data-testid="topbar">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onMenuClick}
        className="lg:hidden"
        data-testid="button-menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {onBackClick && (userRole === "super_admin" || userRole === "club_manager") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBackClick}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {userRole === "super_admin" ? "Back to clubs" : "Back to events"}
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">RB</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate" data-testid="text-event-name">{eventName}</h1>
          <p className="text-xs text-muted-foreground truncate">{clubName}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {onToggleDemoMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={demoMode ? "default" : "ghost"} 
                size="icon"
                onClick={onToggleDemoMode}
                data-testid="button-demo-toggle"
              >
                {demoMode ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {demoMode ? "Demo mode ON" : "Enable demo mode"}
            </TooltipContent>
          </Tooltip>
        )}

        {demoMode && (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-xs">
            DEMO
          </Badge>
        )}

        {onClearCourse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClearCourse}
                data-testid="button-clear-course"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear course</TooltipContent>
          </Tooltip>
        )}

        {weatherData && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50" data-testid="wind-display">
                <Wind className="w-4 h-4 text-chart-1" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-mono font-medium" data-testid="text-wind-speed">
                    {formatSpeed(weatherData.windSpeed)}
                  </span>
                  <span className="text-xs text-muted-foreground">from</span>
                  <span className="text-sm font-mono" data-testid="text-wind-direction">
                    {formatBearing(weatherData.windDirection)}
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Wind: {formatSpeed(weatherData.windSpeed)} from {formatBearing(weatherData.windDirection)} ({weatherData.source})
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center px-2">
              <Wifi className={`w-4 h-4 ${demoMode ? "text-yellow-500" : "text-green-500"}`} />
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
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
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
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
