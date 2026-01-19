import type { Course, Mark, CourseShape, CourseValidity, GeoPosition, LegInfo, MarkRole } from "@shared/schema";
import { weatherService } from "./weather-service";

type CourseListener = (course: Course | null, marks: Mark[]) => void;
type ValidityListener = (validity: CourseValidity) => void;

const EARTH_RADIUS_NM = 3440.065;

class CourseService {
  private course: Course | null = null;
  private marks: Map<string, Mark> = new Map();
  private listeners: Set<CourseListener> = new Set();
  private validityListeners: Set<ValidityListener> = new Set();
  private lastWindDirection: number = 0;
  private windShiftThreshold: number = 15;
  private driftThreshold: number = 0.02;

  subscribe(listener: CourseListener): () => void {
    this.listeners.add(listener);
    listener(this.course, this.getMarks());
    return () => this.listeners.delete(listener);
  }

  subscribeToValidity(listener: ValidityListener): () => void {
    this.validityListeners.add(listener);
    listener(this.getValidity());
    return () => this.validityListeners.delete(listener);
  }

  private notify(): void {
    const marks = this.getMarks();
    this.listeners.forEach(listener => listener(this.course, marks));
    this.notifyValidity();
  }

  private notifyValidity(): void {
    const validity = this.getValidity();
    this.validityListeners.forEach(listener => listener(validity));
  }

  setCourse(course: Course, marks: Mark[]): void {
    this.course = course;
    this.marks.clear();
    marks.forEach(mark => this.marks.set(mark.id, mark));
    this.lastWindDirection = weatherService.getWindDirectionDegrees();
    this.notify();
  }

  updateCourse(course: Partial<Course>): void {
    if (this.course) {
      this.course = { ...this.course, ...course };
      this.notify();
    }
  }

  updateMark(mark: Mark): void {
    this.marks.set(mark.id, mark);
    this.notify();
  }

  getCourse(): Course | null {
    return this.course;
  }

  getMarks(): Mark[] {
    return Array.from(this.marks.values()).sort((a, b) => a.order - b.order);
  }

  getMarkById(id: string): Mark | undefined {
    return this.marks.get(id);
  }

  getValidity(): CourseValidity {
    const currentWind = weatherService.getWindDirectionDegrees();
    const windShift = Math.abs(currentWind - this.lastWindDirection);
    const windShiftDetected = windShift > this.windShiftThreshold;

    const recommendations: string[] = [];
    if (windShiftDetected) {
      recommendations.push(`Wind has shifted ${windShift.toFixed(0)}°. Consider rotating course.`);
    }

    return {
      isValid: !windShiftDetected,
      windShiftDetected,
      buoyDriftDetected: false,
      recommendations,
    };
  }

  calculateDistance(pos1: GeoPosition, pos2: GeoPosition): number {
    const lat1 = pos1.lat * Math.PI / 180;
    const lat2 = pos2.lat * Math.PI / 180;
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_NM * c;
  }

  calculateBearing(pos1: GeoPosition, pos2: GeoPosition): number {
    const lat1 = pos1.lat * Math.PI / 180;
    const lat2 = pos2.lat * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  getLegs(): LegInfo[] {
    const marks = this.getMarks();
    const legs: LegInfo[] = [];

    for (let i = 0; i < marks.length - 1; i++) {
      const from = marks[i];
      const to = marks[i + 1];
      legs.push({
        fromMarkId: from.id,
        toMarkId: to.id,
        distance: this.calculateDistance(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng }
        ),
        bearing: this.calculateBearing(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng }
        ),
      });
    }

    return legs;
  }

  getTotalDistance(): number {
    return this.getLegs().reduce((sum, leg) => sum + leg.distance, 0);
  }

  generateCourseMarks(shape: CourseShape, center: GeoPosition, windDirection: number, scale: number = 1): Mark[] {
    const marks: Mark[] = [];
    const baseDistance = 0.25 * scale;

    const upwindBearing = windDirection;
    const downwindBearing = (windDirection + 180) % 360;

    switch (shape) {
      case "triangle":
        marks.push(this.createMark("Start Boat", "start_boat", 0, 
          this.offsetPosition(center, downwindBearing - 90, 0.05)));
        marks.push(this.createMark("Pin", "pin", 1, 
          this.offsetPosition(center, downwindBearing + 90, 0.05)));
        marks.push(this.createMark("Mark 1", "turning_mark", 2, 
          this.offsetPosition(center, upwindBearing, baseDistance)));
        marks.push(this.createMark("Mark 2", "turning_mark", 3, 
          this.offsetPosition(center, downwindBearing + 45, baseDistance * 0.7)));
        marks.push(this.createMark("Mark 3", "turning_mark", 4, 
          this.offsetPosition(center, downwindBearing - 45, baseDistance * 0.7)));
        break;
      case "trapezoid":
        marks.push(this.createMark("Start Boat", "start_boat", 0, 
          this.offsetPosition(center, downwindBearing - 90, 0.05)));
        marks.push(this.createMark("Pin", "pin", 1, 
          this.offsetPosition(center, downwindBearing + 90, 0.05)));
        marks.push(this.createMark("Mark 1", "turning_mark", 2, 
          this.offsetPosition(center, upwindBearing - 30, baseDistance)));
        marks.push(this.createMark("Mark 2", "turning_mark", 3, 
          this.offsetPosition(center, upwindBearing + 30, baseDistance)));
        marks.push(this.createMark("Mark 3", "turning_mark", 4, 
          this.offsetPosition(center, downwindBearing + 30, baseDistance * 0.6)));
        marks.push(this.createMark("Mark 4", "turning_mark", 5, 
          this.offsetPosition(center, downwindBearing - 30, baseDistance * 0.6)));
        break;
      case "windward_leeward":
        marks.push(this.createMark("Start Boat", "start_boat", 0, 
          this.offsetPosition(center, downwindBearing - 90, 0.05)));
        marks.push(this.createMark("Pin", "pin", 1, 
          this.offsetPosition(center, downwindBearing + 90, 0.05)));
        marks.push(this.createMark("Windward Mark", "turning_mark", 2, 
          this.offsetPosition(center, upwindBearing, baseDistance)));
        marks.push(this.createMark("Leeward Mark", "turning_mark", 3, 
          this.offsetPosition(center, downwindBearing, baseDistance)));
        break;
      default:
        marks.push(this.createMark("Start Boat", "start_boat", 0, center));
    }

    return marks;
  }

  private createMark(name: string, role: MarkRole, order: number, pos: GeoPosition): Mark {
    return {
      id: `mark-${Date.now()}-${order}`,
      courseId: this.course?.id ?? "",
      name,
      role,
      order,
      lat: pos.lat,
      lng: pos.lng,
      assignedBuoyId: null,
      isStartLine: false,
      isFinishLine: false,
      isCourseMark: true,
      isGate: false,
      gateWidthBoatLengths: 8,
      boatLengthMeters: 6,
      gatePartnerId: null,
      gateSide: null,
      gatePortBuoyId: null,
      gateStarboardBuoyId: null,
    };
  }

  private offsetPosition(center: GeoPosition, bearing: number, distanceNm: number): GeoPosition {
    const bearingRad = bearing * Math.PI / 180;
    const latRad = center.lat * Math.PI / 180;
    const lngRad = center.lng * Math.PI / 180;
    
    const angularDistance = distanceNm / EARTH_RADIUS_NM;
    
    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );
    
    const newLngRad = lngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );
    
    return {
      lat: newLatRad * 180 / Math.PI,
      lng: newLngRad * 180 / Math.PI,
    };
  }
}

export const courseService = new CourseService();
