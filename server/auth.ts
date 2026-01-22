import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User, UserRole } from "@shared/schema";
import { db, pool } from "./db";
import { boatClasses } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: UserRole;
    sailClubId: string | null;
  }
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setupSession(app: Express): void {
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (!sessionSecret) {
    console.error("WARNING: SESSION_SECRET environment variable is not set. Using insecure default for development only.");
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production environment");
    }
  }
  
  const PgSession = connectPgSimple(session);
  
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: sessionSecret || "dev-only-insecure-secret-" + Date.now(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );
}

export async function seedSuperAdmin(): Promise<void> {
  const existingAdmin = await storage.getUserByUsername("alconadmin");
  if (existingAdmin) {
    console.log("Super admin already exists");
    return;
  }

  // Use environment variable for admin password, with secure default behavior
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.warn("WARNING: ADMIN_PASSWORD environment variable not set. Super admin will NOT be created.");
    console.warn("To create the super admin, set ADMIN_PASSWORD environment variable and restart.");
    return;
  }
  
  if (adminPassword.length < 8) {
    console.error("ERROR: ADMIN_PASSWORD must be at least 8 characters long");
    return;
  }

  const passwordHash = await hashPassword(adminPassword);
  await storage.createUser({
    username: "alconadmin",
    passwordHash,
    role: "super_admin",
    sailClubId: undefined,
  });
  console.log("Super admin seeded successfully");
}

