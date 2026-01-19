import type { BoatClass, LegTimeEstimate, RaceTimeEstimate, Mark } from "@shared/schema";
import { calculateWindAngle } from "./course-bearings";

interface LegData {
  fromMark: { name: string; lat: number; lng: number };
  toMark: { name: string; lat: number; lng: number };
  distance: number;
  bearing: number;
}

type PointOfSail = "upwind" | "close_reach" | "beam_reach" | "broad_reach" | "downwind";

function determinePointOfSail(twa: number, noGoZoneAngle: number): PointOfSail {
  if (twa < noGoZoneAngle) return "upwind";
  if (twa < 60) return "close_reach";
  if (twa < 110) return "beam_reach";
  if (twa < 150) return "broad_reach";
  return "downwind";
}

function getWindCategory(windSpeedKnots: number): "light" | "medium" | "heavy" {
  if (windSpeedKnots <= 8) return "light";
  if (windSpeedKnots <= 14) return "medium";
  return "heavy";
}

function getVMG(boatClass: BoatClass, pointOfSail: PointOfSail, windCategory: "light" | "medium" | "heavy"): number {
  switch (pointOfSail) {
    case "upwind":
      switch (windCategory) {
        case "light": return boatClass.upwindVmgLight;
        case "medium": return boatClass.upwindVmgMedium;
        case "heavy": return boatClass.upwindVmgHeavy;
      }
      break;
    case "downwind":
      switch (windCategory) {
        case "light": return boatClass.downwindVmgLight;
        case "medium": return boatClass.downwindVmgMedium;
        case "heavy": return boatClass.downwindVmgHeavy;
      }
      break;
    case "close_reach":
    case "beam_reach":
    case "broad_reach":
      switch (windCategory) {
        case "light": return boatClass.reachSpeedLight;
        case "medium": return boatClass.reachSpeedMedium;
        case "heavy": return boatClass.reachSpeedHeavy;
      }
  }
  return 3;
}

