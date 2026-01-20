import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapPin, X, Trash2, Navigation, Flag, FlagTriangleRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Columns2, Check, Wind, RotateCcw, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Mark, Buoy, MarkRole } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";
import { adjustSingleMarkToWind, getStartLineCenter } from "@/lib/course-bearings";

interface MarkEditPanelProps {
  mark: Mark;
  buoys: Buoy[];
  allMarks: Mark[];
  roundingSequence: string[];
  windDirection?: number;
  onClose: () => void;
  onSave: (data: Partial<Mark>) => void;
  onDelete: () => void;
  onMoveToGPS?: () => void;
  onMoveToCoordinates?: (lat: number, lng: number) => void;
  onNudge?: (direction: "north" | "south" | "east" | "west") => void;
  onAdjustToWind?: (lat: number, lng: number) => void;
  lastMovePosition?: { originalLat: number; originalLng: number; timestamp: number } | null;
  onUndoMove?: () => void;
  isGpsLocating?: boolean;
}

const MARK_ROLES: { value: MarkRole; label: string }[] = [
  { value: "start_boat", label: "Committee Boat" },
  { value: "pin", label: "Pin End" },
  { value: "windward", label: "Windward" },
  { value: "wing", label: "Wing" },
  { value: "leeward", label: "Leeward" },
  { value: "offset", label: "Offset" },
  { value: "turning_mark", label: "Turning Point" },
  { value: "finish", label: "Finish" },
  { value: "other", label: "Other" },
];

