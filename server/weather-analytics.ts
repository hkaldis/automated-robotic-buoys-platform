import { 
  type BuoyWeatherHistory,
  type WindPattern,
  type ShiftEvent,
  type ShiftPrediction,
  type FavoredSideAnalysis,
  type WindAnalytics,
  type WindPatternType,
  type VelocityTrend,
} from "@shared/schema";

export function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

export function angleDifference(a: number, b: number): number {
  const diff = normalizeAngle(a) - normalizeAngle(b);
  if (diff > 180) return diff - 360;
  if (diff < -180) return diff + 360;
  return diff;
}

export function detectPattern(readings: BuoyWeatherHistory[]): WindPattern {
  const defaultPattern: WindPattern = {
    type: "stable",
    confidence: 0,
    medianDirection: readings[0]?.windDirection ?? 0,
    shiftRange: 0,
    periodMinutes: null,
    trendDegreesPerHour: 0,
  };

  if (readings.length < 6) {
    return defaultPattern;
  }

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const directions = sortedReadings.map(r => r.windDirection);
  
  const sortedDirs = [...directions].sort((a, b) => a - b);
  const medianDirection = sortedDirs[Math.floor(sortedDirs.length / 2)];

  const deviations = directions.map((d, i) => {
    if (i === 0) return 0;
    return angleDifference(d, directions[i - 1]);
  });

  const signChanges = deviations.slice(1).filter((d, i) => 
    (d > 0 && deviations[i] < 0) || (d < 0 && deviations[i] > 0)
  ).length;

  const totalDrift = angleDifference(directions[directions.length - 1], directions[0]);
  const shiftRange = Math.max(...directions.map(d => Math.abs(angleDifference(d, medianDirection)))) * 2;
  
  const timeSpanMinutes = (new Date(sortedReadings[sortedReadings.length - 1].timestamp).getTime() - 
    new Date(sortedReadings[0].timestamp).getTime()) / 60000;
  const trendDegreesPerHour = timeSpanMinutes > 0 ? (totalDrift / timeSpanMinutes) * 60 : 0;

  if (signChanges >= readings.length / 3 && shiftRange > 6) {
    const periodMinutes = Math.round((readings.length * 10) / Math.max(1, signChanges / 2));
    
    if (Math.abs(trendDegreesPerHour) > 5) {
      return {
        type: "oscillating_persistent",
        confidence: Math.min(0.85, signChanges / (readings.length / 2)),
        medianDirection: normalizeAngle(medianDirection),
        shiftRange,
        periodMinutes,
        trendDegreesPerHour,
      };
    }
    
    return {
      type: "oscillating",
      confidence: Math.min(0.9, signChanges / (readings.length / 2)),
      medianDirection: normalizeAngle(medianDirection),
      shiftRange,
      periodMinutes,
      trendDegreesPerHour: 0,
    };
  }

  if (Math.abs(totalDrift) > 10) {
    return {
      type: "persistent",
      confidence: Math.min(0.9, Math.abs(totalDrift) / 30),
      medianDirection: normalizeAngle(medianDirection),
      shiftRange,
      periodMinutes: null,
      trendDegreesPerHour,
    };
  }

  return {
    type: "stable",
    confidence: 1 - (shiftRange / 20),
    medianDirection: normalizeAngle(medianDirection),
    shiftRange,
    periodMinutes: null,
    trendDegreesPerHour: 0,
  };
}

function getMagnitude(degrees: number): "minor" | "moderate" | "major" {
  if (Math.abs(degrees) < 5) return "minor";
  if (Math.abs(degrees) < 10) return "moderate";
  return "major";
}

export function detectShifts(readings: BuoyWeatherHistory[], thresholdDegrees: number = 5): ShiftEvent[] {
  if (readings.length < 2) return [];

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const shifts: ShiftEvent[] = [];
  let lastDirection = sortedReadings[0].windDirection;

  for (let i = 1; i < sortedReadings.length; i++) {
    const diff = angleDifference(sortedReadings[i].windDirection, lastDirection);
    
    if (Math.abs(diff) >= thresholdDegrees) {
      shifts.push({
        timestamp: new Date(sortedReadings[i].timestamp),
        direction: sortedReadings[i].windDirection,
        change: diff,
        type: diff > 0 ? "lift" : "header",
        magnitude: getMagnitude(diff),
      });
      lastDirection = sortedReadings[i].windDirection;
    }
  }

  return shifts;
}

