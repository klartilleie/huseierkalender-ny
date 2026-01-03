import { Event } from "@shared/schema";

// Parse iCal events to our application format
export function parseICalEvents(icalData: any, feedId: number, feedName: string, color: string): Event[] {
  if (!icalData) return [];
  
  // Handle various response formats
  let events: any[] = [];
  
  // Standard node-ical format
  if (icalData.events && Array.isArray(icalData.events)) {
    events = icalData.events;
  } 
  // Google Calendar and other formats that return objects with key-value pairs
  else if (typeof icalData === 'object') {
    // Try to detect Google Calendar format by examining keys
    const isGoogleCalendar = Object.keys(icalData).some(key => 
      key.startsWith('google') || key.includes('@google.com') || key.includes('@calendar.google.com')
    );
    
    events = Object.keys(icalData)
      .filter(key => {
        const item = icalData[key];
        // Include only VEVENT items and exclude any non-object items
        return item && typeof item === 'object' && 
              (item.type === 'VEVENT' || 
               (!item.type && item.summary && (item.start || item.dtstart)) ||
               // Special case for some Google Calendar formats
               (isGoogleCalendar && 
                ((item.summary || item.SUMMARY) && (item.start || item.dtstart || item['DTSTART;VALUE=DATE'])))
              );
      })
      .map(key => {
        const item = icalData[key];
        
        // Handle various date formats found in Google Calendar and other iCal formats
        let startDate = null;
        let endDate = null;
        
        // Try all possible date property names and formats
        if (item.start) {
          startDate = item.start;
        } else if (item.dtstart) {
          startDate = item.dtstart.dateTime || item.dtstart.date || item.dtstart;
        } else if (item['DTSTART;VALUE=DATE']) {
          // Handle date-only format
          startDate = new Date(
            item['DTSTART;VALUE=DATE'].substring(0, 4),
            parseInt(item['DTSTART;VALUE=DATE'].substring(4, 6)) - 1,
            item['DTSTART;VALUE=DATE'].substring(6, 8)
          );
        } else if (item['DTSTART']) {
          startDate = item['DTSTART'];
        }
        
        if (item.end) {
          endDate = item.end;
        } else if (item.dtend) {
          endDate = item.dtend.dateTime || item.dtend.date || item.dtend;
        } else if (item['DTEND;VALUE=DATE']) {
          // Handle date-only format
          endDate = new Date(
            item['DTEND;VALUE=DATE'].substring(0, 4),
            parseInt(item['DTEND;VALUE=DATE'].substring(4, 6)) - 1,
            item['DTEND;VALUE=DATE'].substring(6, 8)
          );
        } else if (item['DTEND']) {
          endDate = item['DTEND'];
        }
        
        // Normalize the event format
        return {
          uid: item.uid || item.UID || key,
          summary: item.summary || item.SUMMARY || '',
          description: item.description || item.DESCRIPTION || '',
          start: startDate,
          end: endDate,
          location: item.location || item.LOCATION || '',
          sequence: item.sequence || item.SEQUENCE || 0,
          lastModified: item.lastModified || item['LAST-MODIFIED'] || null,
          status: item.status || item.STATUS || 'CONFIRMED',
          organizer: item.organizer || item.ORGANIZER || null,
          recurrenceId: item.recurrenceId || item['RECURRENCE-ID'] || null
        };
      });
  }
  
  if (events.length === 0) {
    console.warn('No events found in iCal data or unrecognized format');
    return [];
  }
  
  return events.map((event: any) => {
    // Create unique ID for iCal events that is stable across syncs
    // Use event UID if available, otherwise create a unique ID
    const uid = event.uid || Math.random().toString(36).substring(2, 15);
    const eventId = `ical-${feedId}-${uid}`;
    
    // Handle start and end times, ensuring they are proper Date objects
    let startTime = event.start;
    let endTime = event.end;
    
    // Add validation to ensure we have valid dates
    if (!(startTime instanceof Date) && startTime) {
      try {
        startTime = new Date(startTime);
      } catch (e) {
        console.warn(`Invalid start time for event: ${event.summary}`);
        startTime = new Date(); // Fallback to current time
      }
    }
    
    if (!(endTime instanceof Date) && endTime) {
      try {
        endTime = new Date(endTime);
      } catch (e) {
        console.warn(`Invalid end time for event: ${event.summary}`);
        // If we have a valid start time, set end time to 1 hour after start
        if (startTime instanceof Date) {
          endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        } else {
          endTime = new Date(); // Fallback to current time
        }
      }
    }
    
    // If still no end time, create one from start time
    if (!endTime && startTime) {
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration by default
    }
    
    return {
      id: eventId,
      userId: -1, // Special user ID for iCal events
      title: event.summary || 'Untitled Event',
      description: event.description || '',
      startTime: startTime,
      endTime: endTime,
      color: color,
      allDay: !endTime || (startTime && startTime.toDateString() === endTime.toDateString() &&
              startTime.getHours() === 0 && startTime.getMinutes() === 0 &&
              endTime.getHours() === 0 && endTime.getMinutes() === 0),
      source: {
        type: 'ical',
        feedId: feedId,
        feedName: feedName,
        externalId: uid,
        location: event.location || '',
        sequence: event.sequence || 0,
        lastModified: event.lastModified || null,
        status: event.status || 'CONFIRMED'
      }
    };
  }).filter(event => event.startTime && event.endTime); // Filter out events with invalid dates
}

