import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Wind, RefreshCw, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { Mark } from "@shared/schema";
import {
  CourseType,
  BoatClass,
  DEFAULT_BEARINGS,
  calculateNewPosition,
  getCourseCenter,
  getCourseRadius,
} from "@/lib/course-bearings";

interface AutoAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marks: Mark[];
  windDirection: number;
  onApply: (adjustedMarks: Array<{ id: string; lat: number; lng: number }>) => void;
}

interface BearingOverride {
  role: string;
  bearing: number;
}

const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  windward_leeward: "Windward-Leeward",
  triangle: "Triangle",
  trapezoid: "Trapezoid",
};

const BOAT_CLASS_LABELS: Record<BoatClass, string> = {
  spinnaker: "Spinnaker",
  non_spinnaker: "Non-Spinnaker",
  foiling: "Foiling",
};

export function AutoAdjustDialog({
  open,
  onOpenChange,
  marks,
  windDirection,
  onApply,
}: AutoAdjustDialogProps) {
  const [courseType, setCourseType] = useState<CourseType>("windward_leeward");
  const [boatClass, setBoatClass] = useState<BoatClass>("spinnaker");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bearingOverrides, setBearingOverrides] = useState<BearingOverride[]>([]);

  const courseMarks = useMemo(() => {
    return marks.filter(
      (m) =>
        m.role === "windward" ||
        m.role === "leeward" ||
        m.role === "wing" ||
        m.role === "offset"
    );
  }, [marks]);

  const defaultBearings = useMemo(() => {
    return DEFAULT_BEARINGS[courseType]?.[boatClass] || [];
  }, [courseType, boatClass]);

  const getEffectiveBearing = (role: string): number => {
    const override = bearingOverrides.find((o) => o.role === role);
    if (override !== undefined) return override.bearing;
    const defaultBearing = defaultBearings.find((b) => b.role === role);
    return defaultBearing?.bearing ?? 0;
  };

  const handleBearingChange = (role: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    const normalized = ((numValue % 360) + 360) % 360;
    setBearingOverrides((prev) => {
      const existing = prev.filter((o) => o.role !== role);
      return [...existing, { role, bearing: normalized }];
    });
  };

  const previewPositions = useMemo(() => {
    if (courseMarks.length === 0) return [];

    const center = getCourseCenter(courseMarks);
    const radius = getCourseRadius(courseMarks, center);

    return courseMarks.map((mark) => {
      const bearing = getEffectiveBearing(mark.role);
      const distanceRatio =
        defaultBearings.find((b) => b.role === mark.role)?.distanceRatio ?? 1;
      const distance = radius * distanceRatio;

      const newPos = calculateNewPosition(
        center.lat,
        center.lng,
        windDirection,
        bearing,
        distance
      );

      return {
        id: mark.id,
        originalLat: mark.lat,
        originalLng: mark.lng,
        newLat: newPos.lat,
        newLng: newPos.lng,
        role: mark.role,
        bearing,
      };
    });
  }, [courseMarks, windDirection, defaultBearings, bearingOverrides]);

  const handleApply = () => {
    const adjustedMarks = previewPositions.map((p) => ({
      id: p.id,
      lat: p.newLat,
      lng: p.newLng,
    }));
    onApply(adjustedMarks);
    onOpenChange(false);
  };

  const resetOverrides = () => {
    setBearingOverrides([]);
  };

  const uniqueRoles = useMemo(() => {
    const roles = new Set(courseMarks.map((m) => m.role));
    return Array.from(roles);
  }, [courseMarks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="w-5 h-5" />
            Auto Adjust Marks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wind className="w-4 h-4" />
                <span>Wind Direction: {windDirection}°</span>
              </div>

              <div className="space-y-2">
                <Label>Course Type</Label>
                <Select
                  value={courseType}
                  onValueChange={(v) => setCourseType(v as CourseType)}
                >
                  <SelectTrigger className="h-12 text-base" data-testid="select-course-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COURSE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="py-3">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Boat Class</Label>
                <Select
                  value={boatClass}
                  onValueChange={(v) => setBoatClass(v as BoatClass)}
                >
                  <SelectTrigger className="h-12 text-base" data-testid="select-boat-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BOAT_CLASS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="py-3">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            size="lg"
            className="w-full justify-between h-12"
            onClick={() => setShowAdvanced(!showAdvanced)}
            data-testid="button-toggle-advanced"
          >
            <span>Override Bearings</span>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </Button>

          {showAdvanced && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">
                    Custom bearings (relative to wind)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetOverrides}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                </div>

                {uniqueRoles.map((role) => (
                  <div key={role} className="flex items-center gap-3">
                    <Label className="w-24 text-base capitalize">{role}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={359}
                        value={getEffectiveBearing(role)}
                        onChange={(e) => handleBearingChange(role, e.target.value)}
                        className="w-24 h-11 text-base"
                        data-testid={`input-bearing-${role}`}
                      />
                      <span className="text-base text-muted-foreground">°</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Preview: {courseMarks.length} marks will be adjusted
              </Label>
              <div className="space-y-1 text-sm">
                {previewPositions.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span className="capitalize">{p.role}</span>
                    <span className="text-muted-foreground">{p.bearing}° from wind</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 h-12"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-auto-adjust"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1 h-12"
            onClick={handleApply}
            disabled={courseMarks.length === 0}
            data-testid="button-apply-auto-adjust"
          >
            <Check className="w-5 h-5 mr-2" />
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
