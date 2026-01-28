# Alconmarks - Technical Documentation

## Overview

Alconmarks is a tablet-first Progressive Web Application (PWA) for managing automated robotic buoys in sailing races and training events. Built for Race Officers with "wet finger" usability at sea.

---

## Technology Stack

### Languages

| Language | Version | Usage |
|----------|---------|-------|
| **TypeScript** | 5.6.3 | Primary language (frontend & backend) |
| **JavaScript** | ES2020+ | Build tools, configuration |
| **SQL** | PostgreSQL | Database queries |
| **CSS** | Tailwind CSS 3.4 | Styling |

### Frontend Frameworks & Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **Vite** | 7.3.0 | Build tool & dev server |
| **TanStack React Query** | 5.60.5 | Server state management, caching |
| **Wouter** | 3.3.5 | Client-side routing |
| **React Hook Form** | 7.55.0 | Form handling |
| **Zod** | 3.24.2 | Runtime validation |
| **Framer Motion** | 11.13.1 | Animations |

### UI Component Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| **Radix UI** | Various | Headless component primitives |
| **Shadcn/ui** | Built-in | Pre-styled component collection |
| **Lucide React** | 0.453.0 | Icon library |
| **React Icons** | 5.4.0 | Additional icons |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS |
| **tailwindcss-animate** | 1.0.7 | Animation utilities |
| **class-variance-authority** | 0.7.1 | Component variant styling |
| **tailwind-merge** | 2.6.0 | Class merging utility |
| **clsx** | 2.1.1 | Conditional classes |

### Map & Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| **Leaflet** | 1.9.4 | Interactive maps |
| **React Leaflet** | 4.2.1 | React bindings for Leaflet |
| **leaflet-rotate** | 0.2.8 | Map rotation support |
| **Recharts** | 2.15.2 | Charts and graphs |

### Backend Frameworks & Libraries

| Package | Version | Purpose |
|---------|---------|---------|
| **Express** | 5.0.1 | HTTP server framework |
| **PostgreSQL (pg)** | 8.16.3 | Database driver |
| **Drizzle ORM** | 0.39.3 | Type-safe ORM |
| **drizzle-zod** | 0.7.0 | Schema validation integration |
| **bcrypt** | 6.0.0 | Password hashing |
| **express-session** | 1.18.2 | Session management |
| **connect-pg-simple** | 10.0.0 | PostgreSQL session store |
| **ws** | 8.18.0 | WebSocket support |

### Integrations

| Package | Version | Purpose |
|---------|---------|---------|
| **@octokit/rest** | 22.0.0 | GitHub API integration |

### Development Tools

| Package | Version | Purpose |
|---------|---------|---------|
| **tsx** | 4.20.5 | TypeScript execution |
| **drizzle-kit** | 0.31.8 | Database migrations |
| **autoprefixer** | 10.4.20 | CSS vendor prefixes |
| **postcss** | 8.4.47 | CSS processing |

---

## Architecture

### Directory Structure

```
├── client/src/
│   ├── components/          # React components
│   │   ├── ui/              # 47 Shadcn base components
│   │   └── [feature]/       # Feature-specific components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions
│   │   └── services/        # Domain services
│   ├── contexts/            # React contexts
│   └── pages/               # Page components
├── server/
│   ├── routes.ts            # API endpoints
│   ├── database-storage.ts  # Database operations
│   ├── auth.ts              # Authentication middleware
│   └── index.ts             # Server entry point
├── shared/
│   └── schema.ts            # Shared types & database schema
└── package.json
```

---

## Database Schema

### Core Tables

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| username | text | Unique username |
| passwordHash | text | Bcrypt hash |
| role | text | "super_admin" \| "club_manager" \| "event_manager" |
| sailClubId | varchar | Foreign key to sail_clubs |
| createdAt | timestamp | Creation timestamp |

#### `sail_clubs`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Club name |
| logoUrl | text | Logo URL |
| location | jsonb | { lat: number, lng: number } |

