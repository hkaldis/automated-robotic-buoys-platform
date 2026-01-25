import { useState, useEffect, useMemo } from "react";
import { 
  RotateCw, 
  RotateCcw, 
  Plus, 
  Minus, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Wind,
  Navigation,
  SlidersHorizontal,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Course, Mark } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";

interface CourseControlsProps {
  course: Course;
  marks: Mark[];
  windDirection?: number;
  onUpdateCourse: (data: Partial<Course>) => void;
  onUpdateMarks: (marks: Mark[]) => void;
}

function calculateBearing(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }): number {
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function rotatePoint(lat: number, lng: number, centerLat: number, centerLng: number, angleDeg: number): { lat: number; lng: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  
  const newDLat = dLat * cosA - dLng * sinA;
  const newDLng = dLat * sinA + dLng * cosA;
  
  return {
    lat: centerLat + newDLat,
    lng: centerLng + newDLng,
  };
}

function scalePoint(lat: number, lng: number, centerLat: number, centerLng: number, scaleFactor: number): { lat: number; lng: number } {
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  
  return {
    lat: centerLat + dLat * scaleFactor,
    lng: centerLng + dLng * scaleFactor,
  };
}

function translatePoint(lat: number, lng: number, dLat: number, dLng: number): { lat: number; lng: number } {
  return {
    lat: lat + dLat,
    lng: lng + dLng,
  };
}

const MOVE_STEP = 0.0005;
const ROTATION_STEP = 15;
const SCALE_FACTOR_UP = 1.2;
const SCALE_FACTOR_DOWN = 0.8;

export function CourseControls({ course, marks, windDirection, onUpdateCourse, onUpdateMarks }: CourseControlsProps) {
  const { courseResizeStartLineMode, setCourseResizeStartLineMode } = useSettings();
  const [rotation, setRotation] = useState(course.rotation);
  const [scale, setScale] = useState(course.scale);

  useEffect(() => {
    setRotation(course.rotation);
    setScale(course.scale);
  }, [course]);

  // Use start line midpoint as the pivot for rotation/scaling
  // This keeps the start line fixed while transforming the rest of the course
  const startLinePivot = useMemo(() => {
    const startBoat = marks.find(m => m.role === "start_boat");
    const pinEnd = marks.find(m => m.role === "pin");
    
    if (startBoat && pinEnd) {
      return {
        lat: (startBoat.lat + pinEnd.lat) / 2,
        lng: (startBoat.lng + pinEnd.lng) / 2,
      };
    }
    // Fallback to course center if no start line marks
    return { lat: course.centerLat, lng: course.centerLng };
  }, [marks, course.centerLat, course.centerLng]);

  const centerLat = startLinePivot.lat;
  const centerLng = startLinePivot.lng;

  const handleRotationChange = (newRotation: number) => {
    const rotationDelta = newRotation - rotation;
    setRotation(newRotation);
    
    const rotatedMarks = marks.map(mark => {
      const { lat, lng } = rotatePoint(mark.lat, mark.lng, centerLat, centerLng, rotationDelta);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ rotation: newRotation });
    onUpdateMarks(rotatedMarks);
  };

  const handleScaleChange = (newScale: number) => {
    const clampedScale = Math.max(0.5, Math.min(3, newScale));
    const scaleFactor = clampedScale / scale;
    setScale(clampedScale);
    
    const startBoat = marks.find(m => m.role === "start_boat");
    
    const scaledMarks = marks.map(mark => {
      // Check if this is a start line mark (by role or isStartLine flag)
      const isStartLineMark = mark.role === "start_boat" || mark.role === "pin" || mark.isStartLine;
      
      // Handle start line marks based on courseResizeStartLineMode
      if (isStartLineMark) {
        if (courseResizeStartLineMode === "keep_start_line") {
          // Keep both start line marks unchanged
          return mark;
        } else if (courseResizeStartLineMode === "keep_committee_boat") {
          // Keep committee boat fixed, move only the pin
          if (mark.role === "start_boat") {
            return mark;
          }
          // Scale pin from committee boat position
          if (startBoat) {
            const { lat, lng } = scalePoint(mark.lat, mark.lng, startBoat.lat, startBoat.lng, scaleFactor);
            return { ...mark, lat, lng };
          }
        }
        // Default "resize_all" - scale normally
      }
      
      const { lat, lng } = scalePoint(mark.lat, mark.lng, centerLat, centerLng, scaleFactor);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ scale: clampedScale });
    onUpdateMarks(scaledMarks);
  };

  const handleRotateBy = (degrees: number) => {
    const newRotation = ((rotation + degrees) % 360 + 360) % 360;
    handleRotationChange(newRotation);
  };

  const handleScaleBy = (factor: number) => {
    handleScaleChange(scale * factor);
  };

  const handleMove = (direction: "up" | "down" | "left" | "right") => {
    let dLat = 0;
    let dLng = 0;
    
    switch (direction) {
      case "up": dLat = MOVE_STEP; break;
      case "down": dLat = -MOVE_STEP; break;
      case "left": dLng = -MOVE_STEP; break;
      case "right": dLng = MOVE_STEP; break;
    }
    
    const movedMarks = marks.map(mark => {
      const { lat, lng } = translatePoint(mark.lat, mark.lng, dLat, dLng);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ 
      centerLat: centerLat + dLat, 
      centerLng: centerLng + dLng 
    });
    onUpdateMarks(movedMarks);
  };

  const handleAlignToWind = () => {
    if (windDirection === undefined) return;
    
    // Find the start line marks
    const startBoat = marks.find(m => m.role === "start_boat");
    const pinEnd = marks.find(m => m.role === "pin");
    
    if (!startBoat || !pinEnd) return;
    
    // Calculate current start line bearing (from start boat to pin)
    const currentStartLineBearing = calculateBearing(
      { lat: startBoat.lat, lng: startBoat.lng },
      { lat: pinEnd.lat, lng: pinEnd.lng }
    );
    
    // Per sailing race rules, the starting line should be perpendicular to the wind direction
    // Wind comes FROM windDirection, boats sail INTO the wind (upwind)
    // The start line bearing should be 90° offset from wind direction
    const desiredStartLineBearing = (windDirection + 90) % 360;
    
    // Calculate the rotation needed to align the start line
    let rotationDelta = desiredStartLineBearing - currentStartLineBearing;
    
    // Normalize to -180 to 180 range for shortest rotation
    if (rotationDelta > 180) rotationDelta -= 360;
    if (rotationDelta < -180) rotationDelta += 360;
    
    const newRotation = ((rotation + rotationDelta) % 360 + 360) % 360;
    setRotation(newRotation);
    
    const rotatedMarks = marks.map(mark => {
      const { lat, lng } = rotatePoint(mark.lat, mark.lng, centerLat, centerLng, rotationDelta);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ rotation: newRotation });
    onUpdateMarks(rotatedMarks);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            Course Controls
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-course-controls-settings"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-64 p-3">
                <div className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Maximize2 className="w-4 h-4" />
                  Scale Behavior
                </div>
                <RadioGroup 
                  value={courseResizeStartLineMode} 
                  onValueChange={(v) => setCourseResizeStartLineMode(v as "keep_start_line" | "keep_committee_boat" | "resize_all")}
                  className="space-y-1"
                >
                  <Label
                    htmlFor="course-resize-all"
                    className="flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer hover-elevate data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
                    data-state={courseResizeStartLineMode === "resize_all" ? "checked" : "unchecked"}
                    data-testid="option-course-resize-all"
                  >
                    <RadioGroupItem value="resize_all" id="course-resize-all" className="scale-75" />
                    Scale Everything
                  </Label>
                  <Label
                    htmlFor="course-keep-start"
                    className="flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer hover-elevate data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
                    data-state={courseResizeStartLineMode === "keep_start_line" ? "checked" : "unchecked"}
                    data-testid="option-course-keep-start-line"
                  >
                    <RadioGroupItem value="keep_start_line" id="course-keep-start" className="scale-75" />
                    Keep Start Line Fixed
                  </Label>
                  <Label
                    htmlFor="course-keep-cb"
                    className="flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer hover-elevate data-[state=checked]:ring-1 data-[state=checked]:ring-primary"
                    data-state={courseResizeStartLineMode === "keep_committee_boat" ? "checked" : "unchecked"}
                    data-testid="option-course-keep-committee-boat"
                  >
                    <RadioGroupItem value="keep_committee_boat" id="course-keep-cb" className="scale-75" />
                    Keep Committee Boat Fixed
                  </Label>
                </RadioGroup>
              </PopoverContent>
            </Popover>
          </span>
          <Badge variant="secondary" className="text-xs font-mono">
            {rotation.toFixed(0)}° / {scale.toFixed(1)}x
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Size</Label>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleScaleBy(SCALE_FACTOR_DOWN)}
              disabled={scale <= 0.5}
              data-testid="button-scale-down"
            >
              <Minus className="w-4 h-4" />
              Smaller
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleScaleBy(SCALE_FACTOR_UP)}
              disabled={scale >= 3}
              data-testid="button-scale-up"
            >
              <Plus className="w-4 h-4" />
              Larger
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Rotation</Label>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleRotateBy(-ROTATION_STEP)}
              data-testid="button-rotate-ccw"
            >
              <RotateCcw className="w-4 h-4" />
              Left
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleRotateBy(ROTATION_STEP)}
              data-testid="button-rotate-cw"
            >
              <RotateCw className="w-4 h-4" />
              Right
            </Button>
          </div>
          <Button 
            variant="default" 
            size="sm" 
            className="w-full gap-2"
            onClick={handleAlignToWind}
            disabled={windDirection === undefined}
            data-testid="button-align-wind"
          >
            <Wind className="w-4 h-4" />
            Align to Wind
            {windDirection !== undefined && (
              <span className="text-xs opacity-75">({windDirection.toFixed(0)}°)</span>
            )}
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Move Course</Label>
          <div className="grid grid-cols-3 gap-1">
            <div />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleMove("up")}
              data-testid="button-move-up"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
            <div />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleMove("left")}
              data-testid="button-move-left"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleMove("down")}
              data-testid="button-move-down"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleMove("right")}
              data-testid="button-move-right"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
