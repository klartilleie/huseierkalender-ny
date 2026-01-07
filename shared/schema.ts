import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, varchar, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define all tables first, then schemas and relations
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Vil nå være brukerens e-postadresse
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(), // Beholdes for kompatibilitet, men vil være lik username
  isAdmin: boolean("is_admin").default(false),
  isMiniAdmin: boolean("is_mini_admin").default(false), // Read-only admin role
  isBlocked: boolean("is_blocked").default(false),
  blockReason: text("block_reason"),
  blockedAt: timestamp("blocked_at"),
  adminInfo: text("admin_info"), // Informasjon fra admin til bruker
  adminInfoUpdatedAt: timestamp("admin_info_updated_at"),
  lastLoginAt: timestamp("last_login_at"),
  phoneNumber: varchar("phone_number", { length: 20 }), // For SMS notifications
  accountNumber: varchar("account_number", { length: 30 }), // Bank account number
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true), // E-postvarsler aktivert for denne brukeren
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  color: text("color").default("#ef4444"), // Default red color
  adminColorOverride: text("admin_color_override"), // Admin kan overstyre farge uavhengig av kilde
  allDay: boolean("all_day").default(false),
  routes: text("routes").array(), // Array of route markers
  source: jsonb("source"), // For iCal hendelser, inneholder metadata om kilden
  isCollaborative: boolean("is_collaborative").default(false),
  collaborationCode: text("collaboration_code").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isBlocked: boolean("is_blocked").default(false),
  location: text("location"),
  organizer: text("organizer"),
  categories: text("categories").array(),
  transparency: text("transparency"),
  rrule: text("rrule"),
  sequence: integer("sequence"),
  isPrivate: boolean("is_private").default(false),
  syncToExternal: boolean("sync_to_external").default(false), // For lokal-til-ekstern synkronisering
  csvProtected: boolean("csv_protected").default(false), // Beskytter CSV-importerte events mot API-overskriving
});

export const markedDays = pgTable("marked_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  markerType: text("marker_type").notNull(), // Type of marker (e.g., "busy", "vacation", "holiday")
  color: text("color").default("#8b5cf6"), // Marker color
  notes: text("notes"),
});

export const icalFeeds = pgTable("ical_feeds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  color: text("color").default("#8b5cf6"), // Default purple color
  enabled: boolean("enabled").default(true),
  lastSynced: timestamp("last_synced"),
  feedType: text("feed_type").notNull().default("import"), // "import" eller "export"
  apiEndpoint: text("api_endpoint"), // For API-basert synkronisering
  externalId: text("external_id"), // Ekstern kalender-ID
  apiKey: text("api_key"), // API-nøkkel for autentisering
  syncMethod: text("sync_method").default("ical"), // "ical" eller "api"
});

// Beds24 API konfigurasjon per bruker
export const beds24Config = pgTable("beds24_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  apiKey: text("api_key").notNull(), // Access token (24 timer)
  refreshToken: text("refresh_token"), // Refresh token for å fornye access token
  tokenExpiry: timestamp("token_expiry"), // Når access token utløper
  scopes: text("scopes"), // Tillatelser (f.eks. "read/bookings,write/bookings")
  propId: text("prop_id"), // Beds24 property ID
  syncEnabled: boolean("sync_enabled").default(true),
  syncHistoricalDays: integer("sync_historical_days").default(0), // CSV import handles historical data
  syncFutureDays: integer("sync_future_days").default(365), // Hvor mange dager fremover å synke
  lastSync: timestamp("last_sync"), // Siste gang synk ble kjørt
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const icalEventNotes = pgTable("ical_event_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  eventExternalId: text("event_external_id").notNull(), // Store the original iCal event ID
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System settings for design customization and maintenance mode
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // Setting key (e.g., "frontPage.backgroundColor", "maintenance.enabled")
  value: text("value").notNull(),      // Setting value (e.g., "#000000", "true")
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isAutomatic: boolean("is_automatic").default(true).notNull(),
  size: integer("size").notNull(),
  summary: jsonb("summary"), // Contains counts of backed up items
});

