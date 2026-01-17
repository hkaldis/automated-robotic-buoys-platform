import type { Buoy, BuoyState, GeoPosition } from "@shared/schema";
import { weatherService } from "./weather-service";

type BuoyListener = (buoys: Buoy[]) => void;
type BuoySelectListener = (buoy: Buoy | null) => void;

class BuoyService {
  private buoys: Map<string, Buoy> = new Map();
  private listeners: Set<BuoyListener> = new Set();
  private selectListeners: Set<BuoySelectListener> = new Set();
  private selectedBuoyId: string | null = null;

  subscribe(listener: BuoyListener): () => void {
    this.listeners.add(listener);
    listener(this.getAll());
    return () => this.listeners.delete(listener);
  }

  subscribeToSelection(listener: BuoySelectListener): () => void {
    this.selectListeners.add(listener);
    listener(this.getSelected());
    return () => this.selectListeners.delete(listener);
  }

  private notify(): void {
    const buoys = this.getAll();
    this.listeners.forEach(listener => listener(buoys));
  }

  private notifySelection(): void {
    const selected = this.getSelected();
    this.selectListeners.forEach(listener => listener(selected));
  }

  setBuoys(buoys: Buoy[]): void {
    this.buoys.clear();
    buoys.forEach(buoy => this.buoys.set(buoy.id, buoy));
    this.notify();
    
    const startBuoy = buoys.find(b => b.name.toLowerCase().includes("start"));
    if (startBuoy) {
      weatherService.updateFromBuoy(startBuoy);
    } else if (buoys.length > 0) {
      weatherService.updateFromBuoy(buoys[0]);
    }
  }

  updateBuoy(buoy: Buoy): void {
    this.buoys.set(buoy.id, buoy);
    this.notify();
    
    if (weatherService.getSelectedBuoyId() === buoy.id || 
        (!weatherService.getSelectedBuoyId() && buoy.name.toLowerCase().includes("start"))) {
      weatherService.updateFromBuoy(buoy);
    }
    
    if (this.selectedBuoyId === buoy.id) {
      this.notifySelection();
    }
  }

  getAll(): Buoy[] {
    return Array.from(this.buoys.values());
  }

  getById(id: string): Buoy | undefined {
    return this.buoys.get(id);
  }

  getAvailable(): Buoy[] {
    return this.getAll().filter(b => 
      b.state === "idle" || b.state === "holding_position"
    );
  }

  select(buoyId: string | null): void {
    this.selectedBuoyId = buoyId;
    this.notifySelection();
  }

  getSelected(): Buoy | null {
    if (!this.selectedBuoyId) return null;
    return this.buoys.get(this.selectedBuoyId) ?? null;
  }

  getSelectedId(): string | null {
    return this.selectedBuoyId;
  }

  async sendCommand(buoyId: string, command: "move_to_target" | "hold_position" | "cancel"): Promise<void> {
    const buoy = this.buoys.get(buoyId);
    if (!buoy) return;

    let newState: BuoyState;
    switch (command) {
      case "move_to_target":
        newState = "moving_to_target";
        break;
      case "hold_position":
        newState = "holding_position";
        break;
      case "cancel":
        newState = "idle";
        break;
    }

    this.updateBuoy({ ...buoy, state: newState });
  }

  getBuoyStateColor(state: BuoyState): string {
    switch (state) {
      case "idle": return "text-muted-foreground";
      case "moving_to_target": return "text-chart-1";
      case "holding_position": return "text-green-500";
      case "station_keeping_degraded": return "text-yellow-500";
      case "unavailable": return "text-muted-foreground";
      case "maintenance": return "text-chart-3";
      case "fault": return "text-destructive";
      default: return "text-muted-foreground";
    }
  }

  getBuoyStateBgColor(state: BuoyState): string {
    switch (state) {
      case "idle": return "bg-muted";
      case "moving_to_target": return "bg-chart-1/20";
      case "holding_position": return "bg-green-500/20";
      case "station_keeping_degraded": return "bg-yellow-500/20";
      case "unavailable": return "bg-muted";
      case "maintenance": return "bg-chart-3/20";
      case "fault": return "bg-destructive/20";
      default: return "bg-muted";
    }
  }

  getBuoyStateLabel(state: BuoyState): string {
    switch (state) {
      case "idle": return "Idle";
      case "moving_to_target": return "Moving";
      case "holding_position": return "Holding";
      case "station_keeping_degraded": return "Degraded";
      case "unavailable": return "Unavailable";
      case "maintenance": return "Maintenance";
      case "fault": return "Fault";
      default: return state;
    }
  }
}

export const buoyService = new BuoyService();
