import { useState, useEffect } from "react";
import { MapPin, X, Trash2, Save, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Mark, Buoy, MarkRole } from "@shared/schema";

interface MarkEditPanelProps {
  mark: Mark;
  buoys: Buoy[];
  onClose: () => void;
  onSave: (data: Partial<Mark>) => void;
  onDelete: () => void;
  onReposition?: () => void;
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
  isRepositioning,
}: MarkEditPanelProps) {
  const [name, setName] = useState(mark.name);
  const [role, setRole] = useState<MarkRole>(mark.role as MarkRole);
  const [lat, setLat] = useState(mark.lat.toString());
  const [lng, setLng] = useState(mark.lng.toString());
  const [assignedBuoyId, setAssignedBuoyId] = useState<string>(mark.assignedBuoyId || "");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const changed = 
      name !== mark.name ||
      role !== mark.role ||
      lat !== mark.lat.toString() ||
      lng !== mark.lng.toString() ||
      assignedBuoyId !== (mark.assignedBuoyId || "");
    setHasChanges(changed);
  }, [name, role, lat, lng, assignedBuoyId, mark]);

  useEffect(() => {
    setLat(mark.lat.toString());
    setLng(mark.lng.toString());
  }, [mark.lat, mark.lng]);

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
      assignedBuoyId: assignedBuoyId || null,
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
                {isRepositioning ? "Click Map..." : "Reposition"}
              </Button>
            )}
          </div>
          
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
