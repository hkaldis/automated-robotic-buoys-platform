import { useState } from "react";
import { Play, Anchor, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { CourseShapeSelector } from "./CourseShapeSelector";
import { MarksList } from "./MarksList";
import { BuoyCard } from "./BuoyCard";
import { WindIndicator } from "./WindIndicator";
import { BuoyDetailPanel } from "./BuoyDetailPanel";
import type { CourseShape, Event, Buoy, Mark } from "@shared/schema";
import { cn } from "@/lib/utils";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  source: string;
}

interface SidePanelProps {
  event: Event;
  buoys: Buoy[];
  marks: Mark[];
  selectedBuoy: Buoy | null;
  weatherData?: WeatherData | null;
  onBuoySelect?: (buoyId: string | null) => void;
  onDeployCourse?: () => void;
}

export function SidePanel({ event, buoys, marks, selectedBuoy, weatherData, onBuoySelect, onDeployCourse }: SidePanelProps) {
  const [selectedShape, setSelectedShape] = useState<CourseShape>("triangle");
  const [selectedMarkId, setSelectedMarkId] = useState<string | null>(null);
  const [buoysExpanded, setBuoysExpanded] = useState(true);

  if (selectedBuoy) {
    return (
      <BuoyDetailPanel 
        buoy={selectedBuoy} 
        onClose={() => onBuoySelect?.(null)} 
      />
    );
  }

  const assignedCount = marks.filter(m => m.assignedBuoyId).length;
  const totalMarks = marks.length;
  const allAssigned = totalMarks > 0 && assignedCount === totalMarks;

  return (
    <div className="h-full flex flex-col bg-card" data-testid="side-panel">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <Badge variant={event.type === "race" ? "default" : "secondary"}>
            {event.type === "race" ? "Race" : "Training"}
          </Badge>
          <span className="text-sm text-muted-foreground">{event.boatClass}</span>
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-event-name-panel">{event.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Target: {event.targetDuration} min
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="flex justify-center py-2">
            <WindIndicator size="md" weatherData={weatherData} />
          </div>

          <Separator />

          <CourseShapeSelector 
            selectedShape={selectedShape} 
            onSelect={setSelectedShape} 
          />

          <MarksList 
            marks={marks}
            buoys={buoys}
            selectedMarkId={selectedMarkId}
            onSelectMark={setSelectedMarkId}
          />

          <Collapsible open={buoysExpanded} onOpenChange={setBuoysExpanded}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover-elevate rounded-t-lg">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Anchor className="w-4 h-4" />
                      Available Buoys
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{buoys.length}</Badge>
                      {buoysExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-2">
                  {buoys.slice(0, 5).map((buoy) => (
                    <BuoyCard
                      key={buoy.id}
                      buoy={buoy}
                      compact
                      isSelected={selectedBuoy?.id === buoy.id}
                      onClick={() => onBuoySelect?.(buoy.id)}
                    />
                  ))}
                  {buoys.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No buoys available
                    </p>
                  )}
                  {buoys.length > 5 && (
                    <Button variant="ghost" className="w-full text-sm">
                      View all {buoys.length} buoys
                    </Button>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>

      <div className="p-4 border-t space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Marks assigned</span>
          <span className={cn(
            "font-medium",
            allAssigned ? "text-green-500" : "text-muted-foreground"
          )}>
            {assignedCount} / {totalMarks}
          </span>
        </div>

        <Button 
          className="w-full h-12 gap-2 text-base" 
          size="lg"
          disabled={!allAssigned && totalMarks > 0}
          onClick={onDeployCourse}
          data-testid="button-deploy-course"
        >
          <Play className="w-5 h-5" />
          Deploy Course
        </Button>
      </div>
    </div>
  );
}
