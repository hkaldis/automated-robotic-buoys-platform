import { useState, useEffect } from "react";
import { MapPin, X, Trash2, Save, Navigation, Flag, FlagTriangleRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Mark, Buoy, MarkRole } from "@shared/schema";

interface MarkEditPanelProps {
  mark: Mark;
  buoys: Buoy[];
  onClose: () => void;
  onSave: (data: Partial<Mark>) => void;
  onDelete: () => void;
  onReposition?: () => void;
  onNudge?: (direction: "north" | "south" | "east" | "west") => void;
  isRepositioning?: boolean;
}

const MARK_ROLES: { value: MarkRole; label: string }[] = [
  { value: "start_boat", label: "Committee Boat" },
  { value: "pin", label: "Pin Mark" },
  { value: "windward", label: "Mark 1 (Windward)" },
  { value: "wing", label: "Mark 2 (Wing)" },
  { value: "leeward", label: "Mark 3 (Leeward)" },
  { value: "gate", label: "Gate Mark" },
  { value: "offset", label: "Offset Mark" },
  { value: "turning_mark", label: "Turning Mark" },
  { value: "finish", label: "Finish" },
  { value: "other", label: "Other" },
];

export function MarkEditPanel({ 
  mark, 
  buoys, 
  onClose, 
  onSave, 
  onDelete,
  onReposition,
  onNudge,
  isRepositioning,
}: MarkEditPanelProps) {
  const [name, setName] = useState(mark.name);
  const [role, setRole] = useState<MarkRole>(mark.role as MarkRole);
  const [lat, setLat] = useState(mark.lat.toString());
  const [lng, setLng] = useState(mark.lng.toString());
  const [assignedBuoyId, setAssignedBuoyId] = useState<string>(mark.assignedBuoyId || "");
  const [isStartLine, setIsStartLine] = useState(mark.isStartLine ?? false);
  const [isFinishLine, setIsFinishLine] = useState(mark.isFinishLine ?? false);
  const [isGate, setIsGate] = useState(mark.isGate ?? false);
  const [gateWidthBoatLengths, setGateWidthBoatLengths] = useState(mark.gateWidthBoatLengths ?? 8);
  const [boatLengthMeters, setBoatLengthMeters] = useState(mark.boatLengthMeters ?? 6);
  const [gatePortBuoyId, setGatePortBuoyId] = useState<string>(mark.gatePortBuoyId || "");
  const [gateStarboardBuoyId, setGateStarboardBuoyId] = useState<string>(mark.gateStarboardBuoyId || "");
  const [hasChanges, setHasChanges] = useState(false);

  const gateWidthMeters = gateWidthBoatLengths * boatLengthMeters;

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
      gateWidthBoatLengths !== (mark.gateWidthBoatLengths ?? 8) ||
      boatLengthMeters !== (mark.boatLengthMeters ?? 6) ||
      gatePortBuoyId !== (mark.gatePortBuoyId || "") ||
      gateStarboardBuoyId !== (mark.gateStarboardBuoyId || "");
    setHasChanges(changed);
  }, [name, role, lat, lng, assignedBuoyId, isStartLine, isFinishLine, isGate, gateWidthBoatLengths, boatLengthMeters, gatePortBuoyId, gateStarboardBuoyId, mark]);

  useEffect(() => {
    setLat(mark.lat.toString());
    setLng(mark.lng.toString());
  }, [mark.lat, mark.lng]);

  // Clear assignedBuoyId when isGate is toggled on
  useEffect(() => {
    if (isGate) {
      setAssignedBuoyId("");
    }
  }, [isGate]);

  const handleSave = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return;
    }

    onSave({
      name,
      role,
      lat: latNum,
      lng: lngNum,
      assignedBuoyId: isGate ? null : (assignedBuoyId || null),
      isStartLine,
      isFinishLine,
      isGate,
      gateWidthBoatLengths: isGate ? gateWidthBoatLengths : null,
      boatLengthMeters: isGate ? boatLengthMeters : null,
      gatePortBuoyId: isGate ? (gatePortBuoyId || null) : null,
      gateStarboardBuoyId: isGate ? (gateStarboardBuoyId || null) : null,
    });
  };

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
            <h2 className="text-lg font-semibold">Edit Mark</h2>
            <p className="text-xs text-muted-foreground">Modify mark properties</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-mark-edit">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mark-name">Name</Label>
          <Input
            id="mark-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mark name"
            data-testid="input-mark-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mark-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as MarkRole)}>
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
                onCheckedChange={setIsStartLine}
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
                onCheckedChange={setIsFinishLine}
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
                onCheckedChange={setIsGate}
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
                      onChange={(e) => setGateWidthBoatLengths(parseFloat(e.target.value) || 8)}
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
                      onChange={(e) => setBoatLengthMeters(parseFloat(e.target.value) || 6)}
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

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Position</Label>
            {onReposition && (
              <Button 
                variant={isRepositioning ? "default" : "outline"} 
                size="sm"
                onClick={onReposition}
                data-testid="button-reposition-mark"
              >
                <Navigation className="w-4 h-4 mr-1" />
                {isRepositioning ? "Click Map..." : "Tap to Place"}
              </Button>
            )}
          </div>
          
          {/* Directional nudge controls */}
          {onNudge && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Nudge Position</p>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onNudge("north")}
                data-testid="button-nudge-north"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onNudge("west")}
                  data-testid="button-nudge-west"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-9 h-9 flex items-center justify-center text-xs text-muted-foreground">
                  <Move className="w-4 h-4" />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onNudge("east")}
                  data-testid="button-nudge-east"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onNudge("south")}
                data-testid="button-nudge-south"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mark-lat" className="text-xs text-muted-foreground">Latitude</Label>
              <Input
                id="mark-lat"
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-mark-lat"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mark-lng" className="text-xs text-muted-foreground">Longitude</Label>
              <Input
                id="mark-lng"
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-mark-lng"
              />
            </div>
          </div>
        </div>

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
                  onValueChange={(v) => setGatePortBuoyId(v === "unassigned" ? "" : v)}
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
                  onValueChange={(v) => setGateStarboardBuoyId(v === "unassigned" ? "" : v)}
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
            <Select value={assignedBuoyId || "unassigned"} onValueChange={(v) => setAssignedBuoyId(v === "unassigned" ? "" : v)}>
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
        <Button 
          className="w-full gap-2" 
          onClick={handleSave}
          disabled={!hasChanges}
          data-testid="button-save-mark"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </Button>

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
    </div>
  );
}
