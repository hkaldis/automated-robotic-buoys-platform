import type { Express } from "express";
import { createServer, type Server } from "http";
import { eq } from "drizzle-orm";
import { storage } from "./storage";
import { db } from "./db";
import { 
  insertEventSchema, 
  insertCourseSchema, 
  insertMarkSchema, 
  insertBuoySchema,
  insertBuoyAssignmentSchema,
  insertUserSettingsSchema,
  insertSailClubSchema,
  insertCourseSnapshotSchema,
  insertBoatClassSchema,
  insertBuoyWeatherHistorySchema,
  snapshotMarkSchema,
  boatClasses,
  type UserRole,
  type SnapshotMark,
  type Event as DbEvent,
} from "@shared/schema";
import { z } from "zod";
import { analyzeWeather } from "./weather-analytics";
import { fetchExternalInfo } from "./external-info-parser";
import { 
  requireAuth, 
  requireRole, 
  hashPassword, 
  comparePassword, 
  safeUserResponse,
  requireEventAccess,
  requireCourseAccess,
} from "./auth";
import {
  validateCoordinates,
  validateGateWidth,
  validateMarkRoleConsistency,
  validateBuoyNotAssignedToOtherMarks,
  validateRoundingSequence,
  validateCourseTransformBounds,
  validateGateSide,
  validateDuplicateBuoyOnSameMark,
  validateMarkOrderUniqueness,
} from "./validation";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Simple in-memory rate limiter for auth endpoints
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  
  record.count++;
  return { allowed: true };
}

function resetLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(loginAttempts.entries());
  for (const [ip, record] of entries) {
    if (now > record.resetTime) {
      loginAttempts.delete(ip);
    }
  }
}, 60 * 1000); // Cleanup every minute

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(4),
  role: z.enum(["super_admin", "club_manager", "event_manager"]),
  sailClubId: z.string().optional(),
});