// Format iCal feed URL validation errors
export function formatICalError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Failed to validate iCal feed';
}

// Generate iCal content for syncing back to external calendars
export function generateICalContent(events: Event[], calendarName: string = 'Calendar'): string {
  // Standard iCal format header
  let icalContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Smart Hjem AS//Booking Calendar//NO",
    `X-WR-CALNAME:${calendarName}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Europe/Oslo" // Add timezone for Norwegian calendar
  ].join("\r\n") + "\r\n";
  
  // Format dates to iCal format (YYYYMMDDTHHMMSSZ)
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/g, '');
  };
  
  // Format date for all-day events (YYYYMMDD)
  const formatAllDayDate = (date: Date): string => {
    return date.toISOString().substring(0, 10).replace(/-/g, '');
  };
  
  // Escape special characters in text fields according to RFC 5545
  const escapeText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  // Current timestamp for created/modified fields
  const now = new Date();
  
  // Add each event in iCal format
  for (const event of events) {
    if (!event.startTime || !event.endTime) continue;
    
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);
    const isAllDay = event.allDay || 
      (startDate.getHours() === 0 && startDate.getMinutes() === 0 &&
       endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
       startDate.toDateString() !== endDate.toDateString());
    
    // Get the external ID if it exists, or generate one
    let uid = '';
    if (event.source && typeof event.source === 'object' && 'externalId' in event.source) {
      uid = event.source.externalId as string;
    } else if (typeof event.id === 'string' && event.id.startsWith('ical-')) {
      uid = event.id.split('-').slice(2).join('-');
    } else {
      uid = `event-${event.id}@smarthjemcalendar`;
    }
    
    // Determine sequence number for tracking updates
    const sequence = (event.source && typeof event.source === 'object' && 'sequence' in event.source) 
      ? (event.source.sequence as number) + 1 
      : 0;
    
    // Get location if available (for Google Calendar compatibility)
    const location = (event.source && typeof event.source === 'object' && 'location' in event.source) 
      ? (event.source.location as string) 
      : '';
    
    // Get status if available (for Google Calendar compatibility)
    const status = (event.source && typeof event.source === 'object' && 'status' in event.source) 
      ? (event.source.status as string) 
      : 'CONFIRMED';
    
    // Format date-time values based on whether it's an all-day event
    const dtStart = isAllDay 
      ? `DTSTART;VALUE=DATE:${formatAllDayDate(startDate)}` 
      : `DTSTART:${formatDate(startDate)}`;
      
    const dtEnd = isAllDay 
      ? `DTEND;VALUE=DATE:${formatAllDayDate(new Date(endDate.getTime() + 86400000))}` // Add a day for all-day events
      : `DTEND:${formatDate(endDate)}`;
    
    // Add event to iCal content with more detailed properties for better compatibility
    const eventLines = [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `SUMMARY:${escapeText(event.title)}`,
      `DESCRIPTION:${escapeText(event.description || "")}`,
      dtStart,
      dtEnd,
      `DTSTAMP:${formatDate(now)}`,
      `SEQUENCE:${sequence}`,
      `CLASS:PUBLIC`,
      `CREATED:${formatDate(now)}`,
      `LAST-MODIFIED:${formatDate(now)}`,
      `STATUS:${status}`
    ];
    
    // Add location if available
    if (location) {
      eventLines.push(`LOCATION:${escapeText(location)}`);
    }
    
    // Add color as X-prop (non-standard but supported by some clients)
    if (event.color) {
      eventLines.push(`X-APPLE-CALENDAR-COLOR:${event.color}`);
      eventLines.push(`X-MICROSOFT-CDO-BUSYSTATUS:BUSY`);
    }
    
    // Close the event
    eventLines.push("END:VEVENT");
    
    // Add event to calendar content
    icalContent += eventLines.join("\r\n") + "\r\n";
  }
  
  // Close the calendar
  icalContent += "END:VCALENDAR";
  
  return icalContent;
}

// Find common color for an iCal feed category
export function getColorForCategory(category: string): string {
  const categoryColors: Record<string, string> = {
    'holiday': '#f97316', // Orange
    'vacation': '#22c55e', // Green
    'work': '#3b82f6',    // Blue
    'meeting': '#8b5cf6', // Purple
    'personal': '#ef4444' // Red
  };
  
  const lowerCategory = category.toLowerCase();
  
  for (const [key, color] of Object.entries(categoryColors)) {
    if (lowerCategory.includes(key)) {
      return color;
    }
  }
  
  // Default color if no match
  return '#8b5cf6';
}
