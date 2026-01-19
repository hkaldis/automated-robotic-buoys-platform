import { queryClient, invalidateRelatedQueries } from "./queryClient";
import type { Mark } from "@shared/schema";

export interface MutationOperation<T = unknown> {
  id: string;
  execute: () => Promise<T>;
  rollback?: () => Promise<void>;
  description: string;
}

export interface BatchResult {
  success: boolean;
  completed: number;
  failed: number;
  errors: Array<{ id: string; error: Error }>;
  marksAssignedWithoutBuoyCommand: string[];
}

export async function executeBatchedMutations(
  operations: MutationOperation[],
  options: {
    onProgress?: (completed: number, total: number) => void;
    stopOnError?: boolean;
    courseId?: string;
  } = {}
): Promise<BatchResult> {
  const { onProgress, stopOnError = false, courseId } = options;
  const results: BatchResult = {
    success: true,
    completed: 0,
    failed: 0,
    errors: [],
    marksAssignedWithoutBuoyCommand: [],
  };

  const completedOps: MutationOperation[] = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    try {
      await op.execute();
      results.completed++;
      completedOps.push(op);
      onProgress?.(results.completed, operations.length);
    } catch (error) {
      results.failed++;
      results.success = false;
      results.errors.push({ id: op.id, error: error as Error });
      
      if (stopOnError) {
        break;
      }
    }
  }

  if (courseId) {
    invalidateRelatedQueries("marks", courseId);
    invalidateRelatedQueries("buoys", courseId);
  }

  return results;
}

export function applyOptimisticMarkUpdate(
  courseId: string,
  markId: string,
  update: Partial<Mark>
): Mark[] | undefined {
  const queryKey = ["/api/courses", courseId, "marks"];
  const previousMarks = queryClient.getQueryData<Mark[]>(queryKey);
  
  if (previousMarks) {
    const updatedMarks = previousMarks.map(mark => 
      mark.id === markId ? { ...mark, ...update } : mark
    );
    queryClient.setQueryData(queryKey, updatedMarks);
  }
  
  return previousMarks;
}

export function rollbackOptimisticMarkUpdate(
  courseId: string,
  previousMarks: Mark[] | undefined
) {
  if (previousMarks) {
    queryClient.setQueryData(["/api/courses", courseId, "marks"], previousMarks);
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

export async function executeAutoAssignWithRecovery(
  assignments: Array<{
    markId: string;
    markName: string;
    updateData: Partial<Mark>;
    buoyId: string;
    targetLat: number;
    targetLng: number;
  }>,
  options: {
    courseId: string;
    updateMarkFn: (markId: string, data: Partial<Mark>) => Promise<void>;
    clearMarkAssignmentFn?: (markId: string, updateData: Partial<Mark>) => Promise<void>;
    sendBuoyCommandFn: (buoyId: string, lat: number, lng: number) => Promise<void>;
    onProgress?: (completed: number, total: number, currentMark: string) => void;
  }
): Promise<BatchResult> {
  const { courseId, updateMarkFn, clearMarkAssignmentFn, sendBuoyCommandFn, onProgress } = options;
  const results: BatchResult = {
    success: true,
    completed: 0,
    failed: 0,
    errors: [],
    marksAssignedWithoutBuoyCommand: [],
  };

  const totalOperations = assignments.length * 2;

  for (let i = 0; i < assignments.length; i++) {
    const assignment = assignments[i];
    let markUpdateSucceeded = false;
    
    try {
      await retryWithBackoff(() => updateMarkFn(assignment.markId, assignment.updateData), 2, 500);
      markUpdateSucceeded = true;
      results.completed++;
      onProgress?.(results.completed, totalOperations, assignment.markName);
    } catch (error) {
      results.failed++;
      results.success = false;
      results.errors.push({ 
        id: `mark-${assignment.markId}`, 
        error: error as Error 
      });
      continue;
    }

    if (markUpdateSucceeded) {
      try {
        await retryWithBackoff(
          () => sendBuoyCommandFn(assignment.buoyId, assignment.targetLat, assignment.targetLng),
          2,
          500
        );
        results.completed++;
        onProgress?.(results.completed, totalOperations, assignment.markName);
      } catch (error) {
        results.failed++;
        results.errors.push({ 
          id: `buoy-${assignment.buoyId}`, 
          error: error as Error 
        });
        results.marksAssignedWithoutBuoyCommand.push(assignment.markName);
        
        if (clearMarkAssignmentFn) {
          const rollbackData: Partial<Mark> = {};
          if ('assignedBuoyId' in assignment.updateData) {
            rollbackData.assignedBuoyId = null;
          }
          if ('gatePortBuoyId' in assignment.updateData) {
            rollbackData.gatePortBuoyId = null;
          }
          if ('gateStarboardBuoyId' in assignment.updateData) {
            rollbackData.gateStarboardBuoyId = null;
          }
          try {
            await clearMarkAssignmentFn(assignment.markId, rollbackData);
          } catch {
          }
        }
      }
    }
  }

  invalidateRelatedQueries("marks", courseId);
  invalidateRelatedQueries("buoys", courseId);

  return results;
}
