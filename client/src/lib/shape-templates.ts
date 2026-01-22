export interface ShapeTemplate {
  id: string;
  name: string;
  description: string;
  type: "triangle" | "trapezoid";
  angles: number[];
  legRatios?: number[];
}

export const TRIANGLE_TEMPLATES: ShapeTemplate[] = [
  {
    id: "triangle-60-60-60",
    name: "Triangle 60-60-60",
    description: "Equilateral - all legs equal",
    type: "triangle",
    angles: [60, 60, 60],
    legRatios: [1, 1, 1],
  },
  {
    id: "triangle-45-90-45",
    name: "Triangle 45-90-45",
    description: "Right-angled - reaches 71% of beat",
    type: "triangle",
    angles: [45, 90, 45],
    legRatios: [1, 0.71, 0.71],
  },
  {
    id: "triangle-65-50-65",
    name: "Triangle 65-50-65",
    description: "Tighter reach angles",
    type: "triangle",
    angles: [65, 50, 65],
  },
  {
    id: "triangle-70-40-70",
    name: "Triangle 70-40-70",
    description: "Very tight reach",
    type: "triangle",
    angles: [70, 40, 70],
  },
];

export const TRAPEZOID_TEMPLATES: ShapeTemplate[] = [
  {
    id: "trapezoid-60",
    name: "Trapezoid 60°",
    description: "60° reach angle",
    type: "trapezoid",
    angles: [60],
  },
  {
    id: "trapezoid-70",
    name: "Trapezoid 70°",
    description: "70° reach angle",
    type: "trapezoid",
    angles: [70],
  },
  {
    id: "trapezoid-45",
    name: "Trapezoid 45°",
    description: "45° reach angle",
    type: "trapezoid",
    angles: [45],
  },
];

export const ALL_SHAPE_TEMPLATES = [...TRIANGLE_TEMPLATES, ...TRAPEZOID_TEMPLATES];

export const COMMON_ANGLES = [30, 45, 60, 70, 90, 120];

