import { useState } from "react";
import { Users, Anchor, Flag, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RaceType = "fleet" | "match" | "team";

interface BoatCountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: { raceType: RaceType; boatCount?: number }) => void;
  defaultBoatCount?: number;
}

export function BoatCountDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultBoatCount = 10,
}: BoatCountDialogProps) {
  const [raceType, setRaceType] = useState<RaceType>("fleet");
  const [boatCount, setBoatCount] = useState(defaultBoatCount);

  const handleConfirm = () => {
    onConfirm({ raceType, boatCount: raceType === "fleet" ? boatCount : undefined });
    onOpenChange(false);
  };

  const incrementCount = () => setBoatCount(prev => Math.min(prev + 1, 200));
  const decrementCount = () => setBoatCount(prev => Math.max(prev - 1, 2));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="title-boat-count-dialog">
            <Anchor className="h-5 w-5" />
            Start Line Setup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground" data-testid="text-boat-count-description">
            Select race type to optimize start line length.
          </p>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="lg"
              className={cn(
                "flex flex-col gap-1 py-4 toggle-elevate",
                raceType === "fleet" && "toggle-elevated ring-2 ring-primary"
              )}
              onClick={() => setRaceType("fleet")}
              data-testid="button-race-type-fleet"
            >
              <Users className="h-6 w-6" />
              <span className="text-xs font-medium">Fleet Race</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={cn(
                "flex flex-col gap-1 py-4 toggle-elevate",
                raceType === "match" && "toggle-elevated ring-2 ring-primary"
              )}
              onClick={() => setRaceType("match")}
              data-testid="button-race-type-match"
            >
              <Flag className="h-6 w-6" />
              <span className="text-xs font-medium">Match Race</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className={cn(
                "flex flex-col gap-1 py-4 toggle-elevate",
                raceType === "team" && "toggle-elevated ring-2 ring-primary"
              )}
              onClick={() => setRaceType("team")}
              data-testid="button-race-type-team"
            >
              <Anchor className="h-6 w-6" />
              <span className="text-xs font-medium">Team Race</span>
            </Button>
          </div>

          {raceType === "fleet" && (
            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium" data-testid="label-boat-count">Number of Boats</label>
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={decrementCount}
                  disabled={boatCount <= 2}
                  data-testid="button-decrement-boats"
                >
                  <Minus className="h-6 w-6" />
                </Button>
                <div className="w-24 text-center">
                  <span className="text-4xl font-bold" data-testid="text-boat-count">{boatCount}</span>
                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-boat-count-unit">boats</p>
                </div>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={incrementCount}
                  disabled={boatCount >= 200}
                  data-testid="button-increment-boats"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center" data-testid="text-start-line-formula">
                Start line will be {boatCount} boats x 1.5 boat lengths
              </p>
            </div>
          )}

          {raceType === "match" && (
            <div className="bg-muted/50 rounded-lg p-4 text-center" data-testid="info-match-race">
              <p className="text-sm text-muted-foreground">
                Start line sized for 2-boat match racing.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                25-second crossing time at broad reach
              </p>
            </div>
          )}

          {raceType === "team" && (
            <div className="bg-muted/50 rounded-lg p-4 text-center" data-testid="info-team-race">
              <p className="text-sm text-muted-foreground">
                Start line sized for team racing.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                25-second crossing time at broad reach
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-boat-count"
          >
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={handleConfirm}
            className="flex-1"
            data-testid="button-confirm-boat-count"
          >
            Set Start Line
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
