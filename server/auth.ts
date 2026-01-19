import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User, UserRole } from "@shared/schema";

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
  
  app.use(
    session({
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
