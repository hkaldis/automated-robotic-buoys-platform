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
- **Fleet Status Dashboard**: Replaced the "Ready to Deploy" screen, providing a summary grid of buoy statuses (On Station, Moving, Fault, Low Batt), Course Setup ETA, and per-buoy status cards.
- **Buoy Follow System**: Hybrid approach with immediate buoy commands on mark movements plus continuous drift monitoring. Centralized `useBuoyFollow` hook handles all mark update paths (drag, nudge, adjust to wind, course transformation, undo). Configurable settings for distance threshold, poll interval, and debounce time stored in localStorage.

### UI/UX
The design is tablet-first with large, touch-friendly controls (min 48px targets), a visual progress stepper, and maritime-themed aesthetics. Role-specific mark visualizations and adherence to World Sailing standards for course geometry are key.

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