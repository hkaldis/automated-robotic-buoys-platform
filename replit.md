# Automated Robotic Buoys Platform

## Overview

This project is a tablet-first web application designed to manage automated robotic buoys for sailing races and training events. It enables Race Officers to create, modify, and manage race courses in real-time, offering capabilities such as real-time buoy monitoring, various course layout creations (triangle, trapezoid, windward-leeward, custom), weather data integration, interactive map visualization, and unit conversion. The platform aims to enhance the efficiency and fairness of sailing competitions through a robust and intuitive system.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React 18 and TypeScript, using Wouter for routing and TanStack React Query v5 for server state management. UI components are developed with Shadcn/ui (based on Radix UI primitives) and styled using Tailwind CSS, featuring a maritime-themed design. Vite is used as the build tool. The application is optimized for landscape orientation on tablets and is installable as a Progressive Web App (PWA) for a native-like experience.

### Backend
The backend utilizes Node.js with Express 5 and TypeScript. It provides RESTful JSON endpoints and uses PostgreSQL with Drizzle ORM for data persistence. Zod with drizzle-zod is employed for type-safe schema validation. Authentication is session-based with bcrypt password hashing and role-based access control.

### Data Flow and State Management
React Query manages all application data, handling fetching, mutations, and cache invalidation. Real-time updates are achieved through polling mechanisms. The system includes cross-entity cache coordination, isolated demo mode, exponential backoff retry logic, and optimistic updates for immediate UI feedback. A transaction pattern is used for complex operations like auto-assignment of buoys.

### Core Features and Workflow
The application supports a structured course creation process via a 6-phase `SetupPanel`: setting start and finish lines, adding course marks (including conversion to gates), defining the rounding sequence, reviewing course summaries, and assigning buoys.
- **Gates Support**: Course marks can be converted to wind-responsive gates with configurable width, requiring dual buoy assignment.
- **Course Transformation**: Tools are available to scale, rotate, and move the entire course.
- **Auto-Assign Buoys**: A greedy optimization algorithm automatically assigns the closest available buoys to unassigned marks.
- **Buoy GoTo Commands**: The `MarkEditPanel` provides multiple ways to command assigned buoys, including sending to mark position, tap-to-go, directional nudges, and coordinate input.
- **Demo Mode**: A client-side demo mode simulates buoy behavior for testing and demonstration purposes.

### UI/UX
The design prioritizes a tablet-first approach with large, touch-friendly controls (minimum 48px touch targets), a visual progress stepper, and maritime-themed aesthetics. Role-specific mark visualizations and adherence to World Sailing standards for course geometry enhance usability.

## External Dependencies

### UI Frameworks & Libraries
- **Radix UI**: Headless component primitives.
- **Shadcn/ui**: Pre-styled component collection.
- **Lucide React**: Icon library.

### Frontend Libraries
- **TanStack React Query v5**: Server state management and caching.
- **React Hook Form**: Form handling with Zod resolver.
- **class-variance-authority**: Flexible component styling.

### Backend Libraries
- **Express 5**: HTTP server framework.
- **Zod**: Runtime type validation.

### Development Tools
- **Vite**: Frontend build tool and development server.
- **tsx**: TypeScript execution for development.

## Recent Changes (January 2026)

### Bug Fixes
1. **Fixed "Random Marks Appearing" Issue**: When creating new events or clearing courses, marks from other courses no longer appear unexpectedly. The fix ensures:
   - `activeCourseId` must be explicitly set (no fallback to first course in list)
   - `useMarks` hook is disabled when no course is selected (returns empty array)
   - Course ID is set immediately when creating a new race (before creating marks)
   - Query cache is properly cleared when switching courses

2. **Fixed Finish Line Mark Creation**: Finish line marks now correctly use role="finish" instead of "pin" which was causing validation errors.

3. **Fixed Course Mark to Finish Line Conversion**: Turning point marks can now be properly converted to finish line marks, and deselecting a finish line mark correctly reverts its role to "turning_mark".

4. **Fixed Mark Placement Not Working**: When clicking "Pin End (Port)" or other mark buttons, marks can now be placed on the map. The fix ensures:
   - `activeCourseId` is auto-initialized from the first available course when no event course exists
   - Helpful error message shown if somehow no course is available when placing marks
   - Maintains the "random marks" fix by still requiring explicit course ID for fetching marks

### Key Implementation Details
- `RaceControl.tsx` uses `activeCourseId` state variable to track explicitly selected course
- When `activeCourseId` is null/undefined, no marks are fetched (prevents showing wrong course's marks)
- `useEffect` initializes `activeCourseId` from: 1) event's courseId, 2) first available course if no event course

### Auto-Adjust Course to Wind Feature
The Auto-Adjust feature (in `client/src/lib/course-bearings.ts` and `AutoAdjustDialog.tsx`) calculates optimal mark positions based on wind direction using sequential leg-based calculation:

1. **Sequential Bearing Calculation**: Each mark's optimal bearing is calculated based on the line from the PREVIOUS mark to the current mark, compared to wind direction
2. **Start Line Reference**: First mark uses start line center as reference point (requires start line to be defined)
3. **Micro-Adjustment**: If bearing delta ≤ 7°, applies only 30% correction to prevent dramatic movement when close to optimal
4. **Validation**: Blocks apply if:
   - No start line defined
   - Missing order values on any mark
   - Duplicate order values
   - Missing gateSide on gate marks
5. **Gate Handling**: Gates use isGate and gateSide metadata from marks table

### MarkEditPanel State Sync (January 2026)
The MarkEditPanel uses a dirty-flag pattern to prevent external updates from overwriting active user edits:

1. **Dirty Field Tracking**: A `dirtyFieldsRef` Set tracks which fields the user has edited
2. **Dirty Setters**: All user-facing inputs use wrapper functions (e.g., `setNameDirty`) that mark the field as dirty before updating state
3. **External Sync**: When mark data changes externally (polling, map drag), only non-dirty fields are updated
4. **Cascading Effects**: When user toggles isGate, dependent fields (role, assignedBuoyId) are also marked dirty
5. **Dirty Reset**: On mark selection change, dirty flags are cleared; on save, dirty flags are cleared (simplicity choice)

### Server-Side Validation (January 2026)
Backend validation in `server/validation.ts` and `server/routes.ts`:

1. **Gate Side Required**: When `isGate=true`, the `gateSide` field must be either "port" or "starboard"
2. **No Duplicate Buoy on Same Mark**: Same buoy ID cannot be assigned to both port and starboard roles on the same gate
3. **Order Uniqueness**: Mark order values must be unique within a course (excluding null values)