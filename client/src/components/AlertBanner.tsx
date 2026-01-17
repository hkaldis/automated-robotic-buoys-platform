import { AlertTriangle, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlertBannerProps {
  onDismiss?: () => void;
  onRotateCourse?: () => void;
}

export function AlertBanner({ onDismiss, onRotateCourse }: AlertBannerProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20",
        "animate-in slide-in-from-top-2 duration-300"
      )}
      data-testid="alert-banner"
    >
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive">Course Validity Alert</p>
        <p className="text-xs text-destructive/80 mt-0.5">
          Wind conditions may have changed. Consider adjusting the course.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={onRotateCourse}
          data-testid="button-rotate-course"
        >
          <RotateCcw className="w-4 h-4" />
          Adjust Course
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive hover:bg-destructive/10"
          onClick={onDismiss}
          data-testid="button-dismiss-alert"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
