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

### January 17, 2026
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
