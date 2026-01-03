import { 
  users, events, icalFeeds, markedDays, icalEventNotes, systemSettings,
  eventCollaborators, eventSuggestions, backups, passwordResetTokens,
  cases, caseMessages, caseAttachments, priceRanges, payouts, accountNumberLogs,
  adminAgreements, agreementNotes, beds24Config,
  type User, type InsertUser, type Event, type InsertEvent, 
  type IcalFeed, type InsertIcalFeed, type MarkedDay, type InsertMarkedDay,
  type IcalEventNote, type InsertIcalEventNote, 
  type SystemSetting, type InsertSystemSetting, type Backup, type InsertBackup,
  type PasswordResetToken, type InsertPasswordResetToken,
  type Case, type InsertCase, type CaseMessage, type InsertCaseMessage,
  type CaseAttachment, type InsertCaseAttachment,
  type PriceRange, type InsertPriceRange,
  type Payout, type InsertPayout,
  type AccountNumberLog, type InsertAccountNumberLog,
  type AdminAgreement, type InsertAdminAgreement,
  type AgreementNote, type InsertAgreementNote,
  type Beds24Config, type InsertBeds24Config
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { asc } from "drizzle-orm";
import { count } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Utility methods
  executeCustomQuery(query: string): Promise<any[]>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  updateUserAdminInfo(id: number, adminInfo: string): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<void>;
  deleteUser(id: number): Promise<boolean>;
  
  // Password reset methods
  createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>;
  
  // Event methods
  getEvents(userId: number): Promise<Event[]>;
  getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(userId: number, eventData: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  updateEventAdminColor(id: number, color: string): Promise<boolean>;
  deleteEvent(id: number): Promise<boolean>;
  deleteEventsBySource(sourcePattern: string): Promise<number>;
  getEventsByFeedId(userId: number, feedId: number): Promise<Event[]>;
  
  // Collaborative events methods
  createCollaborativeEvent(userId: number, event: InsertEvent): Promise<Event>;
  getCollaborativeEventByCode(code: string): Promise<Event | undefined>;
  getEventCollaborators(eventId: number): Promise<any[]>;
  addCollaborator(eventId: number, userId: number, role?: string): Promise<any>;
  removeCollaborator(eventId: number, userId: number): Promise<boolean>;
  getCollaborativeEvents(userId: number): Promise<Event[]>;
  
  // Event suggestions methods
  createEventSuggestion(eventId: number, userId: number, type: string, originalValue: string, suggestedValue: string, message?: string): Promise<any>;
  getEventSuggestions(eventId: number): Promise<any[]>;
  getPendingSuggestions(eventId: number): Promise<any[]>;
  resolveSuggestion(suggestionId: number, userId: number, status: 'approved' | 'rejected'): Promise<any>;
  
  // iCal feeds methods
  getIcalFeeds(userId: number): Promise<IcalFeed[]>;
  getAllIcalFeeds(): Promise<IcalFeed[]>;
  getIcalFeed(id: number): Promise<IcalFeed | undefined>;
  createIcalFeed(userId: number, feed: InsertIcalFeed): Promise<IcalFeed>;
  updateIcalFeed(id: number, feed: Partial<InsertIcalFeed>): Promise<IcalFeed | undefined>;
  deleteIcalFeed(id: number): Promise<boolean>;
  deleteIcalFeedAndNotes(id: number): Promise<boolean>;
  
  // Marked days methods
  getMarkedDays(userId: number): Promise<MarkedDay[]>;
  getMarkedDaysByDateRange(userId: number, startDate: Date, endDate: Date): Promise<MarkedDay[]>;
  getMarkedDay(id: number): Promise<MarkedDay | undefined>;
  createMarkedDay(userId: number, markedDay: InsertMarkedDay): Promise<MarkedDay>;
  updateMarkedDay(id: number, markedDay: Partial<InsertMarkedDay>): Promise<MarkedDay | undefined>;
  deleteMarkedDay(id: number): Promise<boolean>;
  
  // iCal event notes methods
  getIcalEventNotes(userId: number): Promise<IcalEventNote[]>;
  getIcalEventNoteByExternalId(userId: number, eventExternalId: string): Promise<IcalEventNote | undefined>;
  getIcalEventNote(id: number): Promise<IcalEventNote | undefined>;
  createIcalEventNote(userId: number, note: InsertIcalEventNote): Promise<IcalEventNote>;
  updateIcalEventNote(id: number, note: Partial<InsertIcalEventNote>): Promise<IcalEventNote | undefined>;
  deleteIcalEventNote(id: number): Promise<boolean>;
  
  // System settings methods
  getAllSystemSettings(): Promise<SystemSetting[]>;
  getSystemSettingByKey(key: string): Promise<SystemSetting | undefined>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  updateSystemSetting(key: string, value: string): Promise<SystemSetting | undefined>;
  
  // Case management methods (sakshåndtering)
  generateCaseNumber(): Promise<string>;
  getCases(userId: number): Promise<Case[]>;
  getAdminCases(adminId: number): Promise<Case[]>;
  getAllCases(): Promise<Case[]>;
  getCase(id: number): Promise<Case | undefined>;
  getCaseByCaseNumber(caseNumber: string): Promise<Case | undefined>;
  createCase(userId: number, caseData: InsertCase, initialMessage: string): Promise<Case>;
  updateCase(id: number, caseData: Partial<InsertCase>): Promise<Case | undefined>;
  assignCaseToAdmin(id: number, adminId: number | null, department?: string | null): Promise<Case | undefined>;
  closeCase(id: number, closedById: number): Promise<Case | undefined>;
  reopenCase(id: number): Promise<Case | undefined>;
  
  // Case messages methods (meldinger i sak)
  getCaseMessages(caseId: number): Promise<CaseMessage[]>;
  getCaseMessage(id: number): Promise<CaseMessage | undefined>;
  addCaseMessage(caseId: number, senderId: number, message: string, isAdminMessage: boolean): Promise<CaseMessage>;
  markCaseMessageAsRead(id: number): Promise<CaseMessage | undefined>;
  getUnreadMessageCount(userId: number): Promise<number>;
  getUnreadAdminMessageCount(adminId: number): Promise<number>;
  
  // Case attachments methods (vedlegg til sak)
  getCaseAttachments(caseId: number): Promise<CaseAttachment[]>;
  getCaseAttachment(id: number): Promise<CaseAttachment | undefined>;
  addCaseAttachment(caseId: number, messageId: number | null, uploadedById: number, fileName: string, fileType: string, fileSize: number, fileUrl: string): Promise<CaseAttachment>;
  deleteCaseAttachment(id: number): Promise<boolean>;
  
  // Price ranges methods (prisintervaller)
  getPriceRanges(): Promise<PriceRange[]>;
  getPriceRange(id: number): Promise<PriceRange | undefined>;
  createPriceRange(priceRange: InsertPriceRange): Promise<PriceRange>;
  updatePriceRange(id: number, priceRange: Partial<InsertPriceRange>): Promise<PriceRange | undefined>;
  deletePriceRange(id: number): Promise<boolean>;
  
  // Payout methods (utbetalinger)
  getPayouts(userId: number): Promise<Payout[]>;
  getPayoutsByYear(userId: number, year: number): Promise<Payout[]>;
  getAllPayouts(): Promise<Payout[]>;
  getPayout(id: number): Promise<Payout | undefined>;
  createPayout(payout: InsertPayout): Promise<Payout>;
  updatePayout(id: number, payout: Partial<InsertPayout>): Promise<Payout | undefined>;
  deletePayout(id: number): Promise<boolean>;
  
  // Account number change log methods
  logAccountNumberChange(userId: number, changedById: number, oldAccountNumber: string | null, newAccountNumber: string | null, reason?: string): Promise<void>;
  getAccountNumberLogs(userId: number): Promise<any[]>;
  
  // Admin agreement methods
  getAdminAgreements(userId?: number, isAdmin?: boolean): Promise<AdminAgreement[]>;
  getAdminAgreement(id: number): Promise<AdminAgreement | undefined>;
  createAdminAgreement(agreement: InsertAdminAgreement): Promise<AdminAgreement>;
  updateAdminAgreement(id: number, agreement: Partial<InsertAdminAgreement>): Promise<AdminAgreement | undefined>;
  deleteAdminAgreement(id: number): Promise<boolean>;
  
  // Agreement note methods
  getAgreementNotes(agreementId: number, userId?: number, isAdmin?: boolean): Promise<AgreementNote[]>;
  createAgreementNote(note: InsertAgreementNote): Promise<AgreementNote>;
  updateAgreementNote(id: number, note: Partial<InsertAgreementNote>): Promise<AgreementNote | undefined>;
  deleteAgreementNote(id: number): Promise<boolean>;
  
  // Beds24 configuration methods
  getBeds24Config(userId: number): Promise<Beds24Config | null>;
  getAllBeds24Configs(): Promise<Beds24Config[]>;
  upsertBeds24Config(userId: number, config: Partial<InsertBeds24Config>): Promise<Beds24Config>;
  updateBeds24Config(id: number, config: Partial<InsertBeds24Config>): Promise<Beds24Config | undefined>;
  deleteBeds24Config(userId: number): Promise<boolean>;
  getBeds24Events(userId: number): Promise<Event[]>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      pruneSessionInterval: false
    });
  }

  async executeCustomQuery(query: string): Promise<any[]> {
    try {
      const result = await db.execute(sql.raw(query));
      return result.rows || [];
    } catch (error) {
      console.error('Error executing custom query:', error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    // Get the current user data to check for account number changes
    const currentUser = await this.getUser(id);
    
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    // Log account number change if it was modified
    if (currentUser && userData.accountNumber !== undefined && currentUser.accountNumber !== userData.accountNumber) {
      // Note: We don't have the changedById here, it will be handled in the route
      console.log(`Account number changed for user ${id}: ${currentUser.accountNumber} -> ${userData.accountNumber}`);
    }
    
    return updatedUser;
  }
  
  async updateUserAdminInfo(id: number, adminInfo: string): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({ 
        adminInfo: adminInfo,
        adminInfoUpdatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }
  
  async deleteUser(id: number): Promise<boolean> {
    // First, delete all related data (events, iCal feeds, and marked days)
    await db.delete(events).where(eq(events.userId, id));
    await db.delete(icalFeeds).where(eq(icalFeeds.userId, id));
    await db.delete(markedDays).where(eq(markedDays.userId, id));
    
    // Then delete the user
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Event methods
  async getEvents(userId: number): Promise<Event[]> {
    return db.select().from(events).where(eq(events.userId, userId));
  }

  async getEventsByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Event[]> {
    return db.select().from(events).where(
      and(
        eq(events.userId, userId),
        gte(events.startTime, startDate),
        lte(events.startTime, endDate)
      )
    );
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(userId: number, insertEvent: InsertEvent): Promise<Event> {
    // Ensure all required fields have values
    const eventData = {
      ...insertEvent,
      userId: userId,
      description: insertEvent.description || null,
      allDay: insertEvent.allDay || false
    };
    
    const [event] = await db.insert(events).values(eventData).returning();
    return event;
  }

  async updateEvent(id: number, eventUpdate: Partial<InsertEvent>): Promise<Event | undefined> {
    // Ensure color can't be changed when updating
    const updateData = {
      ...eventUpdate,
      color: "#ef4444" // Always keep the red color
    };
    
    const [updatedEvent] = await db.update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async updateEventAdminColor(id: number, color: string): Promise<boolean> {
    const result = await db.update(events)
      .set({ adminColorOverride: color })
      .where(eq(events.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteEventsBySource(sourcePattern: string): Promise<number> {
    // sourcePattern format: "ical-{feedId}"
    if (sourcePattern.startsWith('ical-')) {
      const feedIdStr = sourcePattern.replace('ical-', '');
      const feedId = parseInt(feedIdStr, 10);
      
      if (isNaN(feedId)) {
        console.warn(`Invalid feedId in sourcePattern: ${sourcePattern}`);
        return 0;
      }
      
      // Delete events where source.feedId matches the feedId
      const result = await db.delete(events).where(
        and(
          eq(sql`${events.source}->>'type'`, 'ical'),
          eq(sql`(${events.source}->>'feedId')::int`, feedId)
        )
      );
      
      console.log(`Deleted ${result.rowCount || 0} events for feed ${feedId}`);
      return result.rowCount || 0;
    }
    
    // Fallback for other source patterns
    console.warn(`Unsupported source pattern: ${sourcePattern}`);
    return 0;
  }
  
  async getEventsByFeedId(userId: number, feedId: number): Promise<Event[]> {
    // Get all events for this user that come from the specified iCal feed
    return db.select().from(events).where(
      and(
        eq(events.userId, userId),
        eq(sql`${events.source}->>'type'`, 'ical'),
        eq(sql`(${events.source}->>'feedId')::int`, feedId)
      )
    );
  }
  
  async getEventsBySource(sourceUid: string): Promise<Event[]> {
    // Get events by source UID (e.g., "beds24-69061889")
    return db.select().from(events).where(
      eq(sql`${events.source}->>'uid'`, sourceUid)
    );
  }
  
  // Collaborative events methods
  async createCollaborativeEvent(userId: number, insertEvent: InsertEvent): Promise<Event> {
    // Generer en unik kode for samarbeid
    const randomCode = Math.random().toString(36).substring(2, 10);
    
    // Opprett arrangement med samarbeidsegenskaper
    const eventData = {
      ...insertEvent,
      userId,
      description: insertEvent.description || null,
      color: "#ef4444", // Alltid bruk rød farge
      allDay: insertEvent.allDay || false,
      isCollaborative: true,
      collaborationCode: randomCode
    };
    
    const [event] = await db.insert(events).values(eventData).returning();
    
    // Legg til eieren som en deltaker med rollen "owner"
    await db.insert(eventCollaborators).values({
      eventId: event.id,
      userId: userId,
      role: "owner"
    });
    
    return event;
  }
  
  async getCollaborativeEventByCode(code: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events)
      .where(
        and(
          eq(events.isCollaborative, true),
          eq(events.collaborationCode, code)
        )
      );
    return event;
  }
  
  async getEventCollaborators(eventId: number): Promise<any[]> {
    const collaborators = await db.select({
      id: eventCollaborators.id,
      eventId: eventCollaborators.eventId,
      userId: eventCollaborators.userId,
      role: eventCollaborators.role,
      joinedAt: eventCollaborators.joinedAt,
      username: users.username,
      name: users.name
    })
    .from(eventCollaborators)
    .innerJoin(users, eq(eventCollaborators.userId, users.id))
    .where(eq(eventCollaborators.eventId, eventId));
    
    return collaborators;
  }
  
  async addCollaborator(eventId: number, userId: number, role: string = "guest"): Promise<any> {
    // Sjekk om brukeren allerede er en deltaker
    const [existingCollaborator] = await db.select()
      .from(eventCollaborators)
      .where(
        and(
          eq(eventCollaborators.eventId, eventId),
          eq(eventCollaborators.userId, userId)
        )
      );
    
    if (existingCollaborator) {
      // Oppdater rollen hvis brukeren allerede er en deltaker
      const [updatedCollaborator] = await db.update(eventCollaborators)
        .set({ role })
        .where(eq(eventCollaborators.id, existingCollaborator.id))
        .returning();
      return updatedCollaborator;
    }
    
    // Ellers legg til en ny deltaker
    const [collaborator] = await db.insert(eventCollaborators)
      .values({
        eventId,
        userId,
        role
      })
      .returning();
    
    return collaborator;
  }
  
  async removeCollaborator(eventId: number, userId: number): Promise<boolean> {
    const result = await db.delete(eventCollaborators)
      .where(
        and(
          eq(eventCollaborators.eventId, eventId),
          eq(eventCollaborators.userId, userId)
        )
      );
    
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async getCollaborativeEvents(userId: number): Promise<Event[]> {
    try {
      // Finn alle arrangementer der brukeren er en deltaker
      const collaborators = await db.select({
        eventId: eventCollaborators.eventId,
        role: eventCollaborators.role
      })
        .from(eventCollaborators)
        .where(eq(eventCollaborators.userId, userId));
      
      if (collaborators.length === 0) {
        return [];
      }
      
      // Hent alle disse arrangementene
      const eventIds = collaborators.map(row => row.eventId);
      const collaborativeEvents = await db.select()
        .from(events)
        .where(inArray(events.id, eventIds));
      
      // Merk arrangementer der brukeren er eier
      return collaborativeEvents.map(event => {
        const collaborator = collaborators.find(c => c.eventId === event.id);
        return {
          ...event,
          isCollaborativeOwner: collaborator?.role === "owner"
        };
      });
    } catch (error) {
      console.error("Error in getCollaborativeEvents:", error);
      return [];
    }
  }
  
  // Event suggestions methods
  async createEventSuggestion(
    eventId: number, 
    userId: number, 
    type: string, 
    originalValue: string, 
    suggestedValue: string, 
    message: string = ""
  ): Promise<any> {
    const [suggestion] = await db.insert(eventSuggestions)
      .values({
        eventId,
        suggestedBy: userId,
        type,
        originalValue,
        suggestedValue,
        message,
        status: "pending"
      })
      .returning();
    
    return suggestion;
  }
  
  async getEventSuggestions(eventId: number): Promise<any[]> {
    const suggestions = await db.select({
      id: eventSuggestions.id,
      eventId: eventSuggestions.eventId,
      suggestedBy: eventSuggestions.suggestedBy,
      type: eventSuggestions.type,
      originalValue: eventSuggestions.originalValue,
      suggestedValue: eventSuggestions.suggestedValue,
      status: eventSuggestions.status,
      createdAt: eventSuggestions.createdAt,
      updatedAt: eventSuggestions.updatedAt,
      resolvedBy: eventSuggestions.resolvedBy,
      resolvedAt: eventSuggestions.resolvedAt,
      message: eventSuggestions.message,
      suggestedByName: users.name,
      suggestedByUsername: users.username
    })
    .from(eventSuggestions)
    .innerJoin(users, eq(eventSuggestions.suggestedBy, users.id))
    .where(eq(eventSuggestions.eventId, eventId))
    .orderBy(desc(eventSuggestions.createdAt));
    
    return suggestions;
  }
  
  async getPendingSuggestions(eventId: number): Promise<any[]> {
    const suggestions = await db.select({
      id: eventSuggestions.id,
      eventId: eventSuggestions.eventId,
      suggestedBy: eventSuggestions.suggestedBy,
      type: eventSuggestions.type,
      originalValue: eventSuggestions.originalValue,
      suggestedValue: eventSuggestions.suggestedValue,
      status: eventSuggestions.status,
      createdAt: eventSuggestions.createdAt,
      updatedAt: eventSuggestions.updatedAt,
      message: eventSuggestions.message,
      suggestedByName: users.name,
      suggestedByUsername: users.username
    })
    .from(eventSuggestions)
    .innerJoin(users, eq(eventSuggestions.suggestedBy, users.id))
    .where(
      and(
        eq(eventSuggestions.eventId, eventId),
        eq(eventSuggestions.status, "pending")
      )
    )
    .orderBy(desc(eventSuggestions.createdAt));
    
    return suggestions;
  }
  
  async resolveSuggestion(
    suggestionId: number, 
    userId: number, 
    status: 'approved' | 'rejected'
  ): Promise<any> {
    // Oppdater forslaget med status og hvem som godkjente/avviste det
    const [suggestion] = await db.update(eventSuggestions)
      .set({
        status,
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(eventSuggestions.id, suggestionId))
      .returning();
    
    // Hvis forslaget ble godkjent, oppdater arrangementet med den foreslåtte verdien
    if (status === 'approved' && suggestion) {
      const event = await this.getEvent(suggestion.eventId);
      
      if (event) {
        const updateData: Partial<InsertEvent> = {};
        
        switch (suggestion.type) {
          case 'title':
            updateData.title = suggestion.suggestedValue;
            break;
          case 'description':
            updateData.description = suggestion.suggestedValue;
            break;
          case 'startTime':
            updateData.startTime = new Date(suggestion.suggestedValue);
            break;
          case 'endTime':
            updateData.endTime = new Date(suggestion.suggestedValue);
            break;
          // Flere felttyper kan legges til etter behov
        }
        
        if (Object.keys(updateData).length > 0) {
          await this.updateEvent(event.id, updateData);
        }
      }
    }
    
    return suggestion;
  }

  // iCal feeds methods
  async getIcalFeeds(userId: number): Promise<IcalFeed[]> {
    return db.select().from(icalFeeds).where(eq(icalFeeds.userId, userId));
  }
  
  async getAllIcalFeeds(): Promise<IcalFeed[]> {
    return db.select().from(icalFeeds);
  }

  async getIcalFeed(id: number): Promise<IcalFeed | undefined> {
    const [feed] = await db.select().from(icalFeeds).where(eq(icalFeeds.id, id));
    return feed;
  }

  async createIcalFeed(userId: number, insertFeed: InsertIcalFeed): Promise<IcalFeed> {
    // Ensure all required fields have values
    const feedData = {
      ...insertFeed,
      userId,
      color: insertFeed.color || "#8b5cf6",
      enabled: insertFeed.enabled !== undefined ? insertFeed.enabled : true
    };
    
    const [feed] = await db.insert(icalFeeds).values(feedData).returning();
    return feed;
  }

  async updateIcalFeed(id: number, feedUpdate: Partial<InsertIcalFeed>): Promise<IcalFeed | undefined> {
    const [updatedFeed] = await db.update(icalFeeds)
      .set(feedUpdate)
      .where(eq(icalFeeds.id, id))
      .returning();
    return updatedFeed;
  }

  async deleteIcalFeed(id: number): Promise<boolean> {
    const result = await db.delete(icalFeeds).where(eq(icalFeeds.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  async deleteIcalFeedAndNotes(id: number): Promise<boolean> {
    // Get the feed to verify it exists
    const feed = await this.getIcalFeed(id);
    if (!feed) {
      return false;
    }
    
    try {
      // Delete all notes for this feed's events
      // We need to find notes with eventExternalId that starts with "ical-{feedId}-"
      const eventIdPrefix = `ical-${id}-`;
      
      // Find all notes with the matching prefix
      const notesToDelete = await db.select()
        .from(icalEventNotes)
        .where(
          and(
            eq(icalEventNotes.userId, feed.userId)
          )
        );
        
      // Filter notes manually by checking if they start with the prefix
      // This is not ideal but safer than using raw SQL if drizzle doesn't support LIKE
      const filteredNotes = notesToDelete.filter(note => 
        note.eventExternalId.startsWith(eventIdPrefix)
      );
      
      // Delete each note individually
      for (const note of filteredNotes) {
        await db.delete(icalEventNotes).where(eq(icalEventNotes.id, note.id));
      }
      
      // Now delete the feed itself
      const result = await db.delete(icalFeeds).where(eq(icalFeeds.id, id));
      console.log(`Deleted iCal feed ${id} and ${filteredNotes.length} notes`);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting iCal feed and notes:", error);
      return false;
    }
  }

  // Marked days methods
  async getMarkedDays(userId: number): Promise<MarkedDay[]> {
    return db.select().from(markedDays).where(eq(markedDays.userId, userId));
  }

  async getMarkedDaysByDateRange(userId: number, startDate: Date, endDate: Date): Promise<MarkedDay[]> {
    return db.select().from(markedDays).where(
      and(
        eq(markedDays.userId, userId),
        gte(markedDays.date, startDate),
        lte(markedDays.date, endDate)
      )
    );
  }

  async getMarkedDay(id: number): Promise<MarkedDay | undefined> {
    const [markedDay] = await db.select().from(markedDays).where(eq(markedDays.id, id));
    return markedDay;
  }

  async createMarkedDay(userId: number, insertMarkedDay: InsertMarkedDay): Promise<MarkedDay> {
    const markedDayData = {
      ...insertMarkedDay,
      userId,
      notes: insertMarkedDay.notes || null
    };
    
    const [markedDay] = await db.insert(markedDays).values(markedDayData).returning();
    return markedDay;
  }

  async updateMarkedDay(id: number, markedDayUpdate: Partial<InsertMarkedDay>): Promise<MarkedDay | undefined> {
    const [updatedMarkedDay] = await db.update(markedDays)
      .set(markedDayUpdate)
      .where(eq(markedDays.id, id))
      .returning();
    return updatedMarkedDay;
  }

  async deleteMarkedDay(id: number): Promise<boolean> {
    const result = await db.delete(markedDays).where(eq(markedDays.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // iCal event notes methods
  async getIcalEventNotes(userId: number): Promise<IcalEventNote[]> {
    return db.select().from(icalEventNotes).where(eq(icalEventNotes.userId, userId));
  }
  
  async getIcalEventNoteByExternalId(userId: number, eventExternalId: string): Promise<IcalEventNote | undefined> {
    const [note] = await db.select().from(icalEventNotes).where(
      and(
        eq(icalEventNotes.userId, userId),
        eq(icalEventNotes.eventExternalId, eventExternalId)
      )
    );
    return note;
  }
  
  async getIcalEventNote(id: number): Promise<IcalEventNote | undefined> {
    const [note] = await db.select().from(icalEventNotes).where(eq(icalEventNotes.id, id));
    return note;
  }
  
  async createIcalEventNote(userId: number, insertNote: InsertIcalEventNote): Promise<IcalEventNote> {
    const noteData = {
      ...insertNote,
      userId,
    };
    
    const [note] = await db.insert(icalEventNotes).values(noteData).returning();
    return note;
  }
  
  async updateIcalEventNote(id: number, noteUpdate: Partial<InsertIcalEventNote>): Promise<IcalEventNote | undefined> {
    // Also update the updatedAt timestamp
    const updateData = {
      ...noteUpdate,
      updatedAt: new Date(),
    };
    
    const [updatedNote] = await db.update(icalEventNotes)
      .set(updateData)
      .where(eq(icalEventNotes.id, id))
      .returning();
    return updatedNote;
  }
  
  async deleteIcalEventNote(id: number): Promise<boolean> {
    const result = await db.delete(icalEventNotes).where(eq(icalEventNotes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // System settings methods
  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return db.select().from(systemSettings);
  }
  
  async getSystemSettingByKey(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting;
  }
  
  async createSystemSetting(insertSetting: InsertSystemSetting): Promise<SystemSetting> {
    // Check if setting with this key already exists
    const existingSetting = await this.getSystemSettingByKey(insertSetting.key);
    if (existingSetting) {
      // If it exists, update it instead
      const [updatedSetting] = await db.update(systemSettings)
        .set({ value: insertSetting.value })
        .where(eq(systemSettings.key, insertSetting.key))
        .returning();
      return updatedSetting;
    }
    
    // Otherwise create new setting
    const [setting] = await db.insert(systemSettings).values(insertSetting).returning();
    return setting;
  }
  
  async updateSystemSetting(key: string, value: string): Promise<SystemSetting | undefined> {
    const [updatedSetting] = await db.update(systemSettings)
      .set({ value })
      .where(eq(systemSettings.key, key))
      .returning();
    return updatedSetting;
  }
  
  // Password reset token methods
  async createPasswordResetToken(tokenData: InsertPasswordResetToken): Promise<PasswordResetToken> {
    // Først sjekker vi om det finnes en gyldig token for denne brukeren allerede
    const existingTokens = await db.select().from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, tokenData.userId),
          gte(passwordResetTokens.expiresAt, new Date())
        )
      );
    
    // Hvis det finnes gyldige tokens, setter vi dem som brukt
    if (existingTokens.length > 0) {
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, tokenData.userId),
            gte(passwordResetTokens.expiresAt, new Date())
          )
        );
    }
    
    // Opprett ny token
    const [token] = await db.insert(passwordResetTokens)
      .values(tokenData)
      .returning();
    
    return token;
  }
  
  async getPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    
    return resetToken;
  }
  
  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    const result = await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Case management methods implementation (sakshåndtering)
  async generateCaseNumber(): Promise<string> {
    // Format: CASE-YYYY-XXXX, hvor YYYY er år og XXXX er et løpenummer
    const year = new Date().getFullYear();
    
    // Hent antall saker for dette året
    const caseCountResult = await db.select({ count: count() })
      .from(cases)
      .where(
        and(
          gte(cases.createdAt, new Date(`${year}-01-01T00:00:00.000Z`)),
          lte(cases.createdAt, new Date(`${year}-12-31T23:59:59.999Z`))
        )
      );
    
    const caseCount = caseCountResult[0].count || 0;
    const nextNumber = (caseCount + 1).toString().padStart(4, '0');
    
    return `CASE-${year}-${nextNumber}`;
  }
  
  async getCases(userId: number): Promise<Case[]> {
    return db.select()
      .from(cases)
      .where(eq(cases.userId, userId))
      .orderBy(desc(cases.updatedAt));
  }
  
  async getAdminCases(adminId: number): Promise<Case[]> {
    return db.select()
      .from(cases)
      .where(eq(cases.adminId, adminId))
      .orderBy(desc(cases.updatedAt));
  }
  
  async getAllCases(): Promise<Case[]> {
    return db.select()
      .from(cases)
      .orderBy(desc(cases.updatedAt));
  }
  
  async getCase(id: number): Promise<Case & { messages?: CaseMessage[] } | undefined> {
    // Hent saken først
    const [caseItem] = await db.select().from(cases).where(eq(cases.id, id));
    
    if (!caseItem) {
      return undefined;
    }
    
    // Hent sakens meldinger
    const messages = await db.select()
      .from(caseMessages)
      .where(eq(caseMessages.caseId, id))
      .orderBy(asc(caseMessages.createdAt));
    
    console.log(`Hentet sak #${id} med ${messages.length} meldinger`);
    
    // Returner saken med meldinger
    return {
      ...caseItem,
      messages
    };
  }
  
  async getCaseByCaseNumber(caseNumber: string): Promise<Case | undefined> {
    const [caseItem] = await db.select().from(cases).where(eq(cases.caseNumber, caseNumber));
    return caseItem;
  }
  
  async createCase(userId: number, caseData: InsertCase, initialMessage: string): Promise<Case> {
    // Generer saksnummer
    const caseNumber = await this.generateCaseNumber();
    
    // Opprett sak - fjern department feltet for å unngå databasefeil
    const caseInsertData = {
      ...caseData,
      userId,
      caseNumber,
      status: 'open',
      isClosed: false
    };
    
    // Sikre at department ikke er med siden kolonnen mangler i databasen
    if ('department' in caseInsertData) {
      delete (caseInsertData as any).department;
    }
    
    const [newCase] = await db.insert(cases)
      .values(caseInsertData)
      .returning();
    
    console.log(`Opprettet ny sak #${newCase.id} med saksnummer ${newCase.caseNumber}`);
    
    // Legg til første melding hvis angitt
    if (initialMessage) {
      console.log(`Legger til første melding i sak #${newCase.id}: "${initialMessage.substring(0, 30)}..."`);
      
      await this.addCaseMessage(
        newCase.id,
        userId,
        initialMessage,
        false // ikke admin-melding
      );
    } else {
      console.log(`Ingen første melding angitt for sak #${newCase.id}`);
    }
    
    return newCase;
  }
  
  async updateCase(id: number, caseData: Partial<InsertCase>): Promise<Case | undefined> {
    const [updatedCase] = await db.update(cases)
      .set({
        ...caseData,
        updatedAt: new Date()
      })
      .where(eq(cases.id, id))
      .returning();
    
    return updatedCase;
  }
  
  async assignCaseToAdmin(id: number, adminId: number | null, department: string | null = null): Promise<Case | undefined> {
    const updateData: any = {
      updatedAt: new Date(),
      status: 'in_progress'
    };
    
    // Hvis vi har en admin-ID (person som tar saken)
    if (adminId !== null) {
      updateData.adminId = adminId;
      // Fjernet department-relatert kode på grunn av mangel på database-støtte
    } 
    // Hvis vi har en avdeling (tildelt til en avdeling)
    else if (department !== null) {
      updateData.adminId = null; // Nullstill adminId når en avdeling tar saken
      updateData.department = department;
    }
    
    const [updatedCase] = await db.update(cases)
      .set(updateData)
      .where(eq(cases.id, id))
      .returning();
    
    return updatedCase;
  }
  
  async closeCase(id: number, closedById: number): Promise<Case | undefined> {
    const [updatedCase] = await db.update(cases)
      .set({
        isClosed: true,
        status: 'closed',
        closedAt: new Date(),
        closedById: closedById,
        updatedAt: new Date()
      })
      .where(eq(cases.id, id))
      .returning();
    
    return updatedCase;
  }
  
  async reopenCase(id: number): Promise<Case | undefined> {
    const [updatedCase] = await db.update(cases)
      .set({
        isClosed: false,
        status: 'open',
        closedAt: null,
        closedById: null,
        updatedAt: new Date()
      })
      .where(eq(cases.id, id))
      .returning();
    
    return updatedCase;
  }
  
  // Case messages methods implementation (meldinger i sak)
  async getCaseMessages(caseId: number): Promise<CaseMessage[]> {
    console.log(`STORAGE: Henter meldinger for sak #${caseId}`);
    
    // Utvidet spørring for å sikre at vi får alle data
    const messages = await db.select()
      .from(caseMessages)
      .where(eq(caseMessages.caseId, caseId))
      .orderBy(asc(caseMessages.createdAt));
    
    console.log(`STORAGE: Fant ${messages.length} meldinger for sak #${caseId}`);
    
    // Sjekk at vi har komplette meldinger
    messages.forEach((msg, i) => {
      if (!msg.message || msg.message.trim() === '') {
        console.log(`ADVARSEL: Melding #${msg.id} mangler innhold!`);
      }
    });
    
    return messages;
  }
  
  async getCaseMessage(id: number): Promise<CaseMessage | undefined> {
    const [message] = await db.select().from(caseMessages).where(eq(caseMessages.id, id));
    return message;
  }
  
  async addCaseMessage(caseId: number, senderId: number, message: string, isAdminMessage: boolean, targetUserId?: number): Promise<CaseMessage> {
    console.log(`Legger til melding i sak #${caseId} fra bruker #${senderId}. Melding: "${message.substring(0, 30)}..."`);
    
    // Oppdater saken med nyeste dato
    await db.update(cases)
      .set({
        updatedAt: new Date(),
        status: isAdminMessage ? 'open' : 'in-progress' // Hvis admin sender: i-progress, hvis bruker sender: open
      })
      .where(eq(cases.id, caseId));
    
    // Legg til meldingen
    const [newMessage] = await db.insert(caseMessages)
      .values({
        caseId,
        senderId,
        message,
        isAdminMessage,
        isRead: false,
        targetUserId: targetUserId || null // Include targetUserId if provided
      })
      .returning();
    
    console.log(`Ny melding opprettet med ID #${newMessage.id} i sak #${caseId}`);
    
    return newMessage;
  }
  
  async markCaseMessageAsRead(id: number): Promise<CaseMessage | undefined> {
    const [message] = await db.update(caseMessages)
      .set({ isRead: true })
      .where(eq(caseMessages.id, id))
      .returning();
    
    return message;
  }
  
  async getUnreadMessageCount(userId: number): Promise<number> {
    // Hent antall uleste meldinger for en bruker (fra administrator)
    const result = await db.select({ count: count() })
      .from(caseMessages)
      .innerJoin(cases, eq(caseMessages.caseId, cases.id))
      .where(
        and(
          eq(cases.userId, userId),
          eq(caseMessages.isAdminMessage, true),
          eq(caseMessages.isRead, false)
        )
      );
    
    return result[0].count || 0;
  }
  
  async getUnreadAdminMessageCount(adminId: number): Promise<number> {
    // Hent antall uleste meldinger for en administrator (fra brukere)
    const result = await db.select({ count: count() })
      .from(caseMessages)
      .innerJoin(cases, eq(caseMessages.caseId, cases.id))
      .where(
        and(
          eq(cases.adminId, adminId),
          eq(caseMessages.isAdminMessage, false),
          eq(caseMessages.isRead, false)
        )
      );
    
    return result[0].count || 0;
  }
  
  // Case attachments methods implementation (vedlegg til sak)
  async getCaseAttachments(caseId: number): Promise<CaseAttachment[]> {
    return db.select()
      .from(caseAttachments)
      .where(eq(caseAttachments.caseId, caseId))
      .orderBy(desc(caseAttachments.uploadedAt));
  }
  
  async getCaseAttachment(id: number): Promise<CaseAttachment | undefined> {
    const [attachment] = await db.select().from(caseAttachments).where(eq(caseAttachments.id, id));
    return attachment;
  }
  
  async addCaseAttachment(
    caseId: number, 
    messageId: number | null, 
    uploadedById: number, 
    fileName: string, 
    fileType: string, 
    fileSize: number, 
    fileUrl: string
  ): Promise<CaseAttachment> {
    const [attachment] = await db.insert(caseAttachments)
      .values({
        caseId,
        messageId: messageId || null,
        fileName,
        fileType,
        fileSize,
        fileUrl,
        uploadedBy: uploadedById
      })
      .returning();
    
    return attachment;
  }
  
  async deleteCaseAttachment(id: number): Promise<boolean> {
    const result = await db.delete(caseAttachments).where(eq(caseAttachments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Price ranges methods (prisintervaller)
  async getPriceRanges(): Promise<PriceRange[]> {
    return db.select().from(priceRanges).orderBy(asc(priceRanges.createdAt));
  }

  async getPriceRange(id: number): Promise<PriceRange | undefined> {
    const [priceRange] = await db.select().from(priceRanges).where(eq(priceRanges.id, id));
    return priceRange;
  }

  async createPriceRange(insertPriceRange: InsertPriceRange): Promise<PriceRange> {
    const [priceRange] = await db.insert(priceRanges).values(insertPriceRange).returning();
    return priceRange;
  }

  async updatePriceRange(id: number, priceRangeUpdate: Partial<InsertPriceRange>): Promise<PriceRange | undefined> {
    const [priceRange] = await db
      .update(priceRanges)
      .set({ ...priceRangeUpdate, updatedAt: new Date() })
      .where(eq(priceRanges.id, id))
      .returning();
    return priceRange;
  }

  async deletePriceRange(id: number): Promise<boolean> {
    const result = await db.delete(priceRanges).where(eq(priceRanges.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Payout methods (utbetalinger)
  async getPayouts(userId: number): Promise<Payout[]> {
    return db.select().from(payouts)
      .where(eq(payouts.userId, userId))
      .orderBy(desc(payouts.year), desc(payouts.month));
  }

  async getPayoutsByYear(userId: number, year: number): Promise<Payout[]> {
    return db.select().from(payouts)
      .where(and(
        eq(payouts.userId, userId),
        eq(payouts.year, year)
      ))
      .orderBy(asc(payouts.month));
  }

  async getAllPayouts(): Promise<Payout[]> {
    return db.select().from(payouts)
      .orderBy(desc(payouts.year), desc(payouts.month));
  }

  async getPayout(id: number): Promise<Payout | undefined> {
    const [payout] = await db.select().from(payouts).where(eq(payouts.id, id));
    return payout;
  }

  async createPayout(insertPayout: InsertPayout): Promise<Payout> {
    const [payout] = await db.insert(payouts).values(insertPayout).returning();
    return payout;
  }

  async updatePayout(id: number, payoutUpdate: Partial<InsertPayout>): Promise<Payout | undefined> {
    const [payout] = await db
      .update(payouts)
      .set({ ...payoutUpdate, updatedAt: new Date() })
      .where(eq(payouts.id, id))
      .returning();
    return payout;
  }

  async deletePayout(id: number): Promise<boolean> {
    const result = await db.delete(payouts).where(eq(payouts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Account number change log methods
  async logAccountNumberChange(
    userId: number, 
    changedById: number, 
    oldAccountNumber: string | null, 
    newAccountNumber: string | null, 
    reason?: string
  ): Promise<void> {
    await db.insert(accountNumberLogs).values({
      userId,
      changedById,
      oldAccountNumber,
      newAccountNumber,
      changeReason: reason
    });
  }
  
  async getAccountNumberLogs(userId: number): Promise<any[]> {
    return db.select().from(accountNumberLogs)
      .where(eq(accountNumberLogs.userId, userId))
      .orderBy(desc(accountNumberLogs.changedAt));
  }
  
  // Admin agreement methods implementation
  async getAdminAgreements(adminId?: number, isAdmin?: boolean, filterUserId?: number): Promise<AdminAgreement[]> {
    console.log("🗄️ Storage getAdminAgreements called:", { adminId, isAdmin, filterUserId });
    
    if (isAdmin && adminId) {
      // Admin ser alle avtaler de har opprettet
      let whereCondition = eq(adminAgreements.adminId, adminId);
      
      // Filtrer etter spesifikk bruker hvis forespurt
      if (filterUserId) {
        whereCondition = and(
          eq(adminAgreements.adminId, adminId),
          eq(adminAgreements.userId, filterUserId)
        );
        console.log("🎯 Using filtered query: admin_id =", adminId, "AND user_id =", filterUserId);
      } else {
        console.log("📂 Using unfiltered query: admin_id =", adminId);
      }
      
      const result = await db.select().from(adminAgreements)
        .where(whereCondition)
        .orderBy(desc(adminAgreements.meetingDate));
      
      console.log("✅ Query result:", result.length, "agreements found");
      return result;
    } else if (adminId && !isAdmin) {
      // Vanlig bruker ser avtaler de er med i
      return db.select().from(adminAgreements)
        .where(eq(adminAgreements.userId, adminId))
        .orderBy(desc(adminAgreements.meetingDate));
    }
    // Hent alle avtaler (for super admin)
    return db.select().from(adminAgreements)
      .orderBy(desc(adminAgreements.meetingDate));
  }
  
  async getAdminAgreement(id: number): Promise<AdminAgreement | undefined> {
    const [agreement] = await db.select().from(adminAgreements)
      .where(eq(adminAgreements.id, id));
    return agreement;
  }
  
  async createAdminAgreement(agreement: InsertAdminAgreement): Promise<AdminAgreement> {
    const [newAgreement] = await db.insert(adminAgreements)
      .values(agreement)
      .returning();
    return newAgreement;
  }
  
  async updateAdminAgreement(id: number, agreement: Partial<InsertAdminAgreement>): Promise<AdminAgreement | undefined> {
    const [updated] = await db.update(adminAgreements)
      .set({ ...agreement, updatedAt: new Date() })
      .where(eq(adminAgreements.id, id))
      .returning();
    return updated;
  }
  
  async deleteAdminAgreement(id: number): Promise<boolean> {
    const result = await db.delete(adminAgreements)
      .where(eq(adminAgreements.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
  
  // Agreement note methods implementation
  async getAgreementNotes(agreementId: number, userId?: number, isAdmin?: boolean): Promise<AgreementNote[]> {
    let query = db.select().from(agreementNotes)
      .where(eq(agreementNotes.agreementId, agreementId));
    
    // Hvis ikke admin, filtrer bort private notater
    if (!isAdmin) {
      query = db.select().from(agreementNotes)
        .where(
          and(
            eq(agreementNotes.agreementId, agreementId),
            eq(agreementNotes.isPrivate, false)
          )
        );
    }
    
    return query.orderBy(desc(agreementNotes.createdAt));
  }
  
  async createAgreementNote(note: InsertAgreementNote): Promise<AgreementNote> {
    const [newNote] = await db.insert(agreementNotes)
      .values(note)
      .returning();
    return newNote;
  }
  
  async updateAgreementNote(id: number, note: Partial<InsertAgreementNote>): Promise<AgreementNote | undefined> {
    const [updated] = await db.update(agreementNotes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(agreementNotes.id, id))
      .returning();
    return updated;
  }
  
  async deleteAgreementNote(id: number): Promise<boolean> {
    const result = await db.delete(agreementNotes)
      .where(eq(agreementNotes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Beds24 configuration methods
  async getBeds24Config(userId: number): Promise<Beds24Config | null> {
    const [config] = await db.select()
      .from(beds24Config)
      .where(eq(beds24Config.userId, userId));
    return config || null;
  }

  async getAllBeds24Configs(): Promise<Beds24Config[]> {
    return db.select()
      .from(beds24Config)
      .where(eq(beds24Config.syncEnabled, true));
  }

  async upsertBeds24Config(userId: number, config: Partial<InsertBeds24Config>): Promise<Beds24Config> {
    // Check if config exists
    const existing = await this.getBeds24Config(userId);
    
    if (existing) {
      // Update existing
      const [updated] = await db.update(beds24Config)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(beds24Config.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new
      const [created] = await db.insert(beds24Config)
        .values({ ...config, userId })
        .returning();
      return created;
    }
  }

  async updateBeds24Config(id: number, config: Partial<InsertBeds24Config>): Promise<Beds24Config | undefined> {
    const [updated] = await db.update(beds24Config)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(beds24Config.id, id))
      .returning();
    return updated;
  }

  async deleteBeds24Config(userId: number): Promise<boolean> {
    const result = await db.delete(beds24Config)
      .where(eq(beds24Config.userId, userId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBeds24Events(userId: number): Promise<Event[]> {
    // Get events that come from Beds24 API
    return db.select()
      .from(events)
      .where(
        and(
          eq(events.userId, userId),
          eq(sql`${events.source}->>'type'`, 'beds24')
        )
      );
  }
}

export const storage = new DatabaseStorage();