#### `events`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Event name |
| type | text | "race" \| "training" |
| sailClubId | varchar | Foreign key to sail_clubs |
| boatClass | text | Boat class name |
| boatClassId | varchar | Foreign key to boat_classes |
| targetDuration | integer | Target duration in minutes |
| courseId | varchar | Foreign key to courses |
| startDate | timestamp | Event start date |
| endDate | timestamp | Event end date |

#### `courses`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Course name |
| shape | text | "triangle" \| "trapezoid" \| "windward_leeward" \| "custom" |
| centerLat | real | Center latitude |
| centerLng | real | Center longitude |
| rotation | real | Course rotation (degrees) |
| scale | real | Scale factor |
| roundingSequence | text[] | Array of mark IDs/names |

#### `marks`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| courseId | varchar | Foreign key to courses |
| name | text | Mark name |
| role | text | Mark role (see MarkRole enum) |
| order | integer | Sequence order |
| lat | real | Latitude |
| lng | real | Longitude |
| assignedBuoyId | varchar | Foreign key to buoys |
| isStartLine | boolean | Part of start line |
| isFinishLine | boolean | Part of finish line |
| isCourseMark | boolean | Course mark flag |
| isGate | boolean | Gate flag |
| gateWidthBoatLengths | real | Gate width (boat lengths) |
| gatePortBuoyId | varchar | Port gate buoy |
| gateStarboardBuoyId | varchar | Starboard gate buoy |

#### `buoys`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Buoy name |
| serialNumber | text | Hardware serial |
| sailClubId | varchar | Owning club |
| state | text | BuoyState enum |
| lat | real | Current latitude |
| lng | real | Current longitude |
| targetLat | real | Target latitude |
| targetLng | real | Target longitude |
| speed | real | Current speed |
| battery | integer | Battery percentage |
| signalStrength | integer | Signal strength |
| windSpeed | real | Weather sensor data |
| windDirection | real | Weather sensor data |
| ownershipType | text | "platform_owned" \| "long_rental" \| "event_rental" |
| inventoryStatus | text | "in_inventory" \| "assigned_club" \| "assigned_event" \| "maintenance" \| "retired" |
| eventId | varchar | Current event assignment |

#### `boat_classes`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Class name (e.g., "Laser", "29er") |
| hullType | text | "displacement" \| "planing" \| "foiling" |
| lengthMeters | real | Hull length |
| upwindVmgLight/Medium/Heavy | real | Upwind VMG at different wind speeds |
| downwindVmgLight/Medium/Heavy | real | Downwind VMG |
| reachSpeedLight/Medium/Heavy | real | Reaching speed |
| tackTime | real | Tack maneuver time (seconds) |
| jibeTime | real | Jibe maneuver time (seconds) |

#### `course_snapshots`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| name | text | Snapshot name |
| ownerId | varchar | Creating user |
| visibilityScope | text | "global" \| "club" \| "user" |
| category | text | "triangle" \| "trapezoid" \| "windward_leeward" \| "other" |
| thumbnailSvg | text | Auto-generated preview |
| snapshotMarks | jsonb | Array of SnapshotMark |

#### `user_settings`
| Column | Type | Description |
|--------|------|-------------|
| id | varchar (UUID) | Primary key |
| userId | varchar | User reference |
| distanceUnit | text | "meters" \| "nautical_miles" \| "kilometers" \| "miles" |
| speedUnit | text | "knots" \| "beaufort" \| "ms" \| "kmh" \| "mph" |
| windSource | text | "api" \| "buoy" \| "manual" |
| mapLayer | text | Map tile layer selection |
| markNudgeMeters | integer | Nudge distance (1-50m) |
| integrations | jsonb | Vakaros, Tractrac settings |

---

## Enums

```typescript
UserRole = "super_admin" | "club_manager" | "event_manager"
EventType = "race" | "training"
BuoyState = "idle" | "moving_to_target" | "holding_position" | "station_keeping_degraded" | "unavailable" | "maintenance" | "fault"
MarkRole = "start_boat" | "pin" | "windward" | "leeward" | "gate" | "offset" | "wing" | "turning_mark" | "finish" | "other"
CourseShape = "triangle" | "trapezoid" | "windward_leeward" | "custom"
DistanceUnit = "meters" | "nautical_miles" | "kilometers" | "miles"
SpeedUnit = "knots" | "beaufort" | "ms" | "kmh" | "mph"
```

