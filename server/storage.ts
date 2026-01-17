import { 
  type User, type InsertUser,
  type SailClub, type InsertSailClub,
  type Event, type InsertEvent,
  type Course, type InsertCourse,
  type Mark, type InsertMark,
  type Buoy, type InsertBuoy,
  type UserSettings, type InsertUserSettings,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getSailClub(id: string): Promise<SailClub | undefined>;
  getSailClubs(): Promise<SailClub[]>;
  createSailClub(club: InsertSailClub): Promise<SailClub>;

  getEvent(id: string): Promise<Event | undefined>;
  getEvents(sailClubId?: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;

  getCourse(id: string): Promise<Course | undefined>;
  getCourses(): Promise<Course[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;

  getMark(id: string): Promise<Mark | undefined>;
  getMarksByCourse(courseId: string): Promise<Mark[]>;
  createMark(mark: InsertMark): Promise<Mark>;
  updateMark(id: string, mark: Partial<InsertMark>): Promise<Mark | undefined>;
  deleteMark(id: string): Promise<boolean>;

  getBuoy(id: string): Promise<Buoy | undefined>;
  getBuoys(sailClubId?: string): Promise<Buoy[]>;
  createBuoy(buoy: InsertBuoy): Promise<Buoy>;
  updateBuoy(id: string, buoy: Partial<InsertBuoy>): Promise<Buoy | undefined>;

  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private sailClubs: Map<string, SailClub> = new Map();
  private events: Map<string, Event> = new Map();
  private courses: Map<string, Course> = new Map();
  private marks: Map<string, Mark> = new Map();
  private buoys: Map<string, Buoy> = new Map();
  private userSettings: Map<string, UserSettings> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    const clubId = randomUUID();
    this.sailClubs.set(clubId, {
      id: clubId,
      name: "Oakland Yacht Club",
      logoUrl: null,
      location: { lat: 37.8044, lng: -122.2712 },
    });

    const courseId = randomUUID();
    this.courses.set(courseId, {
      id: courseId,
      name: "Triangle Course",
      shape: "triangle",
      centerLat: 37.8044,
      centerLng: -122.2712,
      rotation: 0,
      scale: 1,
    });

    const eventId = randomUUID();
    this.events.set(eventId, {
      id: eventId,
      name: "Spring Regatta 2024",
      type: "race",
      sailClubId: clubId,
      boatClass: "Laser",
      targetDuration: 40,
      courseId: courseId,
      createdAt: new Date(),
    });

    const buoyData = [
      { name: "Start Buoy", state: "holding_position", lat: 37.8044, lng: -122.2712, battery: 95, windSpeed: 12.5, windDirection: 225 },
      { name: "Pin End", state: "holding_position", lat: 37.8034, lng: -122.2702, battery: 87, windSpeed: 12.2, windDirection: 223 },
      { name: "Mark 1", state: "moving_to_target", lat: 37.8064, lng: -122.2732, battery: 72, windSpeed: 13.1, windDirection: 227, targetLat: 37.8084, targetLng: -122.2712, eta: 180 },
      { name: "Mark 2", state: "idle", lat: 37.8024, lng: -122.2752, battery: 65, windSpeed: 12.8, windDirection: 224 },
      { name: "Mark 3", state: "maintenance", lat: 37.8014, lng: -122.2692, battery: 23, windSpeed: null, windDirection: null },
    ];

    buoyData.forEach((data) => {
      const id = randomUUID();
      this.buoys.set(id, {
        id,
        sailClubId: clubId,
        speed: data.state === "moving_to_target" ? 2.5 : 0,
        signalStrength: data.state === "maintenance" ? 45 : 95,
        currentSpeed: 0.8,
        currentDirection: 180,
        ...data,
        targetLat: data.targetLat ?? null,
        targetLng: data.targetLng ?? null,
        eta: data.eta ?? null,
      } as Buoy);
    });

    const markData = [
      { name: "Start Boat", role: "start_boat", order: 0, lat: 37.8039, lng: -122.2722 },
      { name: "Pin", role: "pin", order: 1, lat: 37.8039, lng: -122.2702 },
      { name: "Windward Mark", role: "turning_mark", order: 2, lat: 37.8074, lng: -122.2712 },
      { name: "Gate Left", role: "turning_mark", order: 3, lat: 37.8024, lng: -122.2732 },
      { name: "Gate Right", role: "turning_mark", order: 4, lat: 37.8024, lng: -122.2692 },
    ];

    markData.forEach((data, index) => {
      const id = randomUUID();
      const buoyIds = Array.from(this.buoys.keys());
      this.marks.set(id, {
        id,
        courseId,
        ...data,
        assignedBuoyId: index < 3 ? buoyIds[index] : null,
      } as Mark);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { id, ...insertUser, role: insertUser.role ?? "race_officer", sailClubId: insertUser.sailClubId ?? null };
    this.users.set(id, user);
    return user;
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
      targetDuration: event.targetDuration ?? 40,
      courseId: event.courseId ?? null,
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
      rotation: course.rotation ?? 0,
      scale: course.scale ?? 1,
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
    const newMark: Mark = { id, ...mark, assignedBuoyId: mark.assignedBuoyId ?? null };
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
}

export const storage = new MemStorage();
