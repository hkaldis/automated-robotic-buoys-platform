import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ZoomIn, ZoomOut, RotateCcw, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Buoy, Mark, GeoPosition, MarkRole } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
}

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
      <div style="position:relative;width:40px;height:40px;">
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
  const isStart = mark.role === "start_boat" || mark.role === "pin";
  const isFinish = mark.role === "finish";
  
  let color = "#3b82f6";
  let shape = "circle";
  
  if (isStart) {
    color = "#22c55e";
    shape = "triangle";
  } else if (isFinish) {
    color = "#f97316";
    shape = "circle";
  }

  const ring = isSelected ? `border:3px solid #3b82f6;` : "";

  const shapeHtml = shape === "triangle" 
    ? `<div style="width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-bottom:20px solid ${color};${ring}"></div>`
    : `<div style="width:24px;height:24px;background:${color};border-radius:50%;${ring}"></div>`;

  return L.divIcon({
    className: "custom-mark-marker",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        ${shapeHtml}
        <span style="margin-top:4px;font-size:11px;font-weight:600;color:#1f2937;background:white;padding:1px 4px;border-radius:4px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${mark.name}</span>
      </div>
    `,
    iconSize: [60, 50],
    iconAnchor: [30, 12],
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
  const sortedMarks = useMemo(() => [...marks].sort((a, b) => a.order - b.order), [marks]);
  
  if (sortedMarks.length < 2) return null;
  
  const legs = [];
  for (let i = 0; i < sortedMarks.length - 1; i++) {
    const from = sortedMarks[i];
    const to = sortedMarks[i + 1];
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
  
  return <>{legs}</>;
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
}: LeafletMapProps) {
  const { formatDistance, formatBearing } = useSettings();
  const mapRef = useRef<L.Map | null>(null);

  const sortedMarks = useMemo(() => [...marks].sort((a, b) => a.order - b.order), [marks]);
  
  const coursePositions: [number, number][] = useMemo(() => {
    if (sortedMarks.length < 2) return [];
    const positions = sortedMarks.map(m => [m.lat, m.lng] as [number, number]);
    if (sortedMarks.length > 2) {
      positions.push([sortedMarks[0].lat, sortedMarks[0].lng]);
    }
    return positions;
  }, [sortedMarks]);

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

  return (
    <div className={cn("relative w-full h-full", className)} data-testid="leaflet-map">
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
        
        {sortedMarks.map((mark) => (
          <Marker
            key={mark.id}
            position={[mark.lat, mark.lng]}
            icon={createMarkIcon(mark, selectedMarkId === mark.id)}
            draggable={!isPlacingMark}
            eventHandlers={{
              click: () => onMarkClick?.(mark.id),
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onMarkDragEnd?.(mark.id, position.lat, position.lng);
              },
            }}
          />
        ))}
        
        {buoys.map((buoy) => (
          <Marker
            key={buoy.id}
            position={[buoy.lat, buoy.lng]}
            icon={createBuoyIcon(buoy, selectedBuoyId === buoy.id)}
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
      </div>

      {weatherData && (
        <Card className="absolute top-4 right-4 p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 text-blue-500"
              style={{ transform: `rotate(${(weatherData.windDirection + 180)}deg)` }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L8 10H16L12 2Z M10 10V22H14V10H10Z" />
              </svg>
            </div>
            <span className="text-sm font-mono">{weatherData.windDirection.toFixed(0)}°</span>
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
