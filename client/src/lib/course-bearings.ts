export type CourseType = "windward_leeward" | "triangle" | "trapezoid";
export type BoatClass = "spinnaker" | "non_spinnaker" | "foiling";

export interface MarkBearing {
  role: string;
  bearing: number;
  distanceRatio: number;
}

export interface SequencedMarkPosition {
  role: string;
  index: number;
  bearing: number;
  distanceRatio: number;
}

export interface CourseConfig {
  type: CourseType;
  boatClass: BoatClass;
  bearings: MarkBearing[];
}

export interface SequencePosition {
  lat: number;
  lng: number;
  id?: string;
  role?: string;
}

export interface AdjustmentResult {
  id: string;
  lat: number;
  lng: number;
  originalLat: number;
  originalLng: number;
  role: string;
  legBearing: number;
  targetBearing: number;
  delta: number;
  adjustedDelta: number;
}

const MICRO_THRESHOLD = 7;
const MICRO_FACTOR = 0.3;

export const ROLE_TARGET_BEARINGS: Record<string, number> = {
  windward: 0,
  leeward: 180,
  wing: -120,
  offset: 10,
};

export const WING_BEARINGS: Record<BoatClass, number> = {
  spinnaker: 120,
  non_spinnaker: 110,
  foiling: 100,
};

export const GATE_SPREAD = 5;

export interface MarkForAdjustment {
  id: string;
  lat: number;
  lng: number;
  role: string;
  order?: number;
  isGate?: boolean;
  gateSide?: string | null;
}

export function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360;
}

