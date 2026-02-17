# Smart Hjem Calendar Application

## Overview
The Smart Hjem Calendar Application is a full-stack TypeScript application designed for Smart Hjem AS, functioning as both a booking calendar and a customer service platform. Its primary purpose is to streamline event management, user authentication, customer support, and financial payout tracking. The application aims to provide a comprehensive solution for managing properties, bookings, and customer interactions, enhancing operational efficiency and customer satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Technologies
- **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for state management, Shadcn/ui (Radix UI) for components, Tailwind CSS for styling, Vite for tooling, PWA support.
- **Backend**: Node.js with TypeScript (ES modules), Express.js for API, Passport.js for authentication, PostgreSQL with Drizzle ORM, Neon serverless PostgreSQL for database, PostgreSQL-backed session storage.

### Key Design Principles
- **Monorepo**: Shared schema and types for client and server.
- **Type Safety**: End-to-end TypeScript with Zod validation.
- **Responsive Design**: Mobile-first approach.
- **Secure Authentication**: Scrypt hashing, PostgreSQL-backed sessions, role-based access (admin, mini-admin).
- **Comprehensive Calendar**: Month, week, day, year views, event categorization, color coding, and special day marking.
- **Customer Support**: Full CRUD for tickets, real-time messaging, file attachments, status and priority management.
- **Payout Management**: Monthly payout tracking, status management, yearly summaries, admin overview and user-specific dashboards.
- **Admin Agreements**: Meeting scheduling, status tracking, bi-directional notes (public/private), notifications, and discussion history.
- **Booking Payout Calculator**: Calculates payouts from Beds24 bookings, with admin override capabilities and property-specific filtering.
- **User Properties**: Supports multiple Beds24 properties per user, managed by admin.

### UI/UX Decisions
- Fixed color scheme for events: Red for local owner blocks, Green for Beds24 bookings, Yellow for Beds24 blocks.
- Accessible UI components built on Radix UI primitives.

### Feature Specifications
- **Authentication**: Local strategy, secure password hashing, PostgreSQL sessions, admin and mini-admin roles, password reset.
- **Calendar**: Flexible views, event types (regular, all-day, collaborative), color coding.
- **Customer Support**: Ticket creation, messaging, attachments, status/priority, admin assignment.
- **Payouts**: Monthly tracking per user, status (paid/pending/cancelled), yearly summaries, admin/user dashboards.
- **Agreements**: Admin-scheduled meetings, status tracking, detailed notes (public/private), notifications.
- **Beds24 Integration**: Bidirectional sync for bookings and blocks, delta sync, optimized sync window (-30 to +360 days), 5-minute sync frequency, protection for CSV-imported events, automatic email removal from event descriptions. Multi-property sync via user_properties table (Beds24ApiClient accepts overridePropId). Availability-based blackout detection via inventory/availability endpoint. Property names shown in blackout event titles for multi-property users. Local owner blocks sync to Beds24 as "black" status bookings with roomId resolution. Admin bulk sync endpoint at POST /api/admin/beds24-sync-local-blocks. Admin cleanup endpoint at POST /api/admin/beds24-delete-bookings. Beds24 API v2 response format: array of objects with `new.id` for booking IDs.
- **Email Notifications**: SMTP-based, calendar event notifications (create, update, delete) with admin/user toggles.
- **Real-time Updates**: WebSocket support for instant notifications.

## External Dependencies

### Core Libraries
- `@neondatabase/serverless`: PostgreSQL connection.
- `drizzle-orm`: Type-safe ORM.
- `@tanstack/react-query`: Server state management.
- `passport`: Authentication middleware.
- `@radix-ui/*`: UI primitives.
- `date-fns`: Date utilities.

### Integration Services
- `nodemailer`: Email sending.
- `ws`: WebSocket server.
- `axios`: HTTP client for external APIs.

### Development & Tooling
- `tsx`: TypeScript execution.
- `esbuild`: Production bundling.
- `tailwindcss`: CSS framework.
- `vite`: Development server and build tool.