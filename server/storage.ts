import { 
  type User, type InsertUser,
  type SailClub, type InsertSailClub,
  type Event, type InsertEvent,
  type Course, type InsertCourse,
  type Mark, type InsertMark,
  type Buoy, type InsertBuoy,
  type UserSettings, type InsertUserSettings,
  type UserEventAccess, type InsertUserEventAccess,
  type CourseSnapshot, type InsertCourseSnapshot,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(sailClubId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  getUserEventAccess(userId: string): Promise<UserEventAccess[]>;
  grantEventAccess(access: InsertUserEventAccess): Promise<UserEventAccess>;
  revokeEventAccess(userId: string, eventId: string): Promise<boolean>;
  getEventAccessUsers(eventId: string): Promise<User[]>;

  getSailClub(id: string): Promise<SailClub | undefined>;
  getSailClubs(): Promise<SailClub[]>;
  createSailClub(club: InsertSailClub): Promise<SailClub>;
  updateSailClub(id: string, club: Partial<InsertSailClub>): Promise<SailClub | undefined>;
  deleteSailClub(id: string): Promise<boolean>;

  getEvent(id: string): Promise<Event | undefined>;
  getEvents(sailClubId?: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;

  getCourse(id: string): Promise<Course | undefined>;
  getCourses(): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;

  getMark(id: string): Promise<Mark | undefined>;
  getMarksByCourse(courseId: string): Promise<Mark[]>;
  createMark(mark: InsertMark): Promise<Mark>;
  updateMark(id: string, mark: Partial<InsertMark>): Promise<Mark | undefined>;
  deleteMark(id: string): Promise<boolean>;
  deleteMarksByCourse(courseId: string): Promise<number>;

  getBuoy(id: string): Promise<Buoy | undefined>;
  getBuoys(sailClubId?: string): Promise<Buoy[]>;
  createBuoy(buoy: InsertBuoy): Promise<Buoy>;
  updateBuoy(id: string, buoy: Partial<InsertBuoy>): Promise<Buoy | undefined>;

  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;

  // Course Snapshots - immutable saved courses
  getCourseSnapshot(id: string): Promise<CourseSnapshot | undefined>;
  listCourseSnapshots(params: CourseSnapshotListParams): Promise<CourseSnapshotListResult>;
  createCourseSnapshot(snapshot: InsertCourseSnapshot): Promise<CourseSnapshot>;
  deleteCourseSnapshot(id: string): Promise<boolean>;
}

// Pagination and filtering params for course snapshot listing
export interface CourseSnapshotListParams {
  // Visibility filtering based on user role
  userId: string;
  userRole: string;
  userSailClubId: string | null;
  
  // Optional filters
  clubId?: string;         // Filter by specific club
  search?: string;         // Search by name
  
  // Pagination (cursor-based)
  cursor?: string;         // ID of last item from previous page
  limit?: number;          // Items per page (default 25)
}

export interface CourseSnapshotListResult {
  snapshots: CourseSnapshot[];
  nextCursor: string | null;  // ID to use for next page, null if no more
  totalCount: number;         // Total available matching visibility rules
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private userEventAccess: Map<string, UserEventAccess> = new Map();
  private sailClubs: Map<string, SailClub> = new Map();
  private events: Map<string, Event> = new Map();
  private courses: Map<string, Course> = new Map();
  private marks: Map<string, Mark> = new Map();
  private buoys: Map<string, Buoy> = new Map();
  private userSettings: Map<string, UserSettings> = new Map();
  private courseSnapshots: Map<string, CourseSnapshot> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    const MIKROLIMANO_CENTER = { lat: 37.9376, lng: 23.6917 };
    
    const clubId = randomUUID();
    this.sailClubs.set(clubId, {
      id: clubId,
      name: "Mikrolimano Yacht Club",
      logoUrl: null,
      location: MIKROLIMANO_CENTER,
    });

    const courseId = randomUUID();
    this.courses.set(courseId, {
      id: courseId,
      name: "Triangle Course",
      shape: "triangle",
      centerLat: MIKROLIMANO_CENTER.lat,
      centerLng: MIKROLIMANO_CENTER.lng,
      rotation: 0,
      scale: 1,
      roundingSequence: null,
    });

    const eventId = randomUUID();
    this.events.set(eventId, {
      id: eventId,
      name: "Spring Regatta 2024",
      type: "race",
      sailClubId: clubId,
      boatClass: "ILCA 7",
      boatClassId: null,
      targetDuration: 40,
      courseId: courseId,
      createdAt: new Date(),
    });

    const buoyData = [
      { name: "Alpha", state: "idle", lat: MIKROLIMANO_CENTER.lat + 0.001, lng: MIKROLIMANO_CENTER.lng + 0.002, battery: 95, windSpeed: 12.5, windDirection: 225 },
      { name: "Bravo", state: "idle", lat: MIKROLIMANO_CENTER.lat - 0.001, lng: MIKROLIMANO_CENTER.lng + 0.001, battery: 87, windSpeed: 12.2, windDirection: 223 },
      { name: "Charlie", state: "idle", lat: MIKROLIMANO_CENTER.lat + 0.002, lng: MIKROLIMANO_CENTER.lng - 0.001, battery: 72, windSpeed: 13.1, windDirection: 227 },
      { name: "Delta", state: "idle", lat: MIKROLIMANO_CENTER.lat - 0.002, lng: MIKROLIMANO_CENTER.lng - 0.002, battery: 65, windSpeed: 12.8, windDirection: 224 },
      { name: "Echo", state: "idle", lat: MIKROLIMANO_CENTER.lat - 0.003, lng: MIKROLIMANO_CENTER.lng + 0.003, battery: 91, windSpeed: 12.4, windDirection: 226 },
      { name: "Foxtrot", state: "idle", lat: MIKROLIMANO_CENTER.lat + 0.001, lng: MIKROLIMANO_CENTER.lng + 0.004, battery: 78, windSpeed: 12.6, windDirection: 228 },
      { name: "Golf", state: "idle", lat: MIKROLIMANO_CENTER.lat + 0.003, lng: MIKROLIMANO_CENTER.lng - 0.002, battery: 83, windSpeed: 12.9, windDirection: 222 },
    ];

    buoyData.forEach((data) => {
      const id = randomUUID();
      this.buoys.set(id, {
        id,
        sailClubId: clubId,
        speed: 0,
        signalStrength: 95,
        currentSpeed: 0.8,
        currentDirection: 180,
        targetLat: null,
        targetLng: null,
        eta: null,
        ...data,
      } as Buoy);
    });

    // No pre-seeded marks - users start fresh with the new workflow:
    // 1. Set Start Line (Pin End + Committee Boat)
    // 2. Add Course Marks (M1, M2, M3, etc.)
    // 3. Set Finish Line (can reuse start line marks)
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  async getUsers(sailClubId?: string): Promise<User[]> {
    const users = Array.from(this.users.values());
    if (sailClubId) {
      return users.filter(u => u.sailClubId === sailClubId);
    }
    return users;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id, 
      ...insertUser, 
      role: insertUser.role ?? "event_manager", 
      sailClubId: insertUser.sailClubId ?? null,
      createdAt: new Date(),
      createdBy: insertUser.createdBy ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...user };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const entries = Array.from(this.userEventAccess.entries());
    for (const [accessId, access] of entries) {
      if (access.userId === id) {
        this.userEventAccess.delete(accessId);
      }
    }
    return this.users.delete(id);
  }

  async getUserEventAccess(userId: string): Promise<UserEventAccess[]> {
    return Array.from(this.userEventAccess.values()).filter(a => a.userId === userId);
  }

  async grantEventAccess(access: InsertUserEventAccess): Promise<UserEventAccess> {
    const id = randomUUID();
    const newAccess: UserEventAccess = {
      id,
      userId: access.userId,
      eventId: access.eventId,
      grantedBy: access.grantedBy ?? null,
      grantedAt: new Date(),
    };
    this.userEventAccess.set(id, newAccess);
    return newAccess;
  }

  async revokeEventAccess(userId: string, eventId: string): Promise<boolean> {
    const entries = Array.from(this.userEventAccess.entries());
    for (const [id, access] of entries) {
      if (access.userId === userId && access.eventId === eventId) {
        return this.userEventAccess.delete(id);
      }
    }
    return false;
  }

  async getEventAccessUsers(eventId: string): Promise<User[]> {
    const accessList = Array.from(this.userEventAccess.values()).filter(a => a.eventId === eventId);
    const users: User[] = [];
    for (const access of accessList) {
      const user = this.users.get(access.userId);
      if (user) users.push(user);
    }
    return users;
  }

  async getSailClub(id: string): Promise<SailClub | undefined> {
    return this.sailClubs.get(id);
  }

  async getSailClubs(): Promise<SailClub[]> {
    return Array.from(this.sailClubs.values());
  }

  async createSailClub(club: InsertSailClub): Promise<SailClub> {
    const id = randomUUID();
    const sailClub: SailClub = { id, ...club, logoUrl: club.logoUrl ?? null, location: club.location ?? null };
    this.sailClubs.set(id, sailClub);
    return sailClub;
  }

  async updateSailClub(id: string, club: Partial<InsertSailClub>): Promise<SailClub | undefined> {
    const existing = this.sailClubs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...club };
    this.sailClubs.set(id, updated);
    return updated;
  }

  async deleteSailClub(id: string): Promise<boolean> {
    return this.sailClubs.delete(id);
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEvents(sailClubId?: string): Promise<Event[]> {
    const events = Array.from(this.events.values());
    if (sailClubId) {
      return events.filter(e => e.sailClubId === sailClubId);
    }
    return events;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const newEvent: Event = { 
      id, 
      ...event, 
      type: event.type ?? "race",
      targetDuration: event.targetDuration ?? 40,
      courseId: event.courseId ?? null,
      boatClassId: event.boatClassId ?? null,
      createdAt: new Date() 
    };
    this.events.set(id, newEvent);
    return newEvent;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    const existing = this.events.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...event };
    this.events.set(id, updated);
    return updated;
  }

  async deleteEvent(id: string): Promise<boolean> {
    const entries = Array.from(this.userEventAccess.entries());
    for (const [accessId, access] of entries) {
      if (access.eventId === id) {
        this.userEventAccess.delete(accessId);
      }
    }
    return this.events.delete(id);
  }

  async getCourse(id: string): Promise<Course | undefined> {
    return this.courses.get(id);
  }

  async getCourses(): Promise<Course[]> {
    return Array.from(this.courses.values());
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const id = randomUUID();
    const newCourse: Course = { 
      id, 
      ...course,
      shape: course.shape ?? "triangle",
      rotation: course.rotation ?? 0,
      scale: course.scale ?? 1,
      roundingSequence: course.roundingSequence ?? null,
    };
    this.courses.set(id, newCourse);
    return newCourse;
  }

  async updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined> {
    const existing = this.courses.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...course };
    this.courses.set(id, updated);
    return updated;
  }

  async deleteCourse(id: string): Promise<boolean> {
    // Delete all marks for this course first
    const marksToDelete: string[] = [];
    this.marks.forEach((mark, markId) => {
      if (mark.courseId === id) {
        marksToDelete.push(markId);
      }
    });
    marksToDelete.forEach(markId => this.marks.delete(markId));
    return this.courses.delete(id);
  }

  async getMark(id: string): Promise<Mark | undefined> {
    return this.marks.get(id);
  }

  async getMarksByCourse(courseId: string): Promise<Mark[]> {
    return Array.from(this.marks.values())
      .filter(m => m.courseId === courseId)
      .sort((a, b) => a.order - b.order);
  }

  async createMark(mark: InsertMark): Promise<Mark> {
    const id = randomUUID();
    const newMark: Mark = { 
      id, 
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
    };
    this.marks.set(id, newMark);
    return newMark;
  }

  async updateMark(id: string, mark: Partial<InsertMark>): Promise<Mark | undefined> {
    const existing = this.marks.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...mark };
    this.marks.set(id, updated);
    return updated;
  }

  async deleteMark(id: string): Promise<boolean> {
    return this.marks.delete(id);
  }

  async deleteMarksByCourse(courseId: string): Promise<number> {
    let count = 0;
    const entries = Array.from(this.marks.entries());
    for (const [id, mark] of entries) {
      if (mark.courseId === courseId) {
        this.marks.delete(id);
        count++;
      }
    }
    return count;
  }

  async getBuoy(id: string): Promise<Buoy | undefined> {
    return this.buoys.get(id);
  }

  async getBuoys(sailClubId?: string): Promise<Buoy[]> {
    const buoys = Array.from(this.buoys.values());
    if (sailClubId) {
      return buoys.filter(b => b.sailClubId === sailClubId);
    }
    return buoys;
  }

  async createBuoy(buoy: InsertBuoy): Promise<Buoy> {
    const id = randomUUID();
    const newBuoy: Buoy = { 
      id, 
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
    };
    this.buoys.set(id, newBuoy);
    return newBuoy;
  }

  async updateBuoy(id: string, buoy: Partial<InsertBuoy>): Promise<Buoy | undefined> {
    const existing = this.buoys.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...buoy };
    this.buoys.set(id, updated);
    return updated;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(s => s.userId === userId);
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const id = randomUUID();
    const newSettings: UserSettings = { 
      id, 
      ...settings,
      distanceUnit: settings.distanceUnit ?? "nautical_miles",
      speedUnit: settings.speedUnit ?? "knots",
      windSource: settings.windSource ?? "buoy",
      selectedWindBuoyId: settings.selectedWindBuoyId ?? null,
    };
    this.userSettings.set(id, newSettings);
    return newSettings;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const existing = await this.getUserSettings(userId);
    if (!existing) return undefined;
    const updated = { ...existing, ...settings };
    this.userSettings.set(existing.id, updated);
    return updated;
  }

  // Course Snapshot methods
  async getCourseSnapshot(id: string): Promise<CourseSnapshot | undefined> {
    return this.courseSnapshots.get(id);
  }

  async listCourseSnapshots(params: CourseSnapshotListParams): Promise<CourseSnapshotListResult> {
    const { userId, userRole, userSailClubId, clubId, search, cursor, limit = 25 } = params;
    
    // Get all snapshots and filter by visibility
    let snapshots = Array.from(this.courseSnapshots.values()).filter(s => {
      // Super admin sees all
      if (userRole === "super_admin") return true;
      
      // Global visibility - everyone sees
      if (s.visibilityScope === "global") return true;
      
      // Club visibility - same club sees
      if (s.visibilityScope === "club" && s.sailClubId === userSailClubId) return true;
      
      // User visibility - only owner sees
      if (s.visibilityScope === "user" && s.ownerId === userId) return true;
      
      return false;
    });
    
    // Apply club filter if specified
    if (clubId) {
      snapshots = snapshots.filter(s => s.sailClubId === clubId);
    }
    
    // Apply search filter if specified
    if (search) {
      const searchLower = search.toLowerCase();
      snapshots = snapshots.filter(s => s.name.toLowerCase().includes(searchLower));
    }
    
    // Sort by creation date descending (newest first)
    snapshots.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    const totalCount = snapshots.length;
    
    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = snapshots.findIndex(s => s.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }
    
    const paginatedSnapshots = snapshots.slice(startIndex, startIndex + limit);
    const nextCursor = paginatedSnapshots.length === limit && startIndex + limit < totalCount
      ? paginatedSnapshots[paginatedSnapshots.length - 1].id
      : null;
    
    return { snapshots: paginatedSnapshots, nextCursor, totalCount };
  }

  async createCourseSnapshot(snapshot: InsertCourseSnapshot): Promise<CourseSnapshot> {
    const id = randomUUID();
    const newSnapshot: CourseSnapshot = {
      id,
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
      createdAt: new Date(),
    };
    this.courseSnapshots.set(id, newSnapshot);
    return newSnapshot;
  }

  async deleteCourseSnapshot(id: string): Promise<boolean> {
    return this.courseSnapshots.delete(id);
  }
}

import { databaseStorage } from "./database-storage";

export const storage: IStorage = databaseStorage;