---

## Custom Components

### Page Components

#### `RaceControl`
Main race management interface with map, panels, and controls.

#### `AdminDashboard`
Super admin interface for managing clubs, users, events, buoys, boat classes.

#### `ClubDashboard`
Club manager interface for managing club events and users.

#### `EventsList`
Event manager view of assigned events.

### Feature Components

#### `LeafletMap`
Interactive map component with buoy/mark visualization.

| Prop | Type | Description |
|------|------|-------------|
| buoys | Buoy[] | Array of buoys to display |
| marks | Mark[] | Array of marks to display |
| selectedBuoyId | string \| null | Currently selected buoy |
| selectedMarkId | string \| null | Currently selected mark |
| weatherData | WeatherData \| null | Wind data for display |
| onBuoyClick | (id: string) => void | Buoy click handler |
| onMarkClick | (id: string) => void | Mark click handler |
| onMapClick | (lat, lng) => void | Map click handler |
| onMarkDragEnd | (id, lat, lng) => void | Mark drag handler |
| isPlacingMark | boolean | Mark placement mode |
| mapOrientation | MapOrientation | "north_up" \| "wind_up" \| "course_up" |
| mapLayer | MapLayerType | Tile layer selection |
| showSeaMarks | boolean | Show OpenSeaMap overlay |
| trackedBoats | TrackedBoat[] | Boat tracking data |
| onLongPress | (lat, lng) => void | Long press handler (600ms) |

#### `SetupPanel`
Multi-phase course setup wizard.

| Prop | Type | Description |
|------|------|-------------|
| event | Event | Current event |
| course | Course \| null | Current course |
| buoys | Buoy[] | Available buoys |
| marks | Mark[] | Course marks |
| roundingSequence | string[] | Rounding order |
| windDirection | number | Wind direction (degrees) |
| onMarkSelect | (id: string \| null) => void | Mark selection handler |
| onSaveMark | (id, data) => void | Save mark changes |
| onAddMark | (data) => void | Add new mark |
| onSaveCourse | (data) => void | Save course snapshot |
| onLoadCourse | (snapshot, mode) => void | Load course template |
| onTransformCourse | (transform) => void | Scale/rotate course |
| onAutoAssignBuoys | () => void | Auto-assign buoys |
| onPhaseChange | (phase) => void | Phase change handler |
| isCollapsed | boolean | Collapsed state |

#### `MarkEditPanel`
Mark editing panel with positioning controls.

| Prop | Type | Description |
|------|------|-------------|
| mark | Mark | Mark to edit |
| buoys | Buoy[] | Available buoys |
| allMarks | Mark[] | All course marks |
| roundingSequence | string[] | Rounding sequence |
| windDirection | number | Wind direction |
| onClose | () => void | Close handler |
| onSave | (data) => void | Save changes |
| onDelete | () => void | Delete mark |
| onNudge | (direction) => void | Nudge mark position |
| onAdjustToWind | (lat, lng) => void | Adjust relative to wind |
| onAdjustToShape | (lat, lng) => void | Adjust to target angle |

#### `BuoyDetailPanel`
Buoy status and control panel.

| Prop | Type | Description |
|------|------|-------------|
| buoy | Buoy | Buoy to display |
| onClose | () => void | Close handler |
| demoSendCommand | (id, command, lat?, lng?) => void | Demo mode command |
| onTapMapToGoto | () => void | Enter tap-to-go mode |
| onNudgeBuoy | (direction) => void | Nudge buoy position |
| assignedMarkName | string | Assigned mark name |
| assignedMarkLat | number | Target latitude |
| assignedMarkLng | number | Target longitude |

#### `TopBar`
Application header with navigation and quick actions.

