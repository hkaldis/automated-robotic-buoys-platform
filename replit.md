# Automated Robotic Buoys Platform

## Overview

This project is a tablet-first web application designed for Race Officers to manage automated robotic buoys for sailing races and training events. It provides real-time buoy monitoring, various course layout creations (triangle, trapezoid, windward-leeward, custom), weather data integration, interactive map visualization, and unit conversion. The platform aims to enhance the efficiency and fairness of sailing competitions through a robust and intuitive system, streamlining race management and improving accuracy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18, TypeScript, Wouter for routing, and TanStack React Query v5 for server state management. UI components are built with Shadcn/ui (Radix UI) and styled with Tailwind CSS, featuring a maritime theme. It's optimized for landscape tablet orientation and is a PWA.

### Backend
The backend is built with Node.js, Express 5, and TypeScript. It offers RESTful JSON endpoints, uses PostgreSQL with Drizzle ORM for data, and Zod with drizzle-zod for type-safe schema validation. Authentication is session-based with bcrypt and role-based access control.

### Data Flow and State Management
React Query handles all application data, including fetching, mutations, and caching. Real-time updates use polling. Features include cross-entity cache coordination, an isolated demo mode, exponential backoff, and optimistic updates. A transaction pattern is used for complex operations.

### Core Features and Workflow
The application supports a 6-phase `SetupPanel` for course creation: setting start/finish lines, adding course marks (convertible to gates), defining rounding sequences, reviewing summaries, and assigning buoys.
- **Gates Support**: Marks can become wind-responsive gates with configurable width and dual buoy assignment.
- **Course Transformation**: Tools for scaling, rotating, and moving entire courses.
- **Auto-Assign Buoys**: A greedy algorithm assigns closest available buoys.
- **Buoy GoTo Commands**: `MarkEditPanel` enables commanding buoys via position, tap-to-go, nudges, and coordinates.
- **Demo Mode**: Client-side simulation of buoy behavior.
- **Auto-Adjust Course to Wind**: A wizard-based system to adjust mark positions relative to wind, with role-based default angles and sequential chaining.
- **MarkEditPanel State Sync**: Uses a dirty-flag pattern to prevent external updates from overwriting active user edits.
- **Race Time Estimation**: VMG-based estimation using sailing physics and a database of 20 boat classes, displayed per-leg and total in the UI. Includes start line crossing time.
- **Wind Angle Calculation**: Centralized calculation for signed relative and absolute true wind angles, used consistently across display and physics.
- **Start Line Adjustment Controls**: Touch-friendly controls for resizing and fixing the start line bearing to wind, with configurable modes.
- **Adjust Individual Mark to Wind**: Allows fine-tuning single mark positions relative to wind in the `MarkEditPanel`, using role-based default angles and a reference point from the rounding sequence.
- **Adjust to Shape**: Per-mark interior angle adjustment to create standard racing geometries (triangles, trapezoids). Shows current interior angle at each mark and allows setting target angles (30°, 45°, 60°, 70°, 90°, 120°) with touch-friendly preset buttons. Uses dense sweep algorithm to find optimal mark position while maintaining leg length. Requires rounding sequence definition (like "Adjust to Wind"). Shape templates defined in `shape-templates.ts` based on World Sailing/SetCourses.com standards. **Occurrence Context**: When a mark appears multiple times in the rounding sequence (e.g., windward-leeward courses), displays an occurrence badge ("1 of 2") and a sequence context line ("PrevMark → CurrentMark → NextMark") so users understand which turn angle is being adjusted.
- **Shape Template Quick Start**: In the Course Points phase (after setting start line), users can select predefined course shapes (Triangle 60-60-60, 45-90-45, 65-50-65, 70-40-70, or Trapezoid 45°/60°/70°) to auto-generate course marks positioned relative to wind direction. Templates require wind data to be available. Generated marks can be further adjusted using "Adjust to Shape" or drag-and-drop. Triangle geometry uses law of sines for proportional side lengths and exterior angle turns for precise mark positioning.
- **Fleet Status Dashboard**: Replaced the "Ready to Deploy" screen, providing a summary grid of buoy statuses (On Station, Moving, Fault, Low Batt), Course Setup ETA, and per-buoy status cards.
- **Buoy Follow System**: Hybrid approach with immediate buoy commands on mark movements plus continuous drift monitoring. Centralized `useBuoyFollow` hook handles all mark update paths (drag, nudge, adjust to wind, course transformation, undo). Configurable settings for distance threshold, poll interval, and debounce time stored in localStorage.
- **Course Snapshots & Templates**: Saved courses are immutable snapshots stored as complete JSON data (not references to live marks). Visibility scopes: global (super admin templates), club (club manager), user (event manager). Features include:
  - **Category metadata**: Triangle, Trapezoid, Windward-Leeward, or Other - required for super admin templates
  - **Auto-generated thumbnails**: SVG previews generated from mark positions when saving
  - **Optional descriptions**: For template documentation
  - **Enhanced Save Dialog**: Category selector with 56px touch-friendly buttons, live preview thumbnail
  - **Unified Quick Start**: Two-tab interface (Templates + My Courses) showing global templates organized by category, club courses, and user's saved courses with thumbnail previews and search
  - Rounding sequence saved with mark names (not IDs) for portability
