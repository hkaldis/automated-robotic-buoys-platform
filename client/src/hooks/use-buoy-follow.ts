import { useCallback, useEffect, useRef } from "react";
import type { Mark, Buoy } from "@shared/schema";
import { useBuoyCommand } from "./use-api";
import { useSettings } from "./use-settings";

function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateGateBuoyPosition(
  markLat: number,
  markLng: number,
  gateWidthMeters: number,
  bearing: number,
  side: "port" | "starboard"
): { lat: number; lng: number } {
  const perpBearing = side === "port" ? bearing - 90 : bearing + 90;
  const perpRad = (perpBearing * Math.PI) / 180;
  const halfWidth = gateWidthMeters / 2;
  const R = 6371000;
  const lat1 = markLat * Math.PI / 180;
  const lng1 = markLng * Math.PI / 180;
  const angularDistance = halfWidth / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(perpRad)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(perpRad) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: lat2 * 180 / Math.PI,
    lng: lng2 * 180 / Math.PI,
  };
}

export interface PendingDeployment {
  buoyId: string;
  buoyName: string;
  currentLat: number;
  currentLng: number;
  targetLat: number;
  targetLng: number;
  markId: string;
  markName: string;
  distanceMeters: number;
}

interface UseBuoyFollowOptions {
  marks: Mark[];
  buoys: Buoy[];
  demoSendCommand?: (buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => void;
  courseId?: string;
  windDirection?: number;
  enabled?: boolean;
}

export function useBuoyFollow({
  marks,
  buoys,
  demoSendCommand,
  courseId,
  windDirection = 0,
  enabled = true,
}: UseBuoyFollowOptions) {
  const { buoyFollowSettings, buoyDeployMode } = useSettings();
  const buoyCommand = useBuoyCommand(demoSendCommand, courseId);
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastCommandTime = useRef<Map<string, number>>(new Map());
  const previousDeployMode = useRef(buoyDeployMode);

  const sendBuoyToMark = useCallback((buoyId: string, targetLat: number, targetLng: number) => {
    const now = Date.now();
    const lastTime = lastCommandTime.current.get(buoyId) ?? 0;
    if (now - lastTime < buoyFollowSettings.debounceTimeSeconds * 1000) {
      return;
    }
    lastCommandTime.current.set(buoyId, now);
    buoyCommand.mutate({
      id: buoyId,
      command: "move_to_target",
      targetLat,
      targetLng,
    });
  }, [buoyCommand, buoyFollowSettings.debounceTimeSeconds]);

  const getPendingDeployments = useCallback((): PendingDeployment[] => {
    const pending: PendingDeployment[] = [];
    const threshold = buoyFollowSettings.acceptableDistanceMeters;

    marks.forEach(mark => {
      if (mark.isGate) {
        const gateWidthMeters = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
        
        if (mark.gatePortBuoyId) {
          const buoy = buoys.find(b => b.id === mark.gatePortBuoyId);
          if (buoy) {
            const targetPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "port");
            const distance = calculateDistanceMeters(buoy.lat, buoy.lng, targetPos.lat, targetPos.lng);
            if (distance > threshold) {
              pending.push({
                buoyId: buoy.id,
                buoyName: buoy.name,
                currentLat: buoy.lat,
                currentLng: buoy.lng,
                targetLat: targetPos.lat,
                targetLng: targetPos.lng,
                markId: mark.id,
                markName: `${mark.name} (Port)`,
                distanceMeters: distance,
              });
            }
          }
        }
        
        if (mark.gateStarboardBuoyId) {
          const buoy = buoys.find(b => b.id === mark.gateStarboardBuoyId);
          if (buoy) {
            const targetPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "starboard");
            const distance = calculateDistanceMeters(buoy.lat, buoy.lng, targetPos.lat, targetPos.lng);
            if (distance > threshold) {
              pending.push({
                buoyId: buoy.id,
                buoyName: buoy.name,
                currentLat: buoy.lat,
                currentLng: buoy.lng,
                targetLat: targetPos.lat,
                targetLng: targetPos.lng,
                markId: mark.id,
                markName: `${mark.name} (Starboard)`,
                distanceMeters: distance,
              });
            }
          }
        }
      } else if (mark.assignedBuoyId) {
        const buoy = buoys.find(b => b.id === mark.assignedBuoyId);
        if (buoy) {
          const distance = calculateDistanceMeters(buoy.lat, buoy.lng, mark.lat, mark.lng);
          if (distance > threshold) {
            pending.push({
              buoyId: buoy.id,
              buoyName: buoy.name,
              currentLat: buoy.lat,
              currentLng: buoy.lng,
              targetLat: mark.lat,
              targetLng: mark.lng,
              markId: mark.id,
              markName: mark.name,
              distanceMeters: distance,
            });
          }
        }
      }
    });

    return pending;
  }, [marks, buoys, buoyFollowSettings.acceptableDistanceMeters, windDirection]);

  const deployAllPending = useCallback(() => {
    const pending = getPendingDeployments();
    lastCommandTime.current.clear();
    pending.forEach(deployment => {
      buoyCommand.mutate({
        id: deployment.buoyId,
        command: "move_to_target",
        targetLat: deployment.targetLat,
        targetLng: deployment.targetLng,
      });
    });
    return pending.length;
  }, [getPendingDeployments, buoyCommand]);

  const commandBuoyForMark = useCallback((mark: Mark, immediate: boolean = false) => {
    if (buoyDeployMode === "manual") {
      return;
    }
    
    if (!mark.assignedBuoyId && !mark.gatePortBuoyId && !mark.gateStarboardBuoyId) {
      return;
    }

    const gateWidthMeters = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);

    if (mark.isGate) {
      if (mark.gatePortBuoyId) {
        const portPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "port");
        if (immediate) {
          sendBuoyToMark(mark.gatePortBuoyId, portPos.lat, portPos.lng);
        } else {
          const timer = debounceTimers.current.get(mark.gatePortBuoyId);
          if (timer) clearTimeout(timer);
          debounceTimers.current.set(
            mark.gatePortBuoyId,
            setTimeout(() => sendBuoyToMark(mark.gatePortBuoyId!, portPos.lat, portPos.lng), buoyFollowSettings.debounceTimeSeconds * 1000)
          );
        }
      }
      if (mark.gateStarboardBuoyId) {
        const stbdPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "starboard");
        if (immediate) {
          sendBuoyToMark(mark.gateStarboardBuoyId, stbdPos.lat, stbdPos.lng);
        } else {
          const timer = debounceTimers.current.get(mark.gateStarboardBuoyId);
          if (timer) clearTimeout(timer);
          debounceTimers.current.set(
            mark.gateStarboardBuoyId,
            setTimeout(() => sendBuoyToMark(mark.gateStarboardBuoyId!, stbdPos.lat, stbdPos.lng), buoyFollowSettings.debounceTimeSeconds * 1000)
          );
        }
      }
    } else if (mark.assignedBuoyId) {
      if (immediate) {
        sendBuoyToMark(mark.assignedBuoyId, mark.lat, mark.lng);
      } else {
        const timer = debounceTimers.current.get(mark.assignedBuoyId);
        if (timer) clearTimeout(timer);
        debounceTimers.current.set(
          mark.assignedBuoyId,
          setTimeout(() => sendBuoyToMark(mark.assignedBuoyId!, mark.lat, mark.lng), buoyFollowSettings.debounceTimeSeconds * 1000)
        );
      }
    }
  }, [sendBuoyToMark, buoyFollowSettings.debounceTimeSeconds, windDirection, buoyDeployMode]);

  const handleMarkMoved = useCallback((markId: string, newLat: number, newLng: number) => {
    if (buoyDeployMode === "manual") {
      return;
    }
    
    const mark = marks.find(m => m.id === markId);
    if (!mark) return;
    const updatedMark = { ...mark, lat: newLat, lng: newLng };
    commandBuoyForMark(updatedMark, true);
  }, [marks, commandBuoyForMark, buoyDeployMode]);

  useEffect(() => {
    if (previousDeployMode.current === "manual" && buoyDeployMode === "automatic") {
      deployAllPending();
    }
    previousDeployMode.current = buoyDeployMode;
  }, [buoyDeployMode, deployAllPending]);

  useEffect(() => {
    if (!enabled || buoyDeployMode === "manual") return;
    
    const interval = setInterval(() => {
      marks.forEach(mark => {
        if (mark.isGate) {
          const gateWidthMeters = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
          if (mark.gatePortBuoyId) {
            const buoy = buoys.find(b => b.id === mark.gatePortBuoyId);
            if (buoy && buoy.state === "holding_position") {
              const expectedPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "port");
              const distance = calculateDistanceMeters(buoy.lat, buoy.lng, expectedPos.lat, expectedPos.lng);
              if (distance > buoyFollowSettings.distanceThresholdMeters) {
                sendBuoyToMark(buoy.id, expectedPos.lat, expectedPos.lng);
              }
            }
          }
          if (mark.gateStarboardBuoyId) {
            const buoy = buoys.find(b => b.id === mark.gateStarboardBuoyId);
            if (buoy && buoy.state === "holding_position") {
              const expectedPos = calculateGateBuoyPosition(mark.lat, mark.lng, gateWidthMeters, windDirection, "starboard");
              const distance = calculateDistanceMeters(buoy.lat, buoy.lng, expectedPos.lat, expectedPos.lng);
              if (distance > buoyFollowSettings.distanceThresholdMeters) {
                sendBuoyToMark(buoy.id, expectedPos.lat, expectedPos.lng);
              }
            }
          }
        } else if (mark.assignedBuoyId) {
          const buoy = buoys.find(b => b.id === mark.assignedBuoyId);
          if (buoy && buoy.state === "holding_position") {
            const distance = calculateDistanceMeters(buoy.lat, buoy.lng, mark.lat, mark.lng);
            if (distance > buoyFollowSettings.distanceThresholdMeters) {
              sendBuoyToMark(buoy.id, mark.lat, mark.lng);
            }
          }
        }
      });
    }, buoyFollowSettings.pollIntervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [enabled, marks, buoys, buoyFollowSettings, sendBuoyToMark, windDirection, buoyDeployMode]);

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
    };
  }, []);

  // Clear timers when courseId changes to prevent ghost commands to wrong course
  useEffect(() => {
    debounceTimers.current.forEach(timer => clearTimeout(timer));
    debounceTimers.current.clear();
    lastCommandTime.current.clear();
  }, [courseId]);

  return {
    handleMarkMoved,
    commandBuoyForMark,
    getPendingDeployments,
    deployAllPending,
    buoyDeployMode,
  };
}
