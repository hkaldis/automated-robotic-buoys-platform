import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker, Tooltip, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, RotateCcw, LocateFixed, Compass, Navigation, Wind, CloudSun, Loader2, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Buoy, Mark, GeoPosition, MarkRole } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

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
  // Mark role color coding per World Sailing standards
  const roleColors: Record<string, string> = {
    start_boat: "#22c55e",    // Green - Committee boat
    pin: "#22c55e",           // Green - Pin end
    windward: "#ef4444",      // Red - Mark 1 (windward)
    wing: "#8b5cf6",          // Purple - Mark 2 (wing/gybe)
    leeward: "#3b82f6",       // Blue - Mark 3 (leeward)
    gate: "#06b6d4",          // Cyan - Gate marks (3s/3p)
    offset: "#f59e0b",        // Amber - Offset mark
    finish: "#f97316",        // Orange - Finish
    turning_mark: "#3b82f6",  // Blue - Generic turning mark
    other: "#6b7280",         // Gray - Other marks
  };
  
  // Visual shape by role
  const isStart = mark.role === "start_boat" || mark.role === "pin";
  const isWindward = mark.role === "windward";
  const isWing = mark.role === "wing";
  
  const color = roleColors[mark.role] || "#3b82f6";
  const ring = isSelected ? `border:3px solid #3b82f6;` : "";
  const scale = isSelected ? "transform:scale(1.15);" : "";

  let shapeHtml: string;
  
  if (isStart) {
    // Triangle for start line marks (pointing up)
    shapeHtml = `<div style="width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:20px solid ${color};${ring}${scale}"></div>`;
  } else if (isWindward) {
    // Diamond for windward mark (most important mark)
    shapeHtml = `<div style="width:20px;height:20px;background:${color};transform:rotate(45deg)${isSelected ? ' scale(1.15)' : ''};${ring}"></div>`;
  } else if (isWing) {
    // Diamond for wing mark (similar importance to windward)
    shapeHtml = `<div style="width:18px;height:18px;background:${color};transform:rotate(45deg)${isSelected ? ' scale(1.15)' : ''};${ring}"></div>`;
  } else {
    // Circle for other marks (leeward, gate, offset, finish)
    shapeHtml = `<div style="width:24px;height:24px;background:${color};border-radius:50%;${ring}${scale}"></div>`;
  }

  // Leaflet handles pointer events on the marker icon automatically
  // Keep the structure simple to let Leaflet's dragging work properly
  return L.divIcon({
    className: "custom-mark-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:grab;">
        <div style="padding:8px;">
          ${shapeHtml}
        </div>
        <span style="font-size:11px;font-weight:600;color:#1f2937;background:white;padding:1px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;">${mark.name}</span>
      </div>
    `,
    iconSize: [60, 60],
    iconAnchor: [30, 28],
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

function TouchOptimizer() {
  const map = useMap();

  useEffect(() => {
    const mapInstance = map as L.Map & { 
      tap?: { _holdTimeout?: number; enable?: () => void };
      options: L.MapOptions & { tapHoldDelay?: number; tapTolerance?: number };
    };
    
    // Configure touch options on the map
    mapInstance.options.tapHoldDelay = 300; // Reduce from default 500ms
    mapInstance.options.tapTolerance = 15;
    
    // Enable touch support if available
    if (mapInstance.tap && typeof mapInstance.tap.enable === 'function') {
      mapInstance.tap.enable();
    }
  }, [map]);

  return null;
}

interface DraggableMarkMarkerProps {
  mark: Mark;
  isSelected: boolean;
  isDraggable: boolean;
  onMarkClick?: (id: string) => void;
  onMarkDragEnd?: (id: string, lat: number, lng: number) => void;
}

function DraggableMarkMarker({ mark, isSelected, isDraggable, onMarkClick, onMarkDragEnd }: DraggableMarkMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastDragPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fallback: if drag events stop but no dragend, finalize after timeout
  const scheduleDragFallback = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    dragTimeoutRef.current = setTimeout(() => {
      if (lastDragPositionRef.current && isDragging) {
        console.log('Mark drag fallback:', mark.id, lastDragPositionRef.current.lat, lastDragPositionRef.current.lng);
        onMarkDragEnd?.(mark.id, lastDragPositionRef.current.lat, lastDragPositionRef.current.lng);
        setIsDragging(false);
        lastDragPositionRef.current = null;
      }
    }, 500);
  }, [mark.id, onMarkDragEnd, isDragging]);
  
  const eventHandlers = useMemo(() => ({
    click: () => {
      // Only trigger click if not in the middle of a drag
      if (!isDragging) {
        onMarkClick?.(mark.id);
      }
    },
    dragstart: () => {
      setIsDragging(true);
      lastDragPositionRef.current = null;
    },
    drag: (e: L.LeafletEvent) => {
      const marker = e.target as L.Marker;
      const position = marker.getLatLng();
      lastDragPositionRef.current = { lat: position.lat, lng: position.lng };
    },
    dragend: (e: L.DragEndEvent) => {
      // Clear any fallback timeout since we got proper dragend
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      const marker = e.target as L.Marker;
      const position = marker.getLatLng();
      onMarkDragEnd?.(mark.id, position.lat, position.lng);
      lastDragPositionRef.current = null;
      // Reset dragging state after a short delay to prevent click from firing
      setTimeout(() => setIsDragging(false), 100);
    },
  }), [mark.id, onMarkClick, onMarkDragEnd, isDragging]);

  // Setup fallback listener on marker for pointerup/touchend
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !isDragging) return;
    
    const handlePointerUp = () => {
      scheduleDragFallback();
    };
    
    // Listen on document for pointer/mouse up as fallback
    document.addEventListener('pointerup', handlePointerUp, { once: true });
    document.addEventListener('mouseup', handlePointerUp, { once: true });
    document.addEventListener('touchend', handlePointerUp, { once: true });
    
    return () => {
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [isDragging, scheduleDragFallback]);
  
  // Create icon with dragging state visual feedback
  const icon = useMemo(() => {
    return createMarkIcon(mark, isSelected || isDragging);
  }, [mark, isSelected, isDragging]);
  
  return (
    <Marker
      ref={markerRef}
      position={[mark.lat, mark.lng]}
      icon={icon}
      draggable={isDraggable}
      autoPan={true}
      bubblingMouseEvents={false}
      eventHandlers={eventHandlers}
    />
  );
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

function LegLabels({ marks, formatDistance, formatBearing }: { 
  marks: Mark[]; 
  formatDistance: (nm: number) => string;
  formatBearing: (deg: number) => string;
}) {
  // Separate marks by type
  const startLineMarks = marks.filter(m => m.isStartLine);
  const finishLineMarks = marks.filter(m => m.isFinishLine);
  const courseMarks = marks.filter(m => m.isCourseMark === true).sort((a, b) => a.order - b.order);
  
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
            <div>{formatBearing(bearing)}</div>
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  // 2. Leg from start line center to first course mark (M1)
  if (startLineCenter && courseMarks.length > 0) {
    const firstMark = courseMarks[0];
    const midLat = (startLineCenter.lat + firstMark.lat) / 2;
    const midLng = (startLineCenter.lng + firstMark.lng) / 2;
    const distance = calculateDistance(startLineCenter, { lat: firstMark.lat, lng: firstMark.lng });
    const bearing = calculateBearing(startLineCenter, { lat: firstMark.lat, lng: firstMark.lng });
    
    legs.push(
      <CircleMarker
        key="leg-start-m1"
        center={[midLat, midLng]}
        radius={0}
        pathOptions={{ opacity: 0 }}
      >
        <Tooltip permanent direction="center" className="leg-label-tooltip">
          <div className="text-xs font-mono bg-black/80 text-white px-2 py-1 rounded">
            <div>{formatDistance(distance)}</div>
            <div>{formatBearing(bearing)}</div>
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  // 3. Legs between course marks (M1 to M2, M2 to M3, etc.)
  for (let i = 0; i < courseMarks.length - 1; i++) {
    const from = courseMarks[i];
    const to = courseMarks[i + 1];
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const distance = calculateDistance({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
    const bearing = calculateBearing({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
    
    legs.push(
      <CircleMarker
        key={`leg-${i}`}
        center={[midLat, midLng]}
        radius={0}
        pathOptions={{ opacity: 0 }}
      >
        <Tooltip permanent direction="center" className="leg-label-tooltip">
          <div className="text-xs font-mono bg-black/80 text-white px-2 py-1 rounded">
            <div>{formatDistance(distance)}</div>
            <div>{formatBearing(bearing)}</div>
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  // 4. Leg from last course mark to finish line center
  if (finishLineCenter && courseMarks.length > 0) {
    const lastMark = courseMarks[courseMarks.length - 1];
    const midLat = (lastMark.lat + finishLineCenter.lat) / 2;
    const midLng = (lastMark.lng + finishLineCenter.lng) / 2;
    const distance = calculateDistance({ lat: lastMark.lat, lng: lastMark.lng }, finishLineCenter);
    const bearing = calculateBearing({ lat: lastMark.lat, lng: lastMark.lng }, finishLineCenter);
    
    legs.push(
      <CircleMarker
        key="leg-last-finish"
        center={[midLat, midLng]}
        radius={0}
        pathOptions={{ opacity: 0 }}
      >
        <Tooltip permanent direction="center" className="leg-label-tooltip">
          <div className="text-xs font-mono bg-black/80 text-white px-2 py-1 rounded">
            <div>{formatDistance(distance)}</div>
            <div>{formatBearing(bearing)}</div>
          </div>
        </Tooltip>
      </CircleMarker>
    );
  }
  
  // 5. Finish line distance/bearing (only if different from start line)
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
            <div>{formatBearing(bearing)}</div>
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

  useMapEvents({
    moveend: () => updateArrows(),
    zoomend: () => updateArrows(),
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
}: LeafletMapProps) {
  const { formatDistance, formatBearing } = useSettings();
  const mapRef = useRef<L.Map | null>(null);
  const [showWindArrows, setShowWindArrows] = useState(false);

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
  
  // Course path: start center → course marks → finish center
  const coursePositions: [number, number][] = useMemo(() => {
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
  }, [startLineCenter, finishLineCenter, courseMarks]);
  
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors'
          url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
          opacity={0.8}
        />
        
        <MapClickHandler onMapClick={onMapClick} isPlacingMark={isPlacingMark} />
        <TouchOptimizer />
        
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
        
        <LegLabels marks={marks} formatDistance={formatDistance} formatBearing={formatBearing} />
        
        {showWindArrows && weatherData && (
          <WindArrowsLayer windDirection={weatherData.windDirection} windSpeed={weatherData.windSpeed} />
        )}
        
        {sortedMarks.map((mark) => (
          <DraggableMarkMarker
            key={mark.id}
            mark={mark}
            isSelected={selectedMarkId === mark.id}
            isDraggable={!isPlacingMark}
            onMarkClick={onMarkClick}
            onMarkDragEnd={onMarkDragEnd}
          />
        ))}
        
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
                variant={mapOrientation === "north" ? "default" : "ghost"} 
                size="icon" 
                onClick={() => onOrientationChange?.("north")}
                data-testid="button-orient-north"
              >
                <Compass className="w-4 h-4" />
              </Button>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right">North Up</TooltipContent>
        </UITooltip>
        
        <UITooltip>
          <TooltipTrigger asChild>
            <Card className="p-1">
              <Button 
                variant={mapOrientation === "head-to-wind" ? "default" : "ghost"} 
                size="icon" 
                onClick={() => onOrientationChange?.("head-to-wind")}
                disabled={!weatherData}
                data-testid="button-orient-wind"
              >
                <Navigation className="w-4 h-4" style={{ transform: mapOrientation === "head-to-wind" ? "rotate(0deg)" : `rotate(${weatherData?.windDirection ?? 0}deg)` }} />
              </Button>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right">Head to Wind</TooltipContent>
        </UITooltip>
        
        <div className="h-2" />
        
        <UITooltip>
          <TooltipTrigger asChild>
            <Card className="p-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const center = mapRef.current?.getCenter();
                  if (center && onFetchWeatherAtLocation) {
                    onFetchWeatherAtLocation(center.lat, center.lng);
                  }
                }}
                disabled={isWeatherLoading}
                data-testid="button-fetch-weather"
              >
                {isWeatherLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudSun className="w-4 h-4" />
                )}
              </Button>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right">Fetch Weather at Map Center</TooltipContent>
        </UITooltip>
        
        {marks.length > 0 && onAlignCourseToWind && (
          <UITooltip>
            <TooltipTrigger asChild>
              <Card className="p-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onAlignCourseToWind}
                  disabled={!weatherData}
                  data-testid="button-align-course-wind"
                >
                  <Wind className="w-4 h-4" />
                </Button>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="right">Align Course to Wind</TooltipContent>
          </UITooltip>
        )}
        
        <UITooltip>
          <TooltipTrigger asChild>
            <Card className="p-1">
              <Button 
                variant={showWindArrows ? "default" : "ghost"} 
                size="icon" 
                onClick={() => setShowWindArrows(!showWindArrows)}
                disabled={!weatherData}
                data-testid="button-toggle-wind-arrows"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="right">
            {showWindArrows ? "Hide Wind Arrows" : "Show Wind Arrows"}
          </TooltipContent>
        </UITooltip>
      </div>

      {weatherData && (
        <Card className="absolute top-4 right-4 p-3 z-[1000]" data-testid="map-wind-badge">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-chart-1 shrink-0" />
              <div 
                className="w-5 h-5 text-chart-1"
                style={{ transform: `rotate(${(weatherData.windDirection + 180)}deg)` }}
                title={`Wind blows toward ${((weatherData.windDirection + 180) % 360).toFixed(0)}°`}
              >
                <ArrowUp className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">from </span>
                <span className="font-mono">{weatherData.windDirection.toFixed(0)}°</span>
                <span className="text-muted-foreground ml-1">@ {weatherData.windSpeed.toFixed(1)} kts</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {mapOrientation === "head-to-wind" && (
                <Badge variant="secondary" className="text-xs">Head to Wind</Badge>
              )}
              {showWindArrows && (
                <Badge variant="outline" className="text-xs">Arrows On</Badge>
              )}
              <Badge variant="outline" className="text-xs capitalize">{weatherData.source}</Badge>
            </div>
          </div>
        </Card>
      )}

      {isPlacingMark && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
          <Card className="px-4 py-2 bg-primary text-primary-foreground flex items-center gap-3">
            <span className="text-sm font-medium">
              {isContinuousPlacement 
                ? "Click to add marks. Click 'Done' when finished."
                : "Click on the map to place the mark"}
            </span>
            {isContinuousPlacement && onStopPlacement && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onStopPlacement}
                data-testid="button-stop-placement"
              >
                Done
              </Button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
