import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Compass, Wind, Check, ChevronRight, ChevronLeft, SkipForward, RotateCcw, Anchor } from "lucide-react";
import type { Mark } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import {
  adjustSingleMarkToWind,
  calculateBearing,
  calculateDistance,
  movePoint,
  normalizeBearing,
  getStartLineCenter,
} from "@/lib/course-bearings";

export interface OriginalPosition {
  id: string;
  lat: number;
  lng: number;
}

interface WizardStep {
  type: "start_line" | "mark";
  markId?: string;
  markName?: string;
  markRole?: string;
  sequenceIndex?: number;
}

interface AutoAdjustWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marks: Mark[];
  roundingSequence: string[];
  windDirection: number;
  onApplyMark: (markId: string, lat: number, lng: number) => void;
  onApplyStartLine: (pinLat: number, pinLng: number, cbLat: number, cbLng: number) => void;
  onComplete: (originalPositions: OriginalPosition[]) => void;
}

const KNOWN_ROLES = ["windward", "leeward", "wing", "offset", "turning_mark"];

interface WindAngleDefaultsLocal {
  windward: number;
  leeward: number;
  wing: number;
  offset: number;
  turning_mark: number;
  other: number;
}

function getRoleDefault(role: string, defaults: WindAngleDefaultsLocal): number | null {
  if (role === "windward") return defaults.windward ?? 0;
  if (role === "leeward") return defaults.leeward ?? 180;
  if (role === "wing") return defaults.wing ?? -120;
  if (role === "offset") return defaults.offset ?? 10;
  if (role === "turning_mark") return defaults.turning_mark ?? 0;
  return null;
}

function isKnownRole(role: string): boolean {
  return KNOWN_ROLES.includes(role);
}

