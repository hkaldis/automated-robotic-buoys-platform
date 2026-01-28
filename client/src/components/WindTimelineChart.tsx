import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Wind, ChevronDown, Navigation } from "lucide-react";
import type { Buoy, BuoyWeatherHistory } from "@shared/schema";

interface WindTimelineChartProps {
  historyData: BuoyWeatherHistory[];
  buoys: Buoy[];
  selectedBuoyId: string | null;
  onBuoySelect: (buoyId: string | null) => void;
  isLoading?: boolean;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  speed: number;
  avgSpeed: number | null;
  gustSpeed: number | null;
  direction: number;
  avgDirection: number | null;
  buoyId: string;
  buoyName: string;
}

function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

function DirectionArrow({ degrees, size = 20 }: { degrees: number; size?: number }) {
  const normalized = ((degrees % 360) + 360) % 360;
  const blowingToward = (normalized + 180) % 360;
  
  return (
    <div 
      className="inline-flex items-center justify-center text-primary"
      style={{ 
        width: size, 
        height: size,
        transform: `rotate(${blowingToward}deg)`,
      }}
      role="img"
      aria-label={`Wind from ${normalized.toFixed(0)}° ${getCardinalDirection(normalized)}`}
      data-rotation={blowingToward}
    >
      <Navigation 
        className="w-full h-full drop-shadow-sm" 
        fill="currentColor"
        strokeWidth={1}
      />
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0]?.payload;
  if (!data) return null;
  
  const direction = data.avgDirection ?? data.direction;
  const cardinal = getCardinalDirection(direction);
  
  return (
    <div 
      className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm"
      data-testid="tooltip-wind-timeline"
    >
      <div className="font-semibold mb-2 text-base">{label}</div>
      <div className="flex items-center gap-3 mb-2 pb-2 border-b">
        <DirectionArrow degrees={direction} size={24} />
        <div>
          <span className="font-bold text-lg">{direction.toFixed(0)}°</span>
          <span className="text-muted-foreground ml-2">{cardinal}</span>
        </div>
      </div>
      <div className="space-y-1 text-muted-foreground">
        {data.speed !== undefined && (
          <div className="flex justify-between gap-4">
            <span>Speed:</span>
            <span className="text-foreground font-semibold">{data.speed.toFixed(1)} kts</span>
          </div>
        )}
        {data.avgSpeed !== null && (
          <div className="flex justify-between gap-4">
            <span>Avg (5m):</span>
            <span className="text-foreground">{data.avgSpeed.toFixed(1)} kts</span>
          </div>
        )}
        {data.gustSpeed !== null && (
          <div className="flex justify-between gap-4">
            <span>Gust:</span>
            <span className="text-orange-500 font-semibold">{data.gustSpeed.toFixed(1)} kts</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WindTimelineChart({
  historyData,
  buoys,
  selectedBuoyId,
  onBuoySelect,
  isLoading = false,
}: WindTimelineChartProps) {
  const buoyMap = useMemo(() => {
    const map = new Map<string, string>();
    buoys.forEach(b => map.set(b.id, b.name));
    return map;
  }, [buoys]);

  const buoyIdsInHistory = useMemo(() => {
    return new Set(historyData.map(h => h.buoyId));
  }, [historyData]);

  const availableBuoys = useMemo(() => {
    if (buoyIdsInHistory.size > 0) {
      const matched = buoys.filter(b => buoyIdsInHistory.has(b.id));
      if (matched.length > 0) {
        return matched;
      }
      return Array.from(buoyIdsInHistory).map(id => ({
        id,
        name: buoyMap.get(id) || id.replace(/^demo-/, 'Buoy '),
      }));
    }
    if (buoys.length > 0) {
      return buoys.map(b => ({ id: b.id, name: b.name }));
    }
    return [];
  }, [buoyIdsInHistory, buoys, buoyMap]);

  const filteredData = useMemo(() => {
    if (!historyData.length) return [];
    
    let processedData: ChartDataPoint[];
    
    if (selectedBuoyId) {
      const data = historyData.filter(h => h.buoyId === selectedBuoyId);
      processedData = data
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(h => ({
          time: new Date(h.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          }),
          timestamp: new Date(h.timestamp).getTime(),
          speed: h.windSpeed,
          avgSpeed: h.rollingAvgSpeed,
          gustSpeed: h.gustSpeed,
          direction: h.windDirection,
          avgDirection: h.rollingAvgDirection,
          buoyId: h.buoyId,
          buoyName: buoyMap.get(h.buoyId) || 'Unknown',
        }));
    } else {
      const timeGroups = new Map<string, BuoyWeatherHistory[]>();
      
      historyData.forEach(h => {
        const date = new Date(h.timestamp);
        date.setSeconds(0, 0);
        const key = date.toISOString();
        if (!timeGroups.has(key)) {
          timeGroups.set(key, []);
        }
        timeGroups.get(key)!.push(h);
      });
      
      const aggregated: ChartDataPoint[] = [];
      Array.from(timeGroups.entries())
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .forEach(([timeKey, readings]) => {
          const timestamp = new Date(timeKey).getTime();
          const avgSpeed = readings.reduce((sum, r) => sum + r.windSpeed, 0) / readings.length;
          const avgRollingSpeed = readings.filter(r => r.rollingAvgSpeed !== null).length > 0
            ? readings.filter(r => r.rollingAvgSpeed !== null).reduce((sum, r) => sum + (r.rollingAvgSpeed ?? 0), 0) / readings.filter(r => r.rollingAvgSpeed !== null).length
            : null;
          const gustSpeeds = readings.filter(r => r.gustSpeed !== null);
          const maxGust = gustSpeeds.length > 0 
            ? Math.max(...gustSpeeds.map(r => r.gustSpeed!)) 
            : null;
          
          const sinSum = readings.reduce((sum, r) => sum + Math.sin(r.windDirection * Math.PI / 180), 0);
          const cosSum = readings.reduce((sum, r) => sum + Math.cos(r.windDirection * Math.PI / 180), 0);
          const avgDir = ((Math.atan2(sinSum, cosSum) * 180 / Math.PI) + 360) % 360;
          
          const rollingDirReadings = readings.filter(r => r.rollingAvgDirection !== null);
          let avgRollingDir: number | null = null;
          if (rollingDirReadings.length > 0) {
            const sinSumR = rollingDirReadings.reduce((sum, r) => sum + Math.sin((r.rollingAvgDirection ?? 0) * Math.PI / 180), 0);
            const cosSumR = rollingDirReadings.reduce((sum, r) => sum + Math.cos((r.rollingAvgDirection ?? 0) * Math.PI / 180), 0);
            avgRollingDir = ((Math.atan2(sinSumR, cosSumR) * 180 / Math.PI) + 360) % 360;
          }
          
          aggregated.push({
            time: new Date(timeKey).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            }),
            timestamp,
            speed: avgSpeed,
            avgSpeed: avgRollingSpeed,
            gustSpeed: maxGust,
            direction: avgDir,
            avgDirection: avgRollingDir,
            buoyId: 'all',
            buoyName: 'Averaged',
          });
        });
      
      processedData = aggregated;
    }
    
    return processedData;
  }, [historyData, selectedBuoyId, buoyMap]);

  const directionSamples = useMemo(() => {
    if (filteredData.length < 2) return [];
    const interval = Math.max(1, Math.floor(filteredData.length / 10));
    const samples = filteredData.filter((_, i) => i % interval === 0);
    if (samples.length > 0 && samples[samples.length - 1] !== filteredData[filteredData.length - 1]) {
      samples.push(filteredData[filteredData.length - 1]);
    }
    return samples.slice(0, 12);
  }, [filteredData]);

  const stats = useMemo(() => {
    if (!filteredData.length) return null;
    
    const speeds = filteredData.map(d => d.speed);
    const avgSpeeds = filteredData.map(d => d.avgSpeed).filter((s): s is number => s !== null);
    const gusts = filteredData.map(d => d.gustSpeed).filter((g): g is number => g !== null);
    const directions = filteredData.map(d => d.avgDirection ?? d.direction);
    
    const latest = filteredData[filteredData.length - 1];
    const currentDirection = latest?.avgDirection ?? latest?.direction ?? 0;
    const currentSpeed = latest?.avgSpeed ?? latest?.speed ?? 0;
    
    const minDir = Math.min(...directions);
    const maxDir = Math.max(...directions);
    let dirRange = maxDir - minDir;
    if (dirRange > 180) dirRange = 360 - dirRange;
    
    return {
      avgSpeed: avgSpeeds.length 
        ? avgSpeeds.reduce((a, b) => a + b, 0) / avgSpeeds.length 
        : speeds.reduce((a, b) => a + b, 0) / speeds.length,
      maxSpeed: Math.max(...speeds),
      minSpeed: Math.min(...speeds),
      maxGust: gusts.length ? Math.max(...gusts) : null,
      directionRange: dirRange,
      currentDirection,
      currentSpeed,
    };
  }, [filteredData]);

  const handleBuoyClick = useCallback((buoyId: string) => {
    onBuoySelect(buoyId === "all" ? null : buoyId);
  }, [onBuoySelect]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4" data-testid="card-wind-timeline">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="h-5 w-5 text-primary" />
          <span className="font-semibold">Wind Timeline</span>
        </div>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <span className="text-sm">Loading history...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredData.length) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4" data-testid="card-wind-timeline">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-primary" />
            <span className="font-semibold">Wind Timeline</span>
          </div>
          {availableBuoys.length > 0 && (
            <BuoyDropdown
              buoys={availableBuoys}
              selectedId={selectedBuoyId}
              onSelect={handleBuoyClick}
              isOpen={isDropdownOpen}
              setIsOpen={setIsDropdownOpen}
            />
          )}
        </div>
        <div className="h-40 flex items-center justify-center text-muted-foreground">
          No wind history data available
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/30 overflow-visible" data-testid="card-wind-timeline">
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Wind className="h-5 w-5 text-primary" />
            <span className="font-semibold">Wind Timeline</span>
          </div>
          
          <BuoyDropdown
            buoys={availableBuoys}
            selectedId={selectedBuoyId}
            onSelect={handleBuoyClick}
            isOpen={isDropdownOpen}
            setIsOpen={setIsDropdownOpen}
          />
        </div>
        
        {stats && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge 
              variant="outline" 
              className="text-xs flex items-center gap-1.5 pr-2.5 font-medium bg-primary/5"
              data-testid="badge-current-direction"
            >
              <DirectionArrow degrees={stats.currentDirection} size={16} />
              <span className="font-bold">{stats.currentDirection.toFixed(0)}°</span>
              <span className="text-muted-foreground font-normal">{getCardinalDirection(stats.currentDirection)}</span>
            </Badge>
            
            <Badge variant="secondary" className="text-xs font-medium" data-testid="badge-avg-speed">
              {stats.avgSpeed.toFixed(1)} kts avg
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium" data-testid="badge-max-speed">
              {stats.maxSpeed.toFixed(1)} kts max
            </Badge>
            {stats.maxGust && (
              <Badge 
                variant="outline" 
                className="text-xs font-medium text-orange-600 border-orange-400/50 bg-orange-500/10"
                data-testid="badge-max-gust"
              >
                {stats.maxGust.toFixed(1)} kts gust
              </Badge>
            )}
          </div>
        )}

        <div className="mb-3 pb-3 border-b border-border/50" data-testid="direction-timeline">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="font-medium">Wind Direction</span>
            <span>±{stats ? (stats.directionRange / 2).toFixed(0) : 0}° shift</span>
          </div>
          <div className="flex items-center justify-between bg-primary/5 rounded-lg p-2">
            {directionSamples.map((d, i) => {
              const dir = d.avgDirection ?? d.direction;
              return (
                <div 
                  key={i}
                  className="flex flex-col items-center gap-1"
                  title={`${d.time}: ${dir.toFixed(0)}° (${getCardinalDirection(dir)})`}
                  data-testid={`direction-arrow-${i}`}
                >
                  <DirectionArrow degrees={dir} size={18} />
                  <span className="text-[10px] font-medium text-muted-foreground">{dir.toFixed(0)}°</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
            <span data-testid="text-time-start">{filteredData[0]?.time}</span>
            <span data-testid="text-time-end">{filteredData[filteredData.length - 1]?.time}</span>
          </div>
        </div>
      </div>

      <div className="h-48 px-2 pb-3" data-testid="chart-wind-timeline">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart 
            data={filteredData} 
            margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.5} />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              interval="preserveStartEnd"
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tick={{ fontSize: 10 }} 
              tickLine={false}
              unit=" kts"
              domain={['auto', 'auto']}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="speed"
              fill="hsl(210 85% 42% / 0.12)"
              stroke="hsl(210 85% 42% / 0.3)"
              strokeWidth={1}
              name="Speed"
            />
            
            <Line
              type="monotone"
              dataKey="avgSpeed"
              stroke="hsl(210 85% 42%)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2 }}
              name="Avg"
              connectNulls
            />
            
            <Line
              type="monotone"
              dataKey="gustSpeed"
              stroke="hsl(25 95% 53%)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name="Gust"
              connectNulls
            />
            
            <Legend 
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => {
                if (value === 'Speed') return 'Speed';
                if (value === 'Avg') return 'Avg (5m)';
                if (value === 'Gust') return 'Gust';
                return value;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface BuoyDropdownProps {
  buoys: Array<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function BuoyDropdown({ buoys, selectedId, onSelect, isOpen, setIsOpen }: BuoyDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  
  const selectedName = selectedId 
    ? buoys.find(b => b.id === selectedId)?.name || selectedId 
    : "All Buoys";

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  const dropdownContent = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      className="fixed z-[9999] min-w-[160px] bg-background border rounded-lg shadow-xl py-1 animate-in fade-in-0 zoom-in-95"
      style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
      data-testid="dropdown-buoy-options"
    >
      <button
        onClick={() => { onSelect("all"); setIsOpen(false); }}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${!selectedId ? 'bg-primary/10 text-primary font-medium' : ''}`}
        data-testid="option-all-buoys"
      >
        All Buoys (avg)
      </button>
      {buoys.map(buoy => (
        <button
          key={buoy.id}
          onClick={() => { onSelect(buoy.id); setIsOpen(false); }}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${selectedId === buoy.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
          data-testid={`option-buoy-${buoy.id}`}
        >
          {buoy.name}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg border bg-background hover-elevate active-elevate-2 transition-colors"
        data-testid="select-buoy-filter"
      >
        <span className="max-w-[100px] truncate">{selectedName}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {dropdownContent}
    </div>
  );
}
