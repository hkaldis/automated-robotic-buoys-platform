import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
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
    refetchInterval: 30000,
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
    refetchInterval: 30000,
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

export function useWeatherByLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const res = await apiRequest("GET", `/api/weather/location?lat=${lat}&lng=${lng}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/weather"], data);
    },
  });
}

export function useUpdateBuoy(courseId?: string, onError?: (error: Error) => void) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Buoy> }) => {
      const res = await apiRequest("PATCH", `/api/buoys/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update buoy");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("buoys", courseId);
    },
    onError: (error: Error) => {
      console.error("Buoy update failed:", error);
      onError?.(error);
    },
  });
}

export function useBuoyCommand(
  demoSendCommand?: (buoyId: string, command: "move_to_target" | "hold_position" | "cancel", targetLat?: number, targetLng?: number) => void,
  courseId?: string,
  onError?: (error: Error) => void
) {
  return useMutation({
    mutationFn: async ({ id, command, targetLat, targetLng }: { 
      id: string; 
      command: "move_to_target" | "hold_position" | "cancel";
      targetLat?: number;
      targetLng?: number;
    }) => {
      if (id.startsWith("demo-") && demoSendCommand) {
        demoSendCommand(id, command, targetLat, targetLng);
        return { success: true, demo: true };
      }
      const res = await apiRequest("POST", `/api/buoys/${id}/command`, { command, targetLat, targetLng });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to execute buoy command");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("buoys", courseId);
    },
    onError: (error: Error) => {
      console.error("Buoy command failed:", error);
      onError?.(error);
    },
  });
}

export function useUpdateMark(courseId?: string, onError?: (error: Error) => void) {
  const queryClient = useQueryClient();
  const capturedCourseId = courseId;
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Mark> }) => {
      const res = await apiRequest("PATCH", `/api/marks/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update mark");
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      if (!capturedCourseId) return;
      
      await queryClient.cancelQueries({ queryKey: ["/api/courses", capturedCourseId, "marks"] });
      
      const previousMarks = queryClient.getQueryData<Mark[]>(["/api/courses", capturedCourseId, "marks"]);
      
      if (previousMarks) {
        queryClient.setQueryData<Mark[]>(
          ["/api/courses", capturedCourseId, "marks"],
          previousMarks.map(mark => mark.id === id ? { ...mark, ...data } : mark)
        );
      }
      
      return { previousMarks };
    },
    onError: (error: Error, _variables, context) => {
      console.error("Mark update failed:", error);
      if (context?.previousMarks && capturedCourseId) {
        queryClient.setQueryData(["/api/courses", capturedCourseId, "marks"], context.previousMarks);
      }
      onError?.(error);
    },
    onSettled: () => {
      invalidateRelatedQueries("marks", capturedCourseId);
    },
  });
}

export function useCreateMark(courseId?: string, onError?: (error: Error) => void) {
  return useMutation({
    mutationFn: async (data: {
      courseId: string;
      name: string;
      role: string;
      order: number;
      lat: number;
      lng: number;
      assignedBuoyId?: string | null;
      isStartLine?: boolean;
      isFinishLine?: boolean;
      isCourseMark?: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/marks", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create mark");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidateRelatedQueries("marks", variables.courseId);
    },
    onError: (error: Error) => {
      console.error("Mark creation failed:", error);
      onError?.(error);
    },
  });
}

export function useDeleteMark(courseId?: string, onError?: (error: Error) => void) {
  const capturedCourseId = courseId;
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/marks/${id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete mark");
      }
      return id;
    },
    onSuccess: () => {
      invalidateRelatedQueries("marks", capturedCourseId);
    },
    onError: (error: Error) => {
      console.error("Mark deletion failed:", error);
      onError?.(error);
    },
  });
}

export function useDeleteAllMarks(onError?: (error: Error) => void) {
  return useMutation({
    mutationFn: async (courseId: string) => {
      const res = await apiRequest("DELETE", `/api/courses/${courseId}/marks`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete marks");
      }
      return res.json();
    },
    onSuccess: (_, courseId) => {
      invalidateRelatedQueries("marks", courseId);
    },
    onError: (error: Error) => {
      console.error("Delete all marks failed:", error);
      onError?.(error);
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
      invalidateRelatedQueries("courses");
    },
  });
}

export function useUpdateCourse(courseId?: string, onError?: (error: Error) => void) {
  const capturedCourseId = courseId;
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Course> }) => {
      const res = await apiRequest("PATCH", `/api/courses/${id}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update course");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("courses", capturedCourseId);
    },
    onError: (error: Error) => {
      console.error("Course update failed:", error);
      onError?.(error);
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
