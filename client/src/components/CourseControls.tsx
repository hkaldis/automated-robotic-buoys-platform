import { useState, useEffect } from "react";
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
  Navigation
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Course, Mark } from "@shared/schema";

interface CourseControlsProps {
  course: Course;
  marks: Mark[];
  windDirection?: number;
  onUpdateCourse: (data: Partial<Course>) => void;
  onUpdateMarks: (marks: Mark[]) => void;
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
  const [rotation, setRotation] = useState(course.rotation);
  const [scale, setScale] = useState(course.scale);

  useEffect(() => {
    setRotation(course.rotation);
    setScale(course.scale);
  }, [course]);

  const centerLat = course.centerLat;
  const centerLng = course.centerLng;

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
    
    const scaledMarks = marks.map(mark => {
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
    
    const targetRotation = (windDirection + 180) % 360;
    const rotationDelta = targetRotation - rotation;
    
    setRotation(targetRotation);
    
    const rotatedMarks = marks.map(mark => {
      const { lat, lng } = rotatePoint(mark.lat, mark.lng, centerLat, centerLng, rotationDelta);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ rotation: targetRotation });
    onUpdateMarks(rotatedMarks);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          Course Controls
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
