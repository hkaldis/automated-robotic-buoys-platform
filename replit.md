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

### Auto-Adjust Course to Wind Feature (Updated January 2026)
The Auto-Adjust feature now uses a step-by-step wizard approach (`client/src/components/AutoAdjustWizard.tsx`) for adjusting mark positions based on wind direction:

1. **Wizard Flow**: Sequential steps through the entire course:
   - Step 1: Adjust start line perpendicular to wind
   - Steps 2+: Adjust each unique mark in rounding sequence order
   - Final: Summary with Finish button

2. **Role-Based Defaults**: Each mark role has a configurable default angle (from Settings):
   - Windward: 0° (directly upwind)
   - Leeward: 180° (directly downwind)
   - Wing: -120° (broad reach, opposite side)
   - Offset: 10° (slight offset from upwind)
   - Unknown roles: User is prompted to enter degrees

3. **Sequential Chaining**: Uses local positions map to ensure each mark adjustment references the latest coordinates from previous steps (not stale parent state)

4. **Skip Option**: Any step can be skipped without adjustment

5. **Undo All**: On completion, stores original positions for 60-second undo window

6. **Implementation Details**:
   - `adjustSingleMarkToWind()`: Core calculation function in course-bearings.ts
   - `localPositions` Map: Tracks updated positions for sequential chaining
   - `useEffect`: Initializes degrees input when step changes

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

### Race Time Estimation Feature (January 2026)
VMG-based race time estimation using sailing physics and boat class performance data:

1. **Boat Classes Database**: 20 common sailing classes with performance data:
   - `lengthMeters`: Hull length in meters (used for boat-length calculations)
   - VMG (Velocity Made Good) at light/medium/heavy wind conditions
   - Reach speeds at different wind bands
   - Optimal upwind and downwind true wind angles (TWA)
   - Tack, jibe, and mark rounding times
   - Hull type and no-go zone angle

2. **Physics Calculation** (`client/src/lib/race-time-estimation.ts`):
   - Calculates true wind angle (TWA) for each leg based on bearing vs wind direction
   - Determines point of sail (upwind, close reach, beam reach, broad reach, downwind)
   - For upwind/downwind: sailingDistance = straightLineDistance / cos(optimalTWA) to account for tacking/jibing
   - Time = sailingDistance / boatSpeed (not VMG, since distance already inflated)
   - Adds maneuver penalties (tack/jibe times based on leg length)
   - Adds mark rounding time for each leg

3. **UI Display** (SetupPanel review phase):
   - Per-leg estimates with point-of-sail color coding (red=upwind, green=reach, blue=downwind)
   - Total estimated race time shown with "(VMG)" indicator when using physics-based calculation
   - Falls back to simple estimate (distance/4.5kts) if no boat class selected
   - **Boat class selector** in Review phase for quick at-sea changes (defaults to event's class)
   - **Start/Finish line in boat lengths**: Displays line length in meters and boat lengths
   - **Start line crossing time**: Time to sail from committee boat to pin using VMG physics

4. **API Endpoints**:
   - GET /api/boat-classes - List all boat classes
   - GET /api/boat-classes/:id - Get single boat class by ID

### Wind Angle Calculation Unification (January 2026)
Centralized wind angle calculation in `client/src/lib/course-bearings.ts`:

1. **`calculateWindAngle(legBearing, windDirection)`**: Returns both:
   - `signedRelative`: -180 to +180° (for display, "+X° to wind")
   - `absoluteTwa`: 0-180° (True Wind Angle for physics calculations)

2. **`formatWindRelative(signedRelative)`**: Formats as "+X° to wind" or "-X° to wind"

3. **Used consistently across**:
   - Map leg labels (LeafletMap.tsx)
   - SetupPanel route legs display
   - Race time estimation physics (race-time-estimation.ts)

4. **Boat Class Database Integration**:
   - Events store both `boatClass` (name for display) and `boatClassId` (database reference)
   - CreateRaceDialog, ClubDashboard, AdminDashboard use `useBoatClasses()` hook
   - Dropdown selection from 20 boat classes in database

### Start Line Adjustment Controls (January 2026)
Simple touch-friendly controls for adjusting start line at sea:

1. **Resize Controls** (SetupPanel Start phase):
   - Line length display in meters
   - Grow (+) and shrink (-) buttons: Scale line by 10% per click
   - Mode setting: Move both marks (default), move pin only, or move committee boat only

2. **Fix Bearing to Wind** (SetupPanel Start phase):
   - One-tap button to rotate line perpendicular to current wind direction
   - Uses geodesic destination-point formula (Haversine) for accurate positioning
   - Preserves line length during rotation
   - Mode setting: Move pin (default) or move committee boat

3. **Settings** (SettingsDialog, localStorage-persisted):
   - `startLineResizeMode`: "both" | "pin" | "committee_boat" (default: "both")
   - `startLineFixBearingMode`: "pin" | "committee_boat" (default: "pin")
   - Persisted via localStorage for device-specific preferences

4. **Implementation Details**:
   - `calculateStartLineLength()`: Haversine distance in meters
   - `calculateStartLineBearing()`: Bearing from pin to committee boat
   - `handleResizeStartLine()`: Scales from center (both) or fixed mark (pin/cb)
   - `handleFixBearing()`: Geodesic destination-point calculation for spherical accuracy

### Adjust Individual Mark to Wind Feature (January 2026)
Single-mark wind adjustment for fine-tuning mark positions at sea:

1. **Location**: MarkEditPanel "Adjust to Wind" section (visible for non-start/finish marks)

2. **Role-Based Default Angles** (configurable in Settings):
   - Windward: 0° (directly upwind from reference)
   - Leeward: 180° (directly downwind from reference)
   - Wing: -120° (broad reach angle, opposite side)
   - Offset: 10° (slight offset from upwind)
   - Turning Mark: 0° (same as windward)
   - Other: 0° (fallback default)

3. **Reference Point Selection**:
   - Uses the FIRST appearance of the mark in the rounding sequence
   - Previous mark in sequence becomes the reference point for bearing calculation
   - Requirement: Mark must be in the rounding sequence (not just on the course)

4. **Adjustment Calculation** (`adjustSingleMarkToWind` in course-bearings.ts):
   - Calculates distance from reference mark to current mark
   - Computes new bearing as windDirection + degreesToWind
   - Uses geodesic destination-point formula for accurate positioning

5. **UI/UX**:
   - Degrees input with role-based default pre-filled
   - "Adjust to Wind" button (disabled with reason if mark not in route or no wind data)
   - Undo button (60-second window) to restore previous position
   - Settings panel for customizing default angles per role with "Reset to Defaults" button

6. **Settings Persistence**:
   - Wind angle defaults stored in localStorage via settings-service.ts
   - Device-specific preferences (suitable for at-sea tablet use)