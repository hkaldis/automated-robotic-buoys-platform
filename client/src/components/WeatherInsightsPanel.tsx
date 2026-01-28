import { useState } from "react";
import { X, Wind, ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Clock, AlertTriangle } from "lucide-react";
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

function PatternCard({ pattern }: { pattern: WindPattern }) {
  const patternLabel = {
    stable: "Stable",
    oscillating: "Oscillating", 
    persistent: "Persistent Shift",
    oscillating_persistent: "Oscillating + Shifting",
  }[pattern.type];

  const patternColor = {
    stable: "text-green-600 bg-green-500/10",
    oscillating: "text-blue-600 bg-blue-500/10",
    persistent: "text-orange-600 bg-orange-500/10",
    oscillating_persistent: "text-purple-600 bg-purple-500/10",
  }[pattern.type];

  return (
    <Card className="border-0 bg-muted/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">Wind Pattern</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-sm font-semibold", patternColor)} variant="outline">
            {patternLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {Math.round(pattern.confidence * 100)}% confidence
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Median:</span>
            <span className="ml-2 font-medium">{Math.round(pattern.medianDirection)}°</span>
          </div>
          <div>
            <span className="text-muted-foreground">Range:</span>
            <span className="ml-2 font-medium">±{Math.round(pattern.shiftRange / 2)}°</span>
          </div>
          {pattern.periodMinutes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Period:</span>
              <span className="ml-2 font-medium">~{pattern.periodMinutes} min</span>
            </div>
          )}
          {pattern.trendDegreesPerHour !== 0 && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Trend:</span>
              <span className={cn("ml-2 font-medium", pattern.trendDegreesPerHour > 0 ? "text-blue-600" : "text-orange-600")}>
                {pattern.trendDegreesPerHour > 0 ? "+" : ""}{pattern.trendDegreesPerHour.toFixed(1)}°/hr
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FavoredSideCard({ analysis }: { analysis: WindAnalytics["favoredSide"] }) {
  const sideIcon = {
    left: <ArrowUp className="h-5 w-5 rotate-[-45deg]" />,
    right: <ArrowUp className="h-5 w-5 rotate-45" />,
    neutral: <Minus className="h-5 w-5" />,
  }[analysis.side];

  const sideColor = {
    left: "text-orange-600 bg-orange-500/10 border-orange-500/30",
    right: "text-blue-600 bg-blue-500/10 border-blue-500/30",
    neutral: "text-muted-foreground bg-muted/50 border-muted",
  }[analysis.side];

  const sideLabel = {
    left: "Port",
    right: "Starboard", 
    neutral: "Neutral",
  }[analysis.side];

  return (
    <Card className={cn("border", sideColor)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wind className="h-4 w-4" />
          Favored Side
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", sideColor)}>
            {sideIcon}
          </div>
          <div>
            <div className="text-lg font-bold">{sideLabel}</div>
            <div className="text-xs text-muted-foreground">
              {Math.round(analysis.confidence * 100)}% confidence
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{analysis.reason}</p>
        <div className="mt-2 flex flex-wrap gap-2">
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
      </CardContent>
    </Card>
  );
}

function CurrentConditionsCard({ conditions }: { conditions: WindAnalytics["currentConditions"] }) {
  return (
    <Card className="border-0 bg-muted/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">Current Conditions</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{Math.round(conditions.direction)}°</div>
            <div className="flex items-center gap-1 text-sm">
              {conditions.directionDelta > 0 ? (
                <TrendingUp className="h-3 w-3 text-blue-500" />
              ) : conditions.directionDelta < 0 ? (
                <TrendingDown className="h-3 w-3 text-orange-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={cn(
                conditions.directionDelta > 0 ? "text-blue-600" : 
                conditions.directionDelta < 0 ? "text-orange-600" : "text-muted-foreground"
              )}>
                {conditions.directionDelta > 0 ? "+" : ""}{conditions.directionDelta.toFixed(1)}°
              </span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">{conditions.speed.toFixed(1)} kts</div>
            <div className="flex items-center gap-1 text-sm">
              {conditions.speedDelta > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : conditions.speedDelta < 0 ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={cn(
                conditions.speedDelta > 0 ? "text-green-600" : 
                conditions.speedDelta < 0 ? "text-red-600" : "text-muted-foreground"
              )}>
                {conditions.speedDelta > 0 ? "+" : ""}{conditions.speedDelta.toFixed(1)} kts
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ShiftHistoryList({ shifts }: { shifts: ShiftEvent[] }) {
  const recentShifts = shifts.slice(-10).reverse();
  
  if (recentShifts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No significant wind shifts detected
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentShifts.map((shift, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-muted last:border-0">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{formatTime(shift.timestamp)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                shift.type === "lift" ? "text-green-600 border-green-500/30" : "text-red-600 border-red-500/30"
              )}
            >
              {shift.type === "lift" ? "Lift" : "Header"}
            </Badge>
            <span className={cn(
              "font-medium",
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
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          Predicted Shifts
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {predictions.map((pred, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <span>In ~{pred.expectedTimeMinutes} min</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {pred.expectedDirection === "right" ? "Veer" : "Back"} ~{Math.round(pred.magnitudeDegrees)}°
              </span>
              <Badge variant="secondary" className="text-xs">
                {Math.round(pred.confidence * 100)}%
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BuoyComparisonList({ buoys }: { buoys: WindAnalytics["buoyComparison"] }) {
  if (buoys.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Buoy Readings</h4>
      {buoys.map((buoy) => (
        <div key={buoy.buoyId} className="flex items-center justify-between text-sm py-1.5 border-b border-muted last:border-0">
          <span className="font-medium">{buoy.buoyName}</span>
          <div className="flex items-center gap-3">
            <span>{Math.round(buoy.direction)}°</span>
            <span>{buoy.speed.toFixed(1)} kts</span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                buoy.trend === "increasing" ? "text-green-600" :
                buoy.trend === "decreasing" ? "text-red-600" : "text-muted-foreground"
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
      className="absolute top-4 right-4 z-[1000] w-96 max-h-[calc(100vh-8rem)] overflow-y-auto bg-background rounded-lg border shadow-lg"
      data-testid="panel-weather-insights"
    >
      <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between min-h-14">
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Wind Insights</h3>
        </div>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={onClose}
          data-testid="button-close-weather-insights"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8" data-testid="loading-weather-insights">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive" data-testid="error-weather-insights">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Unable to load weather data</p>
            <p className="text-sm mt-1 text-muted-foreground">Please try again later</p>
          </div>
        ) : !analytics ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-weather-insights">
            <Wind className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No weather data available</p>
            <p className="text-sm mt-1">Weather readings will appear here once buoys report wind data</p>
          </div>
        ) : (
          <>
            <WindTimelineChart
              historyData={historyData}
              buoys={buoys}
              selectedBuoyId={selectedBuoyId}
              onBuoySelect={setSelectedBuoyId}
              isLoading={historyLoading}
            />

            <div data-testid="card-current-conditions">
              <CurrentConditionsCard conditions={analytics.currentConditions} />
            </div>
            
            <div data-testid="card-favored-side">
              <FavoredSideCard analysis={analytics.favoredSide} />
            </div>
            
            <div data-testid="card-wind-pattern">
              <PatternCard pattern={analytics.pattern} />
            </div>

            <div data-testid="card-predictions">
              <PredictionsCard predictions={analytics.predictions} />
            </div>

            <Separator />

            <div data-testid="list-shift-history">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Shifts</h4>
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
