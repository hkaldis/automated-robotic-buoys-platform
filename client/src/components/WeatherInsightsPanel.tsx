import { useState } from "react";
import { X, Wind, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Clock, AlertTriangle, Compass, Gauge, Activity, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { WindTimelineChart } from "./WindTimelineChart";
import type { WindAnalytics, ShiftEvent, WindPattern, Buoy, BuoyWeatherHistory } from "@shared/schema";

interface WeatherInsightsPanelProps {
  analytics: WindAnalytics | null;
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  historyData?: BuoyWeatherHistory[];
  historyLoading?: boolean;
  buoys?: Buoy[];
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

function WindDirectionIndicator({ degrees, size = 64 }: { degrees: number; size?: number }) {
  const normalized = ((degrees % 360) + 360) % 360;
  const cardinal = getCardinalDirection(normalized);
  const blowingToward = (normalized + 180) % 360;
  
  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-primary/10" />
      <div 
        className="absolute flex items-center justify-center text-primary"
        style={{ 
          width: size * 0.7, 
          height: size * 0.7,
          transform: `rotate(${blowingToward}deg)`,
        }}
      >
        <Navigation className="w-full h-full drop-shadow-sm" fill="currentColor" />
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-1">
        <span className="text-xs font-medium text-muted-foreground">{cardinal}</span>
      </div>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: WindPattern }) {
  const patternConfig = {
    stable: { label: "Stable", color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/30", icon: Activity },
    oscillating: { label: "Oscillating", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Activity },
    persistent: { label: "Shifting", color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: TrendingUp },
    oscillating_persistent: { label: "Complex", color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: Activity },
  }[pattern.type];

  const Icon = patternConfig.icon;

  return (
    <div className={cn("rounded-xl p-4 border", patternConfig.bg, patternConfig.border)}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg", patternConfig.bg)}>
          <Icon className={cn("h-5 w-5", patternConfig.color)} />
        </div>
        <div>
          <div className={cn("font-semibold text-lg", patternConfig.color)}>{patternConfig.label}</div>
          <div className="text-xs text-muted-foreground">
            {Math.round(pattern.confidence * 100)}% confidence
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Median</span>
          <span className="font-semibold text-lg">{Math.round(pattern.medianDirection)}°</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Range</span>
          <span className="font-semibold text-lg">±{Math.round(pattern.shiftRange / 2)}°</span>
        </div>
        {pattern.periodMinutes && (
          <div className="flex flex-col col-span-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Oscillation Period</span>
            <span className="font-semibold">~{pattern.periodMinutes} min</span>
          </div>
        )}
        {pattern.trendDegreesPerHour !== 0 && (
          <div className="flex flex-col col-span-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Trend</span>
            <span className={cn("font-semibold", pattern.trendDegreesPerHour > 0 ? "text-blue-600" : "text-orange-600")}>
              {pattern.trendDegreesPerHour > 0 ? "+" : ""}{pattern.trendDegreesPerHour.toFixed(1)}°/hr
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FavoredSideCard({ analysis }: { analysis: WindAnalytics["favoredSide"] }) {
  const sideConfig = {
    left: { 
      label: "Port Favored", 
      color: "text-orange-600", 
      bg: "bg-gradient-to-br from-orange-500/10 to-orange-500/5", 
      border: "border-orange-500/30",
      iconRotate: -45
    },
    right: { 
      label: "Starboard Favored", 
      color: "text-blue-600", 
      bg: "bg-gradient-to-br from-blue-500/10 to-blue-500/5", 
      border: "border-blue-500/30",
      iconRotate: 45
    },
    neutral: { 
      label: "Neutral", 
      color: "text-muted-foreground", 
      bg: "bg-muted/30", 
      border: "border-muted",
      iconRotate: 0
    },
  }[analysis.side];

  return (
    <div className={cn("rounded-xl p-4 border", sideConfig.bg, sideConfig.border)}>
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-xl", sideConfig.bg, "border", sideConfig.border)}>
          {analysis.side === "neutral" ? (
            <Minus className={cn("h-8 w-8", sideConfig.color)} />
          ) : (
            <ArrowUp 
              className={cn("h-8 w-8", sideConfig.color)} 
              style={{ transform: `rotate(${sideConfig.iconRotate}deg)` }}
            />
          )}
        </div>
        <div className="flex-1">
          <div className={cn("text-xl font-bold", sideConfig.color)}>{sideConfig.label}</div>
          <div className="text-sm text-muted-foreground">
            {Math.round(analysis.confidence * 100)}% confidence
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{analysis.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {analysis.factors.nextShift !== "unknown" && (
          <Badge variant="secondary" className="text-xs">
            Next shift: {analysis.factors.nextShift}
          </Badge>
        )}
        {analysis.factors.persistent !== "none" && (
          <Badge variant="secondary" className="text-xs">
            Trend: {analysis.factors.persistent}
          </Badge>
        )}
      </div>
    </div>
  );
}

function CurrentConditionsCard({ conditions }: { conditions: WindAnalytics["currentConditions"] }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/20 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <WindDirectionIndicator degrees={conditions.direction} size={72} />
          <div className="pl-2">
            <div className="text-4xl font-bold tracking-tight">{Math.round(conditions.direction)}°</div>
            <div className="flex items-center gap-1.5 mt-1">
              {conditions.directionDelta > 0 ? (
                <TrendingUp className="h-4 w-4 text-blue-500" />
              ) : conditions.directionDelta < 0 ? (
                <TrendingDown className="h-4 w-4 text-orange-500" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn(
                "text-sm font-medium",
                conditions.directionDelta > 0 ? "text-blue-600" : 
                conditions.directionDelta < 0 ? "text-orange-600" : "text-muted-foreground"
              )}>
                {conditions.directionDelta > 0 ? "+" : ""}{conditions.directionDelta.toFixed(1)}° vs avg
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Speed</div>
          <div className="text-3xl font-bold">{conditions.speed.toFixed(1)}</div>
          <div className="text-sm text-muted-foreground">knots</div>
          <div className="flex items-center justify-end gap-1 mt-1">
            {conditions.speedDelta > 0 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : conditions.speedDelta < 0 ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(
              "text-xs",
              conditions.speedDelta > 0 ? "text-green-600" : 
              conditions.speedDelta < 0 ? "text-red-600" : "text-muted-foreground"
            )}>
              {conditions.speedDelta > 0 ? "+" : ""}{conditions.speedDelta.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftHistoryList({ shifts }: { shifts: ShiftEvent[] }) {
  const recentShifts = shifts.slice(-8).reverse();
  
  if (recentShifts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
        No significant wind shifts detected
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentShifts.map((shift, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg bg-muted/30 hover-elevate">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">{formatTime(shift.timestamp)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs font-medium",
                shift.type === "lift" ? "text-green-600 border-green-500/40 bg-green-500/10" : "text-red-600 border-red-500/40 bg-red-500/10"
              )}
            >
              {shift.type === "lift" ? "Lift" : "Header"}
            </Badge>
            <span className={cn(
              "font-semibold min-w-[3rem] text-right",
              shift.change > 0 ? "text-blue-600" : "text-orange-600"
            )}>
              {shift.change > 0 ? "+" : ""}{Math.round(shift.change)}°
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PredictionsCard({ predictions }: { predictions: WindAnalytics["predictions"] }) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <span className="font-semibold text-orange-600">Predicted Shifts</span>
      </div>
      <div className="space-y-2">
        {predictions.map((pred, i) => (
          <div key={i} className="flex items-center justify-between text-sm py-2 px-3 bg-orange-500/5 rounded-lg">
            <span className="text-muted-foreground">In ~{pred.expectedTimeMinutes} min</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {pred.expectedDirection === "right" ? "Veer" : "Back"} ~{Math.round(pred.magnitudeDegrees)}°
              </span>
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                {Math.round(pred.confidence * 100)}%
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuoyComparisonList({ buoys }: { buoys: WindAnalytics["buoyComparison"] }) {
  if (buoys.length <= 1) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Buoy Readings</h4>
      <div className="grid gap-2">
        {buoys.map((buoy) => (
          <div key={buoy.buoyId} className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg bg-muted/30 hover-elevate">
            <span className="font-semibold">{buoy.buoyName}</span>
            <div className="flex items-center gap-4">
              <span className="font-medium">{Math.round(buoy.direction)}°</span>
              <span className="text-muted-foreground">{buoy.speed.toFixed(1)} kts</span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  buoy.trend === "increasing" ? "text-green-600 border-green-500/40" :
                  buoy.trend === "decreasing" ? "text-red-600 border-red-500/40" : "text-muted-foreground border-muted"
                )}
              >
                {buoy.trend === "increasing" ? <TrendingUp className="h-3 w-3" /> :
                 buoy.trend === "decreasing" ? <TrendingDown className="h-3 w-3" /> :
                 <Minus className="h-3 w-3" />}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WeatherInsightsPanel({ 
  analytics, 
  isLoading, 
  error, 
  onClose,
  historyData = [],
  historyLoading = false,
  buoys = [],
}: WeatherInsightsPanelProps) {
  const [selectedBuoyId, setSelectedBuoyId] = useState<string | null>(null);

  return (
    <div 
      className="absolute top-4 right-4 z-[1000] w-[480px] max-h-[calc(100vh-6rem)] flex flex-col bg-background rounded-xl border shadow-xl"
      data-testid="panel-weather-insights"
    >
      <div className="flex-none sticky top-0 bg-background border-b px-5 py-4 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wind className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Wind Insights</h3>
            <p className="text-xs text-muted-foreground">Real-time wind analysis</p>
          </div>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-weather-insights"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16" data-testid="loading-weather-insights">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              <span className="text-sm text-muted-foreground">Loading wind data...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-16" data-testid="error-weather-insights">
            <div className="inline-flex p-4 rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <p className="text-lg font-semibold text-destructive">Unable to load weather data</p>
            <p className="text-sm mt-2 text-muted-foreground">Please try again later</p>
          </div>
        ) : !analytics ? (
          <div className="text-center py-16" data-testid="empty-weather-insights">
            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
              <Wind className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">No weather data available</p>
            <p className="text-sm mt-2 text-muted-foreground">Weather readings will appear here once buoys report wind data</p>
          </div>
        ) : (
          <>
            <div data-testid="card-current-conditions">
              <CurrentConditionsCard conditions={analytics.currentConditions} />
            </div>

            <WindTimelineChart
              historyData={historyData}
              buoys={buoys}
              selectedBuoyId={selectedBuoyId}
              onBuoySelect={setSelectedBuoyId}
              isLoading={historyLoading}
            />
            
            <div className="grid gap-4" data-testid="cards-analysis">
              <div data-testid="card-favored-side">
                <FavoredSideCard analysis={analytics.favoredSide} />
              </div>
              
              <div data-testid="card-wind-pattern">
                <PatternCard pattern={analytics.pattern} />
              </div>

              <div data-testid="card-predictions">
                <PredictionsCard predictions={analytics.predictions} />
              </div>
            </div>

            <div data-testid="list-shift-history">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Recent Shifts</h4>
              <ShiftHistoryList shifts={analytics.shifts} />
            </div>

            <div data-testid="list-buoy-comparison">
              <BuoyComparisonList buoys={analytics.buoyComparison} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
