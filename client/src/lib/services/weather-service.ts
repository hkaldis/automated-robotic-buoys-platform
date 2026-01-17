import type { WeatherData, WindSource, Buoy } from "@shared/schema";

type WeatherListener = (data: WeatherData) => void;

class WeatherService {
  private listeners: Set<WeatherListener> = new Set();
  private currentData: WeatherData | null = null;
  private source: WindSource = "buoy";
  private selectedBuoyId: string | null = null;
  private manualWindDirection: number = 0;
  private manualWindSpeed: number = 10;

  subscribe(listener: WeatherListener): () => void {
    this.listeners.add(listener);
    if (this.currentData) {
      listener(this.currentData);
    }
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (this.currentData) {
      this.listeners.forEach(listener => listener(this.currentData!));
    }
  }

  setSource(source: WindSource): void {
    this.source = source;
    this.updateWeatherData();
  }

  getSource(): WindSource {
    return this.source;
  }

  setSelectedBuoy(buoyId: string | null): void {
    this.selectedBuoyId = buoyId;
    this.updateWeatherData();
  }

  getSelectedBuoyId(): string | null {
    return this.selectedBuoyId;
  }

  setManualWind(direction: number, speed: number): void {
    this.manualWindDirection = direction;
    this.manualWindSpeed = speed;
    if (this.source === "manual") {
      this.updateWeatherData();
    }
  }

  updateFromBuoy(buoy: Buoy): void {
    if (this.source === "buoy" && (!this.selectedBuoyId || this.selectedBuoyId === buoy.id)) {
      this.currentData = {
        windSpeed: buoy.windSpeed ?? 0,
        windDirection: buoy.windDirection ?? 0,
        currentSpeed: buoy.currentSpeed ?? 0,
        currentDirection: buoy.currentDirection ?? 0,
        source: "buoy",
        sourceBuoyId: buoy.id,
        timestamp: new Date(),
      };
      this.notify();
    }
  }

  updateFromApi(data: Partial<WeatherData>): void {
    if (this.source === "api") {
      this.currentData = {
        windSpeed: data.windSpeed ?? 0,
        windDirection: data.windDirection ?? 0,
        currentSpeed: data.currentSpeed ?? 0,
        currentDirection: data.currentDirection ?? 0,
        source: "api",
        timestamp: new Date(),
      };
      this.notify();
    }
  }

  private updateWeatherData(): void {
    if (this.source === "manual") {
      this.currentData = {
        windSpeed: this.manualWindSpeed,
        windDirection: this.manualWindDirection,
        currentSpeed: 0,
        currentDirection: 0,
        source: "manual",
        timestamp: new Date(),
      };
      this.notify();
    }
  }

  getCurrentData(): WeatherData | null {
    return this.currentData;
  }

  getWindDirectionDegrees(): number {
    return this.currentData?.windDirection ?? 0;
  }

  getWindSpeedKnots(): number {
    return this.currentData?.windSpeed ?? 0;
  }
}

export const weatherService = new WeatherService();
