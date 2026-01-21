import { Ruler, Gauge, Wind, Eye, Anchor, Compass, RotateCcw, Map, Ship, Move } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { DistanceUnit, SpeedUnit, WindSource, Buoy } from "@shared/schema";
import { useSettings, DEFAULT_WIND_ANGLES, DEFAULT_BUOY_FOLLOW, DEFAULT_COURSE_ADJUSTMENT, DEFAULT_WIND_ARROWS_MIN_ZOOM, type StartLineResizeMode, type StartLineFixBearingMode, type WindAngleDefaults, type BuoyFollowSettings, type MapLayerType, type BuoyDeployMode, type CourseAdjustmentSettings } from "@/hooks/use-settings";
import { useState } from "react";

type MapOrientation = "north" | "head-to-wind";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buoys: Buoy[];
  showWindArrows?: boolean;
  onToggleWindArrows?: () => void;
  mapOrientation?: MapOrientation;
  onOrientationChange?: (orientation: MapOrientation) => void;
  onAlignCourseToWind?: () => void;
  hasMarks?: boolean;
  hasWeatherData?: boolean;
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

const mapLayerOptions: { value: MapLayerType; label: string; description: string }[] = [
  { value: "osm", label: "Standard Map", description: "OpenStreetMap street and terrain view" },
  { value: "satellite", label: "Satellite", description: "Aerial imagery view" },
  { value: "nautical", label: "Nautical Chart", description: "Marine chart styling" },
  { value: "ocean", label: "Ocean", description: "Lightweight marine basemap with bathymetry" },
];

const lightMapVariants: { value: MapLayerType; label: string; description: string }[] = [
  { value: "osm_nolabels", label: "Grey Water", description: "Minimalist grey tones" },
  { value: "light_voyager", label: "Blue Water", description: "Modern look with blue water" },
  { value: "light_positron", label: "With Labels", description: "Light theme with street labels" },
  { value: "light_toner", label: "Dark Mode", description: "Dark theme for night use" },
];

const windAngleLabels: Record<keyof WindAngleDefaults, string> = {
  windward: "Windward",
  leeward: "Leeward",
  wing: "Wing",
  offset: "Offset",
  turning_mark: "Turning Point",
  other: "Other",
};

const buoyDeployModeOptions: { value: BuoyDeployMode; label: string; description: string }[] = [
  { value: "automatic", label: "Automatic", description: "Buoys move immediately when points are moved" },
  { value: "manual", label: "Manual Deploy", description: "Move points freely, then deploy all buoys at once" },
];

