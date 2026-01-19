import type { Mark, InsertMark } from "@shared/schema";
import type { IStorage } from "./storage";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateCoordinates(lat: number | undefined | null, lng: number | undefined | null): ValidationResult {
  if (lat !== undefined && lat !== null) {
    if (lat < -90 || lat > 90) {
      return { valid: false, error: "Latitude must be between -90 and 90 degrees" };
    }
  }
  if (lng !== undefined && lng !== null) {
    if (lng < -180 || lng > 180) {
      return { valid: false, error: "Longitude must be between -180 and 180 degrees" };
    }
  }
  return { valid: true };
}

export function validateGateWidth(
  gateWidthBoatLengths: number | undefined | null,
  boatLengthMeters: number | undefined | null
): ValidationResult {
  if (gateWidthBoatLengths !== undefined && gateWidthBoatLengths !== null) {
    if (gateWidthBoatLengths < 1 || gateWidthBoatLengths > 50) {
      return { valid: false, error: "Gate width must be between 1 and 50 boat lengths" };
    }
  }
  if (boatLengthMeters !== undefined && boatLengthMeters !== null) {
    if (boatLengthMeters < 1 || boatLengthMeters > 100) {
      return { valid: false, error: "Boat length must be between 1 and 100 meters" };
    }
  }
  return { valid: true };
}

export function validateMarkRoleConsistency(data: Partial<InsertMark>): ValidationResult {
  const { role, isStartLine, isFinishLine, isCourseMark, isGate } = data;
  
  // A mark CAN be both start line and finish line (common in sailing races where they share marks)
  
  if (role === "start_boat" || role === "pin") {
    if (isStartLine === false) {
      return { valid: false, error: `Role '${role}' must have isStartLine=true` };
    }
    // Allow start line marks to also be finish line marks (common in sailing)
    if (isCourseMark === true) {
      return { valid: false, error: `Role '${role}' is a start line role and cannot have isCourseMark=true` };
    }
    if (isGate === true) {
      return { valid: false, error: `Role '${role}' is a start line role and cannot be a gate` };
    }
  }
  
  if (role === "finish") {
    if (isFinishLine === false) {
      return { valid: false, error: "Role 'finish' must have isFinishLine=true" };
    }
    // Allow finish line marks to also be start line marks (common in sailing)
    if (isCourseMark === true) {
      return { valid: false, error: "Role 'finish' is a finish line role and cannot have isCourseMark=true" };
    }
    if (isGate === true) {
      return { valid: false, error: "Role 'finish' is a finish line role and cannot be a gate" };
    }
  }
  
  const courseMarkRoles = ["windward", "leeward", "wing", "offset", "turning_mark", "gate", "other"];
  if (role && courseMarkRoles.includes(role)) {
    if (isStartLine === true && role !== "other") {
      return { valid: false, error: `Course mark role '${role}' cannot have isStartLine=true` };
    }
    // Allow course marks to be converted to finish line marks - the role should be updated to "finish"
    // but we allow it during the transition. The UI will handle updating the role appropriately.
    // Only restrict if isCourseMark is explicitly true along with isFinishLine
    if (isFinishLine === true && isCourseMark === true && role !== "other") {
      return { valid: false, error: `Course mark role '${role}' cannot have both isFinishLine=true and isCourseMark=true` };
    }
  }
  
  if (isGate === true) {
    if (isStartLine === true || isFinishLine === true) {
      return { valid: false, error: "Gates cannot be start or finish line marks" };
    }
    if (role !== "gate" && role !== "leeward" && role !== "windward") {
      return { valid: false, error: "Gate marks must have role 'gate', 'leeward', or 'windward'" };
    }
    if (isCourseMark === false) {
      return { valid: false, error: "Gate marks must have isCourseMark=true" };
    }
  }
  
  if (role === "gate" && isGate !== true) {
    return { valid: false, error: "Role 'gate' must have isGate=true" };
  }
  
  return { valid: true };
}

export async function validateBuoyNotAssignedToOtherMarks(
  storage: IStorage,
  courseId: string,
  currentMarkId: string | null,
  buoyIds: (string | null | undefined)[]
): Promise<ValidationResult> {
  const validBuoyIds = buoyIds.filter((id): id is string => !!id);
  
  if (validBuoyIds.length === 0) {
    return { valid: true };
  }
  
  const courseMarks = await storage.getMarksByCourse(courseId);
  
  for (const buoyId of validBuoyIds) {
    for (const mark of courseMarks) {
      if (currentMarkId && mark.id === currentMarkId) {
        continue;
      }
      
      const markBuoyIds = [
        mark.assignedBuoyId,
        mark.gatePortBuoyId,
        mark.gateStarboardBuoyId
      ].filter(Boolean);
      
      if (markBuoyIds.includes(buoyId)) {
        return { 
          valid: false, 
          error: `Buoy is already assigned to mark '${mark.name}'. Each buoy can only be assigned to one mark at a time.`
        };
      }
    }
  }
  
  return { valid: true };
}

export async function validateRoundingSequence(
  storage: IStorage,
  courseId: string,
  sequence: string[],
  isFinal: boolean = false
): Promise<ValidationResult> {
  if (!sequence || sequence.length === 0) {
    return { valid: true };
  }
  
  const courseMarks = await storage.getMarksByCourse(courseId);
  const markIds = new Set(courseMarks.map(m => m.id));
  
  const validSpecialEntries = ["start", "finish"];
  
  for (const entry of sequence) {
    if (!validSpecialEntries.includes(entry) && !markIds.has(entry)) {
      return { 
        valid: false, 
        error: `Rounding sequence contains invalid reference '${entry}'. Mark does not exist in this course.`
      };
    }
  }
  
  if (sequence.length > 0 && sequence[0] !== "start") {
    return { valid: false, error: "Rounding sequence must begin with 'start'" };
  }
  
  // Only enforce finish requirement on final save, not during incremental selection
  if (isFinal && sequence.length > 1 && sequence[sequence.length - 1] !== "finish") {
    return { valid: false, error: "Rounding sequence must end with 'finish'" };
  }
  
  const startCount = sequence.filter(e => e === "start").length;
  const finishCount = sequence.filter(e => e === "finish").length;
  
  if (startCount > 1) {
    return { valid: false, error: "'start' can only appear once in the rounding sequence" };
  }
  if (finishCount > 1) {
    return { valid: false, error: "'finish' can only appear once in the rounding sequence" };
  }
  
  return { valid: true };
}

export function validateCourseTransformBounds(data: {
  rotation?: number | null;
  scale?: number | null;
}): ValidationResult {
  if (data.rotation !== undefined && data.rotation !== null) {
    if (data.rotation < 0 || data.rotation >= 360) {
      return { valid: false, error: "Rotation must be between 0 and 359 degrees" };
    }
  }
  if (data.scale !== undefined && data.scale !== null) {
    if (data.scale < 0.1 || data.scale > 10) {
      return { valid: false, error: "Scale must be between 0.1 and 10" };
    }
  }
  return { valid: true };
}
