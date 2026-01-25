import { Anchor, Radio, Clock, StopCircle, X, SlidersHorizontal, Gauge, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Buoy, Mark, SpeedUnit, DistanceUnit } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface FleetStatusPanelProps {
  buoys: Buoy[];
  marks: Mark[];
  onBuoySelect?: (buoyId: string) => void;
  onBulkBuoyCommand?: (buoyIds: string[], command: "hold_position" | "cancel") => void;
  onClose?: () => void;
}

export function FleetStatusPanel({
  buoys,
  marks,
  onBuoySelect,
  onBulkBuoyCommand,
  onClose,
}: FleetStatusPanelProps) {
  const { 
    speedUnit, 
    setSpeedUnit,
    distanceUnit,
    setDistanceUnit,
  } = useSettings();
  
  const speedUnitOptions: { value: SpeedUnit; label: string }[] = [
    { value: "knots", label: "Knots" },
    { value: "ms", label: "m/s" },
    { value: "kmh", label: "km/h" },
    { value: "mph", label: "mph" },
  ];
  
  const distanceUnitOptions: { value: DistanceUnit; label: string }[] = [
    { value: "meters", label: "Meters" },
    { value: "nautical_miles", label: "NM" },
    { value: "kilometers", label: "km" },
    { value: "miles", label: "Miles" },
  ];
  
  const assignedBuoyIds = new Set<string>();
  const buoyToMarkMap = new Map<string, { markName: string; markRole: string }>();
  
  marks.forEach(mark => {
    if (mark.isGate) {
      if (mark.gatePortBuoyId) {
        assignedBuoyIds.add(mark.gatePortBuoyId);
        buoyToMarkMap.set(mark.gatePortBuoyId, { markName: `${mark.name} (Port)`, markRole: mark.role });
      }
      if (mark.gateStarboardBuoyId) {
        assignedBuoyIds.add(mark.gateStarboardBuoyId);
        buoyToMarkMap.set(mark.gateStarboardBuoyId, { markName: `${mark.name} (Stbd)`, markRole: mark.role });
      }
    } else if (mark.assignedBuoyId) {
      assignedBuoyIds.add(mark.assignedBuoyId);
      buoyToMarkMap.set(mark.assignedBuoyId, { markName: mark.name, markRole: mark.role });
    }
  });
  
  const assignedBuoys = buoys.filter(b => assignedBuoyIds.has(b.id));
  const unassignedBuoys = buoys.filter(b => !assignedBuoyIds.has(b.id));
  const gotoBuoys = unassignedBuoys.filter(b => 
    b.state === "moving_to_target" && b.targetLat != null && b.targetLng != null
  );
  const availableBuoys = unassignedBuoys.filter(b => 
    (b.state === "idle" || b.state === "holding_position") && 
    !gotoBuoys.includes(b)
  );
  const issueBuoys = buoys.filter(b => b.state === "fault" || b.state === "unavailable");
  
  const allMovingBuoys = buoys.filter(b => b.state === "moving_to_target");
  const allOnStationBuoys = buoys.filter(b => b.state === "holding_position");
  const allFaultBuoys = buoys.filter(b => b.state === "fault" || b.state === "unavailable");
  const allLowBatteryBuoys = buoys.filter(b => b.battery < 20);
  const allIdleBuoys = buoys.filter(b => b.state === "idle");
  
  const maxEtaSeconds = Math.max(0, ...assignedBuoys.map(b => b.eta ?? 0));
  const maxEtaMinutes = Math.floor(maxEtaSeconds / 60);
  const maxEtaSecondsRemainder = maxEtaSeconds % 60;
  
  const formatEta = (etaSeconds: number | null | undefined) => {
    if (!etaSeconds || etaSeconds <= 0) return null;
    const mins = Math.floor(etaSeconds / 60);
    const secs = etaSeconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };
  
  const getBuoyStateInfo = (state: string) => {
    switch (state) {
      case "moving_to_target":
        return { label: "Moving", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30" };
      case "holding_position":
        return { label: "Loitering", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30" };
      case "idle":
        return { label: "Idle", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30" };
      case "fault":
        return { label: "Fault", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30" };
      case "unavailable":
        return { label: "Offline", color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800/30" };
      default:
        return { label: state, color: "text-muted-foreground", bgColor: "bg-muted/50" };
    }
  };
  
  const renderBuoyCard = (buoy: Buoy, subtitle: string) => {
    const stateInfo = getBuoyStateInfo(buoy.state);
    const etaFormatted = formatEta(buoy.eta);
    
    return (
      <div
        key={buoy.id}
        className={cn(
          "p-2.5 rounded-lg cursor-pointer hover-elevate",
          stateInfo.bgColor
        )}
        onClick={() => onBuoySelect?.(buoy.id)}
        data-testid={`buoy-status-${buoy.id}`}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            buoy.state === "fault" || buoy.state === "unavailable" 
              ? "bg-red-500 text-white" 
              : buoy.state === "moving_to_target"
              ? "bg-orange-500 text-white"
              : buoy.state === "idle"
              ? "bg-blue-500 text-white"
              : "bg-green-500 text-white",
            buoy.battery < 20 && "ring-2 ring-purple-500 ring-offset-1"
          )}>
            <Anchor className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{buoy.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
            <span className={cn("font-mono", buoy.battery < 20 ? "text-purple-500" : "text-muted-foreground")}>
              {buoy.battery}%
            </span>
            {buoy.state === "moving_to_target" && (
              <>
                <span className="font-mono text-orange-600">{buoy.speed?.toFixed(1) ?? 0}kts</span>
                {etaFormatted && <span className="font-mono font-medium text-orange-600">{etaFormatted}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card" data-testid="fleet-status-panel">
      <div className="flex-1 flex flex-col p-3 gap-3 min-h-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Fleet Status</h2>
            <p className="text-xs text-muted-foreground">{buoys.length} buoys total</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                data-testid="button-fleet-settings"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="left" align="start" className="w-56 p-3">
              <div className="text-sm font-medium mb-3">Display Units</div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    Speed
                  </Label>
                  <RadioGroup 
                    value={speedUnit} 
                    onValueChange={(v) => setSpeedUnit(v as SpeedUnit)}
                    className="grid grid-cols-2 gap-1"
                  >
                    {speedUnitOptions.map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={`fleet-speed-${opt.value}`}
                        className="flex items-center gap-1.5 p-2 rounded-md text-xs cursor-pointer hover-elevate data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
                        data-state={speedUnit === opt.value ? "checked" : "unchecked"}
                      >
                        <RadioGroupItem value={opt.value} id={`fleet-speed-${opt.value}`} className="scale-75" />
                        {opt.label}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5" />
                    Distance
                  </Label>
                  <RadioGroup 
                    value={distanceUnit} 
                    onValueChange={(v) => setDistanceUnit(v as DistanceUnit)}
                    className="grid grid-cols-2 gap-1"
                  >
                    {distanceUnitOptions.map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={`fleet-distance-${opt.value}`}
                        className="flex items-center gap-1.5 p-2 rounded-md text-xs cursor-pointer hover-elevate data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
                        data-state={distanceUnit === opt.value ? "checked" : "unchecked"}
                      >
                        <RadioGroupItem value={opt.value} id={`fleet-distance-${opt.value}`} className="scale-75" />
                        {opt.label}
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-fleet"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1.5" data-testid="fleet-status-summary">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-1.5 text-center" data-testid="status-on-station">
            <p className="text-base font-bold text-green-600" data-testid="count-on-station">{allOnStationBuoys.length}</p>
            <p className="text-[9px] text-muted-foreground">Loitering</p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-1.5 text-center" data-testid="status-moving">
            <p className="text-base font-bold text-orange-600" data-testid="count-moving">{allMovingBuoys.length}</p>
            <p className="text-[9px] text-muted-foreground">Moving</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-1.5 text-center" data-testid="status-idle">
            <p className="text-base font-bold text-blue-600" data-testid="count-idle">{allIdleBuoys.length}</p>
            <p className="text-[9px] text-muted-foreground">Idle</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-1.5 text-center" data-testid="status-fault">
            <p className="text-base font-bold text-red-600" data-testid="count-fault">{allFaultBuoys.length}</p>
            <p className="text-[9px] text-muted-foreground">Fault</p>
          </div>
          <div className={cn(
            "rounded-lg p-1.5 text-center",
            allLowBatteryBuoys.length > 0 ? "bg-purple-50 dark:bg-purple-900/20" : "bg-muted/50"
          )} data-testid="status-low-battery">
            <p className={cn("text-base font-bold", allLowBatteryBuoys.length > 0 ? "text-purple-600" : "text-muted-foreground")} data-testid="count-low-battery">
              {allLowBatteryBuoys.length}
            </p>
            <p className="text-[9px] text-muted-foreground">Low Bat</p>
          </div>
        </div>

        {onBulkBuoyCommand && buoys.length > 0 && (
          <div className="flex gap-2" data-testid="bulk-actions">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onBulkBuoyCommand(buoys.map(b => b.id), "cancel")}
              data-testid="button-set-all-idle"
            >
              <StopCircle className="w-3.5 h-3.5" />
              All Idle
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onBulkBuoyCommand(buoys.map(b => b.id), "hold_position")}
              data-testid="button-set-all-loitering"
            >
              <Anchor className="w-3.5 h-3.5" />
              All Loitering
            </Button>
          </div>
        )}

        {maxEtaSeconds > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 flex items-center gap-2" data-testid="course-setup-eta">
            <Clock className="w-4 h-4 text-amber-600" />
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground">Course Ready In</p>
              <p className="text-base font-bold text-amber-600" data-testid="text-max-eta">
                {maxEtaMinutes > 0 ? `${maxEtaMinutes}m ${maxEtaSecondsRemainder}s` : `${maxEtaSecondsRemainder}s`}
              </p>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3">
            {assignedBuoys.length > 0 && (
              <div className="space-y-1.5" data-testid="section-assigned">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Assigned to Points ({assignedBuoys.length})
                </p>
                {assignedBuoys.map(buoy => {
                  const assignment = buoyToMarkMap.get(buoy.id);
                  return renderBuoyCard(buoy, assignment?.markName ?? "Point");
                })}
              </div>
            )}
            
            {gotoBuoys.length > 0 && (
              <div className="space-y-1.5" data-testid="section-goto">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  GoTo Target ({gotoBuoys.length})
                </p>
                {gotoBuoys.map(buoy => renderBuoyCard(buoy, "Manual GoTo"))}
              </div>
            )}
            
            {availableBuoys.length > 0 && (
              <div className="space-y-1.5" data-testid="section-available">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Available ({availableBuoys.length})
                </p>
                {availableBuoys.map(buoy => renderBuoyCard(buoy, "Ready"))}
              </div>
            )}
            
            {issueBuoys.length > 0 && (
              <div className="space-y-1.5" data-testid="section-issues">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Issues ({issueBuoys.length})
                </p>
                {issueBuoys.map(buoy => {
                  const stateInfo = getBuoyStateInfo(buoy.state);
                  return renderBuoyCard(buoy, stateInfo.label);
                })}
              </div>
            )}
            
            {buoys.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Anchor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No buoys in fleet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
