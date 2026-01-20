# Automated Robotic Buoys Platform - Complete Technical Specification

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Data Model](#data-model)
4. [Authentication & Authorization](#authentication--authorization)
5. [Course Management System](#course-management-system)
6. [Buoy Management System](#buoy-management-system)
7. [Weather Integration](#weather-integration)
8. [Race Time Estimation Engine](#race-time-estimation-engine)
9. [Interactive Map System](#interactive-map-system)
10. [Settings & Configuration](#settings--configuration)
11. [Demo Mode](#demo-mode)
12. [API Reference](#api-reference)
13. [Frontend Architecture](#frontend-architecture)
14. [Progressive Web App (PWA)](#progressive-web-app-pwa)

---

## Executive Summary

The Automated Robotic Buoys Platform is a tablet-first web application designed for Race Officers to manage GPS-controlled robotic buoys for sailing races and training events. The platform provides:

- **Real-time buoy monitoring** with GPS tracking, telemetry, and status updates
- **Dynamic course creation** with support for standard racing course shapes (triangle, trapezoid, windward-leeward) and custom layouts
- **Weather integration** from multiple sources (API, buoy sensors, manual input)
- **VMG-based race time estimation** using boat class performance profiles
- **Touch-optimized interface** designed for wet fingers at sea
- **Multi-role authentication** with session-based security and role-based access control

**Design Philosophy**: SIMPLICITY wins—designed for wet fingers at sea, not ease at home.

---

## System Architecture

### Technology Stack

#### Frontend
| Technology | Purpose |
|------------|---------|
| React | UI framework |
| TypeScript | Type-safe JavaScript |
| Wouter | Client-side routing |
| TanStack React Query v5 | Server state management, caching, mutations |
| Tailwind CSS | Utility-first styling |
| Shadcn/ui (Radix UI) | Accessible component primitives |
| Leaflet | Interactive map rendering |
| Lucide React | Icon library |

#### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Express | HTTP server framework |
| TypeScript | Type-safe JavaScript |
| PostgreSQL | Relational database (Neon-backed) |
| Drizzle ORM | Type-safe ORM with migrations |
| Zod | Runtime type validation |
| bcrypt | Password hashing |
| express-session | Session management |

#### Development Tools
| Tool | Purpose |
|------|---------|
| Vite | Frontend build tool and dev server |
| tsx | TypeScript execution for development |
| drizzle-kit | Database schema management |

### Application Structure

```
├── client/                     # Frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── ui/             # Shadcn/ui base components
│   │   │   ├── LeafletMap.tsx  # Interactive map component
│   │   │   ├── SetupPanel.tsx  # Course setup wizard
│   │   │   ├── MarkEditPanel.tsx # Mark editing interface
│   │   │   ├── SettingsDialog.tsx # User settings
│   │   │   └── ...
│   │   ├── contexts/           # React contexts
│   │   │   └── DemoModeContext.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── use-api.ts      # API interaction hooks
│   │   │   ├── use-settings.ts # Settings management
│   │   │   ├── use-buoy-follow.ts # Buoy follow system
│   │   │   └── useAuth.ts      # Authentication
│   │   ├── lib/                # Utility libraries
│   │   │   ├── race-time-estimation.ts
│   │   │   ├── course-bearings.ts
│   │   │   └── batchedMutations.ts
│   │   ├── pages/              # Page components
│   │   │   ├── RaceControl.tsx # Main race management
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── ClubDashboard.tsx
│   │   │   └── EventsList.tsx
│   │   └── App.tsx             # Root component
├── server/                     # Backend application
│   ├── index.ts                # Entry point
│   ├── routes.ts               # API routes
│   ├── auth.ts                 # Authentication middleware
│   ├── storage.ts              # Database interface
│   └── vite.ts                 # Vite integration
├── shared/                     # Shared code
│   └── schema.ts               # Database schema & types
└── db/                         # Database migrations
```

---

## Data Model

### Entity Relationship Overview

```
SailClub (1) ──── (N) User
    │                  │
    │                  └──── (N) UserEventAccess ───── (N) Event
    │
    ├──── (N) Buoy
    │
    └──── (N) Event ──── (1) Course ──── (N) Mark
                              │
                              └──── roundingSequence[]
                              
BoatClass (standalone lookup table for race time estimation)
UserSettings (1:1 with User)
```

### Core Entities

#### Users
```typescript
interface User {
  id: string;                    // UUID, auto-generated
  username: string;              // Unique login identifier
  passwordHash: string;          // bcrypt hashed password
  role: "super_admin" | "club_manager" | "event_manager";
  sailClubId: string | null;     // Associated club (null for super_admin)
  createdAt: Date;
  createdBy: string | null;      // Creator's user ID
}
```

#### Sail Clubs
```typescript
interface SailClub {
  id: string;                    // UUID
  name: string;                  // Club display name
  logoUrl: string | null;        // Club logo URL
  location: {                    // Geographic center
    lat: number;
    lng: number;
  } | null;
}
```

#### Events
```typescript
interface Event {
  id: string;                    // UUID
  name: string;                  // Event display name
  type: "race" | "training";     // Event type
  sailClubId: string;            // Parent club
  boatClass: string;             // Boat class name (display)
  boatClassId: string | null;    // Reference to boat_classes table
  targetDuration: number;        // Target race duration in minutes (default: 40)
  courseId: string | null;       // Associated course
  createdAt: Date;
}
```

#### Courses
```typescript
interface Course {
  id: string;                    // UUID
  name: string;                  // Course name
  shape: "triangle" | "trapezoid" | "windward_leeward" | "custom";
  centerLat: number;             // Course center latitude
  centerLng: number;             // Course center longitude
  rotation: number;              // Rotation in degrees (default: 0)
  scale: number;                 // Scale factor (default: 1)
  roundingSequence: string[];    // Ordered mark IDs for racing sequence
}
```

#### Marks
```typescript
interface Mark {
  id: string;                    // UUID
  courseId: string;              // Parent course
  name: string;                  // Mark display name (e.g., "Mark 1", "Pin")
  role: MarkRole;                // Semantic role (see below)
  order: number;                 // Display/creation order
  lat: number;                   // Latitude
  lng: number;                   // Longitude
  assignedBuoyId: string | null; // Single buoy assignment (non-gates)
  
  // Start/Finish line flags
  isStartLine: boolean;          // Part of start line
  isFinishLine: boolean;         // Part of finish line
  isCourseMark: boolean;         // Part of racing course (excludes start/finish)
  
  // Gate configuration
  isGate: boolean;               // Is this mark a gate?
  gateWidthBoatLengths: number;  // Gate width in boat lengths (default: 8)
  boatLengthMeters: number;      // Boat length for width calculation (default: 6)
  gatePartnerId: string | null;  // Partner mark ID for paired gates
  gateSide: "port" | "starboard" | null;
  gatePortBuoyId: string | null;      // Port buoy for gates
  gateStarboardBuoyId: string | null; // Starboard buoy for gates
}

type MarkRole = 
  | "start_boat"    // Committee boat at starboard end of start line
  | "pin"           // Pin mark at port end of start line
  | "turning_mark"  // Generic turning mark
  | "finish"        // Finish line mark
  | "windward"      // Mark 1 - Windward/weather mark (upwind)
  | "leeward"       // Mark 3/4 - Leeward mark (downwind)
  | "gate"          // Gate mark (3s=starboard, 3p=port)
  | "offset"        // Offset/spreader mark near windward
  | "wing"          // Mark 2 - Wing/gybe mark (trapezoid/triangle reaching)
  | "other";        // Custom/other marks
```

#### Buoys
```typescript
interface Buoy {
  id: string;                    // UUID
  name: string;                  // Buoy display name (e.g., "Alpha", "Bravo")
  sailClubId: string;            // Owner club
  
  // State machine
  state: BuoyState;
  
  // Current position
  lat: number;
  lng: number;
  
  // Target position (when moving)
  targetLat: number | null;
  targetLng: number | null;
  
  // Telemetry
  speed: number;                 // Current speed in knots
  battery: number;               // Battery percentage (0-100)
  signalStrength: number;        // Signal strength percentage (0-100)
  
  // Onboard weather sensors
  windSpeed: number | null;      // Wind speed in knots
  windDirection: number | null;  // Wind direction in degrees
  currentSpeed: number | null;   // Water current speed in knots
  currentDirection: number | null; // Water current direction in degrees
  
  eta: number | null;            // ETA to target in seconds
}

type BuoyState = 
  | "idle"                       // Not assigned, available
  | "moving_to_target"           // In transit to assigned position
  | "holding_position"           // On station, maintaining position
  | "station_keeping_degraded"   // On station but struggling (strong current/wind)
  | "unavailable"                // Offline or out of range
  | "maintenance"                // Under maintenance
  | "fault";                     // Hardware/software fault
```

#### Boat Classes (for Race Time Estimation)
```typescript
interface BoatClass {
  id: string;
  name: string;                  // e.g., "Laser", "420", "49er"
  hullType: "displacement" | "planing" | "foiling";
  crewSize: number;
  
  // Boat dimensions
  lengthMeters: number;          // Hull length in meters
  
  // Upwind performance (VMG in knots by wind speed)
  upwindVmgLight: number;        // 0-8 kts wind
  upwindVmgMedium: number;       // 8-14 kts wind
  upwindVmgHeavy: number;        // 14+ kts wind
  upwindTwa: number;             // Optimal upwind True Wind Angle (default: 42°)
  
  // Downwind performance (VMG in knots)
  downwindVmgLight: number;
  downwindVmgMedium: number;
  downwindVmgHeavy: number;
  downwindTwa: number;           // Optimal downwind TWA (default: 145°)
  
  // Reaching performance (beam reach speed in knots)
  reachSpeedLight: number;
  reachSpeedMedium: number;
  reachSpeedHeavy: number;
  
  // Maneuver times (seconds)
  tackTime: number;              // Time to complete a tack (default: 8s)
  jibeTime: number;              // Time to complete a jibe (default: 6s)
  markRoundingTime: number;      // Time to round a mark (default: 10s)
  
  // No-go zone boundaries
  noGoZoneAngle: number;         // Degrees from wind (default: 40°)
}
```

---

## Authentication & Authorization

### Session-Based Authentication

The platform uses session-based authentication with the following characteristics:

- **Session Storage**: Server-side sessions with express-session
- **Password Security**: bcrypt with salt rounds for password hashing
- **Cookie-based Sessions**: Session ID stored in HTTP-only cookie

### Authentication Flow

```
1. User submits credentials → POST /api/auth/login
2. Server validates password against bcrypt hash
3. On success: Create session, return user object
4. Client stores session cookie
5. Subsequent requests include session cookie
6. GET /api/auth/me returns current user info
7. POST /api/auth/logout destroys session
```

### Role-Based Access Control (RBAC)

#### User Roles

| Role | Scope | Capabilities |
|------|-------|--------------|
| `super_admin` | Global | Full system access, manage all clubs, users, events |
| `club_manager` | Single Club | Manage club's users (event_managers only), events, buoys |
| `event_manager` | Assigned Events | Manage specific events they have access to |

#### Permission Matrix

| Resource | super_admin | club_manager | event_manager |
|----------|-------------|--------------|---------------|
| View all clubs | ✓ | Own club only | Own club only |
| Create/Edit clubs | ✓ | ✗ | ✗ |
| Delete clubs | ✓ | ✗ | ✗ |
| Create users | ✓ (all roles) | ✓ (event_manager only) | ✗ |
| Delete users | ✓ | Own club only | ✗ |
| Create events | ✓ | ✓ | ✗ |
| Manage events | ✓ | Own club | Assigned only |
| View buoys | ✓ | Own club | Assigned event's club |
| Command buoys | ✓ | Own club | Assigned event only |

#### Access Control Middleware

```typescript
// Require specific roles
requireRole("super_admin", "club_manager")

// Require club membership
requireClubAccess  // Checks sailClubId matches

// Require event access (event_managers checked against userEventAccess)
requireEventAccess
```

### User Event Access

Event managers receive access to specific events through the `userEventAccess` table:

```typescript
interface UserEventAccess {
  id: string;
  userId: string;       // Event manager's ID
  eventId: string;      // Granted event ID
  grantedBy: string;    // Who granted access
  grantedAt: Date;
}
```

---

## Course Management System

### Course Creation Workflow (6 Phases)

The `SetupPanel` component implements a wizard-based course creation workflow:

#### Phase 1: Start Line Setup
- Set committee boat and pin positions
- Configure start line bearing relative to wind
- Adjustable start line length
- Options to fix bearing perpendicular to wind

#### Phase 2: Course Marks
- Add individual marks or generate from template
- Supported shapes: Triangle, Trapezoid, Windward-Leeward, Custom
- Drag-and-drop mark placement on map
- Convert marks to gates (dual buoy configuration)

#### Phase 3: Finish Line
- Define finish line marks
- Option to use start line as finish line
- Separate finish line configuration

#### Phase 4: Rounding Sequence
- Define the order marks are rounded
- Visual representation on map with numbered sequence
- Automatic bearing and distance calculations

#### Phase 5: Course Review
- Summary of all course parameters
- Leg distances and bearings
- Race time estimation display
- Course transformation tools (scale, rotate, move)

#### Phase 6: Buoy Assignment
- Manual or auto-assign buoys to marks
- Visual feedback on buoy availability
- Dispatch buoys to positions

### Standard Course Shapes

#### Triangle Course
```
World Sailing Standard Triangle Course:

            Mark 1 (Windward)
                  △
                 /│\
                / │ \
               /  │  \
              /   │   \
             /    │    \
            /     │     \
           /      │      \
    Wing ◇────────┼────────◇ (Optional Offset)
   Mark 2         │
                  │
           Start/Finish Line
        ◇─────────┼─────────◇
       Pin                Committee
                           Boat

Marks Created:
- Start Line: Committee Boat (starboard), Pin (port)
- Mark 1: Windward mark
- Mark 2: Wing/reach mark
- Mark 3: Leeward mark
```

#### Trapezoid Course
```
World Sailing 60°/120° Trapezoid:

            Mark 1 (Windward)
                  △
                 /│\
                / │ \
               /  │  \
              /   │   \
             /    │    \
            /     │     \
    Wing ◇────────┼────────◇ Offset
   Mark 2         │
                 / \
                /   \
               /     \
        Gate ◇───────◇ Gate
       3 Port        3 Stbd
              │
         Start Line
        ◇─────┼─────◇
       Pin         C.B.

Specifications:
- 60° reach angle for spinnaker boats
- 70° reach angle for non-spinnaker boats (ILCA/Lasers)
- Reaching leg: 67% of windward leg length
- Gate width: ~10 hull lengths, square to wind
- Start line: ~0.05nm (100m) below leeward gate
```

#### Windward-Leeward Course
```
Simple Upwind/Downwind Course:

            Mark 1 (Windward)
                  △
                  │
                  │
                  │
                  │
                  │
        Gate ◇────┼────◇ Gate
       3 Port          3 Stbd
                  │
             Start Line
        ◇─────────┼─────────◇
       Pin                Committee
                           Boat
```

### Course Transformation System

#### Supported Operations

| Operation | Description | Implementation |
|-----------|-------------|----------------|
| **Scale** | Increase/decrease course size | 10% increments (1.1x / 0.9x) |
| **Rotate** | Rotate entire course | 5° increments clockwise/counter-clockwise |
| **Translate** | Move course position | ~111m increments (0.001° lat/lng) |

#### Transformation Algorithm

```typescript
function applyCourseTransform(transform: {
  scale?: number;
  rotation?: number;
  translateLat?: number;
  translateLng?: number;
}) {
  // Find course center (pivot point)
  const centerLat = marks.reduce((sum, m) => sum + m.lat, 0) / marks.length;
  const centerLng = marks.reduce((sum, m) => sum + m.lng, 0) / marks.length;
  
  marks.forEach(mark => {
    let newLat = mark.lat;
    let newLng = mark.lng;
    
    // Apply scaling relative to center
    if (transform.scale) {
      newLat = centerLat + (newLat - centerLat) * transform.scale;
      newLng = centerLng + (newLng - centerLng) * transform.scale;
    }
    
    // Apply rotation relative to center
    if (transform.rotation) {
      const rad = transform.rotation * Math.PI / 180;
      const dx = newLng - centerLng;
      const dy = newLat - centerLat;
      newLng = centerLng + dx * Math.cos(rad) - dy * Math.sin(rad);
      newLat = centerLat + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    
    // Apply translation
    if (transform.translateLat) newLat += transform.translateLat;
    if (transform.translateLng) newLng += transform.translateLng;
    
    updateMark(mark.id, { lat: newLat, lng: newLng });
  });
}
```

### Gate System

Gates are special marks that require two buoys positioned perpendicular to the wind direction.

#### Gate Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `isGate` | false | Enables gate mode |
| `gateWidthBoatLengths` | 8 | Gate width in boat lengths |
| `boatLengthMeters` | 6 | Boat length for calculations |
| `gatePortBuoyId` | null | Assigned port buoy |
| `gateStarboardBuoyId` | null | Assigned starboard buoy |

#### Gate Position Calculation

```typescript
function calculateGatePositions(
  centerLat: number,
  centerLng: number,
  windDirection: number,
  gateWidthMeters: number
): { port: GeoPosition; starboard: GeoPosition } {
  // Calculate perpendicular angle to wind
  const perpendicularAngle = (windDirection + 90) % 360;
  const halfWidthDegrees = (gateWidthMeters / 2) / 111320;
  
  const latCorrection = Math.cos(centerLat * Math.PI / 180);
  
  return {
    port: {
      lat: centerLat + halfWidthDegrees * Math.cos(portAngleRad),
      lng: centerLng + (halfWidthDegrees / latCorrection) * Math.sin(portAngleRad)
    },
    starboard: {
      lat: centerLat + halfWidthDegrees * Math.cos(starboardAngleRad),
      lng: centerLng + (halfWidthDegrees / latCorrection) * Math.sin(starboardAngleRad)
    }
  };
}
```

### Auto-Adjust Course to Wind

The platform includes a wizard-based system to adjust mark positions relative to current wind direction.

#### Role-Based Default Angles

| Mark Role | Default Angle from Wind |
|-----------|------------------------|
| Windward | 0° (directly upwind) |
| Leeward | 180° (directly downwind) |
| Wing | 60° (reaching angle) |
| Offset | 45° |
| Gate | 180° (leeward gate) |

#### Adjustment Process

1. User selects marks to adjust
2. System calculates target positions based on wind direction and role defaults
3. Preview positions shown on map
4. User confirms adjustments
5. All marks updated atomically
6. Assigned buoys commanded to new positions

---

## Buoy Management System

### Buoy State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
    ┌──────────┐  assign  ┌─────────────────┐  arrived  ┌──┴───────────────┐
    │   idle   │────────►│ moving_to_target │──────────►│ holding_position │
    └──────────┘          └─────────────────┘            └──────────────────┘
         ▲                       │                              │
         │                       │                              │
    unassign                     │ conditions                   │ degraded
         │                       ▼                              ▼
         │              ┌─────────────────────────────────────────────────┐
         │              │         station_keeping_degraded                │
         │              └─────────────────────────────────────────────────┘
         │                       │
         │                       │ fault
         │                       ▼
         │              ┌─────────────────┐
         └──────────────│      fault      │
                        └─────────────────┘
```

### Buoy Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `move_to_target` | Navigate to specified position | `targetLat`, `targetLng` |
| `hold_position` | Maintain current position | None |
| `cancel` | Cancel current operation, return to idle | None |

### Buoy Follow System

The `useBuoyFollow` hook provides automatic buoy repositioning when marks move.

#### Architecture

```typescript
interface BuoyFollowSettings {
  distanceThresholdMeters: number;  // Trigger distance (default: 3m)
  pollIntervalSeconds: number;       // Drift check interval (default: 5s)
  debounceTimeSeconds: number;       // Command debounce (default: 3s)
  acceptableDistanceMeters: number;  // "On station" tolerance (default: 1m)
}
```

#### Hybrid Approach

1. **Immediate Response**: When a mark is moved (drag, nudge, adjust to wind, course transform), the assigned buoy is immediately commanded to the new position.

2. **Continuous Drift Monitoring**: A polling loop checks if buoys in "holding_position" state have drifted beyond the threshold and automatically repositions them.

#### Integration Points

The `handleMarkMoved` callback is integrated into all mark update paths:

- Mark dragging (with confirmation for assigned buoys)
- Nudge controls (N/S/E/W directional moves)
- Adjust to wind operations
- Course transformations (scale/rotate/move)
- Undo operations
- Direct position edits in MarkEditPanel

### Auto-Assign Buoys Algorithm

The auto-assign feature uses a greedy algorithm to minimize maximum deployment time:

```typescript
function autoAssignBuoys(marks: Mark[], buoys: Buoy[]) {
  // 1. Identify all assignment slots
  const slots = marks.flatMap(mark => {
    if (mark.isGate) {
      return [
        { markId: mark.id, type: 'port', position: calculateGatePort(mark) },
        { markId: mark.id, type: 'starboard', position: calculateGateStarboard(mark) }
      ];
    }
    return [{ markId: mark.id, type: 'single', position: { lat: mark.lat, lng: mark.lng } }];
  });
  
  // 2. Get available buoys (idle state, not already assigned)
  const available = buoys.filter(b => b.state === 'idle' && !isAssigned(b));
  
  // 3. Greedy assignment - assign closest buoy to most constrained slot
  while (slots.length > 0 && available.length > 0) {
    // Find slot with minimum distance to any available buoy
    let minDistance = Infinity;
    let bestSlot, bestBuoy;
    
    for (const slot of slots) {
      for (const buoy of available) {
        const distance = calculateDistance(slot.position, buoy);
        if (distance < minDistance) {
          minDistance = distance;
          bestSlot = slot;
          bestBuoy = buoy;
        }
      }
    }
    
    assign(bestSlot, bestBuoy);
    remove(slots, bestSlot);
    remove(available, bestBuoy);
  }
}
```

### Fleet Status Dashboard

The Fleet Status view provides a buoy-centric overview organized by category:

#### Status Categories

| Category | Description |
|----------|-------------|
| **Assigned to Marks** | Buoys currently assigned and holding position |
| **GoTo Target** | Buoys in transit to assigned positions |
| **Available** | Idle buoys ready for assignment |
| **Issues** | Buoys with faults, low battery, or degraded performance |

#### Summary Grid

| Metric | Description |
|--------|-------------|
| On Station | Count of buoys in `holding_position` state |
| Moving | Count of buoys in `moving_to_target` state |
| Idle | Count of buoys in `idle` state |
| Fault | Count of buoys with issues |
| Low Battery | Count of buoys with battery < 20% |

---

## Weather Integration

### Weather Data Sources

| Source | Description | Priority |
|--------|-------------|----------|
| `api` | External weather API | Highest accuracy |
| `buoy` | Onboard buoy sensors | Real-time, localized |
| `manual` | User-entered values | Override/backup |

### Weather Data Structure

```typescript
interface WeatherData {
  windSpeed: number;           // Knots
  windDirection: number;       // Degrees (0-360)
  currentSpeed: number;        // Knots
  currentDirection: number;    // Degrees (0-360)
  source: "api" | "buoy" | "manual";
  sourceBuoyId?: string;       // If source is buoy
  timestamp: Date;
}
```

### Buoy-Based Weather

When using buoy sensors, the system aggregates weather data:

```typescript
const demoWeatherData = useMemo(() => {
  const avgWindSpeed = buoys.reduce((sum, b) => sum + (b.windSpeed ?? 0), 0) / buoys.length;
  const avgWindDirection = buoys.reduce((sum, b) => sum + (b.windDirection ?? 0), 0) / buoys.length;
  return {
    windSpeed: avgWindSpeed,
    windDirection: avgWindDirection,
    currentSpeed: 0.8,
    currentDirection: 180,
    source: "buoy",
    timestamp: new Date()
  };
}, [buoys]);
```

### Wind Angle Calculation

Centralized calculation for consistent wind angle display:

```typescript
function calculateWindAngle(legBearing: number, windDirection: number): {
  relativeTwa: number;     // Signed relative wind angle (-180 to +180)
  absoluteTwa: number;     // Absolute true wind angle (0 to 180)
} {
  // Normalize to 0-360
  const normalizedBearing = ((legBearing % 360) + 360) % 360;
  const normalizedWind = ((windDirection % 360) + 360) % 360;
  
  // Calculate relative angle
  let relative = normalizedBearing - normalizedWind;
  
  // Normalize to -180 to +180
  if (relative > 180) relative -= 360;
  if (relative < -180) relative += 360;
  
  return {
    relativeTwa: relative,
    absoluteTwa: Math.abs(relative)
  };
}
```

---

## Race Time Estimation Engine

### Overview

The race time estimation engine uses VMG-based calculations with boat class performance data to predict race duration.

### Point of Sail Classification

| Point of Sail | TWA Range | Description |
|---------------|-----------|-------------|
| Upwind | < no-go zone | Sailing close-hauled, requires tacking |
| Close Reach | no-go to 60° | Sailing slightly off the wind |
| Beam Reach | 60° to 110° | Wind perpendicular to boat |
| Broad Reach | 110° to 150° | Wind from behind quarter |
| Downwind | > 150° | Running before the wind, may require jibing |

### Wind Categories

| Category | Wind Speed | Description |
|----------|------------|-------------|
| Light | 0-8 knots | Light air conditions |
| Medium | 8-14 knots | Moderate breeze |
| Heavy | 14+ knots | Strong wind conditions |

### Estimation Algorithm

```typescript
function estimateRaceTime(
  legs: LegData[],
  boatClass: BoatClass,
  windSpeedKnots: number,
  windDirectionDeg: number
): RaceTimeEstimate {
  const windCategory = getWindCategory(windSpeedKnots);
  let totalTimeSeconds = 0;
  
  legs.forEach(leg => {
    // 1. Calculate wind angle for this leg
    const { absoluteTwa: twa } = calculateWindAngle(leg.bearing, windDirectionDeg);
    
    // 2. Determine point of sail
    const pointOfSail = determinePointOfSail(twa, boatClass.noGoZoneAngle);
    
    // 3. Get VMG from boat class performance data
    const vmg = getVMG(boatClass, pointOfSail, windCategory);
    
    // 4. Calculate sailing distance (accounts for tacking/jibing)
    const { sailingDistance, maneuvers } = calculateSailingDistanceAndManeuvers(
      leg.distance,
      twa,
      pointOfSail,
      pointOfSail === "upwind" ? boatClass.upwindTwa : boatClass.downwindTwa
    );
    
    // 5. Calculate boat speed through water
    const boatSpeed = calculateBoatSpeed(vmg, pointOfSail, boatClass);
    
    // 6. Calculate leg time
    const sailingTimeSeconds = (sailingDistance / boatSpeed) * 3600;
    
    // 7. Add maneuver times
    const maneuverTime = maneuvers * (
      pointOfSail === "upwind" ? boatClass.tackTime :
      pointOfSail === "downwind" ? boatClass.jibeTime : 0
    );
    
    // 8. Add mark rounding time
    const roundingTime = boatClass.markRoundingTime;
    
    totalTimeSeconds += sailingTimeSeconds + maneuverTime + roundingTime;
  });
  
  // Add start line crossing time (estimated 30 seconds)
  totalTimeSeconds += 30;
  
  return {
    legs: legEstimates,
    totalDistanceNm,
    totalSailingDistanceNm,
    totalTimeSeconds,
    totalTimeFormatted: formatTime(totalTimeSeconds),
    windSpeedKnots,
    windDirectionDeg,
    boatClassName: boatClass.name
  };
}
```

### Sailing Distance Calculations

For upwind/downwind legs, boats cannot sail directly at the mark:

```typescript
function calculateSailingDistanceAndManeuvers(
  straightLineDistance: number,
  twa: number,
  pointOfSail: PointOfSail,
  optimalTwa: number
): { sailingDistance: number; maneuvers: number } {
  if (pointOfSail === "upwind") {
    // Tacking: actual path is longer due to zigzag
    const tackingAngle = optimalTwa;
    const cosAngle = Math.cos((tackingAngle * Math.PI) / 180);
    const sailingDistance = straightLineDistance / Math.max(cosAngle, 0.5);
    const numTacks = Math.max(2, Math.ceil(sailingDistance / 0.2)); // Tack every 0.2nm
    return { sailingDistance, maneuvers: numTacks };
  }
  
  if (pointOfSail === "downwind") {
    // Jibing: similar to upwind but typically less frequent
    const jibingAngle = 180 - optimalTwa;
    const cosAngle = Math.cos((jibingAngle * Math.PI) / 180);
    const sailingDistance = straightLineDistance / Math.max(cosAngle, 0.7);
    const numJibes = Math.max(1, Math.ceil(sailingDistance / 0.3)); // Jibe every 0.3nm
    return { sailingDistance, maneuvers: numJibes };
  }
  
  // Reaching: sail direct
  return { sailingDistance: straightLineDistance, maneuvers: 0 };
}
```

### Supported Boat Classes

The database includes performance data for major dinghy and keelboat classes. Example classes include:

| Class | Type | Crew | Description |
|-------|------|------|-------------|
| Laser/ILCA | Dinghy | 1 | Single-handed Olympic dinghy |
| 420 | Dinghy | 2 | Two-person training dinghy |
| 49er | Skiff | 2 | High-performance Olympic skiff |
| J/70 | Keelboat | 4 | One-design sportboat |
| Nacra 17 | Catamaran | 2 | Foiling Olympic catamaran |

*Boat classes are stored in the database with full performance profiles. Additional classes can be added as needed.*

---

## Interactive Map System

### Map Component (LeafletMap)

Built on Leaflet.js with React integration, providing:

#### Core Features

- **OpenStreetMap tiles** as base layer
- **Gesture support**: Pinch-to-zoom, drag-to-pan
- **Map orientation**: North-up or wind-up modes
- **Touch targets**: Minimum 48px for tablet use

#### Mark Visualization

| Mark Type | Icon | Color |
|-----------|------|-------|
| Windward | Triangle | Blue |
| Leeward | Circle | Green |
| Gate | Circle with P/S label | Orange |
| Wing | Diamond | Yellow |
| Start Boat | Boat icon | Red |
| Pin | Pin icon | Red |

#### Course Path Rendering

- **Solid lines** between marks in rounding sequence
- **Numbered badges** showing rounding order
- **Bearing/distance labels** on legs
- **Wind angle indicators** per leg

#### Buoy Visualization

| State | Icon Style | Indicator |
|-------|------------|-----------|
| idle | Gray circle | None |
| moving_to_target | Animated pulse | Dashed line to target |
| holding_position | Solid green | Checkmark |
| fault | Red with warning | Exclamation mark |

### Map Controls

| Control | Function | Location |
|---------|----------|----------|
| Zoom +/- | Adjust zoom level | Top-left |
| Orientation | Toggle N-up/Wind-up | Top-left |
| Weather fetch | Get weather at location | Context menu |
| Fullscreen | Toggle fullscreen mode | Top bar |
| Labels toggle | Show/hide mark labels | Settings |
| Wind arrows | Show/hide wind indicators | Settings |

### Interactive Operations

- **Tap mark**: Select for editing
- **Drag mark**: Reposition (with confirmation for assigned buoys)
- **Tap buoy**: View telemetry details
- **Tap-to-place**: Add marks at tapped location
- **Long-press**: Context menu for advanced options

---

## Settings & Configuration

### User Settings (Persisted to Database)

```typescript
interface UserSettings {
  userId: string;
  distanceUnit: "meters" | "kilometers" | "nautical_miles" | "miles";
  speedUnit: "knots" | "beaufort" | "ms" | "kmh" | "mph";
  windSource: "api" | "buoy" | "manual";
  selectedWindBuoyId: string | null;
}
```

### Local Settings (localStorage)

#### Start Line Adjustment Controls

| Setting | Options | Description |
|---------|---------|-------------|
| Resize Mode | `symmetric` / `pin_fixed` / `cb_fixed` | How start line resizes |
| Fix Bearing Mode | `perpendicular` / `manual` | Auto-adjust bearing to wind |

#### Wind Angle Defaults

Role-based default angles for auto-adjust operations:

```typescript
interface WindAngleDefaults {
  windward: number;   // Default: 0°
  leeward: number;    // Default: 180°
  wing: number;       // Default: 60°
  offset: number;     // Default: 45°
  gate: number;       // Default: 180°
}
```

#### Buoy Follow Settings

```typescript
interface BuoyFollowSettings {
  distanceThresholdMeters: number;    // Default: 3
  pollIntervalSeconds: number;         // Default: 5
  debounceTimeSeconds: number;         // Default: 3
  acceptableDistanceMeters: number;    // Default: 1
}
```

### Unit Conversions

#### Distance Units

| Unit | Conversion from NM | Label |
|------|-------------------|-------|
| Nautical Miles | 1.0 | nm |
| Meters | 1852 | m |
| Kilometers | 1.852 | km |
| Miles | 1.15078 | mi |

#### Speed Units

| Unit | Conversion from Knots | Label |
|------|----------------------|-------|
| Knots | 1.0 | kts |
| m/s | 0.514444 | m/s |
| km/h | 1.852 | km/h |
| mph | 1.15078 | mph |
| Beaufort | (scale) | Bft |

---

## Demo Mode

### Purpose

Demo mode provides a fully functional simulation environment for:

- Training new race officers
- Demonstrating platform capabilities
- Testing course configurations without live buoys

### Implementation

The `DemoModeContext` provides:

```typescript
interface DemoModeContext {
  demoMode: boolean;
  demoBuoys: Buoy[];
  sendDemoCommand: (
    buoyId: string,
    command: "move_to_target" | "hold_position" | "cancel",
    targetLat?: number,
    targetLng?: number
  ) => void;
  resetDemoBuoys: () => void;
}
```

### Simulated Behavior

- **8 virtual buoys** with realistic initial positions
- **Movement simulation** with configurable speed (3.25 kts default)
- **Weather simulation** from buoy sensor averages
- **State transitions** matching real buoy behavior
- **ETA calculations** based on distance and speed

### Demo Buoy Fleet

| Name | Initial Position | Initial State |
|------|-----------------|---------------|
| Alpha | Center + offset | idle |
| Bravo | Center + offset | idle |
| Charlie | Center + offset | idle |
| Delta | Center + offset | idle |
| Echo | Center + offset | idle |
| Foxtrot | Center + offset | idle |
| Golf | Center + offset | idle |
| Hotel | Center + offset | idle |

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | User logout | Yes |
| GET | `/api/auth/me` | Get current user | Yes |

### User Management

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/users` | List users | super_admin, club_manager |
| POST | `/api/users` | Create user | super_admin, club_manager |
| PATCH | `/api/users/:id` | Update user | super_admin, club_manager |
| DELETE | `/api/users/:id` | Delete user | super_admin, club_manager |
| POST | `/api/users/:id/events` | Grant event access | super_admin, club_manager |
| DELETE | `/api/users/:id/events/:eventId` | Revoke event access | super_admin, club_manager |

### Sail Clubs

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/sail-clubs` | List clubs | All authenticated |
| POST | `/api/sail-clubs` | Create club | super_admin |
| PATCH | `/api/sail-clubs/:id` | Update club | super_admin |
| DELETE | `/api/sail-clubs/:id` | Delete club | super_admin |

### Events

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/events` | List events | All authenticated |
| POST | `/api/events` | Create event | super_admin, club_manager |
| GET | `/api/events/:id` | Get event | With access |
| PATCH | `/api/events/:id` | Update event | With access |
| DELETE | `/api/events/:id` | Delete event | super_admin, club_manager |

### Courses

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/courses` | List courses | All authenticated |
| POST | `/api/courses` | Create course | All authenticated |
| GET | `/api/courses/:id` | Get course | All authenticated |
| PATCH | `/api/courses/:id` | Update course | All authenticated |
| DELETE | `/api/courses/:id` | Delete course | All authenticated |
| GET | `/api/courses/:id/marks` | Get course marks | All authenticated |

### Marks

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/marks/:id` | Get mark | All authenticated |
| POST | `/api/marks` | Create mark | All authenticated |
| PATCH | `/api/marks/:id` | Update mark | All authenticated |
| DELETE | `/api/marks/:id` | Delete mark | All authenticated |
| DELETE | `/api/courses/:id/marks` | Delete all course marks | All authenticated |

### Buoys

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/buoys` | List buoys | All authenticated |
| GET | `/api/buoys/:id` | Get buoy | All authenticated |
| POST | `/api/buoys/:id/command` | Send buoy command | All authenticated |

### Boat Classes

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/boat-classes` | List boat classes | All authenticated |
| GET | `/api/boat-classes/:id` | Get boat class | All authenticated |

### Weather

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/weather` | Get current weather | All authenticated |
| POST | `/api/weather/location` | Get weather at location | All authenticated |

### User Settings

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/user-settings` | Get user settings | All authenticated |
| PUT | `/api/user-settings` | Update user settings | All authenticated |

---

## Frontend Architecture

### State Management

#### TanStack React Query v5

All server state is managed through React Query:

```typescript
// Fetch with automatic caching and refetching
const { data: buoys, isLoading } = useQuery<Buoy[]>({
  queryKey: ["/api/buoys"],
  refetchInterval: 5000  // Poll every 5 seconds
});

// Mutations with cache invalidation
const updateMark = useMutation({
  mutationFn: async ({ id, data }) => 
    apiRequest("PATCH", `/api/marks/${id}`, data),
  onSuccess: () => 
    queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "marks"] })
});
```

#### Local State

Component-level state for UI concerns:

- Selected mark/buoy IDs
- Dialog open states
- Form values (before submission)
- Map orientation
- Panel visibility

### Component Hierarchy

```
App
├── SidebarProvider
│   ├── AppSidebar (navigation)
│   └── Main Content
│       ├── TopBar
│       ├── LeafletMap (60-70% width)
│       └── Side Panel (30-40% width)
│           ├── SetupPanel (course creation mode)
│           └── MarkEditPanel (mark selected mode)
├── SettingsDialog
└── Toaster (notifications)
```

### Routing

```typescript
<Switch>
  <Route path="/login" component={Login} />
  <Route path="/admin" component={AdminDashboard} />  // super_admin only
  <Route path="/club" component={ClubDashboard} />    // club_manager only
  <Route path="/events" component={EventsList} />
  <Route path="/race/:eventId" component={RaceControl} />
  <Route component={NotFound} />
</Switch>
```

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state and actions |
| `useBuoys` | Buoy data with polling |
| `useMarks` | Course marks CRUD |
| `useBuoyCommand` | Send commands to buoys |
| `useBuoyFollow` | Automatic buoy repositioning |
| `useSettings` | User settings and formatting |
| `useWeatherData` | Weather data fetching |

---

## Progressive Web App (PWA)

The application is designed for tablet use with responsive layout optimized for landscape orientation. The frontend is built with React and can be accessed through any modern browser.

### Tablet Optimization

- **Landscape-first layout**: Map occupies 60-70% of viewport, side panel 30-40%
- **Touch-friendly controls**: Minimum 48px touch targets throughout
- **Large buttons**: Designed for use with wet fingers at sea
- **Responsive design**: Adapts to different tablet screen sizes

---

## Appendix: World Sailing Course Standards

### Course Dimensions

| Course Type | Windward Leg | Reaching Leg | Gate Width |
|-------------|--------------|--------------|------------|
| Triangle | 0.5-1.0 nm | 67% of windward | 10 hull lengths |
| Trapezoid | 0.5-1.0 nm | 67% of windward | 10 hull lengths |
| Windward-Leeward | 0.5-1.0 nm | N/A | 10 hull lengths |

### Reach Angles

| Boat Type | Recommended Angle |
|-----------|-------------------|
| Spinnaker boats | 60° |
| Non-spinnaker (ILCA, etc.) | 70° |

### Start Line

- Length: 1.0-1.5x fleet width
- Bias: 5-10° port-favored typical
- Position: 0.05nm (100m) below leeward gate

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Platform Version: 1.0.0*
