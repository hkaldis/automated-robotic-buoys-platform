import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Buoy, Mark, GeoPosition, BuoyState, MarkRole } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
}

interface MapViewProps {
  buoys: Buoy[];
  marks: Mark[];
  selectedBuoyId: string | null;
  weatherData?: WeatherData | null;
  onBuoyClick?: (buoyId: string) => void;
  onMarkClick?: (markId: string) => void;
  className?: string;
}

const DEFAULT_CENTER = { lat: 37.8044, lng: -122.2712 };
const DEFAULT_ZOOM = 14;

function calculateDistance(pos1: GeoPosition, pos2: GeoPosition): number {
  const EARTH_RADIUS_NM = 3440.065;
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

function calculateBearing(pos1: GeoPosition, pos2: GeoPosition): number {
  const lat1 = pos1.lat * Math.PI / 180;
  const lat2 = pos2.lat * Math.PI / 180;
  const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

export function MapView({ buoys, marks, selectedBuoyId, weatherData, onBuoyClick, onMarkClick, className }: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewState, setViewState] = useState({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    rotation: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const { formatDistance, formatBearing } = useSettings();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const latLngToPixel = useCallback((pos: GeoPosition): { x: number; y: number } => {
    const scale = Math.pow(2, viewState.zoom) * 256;
    const worldX = ((pos.lng + 180) / 360) * scale;
    const latRad = pos.lat * Math.PI / 180;
    const worldY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

    const centerWorldX = ((viewState.center.lng + 180) / 360) * scale;
    const centerLatRad = viewState.center.lat * Math.PI / 180;
    const centerWorldY = ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * scale;

    return {
      x: dimensions.width / 2 + (worldX - centerWorldX),
      y: dimensions.height / 2 + (worldY - centerWorldY),
    };
  }, [viewState, dimensions]);

  const pixelToLatLng = useCallback((x: number, y: number): GeoPosition => {
    const scale = Math.pow(2, viewState.zoom) * 256;
    const centerWorldX = ((viewState.center.lng + 180) / 360) * scale;
    const centerLatRad = viewState.center.lat * Math.PI / 180;
    const centerWorldY = ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * scale;

    const worldX = centerWorldX + (x - dimensions.width / 2);
    const worldY = centerWorldY + (y - dimensions.height / 2);

    const lng = (worldX / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * worldY) / scale;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    return { lat, lng };
  }, [viewState, dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || dimensions.width === 0) return;

    canvas.width = dimensions.width * window.devicePixelRatio;
    canvas.height = dimensions.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const isDark = document.documentElement.classList.contains("dark");
    ctx.fillStyle = isDark ? "#1a1f2e" : "#e8eef4";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.strokeStyle = isDark ? "rgba(100, 150, 200, 0.08)" : "rgba(100, 150, 200, 0.1)";
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < dimensions.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dimensions.height);
      ctx.stroke();
    }
    for (let y = 0; y < dimensions.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.width, y);
      ctx.stroke();
    }

    const sortedMarks = [...marks].sort((a, b) => a.order - b.order);
    
    if (sortedMarks.length > 0) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();

      sortedMarks.forEach((mark, i) => {
        const pos = latLngToPixel({ lat: mark.lat, lng: mark.lng });
        if (i === 0) {
          ctx.moveTo(pos.x, pos.y);
        } else {
          ctx.lineTo(pos.x, pos.y);
        }
      });

      if (sortedMarks.length > 2) {
        const firstPos = latLngToPixel({ lat: sortedMarks[0].lat, lng: sortedMarks[0].lng });
        ctx.lineTo(firstPos.x, firstPos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < sortedMarks.length - 1; i++) {
        const from = sortedMarks[i];
        const to = sortedMarks[i + 1];
        const fromPos = latLngToPixel({ lat: from.lat, lng: from.lng });
        const toPos = latLngToPixel({ lat: to.lat, lng: to.lng });
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        const distance = calculateDistance({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });
        const bearing = calculateBearing({ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng });

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(midX - 40, midY - 12, 80, 24, 4);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "11px JetBrains Mono, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(formatDistance(distance), midX, midY - 4);
        ctx.fillText(formatBearing(bearing), midX, midY + 8);
      }
    }

    sortedMarks.forEach((mark) => {
      const pos = latLngToPixel({ lat: mark.lat, lng: mark.lng });
      const isStart = mark.role === "start_boat" || mark.role === "pin";
      const isFinish = mark.role === "finish";
      const size = 16;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (isStart) {
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.8, size * 0.5);
        ctx.lineTo(-size * 0.8, size * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (isFinish) {
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(mark.name, 0, size + 4);

      ctx.restore();
    });

    buoys.forEach((buoy) => {
      const pos = latLngToPixel({ lat: buoy.lat, lng: buoy.lng });
      const isSelected = selectedBuoyId === buoy.id;
      const size = 20;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (isSelected) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      const stateColors: Record<string, string> = {
        idle: "#94a3b8",
        moving_to_target: "#3b82f6",
        holding_position: "#22c55e",
        station_keeping_degraded: "#eab308",
        unavailable: "#6b7280",
        maintenance: "#f97316",
        fault: "#ef4444",
      };
      ctx.fillStyle = stateColors[buoy.state] || "#94a3b8";

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const initial = buoy.name.charAt(0).toUpperCase();
      ctx.fillText(initial, 0, 0);

      if (buoy.state === "moving_to_target" && buoy.targetLat && buoy.targetLng) {
        const targetPos = latLngToPixel({ lat: buoy.targetLat, lng: buoy.targetLng });
        ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(targetPos.x - pos.x, targetPos.y - pos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });

    if (weatherData) {
      const windDir = weatherData.windDirection;
      ctx.save();
      ctx.translate(dimensions.width - 60, 60);
      ctx.rotate((windDir + 180) * Math.PI / 180);
      
      ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(8, 15);
      ctx.lineTo(0, 10);
      ctx.lineTo(-8, 15);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    }

  }, [dimensions, buoys, marks, selectedBuoyId, weatherData, viewState, latLngToPixel, formatDistance, formatBearing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const newCenter = pixelToLatLng(
      dimensions.width / 2 - dx,
      dimensions.height / 2 - dy
    );

    setViewState(prev => ({ ...prev, center: newCenter }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (const buoy of buoys) {
      const pos = latLngToPixel({ lat: buoy.lat, lng: buoy.lng });
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist < 25) {
        onBuoyClick?.(buoy.id);
        return;
      }
    }

    for (const mark of marks) {
      const pos = latLngToPixel({ lat: mark.lat, lng: mark.lng });
      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist < 25) {
        onMarkClick?.(mark.id);
        return;
      }
    }

    onBuoyClick?.("");
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(10, Math.min(20, prev.zoom + delta)),
    }));
  };

  const zoomIn = () => setViewState(prev => ({ ...prev, zoom: Math.min(20, prev.zoom + 1) }));
  const zoomOut = () => setViewState(prev => ({ ...prev, zoom: Math.max(10, prev.zoom - 1) }));
  const resetView = () => setViewState({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, rotation: 0 });

  return (
    <div 
      ref={containerRef} 
      className={cn("relative w-full h-full overflow-hidden", className)}
      data-testid="map-view"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ width: "100%", height: "100%" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={zoomIn} data-testid="button-zoom-in">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </Card>
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} data-testid="button-zoom-out">
            <ZoomOut className="w-4 h-4" />
          </Button>
        </Card>
        <Card className="p-1">
          <Button variant="ghost" size="icon" onClick={resetView} data-testid="button-reset-view">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </Card>
      </div>

      <Card className="absolute bottom-4 left-4 px-3 py-2 text-xs font-mono text-muted-foreground">
        {viewState.center.lat.toFixed(4)}°, {viewState.center.lng.toFixed(4)}° | Zoom: {viewState.zoom.toFixed(1)}
      </Card>
    </div>
  );
}
