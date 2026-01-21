import { eq, and, sql, or, ilike, desc, gt } from "drizzle-orm";
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
  courseSnapshots,
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
  type CourseSnapshot,
  type InsertCourseSnapshot,
} from "@shared/schema";
import type { IStorage, CourseSnapshotListParams, CourseSnapshotListResult } from "./storage";

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
    return await db.transaction(async (tx) => {
      // Delete event access records first
      await tx.delete(userEventAccess).where(eq(userEventAccess.eventId, id));
      // Then delete the event
      const result = await tx.delete(events).where(eq(events.id, id)).returning();
      return result.length > 0;
    });
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

  async deleteCourse(id: string): Promise<boolean> {
    // Use transaction to ensure marks and course are deleted atomically
    return await db.transaction(async (tx) => {
      // First delete all marks for this course
      await tx.delete(marks).where(eq(marks.courseId, id));
      // Then delete the course
      const result = await tx.delete(courses).where(eq(courses.id, id)).returning();
      return result.length > 0;
    });
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

  // Course Snapshot methods
  async getCourseSnapshot(id: string): Promise<CourseSnapshot | undefined> {
    const [snapshot] = await db.select().from(courseSnapshots).where(eq(courseSnapshots.id, id));
    return snapshot;
  }

  async listCourseSnapshots(params: CourseSnapshotListParams): Promise<CourseSnapshotListResult> {
    const { userId, userRole, userSailClubId, clubId, search, cursor, limit = 25 } = params;
    
    // Build visibility conditions based on user role
    const visibilityConditions = [];
    
    if (userRole === "super_admin") {
      // Super admin sees everything - no filter needed
    } else {
      // Global visibility - everyone can see
      visibilityConditions.push(eq(courseSnapshots.visibilityScope, "global"));
      
      // Club visibility - users in same club can see
      if (userSailClubId) {
        visibilityConditions.push(
          and(
            eq(courseSnapshots.visibilityScope, "club"),
            eq(courseSnapshots.sailClubId, userSailClubId)
          )
        );
      }
      
      // User visibility - only owner can see their own
      visibilityConditions.push(
        and(
          eq(courseSnapshots.visibilityScope, "user"),
          eq(courseSnapshots.ownerId, userId)
        )
      );
    }
    
    // Build the where clause
    const conditions = [];
    
    // Add visibility filter (only for non-super-admin)
    if (visibilityConditions.length > 0) {
      conditions.push(or(...visibilityConditions));
    }
    
    // Add club filter if specified
    if (clubId) {
      conditions.push(eq(courseSnapshots.sailClubId, clubId));
    }
    
    // Add search filter if specified
    if (search) {
      conditions.push(ilike(courseSnapshots.name, `%${search}%`));
    }
    
    // Add cursor for pagination (get items after the cursor)
    if (cursor) {
      const [cursorSnapshot] = await db.select().from(courseSnapshots).where(eq(courseSnapshots.id, cursor));
      if (cursorSnapshot?.createdAt) {
        // Get items created before the cursor item (since we're ordering by createdAt desc)
        conditions.push(sql`${courseSnapshots.createdAt} < ${cursorSnapshot.createdAt}`);
      }
    }
    
    // Get count (without pagination) - first build count query with visibility and filters
    const countConditions = [];
    if (visibilityConditions.length > 0) {
      countConditions.push(or(...visibilityConditions));
    }
    if (clubId) {
      countConditions.push(eq(courseSnapshots.sailClubId, clubId));
    }
    if (search) {
      countConditions.push(ilike(courseSnapshots.name, `%${search}%`));
    }
    
    const countQuery = countConditions.length > 0
      ? db.select({ count: sql<number>`count(*)::int` }).from(courseSnapshots).where(and(...countConditions))
      : db.select({ count: sql<number>`count(*)::int` }).from(courseSnapshots);
    
    const [countResult] = await countQuery;
    const totalCount = countResult?.count ?? 0;
    
    // Get paginated results
    const query = conditions.length > 0
      ? db.select().from(courseSnapshots).where(and(...conditions)).orderBy(desc(courseSnapshots.createdAt)).limit(limit + 1)
      : db.select().from(courseSnapshots).orderBy(desc(courseSnapshots.createdAt)).limit(limit + 1);
    
    const results = await query;
    
    // Determine if there are more results
    const hasMore = results.length > limit;
    const snapshots = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && snapshots.length > 0 ? snapshots[snapshots.length - 1].id : null;
    
    return { snapshots, nextCursor, totalCount };
  }

  async createCourseSnapshot(snapshot: InsertCourseSnapshot): Promise<CourseSnapshot> {
    const [newSnapshot] = await db.insert(courseSnapshots).values({
      name: snapshot.name,
      ownerId: snapshot.ownerId,
      ownerUsername: snapshot.ownerUsername,
      sailClubId: snapshot.sailClubId ?? null,
      sailClubName: snapshot.sailClubName ?? null,
      visibilityScope: snapshot.visibilityScope ?? "user",
      shape: snapshot.shape,
      centerLat: snapshot.centerLat,
      centerLng: snapshot.centerLng,
      rotation: snapshot.rotation ?? 0,
      scale: snapshot.scale ?? 1,
      roundingSequence: snapshot.roundingSequence ?? null,
      snapshotMarks: snapshot.snapshotMarks,
    }).returning();
    return newSnapshot;
  }

  async deleteCourseSnapshot(id: string): Promise<boolean> {
    const result = await db.delete(courseSnapshots).where(eq(courseSnapshots.id, id)).returning();
    return result.length > 0;
  }
}

export const databaseStorage = new DatabaseStorage();
