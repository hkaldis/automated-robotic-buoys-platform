import { useState, useEffect, useCallback } from "react";
import type { Buoy } from "@shared/schema";
import { buoyService } from "@/lib/services/buoy-service";

export function useBuoys() {
  const [buoys, setBuoys] = useState<Buoy[]>(buoyService.getAll());

  useEffect(() => {
    return buoyService.subscribe(setBuoys);
  }, []);

  return {
    buoys,
    availableBuoys: buoyService.getAvailable(),
    getById: buoyService.getById.bind(buoyService),
    getStateColor: buoyService.getBuoyStateColor.bind(buoyService),
    getStateBgColor: buoyService.getBuoyStateBgColor.bind(buoyService),
    getStateLabel: buoyService.getBuoyStateLabel.bind(buoyService),
  };
}

export function useSelectedBuoy() {
  const [selectedBuoy, setSelectedBuoy] = useState<Buoy | null>(buoyService.getSelected());

  useEffect(() => {
    return buoyService.subscribeToSelection(setSelectedBuoy);
  }, []);

  const select = useCallback((buoyId: string | null) => {
    buoyService.select(buoyId);
  }, []);

  const sendCommand = useCallback(async (command: "move_to_target" | "hold_position" | "cancel") => {
    const id = buoyService.getSelectedId();
    if (id) {
      await buoyService.sendCommand(id, command);
    }
  }, []);

  return {
    selectedBuoy,
    select,
    sendCommand,
  };
}
