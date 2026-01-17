import { Triangle, Square, ArrowUpDown, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourseShape } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CourseShapeSelectorProps {
  selectedShape: CourseShape;
  onSelect: (shape: CourseShape) => void;
}

const shapes: { shape: CourseShape; label: string; icon: typeof Triangle; description: string }[] = [
  { 
    shape: "triangle", 
    label: "Triangle", 
    icon: Triangle,
    description: "Classic 3-mark course"
  },
  { 
    shape: "trapezoid", 
    label: "Trapezoid", 
    icon: Square,
    description: "4-mark trapezoid"
  },
  { 
    shape: "windward_leeward", 
    label: "W/L", 
    icon: ArrowUpDown,
    description: "Windward-Leeward"
  },
  { 
    shape: "custom", 
    label: "Custom", 
    icon: Pencil,
    description: "Draw your own"
  },
];

export function CourseShapeSelector({ selectedShape, onSelect }: CourseShapeSelectorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Course Shape</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {shapes.map(({ shape, label, icon: Icon, description }) => (
            <button
              key={shape}
              onClick={() => onSelect(shape)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover-elevate",
                selectedShape === shape 
                  ? "border-primary bg-primary/5 ring-1 ring-primary" 
                  : "border-border"
              )}
              data-testid={`button-shape-${shape}`}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                selectedShape === shape ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