// Samarbeidsdeltagere
export const eventCollaborators = pgTable("event_collaborators", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").default("guest").notNull(), // owner, editor, guest
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Forslag til endringer i samarbeidsarrangementer
export const eventSuggestions = pgTable("event_suggestions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  suggestedBy: integer("suggested_by").notNull().references(() => users.id),
  type: text("type").notNull(), // title, description, time, location, etc.
  originalValue: text("original_value"),
  suggestedValue: text("suggested_value").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  message: text("message"), // Begrunnelse for forslaget
});

// Admin-bruker avtaler og møter
export const adminAgreements = pgTable("admin_agreements", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  meetingDate: timestamp("meeting_date").notNull(),
  endDate: timestamp("end_date"),
  location: text("location"),
  status: text("status").default("scheduled").notNull(), // scheduled, completed, cancelled
  meetingType: text("meeting_type").default("general").notNull(), // general, support, consultation, review
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  reminderSent: boolean("reminder_sent").default(false),
});

// Notater og diskusjoner fra møter
export const agreementNotes = pgTable("agreement_notes", {
  id: serial("id").primaryKey(),
  agreementId: integer("agreement_id").notNull().references(() => adminAgreements.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isPrivate: boolean("is_private").default(false), // Om notatet kun er synlig for admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gamification - Achievements (prestasjoner)
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // SVG or icon class name
  pointsValue: integer("points_value").notNull().default(10),
  requirement: text("requirement").notNull(), // Technical criteria like "create_events:5"
  category: text("category").notNull(), // grouping like "events", "ical", "collaboration" etc.
  difficulty: text("difficulty").notNull().default("medium"), // easy, medium, hard
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

// Gamification - User Achievements (bruker prestasjoner)
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id").notNull().references(() => achievements.id),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  progress: integer("progress").default(0), // For tracking partial progress
  completed: boolean("completed").default(false),
  notified: boolean("notified").default(false) // To track if user was notified
});

// Gamification - Badges (merker)
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // SVG or icon class name
  level: integer("level").default(1), // For tiered badges (e.g., bronze, silver, gold)
  category: text("category").notNull(), // "event_master", "collaborator", etc.
  requirements: jsonb("requirements").notNull(), // JSON with criteria like {"achievements": [1, 2, 3]}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

// Gamification - User Badges (bruker merker)
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badges.id),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  displayOrder: integer("display_order").default(0) // For user preference in display order
});

// Gamification - User Points (bruker poeng)
export const userPoints = pgTable("user_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0), 
  level: integer("level").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Gamification - Point Transactions (poeng transaksjoner)
export const pointTransactions = pgTable("point_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // Can be positive or negative
  reason: text("reason").notNull(), // e.g., "achievement_earned", "event_created"
  source: text("source").notNull(), // e.g., "achievement:1", "daily_login" 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata") // Optional additional data about the transaction
});

