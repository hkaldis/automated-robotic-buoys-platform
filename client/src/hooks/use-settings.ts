import { useCallback, useState, useEffect, useRef } from "react";
import type { DistanceUnit, SpeedUnit } from "@shared/schema";
import { useUserSettings, useUpdateUserSettings } from "./use-api";
import { useAuth } from "./useAuth";
import type { StartLineResizeMode, StartLineFixBearingMode, CourseResizeStartLineMode, WindAngleDefaults, BuoyFollowSettings, MapLayerType, BuoyDeployMode, CourseAdjustmentSettings, IntegrationSettings } from "@/lib/services/settings-service";
import { settingsService, DEFAULT_WIND_ANGLES, DEFAULT_BUOY_FOLLOW, DEFAULT_MAP_LAYER, DEFAULT_BUOY_DEPLOY_MODE, DEFAULT_COURSE_ADJUSTMENT, DEFAULT_WIND_ARROWS_MIN_ZOOM, DEFAULT_START_LINE_RESIZE_MODE, DEFAULT_START_LINE_FIX_BEARING_MODE, DEFAULT_COURSE_RESIZE_START_LINE_MODE, DEFAULT_INTEGRATION_SETTINGS, DEFAULT_MARK_NUDGE_METERS } from "@/lib/services/settings-service";

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
  const { user } = useAuth();
  const { data: settings, refetch: refetchSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const lastUserIdRef = useRef<string | null>(null);

  // Track user changes and reload settings when user changes
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    
    if (lastUserIdRef.current !== currentUserId) {
      // User has changed (login, logout, or switch)
      settingsService.reset();
      lastUserIdRef.current = currentUserId;
      
      if (currentUserId) {
        // New user logged in - refetch their settings
        refetchSettings();
      }
    }
  }, [user?.id, refetchSettings]);

  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>(
    settingsService.getDistanceUnit()
  );
  const [speedUnit, setSpeedUnitState] = useState<SpeedUnit>(
    settingsService.getSpeedUnit()
  );
  const [startLineResizeMode, setStartLineResizeModeState] = useState<StartLineResizeMode>(
    settingsService.getStartLineResizeMode()
  );
  const [startLineFixBearingMode, setStartLineFixBearingModeState] = useState<StartLineFixBearingMode>(
    settingsService.getStartLineFixBearingMode()
  );
  const [courseResizeStartLineMode, setCourseResizeStartLineModeState] = useState<CourseResizeStartLineMode>(
    settingsService.getCourseResizeStartLineMode()
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
  const [showSiblingBuoys, setShowSiblingBuoysState] = useState<boolean>(
    settingsService.getShowSiblingBuoys()
  );
  const [buoyDeployMode, setBuoyDeployModeState] = useState<BuoyDeployMode>(
    settingsService.getBuoyDeployMode()
  );
  const [courseAdjustmentSettings, setCourseAdjustmentSettingsState] = useState<CourseAdjustmentSettings>(
    settingsService.getCourseAdjustmentSettings()
  );
  const [windArrowsMinZoom, setWindArrowsMinZoomState] = useState<number>(
    settingsService.getWindArrowsMinZoom()
  );
  const [markNudgeMeters, setMarkNudgeMetersState] = useState<number>(
    settingsService.getMarkNudgeMeters()
  );
  const [integrationSettings, setIntegrationSettingsState] = useState<IntegrationSettings>(
    settingsService.getIntegrationSettings()
  );

  // Load settings from database when they arrive or change
  useEffect(() => {
    if (settings && user) {
      settingsService.loadFromDatabase({
        distanceUnit: (settings.distanceUnit as DistanceUnit) ?? "nautical_miles",
        speedUnit: (settings.speedUnit as SpeedUnit) ?? "knots",
        mapLayer: (settings.mapLayer as MapLayerType) ?? DEFAULT_MAP_LAYER,
        showSeaMarks: settings.showSeaMarks ?? true,
        showSiblingBuoys: settings.showSiblingBuoys ?? true,
        windArrowsMinZoom: settings.windArrowsMinZoom ?? DEFAULT_WIND_ARROWS_MIN_ZOOM,
        markNudgeMeters: settings.markNudgeMeters ?? 10,
        startLineResizeMode: (settings.startLineResizeMode as StartLineResizeMode) ?? DEFAULT_START_LINE_RESIZE_MODE,
        startLineFixBearingMode: (settings.startLineFixBearingMode as StartLineFixBearingMode) ?? DEFAULT_START_LINE_FIX_BEARING_MODE,
        courseResizeStartLineMode: (settings.courseResizeStartLineMode as CourseResizeStartLineMode) ?? DEFAULT_COURSE_RESIZE_START_LINE_MODE,
        buoyDeployMode: (settings.buoyDeployMode as BuoyDeployMode) ?? DEFAULT_BUOY_DEPLOY_MODE,
        windAngleDefaults: (settings.windAngleDefaults as unknown as WindAngleDefaults) ?? { ...DEFAULT_WIND_ANGLES },
        buoyFollow: (settings.buoyFollowSettings as unknown as BuoyFollowSettings) ?? { ...DEFAULT_BUOY_FOLLOW },
        courseAdjustment: (settings.courseAdjustmentSettings as unknown as CourseAdjustmentSettings) ?? { ...DEFAULT_COURSE_ADJUSTMENT },
        integrations: (settings.integrations as unknown as IntegrationSettings) ?? { ...DEFAULT_INTEGRATION_SETTINGS },
      });
    }
  }, [settings, user]);

  // Set up save callback to persist settings to database
  useEffect(() => {
    settingsService.setSaveCallback((payload) => {
      updateSettings.mutate({
        distanceUnit: payload.distanceUnit,
        speedUnit: payload.speedUnit,
        mapLayer: payload.mapLayer,
        showSeaMarks: payload.showSeaMarks,
        showSiblingBuoys: payload.showSiblingBuoys,
        windArrowsMinZoom: payload.windArrowsMinZoom,
        markNudgeMeters: payload.markNudgeMeters,
        startLineResizeMode: payload.startLineResizeMode,
        startLineFixBearingMode: payload.startLineFixBearingMode,
        courseResizeStartLineMode: payload.courseResizeStartLineMode,
        buoyDeployMode: payload.buoyDeployMode,
        windAngleDefaults: payload.windAngleDefaults as unknown as Record<string, number>,
        buoyFollowSettings: payload.buoyFollow as unknown as Record<string, number>,
        courseAdjustmentSettings: payload.courseAdjustment as unknown as Record<string, number>,
        integrations: payload.integrations as unknown as Record<string, unknown>,
      });
    });
    return () => settingsService.setSaveCallback(null);
  }, [updateSettings]);

  useEffect(() => {
    const unsubscribe = settingsService.subscribe(() => {
      setDistanceUnitState(settingsService.getDistanceUnit());
      setSpeedUnitState(settingsService.getSpeedUnit());
      setStartLineResizeModeState(settingsService.getStartLineResizeMode());
      setStartLineFixBearingModeState(settingsService.getStartLineFixBearingMode());
      setCourseResizeStartLineModeState(settingsService.getCourseResizeStartLineMode());
      setWindAngleDefaultsState(settingsService.getWindAngleDefaults());
      setBuoyFollowSettingsState(settingsService.getBuoyFollowSettings());
      setMapLayerState(settingsService.getMapLayer());
      setShowSeaMarksState(settingsService.getShowSeaMarks());
      setShowSiblingBuoysState(settingsService.getShowSiblingBuoys());
      setBuoyDeployModeState(settingsService.getBuoyDeployMode());
      setCourseAdjustmentSettingsState(settingsService.getCourseAdjustmentSettings());
      setWindArrowsMinZoomState(settingsService.getWindArrowsMinZoom());
      setMarkNudgeMetersState(settingsService.getMarkNudgeMeters());
      setIntegrationSettingsState(settingsService.getIntegrationSettings());
    });
    return unsubscribe;
  }, []);

  const setStartLineResizeMode = useCallback((mode: StartLineResizeMode) => {
    settingsService.setStartLineResizeMode(mode);
  }, []);

  const setStartLineFixBearingMode = useCallback((mode: StartLineFixBearingMode) => {
    settingsService.setStartLineFixBearingMode(mode);
  }, []);

  const setCourseResizeStartLineMode = useCallback((mode: CourseResizeStartLineMode) => {
    settingsService.setCourseResizeStartLineMode(mode);
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

  const setShowSiblingBuoys = useCallback((show: boolean) => {
    settingsService.setShowSiblingBuoys(show);
  }, []);

  const setBuoyDeployMode = useCallback((mode: BuoyDeployMode) => {
    settingsService.setBuoyDeployMode(mode);
  }, []);

  const setCourseAdjustmentSetting = useCallback(<K extends keyof CourseAdjustmentSettings>(key: K, value: CourseAdjustmentSettings[K]) => {
    settingsService.setCourseAdjustmentSetting(key, value);
  }, []);

  const resetCourseAdjustmentSettings = useCallback(() => {
    settingsService.resetCourseAdjustmentSettings();
  }, []);

  const setWindArrowsMinZoom = useCallback((zoom: number) => {
    settingsService.setWindArrowsMinZoom(zoom);
  }, []);

  const setMarkNudgeMeters = useCallback((meters: number) => {
    settingsService.setMarkNudgeMeters(meters);
  }, []);

  const setVakarosEnabled = useCallback((enabled: boolean) => {
    settingsService.setVakarosEnabled(enabled);
  }, []);

  const setVakarosEventId = useCallback((eventId: string) => {
    settingsService.setVakarosEventId(eventId);
  }, []);

  const setTractracEnabled = useCallback((enabled: boolean) => {
    settingsService.setTractracEnabled(enabled);
  }, []);

  const setTractracEventId = useCallback((eventId: string) => {
    settingsService.setTractracEventId(eventId);
  }, []);

  const setShowBoatTrails = useCallback((show: boolean) => {
    settingsService.setShowBoatTrails(show);
  }, []);

  const setBoatRefreshRate = useCallback((seconds: number) => {
    settingsService.setBoatRefreshRate(seconds);
  }, []);

  const resetIntegrationSettings = useCallback(() => {
    settingsService.resetIntegrationSettings();
  }, []);

  const isAnyBoatTrackingEnabled = useCallback(() => {
    return settingsService.isAnyBoatTrackingEnabled();
  }, []);

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    settingsService.setDistanceUnit(unit);
  }, []);

  const setSpeedUnit = useCallback((unit: SpeedUnit) => {
    settingsService.setSpeedUnit(unit);
  }, []);

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
    courseResizeStartLineMode,
    setStartLineResizeMode,
    setStartLineFixBearingMode,
    setCourseResizeStartLineMode,
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
    showSiblingBuoys,
    setShowSiblingBuoys,
    buoyDeployMode,
    setBuoyDeployMode,
    courseAdjustmentSettings,
    setCourseAdjustmentSetting,
    resetCourseAdjustmentSettings,
    windArrowsMinZoom,
    setWindArrowsMinZoom,
    markNudgeMeters,
    setMarkNudgeMeters,
    integrationSettings,
    setVakarosEnabled,
    setVakarosEventId,
    setTractracEnabled,
    setTractracEventId,
    setShowBoatTrails,
    setBoatRefreshRate,
    resetIntegrationSettings,
    isAnyBoatTrackingEnabled,
  };
}

export { DEFAULT_WIND_ANGLES, DEFAULT_BUOY_FOLLOW, DEFAULT_MAP_LAYER, DEFAULT_BUOY_DEPLOY_MODE, DEFAULT_COURSE_ADJUSTMENT, DEFAULT_WIND_ARROWS_MIN_ZOOM, DEFAULT_START_LINE_RESIZE_MODE, DEFAULT_START_LINE_FIX_BEARING_MODE, DEFAULT_INTEGRATION_SETTINGS, DEFAULT_MARK_NUDGE_METERS };
export type { StartLineResizeMode, StartLineFixBearingMode, CourseResizeStartLineMode, WindAngleDefaults, BuoyFollowSettings, MapLayerType, BuoyDeployMode, CourseAdjustmentSettings, IntegrationSettings };
