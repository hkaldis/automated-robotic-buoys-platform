import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Buoy, Course, Mark, Event, SailClub } from "@shared/schema";

export function useSailClubs() {
  return useQuery<SailClub[]>({
    queryKey: ["/api/sail-clubs"],
  });
}

export function useEvents(sailClubId?: string) {
  const queryKey = sailClubId 
    ? ["/api/events", `?sailClubId=${sailClubId}`]
    : ["/api/events"];
  return useQuery<Event[]>({
    queryKey,
  });
}

export function useEvent(id: string) {
  return useQuery<Event>({
    queryKey: ["/api/events", id],
    enabled: !!id,
  });
}

export function useCourses() {
  return useQuery<Course[]>({
    queryKey: ["/api/courses"],
  });
}

export function useCourse(id: string) {
  return useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: !!id,
  });
}

export function useMarks(courseId: string) {
  return useQuery<Mark[]>({
    queryKey: ["/api/courses", courseId, "marks"],
    enabled: !!courseId,
  });
}

export function useBuoys(sailClubId?: string) {
  const queryKey = sailClubId 
    ? ["/api/buoys", `?sailClubId=${sailClubId}`]
    : ["/api/buoys"];
  return useQuery<Buoy[]>({
    queryKey,
    refetchInterval: 5000,
  });
}

export function useBuoy(id: string) {
  return useQuery<Buoy>({
    queryKey: ["/api/buoys", id],
    enabled: !!id,
  });
}

export function useWeatherData() {
  return useQuery<{
    windSpeed: number;
    windDirection: number;
    currentSpeed: number;
    currentDirection: number;
    source: string;
    timestamp: string;
  }>({
    queryKey: ["/api/weather"],
    refetchInterval: 10000,
  });
}

export function useUpdateBuoy() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Buoy> }) => {
      const res = await apiRequest("PATCH", `/api/buoys/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
    },
  });
}

export function useBuoyCommand() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, command, targetLat, targetLng }: { 
      id: string; 
      command: "move_to_target" | "hold_position" | "cancel";
      targetLat?: number;
      targetLng?: number;
    }) => {
      const res = await apiRequest("POST", `/api/buoys/${id}/command`, { command, targetLat, targetLng });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
    },
  });
}

export function useUpdateMark(courseId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Mark> }) => {
      const res = await apiRequest("PATCH", `/api/marks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      }
    },
  });
}

export function useCreateMark(courseId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      courseId: string;
      name: string;
      role: string;
      order: number;
      lat: number;
      lng: number;
      assignedBuoyId?: string | null;
    }) => {
      const res = await apiRequest("POST", "/api/marks", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", variables.courseId, "marks"] });
    },
  });
}

export function useDeleteMark(courseId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marks/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      if (courseId) {
        queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
      }
    },
  });
}

export function useDeleteAllMarks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (courseId: string) => {
      const res = await apiRequest("DELETE", `/api/courses/${courseId}/marks`);
      return res.json();
    },
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] });
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      sailClubId: string;
      boatClass: string;
      targetDuration: number;
      courseId?: string;
    }) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      shape: string;
      centerLat: number;
      centerLng: number;
      rotation?: number;
      scale?: number;
    }) => {
      const res = await apiRequest("POST", "/api/courses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Course> }) => {
      const res = await apiRequest("PATCH", `/api/courses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    },
  });
}

export function useUserSettings() {
  return useQuery<{
    distanceUnit: string;
    speedUnit: string;
    windSource: string;
    selectedWindBuoyId: string | null;
  }>({
    queryKey: ["/api/settings"],
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      distanceUnit?: string;
      speedUnit?: string;
      windSource?: string;
      selectedWindBuoyId?: string | null;
    }) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}