export async function seedBoatClasses(): Promise<void> {
  const boatClassData = [
    {
      name: "Optimist",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 2.31,
      upwindVmgLight: 1.8,
      upwindVmgMedium: 2.5,
      upwindVmgHeavy: 2.8,
      upwindTwa: 45,
      downwindVmgLight: 2.0,
      downwindVmgMedium: 2.8,
      downwindVmgHeavy: 3.0,
      downwindTwa: 150,
      reachSpeedLight: 2.5,
      reachSpeedMedium: 3.5,
      reachSpeedHeavy: 4.0,
      tackTime: 12,
      jibeTime: 10,
      markRoundingTime: 12,
      noGoZoneAngle: 45,
    },
    {
      name: "ILCA 4",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.19,
      upwindVmgLight: 2.5,
      upwindVmgMedium: 3.2,
      upwindVmgHeavy: 3.5,
      upwindTwa: 43,
      downwindVmgLight: 2.8,
      downwindVmgMedium: 3.8,
      downwindVmgHeavy: 4.2,
      downwindTwa: 145,
      reachSpeedLight: 3.5,
      reachSpeedMedium: 4.5,
      reachSpeedHeavy: 5.0,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "ILCA 6",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.19,
      upwindVmgLight: 3.0,
      upwindVmgMedium: 3.8,
      upwindVmgHeavy: 4.2,
      upwindTwa: 42,
      downwindVmgLight: 3.2,
      downwindVmgMedium: 4.2,
      downwindVmgHeavy: 4.8,
      downwindTwa: 145,
      reachSpeedLight: 4.0,
      reachSpeedMedium: 5.2,
      reachSpeedHeavy: 5.8,
      tackTime: 9,
      jibeTime: 7,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "ILCA 7",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.19,
      upwindVmgLight: 3.2,
      upwindVmgMedium: 4.2,
      upwindVmgHeavy: 4.8,
      upwindTwa: 42,
      downwindVmgLight: 3.5,
      downwindVmgMedium: 4.5,
      downwindVmgHeavy: 5.2,
      downwindTwa: 145,
      reachSpeedLight: 4.5,
      reachSpeedMedium: 5.8,
      reachSpeedHeavy: 6.5,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "420",
      hullType: "displacement",
      crewSize: 2,
      lengthMeters: 4.2,
      upwindVmgLight: 2.8,
      upwindVmgMedium: 3.5,
      upwindVmgHeavy: 4.0,
      upwindTwa: 43,
      downwindVmgLight: 3.0,
      downwindVmgMedium: 4.0,
      downwindVmgHeavy: 4.5,
      downwindTwa: 148,
      reachSpeedLight: 4.0,
      reachSpeedMedium: 5.0,
      reachSpeedHeavy: 5.5,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 10,
      noGoZoneAngle: 43,
    },
    {
      name: "470",
      hullType: "displacement",
      crewSize: 2,
      lengthMeters: 4.7,
      upwindVmgLight: 3.5,
      upwindVmgMedium: 4.5,
      upwindVmgHeavy: 5.2,
      upwindTwa: 42,
      downwindVmgLight: 3.8,
      downwindVmgMedium: 5.0,
      downwindVmgHeavy: 5.8,
      downwindTwa: 145,
      reachSpeedLight: 4.5,
      reachSpeedMedium: 6.0,
      reachSpeedHeavy: 7.0,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "29er",
      hullType: "planing",
      crewSize: 2,
      lengthMeters: 4.45,
      upwindVmgLight: 3.8,
      upwindVmgMedium: 5.0,
      upwindVmgHeavy: 6.0,
      upwindTwa: 40,
      downwindVmgLight: 4.5,
      downwindVmgMedium: 6.5,
      downwindVmgHeavy: 8.0,
      downwindTwa: 140,
      reachSpeedLight: 5.5,
      reachSpeedMedium: 8.0,
      reachSpeedHeavy: 10.0,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 8,
      noGoZoneAngle: 40,
    },
    {
      name: "49er",
      hullType: "planing",
      crewSize: 2,
      lengthMeters: 4.99,
      upwindVmgLight: 4.5,
      upwindVmgMedium: 6.0,
      upwindVmgHeavy: 7.0,
      upwindTwa: 38,
      downwindVmgLight: 5.5,
      downwindVmgMedium: 8.0,
      downwindVmgHeavy: 10.0,
      downwindTwa: 135,
      reachSpeedLight: 7.0,
      reachSpeedMedium: 10.0,
      reachSpeedHeavy: 13.0,
      tackTime: 6,
      jibeTime: 5,
      markRoundingTime: 8,
      noGoZoneAngle: 38,
    },
    {
      name: "49erFX",
      hullType: "planing",
      crewSize: 2,
      lengthMeters: 4.99,
      upwindVmgLight: 4.2,
      upwindVmgMedium: 5.5,
      upwindVmgHeavy: 6.5,
      upwindTwa: 38,
      downwindVmgLight: 5.0,
      downwindVmgMedium: 7.5,
      downwindVmgHeavy: 9.5,
      downwindTwa: 135,
      reachSpeedLight: 6.5,
      reachSpeedMedium: 9.5,
      reachSpeedHeavy: 12.0,
      tackTime: 6,
      jibeTime: 5,
      markRoundingTime: 8,
      noGoZoneAngle: 38,
    },
    {
      name: "Finn",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.5,
      upwindVmgLight: 3.5,
      upwindVmgMedium: 4.5,
      upwindVmgHeavy: 5.5,
      upwindTwa: 42,
      downwindVmgLight: 3.8,
      downwindVmgMedium: 5.0,
      downwindVmgHeavy: 6.0,
      downwindTwa: 145,
      reachSpeedLight: 4.5,
      reachSpeedMedium: 6.0,
      reachSpeedHeavy: 7.5,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "RS Aero 5",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.0,
      upwindVmgLight: 2.8,
      upwindVmgMedium: 3.5,
      upwindVmgHeavy: 4.0,
      upwindTwa: 42,
      downwindVmgLight: 3.0,
      downwindVmgMedium: 4.0,
      downwindVmgHeavy: 4.5,
      downwindTwa: 145,
      reachSpeedLight: 3.8,
      reachSpeedMedium: 5.0,
      reachSpeedHeavy: 5.5,
      tackTime: 9,
      jibeTime: 7,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "RS Aero 7",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.0,
      upwindVmgLight: 3.2,
      upwindVmgMedium: 4.2,
      upwindVmgHeavy: 4.8,
      upwindTwa: 42,
      downwindVmgLight: 3.5,
      downwindVmgMedium: 4.8,
      downwindVmgHeavy: 5.5,
      downwindTwa: 145,
      reachSpeedLight: 4.2,
      reachSpeedMedium: 5.8,
      reachSpeedHeavy: 6.5,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "RS Aero 9",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.0,
      upwindVmgLight: 3.5,
      upwindVmgMedium: 4.5,
      upwindVmgHeavy: 5.2,
      upwindTwa: 42,
      downwindVmgLight: 3.8,
      downwindVmgMedium: 5.2,
      downwindVmgHeavy: 6.0,
      downwindTwa: 145,
      reachSpeedLight: 4.5,
      reachSpeedMedium: 6.2,
      reachSpeedHeavy: 7.2,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 42,
    },
    {
      name: "Topper",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 3.4,
      upwindVmgLight: 2.2,
      upwindVmgMedium: 3.0,
      upwindVmgHeavy: 3.5,
      upwindTwa: 44,
      downwindVmgLight: 2.5,
      downwindVmgMedium: 3.5,
      downwindVmgHeavy: 4.0,
      downwindTwa: 148,
      reachSpeedLight: 3.0,
      reachSpeedMedium: 4.2,
      reachSpeedHeavy: 5.0,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 10,
      noGoZoneAngle: 44,
    },
    {
      name: "Sunfish",
      hullType: "displacement",
      crewSize: 1,
      lengthMeters: 4.19,
      upwindVmgLight: 2.0,
      upwindVmgMedium: 2.8,
      upwindVmgHeavy: 3.2,
      upwindTwa: 45,
      downwindVmgLight: 2.2,
      downwindVmgMedium: 3.2,
      downwindVmgHeavy: 3.8,
      downwindTwa: 150,
      reachSpeedLight: 2.8,
      reachSpeedMedium: 4.0,
      reachSpeedHeavy: 4.8,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 45,
    },
    {
      name: "J/70",
      hullType: "displacement",
      crewSize: 5,
      lengthMeters: 6.93,
      upwindVmgLight: 4.0,
      upwindVmgMedium: 5.2,
      upwindVmgHeavy: 6.0,
      upwindTwa: 40,
      downwindVmgLight: 4.5,
      downwindVmgMedium: 6.5,
      downwindVmgHeavy: 8.0,
      downwindTwa: 140,
      reachSpeedLight: 5.5,
      reachSpeedMedium: 7.5,
      reachSpeedHeavy: 9.0,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 40,
    },
    {
      name: "Nacra 17",
      hullType: "foiling",
      crewSize: 2,
      lengthMeters: 5.25,
      upwindVmgLight: 5.0,
      upwindVmgMedium: 7.0,
      upwindVmgHeavy: 9.0,
      upwindTwa: 35,
      downwindVmgLight: 6.0,
      downwindVmgMedium: 10.0,
      downwindVmgHeavy: 14.0,
      downwindTwa: 130,
      reachSpeedLight: 8.0,
      reachSpeedMedium: 14.0,
      reachSpeedHeavy: 18.0,
      tackTime: 8,
      jibeTime: 6,
      markRoundingTime: 10,
      noGoZoneAngle: 35,
    },
    {
      name: "Hobie 16",
      hullType: "planing",
      crewSize: 2,
      lengthMeters: 5.08,
      upwindVmgLight: 4.0,
      upwindVmgMedium: 5.5,
      upwindVmgHeavy: 6.5,
      upwindTwa: 40,
      downwindVmgLight: 5.0,
      downwindVmgMedium: 7.0,
      downwindVmgHeavy: 9.0,
      downwindTwa: 140,
      reachSpeedLight: 6.0,
      reachSpeedMedium: 9.0,
      reachSpeedHeavy: 11.0,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 40,
    },
    {
      name: "WASZP",
      hullType: "foiling",
      crewSize: 1,
      lengthMeters: 3.35,
      upwindVmgLight: 5.0,
      upwindVmgMedium: 7.5,
      upwindVmgHeavy: 9.0,
      upwindTwa: 35,
      downwindVmgLight: 6.5,
      downwindVmgMedium: 11.0,
      downwindVmgHeavy: 15.0,
      downwindTwa: 125,
      reachSpeedLight: 9.0,
      reachSpeedMedium: 15.0,
      reachSpeedHeavy: 20.0,
      tackTime: 6,
      jibeTime: 5,
      markRoundingTime: 8,
      noGoZoneAngle: 35,
    },
    {
      name: "iQFoil",
      hullType: "foiling",
      crewSize: 1,
      lengthMeters: 2.2,
      upwindVmgLight: 6.0,
      upwindVmgMedium: 9.0,
      upwindVmgHeavy: 12.0,
      upwindTwa: 32,
      downwindVmgLight: 8.0,
      downwindVmgMedium: 14.0,
      downwindVmgHeavy: 20.0,
      downwindTwa: 120,
      reachSpeedLight: 12.0,
      reachSpeedMedium: 20.0,
      reachSpeedHeavy: 28.0,
      tackTime: 4,
      jibeTime: 4,
      markRoundingTime: 6,
      noGoZoneAngle: 32,
    },
    {
      name: "Yngling",
      hullType: "displacement",
      crewSize: 3,
      lengthMeters: 6.35,
      upwindVmgLight: 3.2,
      upwindVmgMedium: 4.2,
      upwindVmgHeavy: 4.8,
      upwindTwa: 42,
      downwindVmgLight: 3.5,
      downwindVmgMedium: 4.8,
      downwindVmgHeavy: 5.5,
      downwindTwa: 145,
      reachSpeedLight: 4.2,
      reachSpeedMedium: 5.8,
      reachSpeedHeavy: 6.8,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 42,
    },
    {
      name: "Lightning",
      hullType: "displacement",
      crewSize: 3,
      lengthMeters: 5.79,
      upwindVmgLight: 3.0,
      upwindVmgMedium: 4.0,
      upwindVmgHeavy: 4.5,
      upwindTwa: 43,
      downwindVmgLight: 3.2,
      downwindVmgMedium: 4.5,
      downwindVmgHeavy: 5.2,
      downwindTwa: 148,
      reachSpeedLight: 4.0,
      reachSpeedMedium: 5.5,
      reachSpeedHeavy: 6.5,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 43,
    },
    {
      name: "RS 21",
      hullType: "displacement",
      crewSize: 4,
      lengthMeters: 6.4,
      upwindVmgLight: 3.5,
      upwindVmgMedium: 4.5,
      upwindVmgHeavy: 5.2,
      upwindTwa: 41,
      downwindVmgLight: 4.0,
      downwindVmgMedium: 5.5,
      downwindVmgHeavy: 6.5,
      downwindTwa: 145,
      reachSpeedLight: 5.0,
      reachSpeedMedium: 6.5,
      reachSpeedHeavy: 7.8,
      tackTime: 10,
      jibeTime: 8,
      markRoundingTime: 12,
      noGoZoneAngle: 41,
    },
  ];

  // Get existing boat class names
  const existingClasses = await db.select({ name: boatClasses.name }).from(boatClasses);
  const existingNames = new Set(existingClasses.map(c => c.name));
  
  // Filter to only new boat classes
  const newBoatClasses = boatClassData.filter(bc => !existingNames.has(bc.name));
  
  if (newBoatClasses.length === 0) {
    console.log("All boat classes already exist");
    return;
  }

  try {
    await db.insert(boatClasses).values(newBoatClasses);
    console.log(`Seeded ${newBoatClasses.length} new boat classes: ${newBoatClasses.map(bc => bc.name).join(", ")}`);
  } catch (error) {
    console.error("Error seeding boat classes:", error);
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

export const requireRole = (...roles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.session.role as UserRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

export const requireClubAccess: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  if (req.session.role === "super_admin") {
    return next();
  }
  
  const clubId = req.params.clubId || req.query.sailClubId || req.body?.sailClubId;
  if (clubId && req.session.sailClubId !== clubId) {
    return res.status(403).json({ error: "No access to this club" });
  }
  
  next();
};

export const requireEventAccess: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  if (req.session.role === "super_admin" || req.session.role === "club_manager") {
    return next();
  }
  
  const eventId = req.params.id || req.params.eventId;
  if (!eventId) {
    return next();
  }
  
  const accessList = await storage.getUserEventAccess(req.session.userId);
  const hasAccess = accessList.some(a => a.eventId === eventId);
  
  if (!hasAccess) {
    return res.status(403).json({ error: "No access to this event" });
  }
  
  next();
};

export function safeUserResponse(user: User): Omit<User, "passwordHash"> {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
