import type { DistanceUnit, SpeedUnit } from "@shared/schema";

type SettingsListener = () => void;

export type StartLineResizeMode = "both" | "pin" | "committee_boat";
export type StartLineFixBearingMode = "pin" | "committee_boat";

export interface WindAngleDefaults {
  windward: number;
  leeward: number;
  wing: number;
  offset: number;
  turning_mark: number;
  other: number;
}

export const DEFAULT_WIND_ANGLES: WindAngleDefaults = {
  windward: 0,
  leeward: 180,
  wing: -120,
  offset: 10,
  turning_mark: 0,
  other: 0,
};

export interface BuoyFollowSettings {
  distanceThresholdMeters: number;
  pollIntervalSeconds: number;
  debounceTimeSeconds: number;
  acceptableDistanceMeters: number;
}

export const DEFAULT_BUOY_FOLLOW: BuoyFollowSettings = {
  distanceThresholdMeters: 3,
  pollIntervalSeconds: 5,
  debounceTimeSeconds: 3,
  acceptableDistanceMeters: 1,
};

export type MapLayerType = "osm" | "osm_nolabels" | "light_voyager" | "light_positron" | "light_toner" | "satellite" | "nautical";

export const DEFAULT_MAP_LAYER: MapLayerType = "light_voyager";

export type BuoyDeployMode = "automatic" | "manual";

export const DEFAULT_BUOY_DEPLOY_MODE: BuoyDeployMode = "manual";

export const DEFAULT_START_LINE_RESIZE_MODE: StartLineResizeMode = "pin";
export const DEFAULT_START_LINE_FIX_BEARING_MODE: StartLineFixBearingMode = "pin";

export interface CourseAdjustmentSettings {
  rotationDegrees: number;
  resizePercent: number;
}

export const DEFAULT_COURSE_ADJUSTMENT: CourseAdjustmentSettings = {
  rotationDegrees: 5,
  resizePercent: 10,
};

export const DEFAULT_WIND_ARROWS_MIN_ZOOM = 13;

interface UserSettings {
  distanceUnit: DistanceUnit;
  speedUnit: SpeedUnit;
  startLineResizeMode: StartLineResizeMode;
  startLineFixBearingMode: StartLineFixBearingMode;
  windAngleDefaults: WindAngleDefaults;
  buoyFollow: BuoyFollowSettings;
  mapLayer: MapLayerType;
  showSeaMarks: boolean;
  showSiblingBuoys: boolean;
  buoyDeployMode: BuoyDeployMode;
  courseAdjustment: CourseAdjustmentSettings;
  windArrowsMinZoom: number;
}

