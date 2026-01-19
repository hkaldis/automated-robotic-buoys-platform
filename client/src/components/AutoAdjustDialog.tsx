import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Wind, Check, AlertCircle } from "lucide-react";
import type { Mark } from "@shared/schema";
import {
  BoatClass,
  calculateSequentialAdjustments,
  getStartLineCenter,
} from "@/lib/course-bearings";

export interface OriginalPosition {
  id: string;
  lat: number;
  lng: number;
}

interface AutoAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marks: Mark[];
  windDirection: number;
  onApply: (adjustedMarks: Array<{ id: string; lat: number; lng: number }>, originalPositions: OriginalPosition[]) => void;
}

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
  const [boatClass, setBoatClass] = useState<BoatClass>("spinnaker");

  const courseMarks = useMemo(() => {
    return marks.filter(
      (m) =>
        m.role === "windward" ||
        m.role === "leeward" ||
        m.role === "wing" ||
        m.role === "offset"
    );
  }, [marks]);

  const startLineCenter = useMemo(() => {
    return getStartLineCenter(marks);
  }, [marks]);

  const hasStartLine = useMemo(() => {
    return marks.some((m) => m.role === "start_boat" || m.role === "pin");
  }, [marks]);

  const adjustmentResult = useMemo(() => {
    if (courseMarks.length === 0) {
      return { results: [], warnings: [], canApply: false };
    }

    const marksForCalc = courseMarks.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      role: m.role,
      order: m.order,
      isGate: m.isGate ?? false,
      gateSide: m.gateSide,
    }));

    return calculateSequentialAdjustments(
      marksForCalc,
      startLineCenter,
      windDirection,
      boatClass,
      hasStartLine
    );
  }, [courseMarks, startLineCenter, windDirection, boatClass, hasStartLine]);

  const handleApply = () => {
    if (!adjustmentResult.canApply) return;

    const originalPositions: OriginalPosition[] = adjustmentResult.results.map((r) => ({
      id: r.id,
      lat: r.originalLat,
      lng: r.originalLng,
    }));

    const adjustedMarks = adjustmentResult.results.map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
    }));

    onApply(adjustedMarks, originalPositions);
    onOpenChange(false);
  };

  const formatDelta = (delta: number): string => {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}°`;
  };

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

          {adjustmentResult.warnings.length > 0 && (
            <Card className="border-destructive bg-destructive/10">
              <CardContent className="pt-4">
                <Label className="text-xs text-destructive mb-2 block font-medium">
                  Cannot Apply Adjustments
                </Label>
                <ul className="text-sm text-destructive space-y-1">
                  {adjustmentResult.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {adjustmentResult.canApply && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Sequential Adjustments ({adjustmentResult.results.length} marks)
                </Label>
                <div className="text-xs text-muted-foreground mb-3">
                  Each mark adjusted relative to previous mark in sequence
                </div>
                <div className="space-y-2 text-sm">
                  {adjustmentResult.results.map((r, idx) => {
                    const mark = courseMarks.find((m) => m.id === r.id);
                    const isMicro = Math.abs(r.delta) <= 7;
                    return (
                      <div key={r.id} className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="font-medium">{idx + 1}. {mark?.name || "Mark"}</span>
                          <span className="text-muted-foreground ml-1 capitalize">({r.role})</span>
                        </div>
                        <div className="text-right">
                          <div className={isMicro ? "text-muted-foreground" : "font-medium"}>
                            {formatDelta(r.adjustedDelta)}
                            {isMicro && <span className="ml-1 text-xs">(micro)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(r.legBearing)}° → {Math.round(r.targetBearing)}°
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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
            disabled={!adjustmentResult.canApply}
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
