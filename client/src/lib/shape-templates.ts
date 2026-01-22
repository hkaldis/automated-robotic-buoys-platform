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
