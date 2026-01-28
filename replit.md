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
React Query handles all application data, including fetching, mutations, and caching. Real-time updates use polling and optimistic updates. A transaction pattern is used for complex operations.

### Core Features and Workflow
The application supports a 6-phase `SetupPanel` for course creation, including setting start/finish lines, adding course marks (convertible to gates), defining rounding sequences, and assigning buoys. Key features include:
- **Gates Support**: Marks can become wind-responsive gates.
- **Course Transformation**: Tools for scaling, rotating, and moving entire courses.
- **Auto-Assign Buoys**: A greedy algorithm assigns the closest available buoys.
- **Buoy GoTo Commands**: `MarkEditPanel` enables commanding buoys via position, tap-to-go, nudges, and coordinates.
- **Demo Mode**: Client-side simulation of buoy behavior.
- **Auto-Adjust Course to Wind**: A wizard-based system to adjust mark positions relative to wind.
- **Race Time Estimation**: VMG-based estimation using sailing physics and a database of 20 boat classes.
- **Wind Angle Calculation**: Centralized calculation for signed relative and absolute true wind angles.
- **Start Line Adjustment Controls**: Touch-friendly controls for resizing and fixing the start line bearing to wind.
- **Adjust Individual Mark to Wind**: Allows fine-tuning single mark positions relative to wind.
- **Adjust to Shape**: Per-mark interior angle adjustment to create standard racing geometries (triangles, trapezoids).
- **Shape Template Quick Start**: Predefined course shapes can be auto-generated based on wind direction.
- **Fleet Status Dashboard**: Provides a summary grid of buoy statuses and course setup ETA.
- **Buoy Follow System**: Hybrid approach with immediate buoy commands on mark movements plus continuous drift monitoring.
- **Course Snapshots & Templates**: Saved courses are immutable snapshots with global, club, and user visibility scopes.
- **Buoy Inventory Management**: Global buoy inventory system with ownership types and status tracking.
- **Boat Tracking Integrations**: Displays competing boats on the map via Vakaros and Tractrac.
- **Weather Insights**: Analyzes historical wind data from buoys to detect patterns, predict shifts, and provide current conditions.

### UI/UX
The design is tablet-first with large, touch-friendly controls (min 56px targets), a visual progress stepper, and maritime-themed aesthetics. Role-specific mark visualizations and adherence to World Sailing standards for course geometry are key. Recent improvements include a `FloatingActionBar` for critical actions, a `Quick Start Wizard` for new events, and tap-and-hold gestures for intuitive mark placement.

### Design System (`client/src/design-system.ts`)
A comprehensive, rule-based design framework defines the visual identity with a maritime professional theme (HSL 210) and a structured color system for primary, secondary, accent, and neutral tones. Semantic colors are used for buoy states (Green for success/loitering, Orange for warning/moving, Blue for info/idle, Red for error/fault, Purple for low battery). Interaction states are enforced with specific utility classes for hover, active, focus, disabled, and toggle states, prohibiting manual color overrides or arbitrary hex colors.

## External Dependencies

### External Integrations
- **Manage2Sail**: Fetches sailing event data including entries, results, and notice board information using public APIs and HTML parsing.
- **Racing Rules of Sailing**: Fetches official race documents (NoR, SI, amendments) from event pages via HTML parsing.
- **Documentation**: See `docs/EXTERNAL_INTEGRATIONS.md` for complete API reference and implementation details.

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