export function AutoAdjustWizard({
  open,
  onOpenChange,
  marks,
  roundingSequence,
  windDirection,
  onApplyMark,
  onApplyStartLine,
  onComplete,
}: AutoAdjustWizardProps) {
  const { windAngleDefaults } = useSettings();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [degreesInput, setDegreesInput] = useState<string>("");
  const [originalPositions, setOriginalPositions] = useState<OriginalPosition[]>([]);
  const [adjustedMarkIds, setAdjustedMarkIds] = useState<Set<string>>(new Set());
  const [startLineAdjusted, setStartLineAdjusted] = useState(false);
  const [localPositions, setLocalPositions] = useState<Map<string, { lat: number; lng: number }>>(new Map());

  const pinMark = useMemo(() => marks.find(m => m.role === "pin"), [marks]);
  const committeeMark = useMemo(() => marks.find(m => m.role === "start_boat"), [marks]);
  const hasStartLine = pinMark && committeeMark;

  const steps = useMemo((): WizardStep[] => {
    const result: WizardStep[] = [];
    
    if (hasStartLine) {
      result.push({ type: "start_line" });
    }
    
    const seenMarkIds = new Set<string>();
    for (let i = 0; i < roundingSequence.length; i++) {
      const item = roundingSequence[i];
      if (item === "start" || item === "finish") continue;
      
      if (seenMarkIds.has(item)) continue;
      seenMarkIds.add(item);
      
      const mark = marks.find(m => m.id === item);
      if (!mark) continue;
      
      if (mark.role === "pin" || mark.role === "start_boat" || mark.role === "finish") continue;
      
      result.push({
        type: "mark",
        markId: mark.id,
        markName: mark.name,
        markRole: mark.role,
        sequenceIndex: i,
      });
    }
    
    return result;
  }, [marks, roundingSequence, hasStartLine]);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isComplete = currentStepIndex >= steps.length;

  const getCurrentMark = useCallback(() => {
    if (!currentStep || currentStep.type !== "mark") return null;
    const mark = marks.find(m => m.id === currentStep.markId);
    if (!mark) return null;
    const localPos = localPositions.get(mark.id);
    if (localPos) {
      return { ...mark, lat: localPos.lat, lng: localPos.lng };
    }
    return mark;
  }, [currentStep, marks, localPositions]);

  const getLocalStartLineCenter = useCallback((): { lat: number; lng: number } | null => {
    const pinPos = pinMark ? (localPositions.get(pinMark.id) || { lat: pinMark.lat, lng: pinMark.lng }) : null;
    const cbPos = committeeMark ? (localPositions.get(committeeMark.id) || { lat: committeeMark.lat, lng: committeeMark.lng }) : null;
    
    if (pinPos && cbPos) {
      return {
        lat: (pinPos.lat + cbPos.lat) / 2,
        lng: (pinPos.lng + cbPos.lng) / 2,
      };
    }
    if (cbPos) return cbPos;
    if (pinPos) return pinPos;
    return null;
  }, [pinMark, committeeMark, localPositions]);

  const getPreviousReference = useCallback((): { lat: number; lng: number } | null => {
    if (!currentStep || currentStep.type !== "mark") return null;
    
    const seqIndex = currentStep.sequenceIndex;
    if (seqIndex === undefined || seqIndex === 0) {
      return getLocalStartLineCenter();
    }
    
    for (let i = seqIndex - 1; i >= 0; i--) {
      const prevItem = roundingSequence[i];
      if (prevItem === "start") {
        return getLocalStartLineCenter();
      }
      const prevMark = marks.find(m => m.id === prevItem);
      if (prevMark) {
        const localPos = localPositions.get(prevMark.id);
        if (localPos) {
          return localPos;
        }
        return { lat: prevMark.lat, lng: prevMark.lng };
      }
    }
    
    return getLocalStartLineCenter();
  }, [currentStep, roundingSequence, marks, localPositions, getLocalStartLineCenter]);

  useEffect(() => {
    if (!currentStep) return;
    
    if (currentStep.type === "mark") {
      const role = currentStep.markRole || "";
      const defaultDegrees = getRoleDefault(role, windAngleDefaults);
      if (defaultDegrees !== null) {
        setDegreesInput(defaultDegrees.toString());
      } else {
        setDegreesInput("");
      }
    }
  }, [currentStep, windAngleDefaults]);

  const handleApplyStartLine = useCallback(() => {
    if (!pinMark || !committeeMark) return;
    
    if (!startLineAdjusted) {
      setOriginalPositions(prev => [
        ...prev,
        { id: pinMark.id, lat: pinMark.lat, lng: pinMark.lng },
        { id: committeeMark.id, lat: committeeMark.lat, lng: committeeMark.lng },
      ]);
    }
    
    const distanceM = calculateDistance(pinMark.lat, pinMark.lng, committeeMark.lat, committeeMark.lng);
    const bearingPinToCommittee = calculateBearing(pinMark.lat, pinMark.lng, committeeMark.lat, committeeMark.lng);
    const bearingCommitteeToPin = (bearingPinToCommittee + 180) % 360;
    
    const option1 = (windDirection + 90 + 360) % 360;
    const option2 = (windDirection - 90 + 360) % 360;
    
    const angleDiff = (a: number, b: number) => {
      let diff = Math.abs(a - b) % 360;
      return diff > 180 ? 360 - diff : diff;
    };
    
    const delta1 = angleDiff(bearingCommitteeToPin, option1);
    const delta2 = angleDiff(bearingCommitteeToPin, option2);
    const targetBearing = delta1 <= delta2 ? option1 : option2;
    
    const newPin = movePoint(committeeMark.lat, committeeMark.lng, targetBearing, distanceM);
    
    setLocalPositions(prev => {
      const next = new Map(prev);
      next.set(pinMark.id, { lat: newPin.lat, lng: newPin.lng });
      next.set(committeeMark.id, { lat: committeeMark.lat, lng: committeeMark.lng });
      return next;
    });
    
    onApplyStartLine(newPin.lat, newPin.lng, committeeMark.lat, committeeMark.lng);
    setStartLineAdjusted(true);
    
    setCurrentStepIndex(prev => prev + 1);
  }, [pinMark, committeeMark, windDirection, onApplyStartLine, startLineAdjusted]);

  const handleApplyMark = useCallback(() => {
    const mark = getCurrentMark();
    const ref = getPreviousReference();
    
    if (!mark || !ref) return;
    
    const degrees = parseFloat(degreesInput);
    if (isNaN(degrees)) return;
    
    const originalMark = marks.find(m => m.id === mark.id);
    if (originalMark && !adjustedMarkIds.has(mark.id)) {
      setOriginalPositions(prev => [
        ...prev,
        { id: mark.id, lat: originalMark.lat, lng: originalMark.lng },
      ]);
    }
    
    const result = adjustSingleMarkToWind(
      mark.lat,
      mark.lng,
      ref.lat,
      ref.lng,
      windDirection,
      degrees
    );
    
    setLocalPositions(prev => {
      const next = new Map(prev);
      next.set(mark.id, { lat: result.lat, lng: result.lng });
      return next;
    });
    
    onApplyMark(mark.id, result.lat, result.lng);
    setAdjustedMarkIds(prev => new Set(Array.from(prev).concat([mark.id])));
    
    setCurrentStepIndex(prev => prev + 1);
  }, [getCurrentMark, getPreviousReference, degreesInput, windDirection, onApplyMark, adjustedMarkIds, marks]);

  const handleSkip = useCallback(() => {
    setCurrentStepIndex(prev => prev + 1);
  }, []);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleFinish = useCallback(() => {
    onComplete(originalPositions);
    onOpenChange(false);
    
    setCurrentStepIndex(0);
    setOriginalPositions([]);
    setAdjustedMarkIds(new Set());
    setStartLineAdjusted(false);
    setDegreesInput("");
    setLocalPositions(new Map());
  }, [onComplete, originalPositions, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    
    setCurrentStepIndex(0);
    setOriginalPositions([]);
    setAdjustedMarkIds(new Set());
    setStartLineAdjusted(false);
    setDegreesInput("");
    setLocalPositions(new Map());
  }, [onOpenChange]);

  const currentMark = getCurrentMark();
  const currentRole = currentStep?.markRole || "";
  const needsUserInput = currentStep?.type === "mark" && !isKnownRole(currentRole);
  const adjustmentCount = adjustedMarkIds.size + (startLineAdjusted ? 1 : 0);

  if (steps.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Compass className="w-5 h-5" />
              Auto Adjust to Wind
            </DialogTitle>
          </DialogHeader>
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive">
                No marks to adjust. Add course marks and define a rounding sequence first.
              </p>
            </CardContent>
          </Card>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="h-12 flex-1">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="w-5 h-5" />
            Auto Adjust to Wind
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4" />
              <span>Wind: {windDirection}°</span>
            </div>
            <span>Step {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}</span>
          </div>

          {isComplete ? (
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Adjustment Complete</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {adjustmentCount} {adjustmentCount === 1 ? "item" : "items"} adjusted to wind direction.
                </p>
                {originalPositions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    You can undo all changes after closing this dialog.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : currentStep?.type === "start_line" ? (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Anchor className="w-5 h-5 text-primary" />
                  <span className="font-medium">Start Line</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Rotate the start line to be perpendicular to the wind direction.
                  The committee boat will stay fixed, and the pin will move.
                </p>
              </CardContent>
            </Card>
          ) : currentStep?.type === "mark" ? (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="font-medium">{currentStep.markName || "Mark"}</span>
                  </div>
                  <span className="text-sm text-muted-foreground capitalize">
                    {currentRole.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="degrees-input">
                    {needsUserInput ? "Enter degrees relative to wind:" : "Degrees relative to wind:"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="degrees-input"
                      type="number"
                      value={degreesInput}
                      onChange={(e) => setDegreesInput(e.target.value)}
                      className="h-12 text-base"
                      placeholder={needsUserInput ? "Enter degrees..." : "0"}
                      data-testid="input-wizard-degrees"
                    />
                    <span className="text-muted-foreground">°</span>
                  </div>
                  {!needsUserInput && (
                    <p className="text-xs text-muted-foreground">
                      Default for {currentRole.replace(/_/g, " ")}: {getRoleDefault(currentRole, windAngleDefaults)}°
                    </p>
                  )}
                  {needsUserInput && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Unknown role - please specify the desired angle
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isComplete ? (
            <Button
              size="lg"
              className="w-full h-12"
              onClick={handleFinish}
              data-testid="button-wizard-finish"
            >
              <Check className="w-5 h-5 mr-2" />
              Finish
            </Button>
          ) : (
            <>
              <div className="flex gap-2 w-full">
                {currentStep?.type === "start_line" ? (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleSkip}
                      data-testid="button-wizard-skip"
                    >
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleApplyStartLine}
                      data-testid="button-wizard-apply-startline"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleSkip}
                      data-testid="button-wizard-skip"
                    >
                      <SkipForward className="w-4 h-4 mr-2" />
                      Skip
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1 h-12"
                      onClick={handleApplyMark}
                      disabled={degreesInput === "" || isNaN(parseFloat(degreesInput))}
                      data-testid="button-wizard-apply-mark"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  variant="ghost"
                  size="lg"
                  className="flex-1 h-12"
                  onClick={handleBack}
                  disabled={currentStepIndex === 0}
                  data-testid="button-wizard-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="flex-1 h-12"
                  onClick={handleClose}
                  data-testid="button-wizard-cancel"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
