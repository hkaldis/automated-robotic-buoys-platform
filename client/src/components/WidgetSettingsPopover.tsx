import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface WidgetSettingsPopoverProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

export function WidgetSettingsPopover({
  children,
  title,
  className,
  triggerClassName,
  align = "end",
  side = "bottom",
}: WidgetSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 text-muted-foreground hover:text-foreground",
            triggerClassName
          )}
          data-testid="button-widget-settings"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className={cn("w-72 p-3", className)}
      >
        {title && (
          <div className="mb-3 text-sm font-medium">{title}</div>
        )}
        <div className="space-y-3">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
