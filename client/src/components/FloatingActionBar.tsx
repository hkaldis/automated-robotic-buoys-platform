import { Compass, Play, Square, Undo2, CheckCircle2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FloatingActionBarProps {
  onAlignToWind?: () => void;
  onDeployAll?: () => void;
  onHoldAll?: () => void;
  onUndo?: () => void;
  onFleetClick?: () => void;
  canAlign?: boolean;
  canDeploy?: boolean;
  canHold?: boolean;
  canUndo?: boolean;
  isDeploying?: boolean;
  deployingCount?: number;
  totalBuoys?: number;
  onStationCount?: number;
  movingCount?: number;
  needsWindAlignment?: boolean;
  showFleet?: boolean;
  hasFaultOrLowBattery?: boolean;
}

export function FloatingActionBar({
  onAlignToWind,
  onDeployAll,
  onHoldAll,
  onUndo,
  onFleetClick,
  canAlign = false,
  canDeploy = false,
  canHold = false,
  canUndo = false,
  isDeploying = false,
  deployingCount = 0,
  totalBuoys = 0,
  onStationCount = 0,
  movingCount = 0,
  needsWindAlignment = false,
  showFleet = false,
  hasFaultOrLowBattery = false,
}: FloatingActionBarProps) {
  const allOnStation = totalBuoys > 0 && onStationCount === totalBuoys && movingCount === 0;
  const hasAssignedBuoys = totalBuoys > 0;
  const pendingDeploy = totalBuoys - onStationCount;

  return (
    <div 
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-2 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg transition-colors",
        allOnStation && "border-green-500 ring-2 ring-green-500/30"
      )}
      data-testid="floating-action-bar"
    >
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
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className={cn(canAlign && "text-primary")}
              onClick={onAlignToWind}
              disabled={!canAlign}
              data-testid="button-align-to-wind-fab"
            >
              <Compass className="h-5 w-5" />
            </Button>
            {needsWindAlignment && canAlign && (
              <span 
                className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"
                data-testid="indicator-needs-alignment"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{needsWindAlignment ? "Course needs wind alignment" : "Align Course to Wind"}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className={cn(canDeploy && "text-green-500")}
              onClick={onDeployAll}
              disabled={!canDeploy || isDeploying}
              data-testid="button-deploy-all-fab"
            >
              <Play className="h-5 w-5" />
            </Button>
            {pendingDeploy > 0 && canDeploy && (
              <span 
                className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center bg-green-500 text-white text-[10px] font-bold rounded-full"
                data-testid="badge-deploy-count"
              >
                {pendingDeploy}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{isDeploying ? `Deploying ${deployingCount}/${totalBuoys}...` : `Deploy ${pendingDeploy} Buoy${pendingDeploy !== 1 ? 's' : ''}`}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(canHold && "text-orange-500")}
            onClick={onHoldAll}
            disabled={!canHold}
            data-testid="button-hold-all-fab"
          >
            <Square className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Hold All Buoys</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={canUndo ? "destructive" : "ghost"}
            onClick={onUndo}
            disabled={!canUndo}
            data-testid="button-undo-fab"
          >
            <Undo2 className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Undo Last Action</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <Button
              size="icon"
              variant="ghost"
              className={cn(showFleet && "bg-primary/10 text-primary")}
              onClick={onFleetClick}
              data-testid="button-fleet-fab"
            >
              <Radio className="h-5 w-5" />
            </Button>
            {hasFaultOrLowBattery && (
              <span 
                className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"
                data-testid="indicator-fleet-alert"
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{hasFaultOrLowBattery ? "Fleet Status - Attention Required" : "Fleet Status"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
