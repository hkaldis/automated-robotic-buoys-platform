import { Wifi, Settings, Menu, ToggleLeft, ToggleRight, Maximize, Minimize, Save, FolderOpen, ArrowLeft, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreateRaceDialog } from "./CreateRaceDialog";
import type { CourseShape, EventType, Course } from "@shared/schema";

interface TopBarProps {
  eventName: string;
  clubName: string;
  demoMode?: boolean;
  savedCourses?: Course[];
  userRole?: string;
  onMenuClick?: () => void;
  onSettingsClick?: () => void;
  onToggleDemoMode?: () => void;
  onBackClick?: () => void;
  onClearCourse?: () => void;
  onCreateRace?: (data: {
    name: string;
    type: EventType;
    boatClass: string;
    targetDuration: number;
    courseShape: CourseShape;
    courseName: string;
  }) => void;
  onSaveCourse?: (name: string) => void;
  onLoadCourse?: (courseId: string) => void;
}

export function TopBar({ 
  eventName, 
  clubName, 
  demoMode,
  savedCourses = [],
  userRole,
  onMenuClick, 
  onSettingsClick,
  onToggleDemoMode,
  onBackClick,
  onClearCourse,
  onCreateRace,
  onSaveCourse,
  onLoadCourse,
}: TopBarProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [courseName, setCourseName] = useState("");

  const handleSaveCourse = () => {
    if (courseName.trim() && onSaveCourse) {
      onSaveCourse(courseName.trim());
      setCourseName("");
      setShowSaveDialog(false);
    }
  };

  const handleLoadCourse = (courseId: string) => {
    onLoadCourse?.(courseId);
    setShowLoadDialog(false);
  };

  const getFullscreenElement = useCallback(() => {
    const doc = document as any;
    return document.fullscreenElement || doc.webkitFullscreenElement;
  }, []);

  const updateFullscreenState = useCallback(() => {
    setIsFullscreen(!!getFullscreenElement());
  }, [getFullscreenElement]);

  useEffect(() => {
    updateFullscreenState();
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    };
  }, [updateFullscreenState]);

  const toggleFullscreen = useCallback(() => {
    const docEl = document.documentElement as any;
    const doc = document as any;
    
    if (!getFullscreenElement()) {
      const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      if (requestFs) {
        const promise = requestFs.call(docEl);
        if (promise && promise.then) {
          promise.then(updateFullscreenState).catch(() => {});
        }
      }
    } else {
      const exitFs = document.exitFullscreen || doc.webkitExitFullscreen;
      if (exitFs) {
        const promise = exitFs.call(document);
        if (promise && promise.then) {
          promise.then(updateFullscreenState).catch(() => {});
        }
      }
    }
  }, [getFullscreenElement, updateFullscreenState]);

  return (
    <header className="h-16 border-b bg-card flex items-center px-4 gap-4 shrink-0 sticky top-0 z-[9999]" data-testid="topbar">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onMenuClick}
        className="lg:hidden"
        data-testid="button-menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {onBackClick && (userRole === "super_admin" || userRole === "club_manager") && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onBackClick}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {userRole === "super_admin" ? "Back to clubs" : "Back to events"}
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-primary">RB</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate" data-testid="text-event-name">{eventName}</h1>
          <p className="text-xs text-muted-foreground truncate">{clubName}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onToggleDemoMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant={demoMode ? "default" : "outline"} 
                size="sm"
                onClick={onToggleDemoMode}
                className="gap-2"
                data-testid="button-demo-toggle"
              >
                {demoMode ? (
                  <ToggleRight className="w-4 h-4" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Demo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {demoMode ? "Demo mode ON - using simulated buoys" : "Enable demo mode"}
            </TooltipContent>
          </Tooltip>
        )}

        {demoMode && (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            DEMO
          </Badge>
        )}

        {onCreateRace && (
          <CreateRaceDialog onCreateRace={onCreateRace} />
        )}

        {onSaveCourse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                className="gap-2"
                data-testid="button-save-course"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save current course</TooltipContent>
          </Tooltip>
        )}

        {onLoadCourse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowLoadDialog(true)}
                className="gap-2"
                data-testid="button-load-course"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Load</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Load saved course</TooltipContent>
          </Tooltip>
        )}

        {onClearCourse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClearCourse}
                data-testid="button-clear-course"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear course</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wifi className={`w-4 h-4 ${demoMode ? "text-yellow-500" : "text-green-500"}`} />
              <span className="hidden sm:inline">{demoMode ? "Simulated" : "Connected"}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {demoMode ? "Using simulated buoys" : "All buoys connected"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleFullscreen}
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          </TooltipContent>
        </Tooltip>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Course</DialogTitle>
            <DialogDescription>
              Save the current course layout for future use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course-name">Course Name</Label>
              <Input
                id="course-name"
                placeholder="Enter course name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                data-testid="input-course-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCourse} disabled={!courseName.trim()} data-testid="button-confirm-save-course">
              Save Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Course</DialogTitle>
            <DialogDescription>
              Select a saved course to load.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
            {savedCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No saved courses available.
              </p>
            ) : (
              savedCourses.map((course) => (
                <Button
                  key={course.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleLoadCourse(course.id)}
                  data-testid={`button-load-course-${course.id}`}
                >
                  {course.name}
                </Button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
