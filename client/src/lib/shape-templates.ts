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
  
  if (template.type === "triangle") {
    // Standard 3-mark sailing triangle with marks at vertices
    // Template defines interior angles at each mark
    // Default layout: M1 (windward), M2 (wing/reach), M3 (leeward)
    // Typical rounding: Start → M1 → M2 → M3 → Finish (near start)
    
    // Template angles represent interior angles at each vertex
    // For 60-60-60: equilateral triangle
    // For 45-90-45: isoceles right triangle (90° at M2)
    const [angleAtM1, angleAtM2, angleAtM3] = template.angles;
    const legRatios = template.legRatios || [1, 1, 1];
    
    // M1: Windward mark - directly upwind from start
    const windwardBearing = normalizeBearing(windDirection);
    const leg1Distance = courseLengthMeters * (legRatios[0] || 1);
    const m1 = movePoint(startLineCenterLat, startLineCenterLng, windwardBearing, leg1Distance);
    marks.push({
      name: "M1",
      role: "turning_mark",
      lat: m1.lat,
      lng: m1.lng,
      isCourseMark: true,
    });
    
    // M2: Wing/reach mark
    // Interior angle at M1 determines the turn from upwind leg to reach leg
    // Bearing from M1 to M2: rotate from reverse of incoming bearing by (180 - angleAtM1)
    // Incoming bearing to M1 is windDirection, so M1→M2 bearing is:
    // windDirection + 180 - (180 - angleAtM1) / 2 offset
    // Simplified: for typical reach, offset by half the complement of the windward angle
    const reachOffset = (180 - angleAtM1) / 2;
    const m2Bearing = normalizeBearing(windDirection + 180 - reachOffset);
    const leg2Distance = courseLengthMeters * (legRatios[1] || 1);
    const m2 = movePoint(m1.lat, m1.lng, m2Bearing, leg2Distance);
    marks.push({
      name: "M2",
      role: "turning_mark",
      lat: m2.lat,
      lng: m2.lng,
      isCourseMark: true,
    });
    
    // M3: Leeward mark - complete the triangle
    // Position relative to M2 and the target angle at M2
    // For simplicity, place M3 downwind from start at a distance that closes the shape
    const leewardBearing = normalizeBearing(windDirection + 180);
    const leg3Distance = courseLengthMeters * (legRatios[2] || 0.5);
    const m3 = movePoint(startLineCenterLat, startLineCenterLng, leewardBearing, leg3Distance);
    marks.push({
      name: "M3",
      role: "turning_mark",
      lat: m3.lat,
      lng: m3.lng,
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
