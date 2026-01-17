import { useCallback } from "react";
import type { DistanceUnit, SpeedUnit } from "@shared/schema";
import { useUserSettings, useUpdateUserSettings } from "./use-api";

const DISTANCE_CONVERSIONS: Record<DistanceUnit, number> = {
  nautical_miles: 1,
  meters: 1852,
  kilometers: 1.852,
  miles: 1.15078,
};

const DISTANCE_LABELS: Record<DistanceUnit, string> = {
  nautical_miles: "nm",
  meters: "m",
  kilometers: "km",
  miles: "mi",
};

const SPEED_CONVERSIONS: Record<SpeedUnit, number> = {
  knots: 1,
  ms: 0.514444,
  kmh: 1.852,
  mph: 1.15078,
  beaufort: 1,
};

const SPEED_LABELS: Record<SpeedUnit, string> = {
  knots: "kts",
  ms: "m/s",
  kmh: "km/h",
  mph: "mph",
  beaufort: "Bft",
};

function toBeaufort(knots: number): number {
  if (knots < 1) return 0;
  if (knots < 4) return 1;
  if (knots < 7) return 2;
  if (knots < 11) return 3;
  if (knots < 17) return 4;
  if (knots < 22) return 5;
  if (knots < 28) return 6;
  if (knots < 34) return 7;
  if (knots < 41) return 8;
  if (knots < 48) return 9;
  if (knots < 56) return 10;
  if (knots < 64) return 11;
  return 12;
}

export function useSettings() {
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const distanceUnit = (settings?.distanceUnit ?? "nautical_miles") as DistanceUnit;
  const speedUnit = (settings?.speedUnit ?? "knots") as SpeedUnit;

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    updateSettings.mutate({ distanceUnit: unit });
  }, [updateSettings]);

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    updateSettings.mutate({ speedUnit: unit });
  }, [updateSettings]);

  const formatDistance = useCallback((nm: number): string => {
    if (nm === 0) return `0 ${DISTANCE_LABELS[distanceUnit]}`;
    const converted = nm * DISTANCE_CONVERSIONS[distanceUnit];
    const decimals = distanceUnit === "meters" ? 0 : 2;
    return `${converted.toFixed(decimals)} ${DISTANCE_LABELS[distanceUnit]}`;
  }, [distanceUnit]);

  const formatSpeed = useCallback((knots: number): string => {
    if (speedUnit === "beaufort") {
      return `${toBeaufort(knots)} ${SPEED_LABELS.beaufort}`;
    }
    const converted = knots * SPEED_CONVERSIONS[speedUnit];
    return `${converted.toFixed(1)} ${SPEED_LABELS[speedUnit]}`;
  }, [speedUnit]);

  const formatBearing = useCallback((degrees: number): string => {
    const normalized = ((degrees % 360) + 360) % 360;
    return `${Math.round(normalized)}°`;
  }, []);

  return {
    distanceUnit,
    speedUnit,
    setDistanceUnit,
    setSpeedUnit,
    formatDistance,
    formatSpeed,
    formatBearing,
  };
}