export function getTemplateById(id: string): ShapeTemplate | undefined {
  return ALL_SHAPE_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesForMarkCount(count: number): ShapeTemplate[] {
  if (count === 3) return TRIANGLE_TEMPLATES;
  if (count === 4) return TRAPEZOID_TEMPLATES;
  return [];
}

export interface GeneratedMark {
  name: string;
  role: "turning_mark";
  lat: number;
  lng: number;
  isCourseMark: boolean;
}

function movePoint(
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

function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360;
}

export function generateTemplateMarks(
  template: ShapeTemplate,
  startLineCenterLat: number,
  startLineCenterLng: number,
  windDirection: number,
  courseLengthMeters: number = 500
): GeneratedMark[] {
  const marks: GeneratedMark[] = [];
  const W = windDirection;
  const D = courseLengthMeters;
  
  if (template.type === "triangle") {
    // Generate triangle where course turn angles at M1, M2, M3 match template.angles
    // Course: Start → M1 → M2 → M3 → Finish (near start)
    //
    // Key insight: For the turn angles at each mark to match the template,
    // the course path must form a closed triangle M1→M2→M3→M1.
    // Start is positioned such that Start→M1 aligns with M3→M1 direction,
    // ensuring correct turn angles at all three marks.
    //
    // Geometry approach:
    // 1. Use law of sines to compute relative side lengths
    // 2. Build triangle in local coordinates with M1 at top (windward)
    // 3. Scale to desired course length and orient to wind direction
    
    const [angleAtM1, angleAtM2, angleAtM3] = template.angles;
    
    // Validate angles sum to 180°
    const angleSum = angleAtM1 + angleAtM2 + angleAtM3;
    if (Math.abs(angleSum - 180) > 0.1) {
      console.warn(`Template angles sum to ${angleSum}, not 180°`);
    }
    
    // For a closed triangle with interior angles A, B, C:
    // Place triangle in local coordinates (wind direction = up/north in local frame)
    // M1 at top (windward), then traverse port-rounding to M2, M3
    
    const A = angleAtM1 * Math.PI / 180;
    const B = angleAtM2 * Math.PI / 180;
    const C = angleAtM3 * Math.PI / 180;
    
    // Law of sines: a/sin(A) = b/sin(B) = c/sin(C)
    // a = side opposite M1 (M2→M3)
    // b = side opposite M2 (M3→M1)
    // c = side opposite M3 (M1→M2)
    
    const sinA = Math.sin(A);
    const sinB = Math.sin(B);
    const sinC = Math.sin(C);
    
    // Scale factor: Set the first beat leg (Start→M1) = D
    // For closed triangle, Start is on line M3→M1, at distance D from M1
    // So sideB (M3→M1) = D + distance(Start→M3)
    // To determine scale, we use: side c (M1→M2) as reference
    // Set side c = D * 1.5 for reasonable course size
    const sideC = D * 1.5;
    const scaleK = sideC / sinC;
    const sideA = scaleK * sinA;
    const sideB = scaleK * sinB;
    
    // Build triangle in local Cartesian coordinates
    // Origin = start line center, Y = upwind direction (north in local frame)
    // M1 at (0, D) - windward mark
    const m1Local = { x: 0, y: D };
    
    // M1→M2: Turn at M1 by exterior angle (180° - A) to port (left)
    // If incoming heading is 0° (north/upwind), outgoing is 0° - (180° - A) = A - 180°
    // In local coords, this bearing is (A - 180°) from north
    const m1ToM2BearingLocal = A * 180 / Math.PI - 180; // degrees
    const m2Local = {
      x: m1Local.x + sideC * Math.sin(m1ToM2BearingLocal * Math.PI / 180),
      y: m1Local.y + sideC * Math.cos(m1ToM2BearingLocal * Math.PI / 180)
    };
    
    // M2→M3: Turn at M2 by exterior angle (180° - B) to port
    const m2ToM3BearingLocal = m1ToM2BearingLocal + (B * 180 / Math.PI) - 180;
    const m3Local = {
      x: m2Local.x + sideA * Math.sin(m2ToM3BearingLocal * Math.PI / 180),
      y: m2Local.y + sideA * Math.cos(m2ToM3BearingLocal * Math.PI / 180)
    };
    
    // Rotate local coordinates to align with actual wind direction W
    // Local "up" (Y+) corresponds to bearing W in global frame
    const rotateToGlobal = (local: {x: number, y: number}, windBearing: number): {x: number, y: number} => {
      const theta = windBearing * Math.PI / 180;
      return {
        x: local.x * Math.cos(theta) + local.y * Math.sin(theta),
        y: -local.x * Math.sin(theta) + local.y * Math.cos(theta)
      };
    };
    
    // Convert local to global offsets (meters east/north from start)
    const m1Global = rotateToGlobal(m1Local, W);
    const m2Global = rotateToGlobal(m2Local, W);
    const m3Global = rotateToGlobal(m3Local, W);
    
    // Convert meter offsets to lat/lng
    // Approximate: 1° lat ≈ 111320m, 1° lng ≈ 111320m * cos(lat)
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(startLineCenterLat * Math.PI / 180);
    
    const m1Pos = {
      lat: startLineCenterLat + m1Global.y / metersPerDegreeLat,
      lng: startLineCenterLng + m1Global.x / metersPerDegreeLng
    };
    const m2Pos = {
      lat: startLineCenterLat + m2Global.y / metersPerDegreeLat,
      lng: startLineCenterLng + m2Global.x / metersPerDegreeLng
    };
    const m3Pos = {
      lat: startLineCenterLat + m3Global.y / metersPerDegreeLat,
      lng: startLineCenterLng + m3Global.x / metersPerDegreeLng
    };
    
    marks.push({
      name: "M1",
      role: "turning_mark",
      lat: m1Pos.lat,
      lng: m1Pos.lng,
      isCourseMark: true,
    });
    
    marks.push({
      name: "M2",
      role: "turning_mark",
      lat: m2Pos.lat,
      lng: m2Pos.lng,
      isCourseMark: true,
    });
    
    marks.push({
      name: "M3",
      role: "turning_mark",
      lat: m3Pos.lat,
      lng: m3Pos.lng,
      isCourseMark: true,
    });
    
  } else if (template.type === "trapezoid") {
    // Standard 4-mark trapezoid (windward-leeward with reaches)
    // M1: Windward (upwind)
    // M2: Offset/spreader (near windward, offset to side for reaches)
    // M3: Leeward gate mark (port)
    // M4: Leeward gate mark (starboard)
    // Course: Start → M1 → M2 → M1 → M3/M4 → Finish
    
    const reachAngle = template.angles[0] || 60;
    
    // M1: Windward mark - directly upwind
    const windwardBearing = normalizeBearing(windDirection);
    const m1 = movePoint(startLineCenterLat, startLineCenterLng, windwardBearing, courseLengthMeters);
    marks.push({
      name: "M1",
      role: "turning_mark",
      lat: m1.lat,
      lng: m1.lng,
      isCourseMark: true,
    });
    
    // M2: Spreader/offset mark for reach legs
    // Positioned downwind and to one side of M1
    const spreadBearing = normalizeBearing(windDirection + 180 - reachAngle);
    const spreadDistance = courseLengthMeters * 0.5;
    const m2 = movePoint(m1.lat, m1.lng, spreadBearing, spreadDistance);
    marks.push({
      name: "M2",
      role: "turning_mark",
      lat: m2.lat,
      lng: m2.lng,
      isCourseMark: true,
    });
    
    // Leeward gate: two marks forming a gate downwind
    const leewardBearing = normalizeBearing(windDirection + 180);
    const leewardDistance = courseLengthMeters * 0.2;
    const leewardCenter = movePoint(startLineCenterLat, startLineCenterLng, leewardBearing, leewardDistance);
    
    // M3: Leeward port mark
    const portOffset = normalizeBearing(windDirection - 90);
    const gateWidth = 50; // 50m gate width
    const m3 = movePoint(leewardCenter.lat, leewardCenter.lng, portOffset, gateWidth);
    marks.push({
      name: "M3",
      role: "turning_mark",
      lat: m3.lat,
      lng: m3.lng,
      isCourseMark: true,
    });
    
    // M4: Leeward starboard mark
    const starboardOffset = normalizeBearing(windDirection + 90);
    const m4 = movePoint(leewardCenter.lat, leewardCenter.lng, starboardOffset, gateWidth);
    marks.push({
      name: "M4",
      role: "turning_mark",
      lat: m4.lat,
      lng: m4.lng,
      isCourseMark: true,
    });
  }
  
  return marks;
}
