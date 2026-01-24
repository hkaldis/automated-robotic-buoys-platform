import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WindShiftAlertProps {
  setupWindDirection: number;
  currentWindDirection: number;
  onRealign: () => void;
}

function normalizeAngleDiff(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

export function WindShiftAlert({ setupWindDirection, currentWindDirection, onRealign }: WindShiftAlertProps) {
  const windShift = normalizeAngleDiff(currentWindDirection - setupWindDirection);
  const absShift = Math.abs(windShift);
  
  if (absShift < 10) return null;
  
  const direction = windShift > 0 ? "right" : "left";
  const isSevere = absShift >= 20;
  
  return (
    <div 
      className={cn(
        "absolute top-3 left-1/2 -translate-x-1/2 z-[600] px-4 py-2 rounded-lg shadow-lg flex items-center gap-3",
        isSevere 
          ? "bg-destructive text-destructive-foreground" 
          : "bg-orange-500 dark:bg-orange-600 text-white"
      )}
      data-testid="wind-shift-alert"
    >
      <AlertTriangle className="w-5 h-5 flex-shrink-0" />
      <div className="text-sm font-medium">
        Wind shifted {absShift.toFixed(0)}° {direction}
      </div>
      <Button
        size="sm"
        variant={isSevere ? "secondary" : "outline"}
        className="gap-1.5"
        onClick={onRealign}
        data-testid="button-realign-course"
      >
        <RotateCw className="w-4 h-4" />
        Re-align
      </Button>
    </div>
  );
}