// Gamification - Streaks (for consistent usage)
export const userStreaks = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: date("last_active_date").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Price Ranges System - Excel-like price management
export const priceRanges = pgTable("price_ranges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  priceFrom: decimal("price_from", { precision: 10, scale: 2 }).notNull(),
  priceTo: decimal("price_to", { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payouts System - Månedlig utbetalingsoversikt
export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Kan være negativ for motregning
  currency: varchar("currency", { length: 3 }).notNull().default("NOK"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, paid, sent, offset
  rentalDays: integer("rental_days"), // Antall dager med utleie i måneden
  paidDate: timestamp("paid_date"),
  notes: text("notes"),
  registeredById: integer("registered_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Account Number Change Log
export const accountNumberLogs = pgTable("account_number_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  changedById: integer("changed_by_id").notNull().references(() => users.id),
  oldAccountNumber: varchar("old_account_number", { length: 30 }),
  newAccountNumber: varchar("new_account_number", { length: 30 }),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Customer Service Case Management
export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  adminId: integer("admin_id").references(() => users.id),
  department: varchar("department", { length: 50 }),
  caseNumber: varchar("case_number", { length: 20 }).notNull().unique(),
  title: text("title").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("open"),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  closedById: integer("closed_by_id").references(() => users.id),
});

export const caseMessages = pgTable("case_messages", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => users.id),
  targetUserId: integer("target_user_id").references(() => users.id), // Which user the message is directed to (for admin messages)
  message: text("message").notNull(),
  isAdminMessage: boolean("is_admin_message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  attachmentUrl: text("attachment_url"),
});

export const caseAttachments = pgTable("case_attachments", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => caseMessages.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileUrl: text("file_url").notNull(),
  uploaderId: integer("uploader_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Now define all relations
export const eventRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

export const markedDayRelations = relations(markedDays, ({ one }) => ({
  user: one(users, {
    fields: [markedDays.userId],
    references: [users.id],
  }),
}));

export const icalFeedRelations = relations(icalFeeds, ({ one }) => ({
  user: one(users, {
    fields: [icalFeeds.userId],
    references: [users.id],
  }),
}));

export const icalEventNotesRelations = relations(icalEventNotes, ({ one }) => ({
  user: one(users, {
    fields: [icalEventNotes.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokenRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Relations for case management
export const caseRelations = relations(cases, ({ one, many }) => ({
  user: one(users, {
    fields: [cases.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [cases.adminId],
    references: [users.id],
  }),
  closedBy: one(users, {
    fields: [cases.closedById],
    references: [users.id],
  }),
  messages: many(caseMessages),
  attachments: many(caseAttachments),
}));

export const caseMessageRelations = relations(caseMessages, ({ one }) => ({
  case: one(cases, {
    fields: [caseMessages.caseId],
    references: [cases.id],
  }),
  sender: one(users, {
    fields: [caseMessages.senderId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [caseMessages.targetUserId],
    references: [users.id],
  }),
}));

export const caseAttachmentRelations = relations(caseAttachments, ({ one }) => ({
  case: one(cases, {
    fields: [caseAttachments.caseId],
    references: [cases.id],
  }),
  message: one(caseMessages, {
    fields: [caseAttachments.messageId],
    references: [caseMessages.id],
  }),
  uploader: one(users, {
    fields: [caseAttachments.uploaderId],
    references: [users.id],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  events: many(events),
  icalFeeds: many(icalFeeds),
  markedDays: many(markedDays),
  icalEventNotes: many(icalEventNotes),
  cases: many(cases),
  caseMessages: many(caseMessages),
}));

// Insert schemas
export const insertUserSchema = z.object({
  username: z.string().email("E-postadresse må være gyldig").min(1, "E-post er påkrevd"),
  password: z.string().min(6, "Passord må være minst 6 tegn"),
  name: z.string().min(1, "Navn er påkrevd"),
  email: z.string().email(),
  isAdmin: z.boolean().optional(),
  isMiniAdmin: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  blockReason: z.string().optional(),
  blockedAt: z.date().optional(),
  adminInfo: z.string().optional(),
  adminInfoUpdatedAt: z.date().optional(),
  lastLoginAt: z.date().optional(),
  phoneNumber: z.string().optional(),
  accountNumber: z.string().optional(),
});

export const insertEventSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  startTime: z.date(),
  endTime: z.date().optional(),
  color: z.string().optional(),
  allDay: z.boolean().optional(),
  routes: z.array(z.string()).optional(),
  source: z.any().optional(),
  isCollaborative: z.boolean().optional(),
  collaborationCode: z.string().optional(),
});

export const insertIcalFeedSchema = z.object({
  userId: z.number(),
  name: z.string(),
  url: z.string(),
  color: z.string().optional(),
  enabled: z.boolean().optional(),
  lastSynced: z.date().optional(),
});

export const insertMarkedDaySchema = z.object({
  date: z.date(),
  markerType: z.string(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

export const insertIcalEventNoteSchema = z.object({
  eventExternalId: z.string(),
  notes: z.string(),
});

export const insertSystemSettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const insertBackupSchema = z.object({
  filename: z.string(),
  isAutomatic: z.boolean(),
  size: z.number(),
  summary: z.any().optional(),
});

export const insertPasswordResetTokenSchema = z.object({
  userId: z.number(),
  token: z.string(),
  expiresAt: z.date(),
});

export const insertAdminAgreementSchema = z.object({
  adminId: z.number(),
  userId: z.number(),
  title: z.string(),
  description: z.string().optional(),
  meetingDate: z.date(),
  endDate: z.date().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  meetingType: z.string().optional(),
});

export const insertAgreementNoteSchema = z.object({
  agreementId: z.number(),
  authorId: z.number(),
  content: z.string(),
  isPrivate: z.boolean().optional(),
});

export const insertPriceRangeSchema = z.object({
  name: z.string(),
  priceFrom: z.string(),
  priceTo: z.string(),
  discountPercent: z.string(),
  isActive: z.boolean().optional(),
}).extend({
  name: z.string().min(1, "Navn er påkrevd"),
  priceFrom: z.string().min(1, "Pris fra er påkrevd"),
  priceTo: z.string().min(1, "Pris til er påkrevd"),
  discountPercent: z.string().min(0, "Rabatt kan ikke være negativ"),
});

export const insertPayoutSchema = z.object({
  userId: z.number(),
  month: z.number(),
  year: z.number(),
  amount: z.string(),
  currency: z.string().optional(),
  status: z.string().optional(),
  rentalDays: z.number().optional(),
  paidDate: z.date().optional(),
  notes: z.string().optional(),
  registeredById: z.number().optional(),
}).extend({
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  amount: z.string().or(z.number()).transform(val => String(val)),
  currency: z.string().default("NOK"),
  status: z.enum(["pending", "paid", "sent", "offset"]).default("pending"),
});

export type PriceRange = typeof priceRanges.$inferSelect;
export type InsertPriceRange = typeof priceRanges.$inferInsert;

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = typeof payouts.$inferInsert;

// Schema for cases
// Denne skjemadefinisjonen er flyttet og kombinert med hoveddefinisjonen lenger ned i filen

// Schema for inserting cases in the database
export const insertCaseSchema = z.object({
  userId: z.number(),
  adminId: z.number().optional(),
  title: z.string(),
  category: z.string(),
  priority: z.string(),
  status: z.string().optional(),
}).extend({
  title: z.string().min(1, "Tittel er påkrevd"),
  category: z.string(),
  priority: z.string(),
});

export const insertCaseMessageSchema = z.object({
  caseId: z.number(),
  senderId: z.number(),
  message: z.string(),
  isAdminMessage: z.boolean(),
  attachmentUrl: z.string().optional(),
}).extend({
  message: z.string().min(1, "Melding kan ikke være tom"),
});

export const insertCaseAttachmentSchema = z.object({
  caseId: z.number(),
  messageId: z.number().optional(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  fileUrl: z.string(),
  uploaderId: z.number(),
}).extend({
  fileName: z.string().min(1, "Filnavn er påkrevd"),
  fileUrl: z.string().min(1, "Fil-URL er påkrevd"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertIcalFeed = z.infer<typeof insertIcalFeedSchema>;
export type IcalFeed = typeof icalFeeds.$inferSelect;

export type Beds24Config = typeof beds24Config.$inferSelect;
export type InsertBeds24Config = typeof beds24Config.$inferInsert;

export type InsertMarkedDay = z.infer<typeof insertMarkedDaySchema>;
export type MarkedDay = typeof markedDays.$inferSelect;

export type InsertIcalEventNote = z.infer<typeof insertIcalEventNoteSchema>;
export type IcalEventNote = typeof icalEventNotes.$inferSelect;

export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;

export type InsertBackup = z.infer<typeof insertBackupSchema>;
export type Backup = typeof backups.$inferSelect;

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Types for case management
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export type InsertCaseMessage = z.infer<typeof insertCaseMessageSchema>;
export type CaseMessage = typeof caseMessages.$inferSelect;

export type InsertCaseAttachment = z.infer<typeof insertCaseAttachmentSchema>;
export type CaseAttachment = typeof caseAttachments.$inferSelect;

// Types for admin agreements
export type InsertAdminAgreement = z.infer<typeof insertAdminAgreementSchema>;
export type AdminAgreement = typeof adminAgreements.$inferSelect;

export type InsertAgreementNote = z.infer<typeof insertAgreementNoteSchema>;
export type AgreementNote = typeof agreementNotes.$inferSelect;

// Extended schemas for form validation
export const loginSchema = z.object({
  username: z.string().email("E-postadresse må være gyldig").min(1, "E-post er påkrevd"),
  password: z.string().min(1, "Passord er påkrevd"),
});

// Case form schema for frontend validering og API-forespørsler
export const caseFormSchema = z.object({
  title: z.string().min(3, "Tittel må være minst 3 tegn"),
  category: z.enum(["technical", "billing", "account", "calendar", "appointment", "other"], {
    errorMap: () => ({ message: "Velg en gyldig kategori" }),
  }),
  priority: z.enum(["low", "medium", "high"], {
    errorMap: () => ({ message: "Velg en gyldig prioritet" }),
  }),
  message: z.string().min(1, "Første melding kan ikke være tom"),
});

// Case message form schema
export const caseMessageFormSchema = insertCaseMessageSchema.extend({
  message: z.string().min(1, "Melding kan ikke være tom"),
  attachmentUrl: z.string().optional(),
  targetUserId: z.number().optional(), // Allow admin to select which user to send message to
});

export type LoginCredentials = z.infer<typeof loginSchema>;

// Event schema with client-side validation
export const eventFormSchema = insertEventSchema.extend({
  title: z.string().min(1, "Title is required"),
  startTime: z.string().or(z.date()).pipe(
    z.coerce.date().refine(val => !isNaN(val.getTime()), "Invalid date")
  ),
  endTime: z.string().or(z.date()).pipe(
    z.coerce.date().refine(val => !isNaN(val.getTime()), "Invalid date")
  ).optional().nullable(),
  allDay: z.boolean().default(false),
  color: z.string().default("#ef4444"),
  description: z.string().optional(),
  routes: z.array(z.string()).optional().default([]),
});

// iCal feed schema with client-side validation
export const icalFeedFormSchema = insertIcalFeedSchema.extend({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("URL must be valid").min(1, "URL is required"),
  color: z.string().default("#8b5cf6"),
  enabled: z.boolean().optional(),
  lastSynced: z.date().optional().nullable(),
});

// Marked day form schema
export const markedDayFormSchema = insertMarkedDaySchema.extend({
  date: z.string().or(z.date()).pipe(
    z.coerce.date().refine(val => !isNaN(val.getTime()), "Invalid date")
  ),
  markerType: z.string().min(1, "Marker type is required"),
  color: z.string().default("#8b5cf6"),
  notes: z.string().optional(),
});

// iCal Event Note form schema
export const icalEventNoteFormSchema = insertIcalEventNoteSchema.extend({
  eventExternalId: z.string().min(1, "Event ID is required"),
  notes: z.string().min(1, "Note is required"),
});

// System settings schema with client-side validation
export const systemSettingFormSchema = insertSystemSettingSchema.extend({
  key: z.string().min(1, "Setting key is required"),
  value: z.string().min(1, "Setting value is required"),
});

// Admin agreement form schema
export const adminAgreementFormSchema = z.object({
  userId: z.number().min(1, "Bruker må velges"),
  title: z.string().min(1, "Tittel er påkrevd"),
  description: z.string().optional(),
  meetingDate: z.string().or(z.date()).pipe(
    z.coerce.date().refine(val => !isNaN(val.getTime()), "Ugyldig dato")
  ),
  endDate: z.string().or(z.date()).pipe(
    z.coerce.date().refine(val => !isNaN(val.getTime()), "Ugyldig dato")
  ).optional().nullable(),
  meetingLocation: z.string().optional(), // Endret fra location til meetingLocation for å matche frontend
  meetingType: z.enum(["general", "support", "consultation", "review"]).default("general"),
  status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled"),
});

// Agreement note form schema
export const agreementNoteFormSchema = insertAgreementNoteSchema.extend({
  content: z.string().min(1, "Innhold er påkrevd"),
  isPrivate: z.boolean().default(false),
});