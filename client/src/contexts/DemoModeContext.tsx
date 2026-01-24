import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import type { Buoy, BuoyState, BuoyInventoryStatus, BuoyOwnership, SiblingBuoy } from "@shared/schema";

const MIKROLIMANO_CENTER = { lat: 37.9376, lng: 23.6917 };

export interface TrackedBoat {
  id: string;
  sailNumber: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: Date;
  source: "vakaros" | "tractrac";
  fleetId?: string;
}

const createDemoBuoy = (
  id: string,
  name: string,
  latOffset: number,
  lngOffset: number,
  battery: number,
  signalStrength: number,
  windSpeed: number,
  windDirection: number
): Buoy => ({
  id,
  name,
  sailClubId: "demo-club",
  eventId: "demo-event",
  state: "idle" satisfies BuoyState,
  lat: MIKROLIMANO_CENTER.lat + latOffset,
  lng: MIKROLIMANO_CENTER.lng + lngOffset,
  targetLat: null,
  targetLng: null,
  speed: 0,
  battery,
  signalStrength,
  windSpeed,
  windDirection,
  currentSpeed: 0.8,
  currentDirection: 180,
  eta: null,
  createdAt: null,
  serialNumber: null,
  ownershipType: "platform_owned" satisfies BuoyOwnership,
  inventoryStatus: "assigned_event" satisfies BuoyInventoryStatus,
  weatherSensorModel: null,
  motorModel: null,
  cameraModel: null,
  batteryInfo: null,
  otherEquipment: null,
  hardwareConfig: null,
});

const DEMO_BUOYS_INITIAL: Buoy[] = [
  createDemoBuoy("demo-1", "Alpha", 0.001, 0.002, 95, 98, 12.5, 225),
  createDemoBuoy("demo-2", "Bravo", -0.001, 0.001, 87, 95, 12.2, 223),
  createDemoBuoy("demo-3", "Charlie", 0.002, -0.001, 72, 92, 13.1, 227),
  createDemoBuoy("demo-4", "Delta", -0.002, -0.002, 65, 88, 12.8, 224),
  createDemoBuoy("demo-5", "Echo", -0.003, 0.003, 91, 97, 12.4, 226),
  createDemoBuoy("demo-6", "Foxtrot", 0.001, 0.004, 78, 90, 12.6, 228),
  createDemoBuoy("demo-7", "Golf", 0.003, -0.002, 83, 93, 12.9, 222),
  createDemoBuoy("demo-8", "Hotel", -0.0015, 0.0035, 89, 94, 12.3, 225),
  createDemoBuoy("demo-9", "India", 0.0025, 0.0015, 76, 91, 12.7, 223),
  createDemoBuoy("demo-10", "Juliet", -0.0025, -0.0015, 82, 96, 12.5, 226),
];

const SIBLING_CENTER = { lat: 37.9232, lng: 23.6732 };
const TRIANGLE_SIDE_METERS = 500;
const CIRCUMRADIUS_METERS = TRIANGLE_SIDE_METERS / Math.sqrt(3);
const LAT_OFFSET = CIRCUMRADIUS_METERS / 111320;
const LNG_OFFSET = CIRCUMRADIUS_METERS / (111320 * Math.cos(SIBLING_CENTER.lat * Math.PI / 180));

