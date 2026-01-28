import { databaseStorage } from "./database-storage";
import type { Buoy, InsertBuoyWeatherHistory } from "@shared/schema";

const COLLECTION_INTERVAL_MS = 10000;
const ROLLING_AVG_WINDOW_MS = 5 * 60 * 1000;

let collectionInterval: NodeJS.Timeout | null = null;
let isCollecting = false;

async function calculateRollingAverages(
  buoyId: string,
  eventId: string | null
): Promise<{ avgDirection: number | null; avgSpeed: number | null }> {
  if (!eventId) {
    return { avgDirection: null, avgSpeed: null };
  }

  try {
    const recentReadings = await databaseStorage.getWeatherHistory(buoyId, 5);
    
    if (recentReadings.length < 2) {
      return { avgDirection: null, avgSpeed: null };
    }

    let sinSum = 0;
    let cosSum = 0;
    let speedSum = 0;

    for (const reading of recentReadings) {
      const radians = (reading.windDirection * Math.PI) / 180;
      sinSum += Math.sin(radians);
      cosSum += Math.cos(radians);
      speedSum += reading.windSpeed;
    }

    const avgDirection = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
    const avgSpeed = speedSum / recentReadings.length;

    return { avgDirection, avgSpeed };
  } catch (error) {
    console.error("Error calculating rolling averages:", error);
    return { avgDirection: null, avgSpeed: null };
  }
}

async function collectWeatherReadings(): Promise<void> {
  if (isCollecting) {
    return;
  }

  isCollecting = true;

  try {
    const buoys = await databaseStorage.getBuoys();
    
    const buoysWithWeatherData = buoys.filter(
      (buoy) => 
        buoy.windSpeed !== null && 
        buoy.windDirection !== null &&
        buoy.eventId !== null
    );

    if (buoysWithWeatherData.length === 0) {
      return;
    }

    for (const buoy of buoysWithWeatherData) {
      try {
        const { avgDirection, avgSpeed } = await calculateRollingAverages(
          buoy.id,
          buoy.eventId
        );

        const reading: InsertBuoyWeatherHistory = {
          buoyId: buoy.id,
          eventId: buoy.eventId,
          windDirection: buoy.windDirection!,
          windSpeed: buoy.windSpeed!,
          gustSpeed: null,
          currentDirection: buoy.currentDirection,
          currentSpeed: buoy.currentSpeed,
          sensorQuality: buoy.signalStrength,
          rollingAvgDirection: avgDirection,
          rollingAvgSpeed: avgSpeed,
        };

        await databaseStorage.createWeatherReading(reading);
      } catch (error) {
        console.error(`Error recording weather for buoy ${buoy.id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in weather collection:", error);
  } finally {
    isCollecting = false;
  }
}

export function startWeatherCollection(): void {
  if (collectionInterval) {
    console.log("Weather collection already running");
    return;
  }

  console.log(`Starting weather collection (every ${COLLECTION_INTERVAL_MS / 1000}s)`);
  
  collectWeatherReadings();
  
  collectionInterval = setInterval(collectWeatherReadings, COLLECTION_INTERVAL_MS);
}

export function stopWeatherCollection(): void {
  if (collectionInterval) {
    clearInterval(collectionInterval);
    collectionInterval = null;
    console.log("Weather collection stopped");
  }
}

export function isWeatherCollectionRunning(): boolean {
  return collectionInterval !== null;
}
