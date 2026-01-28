import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wind, Compass } from "lucide-react";
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
  buoyName: string;
}

export function WindTimelineChart({
  historyData,
  buoys,
  selectedBuoyId,
  onBuoySelect,
  isLoading = false,
}: WindTimelineChartProps) {
  const [chartType, setChartType] = useState<"speed" | "direction">("speed");

  const buoyMap = useMemo(() => {
    const map = new Map<string, string>();
    buoys.forEach(b => map.set(b.id, b.name));
    return map;
  }, [buoys]);

  const filteredData = useMemo(() => {
    if (!historyData.length) return [];
    
    let data = historyData;
    if (selectedBuoyId) {
      data = historyData.filter(h => h.buoyId === selectedBuoyId);
    }

    return data
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
        buoyName: buoyMap.get(h.buoyId) || 'Unknown',
      }));
  }, [historyData, selectedBuoyId, buoyMap]);

  const stats = useMemo(() => {
    if (!filteredData.length) return null;
    
    const speeds = filteredData.map(d => d.speed);
    const avgSpeeds = filteredData.map(d => d.avgSpeed).filter((s): s is number => s !== null);
    const gusts = filteredData.map(d => d.gustSpeed).filter((g): g is number => g !== null);
    const directions = filteredData.map(d => d.direction);
    
    return {
      avgSpeed: avgSpeeds.length 
        ? avgSpeeds.reduce((a, b) => a + b, 0) / avgSpeeds.length 
        : speeds.reduce((a, b) => a + b, 0) / speeds.length,
      maxSpeed: Math.max(...speeds),
      minSpeed: Math.min(...speeds),
      maxGust: gusts.length ? Math.max(...gusts) : null,
      avgDirection: directions.reduce((a, b) => a + b, 0) / directions.length,
      directionRange: Math.max(...directions) - Math.min(...directions),
    };
  }, [filteredData]);

  const availableBuoys = useMemo(() => {
    const buoyIds = new Set(historyData.map(h => h.buoyId));
    return buoys.filter(b => buoyIds.has(b.id));
  }, [historyData, buoys]);

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
          
          <div className="flex items-center gap-2">
            <Select
              value={chartType}
              onValueChange={(v) => setChartType(v as "speed" | "direction")}
            >
              <SelectTrigger className="w-28 h-8" data-testid="select-chart-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="speed">Speed</SelectItem>
                <SelectItem value="direction">Direction</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedBuoyId || "all"}
              onValueChange={(v) => onBuoySelect(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-32 h-8" data-testid="select-buoy-filter">
                <SelectValue placeholder="All Buoys" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buoys</SelectItem>
                {availableBuoys.map(buoy => (
                  <SelectItem key={buoy.id} value={buoy.id}>
                    {buoy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {stats && (
          <div className="flex flex-wrap gap-2 mb-3">
            {chartType === "speed" ? (
              <>
                <Badge variant="secondary" className="text-xs">
                  Avg: {stats.avgSpeed.toFixed(1)} kts
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Max: {stats.maxSpeed.toFixed(1)} kts
                </Badge>
                {stats.maxGust && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                    Gust: {stats.maxGust.toFixed(1)} kts
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">
                  Avg: {stats.avgDirection.toFixed(0)}°
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Range: ±{(stats.directionRange / 2).toFixed(0)}°
                </Badge>
              </>
            )}
          </div>
        )}

        <div className="h-48" data-testid="chart-wind-timeline">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "speed" ? (
              <ComposedChart data={filteredData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [
                    `${value?.toFixed(1) ?? '-'} kts`,
                    name === 'speed' ? 'Speed' : name === 'avgSpeed' ? 'Avg (5m)' : 'Gust'
                  ]}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  formatter={(value) => value === 'speed' ? 'Speed' : value === 'avgSpeed' ? 'Avg (5m)' : 'Gust'}
                />
                <Area
                  type="monotone"
                  dataKey="speed"
                  fill="hsl(210 85% 42% / 0.15)"
                  stroke="hsl(210 85% 42% / 0.5)"
                  strokeWidth={1}
                  name="speed"
                />
                <Line
                  type="monotone"
                  dataKey="avgSpeed"
                  stroke="hsl(210 85% 42%)"
                  strokeWidth={2}
                  dot={false}
                  name="avgSpeed"
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="gustSpeed"
                  stroke="hsl(25 95% 53%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  name="gustSpeed"
                  connectNulls
                />
              </ComposedChart>
            ) : (
              <LineChart data={filteredData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
                  unit="°"
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(0)}°`,
                    name === 'direction' ? 'Direction' : 'Avg Direction'
                  ]}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px' }}
                  formatter={(value) => value === 'direction' ? 'Direction' : '5-min Avg'}
                />
                <Line
                  type="monotone"
                  dataKey="direction"
                  stroke="hsl(210 85% 42%)"
                  strokeWidth={2}
                  dot={false}
                  name="direction"
                />
                <Line
                  type="monotone"
                  dataKey="avgDirection"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  name="avgDirection"
                  connectNulls
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
