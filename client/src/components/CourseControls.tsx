import { useState, useEffect } from "react";
import { RotateCw, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Course, Mark } from "@shared/schema";

interface CourseControlsProps {
  course: Course;
  marks: Mark[];
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

export function CourseControls({ course, marks, onUpdateCourse, onUpdateMarks }: CourseControlsProps) {
  const [rotation, setRotation] = useState(course.rotation);
  const [scale, setScale] = useState(course.scale);
  const [rotationInput, setRotationInput] = useState(course.rotation.toString());

  useEffect(() => {
    setRotation(course.rotation);
    setScale(course.scale);
    setRotationInput(course.rotation.toString());
  }, [course]);

  const centerLat = course.centerLat;
  const centerLng = course.centerLng;

  const handleRotationChange = (newRotation: number) => {
    const rotationDelta = newRotation - rotation;
    setRotation(newRotation);
    setRotationInput(newRotation.toString());
    
    const rotatedMarks = marks.map(mark => {
      const { lat, lng } = rotatePoint(mark.lat, mark.lng, centerLat, centerLng, rotationDelta);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ rotation: newRotation });
    onUpdateMarks(rotatedMarks);
  };

  const handleRotationInputChange = (value: string) => {
    setRotationInput(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 360) {
      handleRotationChange(num);
    }
  };

  const handleScaleChange = (newScale: number) => {
    const scaleFactor = newScale / scale;
    setScale(newScale);
    
    const scaledMarks = marks.map(mark => {
      const { lat, lng } = scalePoint(mark.lat, mark.lng, centerLat, centerLng, scaleFactor);
      return { ...mark, lat, lng };
    });
    
    onUpdateCourse({ scale: newScale });
    onUpdateMarks(scaledMarks);
  };

  const handleRotateBy = (degrees: number) => {
    const newRotation = ((rotation + degrees) % 360 + 360) % 360;
    handleRotationChange(newRotation);
  };

  const handleScaleBy = (factor: number) => {
    const newScale = Math.max(0.5, Math.min(3, scale * factor));
    handleScaleChange(newScale);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Course Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Rotation</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={rotationInput}
                onChange={(e) => handleRotationInputChange(e.target.value)}
                className="w-16 h-7 text-xs font-mono text-right"
                min={0}
                max={360}
                data-testid="input-rotation"
              />
              <span className="text-xs text-muted-foreground">°</span>
            </div>
          </div>
          
          <Slider
            value={[rotation]}
            onValueChange={([val]) => handleRotationChange(val)}
            min={0}
            max={360}
            step={1}
            className="w-full"
            data-testid="slider-rotation"
          />
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleRotateBy(-15)}
              data-testid="button-rotate-ccw"
            >
              <RotateCcw className="w-3 h-3" />
              -15°
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleRotateBy(15)}
              data-testid="button-rotate-cw"
            >
              <RotateCw className="w-3 h-3" />
              +15°
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Scale</Label>
            <span className="text-xs font-mono">{scale.toFixed(2)}x</span>
          </div>
          
          <Slider
            value={[scale]}
            onValueChange={([val]) => handleScaleChange(val)}
            min={0.5}
            max={3}
            step={0.1}
            className="w-full"
            data-testid="slider-scale"
          />
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleScaleBy(0.8)}
              data-testid="button-scale-down"
            >
              <Minimize2 className="w-3 h-3" />
              Smaller
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 gap-1"
              onClick={() => handleScaleBy(1.25)}
              data-testid="button-scale-up"
            >
              <Maximize2 className="w-3 h-3" />
              Larger
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
