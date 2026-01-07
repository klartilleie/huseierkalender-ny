import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, generatePasswordResetToken, validatePasswordResetToken, markTokenAsUsed } from "./auth";
import { 
  insertEventSchema, insertIcalFeedSchema, insertMarkedDaySchema, insertIcalEventNoteSchema,
  eventFormSchema, icalFeedFormSchema, markedDayFormSchema, icalEventNoteFormSchema, systemSettingFormSchema,
  caseFormSchema, caseMessageFormSchema, insertPriceRangeSchema,
  adminAgreementFormSchema, agreementNoteFormSchema,
  type User, type Event, type MarkedDay, type IcalEventNote, type InsertIcalFeed,
  type Case, type CaseMessage, type CaseAttachment, type PriceRange,
  type AdminAgreement, type AgreementNote,
  users, events, eventCollaborators, eventSuggestions, passwordResetTokens,
  cases, caseMessages, caseAttachments, adminAgreements, agreementNotes
} from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";
import axios from "axios";
import ical from "node-ical";
import fs from "fs/promises";
import { promises as fsPromises } from "fs";
import multer from "multer";
import csv from "csv-parser";
import * as stream from "stream";
import { createBackup, restoreBackup, getBackupsList, exportUserCalendarAsIcal, scheduleAutomaticBackups } from './backup';
import { 
  syncAllIcalFeeds, triggerManualIcalSync, 
  findAndRemoveDuplicateIcalEvents, findSimilarIcalEvents 
} from './ical-scheduler';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { 
  notifyNewEvent, notifyUpdatedEvent, notifyDeletedEvent, 
  notifyCollaborativeEvent, sendPasswordResetEmail
} from './notification';
import { translateText, detectLanguage } from './simple-translation-free';
import { sanitizeEventDescription } from './utils/sanitize';
import { cleanupExpiredSessions, cleanupOldSessions } from './session-cleanup';
import { Beds24ApiClient } from './beds24-api';

// Import the client-side iCal utilities
import { generateICalContent as generateICalContentFromClient } from "../client/src/lib/ical-utils";

// Interface for notification
interface Notification {
  id: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'collaboration_invite' | 'system';
  title: string;
  message: string;
  eventId?: number;
  createdAt: Date;
  read: boolean;
  userId: number; // Mottaker
  fromUserId?: number; // Avsender, hvis relevant
}

// WebSocket klienter
interface WebSocketClient extends WebSocket {
  userId?: number;
  isAlive: boolean;
}

// Map of connected clients
const wsClients: Map<number, WebSocketClient[]> = new Map();

// Send notification to a specific user via WebSocket
function sendNotificationToUser(userId: number, notification: Notification) {
  const userClients = wsClients.get(userId) || [];
  
  if (userClients.length > 0) {
    const message = JSON.stringify({
      type: 'notification',
      notification
    });
    
    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
    
    console.log(`Sent notification to user ${userId} (${userClients.length} active clients)`);
  } else {
    console.log(`No active WebSocket connections for user ${userId}`);
  }
}

// Create a notification
function createNotification(
  type: Notification['type'],
  title: string,
  message: string,
  userId: number,
  fromUserId?: number,
  eventId?: number
): Notification {
  return {
    id: nanoid(),
    type,
    title,
    message,
    eventId,
    createdAt: new Date(),
    read: false,
    userId,
    fromUserId
  };
}

// Simple in-memory cache for iCal data to avoid hitting external servers too frequently
interface ICalCache {
  [feedId: number]: {
    data: any; // Raw iCal data
    events: Event[]; // Parsed events
    timestamp: number;
  }
}

const CACHE_DURATION = 500; // Redusert til 500ms for nesten øyeblikkelige oppdateringer
const icalCache: ICalCache = {};

// Funksjon for å tømme cache for en bestemt feed
function clearIcalFeedCache(feedId: number) {
  if (icalCache[feedId]) {
    console.log(`Tømmer cache for iCal feed ID ${feedId}`);
    delete icalCache[feedId];
    return true;
  }
  return false;
}

// Funksjon for å tømme HELE iCal-cachen (brukes ved omfattende endringer)
function clearAllIcalCache() {
  console.log("Tømmer HELE iCal-cachen");
  // Teller antall feeds som blir tømt
  const cacheCount = Object.keys(icalCache).length;
  
  // Tømmer hele cachen ved å erstatte objektet
  for (const key in icalCache) {
    delete icalCache[key];
  }
  
  return cacheCount;
}

// Funksjon for å tvinge fullstendig oppdatering av en iCal-feed
async function forceRefreshIcalFeed(feedId: number): Promise<void> {
  console.log(`Tvinger fullstendig oppdatering av iCal feed ${feedId}`);
  
  // Tøm cache for denne feeden
  clearIcalFeedCache(feedId);
  
  try {
    const feed = await storage.getIcalFeed(feedId);
    if (!feed) {
      console.error(`Feed ${feedId} ikke funnet`);
      return;
    }

    console.log(`Henter ferske data fra ${feed.url}`);
    const response = await axios.get(feed.url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Smart Hjem Calendar/1.0',
        'Accept': 'text/calendar, application/calendar, text/plain, */*'
      }
    });

    if (response.status === 200 && response.data) {
      const parsedEvents = await ical.async.parseICS(response.data);
      console.log(`Feed ${feedId} oppdatert med ${Object.keys(parsedEvents).length} hendelser fra kilden`);
      
      // Oppdater timestamp
      await storage.updateIcalFeed(feedId, {
        lastSynced: new Date()
      });
    }
  } catch (error) {
    console.error(`Feil ved oppdatering av feed ${feedId}:`, error);
  }
}

// Funksjon for å sende WebSocket-melding om at kalendere må oppdateres
function notifyCalendarUpdate(userId: number) {
  const notification: Notification = {
    id: nanoid(),
    type: 'system',
    title: 'Kalenderoppdatering',
    message: 'Kalenderen har blitt oppdatert',
    createdAt: new Date(),
    read: false,
    userId: userId
  };
  
  sendNotificationToUser(userId, notification);
}

