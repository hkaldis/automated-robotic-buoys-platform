import { Ruler, Gauge, Wind, Eye, Anchor, Compass, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { DistanceUnit, SpeedUnit, WindSource, Buoy } from "@shared/schema";
import { useSettings, DEFAULT_WIND_ANGLES, type StartLineResizeMode, type StartLineFixBearingMode, type WindAngleDefaults } from "@/hooks/use-settings";
import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buoys: Buoy[];
  showWindArrows?: boolean;
  onToggleWindArrows?: () => void;
}

const distanceOptions: { value: DistanceUnit; label: string }[] = [
  { value: "nautical_miles", label: "Nautical Miles (nm)" },
  { value: "meters", label: "Meters (m)" },
  { value: "kilometers", label: "Kilometers (km)" },
  { value: "miles", label: "Miles (mi)" },
];

const speedOptions: { value: SpeedUnit; label: string }[] = [
  { value: "knots", label: "Knots (kts)" },
  { value: "ms", label: "Meters/sec (m/s)" },
  { value: "kmh", label: "Kilometers/hour (km/h)" },
  { value: "mph", label: "Miles/hour (mph)" },
  { value: "beaufort", label: "Beaufort Scale (Bft)" },
];

const windSourceOptions: { value: WindSource; label: string; description: string }[] = [
  { value: "buoy", label: "Buoy Weather Station", description: "Use weather data from selected buoy" },
  { value: "api", label: "Weather API", description: "External weather service" },
  { value: "manual", label: "Manual Input", description: "Enter wind data manually" },
];

const resizeModeOptions: { value: StartLineResizeMode; label: string }[] = [
  { value: "both", label: "Move Both" },
  { value: "pin", label: "Move Pin Only" },
  { value: "committee_boat", label: "Move Committee Boat Only" },
];

const fixBearingModeOptions: { value: StartLineFixBearingMode; label: string }[] = [
  { value: "pin", label: "Move Pin" },
  { value: "committee_boat", label: "Move Committee Boat" },
];

const windAngleLabels: Record<keyof WindAngleDefaults, string> = {
  windward: "Windward",
  leeward: "Leeward",
  wing: "Wing",
  offset: "Offset",
  turning_mark: "Turning Mark",
  other: "Other",
};

export function SettingsDialog({ open, onOpenChange, buoys, showWindArrows = true, onToggleWindArrows }: SettingsDialogProps) {
  const { 
    distanceUnit, 
    speedUnit, 
    setDistanceUnit, 
    setSpeedUnit,
    startLineResizeMode,
    startLineFixBearingMode,
    setStartLineResizeMode,
    setStartLineFixBearingMode,
    windAngleDefaults,
    setWindAngleDefault,
    resetWindAngleDefaults,
  } = useSettings();

  const [windSource, setWindSource] = useState<WindSource>("buoy");
  const [manualDirection, setManualDirection] = useState("180");
  const [manualSpeed, setManualSpeed] = useState("12");
  const [selectedBuoyId, setSelectedBuoyId] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure display units and wind data source preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Display Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="wind-arrows-toggle" className="text-sm">
                  Show Wind Arrows on Map
                </Label>
                <Switch
                  id="wind-arrows-toggle"
                  checked={showWindArrows}
                  onCheckedChange={() => onToggleWindArrows?.()}
                  data-testid="switch-wind-arrows"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ruler className="w-4 h-4" />
                Distance Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={distanceUnit} 
                onValueChange={(v) => setDistanceUnit(v as DistanceUnit)}
                className="grid grid-cols-2 gap-2"
              >
                {distanceOptions.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`dist-${opt.value}`}
                    className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                    data-state={distanceUnit === opt.value ? "checked" : "unchecked"}
                  >
                    <RadioGroupItem value={opt.value} id={`dist-${opt.value}`} />
                    <span className="text-sm">{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                Speed Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={speedUnit} 
                onValueChange={(v) => setSpeedUnit(v as SpeedUnit)}
                className="space-y-2"
              >
                {speedOptions.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`speed-${opt.value}`}
                    className="flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                    data-state={speedUnit === opt.value ? "checked" : "unchecked"}
                  >
                    <RadioGroupItem value={opt.value} id={`speed-${opt.value}`} />
                    <span className="text-sm">{opt.label}</span>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wind className="w-4 h-4" />
                Wind Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup 
                value={windSource} 
                onValueChange={(v) => setWindSource(v as WindSource)}
                className="space-y-2"
              >
                {windSourceOptions.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`wind-${opt.value}`}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                    data-state={windSource === opt.value ? "checked" : "unchecked"}
                  >
                    <RadioGroupItem value={opt.value} id={`wind-${opt.value}`} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>

              {windSource === "buoy" && buoys.length > 0 && (
                <div className="pt-2">
                  <Label className="text-sm text-muted-foreground mb-2 block">Select Buoy</Label>
                  <Select value={selectedBuoyId} onValueChange={setSelectedBuoyId}>
                    <SelectTrigger data-testid="select-wind-buoy">
                      <SelectValue placeholder="Select buoy..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buoys.filter(b => b.windSpeed !== null).map((buoy) => (
                        <SelectItem key={buoy.id} value={buoy.id}>
                          {buoy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {windSource === "manual" && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="wind-direction" className="text-sm text-muted-foreground mb-2 block">
                      Direction (°)
                    </Label>
                    <Input
                      id="wind-direction"
                      type="number"
                      min={0}
                      max={360}
                      value={manualDirection}
                      onChange={(e) => setManualDirection(e.target.value)}
                      className="font-mono"
                      data-testid="input-wind-direction"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wind-speed" className="text-sm text-muted-foreground mb-2 block">
                      Speed (kts)
                    </Label>
                    <Input
                      id="wind-speed"
                      type="number"
                      min={0}
                      max={100}
                      value={manualSpeed}
                      onChange={(e) => setManualSpeed(e.target.value)}
                      className="font-mono"
                      data-testid="input-wind-speed"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Anchor className="w-4 h-4" />
                Start Line Adjustments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  When resizing line (bigger/smaller)
                </Label>
                <Select value={startLineResizeMode} onValueChange={(v) => setStartLineResizeMode(v as StartLineResizeMode)}>
                  <SelectTrigger data-testid="select-resize-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resizeModeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  When fixing bearing to wind
                </Label>
                <Select value={startLineFixBearingMode} onValueChange={(v) => setStartLineFixBearingMode(v as StartLineFixBearingMode)}>
                  <SelectTrigger data-testid="select-fix-bearing-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fixBearingModeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Compass className="w-4 h-4" />
                Mark Wind Angle Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Default degrees relative to wind when using "Adjust to Wind" on marks.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(windAngleDefaults) as Array<keyof WindAngleDefaults>).map((role) => (
                  <div key={role} className="flex items-center gap-2">
                    <Label htmlFor={`wind-angle-${role}`} className="text-sm flex-1 min-w-0">
                      {windAngleLabels[role]}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        id={`wind-angle-${role}`}
                        type="number"
                        min={-180}
                        max={360}
                        value={windAngleDefaults[role]}
                        onChange={(e) => setWindAngleDefault(role, parseInt(e.target.value) || 0)}
                        className="w-20 font-mono text-center"
                        data-testid={`input-wind-angle-${role}`}
                      />
                      <span className="text-xs text-muted-foreground">°</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={resetWindAngleDefaults}
                data-testid="button-reset-wind-angles"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
