import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, RotateCcw, LocateFixed, Compass, Navigation, Wind, CloudSun, Loader2, ArrowUp, Eye, EyeOff, PanelRightOpen, PanelRightClose, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MapLayerType } from "@/lib/services/settings-service";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Buoy, Mark, GeoPosition, MarkRole } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import type { PendingDeployment } from "@/hooks/use-buoy-follow";
import { cn } from "@/lib/utils";
import { calculateWindAngle, calculateStartLineWindAngle, formatWindRelative } from "@/lib/course-bearings";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  source: string;
}

type MapOrientation = "north" | "head-to-wind";

interface LeafletMapProps {
  buoys: Buoy[];
  marks: Mark[];
  selectedBuoyId: string | null;
  selectedMarkId?: string | null;
  weatherData?: WeatherData | null;
  onBuoyClick?: (buoyId: string) => void;
  onMarkClick?: (markId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkDragEnd?: (markId: string, lat: number, lng: number) => void;
  className?: string;
  isPlacingMark?: boolean;
  isContinuousPlacement?: boolean;
  onStopPlacement?: () => void;
  finishLinePreviewIds?: Set<string>;
  mapOrientation?: MapOrientation;
  onOrientationChange?: (orientation: MapOrientation) => void;
  onFetchWeatherAtLocation?: (lat: number, lng: number) => void;
  isWeatherLoading?: boolean;
  onAlignCourseToWind?: () => void;
  roundingSequence?: string[];
  showLabels?: boolean;
  onToggleLabels?: () => void;
  showWindArrows?: boolean;
  onToggleWindArrows?: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  lastMarkMove?: { markId: string; prevLat: number; prevLng: number; timestamp: number } | null;
  onUndoMarkMove?: () => void;
  onMapMoveEnd?: (lat: number, lng: number) => void;
  mapLayer?: MapLayerType;
  showSeaMarks?: boolean;
  pendingDeployments?: PendingDeployment[];
}

const MIKROLIMANO_CENTER: [number, number] = [37.9376, 23.6917];
const DEFAULT_CENTER: [number, number] = MIKROLIMANO_CENTER;
const DEFAULT_ZOOM = 15;

function calculateDistance(pos1: GeoPosition, pos2: GeoPosition): number {
  const EARTH_RADIUS_NM = 3440.065;
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(pos1: GeoPosition, pos2: GeoPosition): number {
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function calculateGatePositions(
  centerLat: number, 
  centerLng: number, 
  windDirection: number, 
  gateWidthMeters: number
): { port: GeoPosition; starboard: GeoPosition } {
  const perpendicularAngle = (windDirection + 90) % 360;
  const halfWidthDegrees = (gateWidthMeters / 2) / 111320;
  
  const portAngleRad = (perpendicularAngle + 180) * Math.PI / 180;
  const starboardAngleRad = perpendicularAngle * Math.PI / 180;
  
  const latCorrection = Math.cos(centerLat * Math.PI / 180);
  
  return {
    port: {
      lat: centerLat + halfWidthDegrees * Math.cos(portAngleRad),
      lng: centerLng + (halfWidthDegrees / latCorrection) * Math.sin(portAngleRad),
    },
    starboard: {
      lat: centerLat + halfWidthDegrees * Math.cos(starboardAngleRad),
      lng: centerLng + (halfWidthDegrees / latCorrection) * Math.sin(starboardAngleRad),
    },
  };
}

function createBuoyIcon(buoy: Buoy, isSelected: boolean): L.DivIcon {
  const stateColors: Record<string, string> = {
    idle: "#94a3b8",
    moving_to_target: "#3b82f6",
    holding_position: "#22c55e",
    station_keeping_degraded: "#eab308",
    unavailable: "#6b7280",
    maintenance: "#f97316",
    fault: "#ef4444",
  };
  const color = stateColors[buoy.state] || "#94a3b8";
  const initial = buoy.name.charAt(0).toUpperCase();
  const ring = isSelected ? `<div style="position:absolute;top:-4px;left:-4px;width:48px;height:48px;border:3px solid #3b82f6;border-radius:50%;"></div>` : "";

  return L.divIcon({
    className: "custom-buoy-marker",
    html: `
      <div style="position:relative;width:40px;height:40px;z-index:1000;pointer-events:auto;">
        ${ring}
        <div style="width:40px;height:40px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
          ${initial}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createMarkIcon(mark: Mark, isSelected: boolean): L.DivIcon {
  const roleColors: Record<string, string> = {
    start_boat: "#22c55e",
    pin: "#22c55e",
    windward: "#ef4444",
    wing: "#8b5cf6",
    leeward: "#3b82f6",
    gate: "#06b6d4",
    offset: "#f59e0b",
    finish: "#f97316",
    turning_mark: "#3b82f6",
    other: "#6b7280",
  };
  
  const isStart = mark.role === "start_boat" || mark.role === "pin";
  const isWindward = mark.role === "windward";
  const isWing = mark.role === "wing";
  
  const color = roleColors[mark.role] || "#3b82f6";
  const size = isSelected ? 1.2 : 1;
  const border = isSelected ? "3px solid #3b82f6" : "none";

  let shape: string;
  if (isStart) {
    const h = Math.round(20 * size);
    const w = Math.round(12 * size);
    shape = `<div style="width:0;height:0;border-left:${w}px solid transparent;border-right:${w}px solid transparent;border-bottom:${h}px solid ${color};"></div>`;
  } else if (isWindward || isWing) {
    const s = Math.round((isWindward ? 20 : 18) * size);
    shape = `<div style="width:${s}px;height:${s}px;background:${color};transform:rotate(45deg);border:${border};"></div>`;
  } else {
    const s = Math.round(24 * size);
    shape = `<div style="width:${s}px;height:${s}px;background:${color};border-radius:50%;border:${border};"></div>`;
  }

  return L.divIcon({
    className: "custom-mark-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      ${shape}
      <span style="margin-top:2px;font-size:11px;font-weight:600;color:#1f2937;background:white;padding:1px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;">${mark.name}</span>
    </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 20],
  });
}

function MapClickHandler({ onMapClick, isPlacingMark }: { onMapClick?: (lat: number, lng: number) => void; isPlacingMark?: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (!onMapClick) return;
    
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    
    map.on("click", handleClick);
    
    if (isPlacingMark) {
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
    
    return () => {
      map.off("click", handleClick);
      map.getContainer().style.cursor = "";
    };
  }, [map, onMapClick, isPlacingMark]);
  
  return null;
}

function MapMoveHandler({ onMapMoveEnd }: { onMapMoveEnd?: (lat: number, lng: number) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (!onMapMoveEnd) return;
    
    const handleMoveEnd = () => {
      const center = map.getCenter();
      onMapMoveEnd(center.lat, center.lng);
    };
    
    map.on("moveend", handleMoveEnd);
    
    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [map, onMapMoveEnd]);
  
  return null;
}

function TouchConfig() {
  const map = useMap();
  
  useEffect(() => {
    const m = map as L.Map & { 
      tap?: { enable?: () => void };
      options: L.MapOptions & { tapHoldDelay?: number; tapTolerance?: number };
    };
    m.options.tapHoldDelay = 250;
    m.options.tapTolerance = 15;
    if (m.tap?.enable) {
      m.tap.enable();
    }
  }, [map]);
  
  return null;
}

interface DraggableMarkerProps {
  mark: Mark;
  isSelected: boolean;
  isDraggable: boolean;
  onMarkClick?: (id: string) => void;
  onMarkDragEnd?: (id: string, lat: number, lng: number) => void;
}

function DraggableMarker({ mark, isSelected, isDraggable, onMarkClick, onMarkDragEnd }: DraggableMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    
    if (isDraggable && marker.dragging) {
      marker.dragging.enable();
    } else if (!isDraggable && marker.dragging) {
      marker.dragging.disable();
    }
  }, [isDraggable]);
  
  // Update icon when dragging state changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    
    const iconElement = marker.getElement();
    if (iconElement) {
      const markElement = iconElement.querySelector('.custom-mark-marker');
      if (markElement) {
        if (isDragging) {
          markElement.classList.add('dragging');
        } else {
          markElement.classList.remove('dragging');
        }
      }
    }
  }, [isDragging]);
  
  const icon = useMemo(() => createMarkIcon(mark, isSelected), [mark, isSelected]);
  
  return (
    <Marker
      ref={markerRef}
      position={[mark.lat, mark.lng]}
      icon={icon}
      draggable={isDraggable}
      zIndexOffset={2000}
      eventHandlers={{
        click: () => onMarkClick?.(mark.id),
        dragstart: () => setIsDragging(true),
        dragend: (e) => {
          setIsDragging(false);
          const position = e.target.getLatLng();
          onMarkDragEnd?.(mark.id, position.lat, position.lng);
        },
      }}
    />
  );
}

function createGateMarkIcon(mark: Mark, side: "port" | "starboard", isSelected: boolean): L.DivIcon {
  const color = "#f97316";
  const size = isSelected ? 1.2 : 1;
  const border = isSelected ? "3px solid #3b82f6" : "none";
  const s = Math.round(20 * size);
  const sideLabel = side === "port" ? "P" : "S";
  
  const shape = `<div style="width:${s}px;height:${s}px;background:${color};border-radius:50%;border:${border};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10px;">${sideLabel}</div>`;

  return L.divIcon({
    className: "custom-mark-marker",
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      ${shape}
      <span style="margin-top:2px;font-size:10px;font-weight:600;color:#1f2937;background:white;padding:1px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;">${mark.name}-${sideLabel}</span>
    </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 20],
  });
}

interface GateMarkersProps {
  mark: Mark;
  isSelected: boolean;
  isDraggable: boolean;
  windDirection: number;
  onMarkClick?: (id: string) => void;
  onMarkDragEnd?: (id: string, lat: number, lng: number) => void;
}

function GateMarkers({ mark, isSelected, isDraggable, windDirection, onMarkClick, onMarkDragEnd }: GateMarkersProps) {
  const gateWidthMeters = (mark.gateWidthBoatLengths ?? 8) * (mark.boatLengthMeters ?? 6);
  const positions = useMemo(
    () => calculateGatePositions(mark.lat, mark.lng, windDirection, gateWidthMeters),
    [mark.lat, mark.lng, windDirection, gateWidthMeters]
  );
  
  const portMarkerRef = useRef<L.Marker | null>(null);
  const starboardMarkerRef = useRef<L.Marker | null>(null);
  const [isDraggingPort, setIsDraggingPort] = useState(false);
  const [isDraggingStarboard, setIsDraggingStarboard] = useState(false);
  
  useEffect(() => {
    [portMarkerRef, starboardMarkerRef].forEach(ref => {
      const marker = ref.current;
      if (!marker) return;
      if (isDraggable && marker.dragging) {
        marker.dragging.enable();
      } else if (!isDraggable && marker.dragging) {
        marker.dragging.disable();
      }
    });
  }, [isDraggable]);
  
  const portIcon = useMemo(() => createGateMarkIcon(mark, "port", isSelected), [mark, isSelected]);
  const starboardIcon = useMemo(() => createGateMarkIcon(mark, "starboard", isSelected), [mark, isSelected]);
  
  const handleGateDragEnd = (side: "port" | "starboard", e: L.LeafletEvent) => {
    const target = e.target as L.Marker;
    const newPos = target.getLatLng();
    const otherPos = side === "port" ? positions.starboard : positions.port;
    const newCenter = {
      lat: (newPos.lat + otherPos.lat) / 2,
      lng: (newPos.lng + otherPos.lng) / 2,
    };
    onMarkDragEnd?.(mark.id, newCenter.lat, newCenter.lng);
  };
  
  return (
    <>
      <Polyline
        positions={[[positions.port.lat, positions.port.lng], [positions.starboard.lat, positions.starboard.lng]]}
        pathOptions={{ 
          color: "#f97316", 
          weight: 3, 
          opacity: 0.6,
          dashArray: "6, 4"
        }}
      />
      <Marker
        ref={portMarkerRef}
        position={[positions.port.lat, positions.port.lng]}
        icon={portIcon}
        draggable={isDraggable}
        zIndexOffset={2000}
        eventHandlers={{
          click: () => onMarkClick?.(mark.id),
          dragstart: () => setIsDraggingPort(true),
          dragend: (e) => {
            setIsDraggingPort(false);
            handleGateDragEnd("port", e);
          },
        }}
      />
      <Marker
        ref={starboardMarkerRef}
        position={[positions.starboard.lat, positions.starboard.lng]}
        icon={starboardIcon}
        draggable={isDraggable}
        zIndexOffset={2000}
        eventHandlers={{
          click: () => onMarkClick?.(mark.id),
          dragstart: () => setIsDraggingStarboard(true),
          dragend: (e) => {
            setIsDraggingStarboard(false);
            handleGateDragEnd("starboard", e);
          },
        }}
      />
    </>
  );
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

function MapResizeHandler({ showSidebar }: { showSidebar?: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    // Delay to allow CSS transition to complete
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 350);
    return () => clearTimeout(timer);
  }, [map, showSidebar]);
  
  return null;
}

function formatWindRelativeBearing(bearing: number, windDirection: number): string {
  const { signedRelative } = calculateWindAngle(bearing, windDirection);
  return formatWindRelative(signedRelative);
}

// For start/finish lines: show deviation from perpendicular to wind
function formatStartLineWindAngle(bearing: number, windDirection: number): string {
  const { signedRelative } = calculateStartLineWindAngle(bearing, windDirection);
  return formatWindRelative(signedRelative);
}

function LegLabels({ 
  marks, 
  formatDistance, 
  formatBearing,
  roundingSequence = [],
  windDirection,
  showWindRelative = false,
}: { 
  marks: Mark[]; 
  formatDistance: (nm: number) => string;
  formatBearing: (deg: number) => string;
  roundingSequence?: string[];
  windDirection?: number;
  showWindRelative?: boolean;
}) {
  // Separate marks by type
  const startLineMarks = marks.filter(m => m.isStartLine);
  const finishLineMarks = marks.filter(m => m.isFinishLine);
  
  // Calculate line centers
  const startLineCenter = startLineMarks.length >= 2 ? {
    lat: startLineMarks.reduce((sum, m) => sum + m.lat, 0) / startLineMarks.length,
    lng: startLineMarks.reduce((sum, m) => sum + m.lng, 0) / startLineMarks.length,
  } : null;
  
  const finishLineCenter = finishLineMarks.length >= 2 ? {
    lat: finishLineMarks.reduce((sum, m) => sum + m.lat, 0) / finishLineMarks.length,
    lng: finishLineMarks.reduce((sum, m) => sum + m.lng, 0) / finishLineMarks.length,
  } : null;
  
  // Check if finish line is the same as start line (reused marks)
  const isFinishSameAsStart = startLineMarks.length >= 2 && 
    finishLineMarks.length >= 2 &&
    startLineMarks.every(sm => finishLineMarks.some(fm => fm.id === sm.id));
  
  const legs = [];
  
  // Helper to get position for a sequence entry
  const getPositionForEntry = (entry: string): GeoPosition | null => {
    if (entry === "start" && startLineCenter) return startLineCenter;
    if (entry === "finish" && finishLineCenter) return finishLineCenter;
    const mark = marks.find(m => m.id === entry);
    return mark ? { lat: mark.lat, lng: mark.lng } : null;
  };
  
  // Helper to get label for a sequence entry
  const getLabelForEntry = (entry: string): string => {
    if (entry === "start") return "Start";
    if (entry === "finish") return "Finish";
    const mark = marks.find(m => m.id === entry);
    return mark?.name ?? entry;
  };
  
  // 1. Start line distance/bearing (between Pin End and Committee Boat)
  if (startLineMarks.length >= 2) {
    const [mark1, mark2] = startLineMarks;
    const midLat = (mark1.lat + mark2.lat) / 2;
    const midLng = (mark1.lng + mark2.lng) / 2;
    const distance = calculateDistance({ lat: mark1.lat, lng: mark1.lng }, { lat: mark2.lat, lng: mark2.lng });
    const bearing = calculateBearing({ lat: mark1.lat, lng: mark1.lng }, { lat: mark2.lat, lng: mark2.lng });
    
    legs.push(
      <CircleMarker
        key="leg-start-line"
        center={[midLat, midLng]}
        radius={0}
        pathOptions={{ opacity: 0 }}
      >
        <Tooltip permanent direction="top" className="leg-label-tooltip">
          <div className="text-xs font-mono bg-green-700/90 text-white px-2 py-1 rounded">
            <div className="text-[10px] opacity-80">Start Line</div>
            <div>{formatDistance(distance)}</div>
            {showWindRelative && windDirection !== undefined ? (
              <div className="text-amber-300">{formatStartLineWindAngle(bearing, windDirection)}</div>
            ) : (
              <div>{formatBearing(bearing)}</div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  // 2. Sequence-based leg labels (following rounding sequence)
  if (roundingSequence.length >= 2) {
    for (let i = 0; i < roundingSequence.length - 1; i++) {
      const fromEntry = roundingSequence[i];
      const toEntry = roundingSequence[i + 1];
      const fromPos = getPositionForEntry(fromEntry);
      const toPos = getPositionForEntry(toEntry);
      
      if (!fromPos || !toPos) continue;
      
      const midLat = (fromPos.lat + toPos.lat) / 2;
      const midLng = (fromPos.lng + toPos.lng) / 2;
      const distance = calculateDistance(fromPos, toPos);
      const bearing = calculateBearing(fromPos, toPos);
      
      const fromLabel = getLabelForEntry(fromEntry);
      const toLabel = getLabelForEntry(toEntry);
      
      legs.push(
        <CircleMarker
          key={`leg-seq-${i}`}
          center={[midLat, midLng]}
          radius={0}
          pathOptions={{ opacity: 0 }}
        >
          <Tooltip permanent direction="center" className="leg-label-tooltip">
            <div className="text-xs font-mono bg-black/80 text-white px-2 py-1 rounded">
              <div className="text-[10px] opacity-70 mb-0.5">{fromLabel} → {toLabel}</div>
              <div>{formatDistance(distance)}</div>
              {showWindRelative && windDirection !== undefined ? (
                <div className="text-amber-300">{formatWindRelativeBearing(bearing, windDirection)}</div>
              ) : (
                <div>{formatBearing(bearing)}</div>
              )}
            </div>
          </Tooltip>
        </CircleMarker>
      );
    }
  }
  
  // 3. Finish line distance/bearing (only if different from start line)
  if (finishLineMarks.length >= 2 && !isFinishSameAsStart) {
    const [mark1, mark2] = finishLineMarks;
    const midLat = (mark1.lat + mark2.lat) / 2;
    const midLng = (mark1.lng + mark2.lng) / 2;
    const distance = calculateDistance({ lat: mark1.lat, lng: mark1.lng }, { lat: mark2.lat, lng: mark2.lng });
    const bearing = calculateBearing({ lat: mark1.lat, lng: mark1.lng }, { lat: mark2.lat, lng: mark2.lng });
    
    legs.push(
      <CircleMarker
        key="leg-finish-line"
        center={[midLat, midLng]}
        radius={0}
        pathOptions={{ opacity: 0 }}
      >
        <Tooltip permanent direction="bottom" className="leg-label-tooltip">
          <div className="text-xs font-mono bg-red-700/90 text-white px-2 py-1 rounded">
            <div className="text-[10px] opacity-80">Finish Line</div>
            <div>{formatDistance(distance)}</div>
            {showWindRelative && windDirection !== undefined ? (
              <div className="text-amber-300">{formatStartLineWindAngle(bearing, windDirection)}</div>
            ) : (
              <div>{formatBearing(bearing)}</div>
            )}
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  return <>{legs}</>;
}

function WindArrowsLayer({ windDirection, windSpeed }: { windDirection: number; windSpeed: number }) {
  const map = useMap();
  const [arrows, setArrows] = useState<Array<{ lat: number; lng: number; key: string }>>([]);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());
  const { windArrowsMinZoom } = useSettings();

  useMapEvents({
    moveend: () => updateArrows(),
    zoomend: () => {
      setCurrentZoom(map.getZoom());
      updateArrows();
    },
  });

  const updateArrows = useCallback(() => {
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    const gridSize = zoom >= 16 ? 0.002 : zoom >= 14 ? 0.005 : zoom >= 12 ? 0.01 : 0.02;
    
    const newArrows: Array<{ lat: number; lng: number; key: string }> = [];
    
    const south = Math.floor(bounds.getSouth() / gridSize) * gridSize;
    const north = Math.ceil(bounds.getNorth() / gridSize) * gridSize;
    const west = Math.floor(bounds.getWest() / gridSize) * gridSize;
    const east = Math.ceil(bounds.getEast() / gridSize) * gridSize;
    
    for (let lat = south; lat <= north; lat += gridSize) {
      for (let lng = west; lng <= east; lng += gridSize) {
        newArrows.push({
          lat: lat + gridSize / 2,
          lng: lng + gridSize / 2,
          key: `${lat.toFixed(6)}-${lng.toFixed(6)}`,
        });
      }
    }
    
    setArrows(newArrows);
  }, [map]);

  useEffect(() => {
    updateArrows();
  }, [updateArrows]);

  if (currentZoom < windArrowsMinZoom) {
    return null;
  }

  const arrowSize = windSpeed >= 15 ? 28 : windSpeed >= 10 ? 24 : windSpeed >= 5 ? 20 : 16;
  const arrowColor = windSpeed >= 20 ? "#dc2626" : windSpeed >= 15 ? "#f97316" : windSpeed >= 10 ? "#3b82f6" : "#64748b";

  return (
    <>
      {arrows.map((arrow) => (
        <Marker
          key={arrow.key}
          position={[arrow.lat, arrow.lng]}
          icon={L.divIcon({
            className: "wind-arrow-marker",
            html: `
              <div style="
                width: ${arrowSize}px;
                height: ${arrowSize}px;
                transform: rotate(${windDirection + 180}deg);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.7;
              ">
                <svg viewBox="0 0 24 24" fill="${arrowColor}" width="${arrowSize}" height="${arrowSize}">
                  <path d="M12 2L8 10H11V22H13V10H16L12 2Z" />
                </svg>
              </div>
            `,
            iconSize: [arrowSize, arrowSize],
            iconAnchor: [arrowSize / 2, arrowSize / 2],
          })}
          interactive={false}
        />
      ))}
    </>
  );
}

export function LeafletMap({ 
  buoys, 
  marks, 
  selectedBuoyId, 
  selectedMarkId,
  weatherData, 
  onBuoyClick, 
  onMarkClick,
  onMapClick,
  onMarkDragEnd,
  className,
  isPlacingMark,
  isContinuousPlacement,
  onStopPlacement,
  finishLinePreviewIds,
  mapOrientation = "north",
  onOrientationChange,
  onFetchWeatherAtLocation,
  isWeatherLoading,
  onAlignCourseToWind,
  roundingSequence = [],
  showLabels = true,
  onToggleLabels,
  showWindArrows = true,
  onToggleWindArrows,
  showSidebar,
  onToggleSidebar,
  lastMarkMove,
  onUndoMarkMove,
  onMapMoveEnd,
  mapLayer = "osm",
  showSeaMarks = true,
  pendingDeployments = [],
}: LeafletMapProps) {
  const { formatDistance, formatBearing } = useSettings();
  const mapRef = useRef<L.Map | null>(null);
  const [showWindRelative, setShowWindRelative] = useState(false);

  const sortedMarks = useMemo(() => [...marks].sort((a, b) => a.order - b.order), [marks]);
  
  // Separate marks by type for course line
  const startLineMarks = useMemo(() => marks.filter(m => m.isStartLine), [marks]);
  const finishLineMarks = useMemo(() => marks.filter(m => m.isFinishLine), [marks]);
  const courseMarks = useMemo(() => marks.filter(m => m.isCourseMark === true).sort((a, b) => a.order - b.order), [marks]);
  
  // Calculate centers
  const startLineCenter = useMemo(() => startLineMarks.length >= 2 ? {
    lat: startLineMarks.reduce((sum, m) => sum + m.lat, 0) / startLineMarks.length,
    lng: startLineMarks.reduce((sum, m) => sum + m.lng, 0) / startLineMarks.length,
  } : null, [startLineMarks]);
  
  const finishLineCenter = useMemo(() => finishLineMarks.length >= 2 ? {
    lat: finishLineMarks.reduce((sum, m) => sum + m.lat, 0) / finishLineMarks.length,
    lng: finishLineMarks.reduce((sum, m) => sum + m.lng, 0) / finishLineMarks.length,
  } : null, [finishLineMarks]);
  
  // Course path based on rounding sequence (or fallback to simple sequential path)
  const coursePositions: [number, number][] = useMemo(() => {
    // If we have a rounding sequence, use it
    if (roundingSequence.length >= 2) {
      const positions: [number, number][] = [];
      
      roundingSequence.forEach(entry => {
        if (entry === "start" && startLineCenter) {
          positions.push([startLineCenter.lat, startLineCenter.lng]);
        } else if (entry === "finish" && finishLineCenter) {
          positions.push([finishLineCenter.lat, finishLineCenter.lng]);
        } else {
          const mark = marks.find(m => m.id === entry);
          if (mark) {
            positions.push([mark.lat, mark.lng]);
          }
        }
      });
      
      return positions;
    }
    
    // Fallback: simple sequential path (start → course marks → finish)
    const positions: [number, number][] = [];
    
    // Add start line center
    if (startLineCenter) {
      positions.push([startLineCenter.lat, startLineCenter.lng]);
    }
    
    // Add course marks
    courseMarks.forEach(m => {
      positions.push([m.lat, m.lng]);
    });
    
    // Add finish line center
    if (finishLineCenter && courseMarks.length > 0) {
      positions.push([finishLineCenter.lat, finishLineCenter.lng]);
    }
    
    return positions;
  }, [startLineCenter, finishLineCenter, courseMarks, roundingSequence, marks]);
  
  // Start line polyline (between Pin End and Committee Boat)
  const startLinePositions: [number, number][] = useMemo(() => {
    if (startLineMarks.length < 2) return [];
    return startLineMarks.map(m => [m.lat, m.lng] as [number, number]);
  }, [startLineMarks]);
  
  // Finish line polyline (between finish marks) - only if different from start
  const finishLinePositions: [number, number][] = useMemo(() => {
    if (finishLineMarks.length < 2) return [];
    const isFinishSameAsStart = startLineMarks.every(sm => finishLineMarks.some(fm => fm.id === sm.id));
    if (isFinishSameAsStart) return [];
    return finishLineMarks.map(m => [m.lat, m.lng] as [number, number]);
  }, [finishLineMarks, startLineMarks]);

  // Finish line PREVIEW polyline (during selection in SetupPanel)
  const finishLinePreviewPositions: [number, number][] = useMemo(() => {
    if (!finishLinePreviewIds || finishLinePreviewIds.size < 2) return [];
    const previewMarks = marks.filter(m => finishLinePreviewIds.has(m.id));
    if (previewMarks.length < 2) return [];
    return previewMarks.map(m => [m.lat, m.lng] as [number, number]);
  }, [finishLinePreviewIds, marks]);

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetView = () => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  
  const handleLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.setView(
          [position.coords.latitude, position.coords.longitude],
          DEFAULT_ZOOM
        );
      },
      (error) => {
        console.error("Geolocation error:", error);
      }
    );
  };

  const mapRotation = useMemo(() => {
    if (mapOrientation === "head-to-wind" && weatherData) {
      // Wind direction is where wind comes FROM (meteorological convention)
      // Head-to-wind: we want to look TOWARD where wind comes from (upwind)
      // To put the wind source direction at screen top, rotate by -windDirection
      // Example: Wind from 225° (SW) → rotate -225° → 225° now at top (facing SW)
      return -weatherData.windDirection;
    }
    return 0;
  }, [mapOrientation, weatherData]);

  const controlsRotation = -mapRotation;

  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)} data-testid="leaflet-map">
      <div 
        className="w-full h-full transition-transform duration-500 ease-out"
        style={{ 
          transform: `rotate(${mapRotation}deg)`,
          transformOrigin: "center center",
          width: mapRotation !== 0 ? "141.4%" : "100%",
          height: mapRotation !== 0 ? "141.4%" : "100%",
          marginLeft: mapRotation !== 0 ? "-20.7%" : "0",
          marginTop: mapRotation !== 0 ? "-20.7%" : "0",
        }}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          className="w-full h-full"
          ref={mapRef}
          zoomControl={false}
        >
        {mapLayer === "osm" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "osm_nolabels" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "light_voyager" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "light_positron" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "light_toner" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "satellite" && (
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        {mapLayer === "nautical" && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {mapLayer === "ocean" && (
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; GEBCO, NOAA, CHS, OSU, UNH, CSUMB'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
            maxZoom={13}
          />
        )}
        {showSeaMarks && (
          <TileLayer
            attribution='Map data: &copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors'
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            opacity={0.8}
          />
        )}
        
        <MapClickHandler onMapClick={onMapClick} isPlacingMark={isPlacingMark} />
        <MapMoveHandler onMapMoveEnd={onMapMoveEnd} />
        <TouchConfig />
        <MapResizeHandler showSidebar={showSidebar} />
        
        {/* Start line (solid green line between Pin End and Committee Boat) */}
        {startLinePositions.length >= 2 && (
          <Polyline
            positions={startLinePositions}
            pathOptions={{ 
              color: "#16a34a", 
              weight: 4, 
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Finish line (solid red line between finish marks) - only if different from start */}
        {finishLinePositions.length >= 2 && (
          <Polyline
            positions={finishLinePositions}
            pathOptions={{ 
              color: "#dc2626", 
              weight: 4, 
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Finish line PREVIEW (dashed red line during selection) */}
        {finishLinePreviewPositions.length >= 2 && (
          <Polyline
            positions={finishLinePreviewPositions}
            pathOptions={{ 
              color: "#dc2626", 
              weight: 4, 
              opacity: 0.6,
              dashArray: "8, 4",
            }}
          />
        )}
        
        {/* Course path (dashed blue line from start center → course marks → finish center) */}
        {coursePositions.length > 1 && (
          <Polyline
            positions={coursePositions}
            pathOptions={{ 
              color: "#3b82f6", 
              weight: 3, 
              opacity: 0.6,
              dashArray: "10, 5"
            }}
          />
        )}
        
        {showLabels !== false && (
          <LegLabels 
            marks={marks} 
            formatDistance={formatDistance} 
            formatBearing={formatBearing}
            roundingSequence={roundingSequence}
            windDirection={weatherData?.windDirection}
            showWindRelative={showWindRelative}
          />
        )}
        
        {showWindArrows && weatherData && (
          <WindArrowsLayer windDirection={weatherData.windDirection} windSpeed={weatherData.windSpeed} />
        )}
        
        {sortedMarks.map((mark) => 
          mark.isGate ? (
            <GateMarkers
              key={mark.id}
              mark={mark}
              isSelected={selectedMarkId === mark.id}
              isDraggable={!isPlacingMark}
              windDirection={weatherData?.windDirection ?? 225}
              onMarkClick={onMarkClick}
              onMarkDragEnd={onMarkDragEnd}
            />
          ) : (
            <DraggableMarker
              key={mark.id}
              mark={mark}
              isSelected={selectedMarkId === mark.id}
              isDraggable={!isPlacingMark}
              onMarkClick={onMarkClick}
              onMarkDragEnd={onMarkDragEnd}
            />
          )
        )}
        
        {buoys.map((buoy) => (
          <Marker
            key={buoy.id}
            position={[buoy.lat, buoy.lng]}
            icon={createBuoyIcon(buoy, selectedBuoyId === buoy.id)}
            zIndexOffset={1000}
            eventHandlers={{
              click: () => onBuoyClick?.(buoy.id),
            }}
          >
            {buoy.state === "moving_to_target" && buoy.targetLat && buoy.targetLng && (
              <Polyline
                positions={[[buoy.lat, buoy.lng], [buoy.targetLat, buoy.targetLng]]}
                pathOptions={{ 
                  color: "#3b82f6", 
                  weight: 2, 
                  opacity: 0.5,
                  dashArray: "5, 5"
                }}
              />
            )}
          </Marker>
        ))}
        
        {pendingDeployments.map((deployment) => (
          <Polyline
            key={`pending-${deployment.buoyId}`}
            positions={[[deployment.currentLat, deployment.currentLng], [deployment.targetLat, deployment.targetLng]]}
            pathOptions={{ 
              color: "#f59e0b",
              weight: 3, 
              opacity: 0.7,
              dashArray: "8, 8"
            }}
          />
        ))}
      </MapContainer>
      </div>

      <div className="absolute top-4 left-4 flex flex-col gap-2 z-[1000]">
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} data-testid="button-zoom-in">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </Card>
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} data-testid="button-zoom-out">
            <ZoomOut className="w-4 h-4" />
          </Button>
        </Card>
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={handleResetView} data-testid="button-reset-view">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </Card>
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={handleLocate} data-testid="button-locate">
            <LocateFixed className="w-4 h-4" />
          </Button>
        </Card>
        
        <div className="h-2" />
        
        <UITooltip>
          <TooltipTrigger asChild>
            <Card className="p-1">
              <Button 
                variant={showWindRelative ? "default" : "ghost"} 
                size="icon" 
                onClick={() => setShowWindRelative(!showWindRelative)}
                disabled={!weatherData || roundingSequence.length < 2}
                data-testid="button-toggle-wind-relative"
              >
                <Navigation className="w-4 h-4" />
              </Button>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right">
            {showWindRelative ? "Show True Bearings" : "Show Wind-Relative Bearings"}
          </TooltipContent>
        </UITooltip>
        
        {onToggleLabels && (
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="p-1">
                <Button 
                  variant={showLabels ? "default" : "ghost"} 
                  size="icon" 
                  onClick={onToggleLabels}
                  data-testid="button-toggle-labels"
                >
                  {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </Button>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="right">
              {showLabels ? "Hide Distance/Bearing Labels" : "Show Distance/Bearing Labels"}
            </TooltipContent>
          </UITooltip>
        )}
        
        {onToggleSidebar && (
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="p-1 hidden lg:block">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggleSidebar}
                  data-testid="button-toggle-sidebar"
                >
                  {showSidebar ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </Button>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="right">
              {showSidebar ? "Hide Panel" : "Show Panel"}
            </TooltipContent>
          </UITooltip>
        )}
      </div>


      {isPlacingMark && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <Card className="px-4 py-2 bg-primary text-primary-foreground flex items-center gap-3">
            <span className="text-sm font-medium">
              {isContinuousPlacement 
                ? "Click to add points. Click 'Done' when finished."
                : "Click on the map to place the point"}
            </span>
            {isContinuousPlacement && onStopPlacement && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onStopPlacement();
                }}
                data-testid="button-stop-placement"
              >
                Done
              </Button>
            )}
          </Card>
        </div>
      )}

      {lastMarkMove && onUndoMarkMove && (Date.now() - lastMarkMove.timestamp) < 30000 && (
        <div className="absolute bottom-4 right-4 z-[500]">
          <Button 
            variant="secondary" 
            size="lg"
            className="gap-2 shadow-lg"
            onClick={onUndoMarkMove}
            data-testid="button-undo-mark-move"
          >
            <Undo2 className="w-5 h-5" />
            Undo Move
          </Button>
        </div>
      )}
    </div>
  );
}
