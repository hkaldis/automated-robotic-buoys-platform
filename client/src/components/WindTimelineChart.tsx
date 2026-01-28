import { useMemo, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wind } from "lucide-react";
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

// Helper to get cardinal direction from degrees
function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

// Wind direction arrow component
// Uses CSS rotation on wrapper - arrow points where wind comes FROM
// 0° = North (up), 90° = East (right), 180° = South (down), 270° = West (left)
function DirectionArrow({ degrees, size = 16 }: { degrees: number; size?: number }) {
  const normalized = ((degrees % 360) + 360) % 360;
  
  return (
    <div 
      className="flex-shrink-0 inline-flex items-center justify-center text-primary"
      style={{ 
        width: size, 
        height: size,
        transform: `rotate(${normalized}deg)`,
      }}
      role="img"
      aria-label={`Wind from ${normalized.toFixed(0)}° ${getCardinalDirection(normalized)}`}
      data-rotation={normalized}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        {/* Arrow pointing UP at 0° - simple triangle */}
        <path d="M12 3L6 17L12 13L18 17L12 3Z" />
      </svg>
    </div>
  );
}

// Custom tooltip with wind info
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0]?.payload;
  if (!data) return null;
  
  const direction = data.avgDirection ?? data.direction;
  const cardinal = getCardinalDirection(direction);
  
  return (
    <div 
      className="bg-card border border-border rounded-md p-2 shadow-lg text-xs"
      data-testid="tooltip-wind-timeline"
    >
      <div className="font-medium mb-1.5">{label}</div>
      <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b">
        <DirectionArrow degrees={direction} size={16} />
        <span className="font-medium">{direction.toFixed(0)}° ({cardinal})</span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        {data.speed !== undefined && (
          <div>Speed: <span className="text-foreground font-medium">{data.speed.toFixed(1)} kts</span></div>
        )}
        {data.avgSpeed !== null && (
          <div>Avg: <span className="text-foreground">{data.avgSpeed.toFixed(1)} kts</span></div>
        )}
        {data.gustSpeed !== null && (
          <div>Gust: <span className="text-orange-500">{data.gustSpeed.toFixed(1)} kts</span></div>
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

  // Get unique buoy IDs from history data
  const buoyIdsInHistory = useMemo(() => {
    return new Set(historyData.map(h => h.buoyId));
  }, [historyData]);

  // Build available buoys list - prioritize matching by ID, fallback to all buoys
  const availableBuoys = useMemo(() => {
    // First, try to match buoys with history data
    if (buoyIdsInHistory.size > 0) {
      // Try matching by ID
      const matched = buoys.filter(b => buoyIdsInHistory.has(b.id));
      if (matched.length > 0) {
        return matched;
      }
      
      // No ID matches - create synthetic entries from history IDs
      return Array.from(buoyIdsInHistory).map(id => ({
        id,
        name: buoyMap.get(id) || id.replace(/^demo-/, 'Buoy '),
      }));
    }
    
    // No history data yet - show all buoys from props so user can select
    // This handles the case when historyData is still loading
    if (buoys.length > 0) {
      return buoys.map(b => ({ id: b.id, name: b.name }));
    }
    
    return [];
  }, [buoyIdsInHistory, buoys, buoyMap]);

  const filteredData = useMemo(() => {
    if (!historyData.length) return [];
    
    let processedData: ChartDataPoint[];
    
    if (selectedBuoyId) {
      // Single buoy selected - filter to just that buoy
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
      // "All Buoys" - aggregate data by averaging across buoys at similar timestamps
      const timeGroups = new Map<string, BuoyWeatherHistory[]>();
      
      historyData.forEach(h => {
        const date = new Date(h.timestamp);
        // Round to nearest minute for grouping
        date.setSeconds(0, 0);
        const key = date.toISOString();
        if (!timeGroups.has(key)) {
          timeGroups.set(key, []);
        }
        timeGroups.get(key)!.push(h);
      });
      
      // Average readings at each time point
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
          
          // Average direction using circular mean
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

  // Sample direction arrows from the data (show ~12 arrows max)
  const directionSamples = useMemo(() => {
    if (filteredData.length < 2) return [];
    const interval = Math.max(1, Math.floor(filteredData.length / 12));
    const samples = filteredData.filter((_, i) => i % interval === 0);
    // Always include last point
    if (samples.length > 0 && samples[samples.length - 1] !== filteredData[filteredData.length - 1]) {
      samples.push(filteredData[filteredData.length - 1]);
    }
    return samples.slice(0, 15); // Cap at 15 for display
  }, [filteredData]);

  const stats = useMemo(() => {
    if (!filteredData.length) return null;
    
    const speeds = filteredData.map(d => d.speed);
    const avgSpeeds = filteredData.map(d => d.avgSpeed).filter((s): s is number => s !== null);
    const gusts = filteredData.map(d => d.gustSpeed).filter((g): g is number => g !== null);
    const directions = filteredData.map(d => d.avgDirection ?? d.direction);
    
    // Get current (latest) values
    const latest = filteredData[filteredData.length - 1];
    const currentDirection = latest?.avgDirection ?? latest?.direction ?? 0;
    const currentSpeed = latest?.avgSpeed ?? latest?.speed ?? 0;
    
    // Calculate direction range properly (handling wraparound)
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

  // Handler for buoy selection
  const handleBuoySelect = useCallback((value: string) => {
    onBuoySelect(value === "all" ? null : value);
  }, [onBuoySelect]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wind className="h-4 w-4" />
            Wind Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Loading wind history...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!filteredData.length) {
    return (
      <Card data-testid="card-wind-timeline">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Wind Timeline
            </CardTitle>
            
            {/* Show dropdown even when no data, so user can select */}
            {availableBuoys.length > 0 && (
              <Select
                value={selectedBuoyId || "all"}
                onValueChange={handleBuoySelect}
              >
                <SelectTrigger className="w-36 h-8" data-testid="select-buoy-filter">
                  <SelectValue placeholder="Select Buoy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-buoys">
                    All Buoys (avg)
                  </SelectItem>
                  {availableBuoys.map(buoy => (
                    <SelectItem key={buoy.id} value={buoy.id} data-testid={`option-buoy-${buoy.id}`}>
                      {buoy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            No wind history data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-wind-timeline">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wind className="h-4 w-4" />
            Wind Timeline
          </CardTitle>
          
          <Select
            value={selectedBuoyId || "all"}
            onValueChange={handleBuoySelect}
          >
            <SelectTrigger className="w-36 h-8" data-testid="select-buoy-filter">
              <SelectValue placeholder="Select Buoy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-all-buoys">
                All Buoys (avg)
              </SelectItem>
              {availableBuoys.map(buoy => (
                <SelectItem key={buoy.id} value={buoy.id} data-testid={`option-buoy-${buoy.id}`}>
                  {buoy.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Stats row with current wind info */}
        {stats && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Current wind direction with arrow and degree */}
            <Badge 
              variant="outline" 
              className="text-xs flex items-center gap-1.5 pr-2.5 font-medium"
              data-testid="badge-current-direction"
            >
              <DirectionArrow degrees={stats.currentDirection} size={14} />
              <span>{stats.currentDirection.toFixed(0)}°</span>
              <span className="text-muted-foreground font-normal">{getCardinalDirection(stats.currentDirection)}</span>
            </Badge>
            
            <Badge variant="secondary" className="text-xs" data-testid="badge-avg-speed">
              {stats.avgSpeed.toFixed(1)} kts avg
            </Badge>
            <Badge variant="secondary" className="text-xs" data-testid="badge-max-speed">
              {stats.maxSpeed.toFixed(1)} kts max
            </Badge>
            {stats.maxGust && (
              <Badge 
                variant="outline" 
                className="text-xs text-orange-600 border-orange-300"
                data-testid="badge-max-gust"
              >
                {stats.maxGust.toFixed(1)} kts gust
              </Badge>
            )}
          </div>
        )}

        {/* Direction arrows timeline at top */}
        <div className="mb-2 pb-2 border-b" data-testid="direction-timeline">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Wind from</span>
            <span>±{stats ? (stats.directionRange / 2).toFixed(0) : 0}° shift</span>
          </div>
          <div className="flex items-center justify-between">
            {directionSamples.map((d, i) => {
              const dir = d.avgDirection ?? d.direction;
              return (
                <div 
                  key={i}
                  className="flex flex-col items-center gap-0.5"
                  title={`${d.time}: ${dir.toFixed(0)}° (${getCardinalDirection(dir)})`}
                  data-testid={`direction-arrow-${i}`}
                >
                  <DirectionArrow degrees={dir} size={14} />
                  <span className="text-[9px] text-muted-foreground">{dir.toFixed(0)}°</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span data-testid="text-time-start">{filteredData[0]?.time}</span>
            <span data-testid="text-time-end">{filteredData[filteredData.length - 1]?.time}</span>
          </div>
        </div>

        {/* Speed chart */}
        <div className="h-40" data-testid="chart-wind-timeline">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={filteredData} 
              margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                unit=" kts"
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Speed area (instant readings) */}
              <Area
                type="monotone"
                dataKey="speed"
                fill="hsl(210 85% 42% / 0.15)"
                stroke="hsl(210 85% 42% / 0.4)"
                strokeWidth={1}
                name="Speed"
              />
              
              {/* Average speed line */}
              <Line
                type="monotone"
                dataKey="avgSpeed"
                stroke="hsl(210 85% 42%)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Avg"
                connectNulls
              />
              
              {/* Gust line */}
              <Line
                type="monotone"
                dataKey="gustSpeed"
                stroke="hsl(25 95% 53%)"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                name="Gust"
                connectNulls
              />
              
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
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
      </CardContent>
    </Card>
  );
}
