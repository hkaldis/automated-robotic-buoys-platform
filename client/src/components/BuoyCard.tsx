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
    case "idle": return "text-muted-foreground";
    case "moving_to_target": return "text-chart-1";
    case "holding_position": return "text-green-500";
    case "station_keeping_degraded": return "text-yellow-500";
    case "unavailable": return "text-muted-foreground";
    case "maintenance": return "text-chart-3";
    case "fault": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

function getBuoyStateBgColor(state: BuoyState): string {
  switch (state) {
    case "idle": return "bg-muted";
    case "moving_to_target": return "bg-chart-1/20";
    case "holding_position": return "bg-green-500/20";
    case "station_keeping_degraded": return "bg-yellow-500/20";
    case "unavailable": return "bg-muted";
    case "maintenance": return "bg-chart-3/20";
    case "fault": return "bg-destructive/20";
    default: return "bg-muted";
  }
}

function getBuoyStateLabel(state: BuoyState): string {
  switch (state) {
    case "idle": return "Idle";
    case "moving_to_target": return "Moving";
    case "holding_position": return "Holding";
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

  const batteryColor = buoy.battery > 50 
    ? "text-green-500" 
    : buoy.battery > 20 
      ? "text-yellow-500" 
      : "text-destructive";

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover-elevate transition-colors",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
        onClick={onClick}
        data-testid={`buoy-card-compact-${buoy.id}`}
      >
        <div className={cn("w-3 h-3 rounded-full", stateBgColor, stateColor.replace("text-", "bg-"))} />
        <span className="font-medium flex-1 truncate">{buoy.name}</span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Battery className={cn("w-4 h-4", batteryColor)} />
          <span className="font-mono">{buoy.battery}%</span>
        </div>
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
          <div className="flex items-center justify-between text-sm p-2 rounded bg-chart-1/10">
            <span className="flex items-center gap-1.5 text-chart-1">
              <Clock className="w-4 h-4" />
              ETA
            </span>
            <span className="font-mono font-medium">
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
