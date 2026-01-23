import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Enums as Zod schemas
export const userRoleSchema = z.enum(["super_admin", "club_manager", "event_manager"]);
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

export const buoyOwnershipSchema = z.enum(["platform_owned", "long_rental", "event_rental"]);
export type BuoyOwnership = z.infer<typeof buoyOwnershipSchema>;

export const buoyInventoryStatusSchema = z.enum(["in_inventory", "assigned_club", "assigned_event", "maintenance", "retired"]);
export type BuoyInventoryStatus = z.infer<typeof buoyInventoryStatusSchema>;

export const buoyAssignmentStatusSchema = z.enum(["active", "completed"]);
export type BuoyAssignmentStatus = z.infer<typeof buoyAssignmentStatusSchema>;

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

export const hullTypeSchema = z.enum(["displacement", "planing", "foiling"]);
export type HullType = z.infer<typeof hullTypeSchema>;

// Database Tables

// Boat Classes with simplified performance data for race time estimation
export const boatClasses = pgTable("boat_classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  hullType: text("hull_type").notNull().default("displacement"),
  crewSize: integer("crew_size").notNull().default(1),
  
  // Boat dimensions
  lengthMeters: real("length_meters").notNull().default(4.0),  // Hull length in meters
  
  // Upwind performance (VMG in knots at different wind speeds)
  upwindVmgLight: real("upwind_vmg_light").notNull(),    // 0-8 kts wind
  upwindVmgMedium: real("upwind_vmg_medium").notNull(),  // 8-14 kts wind
  upwindVmgHeavy: real("upwind_vmg_heavy").notNull(),    // 14+ kts wind
  upwindTwa: real("upwind_twa").notNull().default(42),   // Optimal upwind True Wind Angle
  
  // Downwind performance (VMG in knots)
  downwindVmgLight: real("downwind_vmg_light").notNull(),
  downwindVmgMedium: real("downwind_vmg_medium").notNull(),
  downwindVmgHeavy: real("downwind_vmg_heavy").notNull(),
  downwindTwa: real("downwind_twa").notNull().default(145), // Optimal downwind TWA
  
  // Reaching performance (beam reach speed in knots)
  reachSpeedLight: real("reach_speed_light").notNull(),
  reachSpeedMedium: real("reach_speed_medium").notNull(),
  reachSpeedHeavy: real("reach_speed_heavy").notNull(),
  
  // Maneuver times (seconds)
  tackTime: real("tack_time").notNull().default(8),
  jibeTime: real("jibe_time").notNull().default(6),
  markRoundingTime: real("mark_rounding_time").notNull().default(10),
  
  // No-go zone boundaries (degrees from wind)
  noGoZoneAngle: real("no_go_zone_angle").notNull().default(40),
});
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("event_manager"),
  sailClubId: varchar("sail_club_id"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const userEventAccess = pgTable("user_event_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  eventId: varchar("event_id").notNull(),
  grantedBy: varchar("granted_by"),
  grantedAt: timestamp("granted_at").defaultNow(),
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
  boatClassId: varchar("boat_class_id"),  // Reference to boat_classes table
  targetDuration: integer("target_duration").notNull().default(40),
  courseId: varchar("course_id"),
  startDate: timestamp("start_date"),  // Event start date (required for filtering)
  endDate: timestamp("end_date"),      // Event end date (optional, for multi-day events)
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
  serialNumber: text("serial_number"),
  sailClubId: varchar("sail_club_id"),
  state: text("state").notNull().default("idle"),
  lat: real("lat").default(0),
  lng: real("lng").default(0),
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
  ownershipType: text("ownership_type").notNull().default("platform_owned"),
  inventoryStatus: text("inventory_status").notNull().default("in_inventory"),
  eventId: varchar("event_id"),
  weatherSensorModel: text("weather_sensor_model"),
  motorModel: text("motor_model"),
  cameraModel: text("camera_model"),
  batteryInfo: text("battery_info"),
  otherEquipment: text("other_equipment"),
  hardwareConfig: jsonb("hardware_config").$type<{
    sensors?: string[];
    firmwareVersion?: string;
    hardwareRevision?: string;
    notes?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buoyAssignments = pgTable("buoy_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buoyId: varchar("buoy_id").notNull(),
  sailClubId: varchar("sail_club_id"),
  eventId: varchar("event_id"),
  assignmentType: text("assignment_type").notNull(),
  status: text("status").notNull().default("active"),
  startAt: timestamp("start_at").defaultNow(),
  endAt: timestamp("end_at"),
  assignedBy: varchar("assigned_by"),
  notes: text("notes"),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  distanceUnit: text("distance_unit").notNull().default("nautical_miles"),
  speedUnit: text("speed_unit").notNull().default("knots"),
  windSource: text("wind_source").notNull().default("buoy"),
  selectedWindBuoyId: varchar("selected_wind_buoy_id"),
  // Map settings
  mapLayer: text("map_layer").notNull().default("ocean"),
  showSeaMarks: boolean("show_sea_marks").notNull().default(true),
  showSiblingBuoys: boolean("show_sibling_buoys").notNull().default(true),
  windArrowsMinZoom: integer("wind_arrows_min_zoom").notNull().default(13),
  // Start line settings
  startLineResizeMode: text("start_line_resize_mode").notNull().default("pin"),
  startLineFixBearingMode: text("start_line_fix_bearing_mode").notNull().default("pin"),
  // Buoy settings
  buoyDeployMode: text("buoy_deploy_mode").notNull().default("manual"),
  // Wind angle defaults (stored as JSON)
  windAngleDefaults: jsonb("wind_angle_defaults"),
  // Buoy follow settings (stored as JSON)
  buoyFollowSettings: jsonb("buoy_follow_settings"),
  // Course adjustment settings (stored as JSON)
  courseAdjustmentSettings: jsonb("course_adjustment_settings"),
});

// Visibility scope for saved course snapshots
export const visibilityScopeSchema = z.enum(["global", "club", "user"]);
export type VisibilityScope = z.infer<typeof visibilityScopeSchema>;

// Snapshot of a mark at save time (stored as JSON)
export const snapshotMarkSchema = z.object({
  name: z.string(),
  role: z.string(),
  order: z.number(),
  lat: z.number(),
  lng: z.number(),
  isStartLine: z.boolean().nullable(),
  isFinishLine: z.boolean().nullable(),
  isCourseMark: z.boolean().nullable(),
  isGate: z.boolean().nullable(),
  gateWidthBoatLengths: z.number().nullable(),
  boatLengthMeters: z.number().nullable(),
  gatePartnerId: z.string().nullable(),
  gateSide: z.string().nullable(),
});
export type SnapshotMark = z.infer<typeof snapshotMarkSchema>;

// Immutable course snapshots - complete copy of course state at save time
export const courseSnapshots = pgTable("course_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  
  // Ownership and visibility
  ownerId: varchar("owner_id").notNull(),         // User who saved it
  ownerUsername: text("owner_username").notNull(), // For display without joins
  sailClubId: varchar("sail_club_id"),            // Club association (null for super_admin global)
  sailClubName: text("sail_club_name"),           // For display without joins
  visibilityScope: text("visibility_scope").notNull().default("user"), // global, club, user
  
  // Course metadata snapshot
  shape: text("shape").notNull(),
  centerLat: real("center_lat").notNull(),
  centerLng: real("center_lng").notNull(),
  rotation: real("rotation").notNull().default(0),
  scale: real("scale").notNull().default(1),
  roundingSequence: text("rounding_sequence").array(),
  
  // Snapshot of all marks as JSON array - immutable copy
  snapshotMarks: jsonb("snapshot_marks").$type<SnapshotMark[]>().notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  role: true,
  sailClubId: true,
  createdBy: true,
});

export const insertUserEventAccessSchema = createInsertSchema(userEventAccess).pick({
  userId: true,
  eventId: true,
  grantedBy: true,
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
  boatClassId: true,
  targetDuration: true,
  courseId: true,
  startDate: true,
  endDate: true,
});

export const insertBoatClassSchema = createInsertSchema(boatClasses).pick({
  name: true,
  hullType: true,
  crewSize: true,
  lengthMeters: true,
  upwindVmgLight: true,
  upwindVmgMedium: true,
  upwindVmgHeavy: true,
  upwindTwa: true,
  downwindVmgLight: true,
  downwindVmgMedium: true,
  downwindVmgHeavy: true,
  downwindTwa: true,
  reachSpeedLight: true,
  reachSpeedMedium: true,
  reachSpeedHeavy: true,
  tackTime: true,
  jibeTime: true,
  markRoundingTime: true,
  noGoZoneAngle: true,
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
  serialNumber: true,
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
  ownershipType: true,
  inventoryStatus: true,
  eventId: true,
  weatherSensorModel: true,
  motorModel: true,
  cameraModel: true,
  batteryInfo: true,
  otherEquipment: true,
  hardwareConfig: true,
});

export const insertBuoyAssignmentSchema = createInsertSchema(buoyAssignments).pick({
  buoyId: true,
  sailClubId: true,
  eventId: true,
  assignmentType: true,
  status: true,
  assignedBy: true,
  notes: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  distanceUnit: true,
  speedUnit: true,
  windSource: true,
  selectedWindBuoyId: true,
  mapLayer: true,
  showSeaMarks: true,
  windArrowsMinZoom: true,
  startLineResizeMode: true,
  startLineFixBearingMode: true,
  buoyDeployMode: true,
  windAngleDefaults: true,
  buoyFollowSettings: true,
  courseAdjustmentSettings: true,
});

export const insertCourseSnapshotSchema = createInsertSchema(courseSnapshots).pick({
  name: true,
  ownerId: true,
  ownerUsername: true,
  sailClubId: true,
  sailClubName: true,
  visibilityScope: true,
  shape: true,
  centerLat: true,
  centerLng: true,
  rotation: true,
  scale: true,
  roundingSequence: true,
}).extend({
  snapshotMarks: z.array(snapshotMarkSchema),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserEventAccess = z.infer<typeof insertUserEventAccessSchema>;
export type UserEventAccess = typeof userEventAccess.$inferSelect;

export type InsertSailClub = z.infer<typeof insertSailClubSchema>;
export type SailClub = typeof sailClubs.$inferSelect;

export type InsertBoatClass = z.infer<typeof insertBoatClassSchema>;
export type BoatClass = typeof boatClasses.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;

export type InsertMark = z.infer<typeof insertMarkSchema>;
export type Mark = typeof marks.$inferSelect;

export type InsertBuoy = z.infer<typeof insertBuoySchema>;
export type Buoy = typeof buoys.$inferSelect;

export type InsertBuoyAssignment = z.infer<typeof insertBuoyAssignmentSchema>;
export type BuoyAssignment = typeof buoyAssignments.$inferSelect;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertCourseSnapshot = z.infer<typeof insertCourseSnapshotSchema>;
export type CourseSnapshot = typeof courseSnapshots.$inferSelect;

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

// Race time estimation types
export interface LegTimeEstimate {
  legIndex: number;
  fromMarkName: string;
  toMarkName: string;
  distance: number;           // nautical miles
  bearing: number;            // degrees
  windAngle: number;          // true wind angle for this leg
  pointOfSail: "upwind" | "close_reach" | "beam_reach" | "broad_reach" | "downwind";
  sailingDistance: number;    // actual distance sailed (may be longer due to tacking/jibing)
  vmg: number;                // velocity made good in knots
  boatSpeed: number;          // boat speed through water in knots
  legTimeSeconds: number;     // estimated leg time
  tacksOrJibes: number;       // number of maneuvers required
}

export interface RaceTimeEstimate {
  legs: LegTimeEstimate[];
  totalDistanceNm: number;
  totalSailingDistanceNm: number;
  totalTimeSeconds: number;
  totalTimeFormatted: string;
  windSpeedKnots: number;
  windDirectionDeg: number;
  boatClassName: string;
}

export interface SiblingBuoy extends Buoy {
  eventName: string;
  sourceEventId: string;
}