- **Buoy Inventory Management**: Global buoy inventory system with ownership types (platform_owned, long_rental, event_rental) and status tracking (in_inventory, assigned_club, assigned_event, maintenance, retired). Buoys flow through lifecycle: inventory → club → event → back. Super admin manages global inventory via "Buoys" tab in Admin Dashboard. The `buoyAssignments` table tracks full assignment history with audit trail. API endpoints support assignment, release, and lifecycle transitions with role-based permissions.
- **Boat Tracking Integrations**: Display competing boats on the map via Vakaros and Tractrac tracking services. Configured in Settings Dialog "Integrations" section with per-service toggles and optional event IDs. In Demo Mode, simulates 10 boats (5 Vakaros blue, 5 Tractrac orange) with realistic sailing movement patterns. Boat markers show heading-oriented triangles with tooltips displaying sail number, speed (kts), and heading (degrees). Integration settings stored in `user_settings.integrations` (jsonb). Supports `showBoatTrails` and `boatRefreshRateSeconds` for future boat trail rendering.

### UI/UX
The design is tablet-first with large, touch-friendly controls (min 56px targets for critical actions), a visual progress stepper, and maritime-themed aesthetics. Role-specific mark visualizations and adherence to World Sailing standards for course geometry are key.

**Wet-Finger UX (Recent Improvements)**:
- **FloatingActionBar**: Always-visible action bar at bottom of map with 4 critical actions: Align to Wind, Deploy All, Hold All, Undo. All buttons are 56px touch targets for wet-finger operation at sea.
- **Deploy All**: One-tap deployment sends all assigned buoys to their mark positions, handling gates with port/starboard positioning.
- **Hold All**: Emergency stop for all moving/assigned buoys.
- **All Green Indicator**: Status display in FloatingActionBar shows buoy deployment progress ("X/Y On Station") and lights up green when all buoys reach position.
- **Collapsible SetupPanel**: Panel collapses to 56px-wide status strip with phase indicator dots, maximizing map view for race officers.
- **Quick Start Wizard** (`QuickStartWizard.tsx`): Multi-step wizard for new events combining template/saved course selection with fleet configuration. Features:
  - **Progress stepper**: Visual progress (Choose → Select → Configure)
  - **Templates tab**: Category-organized global templates (Triangle, Trapezoid, Windward-Leeward, Other) with counts and thumbnails
  - **My Courses tab**: Access to user's saved courses from previous events
  - **Integrated fleet config**: Race type (Fleet/Match/Team) and boat count selection built into wizard
  - **Non-cancellable for new events**: Prevents closing without selecting or creating a course
  - **Skip redundant dialogs**: FleetConfig passthrough skips separate boat count dialog when configured in wizard
  - **Loading states**: Clear loading indication during course creation
  - **Touch targets**: 56px+ buttons, 80px+ cards for wet-finger operation
- **Tap-and-Hold Gesture**: Long-press (600ms) on map directly places a course mark, designed for intuitive wet-finger operation. Only active when not in other placement/editing modes.

### Design System (`client/src/design-system.ts`)
A comprehensive, rule-based design framework defining:

**Visual Identity**: Maritime Professional theme using HSL 210 (nautical blue) as base hue.

**Color System**:
- **Primary**: `210 85% 42%` - CTAs, active states, links
- **Secondary**: `210 8% 88%` - Subdued actions
- **Accent**: `210 12% 92%` - Subtle highlights
- **Neutral**: Derived from base hue for backgrounds, text, borders

**Semantic Colors (Buoy States)**:
- **Green** (`#22c55e`): Success/Loitering - `text-green-500`, `bg-green-500`
- **Orange** (`#f97316`): Warning/Moving - `text-orange-500`, `bg-orange-500`
- **Blue** (`#3b82f6`): Info/Idle - `text-blue-500`, `bg-blue-500`
- **Red** (`#ef4444`): Error/Fault - `text-red-500`, `bg-destructive`
- **Purple** (`#a855f7`): Alert/Low Battery (<20%) - `text-purple-500`, overlay ring

**Interaction States** (ENFORCED RULES):
- **Hover**: Use `hover-elevate` utility - NEVER `hover:bg-*`
- **Active**: Use `active-elevate-2` utility - NEVER `active:bg-*`
- **Focus**: `focus-visible:ring-1 focus-visible:ring-ring`
- **Disabled**: `disabled:opacity-50 disabled:pointer-events-none`
- **Toggle**: `toggle-elevate` + `toggle-elevated` classes

**Forbidden Patterns**:
- Manual hover/active color overrides
- Arbitrary hex colors (`bg-[#...]`)
- Setting h-*/w-* on Buttons (use size prop)
- Nesting Cards inside Cards
- Mixing color families (e.g., bg-primary + border-accent)

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
- **PostgreSQL**: Database.
- **Drizzle ORM**: ORM for PostgreSQL.

### Development Tools
- **Vite**: Frontend build tool and development server.
- **tsx**: TypeScript execution for development.