| Prop | Type | Description |
|------|------|-------------|
| eventName | string | Current event name |
| clubName | string | Club name |
| demoMode | boolean | Demo mode active |
| userRole | string | User role for UI customization |
| weatherData | WeatherData \| null | Weather display |
| onSettingsClick | () => void | Open settings |
| onToggleDemoMode | () => void | Toggle demo mode |
| onClearCourse | () => void | Clear course marks |
| onSaveCourse | () => void | Save course dialog |
| onLoadCourse | () => void | Load course dialog |

#### `FloatingActionBar`
Always-visible action bar for critical operations.

| Prop | Type | Description |
|------|------|-------------|
| onAlignToWind | () => void | Align course to wind |
| onDeployAll | () => void | Deploy all buoys |
| onHoldAll | () => void | Hold all buoys |
| onUndo | () => void | Undo last action |
| canAlign | boolean | Align button enabled |
| canDeploy | boolean | Deploy button enabled |
| onStationCount | number | Buoys on station |
| totalBuoys | number | Total assigned buoys |

#### `FleetStatusPanel`
Buoy fleet status dashboard.

| Prop | Type | Description |
|------|------|-------------|
| buoys | Buoy[] | All buoys |
| marks | Mark[] | Course marks (for assignment info) |
| onBuoySelect | (id: string) => void | Select buoy |
| onBulkBuoyCommand | (ids[], command) => void | Bulk command |

#### `SettingsDialog`
Application settings dialog.

| Prop | Type | Description |
|------|------|-------------|
| open | boolean | Dialog open state |
| onOpenChange | (open: boolean) => void | Open state handler |
| buoys | Buoy[] | Buoys for wind source selection |
| mapOrientation | MapOrientation | Current orientation |
| onOrientationChange | (orientation) => void | Change orientation |
| onAlignCourseToWind | () => void | Align course |

#### `QuickStartWizard`
Course template selection wizard.

| Prop | Type | Description |
|------|------|-------------|
| open | boolean | Dialog open state |
| onOpenChange | (open: boolean) => void | Open state handler |
| onLoadCourse | (snapshot, mode, fleetConfig?) => void | Load course |
| onCreateCustom | (fleetConfig?) => void | Create custom course |
| hasWindData | boolean | Wind data available |
| isNewEvent | boolean | New event (non-cancellable) |

#### `AutoAdjustWizard`
Course adjustment to wind wizard.

| Prop | Type | Description |
|------|------|-------------|
| open | boolean | Dialog open state |
| marks | Mark[] | Course marks |
| windDirection | number | Wind direction |
| roundingSequence | string[] | Rounding sequence |
| onAdjust | (markId, lat, lng) => void | Adjust mark |
| onComplete | (originalPositions) => void | Complete handler |

#### `WindShiftAlert`
Wind shift notification banner.

| Prop | Type | Description |
|------|------|-------------|
| setupWindDirection | number | Original wind direction |
| currentWindDirection | number | Current wind direction |
| onRealign | () => void | Realign course handler |

#### `ErrorBoundary`
React error boundary component.

| Prop | Type | Description |
|------|------|-------------|
| children | ReactNode | Child components |
| fallback | ReactNode | Custom fallback UI |

#### `ProtectedRoute`
Route protection with role-based access.

| Prop | Type | Description |
|------|------|-------------|
| children | ReactNode | Protected content |
| allowedRoles | string[] | Allowed user roles |

---

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state and user info |
| `useSettings` | User settings state and persistence |
| `useDemoModeContext` | Demo mode state and simulated buoys |
| `useBuoyFollow` | Buoy follow system for mark movements |
| `useBuoys` | Buoy data fetching |
| `useMarks` | Mark data fetching |
| `useCourses` | Course data fetching |
| `useEvents` | Event data fetching |
| `useWeatherData` | Weather data fetching |
| `useBuoyCommand` | Buoy command mutations |
| `useUpdateMark` | Mark update mutations |
| `useCreateMark` | Mark creation mutations |
| `useDeleteMark` | Mark deletion mutations |
| `useSaveCourseSnapshot` | Course snapshot creation |
| `useBoatClasses` | Boat class data fetching |
| `useSailClubs` | Sail club data fetching |

