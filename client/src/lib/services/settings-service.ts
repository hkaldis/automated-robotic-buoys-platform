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

interface UserSettings {
  distanceUnit: DistanceUnit;
  speedUnit: SpeedUnit;
  startLineResizeMode: StartLineResizeMode;
  startLineFixBearingMode: StartLineFixBearingMode;
  windAngleDefaults: WindAngleDefaults;
}

class SettingsService {
  private settings: UserSettings = {
    distanceUnit: "nautical_miles",
    speedUnit: "knots",
    startLineResizeMode: "both",
    startLineFixBearingMode: "pin",
    windAngleDefaults: { ...DEFAULT_WIND_ANGLES },
  };
  private listeners: Set<SettingsListener> = new Set();

  constructor() {
    const saved = localStorage.getItem("user_settings");
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
    localStorage.setItem("user_settings", JSON.stringify(this.settings));
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
