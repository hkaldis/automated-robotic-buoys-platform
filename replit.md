# Automated Robotic Buoys Platform

## Overview

This is a maritime control system for managing automated robotic buoys during sailing races and training events. The platform enables Race Officers to set up, modify, and manage race courses in real-time using robotic marker buoys. It's designed as a tablet-first web application optimized for landscape orientation (1024x768 to 1920x1080).

The system provides:
- Real-time buoy positioning and telemetry monitoring
- Course layout creation with various shapes (triangle, trapezoid, windward-leeward, custom)
- Weather data integration from multiple sources (buoy sensors, API, manual input)
- Interactive canvas-based map visualization with course marks and buoy positions
- Unit conversion for distance (nautical miles, meters, km) and speed (knots, m/s, km/h, mph, Beaufort)
- Settings persistence with backend API

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Data Flow
**Single Source of Truth**: React Query serves as the central data layer.
1. All data (buoys, courses, marks, events, weather, settings) is fetched from the backend via React Query hooks
2. Components receive data as props from the main RaceControl page
3. Mutations update the backend and invalidate cache for automatic refetch
4. Real-time updates: buoys refetch every 5 seconds, weather every 10 seconds

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query v5 for all server state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom maritime-themed design tokens
- **Build Tool**: Vite with React plugin

### API Hooks (`client/src/hooks/use-api.ts`)
Custom React Query hooks for all entities:
- `useBuoys()` - Fetch all buoys with 5s polling
- `useCourses()`, `useMarks()` - Course and mark data
- `useEvents()` - Event management
- `useWeatherData()` - Weather with 10s polling
- `useUserSettings()`, `useUpdateUserSettings()` - Settings CRUD
- `useBuoyCommand()` - Send commands to buoys (move, hold, cancel)

### Settings Hook (`client/src/hooks/use-settings.ts`)
Provides unit formatting and settings management:
- `formatDistance(nm)` - Formats nautical miles to configured unit
- `formatSpeed(knots)` - Formats knots to configured unit (including Beaufort scale)
- `formatBearing(degrees)` - Formats bearing in degrees
- `setDistanceUnit()`, `setSpeedUnit()` - Updates settings via API mutation

### Components
Key UI components in `client/src/components/`:
- `TopBar` - Event name, wind indicator, settings button
- `MapView` - Canvas-based map with Web Mercator projection
- `SidePanel` - Event info, wind indicator, course shapes, marks list, buoys list
- `BuoyCard` - Compact buoy status display
- `BuoyDetailPanel` - Full buoy details with command controls
- `CourseShapeSelector` - Select triangle, trapezoid, windward/leeward, custom
- `MarksList` - List of course marks with assigned buoys
- `SettingsDialog` - Configure units and wind source
- `AlertBanner` - Course validity alerts
- `WindIndicator` - Visual compass with wind direction

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript compiled with tsx
- **API Style**: RESTful JSON endpoints under `/api/*`
- **Storage**: In-memory storage (MemStorage class) - acceptable for MVP

### API Endpoints
```
GET    /api/sail-clubs           - List sail clubs
GET    /api/events               - List events
GET    /api/events/:id           - Get single event
GET    /api/courses              - List courses
GET    /api/courses/:id          - Get single course
GET    /api/courses/:id/marks    - Get marks for a course
GET    /api/buoys                - List all buoys
GET    /api/buoys/:id            - Get single buoy
PATCH  /api/buoys/:id            - Update buoy
POST   /api/buoys/:id/command    - Send command (move_to_target, hold_position, cancel)
GET    /api/weather              - Get aggregated weather from buoys
GET    /api/settings             - Get user settings
PATCH  /api/settings             - Update user settings
```

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect (configured but using in-memory for MVP)
- **Schema Validation**: Zod with drizzle-zod for type-safe schema definitions
- **Storage**: In-memory storage with seeded mock data

### Shared Code
The `shared/schema.ts` contains TypeScript types and Zod schemas:
- Entity types: Buoy, Course, Mark, Event, SailClub, UserSettings
- Enums: BuoyState, CourseShape, MarkRole, EventType, DistanceUnit, SpeedUnit, WindSource
- Insert schemas for validation
- GeoPosition interface for coordinates

## External Dependencies

### UI Framework
- **Radix UI**: Headless component primitives for accessibility
- **Shadcn/ui**: Pre-styled component collection
- **Lucide React**: Icon library

### Frontend Libraries
- **TanStack React Query v5**: Server state and caching
- **React Hook Form**: Form handling with Zod resolver
- **class-variance-authority**: Component variant styling

### Backend Libraries
- **Express 5**: HTTP server framework
- **Zod**: Runtime type validation

### Development Tools
- **Vite**: Frontend build and dev server
- **tsx**: TypeScript execution for development

## Development Commands

```bash
npm run dev          # Start development server (port 5000)
npm run build        # Production build
npm run db:push      # Push database schema (when using PostgreSQL)
```

## Recent Changes

### January 18, 2026 (Latest)
- **Start/Finish Line Management**: Enhanced course configuration with dedicated line markers
  - Added `isStartLine` and `isFinishLine` boolean fields to Mark schema
  - Committee Boat and Pin marks automatically assigned as both start AND finish lines (standard racing)
  - Toggle switches in MarkEditPanel for manual start/finish line assignment
  - Visual S/F badges in MarksList showing which marks form start/finish lines
  - Deploy Course button disabled until start/finish lines are properly defined
  - Validation alert in CourseStats when lines are missing
  