export function bearingDelta(from: number, to: number): number {
  let delta = normalizeBearing(to) - normalizeBearing(from);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

export interface WindAngleResult {
  signedRelative: number;
  absoluteTwa: number;
}

export function calculateWindAngle(legBearing: number, windDirection: number): WindAngleResult {
  let signedRelative = legBearing - windDirection;
  while (signedRelative > 180) signedRelative -= 360;
  while (signedRelative < -180) signedRelative += 360;
  
  const absoluteTwa = Math.abs(signedRelative);
  
  return { signedRelative, absoluteTwa };
}

export function formatWindRelative(signedRelative: number): string {
  const sign = signedRelative >= 0 ? "+" : "";
  return `${sign}${signedRelative.toFixed(0)}° to wind`;
}

// For start lines: Calculate deviation from perpendicular to wind
// 0° means the line is exactly perpendicular to the wind (ideal for upwind start)
export function calculateStartLineWindAngle(lineBearing: number, windDirection: number): WindAngleResult {
  // For a perpendicular start line, lineBearing should be windDirection + 90 (or - 90)
  // We want to show how far off from perpendicular the line is
  const perpendicularBearing = normalizeBearing(windDirection + 90);
  let signedRelative = lineBearing - perpendicularBearing;
  while (signedRelative > 180) signedRelative -= 360;
  while (signedRelative < -180) signedRelative += 360;
  
  // Clamp to -90 to +90 since the line could be perpendicular in either direction
  if (signedRelative > 90) signedRelative -= 180;
  if (signedRelative < -90) signedRelative += 180;
  
  const absoluteTwa = Math.abs(signedRelative);
  
  return { signedRelative, absoluteTwa };
}

export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const x = Math.sin(dLng) * Math.cos(lat2Rad);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return normalizeBearing(bearing);
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

export function movePoint(
  fromLat: number,
  fromLng: number,
  bearing: number,
  distanceMeters: number
): { lat: number; lng: number } {
  const bearingRad = (bearing * Math.PI) / 180;
  const earthRadius = 6371000;
  const lat1 = (fromLat * Math.PI) / 180;
  const lng1 = (fromLng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / earthRadius) +
      Math.cos(lat1) * Math.sin(distanceMeters / earthRadius) * Math.cos(bearingRad)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceMeters / earthRadius) * Math.cos(lat1),
      Math.cos(distanceMeters / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

export interface AdjustToWindResult {
  lat: number;
  lng: number;
  distanceFromRef: number;
  originalBearing: number;
  newBearing: number;
}

export function adjustSingleMarkToWind(
  markLat: number,
  markLng: number,
  refLat: number,
  refLng: number,
  windDirection: number,
  degreesToWind: number
): AdjustToWindResult {
  const distanceFromRef = calculateDistance(refLat, refLng, markLat, markLng);
  const originalBearing = calculateBearing(refLat, refLng, markLat, markLng);
  const newBearing = normalizeBearing(windDirection + degreesToWind);
  const newPosition = movePoint(refLat, refLng, newBearing, distanceFromRef);
  
  return {
    lat: newPosition.lat,
    lng: newPosition.lng,
    distanceFromRef,
    originalBearing,
    newBearing,
  };
}

export function getTargetLegBearing(
  role: string,
  windDirection: number,
  boatClass: BoatClass,
  roleIndex: number,
  isGate?: boolean,
  gateSide?: string | null
): number {
  let relativeBearing: number;

  switch (role) {
    case "windward":
      relativeBearing = 0;
      break;
    case "leeward":
      relativeBearing = 180;
      if (isGate && gateSide) {
        relativeBearing += gateSide === "port" ? -GATE_SPREAD : GATE_SPREAD;
      }
      break;
    case "wing":
      const wingBase = WING_BEARINGS[boatClass];
      relativeBearing = roleIndex === 0 ? wingBase : 360 - wingBase;
      break;
    case "offset":
      relativeBearing = 10;
      break;
    default:
      relativeBearing = 0;
  }

  return normalizeBearing(windDirection + relativeBearing);
}

export interface SequentialAdjustmentResult {
  results: AdjustmentResult[];
  warnings: string[];
  canApply: boolean;
}

export function validateMarksForAdjustment(
  marks: MarkForAdjustment[],
  hasStartLine: boolean
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let valid = true;

  if (!hasStartLine) {
    warnings.push("No start line - cannot calculate leg bearings");
    valid = false;
  }

  const orders = marks.map((m) => m.order ?? -1);
  const hasValidOrders = orders.every((o) => o >= 0);
  if (!hasValidOrders) {
    warnings.push("Some marks have missing order values");
    valid = false;
  }

  const validOrders = orders.filter((o) => o >= 0);
  const uniqueOrders = new Set(validOrders);
  if (uniqueOrders.size !== validOrders.length) {
    warnings.push("Some marks have duplicate order values");
    valid = false;
  }

  const gateMarks = marks.filter((m) => m.isGate);
  for (const gm of gateMarks) {
    if (!gm.gateSide) {
      warnings.push(`Gate mark "${gm.role}" missing side (port/starboard)`);
      valid = false;
    }
  }

  return { valid, warnings };
}

export function calculateSequentialAdjustments(
  marks: MarkForAdjustment[],
  startLineCenter: { lat: number; lng: number } | null,
  windDirection: number,
  boatClass: BoatClass,
  hasStartLine: boolean
): SequentialAdjustmentResult {
  if (marks.length === 0) {
    return { results: [], warnings: ["No course marks to adjust"], canApply: false };
  }

  const validation = validateMarksForAdjustment(marks, hasStartLine);

  if (!startLineCenter) {
    const extraWarning = hasStartLine
      ? "Start line marks have invalid coordinates"
      : "No start line - cannot calculate leg bearings";
    const allWarnings = validation.warnings.includes(extraWarning)
      ? validation.warnings
      : [...validation.warnings, extraWarning];
    return {
      results: [],
      warnings: allWarnings,
      canApply: false,
    };
  }

  if (!validation.valid) {
    return {
      results: [],
      warnings: validation.warnings,
      canApply: false,
    };
  }

  const sortedMarks = [...marks].sort((a, b) => (a.order || 0) - (b.order || 0));

  const roleCounts: Record<string, number> = {};
  const results: AdjustmentResult[] = [];

  let previousPosition: SequencePosition = startLineCenter;

  for (const mark of sortedMarks) {
    const roleIndex = roleCounts[mark.role] || 0;
    roleCounts[mark.role] = roleIndex + 1;

    const currentLegBearing = calculateBearing(
      previousPosition.lat,
      previousPosition.lng,
      mark.lat,
      mark.lng
    );

    const targetLegBearing = getTargetLegBearing(
      mark.role,
      windDirection,
      boatClass,
      roleIndex,
      mark.isGate,
      mark.gateSide
    );

    const delta = bearingDelta(currentLegBearing, targetLegBearing);

    let adjustedDelta: number;
    if (Math.abs(delta) <= MICRO_THRESHOLD) {
      adjustedDelta = delta * MICRO_FACTOR;
    } else {
      adjustedDelta = delta;
    }

    const legDistance = calculateDistance(
      previousPosition.lat,
      previousPosition.lng,
      mark.lat,
      mark.lng
    );

    const newBearing = normalizeBearing(currentLegBearing + adjustedDelta);
    const newPosition = movePoint(
      previousPosition.lat,
      previousPosition.lng,
      newBearing,
      legDistance
    );

    results.push({
      id: mark.id,
      lat: newPosition.lat,
      lng: newPosition.lng,
      originalLat: mark.lat,
      originalLng: mark.lng,
      role: mark.role,
      legBearing: currentLegBearing,
      targetBearing: targetLegBearing,
      delta,
      adjustedDelta,
    });

    previousPosition = newPosition;
  }

  return {
    results,
    warnings: validation.warnings,
    canApply: true,
  };
}

export function getStartLineCenter(
  marks: Array<{ role: string; lat: number; lng: number }>
): { lat: number; lng: number } | null {
  const startBoat = marks.find((m) => m.role === "start_boat");
  const pin = marks.find((m) => m.role === "pin");

  if (startBoat && pin) {
    return {
      lat: (startBoat.lat + pin.lat) / 2,
      lng: (startBoat.lng + pin.lng) / 2,
    };
  }

  if (startBoat) return { lat: startBoat.lat, lng: startBoat.lng };
  if (pin) return { lat: pin.lat, lng: pin.lng };

  return null;
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

export function getRoleBearingLabel(role: string): string {
  switch (role) {
    case "windward":
      return "Windward (0° from wind)";
    case "leeward":
      return "Leeward (180° from wind)";
    case "wing":
      return "Wing (reach angle)";
    case "offset":
      return "Offset (near windward)";
    case "start_boat":
    case "pin":
      return "Start Line";
    case "finish":
      return "Finish";
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
  const absoluteBearing = normalizeBearing(windDirection + bearing);
  return movePoint(centerLat, centerLng, absoluteBearing, distanceMeters);
}
