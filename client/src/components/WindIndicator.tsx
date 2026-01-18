import { ArrowUp } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

interface WeatherData {
  windSpeed: number;
  windDirection: number;
  source: string;
}

interface WindIndicatorProps {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  weatherData?: WeatherData | null;
  className?: string;
}

export function WindIndicator({ size = "md", showLabel = true, weatherData, className }: WindIndicatorProps) {
  const { formatSpeed, formatBearing } = useSettings();

  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-20 h-20",
    lg: "w-32 h-32",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-10 h-10",
  };

  const direction = weatherData?.windDirection ?? 0;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)} data-testid="wind-indicator">
      <div 
        className={cn(
          sizeClasses[size],
          "relative rounded-full border-2 border-muted flex items-center justify-center bg-background"
        )}
      >
        <div className="absolute inset-0 rounded-full">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div
              key={deg}
              className="absolute w-0.5 h-2 bg-muted-foreground/30"
              style={{
                top: "50%",
                left: "50%",
                transformOrigin: "center center",
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${size === "lg" ? 56 : size === "md" ? 32 : 20}px)`,
              }}
            />
          ))}
        </div>

        <div className="absolute top-1 text-[10px] font-mono text-muted-foreground">N</div>
        <div className="absolute bottom-1 text-[10px] font-mono text-muted-foreground">S</div>
        <div className="absolute left-1 text-[10px] font-mono text-muted-foreground">W</div>
        <div className="absolute right-1 text-[10px] font-mono text-muted-foreground">E</div>

        <div
          className="transition-transform duration-300"
          style={{ transform: `rotate(${direction + 180}deg)` }}
          title={`Wind blows toward ${((direction + 180) % 360).toFixed(0)}°`}
        >
          <ArrowUp className={cn(iconSizes[size], "text-chart-1")} />
        </div>
      </div>

      {showLabel && (
        <div className="text-center">
          <div className="font-mono text-lg font-medium" data-testid="text-wind-speed-indicator">
            {weatherData ? formatSpeed(weatherData.windSpeed) : "--"}
          </div>
          <div className="text-xs text-muted-foreground" data-testid="text-wind-direction-indicator">
            <span>from </span>
            <span className="font-mono">{weatherData ? formatBearing(direction) : "--"}</span>
          </div>
          <div className="text-xs text-muted-foreground capitalize mt-1">
            {weatherData?.source ?? "unknown"}
          </div>
        </div>
      )}
    </div>
  );
}
