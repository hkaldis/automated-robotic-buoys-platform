import { useState, useEffect, useCallback } from "react";
import type { WeatherData, WindSource } from "@shared/schema";
import { weatherService } from "@/lib/services/weather-service";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(weatherService.getCurrentData());

  useEffect(() => {
    return weatherService.subscribe(setWeather);
  }, []);

  const setSource = useCallback((source: WindSource) => {
    weatherService.setSource(source);
  }, []);

  const setSelectedBuoy = useCallback((buoyId: string | null) => {
    weatherService.setSelectedBuoy(buoyId);
  }, []);

  const setManualWind = useCallback((direction: number, speed: number) => {
    weatherService.setManualWind(direction, speed);
  }, []);

  return {
    weather,
    source: weatherService.getSource(),
    setSource,
    setSelectedBuoy,
    setManualWind,
  };
}
