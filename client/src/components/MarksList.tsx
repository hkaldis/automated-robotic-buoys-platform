import { Flag, MapPin, FlagTriangleRight, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Mark, MarkRole, Buoy } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MarksListProps {
  marks: Mark[];
  buoys: Buoy[];
  selectedMarkId?: string | null;
  onSelectMark?: (markId: string) => void;
}

export function MarksList({ marks, buoys, selectedMarkId, onSelectMark }: MarksListProps) {
  const getBuoyById = (id: string) => buoys.find(b => b.id === id);

  const getRoleIcon = (role: MarkRole) => {
    switch (role) {
      case "start_boat": return Flag;
      case "pin": return FlagTriangleRight;
      case "finish": return Flag;
      case "turning_mark": return MapPin;
      default: return Circle;
    }
  };

  const getRoleColor = (role: MarkRole) => {
    switch (role) {
      case "start_boat": return "text-green-500";
      case "pin": return "text-green-500";
      case "finish": return "text-chart-3";
      case "turning_mark": return "text-chart-1";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Course Marks</span>
          <Badge variant="secondary" className="text-xs">{marks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          <div className="space-y-1 p-4 pt-0">
            {marks.map((mark) => {
              const Icon = getRoleIcon(mark.role as MarkRole);
              const color = getRoleColor(mark.role as MarkRole);
              const assignedBuoy = mark.assignedBuoyId ? getBuoyById(mark.assignedBuoyId) : null;

              return (
                <button
                  key={mark.id}
                  onClick={() => onSelectMark?.(mark.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover-elevate",
                    selectedMarkId === mark.id && "bg-primary/10 ring-1 ring-primary"
                  )}
                  data-testid={`button-mark-${mark.id}`}
                >
                  <div className={cn("w-8 h-8 rounded-lg bg-muted flex items-center justify-center", color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mark.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {mark.lat.toFixed(4)}, {mark.lng.toFixed(4)}
                    </p>
                  </div>
                  {assignedBuoy ? (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {assignedBuoy.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                      Unassigned
                    </Badge>
                  )}
                </button>
              );
            })}
            {marks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No marks defined yet
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
