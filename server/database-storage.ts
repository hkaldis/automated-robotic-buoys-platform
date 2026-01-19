import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  userEventAccess,
  sailClubs,
  events,
  courses,
  marks,
  buoys,
  userSettings,
  type User,
  type InsertUser,
  type SailClub,
  type InsertSailClub,
  type Event,
  type InsertEvent,
  type Course,
  type InsertCourse,
  type Mark,
  type InsertMark,
  type Buoy,
  type InsertBuoy,
  type UserSettings,
  type InsertUserSettings,
  type UserEventAccess,
  type InsertUserEventAccess,
} from "@shared/schema";
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.username})`, username.toLowerCase()));
    return user;
  }

  async getUsers(sailClubId?: string): Promise<User[]> {
    if (sailClubId) {
      return db.select().from(users).where(eq(users.sailClubId, sailClubId));
    }
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      role: insertUser.role ?? "event_manager",
      sailClubId: insertUser.sailClubId ?? null,
      createdBy: insertUser.createdBy ?? null,
    }).returning();
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(userEventAccess).where(eq(userEventAccess.userId, id));
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getUserEventAccess(userId: string): Promise<UserEventAccess[]> {
    return db.select().from(userEventAccess).where(eq(userEventAccess.userId, userId));
  }

  async grantEventAccess(access: InsertUserEventAccess): Promise<UserEventAccess> {
    const [newAccess] = await db.insert(userEventAccess).values({
      userId: access.userId,
      eventId: access.eventId,
      grantedBy: access.grantedBy ?? null,
    }).returning();
    return newAccess;
  }

  async revokeEventAccess(userId: string, eventId: string): Promise<boolean> {
    const result = await db.delete(userEventAccess)
      .where(and(eq(userEventAccess.userId, userId), eq(userEventAccess.eventId, eventId)))
      .returning();
    return result.length > 0;
  }

  async getEventAccessUsers(eventId: string): Promise<User[]> {
    const accessList = await db.select().from(userEventAccess).where(eq(userEventAccess.eventId, eventId));
    const usersList: User[] = [];
    for (const access of accessList) {
      const [user] = await db.select().from(users).where(eq(users.id, access.userId));
      if (user) usersList.push(user);
    }
    return usersList;
  }

  async getSailClub(id: string): Promise<SailClub | undefined> {
    const [club] = await db.select().from(sailClubs).where(eq(sailClubs.id, id));
    return club;
  }

  async getSailClubs(): Promise<SailClub[]> {
    return db.select().from(sailClubs);
  }

  async createSailClub(club: InsertSailClub): Promise<SailClub> {
    const [sailClub] = await db.insert(sailClubs).values({
      ...club,
      logoUrl: club.logoUrl ?? null,
      location: club.location ?? null,
    }).returning();
    return sailClub;
  }

  async updateSailClub(id: string, club: Partial<InsertSailClub>): Promise<SailClub | undefined> {
    const [updated] = await db.update(sailClubs).set(club).where(eq(sailClubs.id, id)).returning();
    return updated;
  }

  async deleteSailClub(id: string): Promise<boolean> {
    const result = await db.delete(sailClubs).where(eq(sailClubs.id, id)).returning();
    return result.length > 0;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEvents(sailClubId?: string): Promise<Event[]> {
    if (sailClubId) {
      return db.select().from(events).where(eq(events.sailClubId, sailClubId));
    }
    return db.select().from(events);
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values({
      ...event,
      type: event.type ?? "race",
      targetDuration: event.targetDuration ?? 40,
      courseId: event.courseId ?? null,
    }).returning();
    return newEvent;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db.update(events).set(event).where(eq(events.id, id)).returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<boolean> {
    await db.delete(userEventAccess).where(eq(userEventAccess.eventId, id));
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result.length > 0;
  }

  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async getCourses(): Promise<Course[]> {
    return db.select().from(courses);
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values({
      ...course,
      shape: course.shape ?? "triangle",
      rotation: course.rotation ?? 0,
      scale: course.scale ?? 1,
      roundingSequence: course.roundingSequence ?? null,
    }).returning();
    return newCourse;
  }

  async updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const [updated] = await db.update(courses).set(course).where(eq(courses.id, id)).returning();
    return updated;
  }

  async getMark(id: string): Promise<Mark | undefined> {
    const [mark] = await db.select().from(marks).where(eq(marks.id, id));
    return mark;
  }

  async getMarksByCourse(courseId: string): Promise<Mark[]> {
    return db.select().from(marks).where(eq(marks.courseId, courseId));
  }

  async createMark(mark: InsertMark): Promise<Mark> {
    const [newMark] = await db.insert(marks).values({
      ...mark,
      assignedBuoyId: mark.assignedBuoyId ?? null,
      isStartLine: mark.isStartLine ?? false,
      isFinishLine: mark.isFinishLine ?? false,
      isCourseMark: mark.isCourseMark ?? true,
      isGate: mark.isGate ?? false,
      gateWidthBoatLengths: mark.gateWidthBoatLengths ?? null,
      boatLengthMeters: mark.boatLengthMeters ?? null,
      gatePartnerId: mark.gatePartnerId ?? null,
      gateSide: mark.gateSide ?? null,
      gatePortBuoyId: mark.gatePortBuoyId ?? null,
      gateStarboardBuoyId: mark.gateStarboardBuoyId ?? null,
    }).returning();
    return newMark;
  }

  async updateMark(id: string, mark: Partial<InsertMark>): Promise<Mark | undefined> {
    const [updated] = await db.update(marks).set(mark).where(eq(marks.id, id)).returning();
    return updated;
  }

  async deleteMark(id: string): Promise<boolean> {
    const result = await db.delete(marks).where(eq(marks.id, id)).returning();
    return result.length > 0;
  }

  async deleteMarksByCourse(courseId: string): Promise<number> {
    const result = await db.delete(marks).where(eq(marks.courseId, courseId)).returning();
    return result.length;
  }

  async getBuoy(id: string): Promise<Buoy | undefined> {
    const [buoy] = await db.select().from(buoys).where(eq(buoys.id, id));
    return buoy;
  }

  async getBuoys(sailClubId?: string): Promise<Buoy[]> {
    if (sailClubId) {
      return db.select().from(buoys).where(eq(buoys.sailClubId, sailClubId));
    }
    return db.select().from(buoys);
  }

  async createBuoy(buoy: InsertBuoy): Promise<Buoy> {
    const [newBuoy] = await db.insert(buoys).values({
      ...buoy,
      state: buoy.state ?? "idle",
      speed: buoy.speed ?? 0,
      battery: buoy.battery ?? 100,
      signalStrength: buoy.signalStrength ?? 100,
      targetLat: buoy.targetLat ?? null,
      targetLng: buoy.targetLng ?? null,
      windSpeed: buoy.windSpeed ?? null,
      windDirection: buoy.windDirection ?? null,
      currentSpeed: buoy.currentSpeed ?? null,
      currentDirection: buoy.currentDirection ?? null,
      eta: buoy.eta ?? null,
    }).returning();
    return newBuoy;
  }

  async updateBuoy(id: string, buoy: Partial<InsertBuoy>): Promise<Buoy | undefined> {
    const [updated] = await db.update(buoys).set(buoy).where(eq(buoys.id, id)).returning();
    return updated;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const [newSettings] = await db.insert(userSettings).values({
      ...settings,
      distanceUnit: settings.distanceUnit ?? "nautical_miles",
      speedUnit: settings.speedUnit ?? "knots",
      windSource: settings.windSource ?? "buoy",
      selectedWindBuoyId: settings.selectedWindBuoyId ?? null,
    }).returning();
    return newSettings;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const [updated] = await db.update(userSettings).set(settings).where(eq(userSettings.userId, userId)).returning();
    return updated;
  }
}

export const databaseStorage = new DatabaseStorage();
