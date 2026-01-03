import fs from 'fs';
import path from 'path';
import { db } from './db';
import { events, icalFeeds, icalEventNotes, markedDays, backups, InsertBackup } from '@shared/schema';
import { storage } from './storage';
import { eq } from 'drizzle-orm';

const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10; // Maximum number of backup files to keep

interface BackupData {
  timestamp: string;
  events: any[];
  icalFeeds: any[];
  icalEventNotes: any[];
  markedDays: any[];
}

interface BackupSummary {
  eventsCount: number;
  icalFeedsCount: number;
  icalEventNotesCount: number;
  markedDaysCount: number;
}

/**
 * Creates a backup of all calendar-related data
 */
export async function createBackup(isAutomatic: boolean = true): Promise<string> {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Fetch all relevant data
    let allEvents: any[] = [];
    let allIcalFeeds: any[] = [];
    let allIcalEventNotes: any[] = [];
    let allMarkedDays: any[] = [];
    
    try {
      [
        allEvents,
        allIcalFeeds,
        allIcalEventNotes,
        allMarkedDays
      ] = await Promise.all([
        db.select().from(events).execute(),
        db.select().from(icalFeeds).execute(),
        db.select().from(icalEventNotes).execute(),
        db.select().from(markedDays).execute()
      ]);
    } catch (error) {
      console.warn('Some tables might not exist yet, continuing with backup of available data');
      
      // Try to fetch data table by table to handle cases where some tables might not exist yet
      try { allEvents = await db.select().from(events).execute(); } catch (e) { console.warn('Events table not accessible'); }
      try { allIcalFeeds = await db.select().from(icalFeeds).execute(); } catch (e) { console.warn('IcalFeeds table not accessible'); }
      try { allIcalEventNotes = await db.select().from(icalEventNotes).execute(); } catch (e) { console.warn('IcalEventNotes table not accessible'); }
      try { allMarkedDays = await db.select().from(markedDays).execute(); } catch (e) { console.warn('MarkedDays table not accessible'); }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData: BackupData = {
      timestamp,
      events: allEvents,
      icalFeeds: allIcalFeeds,
      icalEventNotes: allIcalEventNotes,
      markedDays: allMarkedDays
    };

    // Create summary for tracking
    const summary: BackupSummary = {
      eventsCount: allEvents.length,
      icalFeedsCount: allIcalFeeds.length,
      icalEventNotesCount: allIcalEventNotes.length,
      markedDaysCount: allMarkedDays.length
    };

    const backupFilename = `calendar_backup_${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    // Write backup file
    const jsonData = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupPath, jsonData);
    
    // Record in database
    const fileSize = Buffer.byteLength(jsonData, 'utf8');
    const insertData: InsertBackup = {
      filename: backupFilename,
      isAutomatic,
      size: fileSize,
      summary
    };
    
    await db.insert(backups).values(insertData);

    // Clean up old backups
    await cleanupOldBackups();

    console.log(`Backup created: ${backupFilename} (${fileSize} bytes)`);
    return backupFilename;
  } catch (error) {
    console.error('Failed to create backup:', error);
    throw new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Restores data from a backup file
 */
export async function restoreBackup(backupFilename: string): Promise<boolean> {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }
    
    const backupData: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    // Create a safety backup before restoring
    await createBackup(false);
    
    // Clear existing data (in reverse dependency order)
    try {
      await db.delete(icalEventNotes);
    } catch (error) {
      console.warn('Failed to clear icalEventNotes table, it might not exist yet');
    }
    
    try {
      await db.delete(markedDays);
    } catch (error) {
      console.warn('Failed to clear markedDays table, it might not exist yet');
    }
    
    try {
      await db.delete(events);
    } catch (error) {
      console.warn('Failed to clear events table, it might not exist yet');
    }
    
    try {
      await db.delete(icalFeeds);
    } catch (error) {
      console.warn('Failed to clear icalFeeds table, it might not exist yet');
    }
    
    // Restore data from backup
    if (backupData.icalFeeds && backupData.icalFeeds.length > 0) {
      await db.insert(icalFeeds).values(backupData.icalFeeds);
    }
    
    if (backupData.events && backupData.events.length > 0) {
      await db.insert(events).values(backupData.events);
    }
    
    if (backupData.markedDays && backupData.markedDays.length > 0) {
      await db.insert(markedDays).values(backupData.markedDays);
    }
    
    if (backupData.icalEventNotes && backupData.icalEventNotes.length > 0) {
      await db.insert(icalEventNotes).values(backupData.icalEventNotes);
    }

    console.log(`Backup restored: ${backupFilename}`);
    return true;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    throw new Error(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets a list of available backup files from the database
 */
export async function getBackupsList(): Promise<typeof backups.$inferSelect[]> {
  return db.select().from(backups).orderBy(backups.createdAt).execute();
}

/**
 * Delete old backups to prevent excessive disk usage
 */
async function cleanupOldBackups(): Promise<void> {
  try {
    // Get all backups ordered by creation date (oldest first)
    const allBackups = await db.select().from(backups).orderBy(backups.createdAt).execute();
    
    if (allBackups.length > MAX_BACKUPS) {
      const toDelete = allBackups.slice(0, allBackups.length - MAX_BACKUPS);
      
      for (const backup of toDelete) {
        // Delete from filesystem
        const filePath = path.join(BACKUP_DIR, backup.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // Delete from database
        await db.delete(backups).where(eq(backups.filename, backup.filename));
        console.log(`Deleted old backup: ${backup.filename}`);
      }
    }
  } catch (error) {
    console.error('Failed to clean up old backups:', error);
  }
}

/**
 * Export all calendar data as an iCalendar file for a specific user
 * This can be used as an additional backup mechanism and to keep external calendar feeds in sync
 */
export async function exportUserCalendarAsIcal(userId: number): Promise<string> {
  try {
    console.log(`Exporting calendar for user ${userId} as iCal`);
    
    // Fetch the user for the calendar information
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error(`User not found with ID ${userId}`);
    }
    
    // Fetch user events directly from storage without caching
    const allEvents = await storage.getEvents(userId);
    
    // Filter out external API events to prevent circular data flow
    // Only export events that were created locally on the website
    const localEvents = allEvents.filter(event => {
      // Exclude events that have an external source (came from APIs or feeds)
      if (event.source && 
          typeof event.source === 'object' && 
          'type' in event.source) {
        // Filter out iCal feed events
        if (event.source.type === 'ical') {
          return false;
        }
        // Filter out Beds24 API events
        if (event.source.type === 'beds24') {
          return false;
        }
      }
      // Include only locally created events (no external source)
      return true;
    });
    
    console.log(`Exported ${localEvents.length} local events (filtered from ${allEvents.length} total) for user ${userId}`);
    
    // Generate iCalendar format content
    const calendarName = user.name ? `${user.name}'s Calendar` : `Smart Hjem Calendar`;
    const now = new Date();
    
    // Standard iCal format header
    let icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Smart Hjem Calendar//Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${calendarName}`,
      `X-WR-TIMEZONE:Europe/Oslo`,
      `X-WR-CALDESC:Kalender fra Smart Hjem`
    ].join("\r\n") + "\r\n";
    
    // Format dates to iCal format
    const formatDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
    };
    
    // Escape text for iCal format
    const escapeText = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };
    
    // Add each event (using only local events, not iCal imports)
    for (const event of localEvents) {
      const startDate = new Date(event.startTime);
      const endDate = event.endTime ? new Date(event.endTime) : new Date(startDate.getTime() + 3600000);
      
      const uid = `event-${event.id}@smarthjem.calendar`;
      const startStr = formatDate(startDate);
      const endStr = formatDate(endDate);
      
      icalContent += "BEGIN:VEVENT\r\n";
      icalContent += `UID:${uid}\r\n`;
      icalContent += `DTSTAMP:${formatDate(now)}\r\n`;
      icalContent += `DTSTART:${startStr}\r\n`;
      icalContent += `DTEND:${endStr}\r\n`;
      icalContent += `SUMMARY:${escapeText(event.title)}\r\n`;
      
      if (event.description) {
        icalContent += `DESCRIPTION:${escapeText(event.description)}\r\n`;
      }
      
      icalContent += "STATUS:CONFIRMED\r\n";
      icalContent += "TRANSP:OPAQUE\r\n";
      icalContent += `ORGANIZER;CN=Smart Hjem:mailto:kundeservice@smarthjem.as\r\n`;
      icalContent += "END:VEVENT\r\n";
    }
    
    icalContent += "END:VCALENDAR";
    return icalContent;
  } catch (error) {
    console.error(`Error exporting calendar for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Schedule regular automatic backups
 */
export function scheduleAutomaticBackups(): NodeJS.Timeout {
  console.log('Scheduled automatic daily backups');
  // Run a backup immediately on startup
  createBackup(true).catch(err => console.error('Initial backup failed:', err));
  
  // Schedule daily backups (24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
  const dailyInterval = 24 * 60 * 60 * 1000;
  return setInterval(() => {
    createBackup(true).catch(err => console.error('Scheduled backup failed:', err));
  }, dailyInterval);
}