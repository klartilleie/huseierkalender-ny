# Smart Hjem Calendar Application

## Overview

This is a comprehensive calendar and customer service management application for Smart Hjem AS, built with a full-stack TypeScript architecture. The application serves as both a booking calendar system and customer support platform, designed to handle user authentication, event management, iCal feed integration, and support ticket management.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for development and production builds
- **PWA Support**: Service worker integration for offline capabilities

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ES modules)
- **Framework**: Express.js for API server
- **Authentication**: Passport.js with local strategy and express-session
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Storage**: PostgreSQL-backed session store

### Key Design Decisions
1. **Monorepo Structure**: Shared schema and types between client and server
2. **Type Safety**: End-to-end TypeScript with Zod validation schemas
3. **Server-side Rendering**: Vite middleware integration for development
4. **Responsive Design**: Mobile-first approach with device preference management

## Key Components

### Authentication System
- **Strategy**: Local username/password authentication
- **Password Security**: Scrypt-based password hashing with salt
- **Session Management**: PostgreSQL-backed sessions with secure cookies
- **Admin Protection**: Route-level admin privilege checking
- **Password Reset**: Token-based password reset functionality
- **Mini Admin Role**: Read-only admin access for viewing users and data without editing permissions

### Calendar Management
- **Views**: Month, week, day, and compact year views
- **Event Types**: Regular events, all-day events, and collaborative events
- **iCal Integration**: Import/export functionality with automatic synchronization
- **Marked Days**: Special day marking system for holidays, vacations, etc.
- **Color Coding**: Customizable event colors and categories

### Customer Support System
- **Ticket Management**: Full CRUD operations for support tickets
- **Case Messaging**: Real-time messaging between users and admins
- **File Attachments**: Support for file uploads in ticket communications
- **Status Tracking**: Comprehensive ticket status and priority management
- **Admin Assignment**: Ticket routing and assignment capabilities

### Payout Management System
- **User Payouts**: Monthly payout tracking for each user
- **Status Management**: Track payment status (paid/pending/cancelled)
- **Admin Overview**: Admin can view ALL users' payouts or filter by specific user
- **User Dashboard**: Personal payout view for regular users (only their own data)
- **Yearly Summaries**: Annual overview with monthly breakdown and totals
- **Data Isolation**: Secure data separation - regular users see only their own payouts
- **Admin Features**: Full control to create, edit, and delete payouts for any user

### Admin Agreements System
- **Meeting Management**: Admins can create and schedule meetings/agreements with users
- **Status Tracking**: Track agreement status (scheduled/completed/cancelled)
- **Meeting Details**: Title, description, date/time, and location for each agreement
- **Notes System**: Bi-directional note-taking with both public and private notes
- **Private Notes**: Admin-only notes that users cannot see
- **User View**: Users can view their scheduled meetings and discussion notes
- **Notifications**: Automatic notifications when agreements are created/updated
- **Discussion History**: Complete audit trail of meeting notes and discussions

### External Integrations
- **iCal Feeds**: Support for Google Calendar, Outlook, and other iCal sources
  - **Sync Frequency**: Automatic sync every 30 minutes to respect API rate limits
  - **Active Sync Window**: 30 days backward to 90 days forward (optimized September 22, 2025)
  - **Event Retention**: Keeps events from 5 years ago to 5 years in the future
  - **Data Preservation Policy**: MINIMUM 3 YEARS - All iCal events are preserved for at least 3 years (updated August 18, 2025)
  - **Historical Preservation**: Events older than 3 years are never deleted, even if removed from source feed
  - **Smart Sync**: Only updates changed events, adds new events, and removes recent deleted events
  - **Rate Limit Handling**: Automatic retry with exponential backoff for 503 errors
  - **beds24.com Integration**: Special handling for property booking feeds
    - **Delta Sync**: Only fetches bookings modified since last sync (modifiedSince parameter)
    - **Optimized Window**: 30 days backward to 90 days forward
    - **CSV Protection**: CSV-imported events are protected from being overwritten
    - **Sync Frequency**: Every 30 minutes
    - **Safety Buffer**: 10 minutes overlap on delta sync to ensure no events are missed
- **Email Notifications**: SMTP-based email system for notifications
- **Translation Services**: Multi-language support with OpenAI integration
- **WebSocket Support**: Real-time notifications and updates

## Data Flow

### Authentication Flow
1. User submits credentials via login form
2. Server validates against hashed passwords in database
3. Session created and stored in PostgreSQL
4. Client receives user object and redirects to dashboard

### Calendar Event Flow
1. User creates/edits event through modal forms
2. Client validates data using Zod schemas
3. Server processes and stores in events table
4. Real-time updates sent via WebSocket to collaborators
5. iCal export generation for external calendar sync

