export type BoatClass = "spinnaker" | "non_spinnaker" | "foiling";

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

export interface InteriorAngleResult {
  angle: number;
  bearingToPrev: number;
  bearingToNext: number;
}

export function calculateInteriorAngle(
  prevLat: number,
  prevLng: number,
  currentLat: number,
  currentLng: number,
  nextLat: number,
  nextLng: number
): InteriorAngleResult {
  // Calculate bearings FROM the current mark TO adjacent marks
  // This gives us the vectors originating at the current mark
  const bearingToPrev = calculateBearing(currentLat, currentLng, prevLat, prevLng);
  const bearingToNext = calculateBearing(currentLat, currentLng, nextLat, nextLng);
  
  // The interior angle is the absolute difference between these two bearings
  let angle = Math.abs(bearingToNext - bearingToPrev);
  
  // Normalize to get the smaller angle (0-180)
  if (angle > 180) {
    angle = 360 - angle;
  }
  
  return {
    angle,
    bearingToPrev,
    bearingToNext,
  };
}

export interface AdjustToShapeResult {
  lat: number;
  lng: number;
  distanceFromPrev: number;
  originalAngle: number;
  newAngle: number;
}

export function adjustMarkToAngle(
  currentLat: number,
  currentLng: number,
  prevLat: number,
  prevLng: number,
  nextLat: number,
  nextLng: number,
  targetAngle: number
): AdjustToShapeResult {
  // Get current interior angle
  const currentAngleResult = calculateInteriorAngle(
    prevLat, prevLng,
    currentLat, currentLng,
    nextLat, nextLng
  );
  
  // Keep distance from previous mark constant (leg length stays the same)
  const distanceFromPrev = calculateDistance(prevLat, prevLng, currentLat, currentLng);
  
  // Current bearing from prev to current (current position)
  const currentBearing = calculateBearing(prevLat, prevLng, currentLat, currentLng);
  
  // Dense sweep: test every 2 degrees around the full 360° circle
  // Track ALL positions and their errors - no filtering
  let bestRotation = 0;
  let bestError = Infinity;
  let bestPos = { lat: currentLat, lng: currentLng };
  
  // Track multiple local minima (there can be two solutions: port and starboard side)
  const localMinima: { rotation: number; error: number; pos: { lat: number; lng: number } }[] = [];
  let prevError = Infinity;
  let prevPrevError = Infinity;
  
  for (let rotation = 0; rotation < 360; rotation += 2) {
    const testBearing = normalizeBearing(currentBearing + rotation);
    const testPos = movePoint(prevLat, prevLng, testBearing, distanceFromPrev);
    const testAngle = calculateInteriorAngle(prevLat, prevLng, testPos.lat, testPos.lng, nextLat, nextLng);
    const error = Math.abs(testAngle.angle - targetAngle);
    
    // Detect local minimum (error was decreasing, now increasing)
    if (prevError < prevPrevError && prevError < error) {
      localMinima.push({
        rotation: rotation - 2,
        error: prevError,
        pos: movePoint(prevLat, prevLng, normalizeBearing(currentBearing + rotation - 2), distanceFromPrev),
      });
    }
    
    if (error < bestError) {
      bestError = error;
      bestRotation = rotation;
      bestPos = testPos;
    }
    
    prevPrevError = prevError;
    prevError = error;
  }
  
  // Add global best if not already in local minima
  if (!localMinima.some(m => m.rotation === bestRotation)) {
    localMinima.push({ rotation: bestRotation, error: bestError, pos: bestPos });
  }
  
  // Sort local minima: prefer small error, then prefer position closest to current (minimal rotation)
  localMinima.sort((a, b) => {
    // If errors are similar (within 2°), prefer minimal movement
    if (Math.abs(a.error - b.error) < 2) {
      const distA = Math.min(a.rotation, 360 - a.rotation);
      const distB = Math.min(b.rotation, 360 - b.rotation);
      return distA - distB;
    }
    return a.error - b.error;
  });
  
  // Take the best candidate
  const bestCandidate = localMinima[0] || { rotation: bestRotation, error: bestError, pos: bestPos };
  let finalPosition = bestCandidate.pos;
  let finalError = bestCandidate.error;
  
  // Fine-tune with 0.2 degree steps in the ±3° range around the best candidate
  for (let delta = -3; delta <= 3; delta += 0.2) {
    const testRotation = bestCandidate.rotation + delta;
    const testBearing = normalizeBearing(currentBearing + testRotation);
    const testPos = movePoint(prevLat, prevLng, testBearing, distanceFromPrev);
    const testAngle = calculateInteriorAngle(prevLat, prevLng, testPos.lat, testPos.lng, nextLat, nextLng);
    const error = Math.abs(testAngle.angle - targetAngle);
    
    if (error < finalError) {
      finalError = error;
      finalPosition = testPos;
    }
  }
  
  return {
    lat: finalPosition.lat,
    lng: finalPosition.lng,
    distanceFromPrev,
    originalAngle: currentAngleResult.angle,
    newAngle: targetAngle,
  };
}
