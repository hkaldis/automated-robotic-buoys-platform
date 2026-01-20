import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import type { Buoy } from "@shared/schema";

const MIKROLIMANO_CENTER = { lat: 37.9376, lng: 23.6917 };

const DEMO_BUOYS_INITIAL: Buoy[] = [
  {
    id: "demo-1",
    name: "Alpha",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat + 0.001,
    lng: MIKROLIMANO_CENTER.lng + 0.002,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 95,
    signalStrength: 98,
    windSpeed: 40.5,
    windDirection: 225,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-2",
    name: "Bravo",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat - 0.001,
    lng: MIKROLIMANO_CENTER.lng + 0.001,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 87,
    signalStrength: 95,
    windSpeed: 40.2,
    windDirection: 223,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-3",
    name: "Charlie",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat + 0.002,
    lng: MIKROLIMANO_CENTER.lng - 0.001,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 72,
    signalStrength: 92,
    windSpeed: 41.1,
    windDirection: 227,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-4",
    name: "Delta",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat - 0.002,
    lng: MIKROLIMANO_CENTER.lng - 0.002,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 65,
    signalStrength: 88,
    windSpeed: 40.8,
    windDirection: 224,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-5",
    name: "Echo",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat - 0.003,
    lng: MIKROLIMANO_CENTER.lng + 0.003,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 91,
    signalStrength: 97,
    windSpeed: 40.4,
    windDirection: 226,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-6",
    name: "Foxtrot",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat + 0.001,
    lng: MIKROLIMANO_CENTER.lng + 0.004,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 78,
    signalStrength: 90,
    windSpeed: 40.6,
    windDirection: 228,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-7",
    name: "Golf",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat + 0.003,
    lng: MIKROLIMANO_CENTER.lng - 0.002,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 83,
    signalStrength: 93,
    windSpeed: 40.9,
    windDirection: 222,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-8",
    name: "Hotel",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat - 0.0015,
    lng: MIKROLIMANO_CENTER.lng + 0.0035,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 89,
    signalStrength: 94,
    windSpeed: 40.3,
    windDirection: 225,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-9",
    name: "India",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat + 0.0025,
    lng: MIKROLIMANO_CENTER.lng + 0.0015,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 76,
    signalStrength: 91,
    windSpeed: 40.7,
    windDirection: 223,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
  {
    id: "demo-10",
    name: "Juliet",
    sailClubId: "demo-club",
    state: "idle",
    lat: MIKROLIMANO_CENTER.lat - 0.0025,
    lng: MIKROLIMANO_CENTER.lng - 0.0015,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 82,
    signalStrength: 96,
    windSpeed: 40.5,
    windDirection: 226,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
];

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_NM = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface DemoModeContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleDemoMode: () => void;
  demoBuoys: Buoy[];
  sendCommand: (buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => void;
  resetDemoBuoys: () => void;
  updateDemoWeather: (windSpeed: number, windDirection: number) => void;
}

const DemoModeContext = createContext<DemoModeContextType | null>(null);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem("demoMode");
    return stored !== "false";
  });
  
  const [demoBuoys, setDemoBuoys] = useState<Buoy[]>(() => {
    const stored = localStorage.getItem("demoBuoys");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEMO_BUOYS_INITIAL;
      }
    }
    return DEMO_BUOYS_INITIAL;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem("demoMode", String(enabled));
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem("demoBuoys", JSON.stringify(demoBuoys));
  }, [demoBuoys]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setDemoBuoys(prev => prev.map(buoy => {
        if (buoy.state !== "moving_to_target" || !buoy.targetLat || !buoy.targetLng) {
          return buoy;
        }

        const speed = 3 + Math.random() * 0.5;
        const distanceNm = calculateDistance(buoy.lat, buoy.lng, buoy.targetLat, buoy.targetLng);
        
        if (distanceNm < 0.01) {
          return {
            ...buoy,
            lat: buoy.targetLat,
            lng: buoy.targetLng,
            state: "holding_position" as const,
            speed: 0,
            targetLat: null,
            targetLng: null,
            eta: null,
          };
        }

        const deltaTime = 2;
        const moveDistanceNm = (speed / 3600) * deltaTime;
        const fraction = Math.min(moveDistanceNm / distanceNm, 1);
        
        const newLat = buoy.lat + (buoy.targetLat - buoy.lat) * fraction;
        const newLng = buoy.lng + (buoy.targetLng - buoy.lng) * fraction;
        const remainingDistanceNm = calculateDistance(newLat, newLng, buoy.targetLat, buoy.targetLng);
        const etaSeconds = Math.round((remainingDistanceNm / speed) * 3600);

        return {
          ...buoy,
          lat: newLat,
          lng: newLng,
          speed,
          eta: etaSeconds,
        };
      }));
    }, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  const sendCommand = useCallback((buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => {
    setDemoBuoys(prev => prev.map(buoy => {
      if (buoy.id !== buoyId) return buoy;

      switch (command) {
        case "move_to_target":
          const finalTargetLat = targetLat ?? buoy.targetLat ?? buoy.lat + 0.002;
          const finalTargetLng = targetLng ?? buoy.targetLng ?? buoy.lng + 0.002;
          const distanceNm = calculateDistance(buoy.lat, buoy.lng, finalTargetLat, finalTargetLng);
          const speed = 3.25;
          const eta = Math.round((distanceNm / speed) * 3600);
          return {
            ...buoy,
            state: "moving_to_target" as const,
            targetLat: finalTargetLat,
            targetLng: finalTargetLng,
            speed,
            eta,
          };
        case "hold_position":
          return {
            ...buoy,
            state: "holding_position" as const,
            speed: 0,
            eta: null,
          };
        case "cancel":
          return {
            ...buoy,
            state: "idle" as const,
            targetLat: null,
            targetLng: null,
            speed: 0,
            eta: null,
          };
        default:
          return buoy;
      }
    }));
  }, []);

  const resetDemoBuoys = useCallback(() => {
    setDemoBuoys(DEMO_BUOYS_INITIAL);
  }, []);

  const updateDemoWeather = useCallback((windSpeed: number, windDirection: number) => {
    setDemoBuoys(prev => prev.map(buoy => ({
      ...buoy,
      windSpeed: windSpeed + (Math.random() - 0.5) * 2,
      windDirection: windDirection + (Math.random() - 0.5) * 10,
    })));
  }, []);

  const toggleDemoMode = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return (
    <DemoModeContext.Provider value={{
      enabled,
      setEnabled,
      toggleDemoMode,
      demoBuoys,
      sendCommand,
      resetDemoBuoys,
      updateDemoWeather,
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoModeContext() {
  const context = useContext(DemoModeContext);
  if (!context) {
    throw new Error("useDemoModeContext must be used within a DemoModeProvider");
  }
  return context;
}
