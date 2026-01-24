import { Compass, Play, Square, Undo2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  onAlignToWind?: () => void;
  onDeployAll?: () => void;
  onHoldAll?: () => void;
  onUndo?: () => void;
  canAlign?: boolean;
  canDeploy?: boolean;
  canHold?: boolean;
  canUndo?: boolean;
  isDeploying?: boolean;
  deployingCount?: number;
  totalBuoys?: number;
  onStationCount?: number;
  movingCount?: number;
}

export function FloatingActionBar({
  onAlignToWind,
  onDeployAll,
  onHoldAll,
  onUndo,
  canAlign = false,
  canDeploy = false,
  canHold = false,
  canUndo = false,
  isDeploying = false,
  deployingCount = 0,
  totalBuoys = 0,
  onStationCount = 0,
  movingCount = 0,
}: FloatingActionBarProps) {
  const allOnStation = totalBuoys > 0 && onStationCount === totalBuoys && movingCount === 0;
  const hasAssignedBuoys = totalBuoys > 0;

  return (
    <div 
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 px-4 py-2 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg transition-colors",
        allOnStation && "border-green-500 ring-2 ring-green-500/30"
      )}
      data-testid="floating-action-bar"
    >
      {/* All Green Status Indicator */}
      {hasAssignedBuoys && (
        <div 
          className={cn(
            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium transition-colors",
            allOnStation ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
          )}
          data-testid="status-all-green"
        >
          {allOnStation ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              <span>All On Station</span>
            </>
          ) : (
            <span>{onStationCount}/{totalBuoys} On Station</span>
          )}
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            className={cn(
              "h-14 w-14 rounded-full p-0",
              canAlign && "text-primary"
            )}
            onClick={onAlignToWind}
            disabled={!canAlign}
            data-testid="button-align-to-wind-fab"
          >
            <Compass className="h-7 w-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Align Course to Wind</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            className={cn(
              "h-14 w-14 rounded-full p-0",
              canDeploy && "text-green-500"
            )}
            onClick={onDeployAll}
            disabled={!canDeploy || isDeploying}
            data-testid="button-deploy-all-fab"
          >
            <Play className="h-7 w-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{isDeploying ? `Deploying ${deployingCount}/${totalBuoys}...` : "Deploy All Buoys"}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            className={cn(
              "h-14 w-14 rounded-full p-0",
              canHold && "text-destructive"
            )}
            onClick={onHoldAll}
            disabled={!canHold}
            data-testid="button-hold-all-fab"
          >
            <Square className="h-7 w-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Hold All Buoys</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="lg"
            variant="ghost"
            className={cn(
              "h-14 w-14 rounded-full p-0",
              canUndo && "text-orange-500"
            )}
            onClick={onUndo}
            disabled={!canUndo}
            data-testid="button-undo-fab"
          >
            <Undo2 className="h-7 w-7" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Undo Last Action</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
