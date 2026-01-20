import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
import type { Buoy, Course, Mark, Event, SailClub, BoatClass } from "@shared/schema";

export function useSailClubs() {
  return useQuery<SailClub[]>({
    queryKey: ["/api/sail-clubs"],
  });
}

export function useBoatClasses() {
  return useQuery<BoatClass[]>({
    queryKey: ["/api/boat-classes"],
  });
}

export function useBoatClass(id: string | null | undefined) {
  return useQuery<BoatClass>({
    queryKey: ["/api/boat-classes", id],
    enabled: !!id,
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
      isGate?: boolean | null;
      gateWidthBoatLengths?: number | null;
      boatLengthMeters?: number | null;
      gateSide?: string | null;
      gatePartnerId?: string | null;
      gatePortBuoyId?: string | null;
      gateStarboardBuoyId?: string | null;
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

export function useDeleteCourse(onError?: (error: Error) => void) {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/courses/${id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete course");
      }
      return id;
    },
    onSuccess: () => {
      invalidateRelatedQueries("courses");
    },
    onError: (error: Error) => {
      onError?.(error);
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

// Course Snapshots hooks

export interface CourseSnapshotListParams {
  clubId?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface CourseSnapshotListResult {
  snapshots: CourseSnapshot[];
  nextCursor: string | null;
  totalCount: number;
}

export interface CourseSnapshot {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  sailClubId: string | null;
  sailClubName: string | null;
  visibilityScope: string;
  shape: string;
  centerLat: number;
  centerLng: number;
  rotation: number;
  scale: number;
  roundingSequence: string[] | null;
  snapshotMarks: SnapshotMark[];
  createdAt: string | null;
}

export interface SnapshotMark {
  name: string;
  role: string;
  order: number;
  lat: number;
  lng: number;
  isStartLine: boolean | null;
  isFinishLine: boolean | null;
  isCourseMark: boolean | null;
  isGate: boolean | null;
  gateWidthBoatLengths: number | null;
  boatLengthMeters: number | null;
  gatePartnerId: string | null;
  gateSide: string | null;
}

export function useCourseSnapshots(params: CourseSnapshotListParams = {}) {
  const queryString = new URLSearchParams();
  if (params.clubId) queryString.set("clubId", params.clubId);
  if (params.search) queryString.set("search", params.search);
  if (params.cursor) queryString.set("cursor", params.cursor);
  if (params.limit) queryString.set("limit", params.limit.toString());
  
  const queryParam = queryString.toString() ? `?${queryString.toString()}` : "";
  
  return useQuery<CourseSnapshotListResult>({
    queryKey: ["/api/course-snapshots", queryParam],
  });
}

export function useSaveCourseSnapshot(onError?: (error: Error) => void) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { courseId: string; name: string }) => {
      const res = await apiRequest("POST", "/api/course-snapshots", data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save course");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/course-snapshots"] });
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

export function useDeleteCourseSnapshot(onError?: (error: Error) => void) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/course-snapshots/${id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete course");
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/course-snapshots"] });
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

export function useLoadCourseSnapshot(snapshotId: string | null) {
  return useQuery<CourseSnapshot>({
    queryKey: ["/api/course-snapshots", snapshotId],
    queryFn: async () => {
      if (!snapshotId) throw new Error("No snapshot ID");
      const res = await fetch(`/api/course-snapshots/${snapshotId}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load course snapshot");
      }
      return res.json();
    },
    enabled: !!snapshotId,
  });
}