function calculateSailingDistanceAndManeuvers(
  straightLineDistance: number,
  twa: number,
  pointOfSail: PointOfSail,
  optimalTwa: number
): { sailingDistance: number; maneuvers: number } {
  if (pointOfSail === "upwind") {
    const tackingAngle = optimalTwa;
    const cosAngle = Math.cos((tackingAngle * Math.PI) / 180);
    const sailingDistance = straightLineDistance / Math.max(cosAngle, 0.5);
    const numTacks = Math.max(2, Math.ceil(sailingDistance / 0.2));
    return { sailingDistance, maneuvers: numTacks };
  }
  
  if (pointOfSail === "downwind") {
    const jibingAngle = 180 - optimalTwa;
    const cosAngle = Math.cos((jibingAngle * Math.PI) / 180);
    const sailingDistance = straightLineDistance / Math.max(cosAngle, 0.7);
    const numJibes = Math.max(1, Math.ceil(sailingDistance / 0.3));
    return { sailingDistance, maneuvers: numJibes };
  }
  
  return { sailingDistance: straightLineDistance, maneuvers: 0 };
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export function estimateRaceTime(
  legs: LegData[],
  boatClass: BoatClass,
  windSpeedKnots: number,
  windDirectionDeg: number
): RaceTimeEstimate {
  const windCategory = getWindCategory(windSpeedKnots);
  const legEstimates: LegTimeEstimate[] = [];
  
  let totalDistanceNm = 0;
  let totalSailingDistanceNm = 0;
  let totalTimeSeconds = 0;
  
  legs.forEach((leg, index) => {
    const { absoluteTwa: twa } = calculateWindAngle(leg.bearing, windDirectionDeg);
    const pointOfSail = determinePointOfSail(twa, boatClass.noGoZoneAngle);
    
    const optimalTwa = pointOfSail === "upwind" 
      ? boatClass.upwindTwa 
      : pointOfSail === "downwind" 
        ? boatClass.downwindTwa 
        : twa;
    
    const { sailingDistance, maneuvers } = calculateSailingDistanceAndManeuvers(
      leg.distance,
      twa,
      pointOfSail,
      optimalTwa
    );
    
    const vmg = getVMG(boatClass, pointOfSail, windCategory);
    
    // For upwind/downwind, VMG is the velocity toward the mark, but boat sails at an angle
    // boatSpeed = VMG / cos(angle), because VMG = boatSpeed * cos(angle)
    // Since sailingDistance already accounts for the longer tacking/jibing path,
    // we divide by boatSpeed (not VMG) to get correct time
    const boatSpeed = pointOfSail === "upwind" || pointOfSail === "downwind"
      ? vmg / Math.cos((optimalTwa * Math.PI) / 180)
      : vmg;
    
    // Use boatSpeed when sailingDistance is inflated for tacking/jibing
    // Use vmg when using straight-line distance
    // Since sailingDistance is the actual path length, use boatSpeed
    const sailingTimeSeconds = (sailingDistance / boatSpeed) * 3600;
    
    const maneuverTime = pointOfSail === "upwind" 
      ? maneuvers * boatClass.tackTime
      : pointOfSail === "downwind"
        ? maneuvers * boatClass.jibeTime
        : 0;
    
    const markRoundingTime = index > 0 ? boatClass.markRoundingTime : 0;
    
    const legTimeSeconds = sailingTimeSeconds + maneuverTime + markRoundingTime;
    
    legEstimates.push({
      legIndex: index,
      fromMarkName: leg.fromMark.name,
      toMarkName: leg.toMark.name,
      distance: leg.distance,
      bearing: leg.bearing,
      windAngle: twa,
      pointOfSail,
      sailingDistance,
      vmg,
      boatSpeed: Math.abs(boatSpeed),
      legTimeSeconds,
      tacksOrJibes: maneuvers,
    });
    
    totalDistanceNm += leg.distance;
    totalSailingDistanceNm += sailingDistance;
    totalTimeSeconds += legTimeSeconds;
  });
  
  const finalMarkRounding = boatClass.markRoundingTime;
  totalTimeSeconds += finalMarkRounding;
  
  return {
    legs: legEstimates,
    totalDistanceNm,
    totalSailingDistanceNm,
    totalTimeSeconds,
    totalTimeFormatted: formatTime(totalTimeSeconds),
    windSpeedKnots,
    windDirectionDeg,
    boatClassName: boatClass.name,
  };
}

export function buildLegsFromRoundingSequence(
  roundingSequence: string[],
  marks: Mark[],
  startLineCenter?: { lat: number; lng: number }
): LegData[] {
  const legs: LegData[] = [];
  const markMap = new Map(marks.map(m => [m.id, m]));
  
  const startMarks = marks.filter(m => m.isStartLine);
  const startCenter = startLineCenter || (startMarks.length > 0 
    ? {
        lat: startMarks.reduce((sum, m) => sum + m.lat, 0) / startMarks.length,
        lng: startMarks.reduce((sum, m) => sum + m.lng, 0) / startMarks.length,
      }
    : null);
  
  const finishMarks = marks.filter(m => m.isFinishLine);
  const finishCenter = finishMarks.length > 0
    ? {
        lat: finishMarks.reduce((sum, m) => sum + m.lat, 0) / finishMarks.length,
        lng: finishMarks.reduce((sum, m) => sum + m.lng, 0) / finishMarks.length,
      }
    : null;
  
  interface Position { name: string; lat: number; lng: number }
  const positions: Position[] = [];
  
  for (const item of roundingSequence) {
    if (item === "start" && startCenter) {
      positions.push({ name: "Start", lat: startCenter.lat, lng: startCenter.lng });
    } else if (item === "finish" && finishCenter) {
      positions.push({ name: "Finish", lat: finishCenter.lat, lng: finishCenter.lng });
    } else {
      const mark = markMap.get(item);
      if (mark) {
        positions.push({ name: mark.name, lat: mark.lat, lng: mark.lng });
      }
    }
  }
  
  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i];
    const to = positions[i + 1];
    
    const distance = haversine(from.lat, from.lng, to.lat, to.lng);
    const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
    
    legs.push({
      fromMark: from,
      toMark: to,
      distance,
      bearing,
    });
  }
  
  return legs;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
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

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}