### Support Ticket Flow
1. User creates ticket with category and priority
2. System generates unique case number
3. Admin receives notification and can assign ticket
4. Bi-directional messaging system with read receipts
5. Ticket lifecycle management with status updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection and query execution
- **drizzle-orm**: Type-safe database operations and migrations
- **@tanstack/react-query**: Server state management and caching
- **passport**: Authentication middleware and strategies
- **@radix-ui/***: Accessible UI component primitives
- **date-fns**: Date manipulation and formatting utilities

### Integration Services
- **node-ical**: iCal feed parsing and generation
- **nodemailer**: Email sending capabilities
- **ws**: WebSocket server for real-time features
- **axios**: HTTP client for external API calls

### Development Tools
- **tsx**: TypeScript execution for development
- **esbuild**: Production build bundling
- **tailwindcss**: Utility-first CSS framework
- **vite**: Development server and build tool

## Deployment Strategy

### Environment Configuration
- **Development**: Local PostgreSQL with Vite dev server
- **Production**: Neon serverless PostgreSQL with Node.js server
- **Build Process**: Separate client and server builds with esbuild
- **Asset Handling**: Vite handles client assets, Express serves static files

### Database Management
- **Schema Migrations**: Drizzle Kit for database schema management
- **Connection Pooling**: Neon serverless connection pooling
- **Backup System**: Automated backup creation and restoration
- **Data Seeding**: Scripts for creating default admin users

### Security Considerations
- **HTTPS Enforcement**: Required for production deployment
- **CSRF Protection**: Session-based CSRF tokens
- **Input Validation**: Comprehensive Zod schema validation
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM

## Changelog
- June 15, 2025. Initial setup
- June 15, 2025. Added admin color override functionality for event management
- June 15, 2025. Implemented force refresh functionality for iCal feeds to solve stale event issues
- June 15, 2025. Completed calendar cleanup for user Just - deleted 13 stale events and resynced with fresh Beds24 data
- August 18, 2025. Updated iCal data retention policy to preserve minimum 3 years of calendar events for all users
- June 17, 2025. Fixed iCal export filtering to prevent echoing external feed events back to source calendars
- June 26, 2025. Implemented comprehensive cache control to prevent white screen issues in browsers
- June 26, 2025. Added automatic cache clearing on startup and enhanced error handling
- June 26, 2025. Fixed server startup port configuration and improved web accessibility
- June 30, 2025. Implemented comprehensive white screen prevention with emergency fallback content that displays immediately
- June 30, 2025. Added multiple timeout mechanisms and user-controlled fallback options for authentication failures
- July 15, 2025. Fixed admin event deletion to properly identify iCal events using source.type instead of ID format
- July 15, 2025. Implemented fixed color scheme: iCal events are always pink (#ec4899) and non-editable, local events are red (#ef4444) by default and can be changed by admin
- July 17, 2025. Solved massive duplicate issue: removed 28,194 duplicate iCal events caused by faulty deleteEventsBySource function
- July 17, 2025. Fixed root cause of duplicates by repairing JSON-based iCal feed synchronization logic
- July 17, 2025. Upgraded "Fjern duplikater" admin button to use efficient SQL instead of slow JavaScript loops
- July 17, 2025. Confirmed iCal events cannot be deleted by admin as they auto-sync from external Beds24 sources every minute
- July 18, 2025. Cleaned Pascal Sbrzesny's calendar - removed all 392 old iCal events as he doesn't have active iCal link yet
- August 17, 2025. Added phoneNumber and accountNumber fields to user profiles for SMS notifications and payout management
- August 17, 2025. Fixed "Årsoverviskt" typo to "Årsoversikt" in payout management
- August 17, 2025. Updated payout statuses: removed "Kansellert", kept "Venter", "Betalt", "Utbetaling sendt", "Motregner"
- August 17, 2025. Implemented support for negative balances in payout system with appropriate color coding
- August 18, 2025. Implemented mini admin role with read-only access to view all users and data without editing permissions
- August 18, 2025. Fixed iCal sync issues: Extended event retention from 2 to 5 years, reduced sync frequency from 1 min to 30 min to avoid API rate limits, added retry logic for 503 errors
- August 18, 2025. Implemented smart iCal sync that preserves historical events older than 3 months to prevent data loss when events are removed from source feeds
- September 13, 2025. Created protected CSV import functionality for Geir Stølen's calendar (user ID 14) with admin-only endpoint /api/import-geir-csv
- September 13, 2025. Added csvProtected flag protection to both iCal scheduler and Beds24 API to prevent overwriting of CSV-imported events
- September 13, 2025. Successfully imported 9 bookings for "Flott Feriehus i Øksnevik" property from Geir Stølen's CSV file with proper color coding (Blue for New, Green for Confirmed, Orange for Owner blocks)
- September 22, 2025. Optimized API synchronization: Implemented delta sync with modifiedSince parameter, reduced time window to -30/+90 days for better performance, added automatic email removal from all event descriptions for privacy
- January 3, 2026. Implemented standard calendar notification email system with "Huseierkalenderen" branding, sends automatic emails when calendar events are created, updated, or deleted
- January 3, 2026. Added automatic copy of all emails to sender (kalender@klartilleie.no) with information about who received the email
- January 3, 2026. Added admin toggle in System Settings to enable/disable email notifications to users

## User Preferences

Preferred communication style: Simple, everyday language.