export function MarkEditPanel({ 
  mark, 
  buoys,
  allMarks,
  roundingSequence,
  windDirection,
  onClose, 
  onSave, 
  onDelete,
  onMoveToGPS,
  onMoveToCoordinates,
  onNudge,
  onAdjustToWind,
  lastMovePosition,
  onUndoMove,
  isGpsLocating,
}: MarkEditPanelProps) {
  const { getWindAngleForRole } = useSettings();
  const [name, setName] = useState(mark.name);
  const [role, setRole] = useState<MarkRole>(mark.role as MarkRole);
  const [lat, setLat] = useState(mark.lat.toString());
  const [lng, setLng] = useState(mark.lng.toString());
  const [assignedBuoyId, setAssignedBuoyId] = useState<string>(mark.assignedBuoyId || "");
  const [isStartLine, setIsStartLine] = useState(mark.isStartLine ?? false);
  const [isFinishLine, setIsFinishLine] = useState(mark.isFinishLine ?? false);
  const [isGate, setIsGate] = useState(mark.isGate ?? false);
  const [gateSide, setGateSide] = useState<"port" | "starboard">((mark.gateSide as "port" | "starboard") ?? "port");
  const [gateWidthBoatLengths, setGateWidthBoatLengths] = useState(mark.gateWidthBoatLengths ?? 8);
  const [boatLengthMeters, setBoatLengthMeters] = useState(mark.boatLengthMeters ?? 6);
  const [gatePortBuoyId, setGatePortBuoyId] = useState<string>(mark.gatePortBuoyId || "");
  const [gateStarboardBuoyId, setGateStarboardBuoyId] = useState<string>(mark.gateStarboardBuoyId || "");
  const [hasChanges, setHasChanges] = useState(false);
  
  const [degreesToWind, setDegreesToWind] = useState(() => getWindAngleForRole(mark.role));
  const [undoTick, setUndoTick] = useState(0);
  const [showCoordinatesDialog, setShowCoordinatesDialog] = useState(false);
  const [coordLat, setCoordLat] = useState(mark.lat.toString());
  const [coordLng, setCoordLng] = useState(mark.lng.toString());
  
  useEffect(() => {
    setDegreesToWind(getWindAngleForRole(role));
  }, [role, getWindAngleForRole]);
  
  useEffect(() => {
    if (!lastMovePosition) return;
    const remainingTime = 60000 - (Date.now() - lastMovePosition.timestamp);
    if (remainingTime <= 0) return;
    const timer = setTimeout(() => setUndoTick((t) => t + 1), remainingTime);
    return () => clearTimeout(timer);
  }, [lastMovePosition]);
  
  const startLineCenter = useMemo(() => {
    return getStartLineCenter(allMarks.map(m => ({ role: m.role, lat: m.lat, lng: m.lng })));
  }, [allMarks]);
  
  const hasStartLine = useMemo(() => {
    const hasPin = allMarks.some(m => m.role === "pin" || (m.isStartLine && m.role !== "start_boat"));
    const hasCB = allMarks.some(m => m.role === "start_boat");
    return hasPin && hasCB;
  }, [allMarks]);
  
  const markPositionInSequence = useMemo(() => {
    const idx = roundingSequence.indexOf(mark.id);
    return idx;
  }, [roundingSequence, mark.id]);
  
  const previousReferencePosition = useMemo(() => {
    if (markPositionInSequence < 0) return null;
    if (markPositionInSequence === 0) return null;
    
    const prevEntry = roundingSequence[markPositionInSequence - 1];
    if (prevEntry === "start") {
      return startLineCenter;
    }
    
    const prevMark = allMarks.find(m => m.id === prevEntry);
    if (prevMark) {
      return { lat: prevMark.lat, lng: prevMark.lng };
    }
    return null;
  }, [markPositionInSequence, roundingSequence, allMarks, startLineCenter]);
  
  const isStartOrFinishMark = mark.isStartLine || mark.isFinishLine || mark.role === "start_boat" || mark.role === "pin" || mark.role === "finish";
  
  const canAdjustToWind = useMemo(() => {
    if (isStartOrFinishMark) return { can: false, reason: "Use line controls for start/finish" };
    if (windDirection === undefined) return { can: false, reason: "No wind data" };
    if (!hasStartLine) return { can: false, reason: "Define start line first" };
    if (markPositionInSequence < 0) return { can: false, reason: "Add to route first" };
    if (markPositionInSequence === 0) return { can: false, reason: "First entry is start" };
    if (!previousReferencePosition) return { can: false, reason: "No reference position" };
    return { can: true, reason: null };
  }, [isStartOrFinishMark, windDirection, hasStartLine, markPositionInSequence, previousReferencePosition]);
  
  const handleAdjustToWind = useCallback(() => {
    if (!canAdjustToWind.can || !previousReferencePosition || windDirection === undefined || !onAdjustToWind) return;
    
    const result = adjustSingleMarkToWind(
      mark.lat,
      mark.lng,
      previousReferencePosition.lat,
      previousReferencePosition.lng,
      windDirection,
      degreesToWind
    );
    
    onAdjustToWind(result.lat, result.lng);
  }, [canAdjustToWind, previousReferencePosition, windDirection, mark.lat, mark.lng, degreesToWind, onAdjustToWind]);

  // Track which fields the user has edited (dirty flags)
  // This prevents external updates from overwriting user edits
  const dirtyFieldsRef = useRef<Set<string>>(new Set());

  const gateWidthMeters = gateWidthBoatLengths * boatLengthMeters;

  // Calculate hasChanges based on local vs mark values
  useEffect(() => {
    const changed = 
      name !== mark.name ||
      role !== mark.role ||
      lat !== mark.lat.toString() ||
      lng !== mark.lng.toString() ||
      assignedBuoyId !== (mark.assignedBuoyId || "") ||
      isStartLine !== (mark.isStartLine ?? false) ||
      isFinishLine !== (mark.isFinishLine ?? false) ||
      isGate !== (mark.isGate ?? false) ||
      gateSide !== (mark.gateSide ?? "port") ||
      gateWidthBoatLengths !== (mark.gateWidthBoatLengths ?? 8) ||
      boatLengthMeters !== (mark.boatLengthMeters ?? 6) ||
      gatePortBuoyId !== (mark.gatePortBuoyId || "") ||
      gateStarboardBuoyId !== (mark.gateStarboardBuoyId || "");
    setHasChanges(changed);
  }, [name, role, lat, lng, assignedBuoyId, isStartLine, isFinishLine, isGate, gateSide, gateWidthBoatLengths, boatLengthMeters, gatePortBuoyId, gateStarboardBuoyId, mark]);

  // Track previous mark ID to detect selection changes
  const prevMarkIdRef = useRef(mark.id);

  // Sync fields from mark prop - only depends on mark prop, not local state
  // Uses dirty flags to preserve user edits
  useEffect(() => {
    const dirty = dirtyFieldsRef.current;
    
    // If mark ID changed, reset everything and clear dirty flags
    if (mark.id !== prevMarkIdRef.current) {
      setName(mark.name);
      setRole(mark.role as MarkRole);
      setLat(mark.lat.toString());
      setLng(mark.lng.toString());
      setAssignedBuoyId(mark.assignedBuoyId || "");
      setIsStartLine(mark.isStartLine ?? false);
      setIsFinishLine(mark.isFinishLine ?? false);
      setIsGate(mark.isGate ?? false);
      setGateSide((mark.gateSide as "port" | "starboard") ?? "port");
      setGateWidthBoatLengths(mark.gateWidthBoatLengths ?? 8);
      setBoatLengthMeters(mark.boatLengthMeters ?? 6);
      setGatePortBuoyId(mark.gatePortBuoyId || "");
      setGateStarboardBuoyId(mark.gateStarboardBuoyId || "");
      setHasChanges(false);
      dirtyFieldsRef.current = new Set();
      prevMarkIdRef.current = mark.id;
      return;
    }
    
    // Same mark - sync only non-dirty fields from external updates
    if (!dirty.has("lat")) setLat(mark.lat.toString());
    if (!dirty.has("lng")) setLng(mark.lng.toString());
    if (!dirty.has("name")) setName(mark.name);
    if (!dirty.has("role")) setRole(mark.role as MarkRole);
    if (!dirty.has("assignedBuoyId")) setAssignedBuoyId(mark.assignedBuoyId || "");
    if (!dirty.has("isStartLine")) setIsStartLine(mark.isStartLine ?? false);
    if (!dirty.has("isFinishLine")) setIsFinishLine(mark.isFinishLine ?? false);
    if (!dirty.has("isGate")) setIsGate(mark.isGate ?? false);
    if (!dirty.has("gateSide")) setGateSide((mark.gateSide as "port" | "starboard") ?? "port");
    if (!dirty.has("gateWidthBoatLengths")) setGateWidthBoatLengths(mark.gateWidthBoatLengths ?? 8);
    if (!dirty.has("boatLengthMeters")) setBoatLengthMeters(mark.boatLengthMeters ?? 6);
    if (!dirty.has("gatePortBuoyId")) setGatePortBuoyId(mark.gatePortBuoyId || "");
    if (!dirty.has("gateStarboardBuoyId")) setGateStarboardBuoyId(mark.gateStarboardBuoyId || "");
  }, [mark]);
  
  // Wrapper functions to mark fields as dirty when user edits them
  const setNameDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("name");
    setName(value);
  }, []);
  const setRoleDirty = useCallback((value: MarkRole) => {
    dirtyFieldsRef.current.add("role");
    setRole(value);
  }, []);
  const setLatDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("lat");
    setLat(value);
  }, []);
  const setLngDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("lng");
    setLng(value);
  }, []);
  const setAssignedBuoyIdDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("assignedBuoyId");
    setAssignedBuoyId(value);
  }, []);
  const setIsStartLineDirty = useCallback((value: boolean) => {
    dirtyFieldsRef.current.add("isStartLine");
    setIsStartLine(value);
  }, []);
  const setIsFinishLineDirty = useCallback((value: boolean) => {
    dirtyFieldsRef.current.add("isFinishLine");
    setIsFinishLine(value);
  }, []);
  const setIsGateDirty = useCallback((value: boolean) => {
    dirtyFieldsRef.current.add("isGate");
    // When converting to a gate, also mark gateSide as dirty to ensure it's sent
    if (value) {
      dirtyFieldsRef.current.add("gateSide");
    }
    setIsGate(value);
  }, []);
  const setGateSideDirty = useCallback((value: "port" | "starboard") => {
    dirtyFieldsRef.current.add("gateSide");
    setGateSide(value);
  }, []);
  const setGateWidthBoatLengthsDirty = useCallback((value: number) => {
    dirtyFieldsRef.current.add("gateWidthBoatLengths");
    setGateWidthBoatLengths(value);
  }, []);
  const setBoatLengthMetersDirty = useCallback((value: number) => {
    dirtyFieldsRef.current.add("boatLengthMeters");
    setBoatLengthMeters(value);
  }, []);
  const setGatePortBuoyIdDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("gatePortBuoyId");
    setGatePortBuoyId(value);
  }, []);
  const setGateStarboardBuoyIdDirty = useCallback((value: string) => {
    dirtyFieldsRef.current.add("gateStarboardBuoyId");
    setGateStarboardBuoyId(value);
  }, []);

  // Sync role with isGate to satisfy validation constraints
  // These are cascading effects from user toggling isGate, so mark fields dirty
  const prevIsGateRef = useRef(isGate);
  useEffect(() => {
    const wasGate = prevIsGateRef.current;
    prevIsGateRef.current = isGate;
    
    if (isGate && !wasGate) {
      // Turning gate ON: clear single buoy and set role if needed
      dirtyFieldsRef.current.add("assignedBuoyId");
      setAssignedBuoyId("");
      if (!["gate", "leeward", "windward"].includes(role)) {
        dirtyFieldsRef.current.add("role");
        setRole("gate");
      }
    } else if (!isGate && wasGate) {
      // Turning gate OFF: reset role if it was "gate"
      if (role === "gate") {
        dirtyFieldsRef.current.add("role");
        setRole("turning_mark");
      }
    }
  }, [isGate, role]);
  
  // Autosave with debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  const doSave = useCallback(() => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return;
    }

    setSaveStatus("saving");
    onSave({
      name,
      role,
      lat: latNum,
      lng: lngNum,
      assignedBuoyId: isGate ? null : (assignedBuoyId || null),
      isStartLine,
      isFinishLine,
      isGate,
      gateSide: isGate ? gateSide : null,
      gateWidthBoatLengths: isGate ? gateWidthBoatLengths : null,
      boatLengthMeters: isGate ? boatLengthMeters : null,
      gatePortBuoyId: isGate ? (gatePortBuoyId || null) : null,
      gateStarboardBuoyId: isGate ? (gateStarboardBuoyId || null) : null,
    });
    
    // Clear dirty flags after save - server now has these values
    dirtyFieldsRef.current = new Set();
    
    setTimeout(() => setSaveStatus("saved"), 100);
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [name, role, lat, lng, assignedBuoyId, isStartLine, isFinishLine, isGate, gateSide, gateWidthBoatLengths, boatLengthMeters, gatePortBuoyId, gateStarboardBuoyId, onSave]);

  // Autosave when any field changes (debounced)
  useEffect(() => {
    if (!hasChanges) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      doSave();
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasChanges, doSave]);


  const availableBuoys = buoys.filter(b => 
    b.state !== "maintenance" && 
    b.state !== "fault" && 
    b.state !== "unavailable"
  );

  const assignedBuoy = buoys.find(b => b.id === mark.assignedBuoyId);

  return (
    <div className="h-full flex flex-col bg-card" data-testid="mark-edit-panel">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Edit Point</h2>
            <p className="text-xs text-muted-foreground">Modify point properties</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-mark-edit">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Position controls - most important, always visible without scrolling */}
      <div className="p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Position</Label>
          <div className="flex items-center gap-2">
            {onMoveToGPS && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={onMoveToGPS}
                disabled={isGpsLocating}
                title={isGpsLocating ? "Locating..." : "Move to current GPS position"}
                data-testid="button-move-to-gps"
              >
                <Crosshair className={`w-5 h-5 ${isGpsLocating ? "animate-pulse" : ""}`} />
              </Button>
            )}
            {onMoveToCoordinates && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  setCoordLat(mark.lat.toString());
                  setCoordLng(mark.lng.toString());
                  setShowCoordinatesDialog(true);
                }}
                title="Enter specific coordinates"
                data-testid="button-enter-coordinates"
              >
                <MapPin className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Prominent nudge controls for wet finger use */}
        {onNudge && (
          <div className="flex items-center justify-center gap-2">
            <Button 
              variant="outline" 
              className="h-14 w-14 p-0" 
              onClick={() => onNudge("west")} 
              data-testid="button-nudge-west"
            >
              <ChevronLeft className="w-7 h-7" />
            </Button>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                className="h-14 w-14 p-0" 
                onClick={() => onNudge("north")} 
                data-testid="button-nudge-north"
              >
                <ChevronUp className="w-7 h-7" />
              </Button>
              <Button 
                variant="outline" 
                className="h-14 w-14 p-0" 
                onClick={() => onNudge("south")} 
                data-testid="button-nudge-south"
              >
                <ChevronDown className="w-7 h-7" />
              </Button>
            </div>
            <Button 
              variant="outline" 
              className="h-14 w-14 p-0" 
              onClick={() => onNudge("east")} 
              data-testid="button-nudge-east"
            >
              <ChevronRight className="w-7 h-7" />
            </Button>
            <div className="ml-4 text-xs text-muted-foreground font-mono">
              {parseFloat(lat).toFixed(4)}<br/>{parseFloat(lng).toFixed(4)}
            </div>
          </div>
        )}
        
        {/* Undo button - appears after any position change */}
        {lastMovePosition && onUndoMove && (Date.now() - lastMovePosition.timestamp) < 60000 && (
          <Button
            variant="outline"
            size="lg"
            className="w-full mt-3 gap-2 border-orange-500 text-orange-600"
            onClick={onUndoMove}
            data-testid="button-undo-move"
          >
            <RotateCcw className="w-4 h-4" />
            Undo Move
          </Button>
        )}
      </div>

      {!isStartOrFinishMark && (
        <div className="p-3 border-b bg-blue-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="w-4 h-4 text-blue-500" />
            <Label className="text-sm font-medium">Adjust to Wind</Label>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={-180}
                max={360}
                value={degreesToWind}
                onChange={(e) => setDegreesToWind(parseInt(e.target.value) || 0)}
                className="w-20 h-12 text-center text-lg font-mono"
                disabled={!canAdjustToWind.can}
                data-testid="input-degrees-to-wind"
              />
              <span className="text-sm text-muted-foreground">° to wind</span>
            </div>
            
            <Button
              variant="default"
              className="flex-1 h-12 gap-2"
              onClick={handleAdjustToWind}
              disabled={!canAdjustToWind.can || !onAdjustToWind}
              data-testid="button-adjust-to-wind"
            >
              <Wind className="w-4 h-4" />
              Adjust to Wind
            </Button>
          </div>
          
          {!canAdjustToWind.can && canAdjustToWind.reason && (
            <p className="text-xs text-muted-foreground mt-2">{canAdjustToWind.reason}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="mark-name" className="text-xs">Name</Label>
            <Input
              id="mark-name"
              value={name}
              onChange={(e) => setNameDirty(e.target.value)}
              placeholder="Point name"
              data-testid="input-mark-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mark-role" className="text-xs">Role</Label>
            <Select value={role} onValueChange={(v) => setRoleDirty(v as MarkRole)}>
              <SelectTrigger id="mark-role" data-testid="select-mark-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {MARK_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlagTriangleRight className="w-4 h-4 text-green-500" />
                <Label htmlFor="start-line" className="text-sm font-medium cursor-pointer">
                  Start Line Mark
                </Label>
              </div>
              <Switch
                id="start-line"
                checked={isStartLine}
                onCheckedChange={setIsStartLineDirty}
                data-testid="switch-start-line"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-500" />
                <Label htmlFor="finish-line" className="text-sm font-medium cursor-pointer">
                  Finish Line Mark
                </Label>
              </div>
              <Switch
                id="finish-line"
                checked={isFinishLine}
                onCheckedChange={setIsFinishLineDirty}
                data-testid="switch-finish-line"
              />
            </div>
            {isStartLine && isFinishLine && (
              <p className="text-xs text-muted-foreground">
                This mark is used for both start and finish lines.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Columns2 className="w-4 h-4 text-orange-500" />
                <Label htmlFor="gate-toggle" className="text-sm font-medium cursor-pointer">
                  Gate (Two Buoys)
                </Label>
              </div>
              <Switch
                id="gate-toggle"
                checked={isGate}
                onCheckedChange={setIsGateDirty}
                data-testid="switch-gate"
              />
            </div>
            
            {isGate && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  A gate consists of two buoys. Boats sail between them and may round either.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gate-width" className="text-xs text-muted-foreground">
                      Width (boat lengths)
                    </Label>
                    <Input
                      id="gate-width"
                      type="number"
                      min="4"
                      max="20"
                      step="1"
                      value={gateWidthBoatLengths}
                      onChange={(e) => setGateWidthBoatLengthsDirty(parseFloat(e.target.value) || 8)}
                      className="text-sm"
                      data-testid="input-gate-width"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="boat-length" className="text-xs text-muted-foreground">
                      Boat length (m)
                    </Label>
                    <Input
                      id="boat-length"
                      type="number"
                      min="2"
                      max="20"
                      step="0.5"
                      value={boatLengthMeters}
                      onChange={(e) => setBoatLengthMetersDirty(parseFloat(e.target.value) || 6)}
                      className="text-sm"
                      data-testid="input-boat-length"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-background/50 rounded-md px-3 py-2">
                  <span className="text-xs text-muted-foreground">Gate Width</span>
                  <span className="text-sm font-medium">{gateWidthMeters.toFixed(0)}m</span>
                </div>
                
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Recommended: 8-10 boat lengths for safe racing
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {isGate ? (
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Columns2 className="w-4 h-4 text-orange-500" />
              Gate Buoy Assignments
            </Label>
            <p className="text-xs text-muted-foreground">
              Gates require two buoys - one for port (red) and one for starboard (green).
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="gate-port-buoy" className="text-xs flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  Port Buoy
                </Label>
                <Select 
                  value={gatePortBuoyId || "unassigned"} 
                  onValueChange={(v) => setGatePortBuoyIdDirty(v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger id="gate-port-buoy" data-testid="select-gate-port-buoy">
                    <SelectValue placeholder="Select buoy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {availableBuoys
                      .filter(b => b.id !== gateStarboardBuoyId)
                      .map((buoy) => (
                        <SelectItem key={buoy.id} value={buoy.id}>
                          {buoy.name} ({buoy.battery}%)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="gate-starboard-buoy" className="text-xs flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Starboard Buoy
                </Label>
                <Select 
                  value={gateStarboardBuoyId || "unassigned"} 
                  onValueChange={(v) => setGateStarboardBuoyIdDirty(v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger id="gate-starboard-buoy" data-testid="select-gate-starboard-buoy">
                    <SelectValue placeholder="Select buoy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {availableBuoys
                      .filter(b => b.id !== gatePortBuoyId)
                      .map((buoy) => (
                        <SelectItem key={buoy.id} value={buoy.id}>
                          {buoy.name} ({buoy.battery}%)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(gatePortBuoyId || gateStarboardBuoyId) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {gatePortBuoyId && (
                  <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
                    Port: {buoys.find(b => b.id === gatePortBuoyId)?.name}
                  </Badge>
                )}
                {gateStarboardBuoyId && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                    Starboard: {buoys.find(b => b.id === gateStarboardBuoyId)?.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="assigned-buoy">Assigned Buoy</Label>
            <Select value={assignedBuoyId || "unassigned"} onValueChange={(v) => setAssignedBuoyIdDirty(v === "unassigned" ? "" : v)}>
              <SelectTrigger id="assigned-buoy" data-testid="select-assigned-buoy">
                <SelectValue placeholder="Select buoy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {availableBuoys.map((buoy) => (
                  <SelectItem key={buoy.id} value={buoy.id}>
                    {buoy.name} ({buoy.battery}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignedBuoy && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">{assignedBuoy.name}</Badge>
                <span className="text-xs text-muted-foreground">
                  Battery: {assignedBuoy.battery}% | Signal: {assignedBuoy.signalStrength}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-3">
        {/* Autosave status indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {saveStatus === "saving" && (
            <span className="animate-pulse">Saving...</span>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Saved</span>
            </>
          )}
          {saveStatus === "idle" && !hasChanges && (
            <span className="text-xs">All changes saved automatically</span>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              data-testid="button-delete-mark"
            >
              <Trash2 className="w-4 h-4" />
              Delete Mark
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{mark.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. 
                {mark.assignedBuoyId && " The assigned buoy will be unassigned."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} data-testid="button-confirm-delete">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      {/* Coordinates Dialog */}
      <Dialog open={showCoordinatesDialog} onOpenChange={setShowCoordinatesDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Coordinates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coord-lat">Latitude</Label>
              <Input
                id="coord-lat"
                type="number"
                step="0.0001"
                value={coordLat}
                onChange={(e) => setCoordLat(e.target.value)}
                placeholder="e.g. 51.5074"
                className="text-lg font-mono"
                data-testid="input-coord-lat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord-lng">Longitude</Label>
              <Input
                id="coord-lng"
                type="number"
                step="0.0001"
                value={coordLng}
                onChange={(e) => setCoordLng(e.target.value)}
                placeholder="e.g. -0.1278"
                className="text-lg font-mono"
                data-testid="input-coord-lng"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCoordinatesDialog(false)} data-testid="button-coord-cancel">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const parsedLat = parseFloat(coordLat);
                const parsedLng = parseFloat(coordLng);
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                  onMoveToCoordinates?.(parsedLat, parsedLng);
                  setShowCoordinatesDialog(false);
                }
              }}
              disabled={isNaN(parseFloat(coordLat)) || isNaN(parseFloat(coordLng))}
              data-testid="button-place-at-coordinates"
            >
              Place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
