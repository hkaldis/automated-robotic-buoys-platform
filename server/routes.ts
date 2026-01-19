import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEventSchema, 
  insertCourseSchema, 
  insertMarkSchema, 
  insertBuoySchema,
  insertUserSettingsSchema,
  insertSailClubSchema,
  type UserRole,
} from "@shared/schema";
import { z } from "zod";
import { 
  requireAuth, 
  requireRole, 
  hashPassword, 
  comparePassword, 
  safeUserResponse,
  requireEventAccess,
} from "./auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

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
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
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

  app.get("/api/sail-clubs", async (req, res) => {
    try {
      const clubs = await storage.getSailClubs();
      res.json(clubs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sail clubs" });
    }
  });

  app.get("/api/sail-clubs/:id", async (req, res) => {
    try {
      const clubId = req.params.id as string;
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

  app.get("/api/events", async (req, res) => {
    try {
      const sailClubId = req.query.sailClubId as string | undefined;
      const events = await storage.getEvents(sailClubId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.patch("/api/events/:id", async (req, res) => {
    try {
      const validatedData = insertEventSchema.partial().parse(req.body);
      const event = await storage.updateEvent(req.params.id, validatedData);
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

  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", async (req, res) => {
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

  app.patch("/api/courses/:id", async (req, res) => {
    try {
      const validatedData = insertCourseSchema.partial().parse(req.body);
      const course = await storage.updateCourse(req.params.id, validatedData);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid course data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update course" });
    }
  });

  app.get("/api/courses/:courseId/marks", async (req, res) => {
    try {
      const marks = await storage.getMarksByCourse(req.params.courseId);
      res.json(marks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch marks" });
    }
  });

  app.post("/api/marks", async (req, res) => {
    try {
      const validatedData = insertMarkSchema.parse(req.body);
      const mark = await storage.createMark(validatedData);
      res.status(201).json(mark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid mark data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create mark" });
    }
  });

  app.patch("/api/marks/:id", async (req, res) => {
    try {
      const validatedData = insertMarkSchema.partial().parse(req.body);
      const mark = await storage.updateMark(req.params.id, validatedData);
      if (!mark) {
        return res.status(404).json({ error: "Mark not found" });
      }
      res.json(mark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid mark data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update mark" });
    }
  });

  app.delete("/api/marks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMark(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Mark not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete mark" });
    }
  });

  app.delete("/api/courses/:id/marks", async (req, res) => {
    try {
      const count = await storage.deleteMarksByCourse(req.params.id);
      res.json({ deleted: count });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete marks" });
    }
  });

  app.get("/api/buoys", async (req, res) => {
    try {
      const sailClubId = req.query.sailClubId as string | undefined;
      const buoys = await storage.getBuoys(sailClubId);
      res.json(buoys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buoys" });
    }
  });

  app.get("/api/buoys/:id", async (req, res) => {
    try {
      const buoy = await storage.getBuoy(req.params.id);
      if (!buoy) {
        return res.status(404).json({ error: "Buoy not found" });
      }
      res.json(buoy);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buoy" });
    }
  });

  app.post("/api/buoys", async (req, res) => {
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

  app.patch("/api/buoys/:id", async (req, res) => {
    try {
      const validatedData = insertBuoySchema.partial().parse(req.body);
      const buoy = await storage.updateBuoy(req.params.id, validatedData);
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

  app.post("/api/buoys/:id/command", async (req, res) => {
    try {
      const { command, targetLat, targetLng } = req.body;
      const buoy = await storage.getBuoy(req.params.id);
      
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

      const updated = await storage.updateBuoy(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to execute command" });
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

  const DEFAULT_USER_ID = "default-user";

  app.get("/api/settings", async (req, res) => {
    let settings = await storage.getUserSettings(DEFAULT_USER_ID);
    if (!settings) {
      settings = await storage.createUserSettings({
        userId: DEFAULT_USER_ID,
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
    });
  });

  app.patch("/api/settings", async (req, res) => {
    const { distanceUnit, speedUnit, windSource, selectedWindBuoyId } = req.body;
    
    let settings = await storage.getUserSettings(DEFAULT_USER_ID);
    if (!settings) {
      settings = await storage.createUserSettings({
        userId: DEFAULT_USER_ID,
        distanceUnit: distanceUnit ?? "nautical_miles",
        speedUnit: speedUnit ?? "knots",
        windSource: windSource ?? "buoy",
        selectedWindBuoyId: selectedWindBuoyId ?? null,
      });
    } else {
      settings = await storage.updateUserSettings(DEFAULT_USER_ID, {
        ...(distanceUnit !== undefined && { distanceUnit }),
        ...(speedUnit !== undefined && { speedUnit }),
        ...(windSource !== undefined && { windSource }),
        ...(selectedWindBuoyId !== undefined && { selectedWindBuoyId }),
      });
    }

    res.json({
      distanceUnit: settings?.distanceUnit,
      speedUnit: settings?.speedUnit,
      windSource: settings?.windSource,
      selectedWindBuoyId: settings?.selectedWindBuoyId,
    });
  });

  return httpServer;
}