---

## Services

| Service | Purpose |
|---------|---------|
| `settings-service.ts` | User settings CRUD operations |
| `course-service.ts` | Course calculations and transformations |
| `buoy-service.ts` | Buoy operations and state management |
| `weather-service.ts` | Weather data fetching and processing |

---

## Utility Libraries

| Library | Purpose |
|---------|---------|
| `course-bearings.ts` | Wind angle calculations, bearing math |
| `race-time-estimation.ts` | VMG-based race time calculations |
| `shape-templates.ts` | Course shape templates (Triangle, Trapezoid) |
| `course-thumbnail.ts` | SVG thumbnail generation |
| `batchedMutations.ts` | Batched API operations |
| `queryClient.ts` | TanStack Query configuration |

---

## UI Components (Shadcn)

47 pre-built components from Shadcn/ui:

`accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `form`, `hover-card`, `input`, `input-otp`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `toggle-group`, `tooltip`

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Users
- `GET /api/users` - List users (admin/manager)
- `POST /api/users` - Create user
- `DELETE /api/users/:id` - Delete user
- `POST /api/users/:id/events` - Grant event access
- `DELETE /api/users/:id/events/:eventId` - Revoke event access

### Sail Clubs
- `GET /api/sail-clubs` - List clubs
- `POST /api/sail-clubs` - Create club (super_admin)
- `PATCH /api/sail-clubs/:id` - Update club
- `DELETE /api/sail-clubs/:id` - Delete club

### Events
- `GET /api/events` - List events (role-filtered)
- `GET /api/events/:id` - Get event
- `POST /api/events` - Create event
- `PATCH /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Courses
- `GET /api/courses` - List courses
- `GET /api/courses/:id` - Get course
- `POST /api/courses` - Create course
- `PATCH /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Marks
- `GET /api/courses/:courseId/marks` - Get marks
- `POST /api/marks` - Create mark
- `PATCH /api/marks/:id` - Update mark
- `DELETE /api/marks/:id` - Delete mark
- `DELETE /api/courses/:courseId/marks` - Delete all marks

### Buoys
- `GET /api/buoys` - List all buoys
- `GET /api/events/:eventId/buoys` - Get event buoys
- `POST /api/buoys` - Create buoy (admin)
- `PATCH /api/buoys/:id` - Update buoy
- `DELETE /api/buoys/:id` - Delete buoy (super_admin)
- `POST /api/buoys/:id/command` - Send buoy command
- `POST /api/buoys/:id/assign-event` - Assign to event
- `POST /api/buoys/:id/release-event` - Release from event

### Course Snapshots
- `GET /api/course-snapshots` - List snapshots
- `POST /api/course-snapshots` - Create snapshot
- `GET /api/course-snapshots/:id` - Get snapshot
- `DELETE /api/course-snapshots/:id` - Delete snapshot

### Settings
- `GET /api/settings` - Get user settings
- `PATCH /api/settings` - Update settings

### Weather
- `GET /api/weather` - Get weather data
- `GET /api/weather/location` - Get weather by coordinates

---

## Authentication & Authorization

- **Session-based authentication** using PostgreSQL session store
- **3 user roles**: super_admin > club_manager > event_manager
- **Middleware**: `requireAuth`, `requireRole()`, `requireEventAccess`, `requireCourseAccess`

---

## Performance Optimizations

1. **Lazy Loading**: LeafletMap uses React.lazy() with Suspense
2. **Parallel Data Fetching**: Independent storage calls use Promise.all()
3. **React Query Caching**: Automatic request deduplication and caching
4. **Optimistic Updates**: UI updates before server confirmation
5. **Polling**: Real-time updates via configurable polling intervals

---

## PWA Features

- Tablet-first design (landscape orientation)
- Touch-optimized (56px minimum touch targets)
- Maritime theme with professional color scheme
- Offline-capable (service worker ready)
