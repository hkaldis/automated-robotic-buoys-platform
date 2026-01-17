import { useState, useEffect, useCallback } from "react";
import type { Course, Mark, CourseShape, CourseValidity, GeoPosition } from "@shared/schema";
import { courseService } from "@/lib/services/course-service";

export function useCourse() {
  const [course, setCourse] = useState<Course | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);

  useEffect(() => {
    return courseService.subscribe((c, m) => {
      setCourse(c);
      setMarks(m);
    });
  }, []);

  const updateCourse = useCallback((updates: Partial<Course>) => {
    courseService.updateCourse(updates);
  }, []);

  const updateMark = useCallback((mark: Mark) => {
    courseService.updateMark(mark);
  }, []);

  const getLegs = useCallback(() => {
    return courseService.getLegs();
  }, []);

  const getTotalDistance = useCallback(() => {
    return courseService.getTotalDistance();
  }, []);

  const generateCourse = useCallback((shape: CourseShape, center: GeoPosition, windDirection: number, scale?: number) => {
    return courseService.generateCourseMarks(shape, center, windDirection, scale);
  }, []);

  return {
    course,
    marks,
    updateCourse,
    updateMark,
    getLegs,
    getTotalDistance,
    generateCourse,
    calculateDistance: courseService.calculateDistance.bind(courseService),
    calculateBearing: courseService.calculateBearing.bind(courseService),
  };
}

export function useCourseValidity() {
  const [validity, setValidity] = useState<CourseValidity>(courseService.getValidity());

  useEffect(() => {
    return courseService.subscribeToValidity(setValidity);
  }, []);

  return validity;
}