const DEMO_SIBLING_BUOYS: SiblingBuoy[] = [
  {
    id: "sibling-1",
    name: "Kilo",
    sailClubId: "demo-club",
    eventId: "demo-event-youth",
    state: "idle" as BuoyState,
    lat: SIBLING_CENTER.lat + LAT_OFFSET,
    lng: SIBLING_CENTER.lng,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 85,
    signalStrength: 92,
    windSpeed: 11.5,
    windDirection: 220,
    currentSpeed: 0.6,
    currentDirection: 175,
    eta: null,
    createdAt: null,
    serialNumber: null,
    ownershipType: "platform_owned" as BuoyOwnership,
    inventoryStatus: "assigned_event" as BuoyInventoryStatus,
    weatherSensorModel: null,
    motorModel: null,
    cameraModel: null,
    batteryInfo: null,
    otherEquipment: null,
    hardwareConfig: null,
    eventName: "Youth Regatta",
    sourceEventId: "demo-event-youth",
  },
  {
    id: "sibling-2",
    name: "Lima",
    sailClubId: "demo-club",
    eventId: "demo-event-youth",
    state: "idle" as BuoyState,
    lat: SIBLING_CENTER.lat - LAT_OFFSET * 0.5,
    lng: SIBLING_CENTER.lng - LNG_OFFSET * 0.866,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 78,
    signalStrength: 88,
    windSpeed: 11.8,
    windDirection: 218,
    currentSpeed: 0.6,
    currentDirection: 175,
    eta: null,
    createdAt: null,
    serialNumber: null,
    ownershipType: "platform_owned" as BuoyOwnership,
    inventoryStatus: "assigned_event" as BuoyInventoryStatus,
    weatherSensorModel: null,
    motorModel: null,
    cameraModel: null,
    batteryInfo: null,
    otherEquipment: null,
    hardwareConfig: null,
    eventName: "Youth Regatta",
    sourceEventId: "demo-event-youth",
  },
  {
    id: "sibling-3",
    name: "Mike",
    sailClubId: "demo-club",
    eventId: "demo-event-youth",
    state: "idle" as BuoyState,
    lat: SIBLING_CENTER.lat - LAT_OFFSET * 0.5,
    lng: SIBLING_CENTER.lng + LNG_OFFSET * 0.866,
    targetLat: null,
    targetLng: null,
    speed: 0,
    battery: 82,
    signalStrength: 90,
    windSpeed: 11.2,
    windDirection: 222,
    currentSpeed: 0.6,
    currentDirection: 175,
    eta: null,
    createdAt: null,
    serialNumber: null,
    ownershipType: "platform_owned" as BuoyOwnership,
    inventoryStatus: "assigned_event" as BuoyInventoryStatus,
    weatherSensorModel: null,
    motorModel: null,
    cameraModel: null,
    batteryInfo: null,
    otherEquipment: null,
    hardwareConfig: null,
    eventName: "Youth Regatta",
    sourceEventId: "demo-event-youth",
  },
];

const METERS_TO_LAT = 1 / 111320;
const metersToLng = (lat: number) => 1 / (111320 * Math.cos(lat * Math.PI / 180));

function generateRandomPositionInRadius(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): { lat: number; lng: number } {
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radiusMeters;
  const latOffset = distance * Math.cos(angle) * METERS_TO_LAT;
  const lngOffset = distance * Math.sin(angle) * metersToLng(centerLat);
  return {
    lat: centerLat + latOffset,
    lng: centerLng + lngOffset,
  };
}

function createDemoBoatsNearPosition(centerLat: number, centerLng: number): TrackedBoat[] {
  const boatConfigs = [
    { id: "boat-1", sailNumber: "GRE 123", source: "vakaros" as const },
    { id: "boat-2", sailNumber: "GRE 456", source: "vakaros" as const },
    { id: "boat-3", sailNumber: "GRE 789", source: "tractrac" as const },
    { id: "boat-4", sailNumber: "ITA 101", source: "vakaros" as const },
    { id: "boat-5", sailNumber: "FRA 202", source: "tractrac" as const },
    { id: "boat-6", sailNumber: "ESP 303", source: "vakaros" as const },
    { id: "boat-7", sailNumber: "GBR 404", source: "tractrac" as const },
    { id: "boat-8", sailNumber: "NED 505", source: "vakaros" as const },
    { id: "boat-9", sailNumber: "AUS 606", source: "tractrac" as const },
    { id: "boat-10", sailNumber: "USA 707", source: "vakaros" as const },
  ];

  return boatConfigs.map(config => {
    const pos = generateRandomPositionInRadius(centerLat, centerLng, 200);
    return {
      id: config.id,
      sailNumber: config.sailNumber,
      lat: pos.lat,
      lng: pos.lng,
      heading: Math.random() * 360,
      speed: 3 + Math.random() * 4,
      timestamp: new Date(),
      source: config.source,
    };
  });
}

