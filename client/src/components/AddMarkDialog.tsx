import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MarkRole } from "@shared/schema";

interface AddMarkDialogProps {
  onAdd: (data: { name: string; role: MarkRole; lat?: number; lng?: number }) => void;
  onPlaceOnMap: (data: { name: string; role: MarkRole }) => void;
  trigger?: React.ReactNode;
}

const POINT_ROLES: { value: MarkRole; label: string }[] = [
  { value: "start_boat", label: "Committee Boat" },
  { value: "pin", label: "Pin" },
  { value: "windward", label: "Point 1 (Windward)" },
  { value: "wing", label: "Point 2 (Wing)" },
  { value: "leeward", label: "Point 3 (Leeward)" },
  { value: "gate", label: "Gate" },
  { value: "offset", label: "Offset" },
  { value: "turning_mark", label: "Turning Point" },
  { value: "finish", label: "Finish" },
  { value: "other", label: "Other" },
];

export function AddMarkDialog({ onAdd, onPlaceOnMap, trigger }: AddMarkDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<MarkRole>("turning_mark");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [mode, setMode] = useState<"coordinates" | "map">("map");

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (mode === "coordinates") {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) return;
      
      onAdd({ name, role, lat: latNum, lng: lngNum });
    } else {
      onPlaceOnMap({ name, role });
    }

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setRole("turning_mark");
    setLat("");
    setLng("");
    setMode("map");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1" data-testid="button-add-point">
            <Plus className="w-4 h-4" />
            Add Point
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Add New Point
          </DialogTitle>
          <DialogDescription>
            Create a new course point by entering details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-mark-name">Name</Label>
            <Input
              id="new-mark-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Windward Point"
              data-testid="input-new-mark-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mark-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MarkRole)}>
              <SelectTrigger id="new-mark-role" data-testid="select-new-mark-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {POINT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Position Method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "map" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMode("map")}
                data-testid="button-place-on-map"
              >
                Click on Map
              </Button>
              <Button
                type="button"
                variant={mode === "coordinates" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMode("coordinates")}
                data-testid="button-enter-coordinates"
              >
                Enter Coordinates
              </Button>
            </div>
          </div>

          {mode === "coordinates" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-mark-lat" className="text-xs text-muted-foreground">Latitude</Label>
                <Input
                  id="new-mark-lat"
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="37.8044"
                  className="font-mono"
                  data-testid="input-new-mark-lat"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-mark-lng" className="text-xs text-muted-foreground">Longitude</Label>
                <Input
                  id="new-mark-lng"
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="-122.2712"
                  className="font-mono"
                  data-testid="input-new-mark-lng"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!name.trim() || (mode === "coordinates" && (!lat || !lng))}
            data-testid="button-create-mark"
          >
            {mode === "map" ? "Place on Map" : "Create Point"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
