import { Clock, Ruler, Flag, FlagTriangleRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Mark } from "@shared/schema";

interface CourseStatsProps {
  marks: Mark[];
  boatClass: string;
  targetDuration: number;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateCourseDistance(marks: Mark[]): number {
  if (marks.length < 2) return 0;
  
  // Sort marks by order to get the sailing sequence
  const sortedMarks = [...marks].sort((a, b) => a.order - b.order);
  
  // Find start line marks (committee boat and pin)
  const startBoat = sortedMarks.find(m => m.role === 'start_boat');
  const pinMark = sortedMarks.find(m => m.role === 'pin');
  
  // Get course marks (non-start-line marks) in sailing order
  const courseMarks = sortedMarks.filter(m => !m.isStartLine || m.role === 'start_boat');
  
  let totalDistance = 0;
  
  // Calculate distance between consecutive marks in sailing order
  for (let i = 0; i < courseMarks.length - 1; i++) {
    const from = courseMarks[i];
    const to = courseMarks[i + 1];
    totalDistance += haversineDistance(from.lat, from.lng, to.lat, to.lng);
  }
  
  // Add start line length (committee boat to pin)
  if (startBoat && pinMark) {
    totalDistance += haversineDistance(startBoat.lat, startBoat.lng, pinMark.lat, pinMark.lng);
  }
  
  // Add closing leg (last mark back to finish - typically start line)
  if (courseMarks.length > 1 && startBoat) {
    const lastMark = courseMarks[courseMarks.length - 1];
    if (lastMark.id !== startBoat.id) {
      totalDistance += haversineDistance(lastMark.lat, lastMark.lng, startBoat.lat, startBoat.lng);
    }
  }
  
  return totalDistance;
}

function estimateRaceTime(distanceNm: number, boatClass: string): number {
  const avgSpeeds: Record<string, number> = {
    'Laser': 4.5,
    'Optimist': 3.5,
    '420': 5.0,
    '470': 5.5,
    '49er': 8.0,
    'Finn': 5.0,
    'RS Feva': 4.0,
    'default': 4.5,
  };
  
  const speed = avgSpeeds[boatClass] || avgSpeeds['default'];
  return (distanceNm / speed) * 60;
}

export function CourseStats({ marks, boatClass, targetDuration }: CourseStatsProps) {
  const courseDistance = calculateCourseDistance(marks);
  const estimatedTime = estimateRaceTime(courseDistance, boatClass);
  
  const startLineMarks = marks.filter(m => m.isStartLine);
  const finishLineMarks = marks.filter(m => m.isFinishLine);
  const courseMarksOnly = marks.filter(m => !m.isStartLine && !m.isFinishLine);
  
  const hasStartLine = startLineMarks.length >= 2;
  const hasFinishLine = finishLineMarks.length >= 2;
  const sameStartFinish = startLineMarks.every(m => m.isFinishLine);
  
  const timeDiff = estimatedTime - targetDuration;
  const isWithinTarget = Math.abs(timeDiff) <= 5;
  
  if (marks.length === 0) {
    return null;
  }

  const missingStartLine = !hasStartLine && marks.length > 0;
  const missingFinishLine = !hasFinishLine && marks.length > 0;

  return (
    <Card data-testid="card-course-stats">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ruler className="w-4 h-4" />
          Course Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Course Length</p>
            <p className="text-lg font-semibold" data-testid="text-course-distance">
              {courseDistance.toFixed(2)} nm
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Est. Race Time</p>
            <p className="text-lg font-semibold" data-testid="text-estimated-time">
              {Math.round(estimatedTime)} min
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Target Duration</span>
          <div className="flex items-center gap-2">
            <span>{targetDuration} min</span>
            <Badge 
              variant={isWithinTarget ? "default" : "secondary"}
              className="text-xs"
            >
              {isWithinTarget ? "On Target" : timeDiff > 0 ? `+${Math.round(timeDiff)} min` : `${Math.round(timeDiff)} min`}
            </Badge>
          </div>
        </div>
        
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <FlagTriangleRight className="w-3 h-3" />
              Start Line
            </span>
            <Badge variant={hasStartLine ? "default" : "secondary"} className="text-xs">
              {hasStartLine ? `${startLineMarks.length} marks` : "Not set"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Flag className="w-3 h-3" />
              Finish Line
            </span>
            <Badge variant={hasFinishLine ? "default" : "secondary"} className="text-xs">
              {hasFinishLine ? (sameStartFinish ? "Same as Start" : `${finishLineMarks.length} marks`) : "Not set"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-3 h-3" />
              Course Marks
            </span>
            <span className="font-medium">{courseMarksOnly.length}</span>
          </div>
        </div>
        
        {(missingStartLine || missingFinishLine) && (
          <Alert variant="destructive" className="py-2" data-testid="alert-missing-lines">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {missingStartLine && missingFinishLine 
                ? "Start and finish lines not defined" 
                : missingStartLine 
                  ? "Start line not defined" 
                  : "Finish line not defined"}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
