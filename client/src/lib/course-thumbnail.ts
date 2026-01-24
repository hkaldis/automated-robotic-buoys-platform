import type { SnapshotMark } from "@shared/schema";

interface ThumbnailOptions {
  width?: number;
  height?: number;
  padding?: number;
}

export function generateCourseThumbnail(
  marks: SnapshotMark[],
  roundingSequence?: string[] | null,
  options: ThumbnailOptions = {}
): string {
  const { width = 80, height = 80, padding = 8 } = options;
  
  if (marks.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${padding}" y="${padding}" width="${width - padding * 2}" height="${height - padding * 2}" 
        rx="4" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" 
        fill="#94a3b8" font-size="10">Empty</text>
    </svg>`;
  }

  const lats = marks.map(m => m.lat);
  const lngs = marks.map(m => m.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;

  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;
  const scale = Math.min(availableWidth / lngRange, availableHeight / latRange);

  const toX = (lng: number) => padding + (lng - minLng) * scale + (availableWidth - lngRange * scale) / 2;
  const toY = (lat: number) => height - padding - (lat - minLat) * scale - (availableHeight - latRange * scale) / 2;

  const paths: string[] = [];
  const circles: string[] = [];

  const sortedMarks = [...marks].sort((a, b) => a.order - b.order);

  if (roundingSequence && roundingSequence.length > 1) {
    const marksByName = new Map(marks.map(m => [m.name, m]));
    const sequencePoints: { x: number; y: number }[] = [];
    
    for (const name of roundingSequence) {
      const mark = marksByName.get(name);
      if (mark) {
        sequencePoints.push({ x: toX(mark.lng), y: toY(mark.lat) });
      }
    }
    
    if (sequencePoints.length > 1) {
      const pathD = sequencePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ');
      paths.push(`<path d="${pathD}" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`);
    }
  } else {
    const courseMarks = sortedMarks.filter(m => m.isCourseMark);
    if (courseMarks.length > 1) {
      const pathD = courseMarks
        .map((m, i) => `${i === 0 ? 'M' : 'L'}${toX(m.lng).toFixed(1)},${toY(m.lat).toFixed(1)}`)
        .join(' ') + ' Z';
      paths.push(`<path d="${pathD}" stroke="#3b82f6" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>`);
    }
  }

  const startMarks = sortedMarks.filter(m => m.isStartLine);
  if (startMarks.length >= 2) {
    const [m1, m2] = startMarks;
    paths.push(`<line x1="${toX(m1.lng).toFixed(1)}" y1="${toY(m1.lat).toFixed(1)}" x2="${toX(m2.lng).toFixed(1)}" y2="${toY(m2.lat).toFixed(1)}" stroke="#22c55e" stroke-width="2"/>`);
  }

  const finishMarks = sortedMarks.filter(m => m.isFinishLine && !m.isStartLine);
  if (finishMarks.length >= 2) {
    const [m1, m2] = finishMarks;
    paths.push(`<line x1="${toX(m1.lng).toFixed(1)}" y1="${toY(m1.lat).toFixed(1)}" x2="${toX(m2.lng).toFixed(1)}" y2="${toY(m2.lat).toFixed(1)}" stroke="#ef4444" stroke-width="2"/>`);
  }

  for (const mark of sortedMarks) {
    const x = toX(mark.lng);
    const y = toY(mark.lat);
    
    let fillColor = "#3b82f6";
    let radius = 3;
    
    if (mark.isStartLine) {
      fillColor = "#22c55e";
      radius = 4;
    } else if (mark.isFinishLine) {
      fillColor = "#ef4444";
      radius = 4;
    } else if (mark.isCourseMark) {
      fillColor = "#3b82f6";
      radius = 3.5;
    }
    
    circles.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="${fillColor}"/>`);
  }

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="transparent"/>
    ${paths.join('\n    ')}
    ${circles.join('\n    ')}
  </svg>`;
}


export function getCategoryLabel(category: string): string {
  switch (category) {
    case "triangle":
      return "Triangle";
    case "trapezoid":
      return "Trapezoid";
    case "windward_leeward":
      return "Windward-Leeward";
    default:
      return "Other";
  }
}