export function SettingsDialog({ 
  open, 
  onOpenChange, 
  buoys, 
  showWindArrows = true, 
  onToggleWindArrows,
  mapOrientation = "north",
  onOrientationChange,
  onAlignCourseToWind,
  hasMarks = false,
  hasWeatherData = false,
}: SettingsDialogProps) {
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
    buoyFollowSettings,
    setBuoyFollowSetting,
    resetBuoyFollowSettings,
    mapLayer,
    setMapLayer,
    showSeaMarks,
    setShowSeaMarks,
    buoyDeployMode,
    setBuoyDeployMode,
    courseAdjustmentSettings,
    setCourseAdjustmentSetting,
    resetCourseAdjustmentSettings,
    windArrowsMinZoom,
    setWindArrowsMinZoom,
  } = useSettings();

  const [windSource, setWindSource] = useState<WindSource>("buoy");
  const [manualDirection, setManualDirection] = useState("180");
  const [manualSpeed, setManualSpeed] = useState("12");
  const [selectedBuoyId, setSelectedBuoyId] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="settings-dialog">
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
              {showWindArrows && (
                <div className="space-y-2 pl-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">
                      Min Zoom Level
                    </Label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {windArrowsMinZoom}
                    </span>
                  </div>
                  <Slider
                    value={[windArrowsMinZoom]}
                    onValueChange={([v]) => setWindArrowsMinZoom(v)}
                    min={8}
                    max={18}
                    step={1}
                    data-testid="slider-wind-arrows-min-zoom"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Arrows hidden below this zoom to improve performance
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="sea-marks-toggle" className="text-sm">
                  Show Sea Marks Overlay
                </Label>
                <Switch
                  id="sea-marks-toggle"
                  checked={showSeaMarks}
                  onCheckedChange={(checked) => setShowSeaMarks(checked)}
                  data-testid="switch-sea-marks"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="orientation-toggle" className="text-sm">
                  Head to Wind View
                </Label>
                <Switch
                  id="orientation-toggle"
                  checked={mapOrientation === "head-to-wind"}
                  onCheckedChange={(checked) => onOrientationChange?.(checked ? "head-to-wind" : "north")}
                  disabled={!hasWeatherData}
                  data-testid="switch-head-to-wind"
                />
              </div>
              {hasMarks && onAlignCourseToWind && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    onAlignCourseToWind();
                    onOpenChange(false);
                  }}
                  disabled={!hasWeatherData}
                  data-testid="button-align-course-wind"
                >
                  <Wind className="w-4 h-4" />
                  Align Course to Wind
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Map className="w-4 h-4" />
                Map Layer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={mapLayer} 
                onValueChange={(v) => setMapLayer(v as MapLayerType)}
                className="space-y-2"
              >
                {mapLayerOptions.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`map-${opt.value}`}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                    data-state={mapLayer === opt.value ? "checked" : "unchecked"}
                  >
                    <RadioGroupItem value={opt.value} id={`map-${opt.value}`} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </Label>
                ))}
                
                {/* Clean Map Styles */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground pt-2">Clean Styles</div>
                  <div className="grid grid-cols-2 gap-2">
                    {lightMapVariants.map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={`map-${opt.value}`}
                        className="flex items-start gap-2 p-2 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                        data-state={mapLayer === opt.value ? "checked" : "unchecked"}
                      >
                        <RadioGroupItem value={opt.value} id={`map-${opt.value}`} className="mt-0.5" />
                        <div>
                          <span className="text-xs font-medium">{opt.label}</span>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </div>
              </RadioGroup>
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
                Point Wind Angle Defaults
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Default degrees relative to wind when using "Adjust to Wind" on points.
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ship className="w-4 h-4" />
                Buoy Movement Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={buoyDeployMode} 
                onValueChange={(v) => setBuoyDeployMode(v as BuoyDeployMode)}
                className="space-y-2"
              >
                {buoyDeployModeOptions.map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`deploy-${opt.value}`}
                    className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover-elevate data-[state=checked]:ring-2 data-[state=checked]:ring-primary"
                    data-state={buoyDeployMode === opt.value ? "checked" : "unchecked"}
                  >
                    <RadioGroupItem value={opt.value} id={`deploy-${opt.value}`} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Move className="w-4 h-4" />
                Course Adjustment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure the step size for course rotation and resizing controls.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="rotation-degrees" className="text-sm">Rotate Course</Label>
                    <p className="text-[10px] text-muted-foreground">Degrees per rotation step</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="rotation-degrees"
                      type="number"
                      min={1}
                      max={45}
                      value={courseAdjustmentSettings.rotationDegrees}
                      onChange={(e) => setCourseAdjustmentSetting("rotationDegrees", parseInt(e.target.value) || 5)}
                      className="w-16 font-mono text-center"
                      data-testid="input-rotation-degrees"
                    />
                    <span className="text-xs text-muted-foreground w-6">°</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="resize-percent" className="text-sm">Resize Course</Label>
                    <p className="text-[10px] text-muted-foreground">Percentage change per resize step</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="resize-percent"
                      type="number"
                      min={1}
                      max={50}
                      value={courseAdjustmentSettings.resizePercent}
                      onChange={(e) => setCourseAdjustmentSetting("resizePercent", parseInt(e.target.value) || 10)}
                      className="w-16 font-mono text-center"
                      data-testid="input-resize-percent"
                    />
                    <span className="text-xs text-muted-foreground w-6">%</span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetCourseAdjustmentSettings}
                className="w-full"
                data-testid="button-reset-course-adjustment"
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Reset to Defaults
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Anchor className="w-4 h-4" />
                Buoy Follow Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Configure how buoys automatically follow point movements and correct drift.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="distance-threshold" className="text-sm">Distance Threshold</Label>
                    <p className="text-[10px] text-muted-foreground">Trigger reposition when buoy drifts this far</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="distance-threshold"
                      type="number"
                      min={1}
                      max={50}
                      value={buoyFollowSettings.distanceThresholdMeters}
                      onChange={(e) => setBuoyFollowSetting("distanceThresholdMeters", parseInt(e.target.value) || 3)}
                      className="w-16 font-mono text-center"
                      data-testid="input-distance-threshold"
                    />
                    <span className="text-xs text-muted-foreground w-6">m</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="poll-interval" className="text-sm">Poll Interval</Label>
                    <p className="text-[10px] text-muted-foreground">How often to check buoy positions</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="poll-interval"
                      type="number"
                      min={1}
                      max={60}
                      value={buoyFollowSettings.pollIntervalSeconds}
                      onChange={(e) => setBuoyFollowSetting("pollIntervalSeconds", parseInt(e.target.value) || 5)}
                      className="w-16 font-mono text-center"
                      data-testid="input-poll-interval"
                    />
                    <span className="text-xs text-muted-foreground w-6">sec</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="debounce-time" className="text-sm">Debounce Time</Label>
                    <p className="text-[10px] text-muted-foreground">Wait before sending reposition command</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="debounce-time"
                      type="number"
                      min={0}
                      max={30}
                      value={buoyFollowSettings.debounceTimeSeconds}
                      onChange={(e) => setBuoyFollowSetting("debounceTimeSeconds", parseInt(e.target.value) || 3)}
                      className="w-16 font-mono text-center"
                      data-testid="input-debounce-time"
                    />
                    <span className="text-xs text-muted-foreground w-6">sec</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Label htmlFor="acceptable-distance" className="text-sm">Acceptable Distance</Label>
                    <p className="text-[10px] text-muted-foreground">Consider buoy "on station" within this range</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id="acceptable-distance"
                      type="number"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={buoyFollowSettings.acceptableDistanceMeters}
                      onChange={(e) => setBuoyFollowSetting("acceptableDistanceMeters", parseFloat(e.target.value) || 1)}
                      className="w-16 font-mono text-center"
                      data-testid="input-acceptable-distance"
                    />
                    <span className="text-xs text-muted-foreground w-6">m</span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={resetBuoyFollowSettings}
                data-testid="button-reset-buoy-follow"
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
