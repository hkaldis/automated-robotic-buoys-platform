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
  Scatter,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wind, Navigation } from "lucide-react";
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
  showArrow?: boolean;
}

// Helper to get cardinal direction from degrees
function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Wind arrow component for direction visualization
// Arrow points in the direction wind is coming FROM (meteorological convention)
function WindArrow({ direction, size = 16 }: { direction: number; size?: number }) {
  const rotation = direction;
  return (
    <div 
      className="inline-flex items-center justify-center"
      style={{ 
        transform: `rotate(${rotation}deg)`,
        width: size,
        height: size,
      }}
      title={`Wind from ${direction.toFixed(0)}° (${getCardinalDirection(direction)})`}
    >
      <Navigation className="text-primary" style={{ width: size * 0.8, height: size * 0.8 }} />
    </div>
  );
}

// Custom tooltip with wind arrow
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
      <div className="font-medium mb-1">{label}</div>
      <div className="flex items-center gap-2 mb-1">
        <WindArrow direction={direction} size={14} />
        <span>{direction.toFixed(0)}° ({cardinal})</span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        {data.speed !== undefined && (
          <div>Speed: <span className="text-foreground">{data.speed.toFixed(1)} kts</span></div>
        )}
        {data.avgSpeed !== null && (
          <div>Avg: <span className="text-foreground">{data.avgSpeed.toFixed(1)} kts</span></div>
        )}
        {data.gustSpeed !== null && (
          <div>Gust: <span className="text-orange-500">{data.gustSpeed.toFixed(1)} kts</span></div>
        )}
        {data.buoyName && data.buoyName !== 'Averaged' && (
          <div className="text-muted-foreground/70 mt-1">Buoy: {data.buoyName}</div>
        )}
      </div>
    </div>
  );
}

// Custom scatter shape for wind arrows at regular intervals
function WindArrowShape(props: any) {
  const { cx, cy, payload } = props;
  if (!payload.showArrow || !cx || !cy) return null;
  
  const direction = payload.avgDirection ?? payload.direction;
  // Arrow points in direction wind is coming FROM
  const rotation = direction;
  
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <g transform={`rotate(${rotation})`}>
        <path 
          d="M0,-10 L4,5 L0,2 L-4,5 Z" 
          fill="hsl(210 85% 42%)" 
          stroke="hsl(var(--background))"
          strokeWidth={0.5}
        />
      </g>
    </g>
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

  // Get available buoys that have data
  const availableBuoys = useMemo(() => {
    const buoyIds = new Set(historyData.map(h => h.buoyId));
    return buoys.filter(b => buoyIds.has(b.id));
  }, [historyData, buoys]);

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
      // Group readings by minute intervals
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
          
          // Average direction (handling wraparound)
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
    
    // Mark points where arrows should be shown (every ~5 minutes)
    const arrowInterval = Math.max(1, Math.floor(processedData.length / 12));
    return processedData.map((d, i) => ({
      ...d,
      showArrow: i % arrowInterval === 0 || i === processedData.length - 1,
    }));
  }, [historyData, selectedBuoyId, buoyMap]);

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
    
    return {
      avgSpeed: avgSpeeds.length 
        ? avgSpeeds.reduce((a, b) => a + b, 0) / avgSpeeds.length 
        : speeds.reduce((a, b) => a + b, 0) / speeds.length,
      maxSpeed: Math.max(...speeds),
      minSpeed: Math.min(...speeds),
      maxGust: gusts.length ? Math.max(...gusts) : null,
      avgDirection: directions.reduce((a, b) => a + b, 0) / directions.length,
      directionRange: Math.max(...directions) - Math.min(...directions),
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wind className="h-4 w-4" />
            Wind Timeline
          </CardTitle>
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
        {/* Stats row with current wind direction arrow */}
        {stats && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Current wind direction with arrow */}
            <Badge 
              variant="outline" 
              className="text-xs flex items-center gap-1.5 pr-2"
              data-testid="badge-current-direction"
            >
              <WindArrow direction={stats.currentDirection} size={14} />
              <span>{stats.currentDirection.toFixed(0)}° {getCardinalDirection(stats.currentDirection)}</span>
            </Badge>
            
            <Badge variant="secondary" className="text-xs" data-testid="badge-avg-speed">
              Avg: {stats.avgSpeed.toFixed(1)} kts
            </Badge>
            <Badge variant="secondary" className="text-xs" data-testid="badge-max-speed">
              Max: {stats.maxSpeed.toFixed(1)} kts
            </Badge>
            {stats.maxGust && (
              <Badge 
                variant="outline" 
                className="text-xs text-orange-600 border-orange-300"
                data-testid="badge-max-gust"
              >
                Gust: {stats.maxGust.toFixed(1)} kts
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className="text-xs text-muted-foreground"
              data-testid="badge-direction-range"
            >
              ±{(stats.directionRange / 2).toFixed(0)}° shift
            </Badge>
          </div>
        )}

        {/* Combined chart with speed and direction arrows */}
        <div className="h-52" data-testid="chart-wind-timeline">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={filteredData} 
              margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
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
                name="Avg Speed"
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
              
              {/* Direction arrows as scatter points */}
              <Scatter
                dataKey="speed"
                shape={<WindArrowShape />}
                name="Direction"
                legendType="none"
              />
              
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'Speed') return 'Speed';
                  if (value === 'Avg Speed') return 'Avg (5m)';
                  if (value === 'Gust') return 'Gust';
                  return value;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Direction mini-timeline showing arrows */}
        <div className="mt-2 pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Wind direction (from)</span>
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" /> = direction
            </span>
          </div>
          <div className="flex items-center justify-between gap-0.5 overflow-hidden" data-testid="direction-timeline">
            {filteredData
              .filter((_, i) => i % Math.max(1, Math.floor(filteredData.length / 20)) === 0)
              .slice(0, 20)
              .map((d, i) => (
                <div 
                  key={i} 
                  className="flex flex-col items-center"
                  title={`${d.time}: ${(d.avgDirection ?? d.direction).toFixed(0)}° (${getCardinalDirection(d.avgDirection ?? d.direction)})`}
                  data-testid={`direction-arrow-${i}`}
                >
                  <WindArrow direction={d.avgDirection ?? d.direction} size={12} />
                </div>
              ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span data-testid="text-time-start">{filteredData[0]?.time}</span>
            <span data-testid="text-time-end">{filteredData[filteredData.length - 1]?.time}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