const grantEventAccessSchema = z.object({
  eventId: z.string(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req, res) => {
    try {
      // Rate limiting check
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const rateLimit = checkLoginRateLimit(clientIp);
      if (!rateLimit.allowed) {
        res.set("Retry-After", String(rateLimit.retryAfterSeconds));
        return res.status(429).json({ 
          error: "Too many login attempts. Please try again later.",
          retryAfterSeconds: rateLimit.retryAfterSeconds 
        });
      }
      
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Successful login - reset rate limit for this IP
      resetLoginAttempts(clientIp);
      
      req.session.userId = user.id;
      req.session.role = user.role as UserRole;
      req.session.sailClubId = user.sailClubId;
      
      res.json({ user: safeUserResponse(user) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid login data" });
      }
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      let eventAccess: string[] = [];
      if (user.role === "event_manager") {
        const access = await storage.getUserEventAccess(user.id);
        eventAccess = access.map(a => a.eventId);
      }
      
      res.json({ user: safeUserResponse(user), eventAccess });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/users", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const sailClubId = req.session.role === "club_manager" 
        ? req.session.sailClubId 
        : req.query.sailClubId as string | undefined;
      
      const users = await storage.getUsers(sailClubId || undefined);
      res.json(users.map(safeUserResponse));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const data = createUserSchema.parse(req.body);
      
      if (req.session.role === "club_manager") {
        if (data.role !== "event_manager") {
          return res.status(403).json({ error: "Club managers can only create event managers" });
        }
        if (!req.session.sailClubId) {
          return res.status(403).json({ error: "Club manager has no club assigned" });
        }
        data.sailClubId = req.session.sailClubId;
      }
      
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }
      
      const passwordHash = await hashPassword(data.password);
      const user = await storage.createUser({
        username: data.username,
        passwordHash,
        role: data.role,
        sailClubId: data.sailClubId,
        createdBy: req.session.userId,
      });
      
      res.status(201).json(safeUserResponse(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (req.session.role === "club_manager") {
        if (user.sailClubId !== req.session.sailClubId || user.role !== "event_manager") {
          return res.status(403).json({ error: "Cannot delete this user" });
        }
      }
      
      if (user.role === "super_admin") {
        return res.status(403).json({ error: "Cannot delete super admin" });
      }
      
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/users/:id/events", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const { eventId } = grantEventAccessSchema.parse(req.body);
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== "event_manager") {
        return res.status(404).json({ error: "Event manager not found" });
      }
      
      if (req.session.role === "club_manager" && user.sailClubId !== req.session.sailClubId) {
        return res.status(403).json({ error: "Cannot manage users from other clubs" });
      }
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (req.session.role === "club_manager" && event.sailClubId !== req.session.sailClubId) {
        return res.status(403).json({ error: "Cannot grant access to events from other clubs" });
      }
      
      const access = await storage.grantEventAccess({
        userId,
        eventId,
        grantedBy: req.session.userId,
      });
      
      res.status(201).json(access);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data" });
      }
      res.status(500).json({ error: "Failed to grant access" });
    }
  });

  app.delete("/api/users/:id/events/:eventId", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const userId = req.params.id as string;
      const eventId = req.params.eventId as string;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (req.session.role === "club_manager" && user.sailClubId !== req.session.sailClubId) {
        return res.status(403).json({ error: "Cannot manage users from other clubs" });
      }
      
      await storage.revokeEventAccess(userId, eventId);
      res.json({ message: "Access revoked successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  app.get("/api/users/:id/events", requireAuth, async (req, res) => {
    try {
      const userId = req.params.id as string;
      const access = await storage.getUserEventAccess(userId);
      res.json(access);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event access" });
    }
  });

  app.get("/api/sail-clubs", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Super admins see all clubs
      if (user.role === "super_admin") {
        const clubs = await storage.getSailClubs();
        return res.json(clubs);
      }
      
      // Other users see only their associated club
      if (user.sailClubId) {
        const club = await storage.getSailClub(user.sailClubId);
        return res.json(club ? [club] : []);
      }
      
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sail clubs" });
    }
  });

  app.get("/api/sail-clubs/:id", requireAuth, async (req, res) => {
    try {
      const clubId = req.params.id as string;
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Super admins can see any club
      // Other users can only see their associated club
      if (user.role !== "super_admin" && user.sailClubId !== clubId) {
        return res.status(403).json({ error: "Access denied to this sail club" });
      }
      
      const club = await storage.getSailClub(clubId);
      if (!club) {
        return res.status(404).json({ error: "Sail club not found" });
      }
      res.json(club);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sail club" });
    }
  });

  app.post("/api/sail-clubs", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const validatedData = insertSailClubSchema.parse(req.body);
      const club = await storage.createSailClub(validatedData);
      res.status(201).json(club);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid club data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create club" });
    }
  });

  app.patch("/api/sail-clubs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const clubId = req.params.id as string;
      const validatedData = insertSailClubSchema.partial().parse(req.body);
      const club = await storage.updateSailClub(clubId, validatedData);
      if (!club) {
        return res.status(404).json({ error: "Club not found" });
      }
      res.json(club);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid club data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update club" });
    }
  });

  app.delete("/api/sail-clubs/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const clubId = req.params.id as string;
      const deleted = await storage.deleteSailClub(clubId);
      if (!deleted) {
        return res.status(404).json({ error: "Club not found" });
      }
      res.json({ message: "Club deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete club" });
    }
  });

  // Boat Classes (stored in database, not storage interface)
  app.get("/api/boat-classes", requireAuth, async (req, res) => {
    try {
      const allBoatClasses = await db.select().from(boatClasses).orderBy(boatClasses.name);
      res.json(allBoatClasses);
    } catch (error) {
      console.error("Error fetching boat classes:", error);
      res.status(500).json({ error: "Failed to fetch boat classes" });
    }
  });

  app.get("/api/boat-classes/:id", requireAuth, async (req, res) => {
    try {
      const boatClassId = req.params.id as string;
      const [boatClass] = await db.select().from(boatClasses).where(eq(boatClasses.id, boatClassId));
      if (!boatClass) {
        return res.status(404).json({ error: "Boat class not found" });
      }
      res.json(boatClass);
    } catch (error) {
      console.error("Error fetching boat class:", error);
      res.status(500).json({ error: "Failed to fetch boat class" });
    }
  });

  app.post("/api/boat-classes", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const parsed = insertBoatClassSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid boat class data", details: parsed.error.errors });
      }
      const [newBoatClass] = await db.insert(boatClasses).values(parsed.data).returning();
      res.status(201).json(newBoatClass);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A boat class with this name already exists" });
      }
      console.error("Error creating boat class:", error);
      res.status(500).json({ error: "Failed to create boat class" });
    }
  });

  app.patch("/api/boat-classes/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const boatClassId = req.params.id as string;
      const updateSchema = insertBoatClassSchema.partial();
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid boat class data", details: parsed.error.errors });
      }
      const [updated] = await db.update(boatClasses).set(parsed.data).where(eq(boatClasses.id, boatClassId)).returning();
      if (!updated) {
        return res.status(404).json({ error: "Boat class not found" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A boat class with this name already exists" });
      }
      console.error("Error updating boat class:", error);
      res.status(500).json({ error: "Failed to update boat class" });
    }
  });

  app.delete("/api/boat-classes/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const boatClassId = req.params.id as string;
      const [deleted] = await db.delete(boatClasses).where(eq(boatClasses.id, boatClassId)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "Boat class not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting boat class:", error);
      res.status(500).json({ error: "Failed to delete boat class" });
    }
  });

  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const sailClubId = req.query.sailClubId as string | undefined;
      const eventType = req.query.type as string | undefined;
      const hidePast = req.query.hidePast === "true";
      const user = await storage.getUser(req.session.userId!);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Helper function to filter events by type and date
      const applyFilters = (events: DbEvent[]) => {
        let filtered = events;
        
        // Filter by event type
        if (eventType) {
          filtered = filtered.filter(e => e.type === eventType);
        }
        
        // Filter out past events (events whose endDate or startDate is before today)
        if (hidePast) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          filtered = filtered.filter(e => {
            // Use endDate if available, otherwise startDate
            const eventDate = e.endDate || e.startDate;
            if (!eventDate) return true; // Keep events without dates
            return new Date(eventDate) >= today;
          });
        }
        
        return filtered;
      };
      
      // Super admins see all events
      if (user.role === "super_admin") {
        const events = await storage.getEvents(sailClubId);
        return res.json(applyFilters(events));
      }
      
      // Club managers see events from their club
      if (user.role === "club_manager") {
        const clubEvents = await storage.getEvents(user.sailClubId || undefined);
        return res.json(applyFilters(clubEvents));
      }
      
      // Event managers see only their assigned events from the access table
      if (user.role === "event_manager") {
        // async-parallel: Fetch access list and events in parallel
        const [accessList, allEvents] = await Promise.all([
          storage.getUserEventAccess(user.id),
          storage.getEvents(sailClubId)
        ]);
        const accessibleEventIds = accessList.map(a => a.eventId);
        const filteredEvents = allEvents.filter(e => accessibleEventIds.includes(e.id));
        return res.json(applyFilters(filteredEvents));
      }
      
      res.json([]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", requireAuth, requireEventAccess, async (req, res) => {
    try {
      const eventId = req.params.id as string;
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.post("/api/events", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      // Convert date strings to Date objects for the database
      const body = { ...req.body };
      if (body.startDate && typeof body.startDate === 'string') {
        body.startDate = new Date(body.startDate);
      }
      if (body.endDate && typeof body.endDate === 'string') {
        body.endDate = new Date(body.endDate);
      }
      const validatedData = insertEventSchema.parse(body);
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", requireAuth, requireEventAccess, async (req, res) => {
    try {
      const eventId = req.params.id as string;
      // Convert date strings to Date objects for the database
      const body = { ...req.body };
      if (body.startDate && typeof body.startDate === 'string') {
        body.startDate = new Date(body.startDate);
      }
      if (body.endDate && typeof body.endDate === 'string') {
        body.endDate = new Date(body.endDate);
      }
      const validatedData = insertEventSchema.partial().parse(body);
      const event = await storage.updateEvent(eventId, validatedData);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const deleted = await storage.deleteEvent(req.params.id as string);
      if (!deleted) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  app.get("/api/courses", requireAuth, async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", requireAuth, async (req, res) => {
    try {
      const courseId = req.params.id as string;
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const validatedData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(validatedData);
      res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid course data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create course" });
    }
  });

  app.patch("/api/courses/:id", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const courseId = req.params.id as string;
      const validatedData = insertCourseSchema.partial().parse(req.body);
      
      const existingCourse = await storage.getCourse(courseId);
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      if (validatedData.centerLat !== undefined || validatedData.centerLng !== undefined) {
        const newCenterLat = validatedData.centerLat ?? existingCourse.centerLat;
        const newCenterLng = validatedData.centerLng ?? existingCourse.centerLng;
        const coordResult = validateCoordinates(newCenterLat, newCenterLng);
        if (!coordResult.valid) {
          return res.status(400).json({ error: coordResult.error });
        }
      }
      
      if (validatedData.rotation !== undefined || validatedData.scale !== undefined) {
        const transformResult = validateCourseTransformBounds(validatedData);
        if (!transformResult.valid) {
          return res.status(400).json({ error: transformResult.error });
        }
      }
      
      if (validatedData.roundingSequence !== undefined) {
        const sequenceResult = await validateRoundingSequence(storage, courseId, validatedData.roundingSequence || []);
        if (!sequenceResult.valid) {
          return res.status(400).json({ error: sequenceResult.error });
        }
      }
      
      const course = await storage.updateCourse(courseId, validatedData);
      res.json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid course data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update course" });
    }
  });

  app.delete("/api/courses/:id", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const courseId = req.params.id as string;
      const existingCourse = await storage.getCourse(courseId);
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      const deleted = await storage.deleteCourse(courseId);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to delete course" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  // Course Snapshots - Immutable saved courses
  
  // Save a course snapshot
  app.post("/api/course-snapshots", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const sailClubId = req.session.sailClubId;
      
      // Get the current user for username
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get the current course and marks
      const { courseId, name, category, description, thumbnailSvg } = req.body;
      console.log("[DEBUG] Save course - category:", category, "type:", typeof category);
      if (!courseId || !name) {
        return res.status(400).json({ error: "Course ID and name are required" });
      }
      
      // Validate category if provided
      const validCategories = ["triangle", "trapezoid", "windward_leeward", "other"];
      const snapshotCategory = validCategories.includes(category) ? category : "other";
      console.log("[DEBUG] Validated category:", snapshotCategory);
      
      // async-parallel: Fetch course and marks in parallel
      const [course, marks] = await Promise.all([
        storage.getCourse(courseId),
        storage.getMarksByCourse(courseId)
      ]);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      // Create a map of mark IDs to mark names for rounding sequence conversion
      const markIdToName = new Map<string, string>();
      marks.forEach(m => markIdToName.set(m.id, m.name));
      
      // Convert rounding sequence from mark IDs to mark names
      // This ensures the snapshot is portable and can be loaded into any course
      const snapshotRoundingSequence: string[] = [];
      if (course.roundingSequence) {
        for (const item of course.roundingSequence) {
          if (item === "start" || item === "finish") {
            snapshotRoundingSequence.push(item);
          } else {
            const markName = markIdToName.get(item);
            if (markName) {
              snapshotRoundingSequence.push(markName);
            }
          }
        }
      }
      
      // Convert marks to snapshot format
      const snapshotMarks: SnapshotMark[] = marks.map(m => ({
        name: m.name,
        role: m.role,
        order: m.order,
        lat: m.lat,
        lng: m.lng,
        isStartLine: m.isStartLine,
        isFinishLine: m.isFinishLine,
        isCourseMark: m.isCourseMark,
        isGate: m.isGate,
        gateWidthBoatLengths: m.gateWidthBoatLengths,
        boatLengthMeters: m.boatLengthMeters,
        gatePartnerId: m.gatePartnerId,
        gateSide: m.gateSide,
      }));
      
      // Determine visibility scope based on role
      let visibilityScope: string;
      let snapshotSailClubId: string | null = null;
      let sailClubName: string | null = null;
      
      if (userRole === "super_admin") {
        visibilityScope = "global";
      } else if (userRole === "club_manager") {
        visibilityScope = "club";
        snapshotSailClubId = sailClubId || null;
        if (snapshotSailClubId) {
          const club = await storage.getSailClub(snapshotSailClubId);
          sailClubName = club?.name || null;
        }
      } else {
        visibilityScope = "user";
        snapshotSailClubId = sailClubId || null;
        if (snapshotSailClubId) {
          const club = await storage.getSailClub(snapshotSailClubId);
          sailClubName = club?.name || null;
        }
      }
      
      const snapshotData = {
        name,
        ownerId: userId,
        ownerUsername: user.username,
        sailClubId: snapshotSailClubId,
        sailClubName,
        visibilityScope,
        category: snapshotCategory,
        description: description || null,
        thumbnailSvg: thumbnailSvg || null,
        shape: course.shape,
        centerLat: course.centerLat,
        centerLng: course.centerLng,
        rotation: course.rotation,
        scale: course.scale,
        roundingSequence: snapshotRoundingSequence,
        snapshotMarks,
      };
      
      const snapshot = await storage.createCourseSnapshot(snapshotData);
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Failed to create course snapshot:", error);
      res.status(500).json({ error: "Failed to save course" });
    }
  });
  
  // List course snapshots with pagination and filtering
  app.get("/api/course-snapshots", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const userSailClubId = req.session.sailClubId || null;
      
      const { clubId, search, cursor, limit } = req.query;
      
      const result = await storage.listCourseSnapshots({
        userId,
        userRole,
        userSailClubId,
        clubId: clubId as string | undefined,
        search: search as string | undefined,
        cursor: cursor as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 25,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Failed to list course snapshots:", error);
      res.status(500).json({ error: "Failed to load courses" });
    }
  });
  
  // Get a single course snapshot
  app.get("/api/course-snapshots/:id", requireAuth, async (req, res) => {
    try {
      const snapshotId = req.params.id as string;
      const snapshot = await storage.getCourseSnapshot(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      // Check visibility permissions
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      const userSailClubId = req.session.sailClubId || null;
      
      const canAccess = 
        userRole === "super_admin" ||
        snapshot.visibilityScope === "global" ||
        (snapshot.visibilityScope === "club" && snapshot.sailClubId === userSailClubId) ||
        (snapshot.visibilityScope === "user" && snapshot.ownerId === userId);
      
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });
  
  // Delete a course snapshot
  app.delete("/api/course-snapshots/:id", requireAuth, async (req, res) => {
    try {
      const snapshotId = req.params.id as string;
      const snapshot = await storage.getCourseSnapshot(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      // Check delete permissions - only owner or super_admin can delete
      const userId = req.session.userId!;
      const userRole = req.session.role!;
      
      const canDelete = userRole === "super_admin" || snapshot.ownerId === userId;
      
      if (!canDelete) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const deleted = await storage.deleteCourseSnapshot(snapshotId);
      if (deleted) {
        res.json({ message: "Course deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete course" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete course" });
    }
  });

  app.get("/api/courses/:courseId/marks", requireAuth, async (req, res) => {
    try {
      const courseId = req.params.courseId as string;
      const marks = await storage.getMarksByCourse(courseId);
      res.json(marks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch marks" });
    }
  });

  app.post("/api/marks", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const validatedData = insertMarkSchema.parse(req.body);
      
      const coordResult = validateCoordinates(validatedData.lat, validatedData.lng);
      if (!coordResult.valid) {
        return res.status(400).json({ error: coordResult.error });
      }
      
      const roleResult = validateMarkRoleConsistency(validatedData);
      if (!roleResult.valid) {
        return res.status(400).json({ error: roleResult.error });
      }
      
      const gateResult = validateGateWidth(validatedData.gateWidthBoatLengths, validatedData.boatLengthMeters);
      if (!gateResult.valid) {
        return res.status(400).json({ error: gateResult.error });
      }
      
      const gateSideResult = validateGateSide(validatedData);
      if (!gateSideResult.valid) {
        return res.status(400).json({ error: gateSideResult.error });
      }
      
      const duplicateBuoyResult = validateDuplicateBuoyOnSameMark(validatedData);
      if (!duplicateBuoyResult.valid) {
        return res.status(400).json({ error: duplicateBuoyResult.error });
      }
      
      const orderResult = await validateMarkOrderUniqueness(storage, validatedData.courseId, null, validatedData.order);
      if (!orderResult.valid) {
        return res.status(400).json({ error: orderResult.error });
      }
      
      const buoyIds = [validatedData.assignedBuoyId, validatedData.gatePortBuoyId, validatedData.gateStarboardBuoyId];
      const buoyResult = await validateBuoyNotAssignedToOtherMarks(storage, validatedData.courseId, null, buoyIds);
      if (!buoyResult.valid) {
        return res.status(400).json({ error: buoyResult.error });
      }
      
      const mark = await storage.createMark(validatedData);
      res.status(201).json(mark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid mark data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create mark" });
    }
  });

  app.patch("/api/marks/:id", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const markId = req.params.id as string;
      const validatedData = insertMarkSchema.partial().parse(req.body);
      
      const existingMark = await storage.getMark(markId);
      if (!existingMark) {
        return res.status(404).json({ error: "Mark not found" });
      }
      
      if (validatedData.courseId !== undefined && validatedData.courseId !== existingMark.courseId) {
        return res.status(400).json({ error: "Cannot change the course a mark belongs to. Delete and recreate the mark instead." });
      }
      
      if (validatedData.lat !== undefined || validatedData.lng !== undefined) {
        const coordResult = validateCoordinates(validatedData.lat, validatedData.lng);
        if (!coordResult.valid) {
          return res.status(400).json({ error: coordResult.error });
        }
      }
      
      const mergedData = { ...existingMark, ...validatedData };
      const roleResult = validateMarkRoleConsistency(mergedData);
      if (!roleResult.valid) {
        return res.status(400).json({ error: roleResult.error });
      }
      
      if (validatedData.gateWidthBoatLengths !== undefined || validatedData.boatLengthMeters !== undefined) {
        const gateResult = validateGateWidth(validatedData.gateWidthBoatLengths, validatedData.boatLengthMeters);
        if (!gateResult.valid) {
          return res.status(400).json({ error: gateResult.error });
        }
      }
      
      if (validatedData.isGate !== undefined || validatedData.gateSide !== undefined) {
        const gateSideResult = validateGateSide(mergedData);
        if (!gateSideResult.valid) {
          return res.status(400).json({ error: gateSideResult.error });
        }
      }
      
      if (validatedData.assignedBuoyId !== undefined || validatedData.gatePortBuoyId !== undefined || validatedData.gateStarboardBuoyId !== undefined) {
        const duplicateBuoyResult = validateDuplicateBuoyOnSameMark(mergedData);
        if (!duplicateBuoyResult.valid) {
          return res.status(400).json({ error: duplicateBuoyResult.error });
        }
        
        const buoyIds = [mergedData.assignedBuoyId, mergedData.gatePortBuoyId, mergedData.gateStarboardBuoyId].filter(Boolean);
        const buoyResult = await validateBuoyNotAssignedToOtherMarks(storage, existingMark.courseId, markId, buoyIds as string[]);
        if (!buoyResult.valid) {
          return res.status(400).json({ error: buoyResult.error });
        }
      }
      
      if (validatedData.order !== undefined) {
        const orderResult = await validateMarkOrderUniqueness(storage, existingMark.courseId, markId, validatedData.order);
        if (!orderResult.valid) {
          return res.status(400).json({ error: orderResult.error });
        }
      }
      
      const mark = await storage.updateMark(markId, validatedData);
      res.json(mark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid mark data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update mark" });
    }
  });

  app.delete("/api/marks/:id", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const markId = req.params.id as string;
      
      // Get the mark first to find its course
      const mark = await storage.getMark(markId);
      if (!mark) {
        return res.status(404).json({ error: "Mark not found" });
      }
      
      // Delete the mark
      const deleted = await storage.deleteMark(markId);
      if (!deleted) {
        return res.status(404).json({ error: "Mark not found" });
      }
      
      // Clean up rounding sequence atomically
      const course = await storage.getCourse(mark.courseId);
      if (course && course.roundingSequence) {
        const cleanedSequence = course.roundingSequence.filter(entry => entry !== markId);
        if (cleanedSequence.length !== course.roundingSequence.length) {
          await storage.updateCourse(course.id, { roundingSequence: cleanedSequence });
        }
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mark" });
    }
  });

  app.delete("/api/courses/:id/marks", requireAuth, requireCourseAccess, async (req, res) => {
    try {
      const courseId = req.params.id as string;
      
      // Clear the rounding sequence first
      await storage.updateCourse(courseId, { roundingSequence: [] });
      
      const count = await storage.deleteMarksByCourse(courseId);
      res.json({ deleted: count });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete marks" });
    }
  });

  app.get("/api/buoys", requireAuth, async (req, res) => {
    try {
      const sailClubId = req.query.sailClubId as string | undefined;
      const buoys = await storage.getBuoys(sailClubId);
      res.json(buoys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buoys" });
    }
  });

  // Get buoys available in inventory (must be before /api/buoys/:id to avoid route conflict)
  app.get("/api/buoys/inventory", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const buoys = await storage.getAvailableBuoys();
      res.json(buoys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory buoys" });
    }
  });

  app.get("/api/buoys/:id", requireAuth, async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const buoy = await storage.getBuoy(buoyId);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }
      res.json(buoy);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buoy" });
    }
  });

  app.post("/api/buoys", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const validatedData = insertBuoySchema.parse(req.body);
      const buoy = await storage.createBuoy(validatedData);
      res.status(201).json(buoy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid buoy data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create buoy" });
    }
  });

  app.patch("/api/buoys/:id", requireAuth, async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const validatedData = insertBuoySchema.partial().parse(req.body);
      const buoy = await storage.updateBuoy(buoyId, validatedData);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }
      res.json(buoy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid buoy data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update buoy" });
    }
  });

  app.post("/api/buoys/:id/command", requireAuth, async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const { command, targetLat, targetLng } = req.body;
      const buoy = await storage.getBuoy(buoyId);
      
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }

      let updates: Record<string, unknown> = {};

      switch (command) {
        case "move_to_target":
          updates = {
            state: "moving_to_target",
            targetLat: targetLat ?? buoy.targetLat,
            targetLng: targetLng ?? buoy.targetLng,
            speed: 2.5,
            eta: 180,
          };
          break;
        case "hold_position":
          updates = {
            state: "holding_position",
            speed: 0,
            eta: null,
          };
          break;
        case "cancel":
          updates = {
            state: "idle",
            targetLat: null,
            targetLng: null,
            speed: 0,
            eta: null,
          };
          break;
        default:
          return res.status(400).json({ error: "Invalid command" });
      }

      const updated = await storage.updateBuoy(buoyId, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute command" });
    }
  });

  // Delete buoy (super admin only)
  app.delete("/api/buoys/:id", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const deleted = await storage.deleteBuoy(buoyId);
      if (!deleted) {
        return res.status(404).json({ error: "Buoy not found" });
      }
      res.json({ message: "Buoy deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete buoy" });
    }
  });

  // Get buoys assigned to an event
  app.get("/api/events/:id/buoys", requireAuth, requireEventAccess, async (req, res) => {
    try {
      const eventId = req.params.id as string;
      const buoys = await storage.getBuoysForEvent(eventId);
      res.json(buoys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event buoys" });
    }
  });

  // Get buoys from sibling events (same club, same day, excluding current event)
  // These are read-only, informational buoys shown greyed out on the map
  app.get("/api/events/:id/sibling-buoys", requireAuth, requireEventAccess, async (req, res) => {
    try {
      const eventId = req.params.id as string;
      const siblingBuoys = await storage.getSiblingEventBuoys(eventId);
      res.json(siblingBuoys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sibling event buoys" });
    }
  });

  // Get buoy assignment history
  app.get("/api/buoys/:id/assignments", requireAuth, async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const assignments = await storage.getBuoyAssignments(buoyId);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buoy assignments" });
    }
  });

  // Assign buoy to club (super admin only)
  app.post("/api/buoys/:id/assign-club", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const { sailClubId, notes } = req.body;
      
      if (!sailClubId) {
        return res.status(400).json({ error: "sailClubId is required" });
      }

      const buoy = await storage.getBuoy(buoyId);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }

      if (buoy.inventoryStatus !== "in_inventory") {
        return res.status(400).json({ error: "Buoy must be in inventory to assign to club" });
      }

      // Create assignment record
      const assignment = await storage.createBuoyAssignment({
        buoyId,
        sailClubId,
        assignmentType: "club",
        assignedBy: req.session.userId,
        notes,
      });

      // Update buoy status
      await storage.updateBuoy(buoyId, {
        sailClubId,
        inventoryStatus: "assigned_club",
      });

      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign buoy to club" });
    }
  });

  // Assign buoy to event (super admin or club manager of that club)
  app.post("/api/buoys/:id/assign-event", requireAuth, requireRole("super_admin", "club_manager"), async (req, res) => {
    try {
      const buoyId = req.params.id as string;
      const { eventId, notes } = req.body;
      
      if (!eventId) {
        return res.status(400).json({ error: "eventId is required" });
      }

      const buoy = await storage.getBuoy(buoyId);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Club manager can only assign buoys from their club
      if (req.session.role === "club_manager" && buoy.sailClubId !== req.session.sailClubId) {
        return res.status(403).json({ error: "Can only assign buoys from your club" });
      }

      if (buoy.inventoryStatus !== "assigned_club") {
        return res.status(400).json({ error: "Buoy must be assigned to a club first" });
      }

      // Create assignment record
      const assignment = await storage.createBuoyAssignment({
        buoyId,
        sailClubId: buoy.sailClubId,
        eventId,
        assignmentType: "event",
        assignedBy: req.session.userId,
        notes,
      });

      // Update buoy status and eventId
      await storage.updateBuoy(buoyId, {
        inventoryStatus: "assigned_event",
        eventId,
      });

      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign buoy to event" });
    }
  });

  // Release buoy from event (returns to club pool)
  app.post("/api/buoys/:id/release-event", requireAuth, async (req, res) => {
    try {
      const buoyId = req.params.id as string;

      const buoy = await storage.getBuoy(buoyId);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }

      if (buoy.inventoryStatus !== "assigned_event") {
        return res.status(400).json({ error: "Buoy is not assigned to an event" });
      }

      // Check permissions - super admin, club manager of that club, or event manager
      if (req.session.role === "club_manager" && buoy.sailClubId !== req.session.sailClubId) {
        return res.status(403).json({ error: "Can only release buoys from your club" });
      }

      // End the active assignment
      const activeAssignment = await storage.getActiveAssignmentForBuoy(buoyId);
      if (activeAssignment) {
        await storage.endBuoyAssignment(activeAssignment.id);
      }

      // Update buoy status back to club, clear eventId, and reset state
      await storage.updateBuoy(buoyId, {
        inventoryStatus: "assigned_club",
        eventId: null,
        state: "idle",
        targetLat: null,
        targetLng: null,
        eta: null,
      });

      res.json({ message: "Buoy released from event" });
    } catch (error) {
      res.status(500).json({ error: "Failed to release buoy from event" });
    }
  });

  // Release buoy to inventory (super admin only)
  app.post("/api/buoys/:id/release-inventory", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const buoyId = req.params.id as string;

      const buoy = await storage.getBuoy(buoyId);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }

      // End all active assignments for this buoy
      const assignments = await storage.getBuoyAssignments(buoyId);
      for (const assignment of assignments) {
        if (assignment.status === "active") {
          await storage.endBuoyAssignment(assignment.id);
        }
      }

      // Update buoy status, clear eventId, and reset state
      await storage.updateBuoy(buoyId, {
        sailClubId: null,
        eventId: null,
        inventoryStatus: "in_inventory",
        state: "idle",
        targetLat: null,
        targetLng: null,
        eta: null,
      });

      res.json({ message: "Buoy returned to inventory" });
    } catch (error) {
      res.status(500).json({ error: "Failed to return buoy to inventory" });
    }
  });

  app.get("/api/weather", async (req, res) => {
    const buoys = await storage.getBuoys();
    const weatherBuoys = buoys.filter(b => b.windSpeed !== null);
    
    if (weatherBuoys.length === 0) {
      return res.json({
        windSpeed: 12,
        windDirection: 225,
        currentSpeed: 0.5,
        currentDirection: 180,
        source: "api",
        timestamp: new Date(),
      });
    }

    const avgWindSpeed = weatherBuoys.reduce((sum, b) => sum + (b.windSpeed ?? 0), 0) / weatherBuoys.length;
    const avgWindDirection = weatherBuoys.reduce((sum, b) => sum + (b.windDirection ?? 0), 0) / weatherBuoys.length;
    const avgCurrentSpeed = weatherBuoys.reduce((sum, b) => sum + (b.currentSpeed ?? 0), 0) / weatherBuoys.length;
    const avgCurrentDirection = weatherBuoys.reduce((sum, b) => sum + (b.currentDirection ?? 0), 0) / weatherBuoys.length;

    res.json({
      windSpeed: avgWindSpeed,
      windDirection: avgWindDirection,
      currentSpeed: avgCurrentSpeed,
      currentDirection: avgCurrentDirection,
      source: "buoy",
      timestamp: new Date(),
    });
  });

  app.get("/api/weather/location", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Valid lat and lng query parameters required" });
      }

      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;
      
      const response = await fetch(openMeteoUrl);
      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.json({
        windSpeed: data.current?.wind_speed_10m ?? 10,
        windDirection: data.current?.wind_direction_10m ?? 180,
        currentSpeed: 0.5,
        currentDirection: 180,
        source: "open-meteo",
        timestamp: new Date(),
        location: { lat, lng },
      });
    } catch (error) {
      console.error("Weather API error:", error);
      res.status(500).json({ 
        error: "Failed to fetch weather data",
        fallback: {
          windSpeed: 12,
          windDirection: 225,
          currentSpeed: 0.5,
          currentDirection: 180,
          source: "fallback",
          timestamp: new Date(),
        }
      });
    }
  });

  app.get("/api/settings", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    let settings = await storage.getUserSettings(userId);
    
    if (!settings) {
      // Create default settings for this user
      settings = await storage.createUserSettings({
        userId,
        distanceUnit: "nautical_miles",
        speedUnit: "knots",
        windSource: "buoy",
        selectedWindBuoyId: null,
      });
    }
    
    res.json({
      distanceUnit: settings.distanceUnit,
      speedUnit: settings.speedUnit,
      windSource: settings.windSource,
      selectedWindBuoyId: settings.selectedWindBuoyId,
      mapLayer: settings.mapLayer,
      showSeaMarks: settings.showSeaMarks,
      showSiblingBuoys: settings.showSiblingBuoys,
      windArrowsMinZoom: settings.windArrowsMinZoom,
      startLineResizeMode: settings.startLineResizeMode,
      startLineFixBearingMode: settings.startLineFixBearingMode,
      buoyDeployMode: settings.buoyDeployMode,
      windAngleDefaults: settings.windAngleDefaults,
      buoyFollowSettings: settings.buoyFollowSettings,
      courseAdjustmentSettings: settings.courseAdjustmentSettings,
      integrations: settings.integrations,
    });
  });

  app.patch("/api/settings", requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const { 
      distanceUnit, speedUnit, windSource, selectedWindBuoyId,
      mapLayer, showSeaMarks, showSiblingBuoys, windArrowsMinZoom,
      startLineResizeMode, startLineFixBearingMode, buoyDeployMode,
      windAngleDefaults, buoyFollowSettings, courseAdjustmentSettings, integrations
    } = req.body;
    
    let settings = await storage.getUserSettings(userId);
    
    if (!settings) {
      settings = await storage.createUserSettings({
        userId,
        distanceUnit: distanceUnit ?? "nautical_miles",
        speedUnit: speedUnit ?? "knots",
        windSource: windSource ?? "buoy",
        selectedWindBuoyId: selectedWindBuoyId ?? null,
      });
    }
    
    // Update with any provided fields
    settings = await storage.updateUserSettings(userId, {
      ...(distanceUnit !== undefined && { distanceUnit }),
      ...(speedUnit !== undefined && { speedUnit }),
      ...(windSource !== undefined && { windSource }),
      ...(selectedWindBuoyId !== undefined && { selectedWindBuoyId }),
      ...(mapLayer !== undefined && { mapLayer }),
      ...(showSeaMarks !== undefined && { showSeaMarks }),
      ...(showSiblingBuoys !== undefined && { showSiblingBuoys }),
      ...(windArrowsMinZoom !== undefined && { windArrowsMinZoom }),
      ...(startLineResizeMode !== undefined && { startLineResizeMode }),
      ...(startLineFixBearingMode !== undefined && { startLineFixBearingMode }),
      ...(buoyDeployMode !== undefined && { buoyDeployMode }),
      ...(windAngleDefaults !== undefined && { windAngleDefaults }),
      ...(buoyFollowSettings !== undefined && { buoyFollowSettings }),
      ...(courseAdjustmentSettings !== undefined && { courseAdjustmentSettings }),
      ...(integrations !== undefined && { integrations }),
    });

    res.json({
      distanceUnit: settings?.distanceUnit,
      speedUnit: settings?.speedUnit,
      windSource: settings?.windSource,
      selectedWindBuoyId: settings?.selectedWindBuoyId,
      mapLayer: settings?.mapLayer,
      showSeaMarks: settings?.showSeaMarks,
      showSiblingBuoys: settings?.showSiblingBuoys,
      windArrowsMinZoom: settings?.windArrowsMinZoom,
      startLineResizeMode: settings?.startLineResizeMode,
      startLineFixBearingMode: settings?.startLineFixBearingMode,
      buoyDeployMode: settings?.buoyDeployMode,
      windAngleDefaults: settings?.windAngleDefaults,
      buoyFollowSettings: settings?.buoyFollowSettings,
      courseAdjustmentSettings: settings?.courseAdjustmentSettings,
      integrations: settings?.integrations,
    });
  });

  // Weather Insights API endpoints
  
  // Get weather history for a specific buoy
  app.get("/api/weather/buoy/:buoyId", requireAuth, async (req, res) => {
    try {
      const { buoyId } = req.params;
      const minutesParam = Array.isArray(req.query.minutes) 
        ? req.query.minutes[0] 
        : req.query.minutes;
      const minutes = parseInt(minutesParam ?? "60", 10);
      
      const readings = await storage.getWeatherHistory(buoyId, minutes);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching buoy weather history:", error);
      res.status(500).json({ error: "Failed to fetch weather history" });
    }
  });

  // Get weather history for an event (all buoys)
  app.get("/api/weather/event/:eventId", requireAuth, async (req, res) => {
    try {
      const { eventId } = req.params;
      const minutesParam = Array.isArray(req.query.minutes) 
        ? req.query.minutes[0] 
        : req.query.minutes;
      const minutes = parseInt(minutesParam ?? "60", 10);
      
      const readings = await storage.getEventWeatherHistory(eventId, minutes);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching event weather history:", error);
      res.status(500).json({ error: "Failed to fetch weather history" });
    }
  });

  // Get weather analytics for an event
  app.get("/api/weather/analytics/:eventId", requireAuth, async (req, res) => {
    try {
      const { eventId } = req.params;
      const minutesParam = Array.isArray(req.query.minutes) 
        ? req.query.minutes[0] 
        : req.query.minutes;
      const minutes = parseInt(minutesParam ?? "60", 10);
      
      const readings = await storage.getEventWeatherHistory(eventId, minutes);
      
      // Get buoy info for names
      const buoyIds = Array.from(new Set(readings.map(r => r.buoyId)));
      const buoyInfoMap = new Map<string, { id: string; name: string }>();
      for (const buoyId of buoyIds) {
        const buoy = await storage.getBuoy(buoyId);
        if (buoy) {
          buoyInfoMap.set(buoyId, { id: buoy.id, name: buoy.name });
        }
      }
      
      const analytics = analyzeWeather(readings, buoyInfoMap);
      res.json(analytics);
    } catch (error) {
      console.error("Error analyzing weather:", error);
      res.status(500).json({ error: "Failed to analyze weather" });
    }
  });

  // Record a new weather reading (for buoy data ingestion)
  app.post("/api/weather/reading", requireAuth, async (req, res) => {
    try {
      const parsed = insertBuoyWeatherHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid weather reading data", details: parsed.error });
      }
      
      const reading = await storage.createWeatherReading(parsed.data);
      res.status(201).json(reading);
    } catch (error) {
      console.error("Error creating weather reading:", error);
      res.status(500).json({ error: "Failed to create weather reading" });
    }
  });

  // Cleanup old weather history (admin only)
  app.delete("/api/weather/cleanup", requireAuth, requireRole("super_admin"), async (req, res) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const deleted = await storage.deleteOldWeatherHistory(hours);
      res.json({ deleted, message: `Deleted ${deleted} readings older than ${hours} hours` });
    } catch (error) {
      console.error("Error cleaning up weather history:", error);
      res.status(500).json({ error: "Failed to cleanup weather history" });
    }
  });

  // External Info API endpoints
  
  // Fetch and parse external info for an event
  app.post("/api/events/:id/fetch-external-info", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getEvent(id);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      if (!event.manage2SailUrl && !event.racingRulesUrl) {
        return res.status(400).json({ error: "No external URLs configured for this event" });
      }

      const externalInfo = await fetchExternalInfo(event.manage2SailUrl, event.racingRulesUrl);
      
      // Update event with parsed info
      const updated = await storage.updateEvent(id, { externalInfo });
      
      res.json({ success: true, externalInfo, event: updated });
    } catch (error) {
      console.error("Error fetching external info:", error);
      res.status(500).json({ error: "Failed to fetch external info" });
    }
  });

  // Get external info for an event
  app.get("/api/events/:id/external-info", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getEvent(id);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json({
        manage2SailUrl: event.manage2SailUrl,
        racingRulesUrl: event.racingRulesUrl,
        externalInfo: event.externalInfo,
      });
    } catch (error) {
      console.error("Error getting external info:", error);
      res.status(500).json({ error: "Failed to get external info" });
    }
  });

  // Update event URLs and optionally fetch external info
  app.patch("/api/events/:id/external-urls", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { manage2SailUrl, racingRulesUrl, fetchImmediately } = req.body;
      
      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      let updateData: Partial<DbEvent> = {};
      
      if (manage2SailUrl !== undefined) {
        updateData.manage2SailUrl = manage2SailUrl || null;
      }
      if (racingRulesUrl !== undefined) {
        updateData.racingRulesUrl = racingRulesUrl || null;
      }

      // Optionally fetch and parse immediately
      if (fetchImmediately) {
        const newManage2Sail = manage2SailUrl !== undefined ? manage2SailUrl : event.manage2SailUrl;
        const newRacingRules = racingRulesUrl !== undefined ? racingRulesUrl : event.racingRulesUrl;
        
        if (newManage2Sail || newRacingRules) {
          const externalInfo = await fetchExternalInfo(newManage2Sail, newRacingRules);
          updateData.externalInfo = externalInfo;
        }
      }

      const updated = await storage.updateEvent(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating external URLs:", error);
      res.status(500).json({ error: "Failed to update external URLs" });
    }
  });

  return httpServer;
}
