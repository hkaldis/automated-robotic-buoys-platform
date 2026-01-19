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
- `TopBar`: Displays event name, wind indicator, fullscreen toggle, and settings access.
- `MapView`: Leaflet-based map with OpenSeaMap overlay for interactive course management.
- `SetupPanel`: A 4-step wizard guiding users through course setup: Add Marks, Select Start Line, Select Finish Line, and Assign Buoys.
- `BuoyCard` and `BuoyDetailPanel`: For displaying and controlling buoy status and commands.
- `MarkEditPanel`: For editing mark details.
- `SettingsDialog`: For configuring units and wind source.
- `WindIndicator`: Visual compass for wind direction.

### Setup Workflow Phases
The `SetupPanel` orchestrates a 6-phase course creation process:
1.  **Set Start Line**: Placing Pin End (Port) and Committee Boat (Starboard) marks using dedicated buttons.
2.  **Add Course Marks**: Adding course marks (M1, M2, M3, etc.) to define the racing route. Marks can be converted to Gates.
3.  **Set Finish Line**: Selecting any 2 marks for the finish line, with flexibility to reuse start line marks. During selection, a dashed red preview line appears on the map between selected marks before confirmation.
4.  **Set Route (Sequence)**: Defining the rounding sequence - the order in which sailors round each mark. Supports custom sequences where marks can be passed multiple times (e.g., windward-leeward courses).
5.  **Course Summary (Review)**: Displays course statistics (total distance, estimated race time, line lengths), leg-by-leg breakdown, and provides course transformation tools.
6.  **Assign Buoys**: Assigning physical robotic buoys to each mark. Gates require 2 buoys (Port and Starboard).

The system ensures robust state management, auto-correcting the phase based on data changes and preventing invalid progress. Phase gating requires completing start line before adding course marks, and course marks before setting finish line. Large, touch-friendly controls (48px minimum) are integrated for tablet use.

### Auto-Assign Buoys
The Assign Buoys phase includes an "Auto" button that uses a greedy optimization algorithm to automatically assign the closest available buoys to all unassigned marks. The algorithm minimizes maximum deployment time by:
- Sorting marks by difficulty (hardest-to-reach first)
- Assigning the closest available buoy to each mark/gate slot
- Dispatching all buoys to their target positions

### Fullscreen Mode
A fullscreen toggle button in the TopBar allows the app to enter browser fullscreen mode, hiding the browser chrome for an immersive tablet experience. Users can exit with the Escape key or by clicking the button again.

### Progressive Web App (PWA)
The application is installable as a PWA:
- **manifest.json**: Defines app name, icons, theme colors, and standalone display mode
- **Service Worker**: Provides basic offline support
- **Apple Web App Tags**: Optimized for iOS Safari "Add to Home Screen"
When installed, the app opens in standalone mode without browser UI, providing a native app-like experience on tablets.

### Sailing Gates Support
Course marks can be converted to Gates (leeward gates) via the MarkEditPanel:
- **Gate Toggle**: Enable gate mode for any course mark
- **Gate Width**: Configurable in boat lengths (default 8, recommended 8-10 for safe racing)
- **Boat Length**: Configurable in meters (default 6m) for accurate gate width calculation
- **Gate Visualization**: Two connected markers perpendicular to wind direction, with a dashed orange line between them
- **Dual Buoy Assignment**: Gates require 2 buoys - Port (red) and Starboard (green) positioned on opposite sides
- **Wind-Responsive Positioning**: Gate markers automatically orient perpendicular to current wind direction

Gate schema fields: `isGate`, `gateWidthBoatLengths`, `boatLengthMeters`, `gatePortBuoyId`, `gateStarboardBuoyId`

### Course Transformation Features
The Summary phase provides tools to adjust the entire course layout:
- **Scale**: Enlarge (1.1x) or reduce (0.9x) the course size relative to its center
- **Rotate**: Rotate the course by 15° increments
- **Move**: Directional pad (N/S/E/W) to translate the entire course

### Save/Load Course
Courses can be saved with custom names for later reuse. The Save Course dialog allows naming and persisting course configurations, while Load Course displays available saved courses for selection.

### Course Rounding Sequence
The sequence step allows defining a custom rounding order:
- **Waypoint Types**: "start" (start line center), mark IDs (course marks), "finish" (finish line center)
- **Flexible Routing**: Same mark can appear multiple times (e.g., M1 → M2 → M1 for windward-leeward)
- **Auto-Generate**: Simple sequential route can be auto-generated (Start → M1 → M2 → ... → Finish)
- **Undo/Clear**: Easy sequence editing with undo last and clear all functions
- **Minimum Requirement**: Sequence needs at least 3 entries (start + 1 mark + finish)

### Distance/Bearing Calculations
Course distances and bearings are calculated based on the rounding sequence:
- **Sequence-Based**: Distance is calculated leg-by-leg following the defined route
- **Leg Breakdown**: Each leg (e.g., Start→M1, M1→M2, M2→Finish) shows individual distance
- **Line Centers**: Start and finish entries use the center of their respective lines

This provides accurate course length calculations that reflect the actual sailing path through the defined sequence.

### Backend Architecture
- **Runtime**: Node.js with Express 5.
- **Language**: TypeScript.
- **API Style**: RESTful JSON endpoints.
- **Storage**: PostgreSQL database with Drizzle ORM (`DatabaseStorage` class) for production persistence. All data persists across server restarts.
- **Schema Validation**: Zod with drizzle-zod for type-safe schema definitions.
- **Authentication**: Session-based auth with bcrypt password hashing and role-based access control (RBAC).

### Demo Mode
For testing and demonstration, a client-side demo mode provides 7 simulated buoys (Alpha through Golf):
- Demo buoys have IDs prefixed with "demo-" (e.g., demo-1, demo-2)
- Commands (move, hold, cancel) are handled client-side via the `useDemoMode` hook
- Demo buoys simulate realistic GPS movement toward targets at ~3.25 knots
- The `useBuoyCommand` hook automatically routes demo buoy commands to client-side handlers

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