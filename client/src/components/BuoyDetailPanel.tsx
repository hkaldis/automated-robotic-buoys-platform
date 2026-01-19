import { useState } from "react";
import { X, Play, Pause, RotateCcw, Navigation, Battery, Signal, Wind, Waves, Clock, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Buoy, BuoyState } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { useBuoyCommand } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface BuoyDetailPanelProps {
  buoy: Buoy;
  onClose: () => void;
  demoSendCommand?: (buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => void;
  onTapMapToGoto?: () => void;
  isTapMapMode?: boolean;
  onNudgeBuoy?: (direction: "north" | "south" | "east" | "west") => void;
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

export function BuoyDetailPanel({ buoy, onClose, demoSendCommand, onTapMapToGoto, isTapMapMode, onNudgeBuoy }: BuoyDetailPanelProps) {
  const { formatSpeed, formatBearing } = useSettings();
  const { toast } = useToast();
  const buoyCommand = useBuoyCommand(demoSendCommand);
  const [gotoLat, setGotoLat] = useState("");
  const [gotoLng, setGotoLng] = useState("");

  const stateColor = getBuoyStateColor(buoy.state as BuoyState);
  const stateBgColor = getBuoyStateBgColor(buoy.state as BuoyState);
  const stateLabel = getBuoyStateLabel(buoy.state as BuoyState);

  const batteryColor = buoy.battery > 50 
    ? "text-green-500" 
    : buoy.battery > 20 
      ? "text-yellow-500" 
      : "text-destructive";

  const isMoving = buoy.state === "moving_to_target";
  const isHolding = buoy.state === "holding_position";

  const handleCommand = (command: "move_to_target" | "hold_position" | "cancel") => {
    buoyCommand.mutate({ id: buoy.id, command });
  };

  const handleGoToCoordinates = () => {
    const targetLat = parseFloat(gotoLat);
    const targetLng = parseFloat(gotoLng);
    if (isNaN(targetLat) || isNaN(targetLng)) {
      toast({ title: "Please enter valid coordinates", variant: "destructive" });
      return;
    }
    buoyCommand.mutate(
      { id: buoy.id, command: "move_to_target", targetLat, targetLng },
      {
        onSuccess: () => {
          toast({ title: `Buoy dispatched to ${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}` });
          setGotoLat("");
          setGotoLng("");
        },
        onError: () => {
          toast({ title: "Failed to send command to buoy", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="h-full flex flex-col bg-card" data-testid="buoy-detail-panel">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn("w-4 h-4 rounded-full animate-pulse", stateColor.replace("text-", "bg-"))} />
          <h2 className="text-lg font-semibold" data-testid="text-buoy-name">{buoy.name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={cn("text-sm", stateBgColor, stateColor)}>
            {stateLabel}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">ID: {buoy.id.slice(0, 8)}</span>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Latitude</span>
                <p className="font-mono font-medium">{buoy.lat.toFixed(6)}°</p>
              </div>
              <div>
                <span className="text-muted-foreground">Longitude</span>
                <p className="font-mono font-medium">{buoy.lng.toFixed(6)}°</p>
              </div>
            </div>
            {buoy.speed > 0 && (
              <div className="flex items-center justify-between text-sm pt-2 border-t">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-mono">{formatSpeed(buoy.speed)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {isMoving && buoy.targetLat && buoy.targetLng && (
          <Card className="border-chart-1/50 bg-chart-1/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-chart-1">
                <Navigation className="w-4 h-4" />
                Moving to Target
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Target Lat</span>
                  <p className="font-mono">{buoy.targetLat.toFixed(6)}°</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Target Lng</span>
                  <p className="font-mono">{buoy.targetLng.toFixed(6)}°</p>
                </div>
              </div>
              {buoy.eta && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm">
                    <Clock className="w-4 h-4" />
                    ETA
                  </span>
                  <span className="font-mono text-lg font-semibold text-chart-1">
                    {Math.floor(buoy.eta / 60)}:{(buoy.eta % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Battery className="w-4 h-4" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Battery</span>
                <span className={cn("font-mono font-medium", batteryColor)}>{buoy.battery}%</span>
              </div>
              <Progress value={buoy.battery} className="h-2" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Signal className="w-4 h-4" />
                Signal
              </span>
              <span className="font-mono">{buoy.signalStrength}%</span>
            </div>
          </CardContent>
        </Card>

        {(buoy.windSpeed !== null || buoy.currentSpeed !== null) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wind className="w-4 h-4" />
                Weather Station
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {buoy.windSpeed !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Wind</span>
                  <span className="font-mono">
                    {formatSpeed(buoy.windSpeed ?? 0)} @ {formatBearing(buoy.windDirection ?? 0)}
                  </span>
                </div>
              )}
              {buoy.currentSpeed !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Waves className="w-3 h-3" />
                    Current
                  </span>
                  <span className="font-mono">
                    {formatSpeed(buoy.currentSpeed ?? 0)} @ {formatBearing(buoy.currentDirection ?? 0)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* GoTo Commands Section */}
        <Card className="border-chart-1/30 bg-chart-1/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-chart-1">
              <Target className="w-4 h-4" />
              GoTo Commands
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tap Map to Go */}
            {onTapMapToGoto && (
              <Button 
                variant={isTapMapMode ? "default" : "outline"}
                className="w-full gap-2"
                onClick={onTapMapToGoto}
                data-testid="button-tap-map-goto"
              >
                <MapPin className="w-4 h-4" />
                {isTapMapMode ? "Tap Map Now..." : "Tap Map to Go"}
              </Button>
            )}

            {/* Directional nudge arrows */}
            {onNudgeBuoy && (
              <div className="flex flex-col items-center gap-1">
                <Label className="text-xs text-muted-foreground mb-1">Nudge Direction (~55m)</Label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => onNudgeBuoy("west")} data-testid="button-nudge-buoy-west">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex flex-col gap-1">
                    <Button variant="outline" size="icon" onClick={() => onNudgeBuoy("north")} data-testid="button-nudge-buoy-north">
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onNudgeBuoy("south")} data-testid="button-nudge-buoy-south">
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => onNudgeBuoy("east")} data-testid="button-nudge-buoy-east">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Custom coordinate input */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Go to Coordinates</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="Latitude"
                    value={gotoLat}
                    onChange={(e) => setGotoLat(e.target.value)}
                    className="text-xs"
                    data-testid="input-goto-lat"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="Longitude"
                    value={gotoLng}
                    onChange={(e) => setGotoLng(e.target.value)}
                    className="text-xs"
                    data-testid="input-goto-lng"
                  />
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleGoToCoordinates}
                  disabled={buoyCommand.isPending || !gotoLat || !gotoLng}
                  data-testid="button-goto-coordinates"
                >
                  {buoyCommand.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "GoTo"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="p-4 space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Commands</h3>
        
        {!isMoving && (
          <Button 
            className="w-full h-12 gap-2" 
            onClick={() => handleCommand("move_to_target")}
            disabled={buoyCommand.isPending}
            data-testid="button-move-to-target"
          >
            <Play className="w-4 h-4" />
            Move to Target
          </Button>
        )}

        {isMoving && (
          <Button 
            className="w-full h-12 gap-2" 
            variant="secondary"
            onClick={() => handleCommand("hold_position")}
            disabled={buoyCommand.isPending}
            data-testid="button-hold-position"
          >
            <Pause className="w-4 h-4" />
            Hold Position
          </Button>
        )}

        {(isMoving || isHolding) && (
          <Button 
            className="w-full h-12 gap-2" 
            variant="outline"
            onClick={() => handleCommand("cancel")}
            disabled={buoyCommand.isPending}
            data-testid="button-cancel"
          >
            <RotateCcw className="w-4 h-4" />
            Cancel & Return to Idle
          </Button>
        )}
      </div>
    </div>
  );
}
