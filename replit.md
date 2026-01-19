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