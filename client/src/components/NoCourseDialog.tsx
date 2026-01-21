import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, FolderOpen, Navigation } from "lucide-react";
import { useCourseSnapshots, type CourseSnapshot } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface NoCourseDialogProps {
  open: boolean;
  eventName?: string;
  onCreateCustom: () => void;
  onLoadSaved: (snapshot: CourseSnapshot) => void;
  isCreating?: boolean;
  isLoading?: boolean;
}

export function NoCourseDialog({
  open,
  eventName,
  onCreateCustom,
  onLoadSaved,
  isCreating = false,
  isLoading = false,
}: NoCourseDialogProps) {
  const [view, setView] = useState<"choice" | "browse">("choice");
  const [selectedSnapshot, setSelectedSnapshot] = useState<CourseSnapshot | null>(null);

  const { data: snapshotsData, isLoading: isLoadingSnapshots } = useCourseSnapshots({
    limit: 50,
  });

  const snapshots = snapshotsData?.snapshots || [];

  // Reset dialog state when opened or event changes
  useEffect(() => {
    if (open) {
      setView("choice");
      setSelectedSnapshot(null);
    }
  }, [open, eventName]);

  const handleBack = () => {
    setView("choice");
    setSelectedSnapshot(null);
  };

  const handleSelectSnapshot = (snapshot: CourseSnapshot) => {
    setSelectedSnapshot(snapshot);
  };

  const handleConfirmLoad = () => {
    if (selectedSnapshot) {
      onLoadSaved(selectedSnapshot);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent 
        className="sm:max-w-lg" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            {view === "choice" ? "Set Up Course" : "Load Saved Course"}
          </DialogTitle>
          <DialogDescription>
            {view === "choice" 
              ? `No course is set up for "${eventName || "this event"}". Choose how to proceed.`
              : "Select a saved course to load for this event."
            }
          </DialogDescription>
        </DialogHeader>

        {view === "choice" ? (
          <div className="grid gap-3 py-4">
            <Card 
              className={cn(
                "p-4 cursor-pointer transition-colors hover-elevate",
                "border-2 border-transparent hover:border-primary/50"
              )}
              onClick={onCreateCustom}
              data-testid="button-create-custom-course"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Create Custom Course</h3>
                  <p className="text-sm text-muted-foreground">
                    Start fresh with the course setup wizard
                  </p>
                </div>
                {isCreating && <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
            </Card>

            <Card 
              className={cn(
                "p-4 cursor-pointer transition-colors hover-elevate",
                "border-2 border-transparent hover:border-primary/50",
                snapshots.length === 0 && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => snapshots.length > 0 && setView("browse")}
              data-testid="button-load-saved-course"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/50">
                  <FolderOpen className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Load Saved Course</h3>
                  <p className="text-sm text-muted-foreground">
                    {snapshots.length > 0 
                      ? `${snapshots.length} saved course${snapshots.length !== 1 ? "s" : ""} available`
                      : "No saved courses available"
                    }
                  </p>
                </div>
                {isLoadingSnapshots && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </Card>
          </div>
        ) : (
          <div className="py-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {snapshots.map((snapshot) => (
                  <Card
                    key={snapshot.id}
                    className={cn(
                      "p-3 cursor-pointer transition-colors",
                      selectedSnapshot?.id === snapshot.id 
                        ? "border-primary bg-primary/5" 
                        : "hover-elevate"
                    )}
                    onClick={() => handleSelectSnapshot(snapshot)}
                    data-testid={`snapshot-${snapshot.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{snapshot.name}</span>
                          {snapshot.visibilityScope === "global" && (
                            <Badge variant="secondary" className="text-xs">Template</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {snapshot.shape} • {snapshot.snapshotMarks?.length || 0} points
                          {snapshot.sailClubName && ` • ${snapshot.sailClubName}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={handleConfirmLoad} 
                disabled={!selectedSnapshot || isLoading}
                className="flex-1"
                data-testid="button-confirm-load-course"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load Course"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
