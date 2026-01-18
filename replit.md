# Automated Robotic Buoys Platform

## Overview

This is a maritime control system designed for managing automated robotic buoys during sailing races and training events. The platform allows Race Officers to create, modify, and manage race courses in real-time using robotic marker buoys. It is a tablet-first web application, optimized for landscape orientation.

Key capabilities include:
- Real-time monitoring of buoy positioning and telemetry.
- Creation of various course layouts (triangle, trapezoid, windward-leeward, custom).
- Integration of weather data from multiple sources.
- Interactive map visualization with course marks and buoy positions.
- Unit conversion for distance and speed.
- Persistence of user settings via a backend API.

The project aims to provide a robust and intuitive system for modern race management, enhancing the efficiency and fairness of sailing competitions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Data Flow
The system utilizes React Query as the central data layer for all application data (buoys, courses, marks, events, weather, settings). Data is fetched from the backend via React Query hooks, and mutations update the backend while invalidating the cache for automatic refetching. Real-time updates are handled by polling mechanisms (e.g., buoys every 5 seconds, weather every 10 seconds).

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **State Management**: TanStack React Query v5 for server state.
- **UI Components**: Shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with custom maritime-themed design.
- **Build Tool**: Vite.

### API Hooks
Custom React Query hooks manage all data interactions, including fetching buoys, courses, marks, events, weather, user settings, and sending commands to buoys (move, hold, cancel).

### Settings Hook
A dedicated hook handles unit formatting and settings management, providing functions to format distance, speed, and bearing according to user preferences, and to update these settings.

### Components
Key UI components include:
- `TopBar`: Displays event name, wind indicator, and settings access.
- `MapView`: Leaflet-based map with OpenSeaMap overlay for interactive course management.
- `SetupPanel`: A 4-step wizard guiding users through course setup: Add Marks, Select Start Line, Select Finish Line, and Assign Buoys.
- `BuoyCard` and `BuoyDetailPanel`: For displaying and controlling buoy status and commands.
- `MarkEditPanel`: For editing mark details.
- `SettingsDialog`: For configuring units and wind source.
- `WindIndicator`: Visual compass for wind direction.

### Setup Workflow Phases
The `SetupPanel` orchestrates a 4-phase course creation process:
1.  **Set Start Line**: Placing Pin End (Port) and Committee Boat (Starboard) marks using dedicated buttons.
2.  **Add Course Marks**: Adding course marks (M1, M2, M3, etc.) to define the racing route.
3.  **Set Finish Line**: Selecting any 2 marks for the finish line, with flexibility to reuse start line marks (e.g., Pin End + Committee Boat for same start/finish).
4.  **Assign Buoys**: Assigning physical robotic buoys to each mark.

The system ensures robust state management, auto-correcting the phase based on data changes and preventing invalid progress. Phase gating requires completing start line before adding course marks, and course marks before setting finish line. Large, touch-friendly controls (48px minimum) are integrated for tablet use.

### Distance/Bearing Calculations
Course distances and bearings are calculated using line centers:
- Start leg: From center of start line (average of Pin End + Committee Boat positions) to M1
- Course legs: Between consecutive course marks (M1→M2, M2→M3, etc.)
- Finish leg: From last course mark to center of finish line

This provides accurate course length calculations that reflect the actual sailing path.

### Backend Architecture
- **Runtime**: Node.js with Express 5.
- **Language**: TypeScript.
- **API Style**: RESTful JSON endpoints.
- **Storage**: In-memory storage (`MemStorage` class) for the MVP, with Drizzle ORM configured for PostgreSQL for future persistence.
- **Schema Validation**: Zod with drizzle-zod for type-safe schema definitions.

### API Endpoints
A comprehensive set of RESTful API endpoints exists for managing sail clubs, events, courses, buoys, weather data, and user settings. Endpoints support CRUD operations and specific actions like sending commands to buoys.

### Shared Code
A `shared/schema.ts` file defines common TypeScript types and Zod schemas for entities (Buoy, Course, Mark, Event, SailClub, UserSettings), enums (BuoyState, CourseShape, MarkRole, EventType, DistanceUnit, SpeedUnit, WindSource), and GeoPosition interface.

### UI/UX Decisions
The application prioritizes a tablet-first approach with a clear, maritime-themed design. Features like a visual progress stepper, large touch-friendly controls (minimum 48px touch targets), and role-specific mark visualizations (colors and shapes on the map) enhance usability. Course geometry adheres to World Sailing standards, including predefined shapes and specific mark naming conventions. "Align to Wind" logic correctly aligns the start line perpendicular to the wind.

## External Dependencies

### UI Framework
- **Radix UI**: Headless component primitives for accessibility.
- **Shadcn/ui**: Pre-styled component collection for consistent UI.
- **Lucide React**: Icon library.

### Frontend Libraries
- **TanStack React Query v5**: For server state management and caching.
- **React Hook Form**: For robust form handling with Zod resolver.
- **class-variance-authority**: For flexible component variant styling.

### Backend Libraries
- **Express 5**: HTTP server framework.
- **Zod**: Runtime type validation.

### Development Tools
- **Vite**: Frontend build tool and development server.
- **tsx**: TypeScript execution for development workflows.