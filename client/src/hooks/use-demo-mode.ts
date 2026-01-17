import { useState, useEffect, useCallback, useRef } from "react";
import type { Buoy } from "@shared/schema";

const DEMO_BUOYS_INITIAL: Buoy[] = [
  {
    id: "demo-1",
    name: "Alpha",
    sailClubId: "demo-club",
    state: "idle",
    lat: 37.8044,
    lng: -122.2712,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 95,
    signalStrength: 98,
    windSpeed: 12.5,
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
    lat: 37.8034,
    lng: -122.2702,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 87,
    signalStrength: 95,
    windSpeed: 12.2,
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
    lat: 37.8064,
    lng: -122.2732,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 72,
    signalStrength: 92,
    windSpeed: 13.1,
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
    lat: 37.8024,
    lng: -122.2752,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 65,
    signalStrength: 88,
    windSpeed: 12.8,
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
    lat: 37.8014,
    lng: -122.2692,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 91,
    signalStrength: 97,
    windSpeed: 12.4,
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
    lat: 37.8054,
    lng: -122.2682,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 78,
    signalStrength: 90,
    windSpeed: 12.6,
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
    lat: 37.8074,
    lng: -122.2722,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 83,
    signalStrength: 93,
    windSpeed: 12.9,
    windDirection: 222,
    currentSpeed: 0.8,
    currentDirection: 180,
    eta: null,
  },
];

const KNOTS_TO_NM_PER_SEC = 1 / 3600;

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const EARTH_RADIUS_NM = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useDemoMode() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem("demoMode");
    return stored === "true";
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
          if (targetLat === undefined || targetLng === undefined) return buoy;
          const distanceNm = calculateDistance(buoy.lat, buoy.lng, targetLat, targetLng);
          const speed = 3.25;
          const eta = Math.round((distanceNm / speed) * 3600);
          return {
            ...buoy,
            state: "moving_to_target" as const,
            targetLat,
            targetLng,
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

  const toggleDemoMode = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return {
    enabled,
    setEnabled,
    toggleDemoMode,
    demoBuoys,
    sendCommand,
    resetDemoBuoys,
  };
}