class SettingsService {
  private settings: UserSettings = {
    distanceUnit: "nautical_miles",
    speedUnit: "knots",
    startLineResizeMode: DEFAULT_START_LINE_RESIZE_MODE,
    startLineFixBearingMode: DEFAULT_START_LINE_FIX_BEARING_MODE,
    windAngleDefaults: { ...DEFAULT_WIND_ANGLES },
    buoyFollow: { ...DEFAULT_BUOY_FOLLOW },
    mapLayer: DEFAULT_MAP_LAYER,
    showSeaMarks: true,
    showSiblingBuoys: true,
    buoyDeployMode: DEFAULT_BUOY_DEPLOY_MODE,
    courseAdjustment: { ...DEFAULT_COURSE_ADJUSTMENT },
    windArrowsMinZoom: DEFAULT_WIND_ARROWS_MIN_ZOOM,
  };
  private listeners: Set<SettingsListener> = new Set();
  private userId: string | null = null;
  private pendingSave: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // No longer load from localStorage - settings come from database via loadFromDatabase()
  }

  // Reset all settings to defaults (used on logout or user change)
  reset(): void {
    this.settings = {
      distanceUnit: "nautical_miles",
      speedUnit: "knots",
      startLineResizeMode: DEFAULT_START_LINE_RESIZE_MODE,
      startLineFixBearingMode: DEFAULT_START_LINE_FIX_BEARING_MODE,
      windAngleDefaults: { ...DEFAULT_WIND_ANGLES },
      buoyFollow: { ...DEFAULT_BUOY_FOLLOW },
      mapLayer: DEFAULT_MAP_LAYER,
      showSeaMarks: true,
      showSiblingBuoys: true,
      buoyDeployMode: DEFAULT_BUOY_DEPLOY_MODE,
      courseAdjustment: { ...DEFAULT_COURSE_ADJUSTMENT },
      windArrowsMinZoom: DEFAULT_WIND_ARROWS_MIN_ZOOM,
    };
    this.userId = null;
    this.listeners.forEach(listener => listener());
  }

  // Load settings from database API response
  loadFromDatabase(dbSettings: Partial<UserSettings> | null): void {
    if (dbSettings) {
      this.settings = { ...this.settings, ...dbSettings };
      this.listeners.forEach(listener => listener());
    }
  }

  // Set the current user ID for saving
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  // Get a save payload for the API
  getSavePayload(): Partial<UserSettings> {
    return {
      distanceUnit: this.settings.distanceUnit,
      speedUnit: this.settings.speedUnit,
      startLineResizeMode: this.settings.startLineResizeMode,
      startLineFixBearingMode: this.settings.startLineFixBearingMode,
      windAngleDefaults: this.settings.windAngleDefaults,
      buoyFollow: this.settings.buoyFollow,
      mapLayer: this.settings.mapLayer,
      showSeaMarks: this.settings.showSeaMarks,
      buoyDeployMode: this.settings.buoyDeployMode,
      courseAdjustment: this.settings.courseAdjustment,
      windArrowsMinZoom: this.settings.windArrowsMinZoom,
    };
  }

  private onSaveCallback: ((payload: Partial<UserSettings>) => void) | null = null;

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Set callback for saving to database
  setSaveCallback(callback: ((payload: Partial<UserSettings>) => void) | null): void {
    this.onSaveCallback = callback;
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
    // Debounce save to database
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
    }
    this.pendingSave = setTimeout(() => {
      if (this.onSaveCallback) {
        this.onSaveCallback(this.getSavePayload());
      }
      this.pendingSave = null;
    }, 500);
  }

  getDistanceUnit(): DistanceUnit {
    return this.settings.distanceUnit;
  }

  setDistanceUnit(unit: DistanceUnit): void {
    this.settings.distanceUnit = unit;
    this.notify();
  }

  getSpeedUnit(): SpeedUnit {
    return this.settings.speedUnit;
  }

  setSpeedUnit(unit: SpeedUnit): void {
    this.settings.speedUnit = unit;
    this.notify();
  }

  getStartLineResizeMode(): StartLineResizeMode {
    return this.settings.startLineResizeMode;
  }

  setStartLineResizeMode(mode: StartLineResizeMode): void {
    this.settings.startLineResizeMode = mode;
    this.notify();
  }

  getStartLineFixBearingMode(): StartLineFixBearingMode {
    return this.settings.startLineFixBearingMode;
  }

  setStartLineFixBearingMode(mode: StartLineFixBearingMode): void {
    this.settings.startLineFixBearingMode = mode;
    this.notify();
  }

  getWindAngleDefaults(): WindAngleDefaults {
    return { ...this.settings.windAngleDefaults };
  }

  setWindAngleDefault(role: keyof WindAngleDefaults, value: number): void {
    this.settings.windAngleDefaults[role] = value;
    this.notify();
  }

  resetWindAngleDefaults(): void {
    this.settings.windAngleDefaults = { ...DEFAULT_WIND_ANGLES };
    this.notify();
  }

  getWindAngleForRole(role: string): number {
    const key = role as keyof WindAngleDefaults;
    if (key in this.settings.windAngleDefaults) {
      return this.settings.windAngleDefaults[key];
    }
    return this.settings.windAngleDefaults.other;
  }

  getBuoyFollowSettings(): BuoyFollowSettings {
    return { ...this.settings.buoyFollow };
  }

  setBuoyFollowSetting<K extends keyof BuoyFollowSettings>(key: K, value: BuoyFollowSettings[K]): void {
    this.settings.buoyFollow[key] = value;
    this.notify();
  }

  resetBuoyFollowSettings(): void {
    this.settings.buoyFollow = { ...DEFAULT_BUOY_FOLLOW };
    this.notify();
  }

  getMapLayer(): MapLayerType {
    return this.settings.mapLayer;
  }

  setMapLayer(layer: MapLayerType): void {
    this.settings.mapLayer = layer;
    this.notify();
  }

  getShowSeaMarks(): boolean {
    return this.settings.showSeaMarks;
  }

  setShowSeaMarks(show: boolean): void {
    this.settings.showSeaMarks = show;
    this.notify();
  }

  getShowSiblingBuoys(): boolean {
    return this.settings.showSiblingBuoys;
  }

  setShowSiblingBuoys(show: boolean): void {
    this.settings.showSiblingBuoys = show;
    this.notify();
  }

  getBuoyDeployMode(): BuoyDeployMode {
    return this.settings.buoyDeployMode;
  }

  setBuoyDeployMode(mode: BuoyDeployMode): void {
    this.settings.buoyDeployMode = mode;
    this.notify();
  }

  getCourseAdjustmentSettings(): CourseAdjustmentSettings {
    return { ...this.settings.courseAdjustment };
  }

  setCourseAdjustmentSetting<K extends keyof CourseAdjustmentSettings>(key: K, value: CourseAdjustmentSettings[K]): void {
    this.settings.courseAdjustment[key] = value;
    this.notify();
  }

  resetCourseAdjustmentSettings(): void {
    this.settings.courseAdjustment = { ...DEFAULT_COURSE_ADJUSTMENT };
    this.notify();
  }

  getWindArrowsMinZoom(): number {
    return this.settings.windArrowsMinZoom;
  }

  setWindArrowsMinZoom(zoom: number): void {
    this.settings.windArrowsMinZoom = zoom;
    this.notify();
  }

  formatDistance(valueNm: number): string {
    const unit = this.settings.distanceUnit;
    let converted: number;
    let suffix: string;

    switch (unit) {
      case "meters":
        converted = valueNm * 1852;
        suffix = "m";
        break;
      case "kilometers":
        converted = valueNm * 1.852;
        suffix = "km";
        break;
      case "miles":
        converted = valueNm * 1.15078;
        suffix = "mi";
        break;
      case "nautical_miles":
      default:
        converted = valueNm;
        suffix = "nm";
        break;
    }

    if (converted < 0.1) {
      return `${(converted * 1000).toFixed(0)}${unit === "meters" ? "m" : unit === "kilometers" ? "m" : "ft"}`;
    }
    return `${converted.toFixed(2)} ${suffix}`;
  }

  formatSpeed(valueKnots: number): string {
    const unit = this.settings.speedUnit;
    let converted: number;
    let suffix: string;

    switch (unit) {
      case "ms":
        converted = valueKnots * 0.514444;
        suffix = "m/s";
        break;
      case "kmh":
        converted = valueKnots * 1.852;
        suffix = "km/h";
        break;
      case "mph":
        converted = valueKnots * 1.15078;
        suffix = "mph";
        break;
      case "beaufort":
        converted = this.knotsToBeaufort(valueKnots);
        suffix = "Bft";
        break;
      case "knots":
      default:
        converted = valueKnots;
        suffix = "kts";
        break;
    }

    return `${converted.toFixed(1)} ${suffix}`;
  }

  formatBearing(degrees: number): string {
    return `${degrees.toFixed(0)}°`;
  }

  private knotsToBeaufort(knots: number): number {
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
}

export const settingsService = new SettingsService();