// Function to generate iCal content for a user's events
function generateIcalContent(user: any, events?: any): string {
  let eventList: any[];
  const now = new Date();
  
  // Standard iCal format header
  let icalContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Smart Hjem Calendar//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:Europe/Oslo`,
    `X-WR-CALDESC:Kalender fra Smart Hjem`
  ].join("\r\n") + "\r\n";
  
  // Handle both function signatures:
  // 1. generateIcalContent(user: User, events: Event[])
  // 2. generateIcalContent(events: Event[], calendarName: string)
  if (Array.isArray(user)) {
    eventList = user;
    if (events) {
      icalContent += `X-WR-CALNAME:${events}\r\n`;
    } else {
      icalContent += `X-WR-CALNAME:Smart Hjem Calendar\r\n`;
    }
  } else {
    eventList = events || [];
    icalContent += `X-WR-CALNAME:${user.name}'s Calendar\r\n`;
  }
  
  // Helper function to escape special characters in iCal text fields
  const escapeText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  // Format dates to iCal format (YYYYMMDDTHHMMSSZ)
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
  };
  
  // Add each event in iCal format
  for (const event of eventList) {
    const startDate = new Date(event.startTime);
    const endDate = event.endTime ? new Date(event.endTime) : new Date(startDate.getTime() + 3600000); // Default to 1 hour duration
    
    // Use the original UID if this event came from an external feed
    let eventUid: string;
    if (event.source && typeof event.source === 'object' && 'type' in event.source && event.source.type === 'ical') {
      // Extract the original UID from the id if it's an imported event
      const icalIdParts = String(event.id).split('-');
      if (icalIdParts.length >= 3) {
        // Use the last part which should be the original external ID
        eventUid = icalIdParts.slice(2).join('-');
      } else {
        eventUid = `event-${event.id}@smarthjem.calendar`;
      }
    } else {
      // For internal events, create our own stable UID
      eventUid = `event-${event.id}@smarthjem.calendar`;
    }
    
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    
    // Calculate event creation and last modified times
    const createdDate = formatDate((event as any).createdAt || now);
    const lastModified = formatDate((event as any).updatedAt || now);
    
    // Generate event status
    let status = "CONFIRMED";
    if ((event as any).isBlocked) {
      status = "CANCELLED";
    }
    
    // Format location if available
    const locationLine = (event as any).location ? `LOCATION:${escapeText((event as any).location)}\r\n` : '';
    
    // Format organizer if available (use Smart Hjem as default organizer for our events)
    const organizerLine = (event as any).organizer 
      ? `ORGANIZER;CN=${escapeText((event as any).organizer)}:mailto:kundeservice@smarthjem.as\r\n` 
      : `ORGANIZER;CN=Smart Hjem:mailto:kundeservice@smarthjem.as\r\n`;
    
    // Format categories/tags if available
    const categoriesLine = (event as any).categories && (event as any).categories.length > 0
      ? `CATEGORIES:${(event as any).categories.map(escapeText).join(',')}\r\n`
      : '';
    
    // URL-er er ikke i bruk i systemet, så vi inkluderer dem ikke
    const urlLine = '';
    
    // Format transparency (affects free/busy status)
    const transparencyLine = (event as any).transparency ? `TRANSP:${(event as any).transparency}\r\n` : 'TRANSP:OPAQUE\r\n';
    
    // Format recurrence rule if available
    const rruleLine = (event as any).rrule ? `RRULE:${(event as any).rrule}\r\n` : '';
    
    // Generate a sequence number (for tracking modifications)
    const sequenceLine = (event as any).sequence ? `SEQUENCE:${(event as any).sequence}\r\n` : 'SEQUENCE:0\r\n';
    
    // Add event to iCal content with all properties
    icalContent += [
      "BEGIN:VEVENT",
      `UID:${eventUid}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description || "")}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `DTSTAMP:${formatDate(now)}`,
      `CREATED:${createdDate}`,
      `LAST-MODIFIED:${lastModified}`,
      `STATUS:${status}`,
      locationLine,
      organizerLine,
      categoriesLine,
      // urlLine fjernet, ikke i bruk
      transparencyLine,
      rruleLine,
      sequenceLine,
      `CLASS:${(event as any).isPrivate ? 'PRIVATE' : 'PUBLIC'}`,
      `COLOR:${event.color || '#3788d8'}`
    ].filter(line => line).join("\r\n") + "\r\n";
    icalContent += "END:VEVENT\r\n";
  }
  
  // Close the calendar
  icalContent += "END:VCALENDAR";
  
  return icalContent;
}

// Add interface for authenticated request
interface AuthenticatedRequest extends Request {
  user: User;
}

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (req.isAuthenticated() && authReq.user?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
};

// Middleware to check if user is a mini admin (read-only admin)
const isMiniAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (req.isAuthenticated() && (authReq.user?.isAdmin || authReq.user?.isMiniAdmin)) {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin or Mini Admin access required" });
};

// Middleware to check if user has any admin role (full or mini)
const hasAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  if (req.isAuthenticated() && (authReq.user?.isAdmin || authReq.user?.isMiniAdmin)) {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
};

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Add cache control headers to prevent browser caching issues
  app.use((req, res, next) => {
    // Set cache control headers for all responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server on a specific path to avoid conflicts with Vite
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  // WebSocket connection handler
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('WebSocket client connected');
    
    // Initialize client properties
    ws.isAlive = true;
    
    // Handle pings to keep connection alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    // Handle client messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle authentication message
        if (data.type === 'auth' && data.userId) {
          ws.userId = data.userId;
          
          // Register client in the clients map
          const userId = data.userId;
          const userClients = wsClients.get(userId) || [];
          userClients.push(ws);
          wsClients.set(userId, userClients);
          
          console.log(`WebSocket client authenticated for user ${userId}`);
          
          // Confirm authentication
          ws.send(JSON.stringify({
            type: 'auth_success',
            message: 'Successfully authenticated'
          }));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      if (ws.userId) {
        // Remove client from clients map
        const userClients = wsClients.get(ws.userId) || [];
        const updatedClients = userClients.filter(client => client !== ws);
        
        if (updatedClients.length > 0) {
          wsClients.set(ws.userId, updatedClients);
        } else {
          wsClients.delete(ws.userId);
        }
        
        console.log(`WebSocket client disconnected for user ${ws.userId}`);
      } else {
        console.log('Unauthenticated WebSocket client disconnected');
      }
    });
  });
  
  // VIKTIG: Kun aktiver WebSocket ping hvis bakgrunnsprosesser er aktivert
  // Dette forhindrer at appen holder seg våken 24/7
  let pingInterval: NodeJS.Timeout | null = null;
  
  const enableBackgroundTasks = process.env.ENABLE_BACKGROUND_TASKS === 'true';
  
  if (enableBackgroundTasks) {
    // Ping all clients periodically to check if they're still alive
    pingInterval = setInterval(() => {
      wss.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) return ws.terminate();
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
    
    console.log('WebSocket ping interval aktivert (øker kostnader)');
  } else {
    console.log('WebSocket ping interval deaktivert (sparer kostnader)');
  }
  
  // Clean up interval on server close
  wss.on('close', () => {
    if (pingInterval) {
      clearInterval(pingInterval);
    }
  });
  
  // Set up authentication routes
  setupAuth(app);
  
  // Public route for accessing user's iCal feed - INGEN CACHING
  app.get("/api/ical/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).send("Invalid user ID");
      }
      
      // Fetch the user to make sure they exist
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).send("User not found");
      }
      
      console.log(`Generating fresh iCal export for user ${userId}`);
      
      // Fetch events for the user - DIREKTE FRA DATABASE UTEN CACHING
      const allEvents = await storage.getEvents(userId);
      
      // Filter out iCal events to prevent echoing back external feed events
      // Only export events that were created locally on the website
      const localEvents = allEvents.filter(event => {
        // Exclude events that have an iCal source (came from external feeds)
        if (event.source && 
            typeof event.source === 'object' && 
            'type' in event.source && 
            event.source.type === 'ical') {
          return false;
        }
        // Include only locally created events
        return true;
      });
      
      console.log(`Filtrert hendelser for iCal eksport: ${allEvents.length} totalt, ${localEvents.length} lokale hendelser`);
      
      // Generate iCal format with only local events
      const icalContent = generateIcalContent(user, localEvents);
      
      // Legg til caching-headers for å unngå at kalenderklienter cacher filen for lenge
      // men tillat caching i 5 minutter for å unngå for mange forespørsler
      res.set({
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${user.username}-calendar.ics"`,
        'Cache-Control': 'max-age=300, must-revalidate', // 5 minutter caching
        'ETag': `"${Date.now()}"` // Unik ETag basert på nåværende tidspunkt
      });
      
      console.log(`iCal export generert for user ${userId} med ${events.length} hendelser`);
      return res.status(200).send(icalContent);
    } catch (error) {
      console.error("Error generating iCal feed:", error);
      return res.status(500).send("Failed to generate iCal feed");
    }
  });

  // Event routes
  app.get("/api/events", isAuthenticated, async (req: Request, res) => {
    const authReq = req as AuthenticatedRequest;
    try {
      // On-demand sync: Synkroniser brukerens iCal/Beds24 når de åpner kalenderen
      // Kun hvis bakgrunnsprosesser er deaktivert
      const enableBackgroundTasks = process.env.ENABLE_BACKGROUND_TASKS === 'true';
      if (!enableBackgroundTasks && authReq.user) {
        // Trigger en lett synkronisering for denne brukeren
        // Dette kjører asynkront uten å blokkere responsen
        Promise.resolve().then(async () => {
          try {
            const { syncUserIcalFeeds } = await import('./ical-scheduler');
            const { syncUserBeds24Calendar } = await import('./beds24-api');
            
            // Synkroniser brukerens iCal feeds (hvis de har noen)
            await syncUserIcalFeeds(authReq.user.id);
            
            // Synkroniser brukerens Beds24 kalender (hvis de har en)
            await syncUserBeds24Calendar(authReq.user.id);
          } catch (syncError) {
            console.error('On-demand sync failed:', syncError);
            // Ikke blokkér brukerens forespørsel hvis sync feiler
          }
        });
      }
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate && req.query.endDate) {
        startDate = new Date(req.query.startDate as string);
        endDate = new Date(req.query.endDate as string);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        
        const events = await storage.getEventsByDateRange(authReq.user.id, startDate, endDate);
        return res.json(events);
      }
      
      const events = await storage.getEvents(authReq.user.id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event belongs to the authenticated user
      if (!req.user || event.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", isAuthenticated, async (req, res) => {
    try {
      const validation = eventFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid event data", errors: validation.error.errors });
      }
      
      const eventData = validation.data;
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      const event = await storage.createEvent(req.user.id, eventData);
      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event belongs to the authenticated user
      if (existingEvent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validation = eventFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid event data", errors: validation.error.errors });
      }
      
      const eventData = validation.data;
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      const updatedEvent = await storage.updateEvent(eventId, eventData);
      res.json(updatedEvent);
    } catch (error) {
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // NB: DELETE /api/events/:id er definert senere i koden
  
  // Collaborative events endpoints
  app.post("/api/collaborative-events", isAuthenticated, async (req, res) => {
    try {
      const validation = eventFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid event data", errors: validation.error.errors });
      }
      
      const eventData = validation.data;
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      const event = await storage.createCollaborativeEvent(req.user.id, eventData);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating collaborative event:", error);
      res.status(500).json({ message: "Failed to create collaborative event" });
    }
  });
  
  app.get("/api/collaborative-events", isAuthenticated, async (req, res) => {
    try {
      const events = await storage.getCollaborativeEvents(req.user.id);
      res.status(200).json(events);
    } catch (error) {
      console.error("Error fetching collaborative events:", error);
      res.status(500).json({ message: "Failed to fetch collaborative events" });
    }
  });
  
  app.get("/api/collaborative-events/:code", isAuthenticated, async (req, res) => {
    try {
      const code = req.params.code;
      const event = await storage.getCollaborativeEventByCode(code);
      
      if (!event) {
        return res.status(404).json({ message: "Collaborative event not found" });
      }
      
      res.status(200).json(event);
    } catch (error) {
      console.error("Error fetching collaborative event:", error);
      res.status(500).json({ message: "Failed to fetch collaborative event" });
    }
  });
  
  app.post("/api/collaborative-events/:id/join", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (!event.isCollaborative) {
        return res.status(400).json({ message: "This event does not support collaboration" });
      }
      
      const collaborator = await storage.addCollaborator(eventId, req.user.id);
      res.status(200).json(collaborator);
    } catch (error) {
      console.error("Error joining collaborative event:", error);
      res.status(500).json({ message: "Failed to join collaborative event" });
    }
  });
  
  app.get("/api/collaborative-events/:id/collaborators", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om brukeren har tilgang til å se samarbeidspartnere
      const collaborators = await storage.getEventCollaborators(eventId);
      const isCollaborator = collaborators.some(c => c.userId === req.user.id);
      
      if (!isCollaborator && event.userId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to view this event's collaborators" });
      }
      
      res.status(200).json(collaborators);
    } catch (error) {
      console.error("Error fetching event collaborators:", error);
      res.status(500).json({ message: "Failed to fetch event collaborators" });
    }
  });
  
  app.delete("/api/collaborative-events/:id/collaborators/:userId", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const collaboratorId = parseInt(req.params.userId);
      
      if (isNaN(eventId) || isNaN(collaboratorId)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om brukeren er event-eier eller fjerner seg selv
      if (event.userId !== req.user.id && collaboratorId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to remove this collaborator" });
      }
      
      const success = await storage.removeCollaborator(eventId, collaboratorId);
      
      if (success) {
        res.status(200).json({ message: "Collaborator removed successfully" });
      } else {
        res.status(404).json({ message: "Collaborator not found" });
      }
    } catch (error) {
      console.error("Error removing collaborator:", error);
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });
  
  // Forslag til endringer i arrangementer
  app.post("/api/events/:id/suggestions", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om brukeren har tilgang til å foreslå endringer
      const collaborators = await storage.getEventCollaborators(eventId);
      const isCollaborator = collaborators.some(c => c.userId === req.user.id);
      
      if (!isCollaborator && event.userId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to suggest changes to this event" });
      }
      
      const { type, originalValue, suggestedValue, message } = req.body;
      
      if (!type || !suggestedValue) {
        return res.status(400).json({ message: "Type and suggestedValue are required" });
      }
      
      const suggestion = await storage.createEventSuggestion(
        eventId,
        req.user.id,
        type,
        originalValue || "",
        suggestedValue,
        message
      );
      
      res.status(201).json(suggestion);
    } catch (error) {
      console.error("Error creating suggestion:", error);
      res.status(500).json({ message: "Failed to create suggestion" });
    }
  });
  
  app.get("/api/events/:id/suggestions", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om brukeren har tilgang til å se forslag
      const collaborators = await storage.getEventCollaborators(eventId);
      const isCollaborator = collaborators.some(c => c.userId === req.user.id);
      
      if (!isCollaborator && event.userId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to view suggestions for this event" });
      }
      
      const suggestions = await storage.getEventSuggestions(eventId);
      res.status(200).json(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });
  
  app.get("/api/events/:id/suggestions/pending", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om brukeren har tilgang til å se forslag
      const collaborators = await storage.getEventCollaborators(eventId);
      const isCollaborator = collaborators.some(c => c.userId === req.user.id);
      
      if (!isCollaborator && event.userId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to view suggestions for this event" });
      }
      
      const suggestions = await storage.getPendingSuggestions(eventId);
      res.status(200).json(suggestions);
    } catch (error) {
      console.error("Error fetching pending suggestions:", error);
      res.status(500).json({ message: "Failed to fetch pending suggestions" });
    }
  });
  
  app.post("/api/suggestions/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const suggestionId = parseInt(req.params.id);
      if (isNaN(suggestionId)) {
        return res.status(400).json({ message: "Invalid suggestion ID" });
      }
      
      const { status } = req.body;
      
      if (!status || (status !== "approved" && status !== "rejected")) {
        return res.status(400).json({ message: "Valid status (approved or rejected) is required" });
      }
      
      const suggestion = await storage.resolveSuggestion(suggestionId, req.user.id, status as 'approved' | 'rejected');
      
      if (!suggestion) {
        return res.status(404).json({ message: "Suggestion not found" });
      }
      
      res.status(200).json(suggestion);
    } catch (error) {
      console.error("Error resolving suggestion:", error);
      res.status(500).json({ message: "Failed to resolve suggestion" });
    }
  });

  // ==================== ADMIN AGREEMENTS (ADMIN-BRUKER AVTALER) ====================
  
  // Get agreements for current user or admin
  app.get("/api/admin-agreements", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const filterUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      console.log("🔍 Admin agreements request:", {
        adminId: req.user.id,
        isAdmin: req.user.isAdmin,
        filterUserId,
        rawUserId: req.query.userId
      });
      const agreements = await storage.getAdminAgreements(req.user.id, req.user.isAdmin, filterUserId);
      console.log("📋 Found agreements:", agreements.length);
      
      // Berik avtalene med brukerinformasjon
      const allUsers = await storage.getAllUsers();
      const enrichedAgreements = agreements.map(agreement => {
        const user = allUsers.find(u => u.id === agreement.userId);
        const admin = allUsers.find(u => u.id === agreement.adminId);
        return {
          ...agreement,
          userName: user?.name || user?.username || 'Ukjent',
          adminName: admin?.name || admin?.username || 'Ukjent'
        };
      });
      
      res.json(enrichedAgreements);
    } catch (error) {
      console.error("Error fetching admin agreements:", error);
      res.status(500).json({ message: "Kunne ikke hente avtaler" });
    }
  });
  
  // Get specific agreement
  app.get("/api/admin-agreements/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "Ugyldig avtale-ID" });
      }
      
      const agreement = await storage.getAdminAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ message: "Avtale ikke funnet" });
      }
      
      // Sjekk tilgang - bruker kan se sine egne avtaler, admin kan se alle
      if (!req.user.isAdmin && agreement.userId !== req.user.id) {
        return res.status(403).json({ message: "Ingen tilgang til denne avtalen" });
      }
      
      // Berik med brukerinformasjon
      const user = await storage.getUser(agreement.userId);
      const admin = await storage.getUser(agreement.adminId);
      
      res.json({
        ...agreement,
        userName: user?.name || user?.username || 'Ukjent',
        adminName: admin?.name || admin?.username || 'Ukjent'
      });
    } catch (error) {
      console.error("Error fetching agreement:", error);
      res.status(500).json({ message: "Kunne ikke hente avtale" });
    }
  });
  
  // Create new agreement (admin only)
  app.post("/api/admin-agreements", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const validation = adminAgreementFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Ugyldige avtaledata", 
          errors: validation.error.errors 
        });
      }
      
      // Transform meetingLocation to location for database
      const { meetingLocation, ...restData } = validation.data;
      const agreementData = {
        ...restData,
        location: meetingLocation, // Map meetingLocation til location
        adminId: req.user.id // Sett admin som den innloggede brukeren
      };
      
      const agreement = await storage.createAdminAgreement(agreementData);
      
      // Send varsling til brukeren om ny avtale
      const notification: Notification = {
        id: nanoid(),
        type: 'system',
        title: 'Ny avtale',
        message: `Admin har opprettet en ny avtale med deg: ${agreement.title}`,
        createdAt: new Date(),
        read: false,
        userId: agreement.userId,
        fromUserId: req.user.id
      };
      sendNotificationToUser(agreement.userId, notification);
      
      res.status(201).json(agreement);
    } catch (error) {
      console.error("Error creating agreement:", error);
      res.status(500).json({ message: "Kunne ikke opprette avtale" });
    }
  });
  
  // Update agreement (admin only)
  app.put("/api/admin-agreements/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "Ugyldig avtale-ID" });
      }
      
      const validation = adminAgreementFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Ugyldige avtaledata", 
          errors: validation.error.errors 
        });
      }
      
      // Transform meetingLocation to location for database if present
      const { meetingLocation, ...restData } = validation.data;
      const updateData = meetingLocation !== undefined 
        ? { ...restData, location: meetingLocation }
        : restData;
      
      const agreement = await storage.updateAdminAgreement(agreementId, updateData);
      if (!agreement) {
        return res.status(404).json({ message: "Avtale ikke funnet" });
      }
      
      // Send varsling til brukeren om oppdatert avtale
      const notification: Notification = {
        id: nanoid(),
        type: 'system',
        title: 'Avtale oppdatert',
        message: `Admin har oppdatert avtalen: ${agreement.title}`,
        createdAt: new Date(),
        read: false,
        userId: agreement.userId,
        fromUserId: req.user.id
      };
      sendNotificationToUser(agreement.userId, notification);
      
      res.json(agreement);
    } catch (error) {
      console.error("Error updating agreement:", error);
      res.status(500).json({ message: "Kunne ikke oppdatere avtale" });
    }
  });
  
  // Delete agreement (admin only)
  app.delete("/api/admin-agreements/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "Ugyldig avtale-ID" });
      }
      
      const agreement = await storage.getAdminAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ message: "Avtale ikke funnet" });
      }
      
      const success = await storage.deleteAdminAgreement(agreementId);
      if (success) {
        // Send varsling til brukeren om slettet avtale
        const notification: Notification = {
          id: nanoid(),
          type: 'system',
          title: 'Avtale kansellert',
          message: `Admin har kansellert avtalen: ${agreement.title}`,
          createdAt: new Date(),
          read: false,
          userId: agreement.userId,
          fromUserId: req.user.id
        };
        sendNotificationToUser(agreement.userId, notification);
        
        res.json({ message: "Avtale slettet" });
      } else {
        res.status(500).json({ message: "Kunne ikke slette avtale" });
      }
    } catch (error) {
      console.error("Error deleting agreement:", error);
      res.status(500).json({ message: "Kunne ikke slette avtale" });
    }
  });
  
  // Get agreement notes
  app.get("/api/admin-agreements/:id/notes", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "Ugyldig avtale-ID" });
      }
      
      const agreement = await storage.getAdminAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ message: "Avtale ikke funnet" });
      }
      
      // Sjekk tilgang
      if (!req.user.isAdmin && agreement.userId !== req.user.id) {
        return res.status(403).json({ message: "Ingen tilgang til denne avtalen" });
      }
      
      const notes = await storage.getAgreementNotes(agreementId, req.user.id, req.user.isAdmin);
      
      // Berik med forfatterinformasjon
      const allUsers = await storage.getAllUsers();
      const enrichedNotes = notes.map(note => {
        const author = allUsers.find(u => u.id === note.authorId);
        return {
          ...note,
          authorName: author?.name || author?.username || 'Ukjent',
          authorIsAdmin: author?.isAdmin || false
        };
      });
      
      res.json(enrichedNotes);
    } catch (error) {
      console.error("Error fetching agreement notes:", error);
      res.status(500).json({ message: "Kunne ikke hente notater" });
    }
  });
  
  // Create agreement note
  app.post("/api/admin-agreements/:id/notes", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const agreementId = parseInt(req.params.id);
      if (isNaN(agreementId)) {
        return res.status(400).json({ message: "Ugyldig avtale-ID" });
      }
      
      const agreement = await storage.getAdminAgreement(agreementId);
      if (!agreement) {
        return res.status(404).json({ message: "Avtale ikke funnet" });
      }
      
      // Sjekk tilgang
      if (!req.user.isAdmin && agreement.userId !== req.user.id) {
        return res.status(403).json({ message: "Ingen tilgang til denne avtalen" });
      }
      
      const validation = agreementNoteFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Ugyldige notatdata", 
          errors: validation.error.errors 
        });
      }
      
      const noteData = {
        ...validation.data,
        agreementId,
        authorId: req.user.id
      };
      
      const note = await storage.createAgreementNote(noteData);
      
      // Send varsling til den andre parten
      const targetUserId = req.user.isAdmin ? agreement.userId : agreement.adminId;
      const notification: Notification = {
        id: nanoid(),
        type: 'system',
        title: 'Nytt notat i avtale',
        message: `Nytt notat lagt til i avtalen: ${agreement.title}`,
        createdAt: new Date(),
        read: false,
        userId: targetUserId,
        fromUserId: req.user.id
      };
      sendNotificationToUser(targetUserId, notification);
      
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating agreement note:", error);
      res.status(500).json({ message: "Kunne ikke opprette notat" });
    }
  });
  
  // Update agreement note
  app.put("/api/admin-agreements/:id/notes/:noteId", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Ugyldig notat-ID" });
      }
      
      const validation = agreementNoteFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Ugyldige notatdata", 
          errors: validation.error.errors 
        });
      }
      
      const note = await storage.updateAgreementNote(noteId, validation.data);
      if (!note) {
        return res.status(404).json({ message: "Notat ikke funnet" });
      }
      
      res.json(note);
    } catch (error) {
      console.error("Error updating agreement note:", error);
      res.status(500).json({ message: "Kunne ikke oppdatere notat" });
    }
  });
  
  // Delete agreement note (admin only)
  app.delete("/api/admin-agreements/:id/notes/:noteId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Ugyldig notat-ID" });
      }
      
      const success = await storage.deleteAgreementNote(noteId);
      if (success) {
        res.json({ message: "Notat slettet" });
      } else {
        res.status(404).json({ message: "Notat ikke funnet" });
      }
    } catch (error) {
      console.error("Error deleting agreement note:", error);
      res.status(500).json({ message: "Kunne ikke slette notat" });
    }
  });

  // iCal feed routes - for admins to manage admin-specific feeds
  app.get("/api/admin/ical-feeds", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getIcalFeeds(req.user.id);
      res.json(feeds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch iCal feeds" });
    }
  });

  app.post("/api/ical-feeds", isAuthenticated, async (req, res) => {
    try {
      const validation = icalFeedFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid iCal feed data", errors: validation.error.errors });
      }
      
      const feedData = validation.data;
      
      // Make sure URL is properly formatted
      try {
        new URL(feedData.url);
      } catch (urlError) {
        return res.status(400).json({ message: "Invalid URL format. Please provide a complete URL including http:// or https://" });
      }
      
      // Check if this iCal URL is already in use by any user
      const allUsers = await storage.getAllUsers();
      for (const user of allUsers) {
        const userFeeds = await storage.getIcalFeeds(user.id);
        
        // Check if any user has this feed URL already
        const existingFeed = userFeeds.find(feed => feed.url === feedData.url);
        
        if (existingFeed) {
          return res.status(400).json({ 
            message: "Dette iCal-feeded er allerede i bruk av en annen bruker. Hver iCal-URL kan kun brukes av én bruker.",
            existingUserId: user.id,
            existingUsername: user.username
          });
        }
      }
      
      // Check if this is a Google Calendar URL, which may need special handling
      const isGoogleCalendar = feedData.url.includes('calendar.google.com');
      
      // Validate iCal URL by trying to fetch it
      try {
        console.log("Attempting to fetch iCal URL:", feedData.url);
        
        // For Google Calendar or other potentially problematic services, 
        // we'll accept a wider range of status codes
        const response = await axios.get(feedData.url, {
          timeout: 15000, // 15 second timeout for potentially slower services
          validateStatus: status => 
            // For Google Calendar URLs, we'll accept any valid response since they might redirect
            (isGoogleCalendar ? status < 500 : status === 200),
          headers: {
            // Some servers require a user agent
            'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)',
            'Accept': 'text/calendar,application/ics'
          }
        });
        
        if (response.status === 404 && isGoogleCalendar) {
          // Google sometimes uses different URLs or redirects, try to proceed anyway
          console.log("Google Calendar returned 404, but we'll try to add it anyway");
          
          // Skip validation for this case
          const feed = await storage.createIcalFeed(req.user.id, feedData);
          return res.status(201).json(feed);
        }
        
        try {
          if (response.data) {
            await ical.async.parseICS(response.data);
          } else {
            throw new Error("Empty response from calendar server");
          }
        } catch (parseError) {
          console.log("Error parsing iCal data:", parseError);
          
          if (isGoogleCalendar) {
            // For Google Calendar, we might still want to allow it
            console.log("Google Calendar parsing failed, but we'll try to add it anyway");
            const feed = await storage.createIcalFeed(req.user.id, feedData);
            return res.status(201).json(feed);
          }
          
          return res.status(400).json({ 
            message: "Could not parse iCal feed (invalid format)", 
            details: "The URL did not return valid iCal data. Check that the URL is correct and accessible."
          });
        }
      } catch (error: any) {
        console.log("Error fetching iCal URL:", error.message);
        
        let errorMessage = "Could not access or parse the iCal feed.";
        let details = "The calendar server may be down or the URL might be incorrect.";
        
        if (error.response) {
          errorMessage = `The server returned status ${error.response.status}`;
          details = "Check that the URL is correct and the calendar is publicly accessible.";
        } else if (error.code === 'ENOTFOUND') {
          errorMessage = 'The URL could not be reached. Please check the domain name.';
          details = "The domain name might be misspelled or not exist.";
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = 'Connection refused. The server may be down or not accepting connections.';
          details = "Try again later or check if the URL is correct.";
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
          errorMessage = 'Connection timed out. The server took too long to respond.';
          details = "Try again later or check your network connection.";
        }
        
        // For Google Calendar URLs, we'll be more lenient and allow adding them anyway
        if (isGoogleCalendar) {
          console.log("Error with Google Calendar URL, but we'll try to add it anyway:", error.message);
          const feed = await storage.createIcalFeed(req.user.id, feedData);
          return res.status(201).json(feed);
        }
        
        return res.status(400).json({ 
          message: errorMessage,
          details: details 
        });
      }
      
      const feed = await storage.createIcalFeed(req.user.id, feedData);
      res.status(201).json(feed);
    } catch (error) {
      console.error("Failed to create iCal feed:", error);
      res.status(500).json({ message: "Failed to create iCal feed" });
    }
  });

  app.put("/api/ical-feeds/:id", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const existingFeed = await storage.getIcalFeed(feedId);
      if (!existingFeed) {
        return res.status(404).json({ message: "Feed not found" });
      }
      
      // Admin can edit any feed, regular users can only edit their own
      if (!req.user.isAdmin && existingFeed.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Vi hopper over valideringssteget for iCal-feed oppdateringer
      // Hvis ikke URL endres, så trenger vi ikke å validere like strengt
      // Bare de feltene vi faktisk endrer blir sendt til databasen
      console.log("Mottatt data for oppdatering:", req.body);
      
      // Vi lagrer bare de feltene vi faktisk trenger å oppdatere
      const feedData: Partial<InsertIcalFeed> = {};
      
      if (req.body.name !== undefined) {
        feedData.name = req.body.name;
      }
      
      if (req.body.color !== undefined) {
        feedData.color = req.body.color;
      }
      
      if (req.body.enabled !== undefined) {
        feedData.enabled = req.body.enabled === true || req.body.enabled === "true";
      }
      
      if (req.body.url !== undefined) {
        feedData.url = req.body.url;
      }
      
      // Admin can change user assignment
      if (req.user.isAdmin && req.body.userId !== undefined) {
        feedData.userId = parseInt(req.body.userId);
      }
      
      console.log("Bearbeidet data for oppdatering:", feedData);
      
      // If URL is being updated, validate it
      if (feedData.url && feedData.url !== existingFeed.url) {
        // Make sure URL is properly formatted
        try {
          new URL(feedData.url);
        } catch (urlError) {
          return res.status(400).json({ message: "Invalid URL format. Please provide a complete URL including http:// or https://" });
        }
        
        // Check if this iCal URL is already in use by any user
        const allUsers = await storage.getAllUsers();
        for (const user of allUsers) {
          const userFeeds = await storage.getIcalFeeds(user.id);
          
          // Check if any user has this feed URL already
          const duplicateFeed = userFeeds.find(feed => feed.url === feedData.url);
          
          if (duplicateFeed) {
            return res.status(400).json({ 
              message: "Dette iCal-feeded er allerede i bruk av en annen bruker. Hver iCal-URL kan kun brukes av én bruker.",
              existingUserId: user.id,
              existingUsername: user.username
            });
          }
        }
        
        // Check if this is a Google Calendar URL, which may need special handling
        const isGoogleCalendar = feedData.url.includes('calendar.google.com');
        
        try {
          console.log("Attempting to fetch updated iCal URL:", feedData.url);
          
          // For Google Calendar or other potentially problematic services,
          // we'll accept a wider range of status codes
          const response = await axios.get(feedData.url, {
            timeout: 15000, // 15 second timeout for potentially slower services
            validateStatus: status => 
              // For Google Calendar URLs, we'll accept any valid response since they might redirect
              (isGoogleCalendar ? status < 500 : status === 200),
            headers: {
              // Some servers require a user agent
              'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)',
              'Accept': 'text/calendar,application/ics'
            }
          });
          
          if (response.status === 404 && isGoogleCalendar) {
            // Google sometimes uses different URLs or redirects, try to proceed anyway
            console.log("Google Calendar returned 404, but we'll try to update it anyway");
            
            // Skip validation for this case
            const updatedFeed = await storage.updateIcalFeed(feedId, feedData);
            return res.json(updatedFeed);
          }
          
          try {
            if (response.data) {
              await ical.async.parseICS(response.data);
            } else {
              throw new Error("Empty response from calendar server");
            }
          } catch (parseError) {
            console.log("Error parsing iCal data:", parseError);
            
            if (isGoogleCalendar) {
              // For Google Calendar, we might still want to allow it
              console.log("Google Calendar parsing failed, but we'll try to update it anyway");
              const updatedFeed = await storage.updateIcalFeed(feedId, feedData);
              return res.json(updatedFeed);
            }
            
            return res.status(400).json({ 
              message: "Could not parse iCal feed (invalid format)", 
              details: "The URL did not return valid iCal data. Check that the URL is correct and accessible."
            });
          }
        } catch (error: any) {
          console.log("Error fetching iCal URL:", error.message);
          
          let errorMessage = "Could not access or parse the iCal feed.";
          let details = "The calendar server may be down or the URL might be incorrect.";
          
          if (error.response) {
            errorMessage = `The server returned status ${error.response.status}`;
            details = "Check that the URL is correct and the calendar is publicly accessible.";
          } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'The URL could not be reached. Please check the domain name.';
            details = "The domain name might be misspelled or not exist.";
          } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused. The server may be down or not accepting connections.';
            details = "Try again later or check if the URL is correct.";
          } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            errorMessage = 'Connection timed out. The server took too long to respond.';
            details = "Try again later or check your network connection.";
          }
          
          // For Google Calendar URLs, we'll be more lenient and allow updating them anyway
          if (isGoogleCalendar) {
            console.log("Error with Google Calendar URL, but we'll try to update it anyway:", error.message);
            const updatedFeed = await storage.updateIcalFeed(feedId, feedData);
            return res.json(updatedFeed);
          }
          
          return res.status(400).json({ 
            message: errorMessage,
            details: details 
          });
        }
      }
      
      const updatedFeed = await storage.updateIcalFeed(feedId, feedData);
      res.json(updatedFeed);
    } catch (error) {
      res.status(500).json({ message: "Failed to update iCal feed" });
    }
  });

  app.delete("/api/ical-feeds/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const existingFeed = await storage.getIcalFeed(feedId);
      if (!existingFeed) {
        return res.status(404).json({ message: "Feed not found" });
      }
      
      // Check if feed belongs to the authenticated user or if the user is an admin
      if (existingFeed.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Få brukerID før feeden slettes
      const userId = existingFeed.userId;
      
      // Tøm cachen for denne feeden først
      clearIcalFeedCache(feedId);
      
      // Delete the feed and all its associated notes
      await storage.deleteIcalFeedAndNotes(feedId);
      
      // Hvis admin sletter en brukers feed, send varsling til brukeren
      if (req.user.isAdmin && userId !== req.user.id) {
        console.log(`Admin (${req.user.id}) slettet feed ${feedId} for bruker ${userId}, sender varsling`);
        notifyCalendarUpdate(userId);
      }
      
      res.status(200).json({ message: "Feed deleted successfully" });
    } catch (error) {
      console.error("Error deleting iCal feed:", error);
      res.status(500).json({ message: "Failed to delete feed" });
    }
  });

  // Endpoint to sync changes back to external iCal feed (available to all users for their own feeds)
  app.post("/api/ical-feeds/:id/sync", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const feed = await storage.getIcalFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed not found" });
      }
      
      // Check if feed belongs to the authenticated user
      if (feed.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Forbidden - Du har ikke tilgang til denne kalenderen" });
      }
      
      // Tøm cachen for denne feeden for å sikre friske data
      clearIcalFeedCache(feedId);
      
      // Get all events associated with this feed
      const allUserEvents = await storage.getEvents(feed.userId);
      
      // Filter only events that originated from this feed or are associated with it
      const eventsToSync = allUserEvents.filter(event => {
        // Include events created by the user that should be synced back to this feed
        // as well as events that originated from this feed and have been modified
        return (event.source && 
               typeof event.source === 'object' && 
               'feedId' in event.source && 
               event.source.feedId === feedId) ||
               // Also include local events that should be synced to the external calendar
               (!event.source && event.syncToExternal);
      });
      
      if (eventsToSync.length === 0) {
        return res.status(200).json({ 
          message: "Ingen hendelser å synkronisere", 
          syncedCount: 0
        });
      }
      
      // Generate iCal content for the events using our enhanced generator
      const icalContent = generateIcalContent(
        eventsToSync, 
        `${feed.name} (Oppdatert av Smart Hjem Kalender)`
      );
      
      // Determine the sync method based on the feed URL and configuration
      const feedUrl = new URL(feed.url);
      
      // Try different sync methods in sequence
      try {
        let syncSuccess = false;
        let syncMethod = '';
        let statusCode = 0;
        let responseMessage = '';
        
        // 1. Try WebDAV PUT if it's a HTTP/HTTPS URL
        if (feedUrl.protocol === 'https:' || feedUrl.protocol === 'http:') {
          syncMethod = 'WebDAV';
          try {
            const putResponse = await axios.put(feed.url, icalContent, {
              headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'If-None-Match': '*', // Only update if changed
                'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)'
              },
              timeout: 15000 // 15 second timeout for sync
            });
            
            if (putResponse.status >= 200 && putResponse.status < 300) {
              syncSuccess = true;
              statusCode = putResponse.status;
            } else {
              responseMessage = `External calendar returned status code: ${putResponse.status}`;
            }
          } catch (webDavError: any) {
            console.log(`WebDAV sync attempt failed: ${webDavError?.message}`);
            // Continue with other methods
          }
        }
        
        // 2. Try CalDAV if WebDAV failed and it's a caldav:// URL
        if (!syncSuccess && feedUrl.protocol === 'caldav:') {
          syncMethod = 'CalDAV';
          try {
            // CalDAV implementation would go here
            // For now, we'll just log that this method is not yet implemented
            console.log('CalDAV sync not implemented yet');
          } catch (caldavError: any) {
            console.log(`CalDAV sync attempt failed: ${caldavError?.message}`);
          }
        }
        
        // 3. Try API method if previous methods failed and it has an API endpoint configured
        if (!syncSuccess && feed.apiEndpoint) {
          syncMethod = 'API';
          try {
            const apiResponse = await axios.post(feed.apiEndpoint, {
              calendar: icalContent,
              calendarId: feed.externalId || feedId,
              format: 'ical'
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': feed.apiKey ? `Bearer ${feed.apiKey}` : undefined,
                'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)'
              },
              timeout: 15000
            });
            
            if (apiResponse.status >= 200 && apiResponse.status < 300) {
              syncSuccess = true;
              statusCode = apiResponse.status;
            } else {
              responseMessage = `API returned status code: ${apiResponse.status}`;
            }
          } catch (apiError: any) {
            console.log(`API sync attempt failed: ${apiError?.message}`);
          }
        }
        
        // 4. Generate downloadable iCal file if all sync methods failed
        if (!syncSuccess) {
          // Instead of failing, provide the iCal content as a downloadable file
          syncMethod = 'Download';
          syncSuccess = true; // Not actually synced, but we're providing an alternative
          
          // Set headers for file download
          res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${feed.name.replace(/[^a-z0-9]/gi, '_')}_calendar.ics"`
          });
          
          // Return the iCal content directly
          return res.status(200).send(icalContent);
        }
        
        // If any sync method succeeded (except download which returns directly)
        if (syncSuccess) {
          // Clear the cache for this feed to force a refresh on next fetch
          clearIcalFeedCache(feedId);
          
          // Update lastSynced timestamp
          await storage.updateIcalFeed(feedId, {
            lastSynced: new Date()
          });
          
          // Varsle brukeren om oppdatering hvis admin gjør endringer på brukers feed
          if (req.user.isAdmin && feed.userId !== req.user.id) {
            console.log(`Admin (${req.user.id}) synkroniserte feed ${feedId} for bruker ${feed.userId}, sender varsling`);
            notifyCalendarUpdate(feed.userId);
          }
          
          return res.status(200).json({ 
            message: `Hendelser ble synkronisert med ekstern kalender via ${syncMethod}`, 
            syncedCount: eventsToSync.length,
            method: syncMethod,
            statusCode: statusCode
          });
        } else {
          return res.status(400).json({ 
            message: "Kunne ikke synkronisere med ekstern kalender", 
            details: responseMessage || "Den eksterne kalenderen støtter kanskje ikke skriving eller krever autentisering."
          });
        }
      } catch (syncError: any) {
        console.error("Error syncing to external calendar:", syncError?.message);
        
        return res.status(400).json({ 
          message: "Kunne ikke synkronisere med ekstern kalender", 
          error: syncError?.message || "Ukjent feil",
          details: "Den eksterne kalenderen støtter kanskje ikke skriving eller krever autentisering."
        });
      }
    } catch (error) {
      console.error("Error in iCal sync endpoint:", error);
      res.status(500).json({ message: "Kunne ikke synkronisere iCal-feed" });
    }
  });

  // Get all iCal feeds for the authenticated user
  app.get("/api/ical-feeds", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const feeds = await storage.getIcalFeeds(req.user.id);
      res.json(feeds);
    } catch (error) {
      console.error("Error fetching iCal feeds:", error);
      res.status(500).json({ message: "Failed to fetch iCal feeds" });
    }
  });
  
  // Get all iCal feeds across all users (admin only)
  app.get("/api/admin/all-ical-feeds", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const feeds = await storage.getAllIcalFeeds();
      
      // Get all users to include user information with each feed
      const allUsers = await storage.getAllUsers();
      
      // Enrich feeds with user information
      const enrichedFeeds = feeds.map(feed => {
        const user = allUsers.find(u => u.id === feed.userId);
        return {
          ...feed,
          userInfo: user ? {
            id: user.id,
            username: user.username,
            name: user.name || user.username,
            email: user.email
          } : null
        };
      });
      
      res.json(enrichedFeeds);
    } catch (error) {
      console.error("Error fetching all iCal feeds:", error);
      res.status(500).json({ message: "Failed to fetch all iCal feeds" });
    }
  });
  
  // Force refresh a specific iCal feed (admin only)
  app.post("/api/admin/force-refresh-ical/:feedId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const feedId = parseInt(req.params.feedId);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      console.log(`Admin ${req.user.id} requesting force refresh of iCal feed ${feedId}`);
      
      await forceRefreshIcalFeed(feedId);
      
      res.json({ 
        message: "iCal-feed ble tvunget oppdatert. Gamle cached hendelser er fjernet.",
        feedId: feedId
      });
    } catch (error) {
      console.error("Error force refreshing iCal feed:", error);
      res.status(500).json({ message: "Kunne ikke tvinge oppdatering av iCal-feed" });
    }
  });

  // Fetch and parse iCal events for the authenticated user
  app.get("/api/ical-feed-events", isAuthenticated, async (req, res) => {
    try {
      // Get date filtering parameters
      const { startDate, endDate } = req.query;
      let dateFilter: { start?: Date; end?: Date } = {};
      
      if (startDate && typeof startDate === 'string') {
        dateFilter.start = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        dateFilter.end = new Date(endDate);
      }
      
      const feeds = await storage.getIcalFeeds(req.user.id);
      const enabledFeeds = feeds.filter(feed => feed.enabled);
      
      const allEvents: Event[] = [];
      
      for (const feed of enabledFeeds) {
        try {
          // Check if we have a valid cache entry for this feed
          const currentTime = Date.now();
          const cacheEntry = icalCache[feed.id];
          
          // Use cached data if it exists and is not expired (less than 3 seconds old)
          if (cacheEntry && (currentTime - cacheEntry.timestamp) < CACHE_DURATION) {
            console.log(`Using cached iCal feed ${feed.id} (${feed.name}), age: ${(currentTime - cacheEntry.timestamp)}ms`);
            allEvents.push(...cacheEntry.events);
            continue;
          }
          
          console.log(`Fetching iCal feed ${feed.id} (${feed.name}) from URL: ${feed.url}`);
          
          // Check if this is a Google Calendar URL, which may need special handling
          const isGoogleCalendar = feed.url.includes('calendar.google.com');
          
          // Make request with enhanced options
          const response = await axios.get(feed.url, {
            validateStatus: status => status < 500, // Accept all HTTP status codes < 500
            timeout: 15000, // 15 second timeout for potentially slow services
            headers: {
              // Some servers require a user agent
              'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)',
              'Accept': 'text/calendar,application/ics'
            }
          });
          
          // For Google Calendar URLs, we'll accept any 2xx/3xx/4xx response
          if ((isGoogleCalendar && response.status >= 500) || (!isGoogleCalendar && response.status !== 200)) {
            console.log(`iCal feed ${feed.id} returned status: ${response.status}`);
            
            // If it's a Google Calendar URL with a 404, we might still want to try
            if (!(isGoogleCalendar && response.status === 404)) {
              continue;
            }
          }
          
          try {
            // Extra debug info for Google Calendar URLs which can sometimes be problematic
            if (isGoogleCalendar) {
              console.log(`Processing Google Calendar feed ${feed.id}, data type: ${typeof response.data}, length: ${
                typeof response.data === 'string' ? response.data.length : 'unknown'
              }`);
            }
            
            let data = response.data;
            // Sometimes Google Calendar returns HTML with the calendar data embedded in it
            if (isGoogleCalendar && typeof data === 'string' && data.includes('<html') && data.includes('text/calendar')) {
              console.log(`Google Calendar feed ${feed.id} returned HTML, attempting to extract calendar data`);
              // Try to extract the calendar data from the HTML
              const calendarMatch = data.match(/BEGIN:VCALENDAR[\s\S]*END:VCALENDAR/);
              if (calendarMatch) {
                data = calendarMatch[0];
                console.log(`Successfully extracted calendar data from HTML for feed ${feed.id}`);
              }
            }
            
            const parsedEvents = await ical.async.parseICS(data);
            const feedEvents: Event[] = [];
            
            // Definer dato-range for hendelser vi vil inkludere (1 år bak, 1 år fremover)
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            
            console.log(`iCal feed ${feed.id}: Inkluderer hendelser fra ${oneYearAgo.toISOString()} til ${oneYearFromNow.toISOString()}`);
            
            // Convert iCal events to our format
            for (const key in parsedEvents) {
              const event = parsedEvents[key];
              if (event.type === 'VEVENT') {
                // Sjekk om hendelsen er innenfor vårt dato-vindu (1 år bak og 1 år frem i tid)
                const eventStart = new Date(event.start);
                
                if (eventStart < oneYearAgo || eventStart > oneYearFromNow) {
                  // Hopp over hendelsen hvis den er utenfor vårt dato-vindu
                  continue;
                }
                
                // For iCal events, we use a custom format with a string ID that includes "ical-{feedId}-{key}"
                // Since the Event type from the schema expects a number ID, we need to customize this
                // This isn't strictly type-safe but works for our application's needs
                const formattedEvent = {
                  id: `ical-${feed.id}-${key}`,
                  title: event.summary || 'Untitled Event',
                  description: event.description || '',
                  startTime: event.start,
                  endTime: event.end,
                  color: feed.color || "#0ea5e9", // Standardfarge blå for iCal-hendelser
                  allDay: !event.end || event.start.toDateString() === event.end.toDateString(),
                  source: {
                    type: 'ical',
                    feedId: feed.id,
                    feedName: feed.name
                  },
                  // These are technically required by the Event type but not used for iCal events
                  userId: feed.userId,
                  routes: null
                } as any as Event;
                
                feedEvents.push(formattedEvent);
                allEvents.push(formattedEvent);
                
                // For multi-day events, create a copy for each day in the range
                if (event.end && event.start && event.end > event.start) {
                  const startDate = new Date(event.start);
                  const endDate = new Date(event.end);
                  
                  // Check if this is a multi-day event (ignore same-day events ending late)
                  if (startDate.toDateString() !== endDate.toDateString()) {
                    const dayAfterStart = new Date(startDate);
                    dayAfterStart.setDate(dayAfterStart.getDate() + 1);
                    
                    // Create a separate event instance for each additional day
                    let currentDay = new Date(dayAfterStart);
                    currentDay.setHours(0, 0, 0, 0); // Start at midnight
                    
                    while (currentDay < endDate) {
                      // Create a clone of the event for this day
                      const dayEvent = {
                        ...formattedEvent,
                        id: `ical-${feed.id}-${key}-${currentDay.toISOString().split('T')[0]}`, // Unique ID per day
                        startTime: new Date(currentDay),
                        // If this is the last day, use the original end time, otherwise end at 23:59:59
                        endTime: new Date(currentDay),
                        title: `${event.summary || 'Untitled Event'} (fortsetter)`, // Indicate this is a continuation
                      } as any as Event;
                      
                      // Set end time to 23:59:59 for this day
                      dayEvent.endTime.setHours(23, 59, 59, 999);
                      
                      // Add this day's event to our collections
                      feedEvents.push(dayEvent);
                      allEvents.push(dayEvent);
                      
                      // Move to next day
                      currentDay.setDate(currentDay.getDate() + 1);
                    }
                  }
                }
              }
            }
            
            // Update lastSynced timestamp
            await storage.updateIcalFeed(feed.id, {
              lastSynced: new Date()
            });
            
            // Store in cache
            icalCache[feed.id] = {
              data: response.data, // Store the raw data
              events: feedEvents,  // Store the parsed events
              timestamp: currentTime
            };
            
          } catch (parseError) {
            console.error(`Error parsing iCal feed ${feed.id}:`, parseError);
          }
        } catch (error) {
          console.error(`Error fetching iCal feed ${feed.id}:`, error);
          // Continue with other feeds even if one fails
        }
      }
      
      // Sørg for at vi bare returnerer hendelser som tilhører brukeren
      let filteredEvents = allEvents.filter(event => 
        typeof event.userId === 'number' && event.userId === req.user.id
      );
      
      // Apply date filtering if specified to improve performance
      if (dateFilter.start || dateFilter.end) {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.startTime) return false;
          
          const eventStart = new Date(event.startTime);
          const eventEnd = event.endTime ? new Date(event.endTime) : eventStart;
          
          // Check if event overlaps with requested date range
          if (dateFilter.start && eventEnd < dateFilter.start) return false;
          if (dateFilter.end && eventStart > dateFilter.end) return false;
          
          return true;
        });
      }
      
      res.json(filteredEvents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch iCal events" });
    }
  });
  
  // DELETE /api/admin/events/:id - Admin sletter hendelse fra hvilken som helst brukers kalender
  app.delete("/api/admin/events/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    console.log('*****************************************************');
    console.log('ADMIN DELETE EVENT API CALLED - Event ID:', req.params.id);
    console.log('Admin user:', JSON.stringify(req.user));
    console.log('*****************************************************');
    
    try {
      // Handle both numeric and string IDs (for iCal events)
      const eventIdParam = req.params.id;
      let eventId: number;
      let isIcalEvent = false;
      
      // Check if this is an iCal event ID (string format like "ical-26-key")
      if (eventIdParam.startsWith('ical-') || eventIdParam.includes('-')) {
        console.log('ADMIN DELETE - Attempting to delete iCal event:', eventIdParam);
        return res.status(403).json({ 
          message: "iCal booking-hendelser kan ikke slettes, da de er synkronisert fra eksterne systemer. Deaktiver iCal-feeden i stedet." 
        });
      }
      
      eventId = parseInt(eventIdParam);
      if (isNaN(eventId)) {
        console.log('ADMIN DELETE - Invalid ID format');
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        console.log('ADMIN DELETE - Event not found');
        return res.status(404).json({ message: "Event not found" });
      }
      
      console.log('ADMIN DELETE - Event found:', {
        eventId,
        eventTitle: existingEvent.title,
        eventUserId: existingEvent.userId,
        adminUserId: req.user.id
      });
      
      // Admin kan slette alle bruker-opprettede hendelser
      const eventCopy = { ...existingEvent };
      
      // Slett hendelsen
      const deleteResult = await storage.deleteEvent(eventId);
      
      console.log('ADMIN DELETE - Delete result:', deleteResult);
      
      if (!deleteResult) {
        console.error('ADMIN DELETE - Failed to delete from database');
        return res.status(500).json({ message: "Failed to delete event from database" });
      }
      
      // Send varslinger til hendelsens eier
      const eventOwner = await storage.getUser(existingEvent.userId);
      if (eventOwner) {
        console.log('ADMIN DELETE - Sending notifications to event owner');
        
        // Send e-postvarsel til hendelsens eier
        await notifyDeletedEvent(req.user, eventOwner, eventCopy);
        
        // Send sanntidsvarsel til hendelsens eier
        const notification = createNotification(
          'event_deleted',
          'Administrator slettet hendelse',
          `Administrator har slettet hendelsen "${eventCopy.title}" fra din kalender`,
          eventOwner.id,
          req.user.id,
          eventId
        );
        
        sendNotificationToUser(eventOwner.id, notification);
        
        // Tøm cache for å sikre oppdateringer
        console.log("Tømmer hele iCal-cachen etter admin hendelsessletting");
        clearAllIcalCache();
        
        try {
          // Eksporter kalenderen på nytt som iCal for å oppdatere eksterne iCal linker
          console.log("Eksporterer kalender på nytt etter admin hendelsessletting");
          await exportUserCalendarAsIcal(eventOwner.id);
          console.log(`Kalendereksport oppdatert for bruker ${eventOwner.id} etter admin hendelsessletting`);
        } catch (exportError) {
          console.error("Feil ved oppdatering av kalendereksport:", exportError);
        }
      }
      
      res.status(200).json({ 
        message: "Event deleted successfully by admin",
        deletedEvent: {
          id: eventId,
          title: eventCopy.title,
          userId: eventCopy.userId
        }
      });
    } catch (error) {
      console.error('Feil ved admin sletting av hendelse:', error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Admin color override for events
  app.put("/api/admin/events/:id/color", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const { color } = req.body;
      if (!color || typeof color !== 'string') {
        return res.status(400).json({ message: "Valid color is required" });
      }

      // Validate color format (hex color)
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!colorRegex.test(color)) {
        return res.status(400).json({ message: "Invalid color format. Use hex format like #ff0000" });
      }

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if this is an iCal event - prevent color changes
      const isIcalEvent = event.source && 
                         typeof event.source === 'object' && 
                         'type' in event.source && 
                         event.source.type === 'ical';
      
      if (isIcalEvent) {
        return res.status(403).json({ 
          message: "iCal-hendelser kan ikke endre farge - de er alltid rosa for å skille dem fra lokale hendelser." 
        });
      }

      // Update the admin color override
      await storage.updateEventAdminColor(eventId, color);

      // Notify the event owner about the color change
      if (event.userId !== req.user.id) {
        const notification = createNotification(
          'event_updated',
          'Hendelsefarge endret av admin',
          `Administrator har endret fargen på hendelsen "${event.title}"`,
          event.userId,
          req.user.id,
          eventId
        );
        
        sendNotificationToUser(event.userId, notification);
      }

      res.status(200).json({ message: "Event color updated successfully" });
    } catch (error) {
      console.error("Error updating event color:", error);
      res.status(500).json({ message: "Failed to update event color" });
    }
  });

  // Admin routes for user management
  app.get("/api/admin/users", hasAdminAccess, async (req, res) => {
    try {
      // Get all users from storage
      const users = await storage.getAllUsers();
      
      // Remove password field for security
      const safeUsers = users.map((user: User) => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      // Validate user data
      const { username, password, name, email, isAdmin } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create new user
      const newUser = await storage.createUser({
        username,
        password,
        name: name || "",
        email: email || "",
        isAdmin: isAdmin || false
      });
      
      // Remove password before sending response
      const { password: _, ...safeUser } = newUser;
      
      res.status(201).json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.put("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get existing user
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow admin to remove their own admin status
      if (userId === req.user.id && existingUser.isAdmin && req.body.isAdmin === false) {
        return res.status(400).json({ message: "Cannot remove your own admin status" });
      }
      
      // Update user
      const { password, ...rawUpdateData } = req.body;
      
      // Convert timestamp fields to proper Date objects if they exist
      const updateData = { ...rawUpdateData };
      
      // Handle timestamp fields that might come as strings
      if (updateData.blockedAt && typeof updateData.blockedAt === 'string') {
        updateData.blockedAt = new Date(updateData.blockedAt);
      }
      if (updateData.adminInfoUpdatedAt && typeof updateData.adminInfoUpdatedAt === 'string') {
        updateData.adminInfoUpdatedAt = new Date(updateData.adminInfoUpdatedAt);
      }
      if (updateData.lastLoginAt && typeof updateData.lastLoginAt === 'string') {
        updateData.lastLoginAt = new Date(updateData.lastLoginAt);
      }
      
      // Remove null timestamp values that should be handled as undefined
      if (updateData.blockedAt === null) {
        updateData.blockedAt = undefined;
      }
      if (updateData.adminInfoUpdatedAt === null) {
        updateData.adminInfoUpdatedAt = undefined;
      }
      if (updateData.lastLoginAt === null) {
        updateData.lastLoginAt = undefined;
      }
      
      // Check if account number is being changed
      const isAccountNumberChanging = updateData.accountNumber !== undefined && 
                                      updateData.accountNumber !== existingUser.accountNumber;
      
      // Only update password if provided
      let updatedUser;
      if (password) {
        updatedUser = await storage.updateUser(userId, { ...updateData, password });
      } else {
        updatedUser = await storage.updateUser(userId, updateData);
      }
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log account number change if it occurred
      if (isAccountNumberChanging) {
        await storage.logAccountNumberChange(
          userId,
          req.user.id, // Admin who made the change
          existingUser.accountNumber || null,
          updateData.accountNumber || null,
          `Changed by admin: ${req.user.name || req.user.username}`
        );
        console.log(`Account number changed for user ${userId} by admin ${req.user.id}`);
      }
      
      // Remove password before sending response
      const { password: _, ...safeUser } = updatedUser;
      
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ 
        message: "Failed to update user", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Admin info updating route
  app.put("/api/admin/users/:id/admin-info", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Get existing user
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { adminInfo } = req.body;
      
      if (adminInfo === undefined) {
        return res.status(400).json({ message: "Admin info is required" });
      }
      
      const updatedUser = await storage.updateUserAdminInfo(userId, adminInfo);
      
      // Remove password before sending response
      const { password: _, ...safeUser } = updatedUser;
      
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating admin info:", error);
      res.status(500).json({ message: "Failed to update admin info" });
    }
  });
  
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Don't allow admin to delete themselves
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Delete user
      const result = await storage.deleteUser(userId);
      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  
  // Blokkering av brukere
  app.post("/api/admin/users/:id/block", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ugyldig bruker-ID" });
      }
      
      const { reason } = req.body;
      
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Du kan ikke blokkere din egen bruker" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      const updatedUser = await storage.updateUser(userId, {
        isBlocked: true,
        blockReason: reason || "Inaktiv bruker",
        blockedAt: new Date()
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Kunne ikke blokkere bruker" });
      }
      
      // Don't return password hash
      const { password, ...safeUser } = updatedUser;
      
      res.json({ 
        message: "Bruker blokkert", 
        user: safeUser 
      });
    } catch (error) {
      res.status(500).json({ message: "Feil ved blokkering av bruker", error: String(error) });
    }
  });
  
  // Fjern blokkering av bruker
  app.post("/api/admin/users/:id/unblock", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ugyldig bruker-ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      const updatedUser = await storage.updateUser(userId, {
        isBlocked: false,
        blockReason: null,
        blockedAt: null
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Kunne ikke fjerne blokkering av bruker" });
      }
      
      // Don't return password hash
      const { password, ...safeUser } = updatedUser;
      
      res.json({ 
        message: "Blokkering fjernet", 
        user: safeUser 
      });
    } catch (error) {
      res.status(500).json({ message: "Feil ved fjerning av blokkering", error: String(error) });
    }
  });
  
  // Admin and mini admin route to view a specific user's events (including iCal events)
  app.get("/api/admin/user-events/:userId", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get the user's regular events
      const events = await storage.getEvents(userId);
      
      // Get the user's iCal feeds
      const feeds = await storage.getIcalFeeds(userId);
      const enabledFeeds = feeds.filter(feed => feed.enabled);
      
      // Fetch and parse iCal events for this user
      const icalEvents: Event[] = [];
      
      for (const feed of enabledFeeds) {
        try {
          // Check if we have a valid cache entry for this feed
          const currentTime = Date.now();
          const cacheEntry = icalCache[feed.id];
          
          // Use cached data if it exists and is not expired (less than 30 seconds old)
          if (cacheEntry && (currentTime - cacheEntry.timestamp) < CACHE_DURATION) {
            console.log(`Admin view: Using cached iCal feed ${feed.id} (${feed.name}) for user ${userId}`);
            icalEvents.push(...cacheEntry.events);
            continue;
          }
          
          // If no valid cache, attempt to fetch new data
          console.log(`Admin view: Fetching iCal feed ${feed.id} (${feed.name}) for user ${userId}`);
          
          // Make request with enhanced options
          const response = await axios.get(feed.url, {
            validateStatus: status => status < 500,
            timeout: 15000,
            headers: {
              'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)',
              'Accept': 'text/calendar,application/ics'
            }
          });
          
          if (response.status < 400) {
            const data = response.data;
            const parsedEvents = await ical.async.parseICS(data);
            
            // Process the parsed events into our Event format
            const processedEvents: Event[] = [];
            
            // Definer dato-range for hendelser vi vil inkludere (1 år bak, 1 år fremover)
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            
            // Convert iCal events to our format
            for (const key in parsedEvents) {
              const event = parsedEvents[key];
              if (event.type === 'VEVENT') {
                // Sjekk om hendelsen er innenfor vårt dato-vindu (1 år bak og 1 år frem i tid)
                const eventStart = new Date(event.start);
                
                if (eventStart < oneYearAgo || eventStart > oneYearFromNow) {
                  // Hopp over hendelsen hvis den er utenfor vårt dato-vindu
                  continue;
                }
                
                // For iCal events, we use a custom format with a string ID that includes "ical-{feedId}-{key}"
                const formattedEvent = {
                  id: `ical-${feed.id}-${key}`,
                  title: event.summary || 'Untitled Event',
                  description: event.description || '',
                  startTime: event.start,
                  endTime: event.end,
                  color: feed.color || "#0ea5e9", // Standardfarge blå for iCal-hendelser
                  allDay: !event.end || event.start.toDateString() === event.end.toDateString(),
                  source: {
                    type: 'ical',
                    feedId: feed.id,
                    feedName: feed.name
                  },
                  // These are technically required by the Event type but not used for iCal events
                  userId: feed.userId,
                  routes: null
                } as any as Event;
                
                processedEvents.push(formattedEvent);
              }
            }
            
            // Update cache
            icalCache[feed.id] = {
              data: data,
              events: processedEvents,
              timestamp: currentTime
            };
            
            icalEvents.push(...processedEvents);
          } else {
            console.error(`Failed to fetch iCal feed ${feed.id} (${feed.name}) for user ${userId}, status: ${response.status}`);
          }
        } catch (error) {
          console.error(`Error processing iCal feed ${feed.id} for user ${userId}:`, error);
        }
      }
      
      // Combine regular events with iCal events
      const allEvents = [...events, ...icalEvents];
      res.json(allEvents);
    } catch (error) {
      console.error("Failed to fetch user events:", error);
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  // Marked days routes
  app.get("/api/marked-days", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate && req.query.endDate) {
        startDate = new Date(req.query.startDate as string);
        endDate = new Date(req.query.endDate as string);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        
        const markedDays = await storage.getMarkedDaysByDateRange(req.user.id, startDate, endDate);
        return res.json(markedDays);
      }
      
      const markedDays = await storage.getMarkedDays(req.user.id);
      res.json(markedDays);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marked days" });
    }
  });

  app.get("/api/marked-days/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const markedDayId = parseInt(req.params.id);
      if (isNaN(markedDayId)) {
        return res.status(400).json({ message: "Invalid marked day ID" });
      }
      
      const markedDay = await storage.getMarkedDay(markedDayId);
      if (!markedDay) {
        return res.status(404).json({ message: "Marked day not found" });
      }
      
      // Check if marked day belongs to the authenticated user
      if (markedDay.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(markedDay);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marked day" });
    }
  });

  app.post("/api/marked-days", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const validation = markedDayFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid marked day data", errors: validation.error.errors });
      }
      
      const markedDayData = validation.data;
      const markedDay = await storage.createMarkedDay(req.user.id, markedDayData);
      res.status(201).json(markedDay);
    } catch (error) {
      res.status(500).json({ message: "Failed to create marked day" });
    }
  });

  app.put("/api/marked-days/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const markedDayId = parseInt(req.params.id);
      if (isNaN(markedDayId)) {
        return res.status(400).json({ message: "Invalid marked day ID" });
      }
      
      const existingMarkedDay = await storage.getMarkedDay(markedDayId);
      if (!existingMarkedDay) {
        return res.status(404).json({ message: "Marked day not found" });
      }
      
      // Check if marked day belongs to the authenticated user
      if (existingMarkedDay.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validation = markedDayFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid marked day data", errors: validation.error.errors });
      }
      
      const markedDayData = validation.data;
      const updatedMarkedDay = await storage.updateMarkedDay(markedDayId, markedDayData);
      res.json(updatedMarkedDay);
    } catch (error) {
      res.status(500).json({ message: "Failed to update marked day" });
    }
  });

  app.delete("/api/marked-days/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const markedDayId = parseInt(req.params.id);
      if (isNaN(markedDayId)) {
        return res.status(400).json({ message: "Invalid marked day ID" });
      }
      
      const existingMarkedDay = await storage.getMarkedDay(markedDayId);
      if (!existingMarkedDay) {
        return res.status(404).json({ message: "Marked day not found" });
      }
      
      // Check if marked day belongs to the authenticated user
      if (existingMarkedDay.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteMarkedDay(markedDayId);
      res.status(200).json({ message: "Marked day deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marked day" });
    }
  });

  // Admin route to view a specific user's marked days
  app.get("/api/admin/user-marked-days/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get the user's marked days
      const markedDays = await storage.getMarkedDays(userId);
      res.json(markedDays);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user marked days" });
    }
  });
  
  // Admin-endepunkt: Opprett hendelse på vegne av en bruker
  app.post("/api/admin/user-events/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      
      if (isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Valider at målbrukeren eksisterer
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }
      
      // Valider hendelsesdata
      const validation = eventFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid event data", 
          errors: validation.error.errors 
        });
      }
      
      // Fikser dato-formatene for å unngå konverteringsproblemer
      const eventData = {
        ...validation.data,
        startTime: new Date(validation.data.startTime),
        endTime: validation.data.endTime ? new Date(validation.data.endTime) : undefined
      };
      
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      
      console.log("Admin creating event with processed data:", eventData);
      
      // Opprett hendelsen i databasen for målbrukeren, ikke admin
      const event = await storage.createEvent(targetUserId, eventData);
      
      console.log(`Admin created event for user ${targetUserId}, event ID: ${event.id}`);
      
      // Send sanntidsvarsel til målbrukeren
      const notification = createNotification(
        'event_created',
        'Ny hendelse fra administrator',
        `Administrator har lagt til en ny hendelse i din kalender: ${event.title}`,
        targetUserId, // Send til målbrukeren
        req.user.id, // Fra admin
        event.id
      );
      
      sendNotificationToUser(targetUserId, notification);
      
      // Tøm HELE cache-en for å sikre at alle ser oppdateringer umiddelbart
      console.log("Tømmer hele iCal-cachen etter at admin har opprettet hendelse for bruker");
      clearAllIcalCache();
      
      try {
        // Eksporter målbrukerens kalender på nytt som iCal for å oppdatere eksterne iCal-linker
        console.log(`Eksporterer kalender for bruker ${targetUserId} på nytt etter admin-hendelsesoppretting`);
        await exportUserCalendarAsIcal(targetUserId);
      } catch (exportError) {
        console.error("Feil ved oppdatering av kalendereksport:", exportError);
      }
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Feil ved admin-oppretting av hendelse for bruker:', error);
      res.status(500).json({ message: "Failed to create event for user" });
    }
  });
  
  // Nytt endepunkt: Admin og mini admin rute for å vise en bestemt brukers kalender
  // Kan tømme cache for å garantere ferske data (hvis force_refresh=true)
  app.get("/api/admin/user-calendar/:userId", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Sjekk at brukeren eksisterer
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`Admin view: Fetching complete calendar for user ${userId}`);
      
      // Sjekk om vi skal tvinge full refresh (når eksplisitt forespurt via force_refresh query parameter)
      const forceRefresh = req.query.force_refresh === 'true';
      
      // Tøm hele cachen bare hvis force_refresh er satt
      if (forceRefresh) {
        console.log("Tømmer HELE iCal-cachen for å sikre ferske data (force_refresh=true)");
        clearAllIcalCache();
      }
      
      // Hent brukerens vanlige hendelser
      const userEvents = await storage.getEvents(userId);
      console.log(`Admin view: Fetched ${userEvents.length} regular events for user ${userId}`);
      
      // Hent brukerens iCal feeds
      const userFeeds = await storage.getIcalFeeds(userId);
      const enabledFeeds = userFeeds.filter(feed => feed.enabled);
      console.log(`Admin view: User ${userId} has ${enabledFeeds.length} enabled iCal feeds`);
      
      // Samle iCal hendelser
      let allIcalEvents: Event[] = [];
      
      // Hent data fra hver feed
      for (const feed of enabledFeeds) {
        try {
          console.log(`Admin view: Fetching iCal feed ${feed.id} (${feed.name})`);
          
          // Hent rå iCal-data (med timeout og feilhåndtering)
          const icalResponse = await axios.get(feed.url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Smart-Hjem-Calendar/1.0',
              'Accept': 'text/calendar,application/ics'
            }
          });
          
          if (icalResponse.status === 200) {
            // Parse iCal data
            const icalData = icalResponse.data;
            const parsedCal = await ical.async.parseICS(icalData);
            
            // Konverter til hendelser
            const feedEvents: Event[] = [];
            
            // For å unngå dupliserte hendelser (spesielt viktig i multi-day events)
            const uniqueEventKeys = new Set<string>();
            
            for (const k in parsedCal) {
              const ev = parsedCal[k];
              
              if (ev.type === 'VEVENT') {
                if (ev.start) {
                  const startTime = ev.start;
                  const endTime = ev.end || new Date(startTime.getTime() + 60 * 60 * 1000);
                  
                  // For multi-day events, create one event per day
                  if (endTime && endTime.getDate() !== startTime.getDate()) {
                    const days = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24));
                    const maxDays = Math.min(days, 30);
                    
                    for (let i = 0; i < maxDays; i++) {
                      const currentDay = new Date(startTime);
                      currentDay.setDate(currentDay.getDate() + i);
                      
                      let dayStartTime, dayEndTime;
                      
                      if (i === 0) {
                        dayStartTime = new Date(currentDay);
                        dayStartTime.setHours(
                          startTime.getHours(),
                          startTime.getMinutes(),
                          startTime.getSeconds()
                        );
                      } else {
                        dayStartTime = new Date(currentDay);
                        dayStartTime.setHours(0, 0, 0, 0);
                      }
                      
                      if (i === maxDays - 1) {
                        dayEndTime = new Date(currentDay);
                        dayEndTime.setHours(
                          endTime.getHours(),
                          endTime.getMinutes(), 
                          endTime.getSeconds()
                        );
                        
                        if (dayEndTime.getHours() === 0 && 
                            dayEndTime.getMinutes() === 0 && 
                            dayEndTime.getSeconds() === 0) {
                          dayEndTime.setHours(23, 59, 59);
                        }
                      } else {
                        dayEndTime = new Date(currentDay);
                        dayEndTime.setHours(23, 59, 59, 999);
                      }
                      
                      const dayEvent: Event = {
                        id: -1,
                        userId: userId,
                        title: ev.summary || "Untitled Event",
                        description: ev.description || null,
                        startTime: dayStartTime,
                        endTime: dayEndTime,
                        color: feed.color || "#0ea5e9", // Standard blå for iCal
                        allDay: false,
                        routes: null,
                        source: {
                          feedId: feed.id,
                          uid: ev.uid || k,
                          calendarId: feed.url,
                          type: 'ical',
                          day: i
                        },
                        isCollaborative: null,
                        collaborationCode: null
                      };
                      
                      // Lag en unik nøkkel for denne hendelsen for å unngå duplikater
                      const eventKey = `${ev.uid || k}-day${i}-${dayStartTime.toISOString()}`;
                      
                      // Legg bare til hendelsen hvis vi ikke allerede har lagt til en identisk hendelse
                      if (!uniqueEventKeys.has(eventKey)) {
                        uniqueEventKeys.add(eventKey);
                        feedEvents.push(dayEvent);
                      }
                    }
                  } else {
                    // Regular single-day event
                    const dayEvent: Event = {
                      id: -1,
                      userId: userId,
                      title: ev.summary || "Untitled Event",
                      description: ev.description || null,
                      startTime: startTime,
                      endTime: endTime,
                      color: feed.color || "#0ea5e9", // Standard blå for iCal
                      allDay: false,
                      routes: null,
                      source: {
                        feedId: feed.id,
                        uid: ev.uid || k,
                        calendarId: feed.url,
                        type: 'ical'
                      },
                      isCollaborative: null,
                      collaborationCode: null
                    };
                    
                    // Lag en unik nøkkel for denne hendelsen for å unngå duplikater
                    const eventKey = `${ev.uid || k}-${startTime.toISOString()}`;
                    
                    // Legg bare til hendelsen hvis vi ikke allerede har lagt til en identisk hendelse
                    if (!uniqueEventKeys.has(eventKey)) {
                      uniqueEventKeys.add(eventKey);
                      feedEvents.push(dayEvent);
                    }
                  }
                }
              }
            }
            
            // Legg til hendelser for denne feeden
            allIcalEvents = [...allIcalEvents, ...feedEvents];
            console.log(`Admin view: Added ${feedEvents.length} events from feed ${feed.id}`);
            
            // Oppdater lastSynced i databasen
            await storage.updateIcalFeed(feed.id, { lastSynced: new Date() });
            
            // Oppdater også cachen for vanlige brukere
            icalCache[feed.id] = {
              data: icalData,
              events: feedEvents,
              timestamp: Date.now()
            };
          }
        } catch (feedError) {
          console.error(`Error fetching iCal feed ${feed.id}:`, feedError);
        }
      }
      
      // Kombiner alle hendelser
      const allEvents = [...userEvents, ...allIcalEvents];
      
      // Sorter hendelser etter startdato
      allEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      console.log(`Admin view: Returning ${allEvents.length} total events (${userEvents.length} user events + ${allIcalEvents.length} iCal events) for user ${userId}`);
      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching user calendar:", error);
      res.status(500).json({ message: "Failed to fetch user calendar" });
    }
  });
  
  // iCal event notes routes
  app.get("/api/ical-event-notes", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const notes = await storage.getIcalEventNotes(req.user.id);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch iCal event notes" });
    }
  });
  
  app.get("/api/ical-event-notes/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const note = await storage.getIcalEventNote(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if note belongs to the authenticated user
      if (note.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch note" });
    }
  });
  
  app.get("/api/ical-event-notes/event/:eventExternalId", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const eventExternalId = req.params.eventExternalId;
      
      if (!eventExternalId) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const note = await storage.getIcalEventNoteByExternalId(req.user.id, eventExternalId);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      res.json(note);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch note" });
    }
  });
  
  app.post("/api/ical-event-notes", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const validation = icalEventNoteFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid note data", errors: validation.error.errors });
      }
      
      const noteData = validation.data;
      
      // Check if a note for this event already exists
      const existingNote = await storage.getIcalEventNoteByExternalId(req.user.id, noteData.eventExternalId);
      if (existingNote) {
        return res.status(409).json({ 
          message: "A note for this iCal event already exists",
          existingNote: existingNote
        });
      }
      
      const note = await storage.createIcalEventNote(req.user.id, noteData);
      res.status(201).json(note);
    } catch (error) {
      res.status(500).json({ message: "Failed to create note" });
    }
  });
  
  app.put("/api/ical-event-notes/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const existingNote = await storage.getIcalEventNote(noteId);
      if (!existingNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if note belongs to the authenticated user
      if (existingNote.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validation = icalEventNoteFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid note data", errors: validation.error.errors });
      }
      
      const noteData = validation.data;
      const updatedNote = await storage.updateIcalEventNote(noteId, noteData);
      res.json(updatedNote);
    } catch (error) {
      res.status(500).json({ message: "Failed to update note" });
    }
  });
  
  app.delete("/api/ical-event-notes/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ message: "Invalid note ID" });
      }
      
      const existingNote = await storage.getIcalEventNote(noteId);
      if (!existingNote) {
        return res.status(404).json({ message: "Note not found" });
      }
      
      // Check if note belongs to the authenticated user
      if (existingNote.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      await storage.deleteIcalEventNote(noteId);
      res.status(200).json({ message: "Note deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // User profile update route
  app.put("/api/user/profile", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, email, phoneNumber, accountNumber } = req.body;
      
      // Get current user data to check for account number changes
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if account number is being changed
      const isAccountNumberChanging = accountNumber !== undefined && 
                                      accountNumber !== currentUser.accountNumber;
      
      const updatedUser = await storage.updateUser(req.user.id, {
        name,
        email,
        phoneNumber,
        accountNumber
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log account number change if it occurred
      if (isAccountNumberChanging) {
        await storage.logAccountNumberChange(
          req.user.id,
          req.user.id, // User changed their own account number
          currentUser.accountNumber || null,
          accountNumber || null,
          'Changed by user'
        );
        console.log(`User ${req.user.id} changed their own account number`);
      }
      
      // Remove password before sending response
      const { password: _, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User's own payouts routes
  app.get("/api/user/payouts/year/:year", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const year = parseInt(req.params.year);
      if (isNaN(year)) {
        return res.status(400).json({ message: "Invalid year" });
      }
      
      // Debug logging
      console.log(`Fetching payouts for user ID: ${req.user.id}, year: ${year}`);
      console.log(`User email: ${req.user.email}, name: ${req.user.name}`);
      
      const payouts = await storage.getPayoutsByYear(req.user.id, year);
      
      console.log(`Found ${payouts?.length || 0} payouts for user ${req.user.id}`);
      
      res.json(payouts || []);
    } catch (error) {
      console.error("Error fetching user payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // System settings routes
  app.get("/api/system-settings", async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error retrieving system settings:", error);
      res.status(500).send("Failed to retrieve system settings");
    }
  });

  app.get("/api/system-settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSystemSettingByKey(req.params.key);
      if (!setting) {
        return res.status(404).send("Setting not found");
      }
      res.json(setting);
    } catch (error) {
      console.error(`Error retrieving system setting ${req.params.key}:`, error);
      res.status(500).send("Failed to retrieve system setting");
    }
  });

  app.post("/api/system-settings", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const settingData = systemSettingFormSchema.parse(req.body);
      const setting = await storage.createSystemSetting(settingData);
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating system setting:", error);
      res.status(500).send("Failed to create system setting");
    }
  });

  app.put("/api/system-settings/:key", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { value } = req.body;
      if (!value) {
        return res.status(400).json({ error: "Value is required" });
      }
      const updatedSetting = await storage.updateSystemSetting(req.params.key, value);
      if (!updatedSetting) {
        return res.status(404).send("Setting not found");
      }
      res.json(updatedSetting);
    } catch (error) {
      console.error(`Error updating system setting ${req.params.key}:`, error);
      res.status(500).send("Failed to update system setting");
    }
  });

  // Maintenance mode endpoints
  
  // Get maintenance mode status (public endpoint)
  app.get("/api/maintenance-status", async (req, res) => {
    try {
      const maintenanceSetting = await storage.getSystemSettingByKey("maintenance.enabled");
      const messageSetting = await storage.getSystemSettingByKey("maintenance.message");
      const maintenanceEnabled = maintenanceSetting?.value;
      const maintenanceMessage = messageSetting?.value || "Siden er under ombygging og vil være snart tilbake";
      
      res.json({
        enabled: maintenanceEnabled === 'true',
        message: maintenanceMessage
      });
    } catch (error) {
      console.error("Error checking maintenance status:", error);
      res.json({ enabled: false, message: "" });
    }
  });

  // Toggle maintenance mode (admin only)
  app.post("/api/admin/maintenance-mode", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { enabled, message } = req.body;
      
      // Update maintenance enabled status
      await storage.updateSystemSetting("maintenance.enabled", enabled ? 'true' : 'false');
      
      // Update maintenance message if provided
      if (message) {
        await storage.updateSystemSetting("maintenance.message", message);
      }
      
      console.log(`Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'} by admin ${req.user!.name}`);
      
      res.json({ 
        success: true, 
        enabled, 
        message: message || "Siden er under ombygging og vil være snart tilbake"
      });
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      res.status(500).json({ message: "Failed to toggle maintenance mode" });
    }
  });
  
  // On-demand session cleanup (admin only)
  app.post("/api/admin/cleanup-sessions", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const expired = await cleanupExpiredSessions();
      const old = await cleanupOldSessions(30);
      
      console.log(`Session cleanup by admin ${req.user!.name}: ${expired} expired, ${old} old sessions removed`);
      
      res.json({ 
        success: true, 
        expiredRemoved: expired,
        oldRemoved: old,
        message: `Ryddet opp ${expired + old} sesjoner`
      });
    } catch (error) {
      console.error("Error cleaning up sessions:", error);
      res.status(500).json({ message: "Failed to cleanup sessions" });
    }
  });
  
  // Backup system API routes
  
  // List available backups (admin only)
  app.get("/api/admin/backups", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const backupsList = await getBackupsList();
      res.json(backupsList);
    } catch (error) {
      console.error("Error fetching backups list:", error);
      res.status(500).json({ message: "Failed to fetch backups list" });
    }
  });
  
  // Create a manual backup (admin only)
  app.post("/api/admin/backups", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const filename = await createBackup(false); // false = manual backup
      res.status(201).json({ 
        message: "Backup created successfully", 
        filename 
      });
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ 
        message: "Failed to create backup", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Restore from backup (admin only)
  app.post("/api/admin/backups/restore/:filename", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { filename } = req.params;
      if (!filename) {
        return res.status(400).json({ message: "Backup filename is required" });
      }
      
      const success = await restoreBackup(filename);
      if (success) {
        res.json({ message: "Backup restored successfully" });
      } else {
        res.status(500).json({ message: "Failed to restore backup" });
      }
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ 
        message: "Failed to restore backup", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // CSV Import functionality (admin only)
  
  // Import Beds24 bookings from CSV file
  app.post("/api/admin/import-beds24-csv/:userId", isAdmin, upload.single('csvFile'), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Admin ${req.user!.name} importing Beds24 CSV for user ${user.name}`);

      const csvContent = req.file.buffer.toString('utf-8');
      const results: any[] = [];

      // Parse CSV content
      await new Promise((resolve, reject) => {
        const stream = require('stream');
        const bufferStream = new stream.Readable();
        bufferStream.push(csvContent);
        bufferStream.push(null);

        bufferStream
          .pipe(csv())
          .on('data', (data: any) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      console.log(`Parsed ${results.length} rows from CSV`);

      // Process each row and create events
      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (const row of results) {
        try {
          // Skip empty rows or rows without booking number
          if (!row.Number || row.Number === '') {
            skipped++;
            continue;
          }

          // Parse dates
          const checkIn = new Date(row['Check In']);
          const checkOut = new Date(row['Check Out']);
          
          if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            console.log(`Skipping row with invalid dates: ${row.Number}`);
            errors++;
            continue;
          }

          // Determine color based on status
          let color = '#10b981'; // Default green for confirmed
          if (row.Status === 'New') {
            color = '#3b82f6'; // Blue for new bookings
          }
          if (row.Flag === 'VIP') {
            color = '#f59e0b'; // Orange for VIP
          }

          // Build description with all available info
          const description = [
            `Booking ID: ${row.Number}`,
            `Guest: ${row['Full Name'] || 'Guest'}`,
            row.Email ? `Email: ${row.Email}` : null,
            row.Adults || row.Children ? `Adults: ${row.Adults || 0}, Children: ${row.Children || 0}` : null,
            row.Nights ? `Nights: ${row.Nights}` : null,
            row.Referrer ? `Source: ${row.Referrer}` : null,
            row.Status ? `Status: ${row.Status}` : null,
            row.Flag ? `Flag: ${row.Flag}` : null
          ].filter(Boolean).join('\n');

          // Create event object
          const eventData = {
            title: row['Full Name'] || 'Guest',
            description: sanitizeEventDescription(description),
            startTime: checkIn,
            endTime: checkOut,
            userId: userId,
            allDay: true,
            color: color,
            csvProtected: true, // Mark as protected from API overwriting
            source: JSON.stringify({
              uid: `beds24-${row.Number}`,
              type: 'beds24',
              bookingId: row.Number,
              status: row.Status?.toLowerCase() || 'new',
              flag: row.Flag || null,
              referrer: row.Referrer || null,
              importedAt: new Date().toISOString(),
              csvImported: true
            })
          };

          // Check if event already exists
          const existingEvents = await storage.getEventsBySource(`beds24-${row.Number}`);
          
          if (existingEvents.length > 0) {
            // Update existing event
            await storage.updateEvent(existingEvents[0].id, eventData);
            console.log(`Updated booking ${row.Number} for ${row['Full Name']}`);
          } else {
            // Create new event
            await storage.createEvent(eventData);
            console.log(`Imported booking ${row.Number} for ${row['Full Name']}`);
          }
          
          imported++;

        } catch (error) {
          console.error(`Error processing row ${row.Number}:`, error);
          errors++;
        }
      }

      console.log(`CSV import completed: ${imported} imported, ${skipped} skipped, ${errors} errors`);

      res.json({
        success: true,
        message: `CSV import completed successfully`,
        stats: {
          totalRows: results.length,
          imported,
          skipped,
          errors
        }
      });

    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ 
        message: "Failed to import CSV file", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // User-specific CSV import for Geir Stølen (hardcoded for user ID 14)
  app.post("/api/import-geir-csv", isAdmin, upload.single('csvFile'), async (req: AuthenticatedRequest, res) => {
    try {
      const GEIR_USER_ID = 14; // Hardcoded for Geir Stølen
      
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file uploaded" });
      }

      // Verify the user exists
      const user = await storage.getUser(GEIR_USER_ID);
      if (!user || user.name !== "Geir Stølen") {
        return res.status(404).json({ message: "User Geir Stølen not found" });
      }

      console.log(`Importing CSV for user ${user.name} (ID: ${GEIR_USER_ID})`);

      const csvContent = req.file.buffer.toString('utf-8');
      const results: any[] = [];

      // Parse CSV content
      await new Promise((resolve, reject) => {
        const { Readable } = stream;
        const bufferStream = new Readable();
        bufferStream.push(csvContent);
        bufferStream.push(null);

        bufferStream
          .pipe(csv())
          .on('data', (data: any) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });

      console.log(`Parsed ${results.length} rows from CSV`);

      // Process each row and create events
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const row of results) {
        try {
          // Skip empty rows or rows without booking number
          if (!row.Number || row.Number === '') {
            skipped++;
            continue;
          }

          // Parse dates
          const checkInStr = row['Check In'];
          const checkOutStr = row['Check Out'];
          
          if (!checkInStr || !checkOutStr) {
            console.log(`Skipping row ${row.Number}: Missing dates`);
            skipped++;
            continue;
          }
          
          const checkIn = new Date(checkInStr);
          const checkOut = new Date(checkOutStr);
          
          if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            console.log(`Skipping row ${row.Number}: Invalid dates - ${checkInStr} to ${checkOutStr}`);
            errors++;
            continue;
          }

          // Determine color based on status
          let color = '#10b981'; // Default green for confirmed
          if (row.Status === 'New') {
            color = '#3b82f6'; // Blue for new bookings
          } else if (row.Status === 'Cancelled') {
            color = '#ef4444'; // Red for cancelled
          }
          
          // Special handling for owner blocks
          const guestName = row['Full Name'] || 'Guest';
          const isOwnerBlock = guestName.toLowerCase().includes('eier') || 
                              guestName.toLowerCase().includes('sperre');
          
          if (isOwnerBlock) {
            color = '#f59e0b'; // Orange for owner blocks
          }

          // Build simplified description with only essential info
          const descriptionParts = [
            `Booking #${row.Number}`,
            row.Nights ? `Nights: ${row.Nights}` : null,
            `Adults: ${row.Adults || 0}`,
            `Children: ${row.Children || 0}`,
            row['Booking Date'] ? `Booking Date: ${row['Booking Date']}` : null,
            row.Referrer ? `Source: ${row.Referrer}` : null
          ].filter(Boolean).join('\n');

          // Create event object (no userId as it's passed separately)
          const eventData = {
            title: guestName,
            description: sanitizeEventDescription(descriptionParts),
            startTime: checkIn,
            endTime: checkOut,
            allDay: true,
            color: color,
            csvProtected: true, // Mark as protected from API/iCal overwriting
            location: row.Property || 'Flott Feriehus i Øksnevik',
            source: JSON.stringify({
              uid: `geir-csv-${row.Number}`,
              type: 'csv',
              bookingId: row.Number,
              status: row.Status?.toLowerCase() || 'new',
              flag: row.Flag || null,
              referrer: row.Referrer || null,
              property: row.Property || null,
              importedAt: new Date().toISOString(),
              csvImported: true,
              csvSource: 'geir-import'
            })
          };

          // Check if event already exists by booking number
          const existingEvents = await storage.getEventsBySource(`geir-csv-${row.Number}`);
          
          if (existingEvents && existingEvents.length > 0) {
            // Update existing event
            await storage.updateEvent(existingEvents[0].id, eventData);
            console.log(`Updated existing booking ${row.Number} for ${guestName}`);
            updated++;
          } else {
            // Also check for beds24 duplicates (in case this was previously imported differently)
            const beds24Events = await storage.getEventsBySource(`beds24-${row.Number}`);
            
            if (beds24Events && beds24Events.length > 0) {
              // Update the existing beds24 event to the new format
              await storage.updateEvent(beds24Events[0].id, eventData);
              console.log(`Migrated beds24 booking ${row.Number} to Geir CSV format`);
              updated++;
            } else {
              // Create new event - ensure it doesn't already exist before creating
              console.log(`Creating new event for booking ${row.Number}`);
              await storage.createEvent(GEIR_USER_ID, eventData);
              console.log(`Successfully imported booking ${row.Number} for ${guestName}`);
              imported++;
            }
          }

        } catch (error) {
          console.error(`Error processing row ${row.Number}:`, error);
          errors++;
        }
      }

      console.log(`CSV import completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors} errors`);

      res.json({
        success: true,
        message: `CSV import for Geir Stølen completed successfully`,
        stats: {
          totalRows: results.length,
          imported,
          updated,
          skipped,
          errors
        }
      });

    } catch (error) {
      console.error("Error importing Geir CSV:", error);
      res.status(500).json({ 
        message: "Failed to import CSV file for Geir Stølen", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Password management routes (admin only)
  
  // Admin: Change user password
  app.post("/api/admin/users/:id/change-password", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ugyldig bruker-ID" });
      }
      
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Nytt passord må være minst 8 tegn langt" });
      }
      
      // Hent eksisterende bruker
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      // Oppdater passord
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      res.json({ message: "Passord endret for bruker" });
    } catch (error) {
      console.error("Error changing user password:", error);
      res.status(500).json({ 
        message: "Kunne ikke endre brukerens passord", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Admin: Generate password reset link
  app.post("/api/admin/users/:id/reset-password", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ugyldig bruker-ID" });
      }
      
      // Hent eksisterende bruker
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      // Opprett en tilbakestillingstoken
      const token = await generatePasswordResetToken(userId);
      
      // Bygg tilbakestillingslenken
      // I produksjonsmiljø ville dette typisk settes som en miljøvariabel
      const baseUrl = process.env.FRONTEND_URL || `http://${req.headers.host}`;
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      
      res.json({ 
        message: "Tilbakestillingslenke generert", 
        resetLink,
        token // Dette ville vanligvis bli sendt via e-post, ikke direkte i API-svaret
      });
    } catch (error) {
      console.error("Error generating password reset link:", error);
      res.status(500).json({ 
        message: "Kunne ikke generere tilbakestillingslenke", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Verify and use reset token (for regular users)
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token og nytt passord er påkrevd" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Nytt passord må være minst 8 tegn langt" });
      }
      
      // Valider token og få bruker-ID
      const userId = await validatePasswordResetToken(token);
      
      if (!userId) {
        return res.status(400).json({ message: "Ugyldig eller utløpt token" });
      }
      
      // Hent bruker
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      // Oppdater brukerens passord
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userId, { password: hashedPassword });
      
      // Merk token som brukt
      await markTokenAsUsed(token);
      
      res.json({ message: "Passord tilbakestilt suksessfullt" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ 
        message: "Kunne ikke tilbakestille passord", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Export calendar as iCal file (for users and admins)
  app.get("/api/calendar/export-ical", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.id;
      const icalContent = await exportUserCalendarAsIcal(userId);
      
      res.set('Content-Type', 'text/calendar');
      res.set('Content-Disposition', `attachment; filename="calendar-export-${userId}.ics"`);
      res.send(icalContent);
    } catch (error) {
      console.error("Error exporting calendar:", error);
      res.status(500).json({ 
        message: "Failed to export calendar", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Istedenfor å modifisere eksisterende ruter, lager vi nye varslingsendepunkter
  
  // Nytt endepunkt for å registrere WebSocket-klienten for en bruker
  app.post("/api/notifications/register", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // Brukerens ID kommer fra autentisert bruker
      const userId = req.user.id;
      
      // Send en bekreftelsesmelding
      res.status(200).json({ 
        success: true, 
        message: "WebSocket-registrering vellykket. Koble til /ws for å motta sanntidsvarsler."
      });
      
      console.log(`Bruker ${userId} har registrert seg for varsler`);
    } catch (error) {
      console.error('Feil ved registrering for varsler:', error);
      res.status(500).json({ 
        success: false, 
        message: "Kunne ikke registrere for varsler" 
      });
    }
  });
  
  // Nytt endepunkt for å teste varslinger (bare for admin)
  app.post("/api/notifications/test", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Bruker ikke funnet" });
      }
      
      // Lag et testvarsel
      const notification = createNotification(
        'system',
        'Testvarsel',
        `Dette er et testvarsel fra systemet. Tidsstempel: ${new Date().toLocaleString('nb-NO')}`,
        userId,
        userId
      );
      
      // Send varslet via WebSocket
      sendNotificationToUser(userId, notification);
      
      // Send en e-postvarsel
      const emailSent = await sendCalendarNotification(
        user,
        "Testvarsel fra Smart Hjem Kalender",
        "Dette er en test av e-postvarslingssystemet. Hvis du mottar denne meldingen, er e-postvarsling satt opp riktig."
      );
      
      res.status(200).json({ 
        success: true, 
        message: "Testvarsel sendt", 
        emailSent 
      });
    } catch (error) {
      console.error('Feil ved sending av testvarsel:', error);
      res.status(500).json({ 
        success: false, 
        message: "Kunne ikke sende testvarsel" 
      });
    }
  });
  
  // Modifiser hendelsesendepunktene direkte med varslingsfunksjonalitet
  
  // POST /api/events - Opprett hendelse
  app.post("/api/events", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const validation = eventFormSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid event data", errors: validation.error.errors });
      }
      
      const eventData = validation.data;
      
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      
      // Sjekk om brukerID er angitt og om den som oppretter er admin
      let userId = req.user.id;
      if (req.body.userId !== undefined && req.user.isAdmin) {
        // Admin kan opprette hendelser på vegne av andre brukere
        userId = parseInt(req.body.userId);
        console.log(`Admin oppretter hendelse på vegne av bruker ${userId}`);
      }
      
      const event = await storage.createEvent(userId, eventData);
      
      // Send blokkering til Beds24 hvis brukeren har Beds24-konfigurasjon
      try {
        const beds24Client = new Beds24ApiClient(userId);
        const initialized = await beds24Client.initialize();
        
        if (initialized) {
          const startDate = new Date(eventData.startTime);
          const endDate = new Date(eventData.endTime);
          
          const result = await beds24Client.createBlock(startDate, endDate, eventData.title);
          
          if (result.success && result.bookingId) {
            console.log(`Created Beds24 block ${result.bookingId} for event ${event.id}`);
            
            await storage.updateEvent(event.id, {
              source: {
                type: 'local_with_beds24',
                beds24BookingId: result.bookingId
              }
            });
          } else if (!result.success) {
            console.warn(`Could not create Beds24 block for event ${event.id}: ${result.error}`);
          }
        }
      } catch (beds24Error) {
        console.warn('Beds24 block creation failed (non-fatal):', beds24Error);
      }
      
      // Hent brukerinformasjon
      const user = await storage.getUser(req.user.id);
      
      if (user) {
        // Send e-postvarsel
        await notifyNewEvent(user, user, event);
        
        // Send sanntidsvarsel
        const notification = createNotification(
          'event_created',
          'Ny kalenderhendelse',
          `Ny hendelse "${event.title}" er opprettet for ${new Date(event.startTime).toLocaleString('nb-NO')}`,
          user.id,
          user.id,
          event.id
        );
        
        sendNotificationToUser(user.id, notification);
        
        // Tøm HELE cache-en for å sikre at admin ser oppdateringer umiddelbart
        console.log("Tømmer hele iCal-cachen etter at ny hendelse er opprettet");
        clearAllIcalCache();
        
        try {
          // Eksporter kalenderen på nytt som iCal for å oppdatere externe iCal linker
          console.log("Eksporterer kalender på nytt etter ny hendelse");
          await exportUserCalendarAsIcal(user.id);
          console.log(`Kalendereksport oppdatert for bruker ${user.id}`);
        } catch (exportError) {
          console.error("Feil ved oppdatering av kalendereksport:", exportError);
        }
      }
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Feil ved oppretting av hendelse med varsling:', error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });
  
  // PUT /api/events/:id - Oppdater hendelse
  app.put("/api/events/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Sjekk om hendelsen kan redigeres av den autentiserte brukeren:
      // 1. Hendelsen tilhører brukeren selv eller
      // 2. Brukeren er administrator
      console.log('PUT - User checking permissions:', {
        requestingUserId: req.user.id,
        isAdmin: !!req.user.isAdmin,
        eventOwnerId: existingEvent.userId
      });
      
      if (existingEvent.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Sjekk om hendelsen kommer fra en iCal-feed - ingen kan endre iCal-hendelser, heller ikke administrator
      if (existingEvent.source && typeof existingEvent.source === 'object' && 
          'type' in existingEvent.source && existingEvent.source.type === 'ical') {
        return res.status(403).json({ 
          message: "Hei du kan ikke endre en Bookingen da den er bindende" 
        });
      }
      
      const validation = eventFormSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid event data", errors: validation.error.errors });
      }
      
      const eventData = validation.data;
      
      // Sanitize description to remove email addresses
      if (eventData.description) {
        eventData.description = sanitizeEventDescription(eventData.description);
      }
      
      const updatedEvent = await storage.updateEvent(eventId, eventData);
      
      // Oppdater Beds24-blokkering hvis hendelsen har en
      if (existingEvent.source && typeof existingEvent.source === 'object' && 
          'type' in existingEvent.source && existingEvent.source.type === 'local_with_beds24' &&
          'beds24BookingId' in existingEvent.source) {
        try {
          const beds24BookingId = existingEvent.source.beds24BookingId as string;
          console.log(`Updating Beds24 block ${beds24BookingId} for event ${eventId}`);
          
          const beds24Client = new Beds24ApiClient(existingEvent.userId);
          const initialized = await beds24Client.initialize();
          
          if (initialized && eventData.startTime && eventData.endTime) {
            const startDate = new Date(eventData.startTime);
            const endDate = new Date(eventData.endTime);
            
            const result = await beds24Client.updateBlock(beds24BookingId, startDate, endDate, eventData.title);
            if (result.success) {
              console.log(`Successfully updated Beds24 block ${beds24BookingId}`);
            } else {
              console.warn(`Could not update Beds24 block: ${result.error}`);
            }
          }
        } catch (beds24Error) {
          console.warn('Beds24 block update failed (non-fatal):', beds24Error);
        }
      }
      
      // Send varslinger
      const user = await storage.getUser(req.user.id);
      if (user && updatedEvent) {
        // Send e-postvarsel
        await notifyUpdatedEvent(user, user, updatedEvent);
        
        // Send sanntidsvarsel
        const notification = createNotification(
          'event_updated',
          'Oppdatert kalenderhendelse',
          `Hendelsen "${updatedEvent.title}" er oppdatert`,
          user.id,
          user.id,
          updatedEvent.id
        );
        
        sendNotificationToUser(user.id, notification);
        
        // Tøm HELE cache-en for å sikre at admin ser oppdateringer umiddelbart
        console.log("Tømmer hele iCal-cachen etter hendelsesoppdatering");
        clearAllIcalCache();
        
        try {
          // Eksporter kalenderen på nytt som iCal for å oppdatere eksterne iCal linker
          console.log("Eksporterer kalender på nytt etter hendelsesoppdatering");
          await exportUserCalendarAsIcal(user.id);
          console.log(`Kalendereksport oppdatert for bruker ${user.id} etter hendelsesoppdatering`);
        } catch (exportError) {
          console.error("Feil ved oppdatering av kalendereksport:", exportError);
        }
      }
      
      res.json(updatedEvent);
    } catch (error) {
      console.error('Feil ved oppdatering av hendelse med varsling:', error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });
  
  // DELETE /api/events/:id - Slett hendelse
  app.delete("/api/events/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    console.log('*****************************************************');
    console.log('DELETE EVENT API CALLED - Event ID:', req.params.id);
    console.log('User object:', JSON.stringify(req.user));
    console.log('*****************************************************');
    
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        console.log('DELETE EVENT - Invalid ID format');
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent) {
        console.log('DELETE EVENT - Event not found');
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Ekstra sikkerhet: Hent bruker på nytt fra databasen for å sikre ferske data
      const freshUser = await storage.getUser(req.user.id);
      const isAdminUser = freshUser && freshUser.isAdmin === true;
      
      console.log('DELETE EVENT - User checking permissions:', {
        userId: req.user.id,
        requestUserIsAdmin: req.user.isAdmin === true,
        freshUserIsAdmin: isAdminUser,
        eventOwnerId: existingEvent.userId
      });
      
      // For sikkerhetsskyld, tillat sletting kun hvis:
      // 1. Brukeren er admin (sjekket på to forskjellige måter)
      // 2. Brukeren eier hendelsen
      if (isAdminUser) {
        console.log('DELETE EVENT - Admin user, bypassing ownership check');
        // Admin kan slette alle hendelser, fortsett til sletting
      } else if (existingEvent.userId === req.user.id) {
        console.log('DELETE EVENT - User owns event, allowed to delete');
        // Brukeren eier hendelsen, fortsett til sletting
      } else {
        console.log('DELETE EVENT - User not admin and does not own event, forbidden');
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Sjekk om hendelsen er fra en iCal-feed
      const isIcalEvent = existingEvent.source && 
                         typeof existingEvent.source === 'object' && 
                         'type' in existingEvent.source && 
                         existingEvent.source.type === 'ical';
      
      // iCal-hendelser kan kun slettes av admin
      if (isIcalEvent && !isAdminUser) {
        console.log('DELETE EVENT - iCal events can only be deleted by admin');
        return res.status(403).json({ 
          message: "Hei du kan ikke slette en Bookingen da den er bindende. Kun administrator kan slette booking-hendelser." 
        });
      }
      
      // Admin kan slette alle typer hendelser, inkludert iCal events
      if (isIcalEvent && isAdminUser) {
        console.log('DELETE EVENT - Admin deleting iCal event, allowed');
      }
      
      // Hent bruker og lagre hendelsen før sletting
      const user = await storage.getUser(req.user.id);
      const eventCopy = { ...existingEvent };
      
      console.log('DELETE EVENT - Preparing to delete event with details:', {
        eventId,
        eventTitle: eventCopy.title,
        eventUserId: eventCopy.userId,
        currentUserId: user?.id
      });
      
      // Slett Beds24-blokkering hvis hendelsen har en
      if (existingEvent.source && typeof existingEvent.source === 'object' && 
          'type' in existingEvent.source && existingEvent.source.type === 'local_with_beds24' &&
          'beds24BookingId' in existingEvent.source) {
        try {
          const beds24BookingId = existingEvent.source.beds24BookingId as string;
          console.log(`Deleting Beds24 block ${beds24BookingId} for event ${eventId}`);
          
          const beds24Client = new Beds24ApiClient(existingEvent.userId);
          const initialized = await beds24Client.initialize();
          
          if (initialized) {
            const result = await beds24Client.deleteBlock(beds24BookingId);
            if (result.success) {
              console.log(`Successfully deleted Beds24 block ${beds24BookingId}`);
            } else {
              console.warn(`Could not delete Beds24 block: ${result.error}`);
            }
          }
        } catch (beds24Error) {
          console.warn('Beds24 block deletion failed (non-fatal):', beds24Error);
        }
      }
      
      // Slett hendelsen
      const deleteResult = await storage.deleteEvent(eventId);
      
      console.log('DELETE EVENT - Delete result:', deleteResult);
      
      if (!deleteResult) {
        console.error('DELETE EVENT - Failed to delete from database');
        return res.status(500).json({ message: "Failed to delete event from database" });
      }
      
      // Send varslinger etter vellykket sletting
      if (user) {
        console.log('DELETE EVENT - Sending notifications after successful delete');
        
        // Send e-postvarsel
        await notifyDeletedEvent(user, user, eventCopy);
        
        // Send sanntidsvarsel
        const notification = createNotification(
          'event_deleted',
          'Slettet kalenderhendelse',
          `Hendelsen "${eventCopy.title}" er slettet`,
          user.id,
          user.id,
          eventId
        );
        
        sendNotificationToUser(user.id, notification);
        
        // Tøm HELE cache-en for å sikre at admin ser oppdateringer umiddelbart
        console.log("Tømmer hele iCal-cachen etter hendelsessletting");
        clearAllIcalCache();
        
        try {
          // Eksporter kalenderen på nytt som iCal for å oppdatere eksterne iCal linker
          console.log("Eksporterer kalender på nytt etter hendelsessletting");
          await exportUserCalendarAsIcal(user.id);
          console.log(`Kalendereksport oppdatert for bruker ${user.id} etter hendelsessletting`);
        } catch (exportError) {
          console.error("Feil ved oppdatering av kalendereksport:", exportError);
        }
      }
      
      res.status(200).json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error('Feil ved sletting av hendelse med varsling:', error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });
  
  // POST /api/collaborative-events/:id/join - Bli med i samarbeidsarrangement
  app.post("/api/collaborative-events/:id/join", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if (!event.isCollaborative) {
        return res.status(400).json({ message: "This event does not support collaboration" });
      }
      
      const collaborator = await storage.addCollaborator(eventId, req.user.id);
      
      // Send varslinger
      const joiningUser = await storage.getUser(req.user.id);
      const creatorUser = await storage.getUser(event.userId);
      
      if (joiningUser && creatorUser) {
        // Varsle arrangør
        const notification = createNotification(
          'collaboration_invite',
          'Ny deltaker i samarbeidsarrangement',
          `${joiningUser.name} er nå med på samarbeidsarrangementet "${event.title}"`,
          creatorUser.id,
          joiningUser.id,
          event.id
        );
        
        sendNotificationToUser(creatorUser.id, notification);
        
        // Send e-post til arrangør
        await notifyCollaborativeEvent(joiningUser, creatorUser, event);
      }
      
      res.status(200).json(collaborator);
    } catch (error) {
      console.error("Error joining collaborative event:", error);
      res.status(500).json({ message: "Failed to join collaborative event" });
    }
  });
  
  // Translation API endpoint
  app.post("/api/translate", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { text, targetLanguage, sourceLanguage } = req.body;
      
      if (!text || !targetLanguage) {
        return res.status(400).json({ 
          success: false, 
          error: "Missing required fields: text and targetLanguage are required" 
        });
      }
      
      // Log translation request
      console.log(`Translation request: ${sourceLanguage || 'auto'} -> ${targetLanguage}, length: ${text.length} chars`);
      
      // Call translation service
      const result = await translateText(text, targetLanguage, sourceLanguage);
      
      // Return result
      res.json(result);
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown translation error",
        translatedText: "" 
      });
    }
  });

  // === Case Management API Routes (Sakshåndtering) ===
  
  // Get all cases for a user
  app.get("/api/cases", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userCases = await storage.getCases(req.user.id);
      res.json(userCases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });
  
  // Get all cases (admin only) with message counts
  app.get("/api/admin/cases", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      // Get all cases first
      const allCases = await storage.getAllCases();
      
      // Get message counts for each case for the admin UI
      const casesWithExtra = await Promise.all(allCases.map(async (caseItem) => {
        // Get message count for this case
        const messages = await storage.getCaseMessages(caseItem.id);
        
        // Add extra fields for admin UI
        return {
          ...caseItem,
          harMeldinger: messages ? messages.length : 0,
          lastMessage: messages && messages.length > 0 ? 
            {
              id: messages[messages.length - 1].id,
              text: messages[messages.length - 1].message.substring(0, 30) + (messages[messages.length - 1].message.length > 30 ? '...' : ''),
              senderId: messages[messages.length - 1].sender_id,
              isAdminMessage: messages[messages.length - 1].is_admin_message,
              createdAt: messages[messages.length - 1].created_at
            } : null
        };
      }));
      
      res.json(casesWithExtra);
    } catch (error) {
      console.error("Error fetching all cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });
  
  // Adminendepunkt for å hente meldinger i en spesifikk sak
  app.get("/api/admin/cases/:id/messages", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      console.log(`ADMIN API: Henter meldinger for sak #${caseId}, admin=${req.user.id}`);
      
      // Få saken for å bekrefte at den eksisterer
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        console.log(`ADMIN FEIL: Sak #${caseId} ble ikke funnet i databasen`);
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Hent alle meldinger for denne saken
      const messages = await storage.getCaseMessages(caseId);
      
      // Debugg individuelle meldinger i detalj
      messages.forEach((msg, idx) => {
        console.log(`ADMIN API: Melding #${idx + 1}/${messages.length} for sak #${caseId}:`, 
          JSON.stringify({
            id: msg.id,
            case_id: msg.case_id,
            sender_id: msg.sender_id,
            message: msg.message ? msg.message.substring(0, 20) + "..." : "[TOM]",
            is_admin_message: msg.is_admin_message,
            created_at: msg.created_at
          })
        );
      });
      
      console.log(`ADMIN API: Hentet ${messages.length} meldinger for sak #${caseId}`);
      
      // Filtrer ut eventuelle ugyldige meldinger
      const validMessages = messages.filter(msg => msg && msg.message && msg.message.trim() !== '');
      
      if (validMessages.length !== messages.length) {
        console.log(`ADMIN API ADVARSEL: Fjernet ${messages.length - validMessages.length} ugyldige meldinger for sak #${caseId}`);
      }
      
      // Transformer meldingene til camelCase for frontend
      const transformedMessages = validMessages.map(msg => ({
        id: msg.id,
        caseId: msg.case_id,
        senderId: msg.sender_id,
        targetUserId: msg.target_user_id,
        message: msg.message,
        isAdminMessage: msg.is_admin_message,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        attachmentUrl: msg.attachment_url
      }));
      
      console.log(`ADMIN API: Returnerer ${transformedMessages.length} transformerte meldinger for sak #${caseId}`);
      
      // Returner bare de gyldige, transformerte meldingene
      res.json(transformedMessages);
    } catch (error) {
      console.error("Error fetching case messages for admin:", error);
      res.status(500).json({ message: "Failed to fetch case messages" });
    }
  });
  
  // Get cases assigned to a specific admin
  app.get("/api/admin/my-cases", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const adminCases = await storage.getAdminCases(req.user.id);
      res.json(adminCases);
    } catch (error) {
      console.error("Error fetching admin cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });
  
  // Legg til denne API-en for å hente alle meldinger for en spesifikk sak (både brukere og admin)
  app.get("/api/cases/:id/messages", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      console.log(`Meldinger API: Henter meldinger for sak #${caseId}, bruker=${req.user.id}, admin=${req.user.isAdmin}`);
      
      // Først sjekk om saken eksisterer
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        console.log(`FEIL: Sak #${caseId} ble ikke funnet i databasen`);
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Sjekk om brukeren har tilgang til å se denne saken (eier, tilordnet admin, eller hvilken som helst admin)
      const isAdmin = req.user.isAdmin === true;
      const isOwner = caseItem.userId === req.user.id;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      if (!isOwner && !isAssignedAdmin && !isAdmin) {
        console.log(`AVVIST: Bruker ${req.user.id} har ikke tilgang til meldinger for sak #${caseId}`);
        return res.status(403).json({ message: "Unauthorized access to case messages" });
      }
      
      // Hent alle meldinger for denne saken
      const messages = await storage.getCaseMessages(caseId);
      
      console.log(`Hentet ${messages.length} meldinger for sak #${caseId}`);
      
      // Logg hver enkelt melding for debugging
      messages.forEach((msg, idx) => {
        console.log(`Melding #${idx+1}/${messages.length} for sak #${caseId}:`, 
          JSON.stringify({
            id: msg.id,
            case_id: msg.case_id,
            sender_id: msg.sender_id,
            message: msg.message ? msg.message.substring(0, 20) + "..." : "[TOM]",
            is_admin_message: msg.is_admin_message,
            created_at: msg.created_at
          })
        );
      });
      
      // Filtrer ut ugyldige meldinger
      const validMessages = messages.filter(msg => 
        msg && 
        typeof msg === 'object' && 
        'message' in msg && 
        msg.message && 
        msg.message.trim() !== ''
      );
      
      if (validMessages.length !== messages.length) {
        console.log(`ADVARSEL: Filtrerte bort ${messages.length - validMessages.length} ugyldige meldinger for sak #${caseId}`);
      }
      
      // Formater meldinger for frontend (snake_case -> camelCase)
      const transformedMessages = validMessages.map(msg => ({
        id: msg.id,
        caseId: msg.case_id,
        senderId: msg.sender_id,
        targetUserId: msg.target_user_id,
        message: msg.message,
        isAdminMessage: msg.is_admin_message,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        attachmentUrl: msg.attachment_url
      }));
      
      console.log(`Returnerer ${transformedMessages.length} transformerte meldinger for sak #${caseId}`);
      res.json(transformedMessages);
    } catch (error) {
      console.error("Error fetching case messages:", error);
      res.status(500).json({ message: "Failed to fetch case messages" });
    }
  });
  
  // Get a specific case with messages
  app.get("/api/cases/:id", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      console.log(`*** API: Henter detaljer for sak #${caseId}, bruker=${req.user.id}, er admin=${req.user.isAdmin}`);
      
      // First get the case details from storage
      const caseItem = await storage.getCase(caseId);
      
      if (!caseItem) {
        console.log(`Feil: Sak #${caseId} ble ikke funnet i databasen`);
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`Sak #${caseId} funnet: ${caseItem.title}, eier=${caseItem.userId}, admin=${caseItem.adminId}`);
      
      // Check if user is authorized to view this case (owner, assigned admin, or any admin)
      const isAdmin = req.user.isAdmin === true;
      const isOwner = caseItem.userId === req.user.id;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      console.log(`Tilgangskontroll for sak #${caseId}: isOwner=${isOwner}, isAssignedAdmin=${isAssignedAdmin}, isAdmin=${isAdmin}`);
      
      if (!isOwner && !isAssignedAdmin && !isAdmin) {
        console.log(`AVVIST: Bruker ${req.user.id} har ikke tilgang til sak #${caseId}`);
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Always fetch messages explicitly to ensure they're loaded properly
      let messages = await storage.getCaseMessages(caseId);
      
      // Make sure messages is defined as an array even if empty
      if (!messages || !Array.isArray(messages)) {
        messages = [];
        console.log(`ADVARSEL: Ingen gyldige meldinger funnet for sak ${caseId} - oppretter tom array`);
      } else {
        console.log(`Fant ${messages.length} meldinger for sak #${caseId}`);
      }
      
      // Debug: logg alle rå meldinger
      messages.forEach((msg, i) => {
        console.log(`Rå melding ${i+1}: `, JSON.stringify(msg));
      });
      
      // Filtrer ut ugyldige meldinger (tom message)
      const validMessages = messages.filter(msg => 
        msg && 
        typeof msg === 'object' && 
        'message' in msg && 
        msg.message && 
        msg.message.trim() !== ''
      );
      
      if (validMessages.length !== messages.length) {
        console.log(`ADVARSEL: Filtrerte bort ${messages.length - validMessages.length} ugyldige meldinger`);
      }
      
      // Log messages for debugging
      if (validMessages.length > 0) {
        validMessages.forEach((msg, index) => {
          const innhold = msg.message ? 
            msg.message.substring(0, 30) + (msg.message.length > 30 ? '...' : '') : 
            '(tom)';
          console.log(`Melding ${index + 1} for sak #${caseId}: ID=${msg.id}, sender=${msg.senderId}, innhold="${innhold}"`);
        });
      }
      
      console.log(`Returnerer sak #${caseId} med ${validMessages.length} gyldige meldinger`);
      
      // Get attachments for this case
      const attachments = await storage.getCaseAttachments(caseId);
      
      // Transform messages to camelCase format for frontend
      const transformedMessages = validMessages.map(msg => ({
        id: msg.id,
        caseId: msg.case_id,
        senderId: msg.sender_id,
        targetUserId: msg.target_user_id,
        message: msg.message,
        isAdminMessage: msg.is_admin_message,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        attachmentUrl: msg.attachment_url
      }));
      
      // Debugging transformed messages
      console.log(`Transformerte ${transformedMessages.length} meldinger for frontend:`, 
        transformedMessages.map(m => `${m.id}: ${m.message.substring(0, 20)}...`));
      
      // Create the response object with properly transformed messages
      const responseData = {
        ...caseItem,
        messages: transformedMessages,
        attachments: attachments || []
      };
      
      console.log(`Sending saksdetaljer for sak #${caseId} med ${transformedMessages.length} meldinger`);
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case details" });
    }
  });
  
  // Create a new case
  app.post("/api/cases", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      // Log request body for debugging
      console.log("Case creation request body:", JSON.stringify(req.body));
      
      // Parse and validate the case form data using our form schema
      const formData = caseFormSchema.parse(req.body);
      
      console.log("Parsed form data:", JSON.stringify(formData));
      
      // Create the case with the authenticated user's ID
      const newCase = await storage.createCase(
        req.user.id, // Set userId from the authenticated user
        {
          title: formData.title,
          category: formData.category,
          priority: formData.priority,
          status: 'open'
        },
        formData.message // Initial message
      );
      
      console.log("New case created:", JSON.stringify(newCase));
      
      // Opprett første melding DIREKTE som en del av responsen
      let firstMessage = null;
      let messages = [];
      
      if (formData.message && formData.message.trim() !== '') {
        try {
          // Opprett meldingen direkte
          firstMessage = await storage.addCaseMessage(
            newCase.id,
            req.user.id,
            formData.message,
            false // ikke admin-melding
          );
          
          console.log(`Første melding opprettet for sak #${newCase.id}: ${firstMessage.id}`);
          
          // Legg meldingen inn i en array for responsen
          messages = [firstMessage];
        } catch (error) {
          console.error(`Feil ved oppretting av første melding for sak #${newCase.id}:`, error);
          // Fortsett selv om meldingen ikke kunne legges til
        }
      }
      
      // Kombiner saken med meldingen
      const caseWithMessages = {
        ...newCase,
        messages: messages
      };
      
      // Notify admins about the new case
      notifyAdminsAboutNewCase(newCase, req.user);
      
      // Send alltid saken med meldinger-array (tom hvis ingen melding ble lagt til)
      res.status(201).json(caseWithMessages);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("ZodError when creating case:", error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating case:", error);
      res.status(500).json({ message: "Failed to create case" });
    }
  });
  
  // Function to notify admins about a new case
  const notifyAdminsAboutNewCase = async (caseItem: Case, user: User) => {
    try {
      // Get all admin users
      const allUsers = await storage.getAllUsers();
      const adminUsers = allUsers.filter(u => u.isAdmin);
      
      // Create a notification for each admin
      adminUsers.forEach(admin => {
        const notification: Notification = {
          id: nanoid(),
          type: 'system',
          title: 'Ny sak opprettet',
          message: `${user.name} har opprettet en ny sak: "${caseItem.title}" (${caseItem.caseNumber})`,
          createdAt: new Date(),
          read: false,
          userId: admin.id,
          fromUserId: user.id
        };
        
        // Send notification via WebSocket if admin is connected
        sendNotificationToUser(admin.id, notification);
      });
    } catch (error) {
      console.error("Error notifying admins:", error);
    }
  };
  
  // Add a message to a case
  app.post("/api/cases/:id/messages", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      // Log request body for debugging
      console.log("Case message request body:", req.body);
      
      // Skip schema validation temporarily and extract message manually
      // const messageData = caseMessageFormSchema.parse(req.body);
      const messageData = {
        message: req.body.message || "",
        targetUserId: req.body.targetUserId || undefined,
        attachmentUrl: req.body.attachmentUrl || undefined
      };
      
      if (!messageData.message || messageData.message.trim() === "") {
        return res.status(400).json({ message: "Message cannot be empty" });
      }
      
      // Get the case
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Check if user is authorized (owner or assigned admin)
      const isUserOwner = caseItem.userId === req.user.id;
      const isUserAdmin = req.user.isAdmin;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      if (!isUserOwner && !isAssignedAdmin && !isUserAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Check if case is closed (but still allow admins to message closed cases)
      if (caseItem.isClosed && !isUserAdmin && !isAssignedAdmin) {
        return res.status(400).json({ message: "Cannot add message to a closed case" });
      }
      
      console.log("Adding message to case", caseId, "from user", req.user.id, "message:", messageData.message);
      
      // Add the message - check if admin is targeting a specific user
      let targetUserId = undefined;
      
      // If the sender is an admin and they specified a target user, use that target
      if ((isUserAdmin || isAssignedAdmin) && messageData.targetUserId) {
        // Verify the target user exists and is related to this case
        if (messageData.targetUserId === caseItem.userId || messageData.targetUserId === caseItem.adminId) {
          targetUserId = messageData.targetUserId;
        } else {
          return res.status(400).json({ message: "Target user is not related to this case" });
        }
      }
      
      // Include targetUserId for admins targeting specific users
      const newMessage = await storage.addCaseMessage(
        caseId,
        req.user.id,
        messageData.message,
        isUserAdmin || isAssignedAdmin, // isAdminMessage flag
        targetUserId // Pass the targetUserId if this is an admin sending to a specific user
      );
      
      console.log("Message added successfully:", JSON.stringify(newMessage));
      
      // Send notification
      if (isUserOwner) {
        // User sent a message, notify admin
        if (caseItem.adminId) {
          const notification: Notification = {
            id: nanoid(),
            type: 'system',
            title: 'Ny melding i sak',
            message: `${req.user.name} har lagt til en ny melding i sak ${caseItem.caseNumber}`,
            createdAt: new Date(),
            read: false,
            userId: caseItem.adminId,
            fromUserId: req.user.id
          };
          sendNotificationToUser(caseItem.adminId, notification);
        } else {
          // Notify all admins if no specific admin is assigned
          const allUsers = await storage.getAllUsers();
          const adminUsers = allUsers.filter(u => u.isAdmin);
          
          adminUsers.forEach(admin => {
            const notification: Notification = {
              id: nanoid(),
              type: 'system',
              title: 'Ny melding i uassignert sak',
              message: `${req.user.name} har lagt til en ny melding i sak ${caseItem.caseNumber}`,
              createdAt: new Date(),
              read: false,
              userId: admin.id,
              fromUserId: req.user.id
            };
            sendNotificationToUser(admin.id, notification);
          });
        }
      } else {
        // Admin sent a message, notify user
        const notification: Notification = {
          id: nanoid(),
          type: 'system',
          title: 'Ny melding fra kundeservice',
          message: `Du har fått en ny melding i sak ${caseItem.caseNumber}`,
          createdAt: new Date(),
          read: false,
          userId: caseItem.userId,
          fromUserId: req.user.id
        };
        sendNotificationToUser(caseItem.userId, notification);
      }
      
      res.status(201).json(newMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error adding message:", error);
      res.status(500).json({ message: "Failed to add message" });
    }
  });
  
  // Get messages for a case
  app.get("/api/cases/:id/messages", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      console.log(`*** API: Henter meldinger for sak #${caseId}, bruker=${req.user.id}, er admin=${req.user.isAdmin}`);
      
      // Get the case to check permissions
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        console.log(`Feil: Sak #${caseId} ble ikke funnet i databasen`);
        return res.status(404).json({ message: "Case not found" });
      }
      
      console.log(`Sak #${caseId} funnet: ${caseItem.title}, eier=${caseItem.userId}, admin=${caseItem.adminId}`);
      
      // Check if user is authorized to view this case
      // Admin har alltid rett til å se meldinger i alle henvendelser
      const isAdmin = req.user.isAdmin === true;
      const isOwner = caseItem.userId === req.user.id;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      console.log(`Tilgangskontroll for sak #${caseId}: isOwner=${isOwner}, isAssignedAdmin=${isAssignedAdmin}, isAdmin=${isAdmin}`);
      
      if (!isOwner && !isAssignedAdmin && !isAdmin) {
        console.log(`AVVIST: Bruker ${req.user.id} har ikke tilgang til sak #${caseId}`);
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Fetch messages for this case
      const messages = await storage.getCaseMessages(caseId);
      
      console.log(`Hentet ${messages.length} meldinger for sak #${caseId} (${isAdmin ? 'admin' : isAssignedAdmin ? 'tildelt admin' : 'eier'})`);
      
      // Debug log message content
      if (messages && messages.length > 0) {
        messages.forEach((msg, i) => {
          const innhold = msg.message ? msg.message.substring(0, 30) + (msg.message.length > 30 ? '...' : '') : '(tom)';
          console.log(`Melding ${i+1}: ID=${msg.id}, avsender=${msg.sender_id}, admin=${msg.is_admin_message}, innhold="${innhold}"`);
        });
      } else {
        console.log(`ADVARSEL: Ingen meldinger funnet for sak #${caseId}`);
        // Ensure messages is set to an empty array
        messages.length = 0;
      }
      
      // Transformer meldingene til camelCase for frontend, akkurat som i admin-endepunktet
      const transformedMessages = messages.map(msg => ({
        id: msg.id,
        caseId: msg.case_id,
        senderId: msg.sender_id,
        targetUserId: msg.target_user_id,
        message: msg.message,
        isAdminMessage: msg.is_admin_message,
        isRead: msg.is_read,
        createdAt: msg.created_at,
        attachmentUrl: msg.attachment_url
      }));
      
      res.json(transformedMessages);
    } catch (error) {
      console.error("Error fetching case messages:", error);
      res.status(500).json({ message: "Failed to fetch case messages" });
    }
  });
  
  // Mark message as read
  app.post("/api/cases/messages/:id/read", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }
      
      // Get the message
      const message = await storage.getCaseMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Get the case
      const caseItem = await storage.getCase(message.caseId);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Check authorization
      const isUserOwner = caseItem.userId === req.user.id;
      const isUserAdmin = req.user.isAdmin;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      if (!isUserOwner && !isAssignedAdmin && !isUserAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Mark as read
      const updatedMessage = await storage.markCaseMessageAsRead(messageId);
      res.json(updatedMessage);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  // Get unread message count for current user
  app.get("/api/cases/unread-count", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      let count = 0;
      
      if (req.user.isAdmin) {
        // For admin users, get count of unread messages from users
        count = await storage.getUnreadAdminMessageCount(req.user.id);
      } else {
        // For regular users, get count of unread messages from admin
        count = await storage.getUnreadMessageCount(req.user.id);
      }
      
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });
  
  // Assign a case to an admin (admin only)
  app.post("/api/admin/cases/:id/assign", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      // Ny håndtering av tildeling til avdeling eller admin
      let adminId = null;
      let department = null;
      
      // Sjekk om vi har en avdeling
      if (req.body.department) {
        // Tildel til en avdeling
        department = req.body.department;
        adminId = null; // Fjern adminId når vi tildeler til en avdeling
        
        // Konverter kode til lesbart avdelingsnavn
        switch (department) {
          case 'it_dept':
            department = "IT-avdeling";
            break;
          case 'customer_service':
            department = "Kundeservice";
            break;
          case 'homeowner_service':
            department = "Huseierservice";
            break;
          case 'finance':
            department = "Økonomiavdeling";
            break;
          case 'insurance':
            department = "Forsikringsavdeling";
            break;
          default:
            department = "Generell avdeling";
        }
      } 
      // Sjekk om vi har adminId
      else if (req.body.adminId) {
        // Tildel til en spesifikk admin
        adminId = parseInt(req.body.adminId);
        department = null; // Fjern department når vi tildeler til en admin
      } 
      // Hvis ingen er gitt, bruk nåværende admin
      else {
        adminId = req.user.id;
        department = null;
      }
      
      // Assign the case - oppdatert funksjon med department
      const updatedCase = await storage.assignCaseToAdmin(caseId, adminId, department);
      
      if (!updatedCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Notify user that their case has been assigned
      const notification: Notification = {
        id: nanoid(),
        type: 'system',
        title: `Sak tildelt ${assignedTo}`,
        message: `Din sak (${updatedCase.caseNumber}) er nå under behandling av ${assignedTo}`,
        createdAt: new Date(),
        read: false,
        userId: updatedCase.userId,
        fromUserId: req.user.id
      };
      sendNotificationToUser(updatedCase.userId, notification);
      
      res.json(updatedCase);
    } catch (error) {
      console.error("Error assigning case:", error);
      res.status(500).json({ message: "Failed to assign case" });
    }
  });
  
  // Close a case
  app.post("/api/cases/:id/close", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      // Get the case
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Check authorization (only owner, assigned admin, or any admin can close)
      const isUserOwner = caseItem.userId === req.user.id;
      const isUserAdmin = req.user.isAdmin;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      if (!isUserOwner && !isAssignedAdmin && !isUserAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Close the case
      const closedCase = await storage.closeCase(caseId, req.user.id);
      
      // Send notification to the other party
      if (isUserOwner) {
        // User closed the case, notify admin
        if (caseItem.adminId) {
          const notification: Notification = {
            id: nanoid(),
            type: 'system',
            title: 'Sak lukket av bruker',
            message: `${req.user.name} har lukket sak ${caseItem.caseNumber}`,
            createdAt: new Date(),
            read: false,
            userId: caseItem.adminId,
            fromUserId: req.user.id
          };
          sendNotificationToUser(caseItem.adminId, notification);
        }
      } else {
        // Admin closed the case, notify user
        const notification: Notification = {
          id: nanoid(),
          type: 'system',
          title: 'Sak lukket av kundeservice',
          message: `Din sak (${caseItem.caseNumber}) er nå lukket av kundeservice`,
          createdAt: new Date(),
          read: false,
          userId: caseItem.userId,
          fromUserId: req.user.id
        };
        sendNotificationToUser(caseItem.userId, notification);
      }
      
      res.json(closedCase);
    } catch (error) {
      console.error("Error closing case:", error);
      res.status(500).json({ message: "Failed to close case" });
    }
  });
  
  // Reopen a case
  app.post("/api/cases/:id/reopen", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const caseId = parseInt(req.params.id);
      if (isNaN(caseId)) {
        return res.status(400).json({ message: "Invalid case ID" });
      }
      
      // Get the case
      const caseItem = await storage.getCase(caseId);
      if (!caseItem) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      // Check authorization (only owner, assigned admin, or any admin can reopen)
      const isUserOwner = caseItem.userId === req.user.id;
      const isUserAdmin = req.user.isAdmin;
      const isAssignedAdmin = caseItem.adminId === req.user.id;
      
      if (!isUserOwner && !isAssignedAdmin && !isUserAdmin) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Make sure the case is actually closed
      if (!caseItem.isClosed) {
        return res.status(400).json({ message: "Case is already open" });
      }
      
      // Reopen the case
      const reopenedCase = await storage.reopenCase(caseId);
      
      // Send notification to the other party
      if (isUserOwner) {
        // User reopened the case, notify admin
        if (caseItem.adminId) {
          const notification: Notification = {
            id: nanoid(),
            type: 'system',
            title: 'Sak gjenåpnet av bruker',
            message: `${req.user.name} har gjenåpnet sak ${caseItem.caseNumber}`,
            createdAt: new Date(),
            read: false,
            userId: caseItem.adminId,
            fromUserId: req.user.id
          };
          sendNotificationToUser(caseItem.adminId, notification);
        }
      } else {
        // Admin reopened the case, notify user
        const notification: Notification = {
          id: nanoid(),
          type: 'system',
          title: 'Sak gjenåpnet av kundeservice',
          message: `Din sak (${caseItem.caseNumber}) er gjenåpnet av kundeservice`,
          createdAt: new Date(),
          read: false,
          userId: caseItem.userId,
          fromUserId: req.user.id
        };
        sendNotificationToUser(caseItem.userId, notification);
      }
      
      res.json(reopenedCase);
    } catch (error) {
      console.error("Error reopening case:", error);
      res.status(500).json({ message: "Failed to reopen case" });
    }
  });

  // Price ranges API routes
  app.get("/api/prices", async (req, res) => {
    try {
      const prices = await storage.getPriceRanges();
      res.json(prices);
    } catch (error) {
      console.error("Error fetching price ranges:", error);
      res.status(500).json({ message: "Failed to fetch price ranges" });
    }
  });

  app.get("/api/prices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid price range ID" });
      }
      
      const price = await storage.getPriceRange(id);
      if (!price) {
        return res.status(404).json({ message: "Price range not found" });
      }
      
      res.json(price);
    } catch (error) {
      console.error("Error fetching price range:", error);
      res.status(500).json({ message: "Failed to fetch price range" });
    }
  });

  app.post("/api/prices", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const validation = insertPriceRangeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid price range data", errors: validation.error.errors });
      }
      
      // Add userId from the selected user or authenticated user
      const priceData = {
        ...validation.data,
        userId: req.body.userId || req.user.id
      };
      
      const price = await storage.createPriceRange(priceData);
      res.status(201).json(price);
    } catch (error) {
      console.error("Error creating price range:", error);
      res.status(500).json({ message: "Failed to create price range" });
    }
  });

  app.put("/api/prices/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid price range ID" });
      }
      
      const validation = insertPriceRangeSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid price range data", errors: validation.error.errors });
      }
      
      const price = await storage.updatePriceRange(id, validation.data);
      if (!price) {
        return res.status(404).json({ message: "Price range not found" });
      }
      
      res.json(price);
    } catch (error) {
      console.error("Error updating price range:", error);
      res.status(500).json({ message: "Failed to update price range" });
    }
  });

  app.delete("/api/prices/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid price range ID" });
      }
      
      const success = await storage.deletePriceRange(id);
      if (!success) {
        return res.status(404).json({ message: "Price range not found" });
      }
      
      res.json({ message: "Price range deleted successfully" });
    } catch (error) {
      console.error("Error deleting price range:", error);
      res.status(500).json({ message: "Failed to delete price range" });
    }
  });

  // Admin endpoint to manually trigger iCal sync for all feeds
  app.post("/api/admin/sync-all-ical", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await triggerManualIcalSync();
      res.json({
        message: "iCal sync completed",
        success: result.success,
        errors: result.errors,
        total: result.success + result.errors
      });
    } catch (error) {
      console.error("Error in manual iCal sync:", error);
      res.status(500).json({ message: "Failed to sync iCal feeds" });
    }
  });

  // Admin endpoint to find and remove duplicate iCal events
  app.post("/api/admin/cleanup-duplicates", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await findAndRemoveDuplicateIcalEvents();
      res.json({
        message: "Duplicate cleanup completed",
        found: result.found,
        removed: result.removed
      });
    } catch (error) {
      console.error("Error in duplicate cleanup:", error);
      res.status(500).json({ message: "Failed to cleanup duplicates" });
    }
  });

  // Admin endpoint to find similar events (for review before deletion)
  app.get("/api/admin/similar-events", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const threshold = parseFloat(req.query.threshold as string) || 0.8;
      const result = await findSimilarIcalEvents(threshold);
      res.json({
        groups: result.groups,
        totalEvents: result.totalEvents,
        similarGroups: result.groups.length
      });
    } catch (error) {
      console.error("Error finding similar events:", error);
      res.status(500).json({ message: "Failed to find similar events" });
    }
  });

  // ========== BEDS24 API CONFIGURATION ENDPOINTS ==========
  
  // Get Beds24 configuration for a specific user
  app.get("/api/admin/beds24-config/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const config = await storage.getBeds24Config(userId);
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching Beds24 config:", error);
      res.status(500).json({ message: "Failed to fetch Beds24 configuration" });
    }
  });

  // Get all Beds24 configurations
  app.get("/api/admin/beds24-configs", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const configs = await storage.getAllBeds24Configs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching all Beds24 configs:", error);
      res.status(500).json({ message: "Failed to fetch Beds24 configurations" });
    }
  });

  // Create or update Beds24 configuration for a user
  app.post("/api/admin/beds24-config/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const configData = req.body;
      
      // Validate required fields
      if (!configData.apiKey || !configData.propId) {
        return res.status(400).json({ message: "API key and property ID are required" });
      }
      
      const config = await storage.upsertBeds24Config(userId, configData);
      res.json(config);
    } catch (error) {
      console.error("Error saving Beds24 config:", error);
      res.status(500).json({ message: "Failed to save Beds24 configuration" });
    }
  });

  // Delete Beds24 configuration for a user
  app.delete("/api/admin/beds24-config/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const success = await storage.deleteBeds24Config(userId);
      
      if (success) {
        res.json({ message: "Beds24 configuration deleted successfully" });
      } else {
        res.status(404).json({ message: "Configuration not found" });
      }
    } catch (error) {
      console.error("Error deleting Beds24 config:", error);
      res.status(500).json({ message: "Failed to delete Beds24 configuration" });
    }
  });

  // Manually trigger Beds24 sync for a specific user
  app.post("/api/admin/beds24-sync/:userId", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const config = await storage.getBeds24Config(userId);
      
      if (!config || !config.syncEnabled) {
        return res.status(400).json({ message: "Beds24 sync is not configured or enabled for this user" });
      }
      
      // Import the Beds24 API client
      const { Beds24ApiClient } = await import("./beds24-api");
      const client = new Beds24ApiClient(userId);
      
      // Initialize the client
      const initialized = await client.initialize();
      if (!initialized) {
        return res.status(400).json({ message: "Failed to initialize Beds24 API client" });
      }
      
      // Sync bookings to calendar
      const result = await client.syncBookingsToCalendar();
      
      res.json({
        message: "Beds24 sync completed successfully",
        eventsCreated: result.synced,
        eventsUpdated: result.updated,
        eventsDeleted: result.deleted,
        bookingsFetched: result.synced + result.updated
      });
    } catch (error: any) {
      console.error("Error syncing Beds24:", error);
      const errorMessage = error.message || error.toString() || "Unknown error";
      res.status(500).json({ 
        message: "Failed to sync Beds24 data",
        error: errorMessage,
        details: error.response?.data || null
      });
    }
  });

  // ========== PAYOUT ENDPOINTS (UTBETALINGER) ==========
  
  // Get all payouts for a specific user (both admin and mini admin can view)
  app.get("/api/admin/payouts/user/:userId", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const payouts = await storage.getPayouts(userId);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching user payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Get payouts for a user for a specific year (both admin and mini admin can view)
  app.get("/api/admin/payouts/user/:userId/year/:year", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const year = parseInt(req.params.year);
      const payouts = await storage.getPayoutsByYear(userId, year);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching year payouts:", error);
      res.status(500).json({ message: "Failed to fetch year payouts" });
    }
  });

  // Get all payouts for all users (both admin and mini admin can view)
  app.get("/api/admin/payouts", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const payouts = await storage.getAllPayouts();
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching all payouts:", error);
      res.status(500).json({ message: "Failed to fetch all payouts" });
    }
  });

  // Create a new payout
  app.post("/api/admin/payouts", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const payoutData = {
        ...req.body,
        registeredById: req.user!.id
      };
      const payout = await storage.createPayout(payoutData);
      res.json(payout);
    } catch (error) {
      console.error("Error creating payout:", error);
      res.status(500).json({ message: "Failed to create payout" });
    }
  });

  // Update a payout
  app.patch("/api/admin/payouts/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const payoutId = parseInt(req.params.id);
      const payout = await storage.updatePayout(payoutId, req.body);
      if (!payout) {
        res.status(404).json({ message: "Payout not found" });
        return;
      }
      res.json(payout);
    } catch (error) {
      console.error("Error updating payout:", error);
      res.status(500).json({ message: "Failed to update payout" });
    }
  });

  // Delete a payout
  app.delete("/api/admin/payouts/:id", isAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const payoutId = parseInt(req.params.id);
      const deleted = await storage.deletePayout(payoutId);
      if (!deleted) {
        res.status(404).json({ message: "Payout not found" });
        return;
      }
      res.json({ message: "Payout deleted successfully" });
    } catch (error) {
      console.error("Error deleting payout:", error);
      res.status(500).json({ message: "Failed to delete payout" });
    }
  });

  // Calculate rental days from Beds24 API data (both admin and mini admin can calculate)
  app.post("/api/admin/payouts/calculate-rental-days", hasAdminAccess, async (req: AuthenticatedRequest, res) => {
    try {
      const { userId, month, year } = req.body;
      
      if (!userId || !month || !year) {
        res.status(400).json({ message: "userId, month, and year are required" });
        return;
      }

      // Get Beds24 events for this user and month
      const beds24Events = await storage.getBeds24Events(userId);
      
      // Filter events for the specified month and year
      const monthEvents = beds24Events.filter(event => {
        const startDate = new Date(event.startTime);
        const eventMonth = startDate.getMonth() + 1; // JavaScript months are 0-indexed
        const eventYear = startDate.getFullYear();
        
        return eventMonth === parseInt(month) && eventYear === parseInt(year);
      });

      // Calculate unique rental days
      const rentalDaysSet = new Set<string>();
      
      for (const event of monthEvents) {
        const startDate = new Date(event.startTime);
        const endDate = event.endTime ? new Date(event.endTime) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        
        // Add each day between start and end date (exclusive of end date for checkout)
        const currentDate = new Date(startDate);
        while (currentDate < endDate) {
          const dayKey = currentDate.toISOString().split('T')[0];
          rentalDaysSet.add(dayKey);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
      
      const rentalDays = rentalDaysSet.size;
      
      res.json({ 
        rentalDays,
        totalBookings: monthEvents.length,
        message: `Found ${rentalDays} unique rental days from ${monthEvents.length} bookings` 
      });
    } catch (error) {
      console.error("Error calculating rental days:", error);
      res.status(500).json({ message: "Failed to calculate rental days" });
    }
  });

  // Return the HttpServer 
  return httpServer;
}