const DEMO_BOATS_INITIAL: TrackedBoat[] = createDemoBoatsNearPosition(
  MIKROLIMANO_CENTER.lat,
  MIKROLIMANO_CENTER.lng
);

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
  demoSiblingBuoys: SiblingBuoy[];
  demoBoats: TrackedBoat[];
  sendCommand: (buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => void;
  resetDemoBuoys: () => void;
  repositionDemoBuoys: (centerLat: number, centerLng: number) => void;
  repositionDemoBoats: (centerLat: number, centerLng: number) => void;
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

  const [demoBoats, setDemoBoats] = useState<TrackedBoat[]>(DEMO_BOATS_INITIAL);
  const boatCenterRef = useRef<{ lat: number; lng: number }>(MIKROLIMANO_CENTER);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (buoy.state !== "moving_to_target" || !buoy.targetLat || !buoy.targetLng || buoy.lat === null || buoy.lng === null) {
          return buoy;
        }

        const speed = 20 + Math.random() * 20;
        const distanceNm = calculateDistance(buoy.lat!, buoy.lng!, buoy.targetLat, buoy.targetLng);
        
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
        
        const newLat = buoy.lat! + (buoy.targetLat - buoy.lat!) * fraction;
        const newLng = buoy.lng! + (buoy.targetLng - buoy.lng!) * fraction;
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

  useEffect(() => {
    if (!enabled) {
      if (boatIntervalRef.current) {
        clearInterval(boatIntervalRef.current);
        boatIntervalRef.current = null;
      }
      return;
    }

    boatIntervalRef.current = setInterval(() => {
      const center = boatCenterRef.current;
      const maxRadiusMeters = 200;
      const maxRadiusLat = maxRadiusMeters * METERS_TO_LAT;
      const maxRadiusLng = maxRadiusMeters * metersToLng(center.lat);
      
      setDemoBoats(prev => prev.map(boat => {
        const headingRad = boat.heading * Math.PI / 180;
        const speedKnots = boat.speed + (Math.random() - 0.5) * 0.5;
        const moveDistanceNm = (speedKnots / 3600) * 3;
        
        const latDelta = moveDistanceNm * Math.cos(headingRad) / 60;
        const lngDelta = moveDistanceNm * Math.sin(headingRad) / (60 * Math.cos(boat.lat * Math.PI / 180));
        
        let newLat = boat.lat + latDelta;
        let newLng = boat.lng + lngDelta;
        let newHeading = boat.heading + (Math.random() - 0.5) * 5;
        
        const distLatFromCenter = Math.abs(newLat - center.lat);
        const distLngFromCenter = Math.abs(newLng - center.lng);
        const normalizedDist = Math.sqrt(
          Math.pow(distLatFromCenter / maxRadiusLat, 2) + 
          Math.pow(distLngFromCenter / maxRadiusLng, 2)
        );
        
        if (normalizedDist > 1) {
          const angleToCenter = Math.atan2(
            center.lng - newLng,
            center.lat - newLat
          ) * 180 / Math.PI;
          newHeading = angleToCenter + (Math.random() - 0.5) * 30;
        }

        return {
          ...boat,
          lat: newLat,
          lng: newLng,
          heading: ((newHeading % 360) + 360) % 360,
          speed: Math.max(2, Math.min(8, speedKnots)),
          timestamp: new Date(),
        };
      }));
    }, 3000);

    return () => {
      if (boatIntervalRef.current) {
        clearInterval(boatIntervalRef.current);
        boatIntervalRef.current = null;
      }
    };
  }, [enabled]);

  const sendCommand = useCallback((buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => {
    setDemoBuoys(prev => prev.map(buoy => {
      if (buoy.id !== buoyId) return buoy;

      switch (command) {
        case "move_to_target":
          const currentLat = buoy.lat ?? 0;
          const currentLng = buoy.lng ?? 0;
          const finalTargetLat = targetLat ?? buoy.targetLat ?? currentLat + 0.002;
          const finalTargetLng = targetLng ?? buoy.targetLng ?? currentLng + 0.002;
          const distanceNm = calculateDistance(currentLat, currentLng, finalTargetLat, finalTargetLng);
          const speed = 30;
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

  const repositionDemoBuoys = useCallback((centerLat: number, centerLng: number) => {
    const offsets = [
      { lat: 0.002, lng: 0.003 },
      { lat: -0.001, lng: 0.004 },
      { lat: 0.003, lng: -0.002 },
      { lat: -0.002, lng: -0.003 },
      { lat: -0.003, lng: 0.002 },
      { lat: 0.001, lng: -0.004 },
      { lat: 0.004, lng: 0.001 },
    ];
    
    setDemoBuoys(prev => prev.map((buoy, index) => ({
      ...buoy,
      lat: centerLat + (offsets[index]?.lat ?? 0.001 * (index + 1)),
      lng: centerLng + (offsets[index]?.lng ?? 0.001 * (index + 1)),
      state: "idle" as const,
      targetLat: null,
      targetLng: null,
      speed: 0,
      eta: null,
    })));
  }, []);

  const updateDemoWeather = useCallback((windSpeed: number, windDirection: number) => {
    setDemoBuoys(prev => prev.map(buoy => ({
      ...buoy,
      windSpeed: windSpeed + (Math.random() - 0.5) * 2,
      windDirection: windDirection + (Math.random() - 0.5) * 10,
    })));
  }, []);

  const repositionDemoBoats = useCallback((centerLat: number, centerLng: number) => {
    boatCenterRef.current = { lat: centerLat, lng: centerLng };
    setDemoBoats(createDemoBoatsNearPosition(centerLat, centerLng));
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
      demoSiblingBuoys: DEMO_SIBLING_BUOYS,
      demoBoats,
      sendCommand,
      resetDemoBuoys,
      repositionDemoBuoys,
      repositionDemoBoats,
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