export function predictShifts(
  readings: BuoyWeatherHistory[], 
  pattern: WindPattern
): ShiftPrediction[] {
  const predictions: ShiftPrediction[] = [];

  if (pattern.type === "oscillating" || pattern.type === "oscillating_persistent") {
    const shifts = detectShifts(readings);
    const lastShift = shifts[shifts.length - 1];
    
    if (lastShift && pattern.periodMinutes) {
      predictions.push({
        expectedDirection: lastShift.change > 0 ? "left" : "right",
        expectedTimeMinutes: Math.round(pattern.periodMinutes / 2),
        magnitudeDegrees: Math.round(pattern.shiftRange / 2),
        confidence: pattern.confidence * 0.7,
      });
    }
  }

  if (pattern.type === "persistent" || pattern.type === "oscillating_persistent") {
    if (Math.abs(pattern.trendDegreesPerHour) > 3) {
      predictions.push({
        expectedDirection: pattern.trendDegreesPerHour > 0 ? "right" : "left",
        expectedTimeMinutes: 30,
        magnitudeDegrees: Math.round(Math.abs(pattern.trendDegreesPerHour) / 2),
        confidence: pattern.confidence * 0.6,
      });
    }
  }

  return predictions;
}

export function calculateFavoredSide(
  readings: BuoyWeatherHistory[],
  pattern: WindPattern,
  predictions: ShiftPrediction[]
): FavoredSideAnalysis {
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  let moreWind: "left" | "right" | "equal" = "equal";
  let nextShift: "left" | "right" | "unknown" = "unknown";
  let persistent: "left" | "right" | "none" = "none";

  if (predictions.length > 0) {
    nextShift = predictions[0].expectedDirection;
  }

  if (pattern.type === "persistent" || pattern.type === "oscillating_persistent") {
    persistent = pattern.trendDegreesPerHour > 0 ? "right" : "left";
  }

  let side: "left" | "right" | "neutral" = "neutral";
  let reason = "No clear advantage based on current data";
  let confidence = 0.3;

  if (persistent !== "none") {
    side = persistent;
    reason = `Wind is shifting ${persistent} at ${Math.abs(pattern.trendDegreesPerHour).toFixed(1)}°/hr`;
    confidence = pattern.confidence * 0.8;
  } else if (nextShift !== "unknown") {
    side = nextShift;
    reason = `Expected shift to ${nextShift} within ${predictions[0].expectedTimeMinutes} minutes`;
    confidence = predictions[0].confidence;
  } else if (pattern.type === "stable") {
    side = "neutral";
    reason = "Stable wind conditions - no clear tactical advantage";
    confidence = pattern.confidence;
  }

  return {
    side,
    reason,
    confidence,
    factors: {
      moreWind,
      nextShift,
      persistent,
    },
  };
}

export function analyzeWeather(
  readings: BuoyWeatherHistory[],
  buoyInfoMap?: Map<string, { id: string; name: string }>
): WindAnalytics {
  const pattern = detectPattern(readings);
  const shifts = detectShifts(readings);
  const predictions = predictShifts(readings, pattern);
  const favoredSide = calculateFavoredSide(readings, pattern, predictions);

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const currentReading = sortedReadings[0];
  
  const recentReadings = sortedReadings.slice(0, 30);
  const avgDirection = recentReadings.length > 0 
    ? recentReadings.reduce((sum, r) => sum + r.windDirection, 0) / recentReadings.length
    : currentReading?.windDirection ?? 0;
  const avgSpeed = recentReadings.length > 0
    ? recentReadings.reduce((sum, r) => sum + r.windSpeed, 0) / recentReadings.length
    : currentReading?.windSpeed ?? 0;

  const currentConditions = {
    direction: currentReading?.windDirection ?? 0,
    speed: currentReading?.windSpeed ?? 0,
    directionDelta: currentReading ? angleDifference(currentReading.windDirection, avgDirection) : 0,
    speedDelta: currentReading ? currentReading.windSpeed - avgSpeed : 0,
  };

  const buoyReadingsMap = new Map<string, BuoyWeatherHistory[]>();
  for (const reading of readings) {
    const existing = buoyReadingsMap.get(reading.buoyId) ?? [];
    existing.push(reading);
    buoyReadingsMap.set(reading.buoyId, existing);
  }

  const buoyComparison: WindAnalytics["buoyComparison"] = [];
  const buoyIds = Array.from(buoyReadingsMap.keys());
  for (const buoyId of buoyIds) {
    const buoyReadings = buoyReadingsMap.get(buoyId) ?? [];
    const sorted = buoyReadings.sort(
      (a: BuoyWeatherHistory, b: BuoyWeatherHistory) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latest = sorted[0];
    const older = sorted.slice(0, 6);
    
    let trend: VelocityTrend = "stable";
    if (older.length >= 3) {
      const avgOlderSpeed = older.slice(1).reduce(
        (sum: number, r: BuoyWeatherHistory) => sum + r.windSpeed, 0
      ) / (older.length - 1);
      if (latest.windSpeed > avgOlderSpeed + 1) trend = "increasing";
      else if (latest.windSpeed < avgOlderSpeed - 1) trend = "decreasing";
    }

    const buoyInfo = buoyInfoMap?.get(buoyId);
    buoyComparison.push({
      buoyId,
      buoyName: buoyInfo?.name ?? `Buoy ${buoyId.slice(0, 6)}`,
      direction: latest.windDirection,
      speed: latest.windSpeed,
      trend,
    });
  }

  return {
    pattern,
    favoredSide,
    shifts,
    predictions,
    currentConditions,
    buoyComparison,
  };
}
