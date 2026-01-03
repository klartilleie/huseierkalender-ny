import { createReadStream } from "fs";
import csv from "csv-parser";
import { DatabaseStorage } from "../server/storage";
import { db } from "../server/db";
import { events } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import * as dotenv from "dotenv";
import { sanitizeEventDescription } from "../server/utils/sanitize";

dotenv.config();

// Configuration
const USER_ID = 14; // Geir Stølen's user ID
const CSV_FILE = "../attached_assets/Geir Stølen_1757792082104.csv";

// Color mapping based on status and type
const getColorForBooking = (status: string, fullName: string): string => {
  const nameLC = fullName.toLowerCase();
  
  // Owner blocks (orange)
  if (nameLC.includes("eier sperre")) {
    return "#f59e0b";
  }
  
  // Confirmed bookings (green)
  if (status === "Confirmed") {
    return "#10b981";
  }
  
  // New bookings (blue) - default
  return "#3b82f6";
};

// Parse date string from CSV format (e.g., "Sat  3 May 2025")
const parseDate = (dateStr: string, isCheckOut: boolean = false): Date => {
  // Remove extra spaces and parse
  const cleanDate = dateStr.replace(/\s+/g, " ").trim();
  const date = new Date(cleanDate);
  
  // For check-out, set to 10:00 AM
  if (isCheckOut) {
    date.setHours(10, 0, 0, 0);
  } else {
    // For check-in, set to 3:00 PM
    date.setHours(15, 0, 0, 0);
  }
  
  return date;
};

async function importCSV() {
  const storage = new DatabaseStorage();
  const importedEvents: any[] = [];
  const duplicates: string[] = [];
  const errors: any[] = [];
  
  console.log("Starting CSV import for Geir Stølen (User ID: 14)...");
  console.log(`Reading CSV file: ${CSV_FILE}`);
  
  // Parse CSV file
  const records: any[] = [];
  
  await new Promise((resolve, reject) => {
    createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`Found ${records.length} records in CSV file`);
  
  // Process each record
  for (const record of records) {
    try {
      const bookingNumber = record['Number'];
      const status = record['Status'];
      const property = record['Property'];
      const room = record['Room'];
      const checkIn = record['Check In'];
      const checkOut = record['Check Out'];
      const nights = record['Nights'];
      const fullName = record['Full Name'];
      const email = record['Email'];
      const adults = record['Adults'];
      const children = record['Children'];
      const referrer = record['Referrer'];
      const bookingDate = record['Booking Date'];
      
      // Skip empty rows
      if (!bookingNumber || !checkIn || !checkOut) {
        continue;
      }
      
      console.log(`\nProcessing booking #${bookingNumber}: ${fullName}`);
      
      // Check for duplicate using booking number in source metadata
      const existingEvents = await db.select()
        .from(events)
        .where(
          and(
            eq(events.userId, USER_ID),
            eq(events.csvProtected, true)
          )
        );
      
      const duplicate = existingEvents.find(event => {
        if (event.source && typeof event.source === 'object') {
          const source = event.source as any;
          return source.bookingNumber === bookingNumber;
        }
        return false;
      });
      
      if (duplicate) {
        console.log(`  - Duplicate found, skipping booking #${bookingNumber}`);
        duplicates.push(bookingNumber);
        continue;
      }
      
      // Parse dates
      const startDate = parseDate(checkIn, false);
      const endDate = parseDate(checkOut, true);
      
      // Determine color based on status and name
      const color = getColorForBooking(status, fullName);
      
      // Create event title
      let title = fullName;
      if (referrer && referrer !== "Google Calendar") {
        title += ` (${referrer})`;
      }
      
      // Build simplified description with only essential info
      const descriptionParts = [
        `Booking #${bookingNumber}`,
        `Nights: ${nights}`,
        `Adults: ${adults}`,
        `Children: ${children}`,
        `Booking Date: ${bookingDate}`,
        `Source: ${referrer}`
      ].filter(Boolean);
      
      // Sanitize the description to remove any email addresses
      const description = sanitizeEventDescription(descriptionParts.join("\n"));
      
      // Create the event
      const event = await storage.createEvent(USER_ID, {
        title,
        description,
        startTime: startDate,
        endTime: endDate,
        color,
        adminColorOverride: color,
        allDay: true,
        csvProtected: true,
        source: {
          type: "csv_import",
          bookingNumber,
          property,
          room,
          referrer,
          status,
          importedAt: new Date().toISOString(),
          originalFile: "Geir Stølen_1757792082104.csv"
        },
        location: property,
        isPrivate: false,
        syncToExternal: false
      });
      
      importedEvents.push({
        bookingNumber,
        title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        color,
        status
      });
      
      console.log(`  ✓ Created event: ${title} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`);
      console.log(`    Color: ${color} | Status: ${status}`);
      
    } catch (error) {
      console.error(`  ✗ Error processing booking #${record['Number']}:`, error);
      errors.push({
        bookingNumber: record['Number'],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total records processed: ${records.length}`);
  console.log(`Successfully imported: ${importedEvents.length}`);
  console.log(`Duplicates skipped: ${duplicates.length}`);
  console.log(`Errors encountered: ${errors.length}`);
  
  if (duplicates.length > 0) {
    console.log("\nDuplicate bookings (already exist):");
    duplicates.forEach(num => console.log(`  - Booking #${num}`));
  }
  
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(err => console.log(`  - Booking #${err.bookingNumber}: ${err.error}`));
  }
  
  if (importedEvents.length > 0) {
    console.log("\nImported events:");
    importedEvents.forEach(evt => {
      console.log(`  - ${evt.title}`);
      console.log(`    Booking #${evt.bookingNumber} | ${evt.status} | ${evt.color}`);
      console.log(`    ${new Date(evt.startDate).toLocaleDateString()} - ${new Date(evt.endDate).toLocaleDateString()}`);
    });
  }
  
  console.log("\nImport completed!");
  process.exit(0);
}

// Run the import
importCSV().catch(error => {
  console.error("Fatal error during import:", error);
  process.exit(1);
});