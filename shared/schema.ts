import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Enums as Zod schemas
export const userRoleSchema = z.enum(["admin", "race_officer"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const eventTypeSchema = z.enum(["race", "training"]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const buoyStateSchema = z.enum([
  "idle",
  "moving_to_target",
  "holding_position",
  "station_keeping_degraded",
  "unavailable",
  "maintenance",
  "fault"
]);
export type BuoyState = z.infer<typeof buoyStateSchema>;

export const markRoleSchema = z.enum([
  "start_boat",    // Committee boat at starboard end of start line
  "pin",           // Pin mark at port end of start line
  "turning_mark",  // Generic turning mark
  "finish",        // Finish line mark
  "windward",      // Mark 1 - Windward/weather mark (upwind)
  "leeward",       // Mark 3/4 - Leeward mark (downwind)
  "gate",          // Gate mark (3s=starboard, 3p=port)
  "offset",        // Offset/spreader mark near windward
  "wing",          // Mark 2 - Wing/gybe mark (trapezoid/triangle reaching)
  "other"          // Custom/other marks
]);
export type MarkRole = z.infer<typeof markRoleSchema>;

export const courseShapeSchema = z.enum(["triangle", "trapezoid", "windward_leeward", "custom"]);
export type CourseShape = z.infer<typeof courseShapeSchema>;

export const windSourceSchema = z.enum(["api", "buoy", "manual"]);
export type WindSource = z.infer<typeof windSourceSchema>;

export const distanceUnitSchema = z.enum(["meters", "kilometers", "nautical_miles", "miles"]);
export type DistanceUnit = z.infer<typeof distanceUnitSchema>;

export const speedUnitSchema = z.enum(["knots", "beaufort", "ms", "kmh", "mph"]);
export type SpeedUnit = z.infer<typeof speedUnitSchema>;

// Database Tables
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("race_officer"),
  sailClubId: varchar("sail_club_id"),
});

export const sailClubs = pgTable("sail_clubs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  location: jsonb("location").$type<{ lat: number; lng: number }>(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("race"),
  sailClubId: varchar("sail_club_id").notNull(),
  boatClass: text("boat_class").notNull(),
  targetDuration: integer("target_duration").notNull().default(40),
  courseId: varchar("course_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shape: text("shape").notNull().default("triangle"),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  rotation: real("rotation").notNull().default(0),
  scale: real("scale").notNull().default(1),
  roundingSequence: text("rounding_sequence").array(),
});

export const marks = pgTable("marks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  order: integer("order").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  assignedBuoyId: varchar("assigned_buoy_id"),
  isStartLine: boolean("is_start_line").default(false),
  isFinishLine: boolean("is_finish_line").default(false),
  isCourseMark: boolean("is_course_mark").default(true),
  isGate: boolean("is_gate").default(false),
  gateWidthBoatLengths: real("gate_width_boat_lengths").default(8),
  boatLengthMeters: real("boat_length_meters").default(6),
  gatePartnerId: varchar("gate_partner_id"),
  gateSide: text("gate_side"),
  gatePortBuoyId: varchar("gate_port_buoy_id"),
  gateStarboardBuoyId: varchar("gate_starboard_buoy_id"),
});

export const buoys = pgTable("buoys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sailClubId: varchar("sail_club_id").notNull(),
  state: text("state").notNull().default("idle"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  targetLat: real("target_lat"),
  targetLng: real("target_lng"),
  speed: real("speed").notNull().default(0),
  battery: integer("battery").notNull().default(100),
  signalStrength: integer("signal_strength").notNull().default(100),
  windSpeed: real("wind_speed"),
  windDirection: real("wind_direction"),
  currentSpeed: real("current_speed"),
  currentDirection: real("current_direction"),
  eta: integer("eta"),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  distanceUnit: text("distance_unit").notNull().default("nautical_miles"),
  speedUnit: text("speed_unit").notNull().default("knots"),
  windSource: text("wind_source").notNull().default("buoy"),
  selectedWindBuoyId: varchar("selected_wind_buoy_id"),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  sailClubId: true,
});

export const insertSailClubSchema = createInsertSchema(sailClubs).pick({
  name: true,
  logoUrl: true,
  location: true,
});

export const insertEventSchema = createInsertSchema(events).pick({
  name: true,
  type: true,
  sailClubId: true,
  boatClass: true,
  targetDuration: true,
  courseId: true,
});

export const insertCourseSchema = createInsertSchema(courses).pick({
  name: true,
  shape: true,
  centerLat: true,
  centerLng: true,
  rotation: true,
  scale: true,
  roundingSequence: true,
});

export const insertMarkSchema = createInsertSchema(marks).pick({
  courseId: true,
  name: true,
  role: true,
  order: true,
  lat: true,
  lng: true,
  assignedBuoyId: true,
  isStartLine: true,
  isFinishLine: true,
  isCourseMark: true,
  isGate: true,
  gateWidthBoatLengths: true,
  boatLengthMeters: true,
  gatePartnerId: true,
  gateSide: true,
  gatePortBuoyId: true,
  gateStarboardBuoyId: true,
});

export const insertBuoySchema = createInsertSchema(buoys).pick({
  name: true,
  sailClubId: true,
  state: true,
  lat: true,
  lng: true,
  targetLat: true,
  targetLng: true,
  speed: true,
  battery: true,
  signalStrength: true,
  windSpeed: true,
  windDirection: true,
  currentSpeed: true,
  currentDirection: true,
  eta: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  distanceUnit: true,
  speedUnit: true,
  windSource: true,
  selectedWindBuoyId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSailClub = z.infer<typeof insertSailClubSchema>;
export type SailClub = typeof sailClubs.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

export type InsertMark = z.infer<typeof insertMarkSchema>;
export type Mark = typeof marks.$inferSelect;

export type InsertBuoy = z.infer<typeof insertBuoySchema>;
export type Buoy = typeof buoys.$inferSelect;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

// Frontend-only types for services
export interface WeatherData {
  windSpeed: number;
  windDirection: number;
  currentSpeed: number;
  currentDirection: number;
  source: WindSource;
  sourceBuoyId?: string;
  timestamp: Date;
}

export interface CourseValidity {
  isValid: boolean;
  windShiftDetected: boolean;
  buoyDriftDetected: boolean;
  recommendations: string[];
}

export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface LegInfo {
  fromMarkId: string;
  toMarkId: string;
  distance: number;
  bearing: number;
}