- **Line Setup Workflow**: New dedicated mode for selecting start/finish line marks
  - "Set Start Line" and "Set Finish Line" buttons in Start/Finish Lines card
  - Line setup mode shows list of marks with checkboxes for selection
  - Minimum 2 marks required per line with validation message
  - Done button persists selections, Cancel exits without saving
  - Marks remain editable during line setup (click mark name to edit)
  - Course shape selector now persists shape changes to backend
  - Custom courses default to "Custom" shape (not Triangle)

- **Course Statistics Component**: New CourseStats card showing race metrics
  - Total course distance calculated using Haversine formula (in nautical miles)
  - Estimated race time based on boat class average speeds
  - Comparison with target duration showing +/- minutes
  - Start/Finish line status indicators

- **World Sailing Standards Compliance**: Complete overhaul of course geometry and mark naming
  - Added "wing" mark role for Mark 2 (wing/gybe marks in triangle/trapezoid courses)
  - Updated mark naming to World Sailing conventions: Mark 1 (Windward), Mark 2 (Wing), Mark 3 (Leeward)
  - Gate marks now named "Mark 3s (Gate Starboard)" and "Mark 3p (Gate Port)"
  - Committee Boat at STARBOARD end of start line, Pin Mark at PORT end
  - Course shapes use World Sailing codes: Triangle (T), Trapezoid (O), Windward-Leeward (L)
  
- **Corrected Course Geometry**:
  - Triangle: True equilateral 60° angles, wing mark at sin(60°) offset to starboard
  - Trapezoid: 60° reaching legs, proper offset mark placement near windward
  - Windward-Leeward: Gate at leeward end (same latitude as start line)
  - All courses use PORT rounding (counter-clockwise sailing direction)
  
- **Mark Visual Improvements**: Role-specific colors and shapes on map
  - Windward/Wing marks: Diamond shape (red/purple)
  - Gate/Leeward marks: Circle shape (cyan/blue)
  - Start line marks: Triangle shape (green)
  
- **Fixed "Align to Wind" Logic**: Calculates start line bearing from Committee Boat → Pin Mark, rotates course so start line is perpendicular (90°) to wind direction
- **Fixed Marker Click Conflicts**: Added zIndexOffset to buoy markers ensuring they render above mark markers
- **Fixed Marks Display After Race Creation**: Added `activeCourseId` and `activeEventId` state tracking

### January 17, 2026
- **Extended Mark Roles**: Added windward, leeward, gate, offset, wing, other roles to schema
- **Bulk Mark Delete**: Added DELETE /api/courses/:id/marks endpoint to clear all marks from a course
- **Predefined Shape Marks**: New race creation generates marks based on selected shape:
  - Triangle (T): 5 marks (Committee Boat, Pin, Windward, Wing, Leeward)
  - Trapezoid (O): 7 marks (Committee Boat, Pin, Windward, Offset, Wing, Gate Starboard, Gate Port)
  - Windward-Leeward (L): 5 marks (Committee Boat, Pin, Windward, Gate Starboard, Gate Port)
  - Custom: 0 marks (user clicks on map to add)
- **Race Creation Flow**: Creating a new race clears existing marks, creates course/event, then generates shape marks

- **Leaflet + OpenSeaMap Integration**: Replaced canvas-based map with real GPS mapping
  - OpenStreetMap base layer with OpenSeaMap nautical overlay (0.8 opacity)
  - Custom markers for buoys (colored circles with initials) and marks (triangles/circles)
  - Interactive zoom controls with reset view functionality
  - Click-to-place marks on map with coordinate display
  
- **Demo Mode**: Added simulation mode for testing without real buoys
  - 7 simulated buoys (Alpha through Golf) with realistic telemetry
  - Buoys move at 3-3.5 knots when deployed to target positions
  - Demo state persisted in localStorage
  - Toggle via "Demo" button in TopBar
  
- **Mark Management**: Full CRUD for course marks
  - MarkEditPanel: Edit name, role, position, and assigned buoy
  - AddMarkDialog: Create marks via map click or coordinate entry
  - Delete marks with confirmation dialog
  - Proper React Query cache invalidation for immediate UI updates
  
- **Race Creation Wizard**: 2-step dialog for creating new races
  - Step 1: Race details (name, type, boat class, target duration)
  - Step 2: Course setup (name, shape selection)
  - Creates both event and course in backend
  
- **Course Controls**: Transform entire course shape as a unit
  - Button-based scaling: "Smaller" (-20%) and "Larger" (+20%) buttons
  - Button-based rotation: "Left" (-15°) and "Right" (+15°) buttons
  - "Align to Wind" button: Auto-rotates starting line perpendicular to wind direction (90° offset per sailing race rules)
  - Move Course grid: Arrow buttons (up/down/left/right) to translate entire course
  - All marks transform together maintaining relative positions
  
- **Draggable Marks**: Marks can be repositioned directly on the map via drag-and-drop
  - Immediate position updates on drag end
  - Mark edit panel shows updated coordinates

- **Geolocation**: "Use My Location" button centers map on user's GPS position

- **Demo Location**: Changed default to Mikrolimano, Greece (37.9376, 23.6917)
  - Marina near Athens/Piraeus, suitable for sailing demonstrations
  - All 7 demo buoys positioned around this harbor

- **React Query Integration**: Migrated from mock data to full backend integration
  - All data now fetched from API endpoints
  - Settings persist via /api/settings endpoints
  - Real-time polling for buoys and weather
- **Single Source of Truth**: React Query cache is the single source of truth
  - Components receive data via props from RaceControl
  - Mutations invalidate cache for automatic refetch
- **Settings API**: Added backend persistence for user preferences
  - GET/PATCH /api/settings endpoints
  - In-memory storage for settings (MemStorage)
