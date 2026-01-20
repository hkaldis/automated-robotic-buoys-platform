import { useCallback, useState, useEffect } from "react";
import type { DistanceUnit, SpeedUnit } from "@shared/schema";
import { useUserSettings, useUpdateUserSettings } from "./use-api";
import type { StartLineResizeMode, StartLineFixBearingMode, WindAngleDefaults, BuoyFollowSettings, MapLayerType, BuoyDeployMode } from "@/lib/services/settings-service";
import { settingsService, DEFAULT_WIND_ANGLES, DEFAULT_BUOY_FOLLOW, DEFAULT_MAP_LAYER, DEFAULT_BUOY_DEPLOY_MODE } from "@/lib/services/settings-service";

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

  const [startLineResizeMode, setStartLineResizeModeState] = useState<StartLineResizeMode>(
    settingsService.getStartLineResizeMode()
  );
  const [startLineFixBearingMode, setStartLineFixBearingModeState] = useState<StartLineFixBearingMode>(
    settingsService.getStartLineFixBearingMode()
  );
  const [windAngleDefaults, setWindAngleDefaultsState] = useState<WindAngleDefaults>(
    settingsService.getWindAngleDefaults()
  );
  const [buoyFollowSettings, setBuoyFollowSettingsState] = useState<BuoyFollowSettings>(
    settingsService.getBuoyFollowSettings()
  );
  const [mapLayer, setMapLayerState] = useState<MapLayerType>(
    settingsService.getMapLayer()
  );
  const [showSeaMarks, setShowSeaMarksState] = useState<boolean>(
    settingsService.getShowSeaMarks()
  );
  const [buoyDeployMode, setBuoyDeployModeState] = useState<BuoyDeployMode>(
    settingsService.getBuoyDeployMode()
  );

  useEffect(() => {
    const unsubscribe = settingsService.subscribe(() => {
      setStartLineResizeModeState(settingsService.getStartLineResizeMode());
      setStartLineFixBearingModeState(settingsService.getStartLineFixBearingMode());
      setWindAngleDefaultsState(settingsService.getWindAngleDefaults());
      setBuoyFollowSettingsState(settingsService.getBuoyFollowSettings());
      setMapLayerState(settingsService.getMapLayer());
      setShowSeaMarksState(settingsService.getShowSeaMarks());
      setBuoyDeployModeState(settingsService.getBuoyDeployMode());
    });
    return unsubscribe;
  }, []);

  const setStartLineResizeMode = useCallback((mode: StartLineResizeMode) => {
    settingsService.setStartLineResizeMode(mode);
  }, []);

  const setStartLineFixBearingMode = useCallback((mode: StartLineFixBearingMode) => {
    settingsService.setStartLineFixBearingMode(mode);
  }, []);

  const setWindAngleDefault = useCallback((role: keyof WindAngleDefaults, value: number) => {
    settingsService.setWindAngleDefault(role, value);
  }, []);

  const resetWindAngleDefaults = useCallback(() => {
    settingsService.resetWindAngleDefaults();
  }, []);

  const getWindAngleForRole = useCallback((role: string): number => {
    return settingsService.getWindAngleForRole(role);
  }, []);

  const setBuoyFollowSetting = useCallback(<K extends keyof BuoyFollowSettings>(key: K, value: BuoyFollowSettings[K]) => {
    settingsService.setBuoyFollowSetting(key, value);
  }, []);

  const resetBuoyFollowSettings = useCallback(() => {
    settingsService.resetBuoyFollowSettings();
  }, []);

  const setMapLayer = useCallback((layer: MapLayerType) => {
    settingsService.setMapLayer(layer);
  }, []);

  const setShowSeaMarks = useCallback((show: boolean) => {
    settingsService.setShowSeaMarks(show);
  }, []);

  const setBuoyDeployMode = useCallback((mode: BuoyDeployMode) => {
    settingsService.setBuoyDeployMode(mode);
  }, []);

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
    startLineResizeMode,
    startLineFixBearingMode,
    setStartLineResizeMode,
    setStartLineFixBearingMode,
    windAngleDefaults,
    setWindAngleDefault,
    resetWindAngleDefaults,
    getWindAngleForRole,
    buoyFollowSettings,
    setBuoyFollowSetting,
    resetBuoyFollowSettings,
    mapLayer,
    setMapLayer,
    showSeaMarks,
    setShowSeaMarks,
    buoyDeployMode,
    setBuoyDeployMode,
  };
}

export { DEFAULT_WIND_ANGLES, DEFAULT_BUOY_FOLLOW, DEFAULT_MAP_LAYER, DEFAULT_BUOY_DEPLOY_MODE };
export type { StartLineResizeMode, StartLineFixBearingMode, WindAngleDefaults, BuoyFollowSettings, MapLayerType, BuoyDeployMode };
