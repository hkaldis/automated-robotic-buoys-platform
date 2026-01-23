import { Battery, Signal, Navigation, Clock, Waves } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Buoy, BuoyState } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface BuoyCardProps {
  buoy: Buoy;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function getBuoyStateColor(state: BuoyState): string {
  switch (state) {
    case "idle": return "text-blue-500";
    case "moving_to_target": return "text-orange-500";
    case "holding_position": return "text-green-500";
    case "station_keeping_degraded": return "text-yellow-500";
    case "unavailable": return "text-muted-foreground";
    case "maintenance": return "text-muted-foreground";
    case "fault": return "text-red-500";
    default: return "text-blue-500";
  }
}

function getBuoyStateBgColor(state: BuoyState): string {
  switch (state) {
    case "idle": return "bg-blue-500/20";
    case "moving_to_target": return "bg-orange-500/20";
    case "holding_position": return "bg-green-500/20";
    case "station_keeping_degraded": return "bg-yellow-500/20";
    case "unavailable": return "bg-muted";
    case "maintenance": return "bg-muted";
    case "fault": return "bg-red-500/20";
    default: return "bg-blue-500/20";
  }
}

function getBuoyStateLabel(state: BuoyState): string {
  switch (state) {
    case "idle": return "Idle";
    case "moving_to_target": return "Moving";
    case "holding_position": return "Loitering";
    case "station_keeping_degraded": return "Degraded";
    case "unavailable": return "Unavailable";
    case "maintenance": return "Maintenance";
    case "fault": return "Fault";
    default: return state;
  }
}

export function BuoyCard({ buoy, isSelected, onClick, compact = false }: BuoyCardProps) {
  const { formatSpeed, formatBearing } = useSettings();

  const stateColor = getBuoyStateColor(buoy.state as BuoyState);
  const stateBgColor = getBuoyStateBgColor(buoy.state as BuoyState);
  const stateLabel = getBuoyStateLabel(buoy.state as BuoyState);

  const isLowBattery = buoy.battery < 20;
  const batteryColor = isLowBattery 
    ? "text-purple-500" 
    : buoy.battery > 50 
      ? "text-green-500" 
      : "text-yellow-500";

  if (compact) {
    const isMoving = buoy.state === "moving_to_target";
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover-elevate transition-colors",
          isSelected && "ring-2 ring-primary bg-primary/5",
          isMoving && "bg-orange-500/5 border-orange-500/30"
        )}
        onClick={onClick}
        data-testid={`buoy-card-compact-${buoy.id}`}
      >
        <div className={cn(
          "w-3 h-3 rounded-full", 
          isMoving && "animate-pulse", 
          stateColor.replace("text-", "bg-"),
          isLowBattery && "ring-2 ring-purple-500 ring-offset-1"
        )} />
        <span className="font-medium flex-1 truncate">{buoy.name}</span>
        {isMoving && buoy.speed > 0 && (
          <div className="flex items-center gap-1 text-xs text-orange-500 font-mono">
            <Navigation className="w-3 h-3" />
            {formatSpeed(buoy.speed)}
          </div>
        )}
        {isMoving && buoy.eta && (
          <div className="flex items-center gap-1 text-xs text-orange-500 font-mono">
            <Clock className="w-3 h-3" />
            {Math.floor(buoy.eta / 60)}:{(buoy.eta % 60).toString().padStart(2, "0")}
          </div>
        )}
        {!isMoving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Battery className={cn("w-4 h-4", batteryColor)} />
            <span className={cn("font-mono", isLowBattery && "text-purple-500")}>{buoy.battery}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer hover-elevate transition-all",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={`buoy-card-${buoy.id}`}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full animate-pulse", stateColor.replace("text-", "bg-"))} />
          <span className="font-semibold">{buoy.name}</span>
        </div>
        <Badge variant="secondary" className={cn("text-xs", stateBgColor, stateColor)}>
          {stateLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono text-xs">
              {buoy.lat.toFixed(4)}, {buoy.lng.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-muted-foreground" />
            <span className="font-mono">{buoy.signalStrength}%</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Battery className={cn("w-4 h-4", batteryColor)} />
              Battery
            </span>
            <span className="font-mono">{buoy.battery}%</span>
          </div>
          <Progress value={buoy.battery} className="h-1.5" />
        </div>

        {buoy.state === "moving_to_target" && buoy.eta && (
          <div className="flex items-center justify-between text-sm p-2 rounded bg-orange-500/10">
            <span className="flex items-center gap-1.5 text-orange-500">
              <Clock className="w-4 h-4" />
              ETA
            </span>
            <span className="font-mono font-medium text-orange-500">
              {Math.floor(buoy.eta / 60)}:{(buoy.eta % 60).toString().padStart(2, "0")}
            </span>
          </div>
        )}

        {(buoy.windSpeed !== null || buoy.currentSpeed !== null) && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
            {buoy.windSpeed !== null && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Wind</span>
                <span className="font-mono">
                  {formatSpeed(buoy.windSpeed ?? 0)} @ {formatBearing(buoy.windDirection ?? 0)}
                </span>
              </div>
            )}
            {buoy.currentSpeed !== null && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Waves className="w-3 h-3" />
                  Current
                </span>
                <span className="font-mono">
                  {formatSpeed(buoy.currentSpeed ?? 0)} @ {formatBearing(buoy.currentDirection ?? 0)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
