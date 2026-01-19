export type CourseType = "windward_leeward" | "triangle" | "trapezoid";
export type BoatClass = "spinnaker" | "non_spinnaker" | "foiling";

export interface MarkBearing {
  role: string;
  bearing: number;
  distanceRatio: number;
}

export interface SequencedMarkPosition {
  role: string;
  index: number; // 0 = first occurrence, 1 = second, etc.
  bearing: number;
  distanceRatio: number;
}

export interface CourseConfig {
  type: CourseType;
  boatClass: BoatClass;
  bearings: MarkBearing[];
}

// Base bearings for single-occurrence marks
export const DEFAULT_BEARINGS: Record<CourseType, Record<BoatClass, MarkBearing[]>> = {
  windward_leeward: {
    spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "offset", bearing: 10, distanceRatio: 0.1 },
      { role: "leeward", bearing: 180, distanceRatio: 1 },
    ],
    non_spinnaker: [
      { role: "windward", bearing: 0, distanceRatio: 1 },
      { role: "offset", bearing: 10, distanceRatio: 0.1 },
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

// Sequence-aware positions for multiple same-role marks
// Trapezoid with 2 leewards: first at 180°, second offset for gate width
// Trapezoid with 2 wings: port wing at 300° (left), starboard wing at 60° (right)
export const SEQUENCED_BEARINGS: Record<CourseType, Record<BoatClass, SequencedMarkPosition[]>> = {
  windward_leeward: {
    spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 }, // second windward offset
      { role: "offset", index: 0, bearing: 10, distanceRatio: 0.1 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 }, // leeward gate port
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 }, // leeward gate starboard
    ],
    non_spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 },
      { role: "offset", index: 0, bearing: 10, distanceRatio: 0.1 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
    ],
    foiling: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
    ],
  },
  triangle: {
    spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 120, distanceRatio: 1 },
      { role: "wing", index: 1, bearing: 240, distanceRatio: 1 }, // opposite wing
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
    ],
    non_spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 110, distanceRatio: 1 },
      { role: "wing", index: 1, bearing: 250, distanceRatio: 1 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
    ],
    foiling: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 100, distanceRatio: 1 },
      { role: "wing", index: 1, bearing: 260, distanceRatio: 1 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
    ],
  },
  trapezoid: {
    spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 60, distanceRatio: 0.67 }, // starboard wing
      { role: "wing", index: 1, bearing: 300, distanceRatio: 0.67 }, // port wing
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 }, // leeward gate port
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 }, // leeward gate starboard
      { role: "offset", index: 0, bearing: 10, distanceRatio: 0.1 },
    ],
    non_spinnaker: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 70, distanceRatio: 0.67 },
      { role: "wing", index: 1, bearing: 290, distanceRatio: 0.67 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
      { role: "offset", index: 0, bearing: 10, distanceRatio: 0.1 },
    ],
    foiling: [
      { role: "windward", index: 0, bearing: 0, distanceRatio: 1 },
      { role: "windward", index: 1, bearing: 355, distanceRatio: 1 },
      { role: "wing", index: 0, bearing: 60, distanceRatio: 0.67 },
      { role: "wing", index: 1, bearing: 300, distanceRatio: 0.67 },
      { role: "leeward", index: 0, bearing: 175, distanceRatio: 1 },
      { role: "leeward", index: 1, bearing: 185, distanceRatio: 1 },
      { role: "offset", index: 0, bearing: 10, distanceRatio: 0.1 },
    ],
  },
};

// Get bearing for a mark based on its role and occurrence index
export function getSequencedBearing(
  courseType: CourseType,
  boatClass: BoatClass,
  role: string,
  index: number
): { bearing: number; distanceRatio: number } | undefined {
  const positions = SEQUENCED_BEARINGS[courseType]?.[boatClass];
  if (!positions) return undefined;
  
  // Find exact match for role + index
  const match = positions.find((p) => p.role === role && p.index === index);
  if (match) return { bearing: match.bearing, distanceRatio: match.distanceRatio };
  
  // Fall back to first occurrence if index not found
  const fallback = positions.find((p) => p.role === role && p.index === 0);
  return fallback ? { bearing: fallback.bearing, distanceRatio: fallback.distanceRatio } : undefined;
}

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
