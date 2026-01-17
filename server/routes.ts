import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEventSchema, 
  insertCourseSchema, 
  insertMarkSchema, 
  insertBuoySchema,
  insertUserSettingsSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
      const club = await storage.getSailClub(req.params.id);
      if (!club) {
        return res.status(404).json({ error: "Sail club not found" });
      }
      res.json(club);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sail club" });
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
