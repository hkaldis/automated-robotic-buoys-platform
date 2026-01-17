import { Wind, Battery, Wifi, AlertTriangle, Settings, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

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
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
}

export function TopBar({ eventName, clubName, weatherData, onMenuClick, onSettingsClick }: TopBarProps) {
  const { formatSpeed, formatBearing } = useSettings();

  return (
    <header className="h-16 border-b bg-card flex items-center px-4 gap-4 shrink-0" data-testid="topbar">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="hidden sm:inline">Connected</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>All buoys connected</TooltipContent>
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
