export type CourseType = "windward_leeward" | "triangle" | "trapezoid";
export type BoatClass = "spinnaker" | "non_spinnaker" | "foiling";

export interface MarkBearing {
  role: string;
  bearing: number;
  distanceRatio: number;
}

export interface CourseConfig {
  type: CourseType;
  boatClass: BoatClass;
  bearings: MarkBearing[];
}

export const DEFAULT_BEARINGS: Record<CourseType, Record<BoatClass, MarkBearing[]>> = {
  windward_leeward: {
    spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "offset", bearing: 0, distanceRatio: 0.05 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    non_spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "offset", bearing: 0, distanceRatio: 0.05 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    foiling: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
  },
  triangle: {
    spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 120, distanceRatio: 1 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    non_spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 110, distanceRatio: 1 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    foiling: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 100, distanceRatio: 1 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
  },
  trapezoid: {
    spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 60, distanceRatio: 0.67 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    non_spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 70, distanceRatio: 0.67 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    foiling: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "wing", bearing: 60, distanceRatio: 0.67 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
  },
};

export function getDefaultBearing(
  courseType: CourseType,
  boatClass: BoatClass,
  role: string
): number | undefined {
  const bearings = DEFAULT_BEARINGS[courseType]?.[boatClass];
  if (!bearings) return undefined;
  const mark = bearings.find((b) => b.role === role);
  return mark?.bearing;
}

export function getRoleBearingLabel(role: string): string {
  switch (role) {
    case "windward":
      return "Windward (0° - upwind)";
    case "leeward":
      return "Leeward (180° - downwind)";
    case "wing":
      return "Wing (60-120° - reaching)";
    case "offset":
      return "Offset (0° - near windward)";
    case "start_boat":
    case "pin":
      return "Start Line (90° - perpendicular)";
    case "finish":
      return "Finish (90° - perpendicular)";
    default:
      return "Custom";
  }
}

export function calculateNewPosition(
  centerLat: number,
  centerLng: number,
  windDirection: number,
  bearing: number,
  distanceMeters: number
): { lat: number; lng: number } {
  const absoluteBearing = (windDirection + bearing) % 360;
  const bearingRad = (absoluteBearing * Math.PI) / 180;
  
  const earthRadius = 6371000;
  const lat1 = (centerLat * Math.PI) / 180;
  const lng1 = (centerLng * Math.PI) / 180;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / earthRadius) +
    Math.cos(lat1) * Math.sin(distanceMeters / earthRadius) * Math.cos(bearingRad)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceMeters / earthRadius) * Math.cos(lat1),
    Math.cos(distanceMeters / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getCourseCenter(
  marks: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } {
  if (marks.length === 0) {
    return { lat: 0, lng: 0 };
  }
  const sumLat = marks.reduce((sum, m) => sum + m.lat, 0);
  const sumLng = marks.reduce((sum, m) => sum + m.lng, 0);
  return {
    lat: sumLat / marks.length,
    lng: sumLng / marks.length,
  };
}

export function getCourseRadius(
  marks: Array<{ lat: number; lng: number }>,
  center: { lat: number; lng: number }
): number {
  if (marks.length === 0) return 500;
  const distances = marks.map((m) =>
    calculateDistance(center.lat, center.lng, m.lat, m.lng)
  );
  return Math.max(...distances, 100);
}
