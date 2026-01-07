import { storage } from "./storage";
import axios from "axios";
import ical from "node-ical";
import { sanitizeEventDescription } from "./utils/sanitize";

/**
 * Synkroniserer iCal feeds for en spesifikk bruker (on-demand)
 */
export async function syncUserIcalFeeds(userId: number): Promise<void> {
  try {
    // Hent brukerens aktive iCal-feeds
    const userFeeds = await storage.getIcalFeeds(userId);
    
    if (!userFeeds || userFeeds.length === 0) {
      return; // Ingen feeds å synkronisere
    }
    
    const activeFeeds = userFeeds.filter(feed => feed.enabled && feed.feedType === 'import');
    
    // Synkroniser hver feed
    for (const feed of activeFeeds) {
      try {
        await syncSingleIcalFeed(feed.id);
      } catch (error) {
        console.error(`On-demand sync failed for feed ${feed.name}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error during on-demand iCal sync for user ${userId}:`, error);
  }
}

/**
 * Automatisk synkronisering av alle aktive iCal-feeds
 * Kjøres daglig ved midnatt for å holde kalenderdataene oppdaterte
 */
export async function syncAllIcalFeeds(): Promise<void> {
  console.log('Starting automatic iCal sync for all feeds...');
  
  try {
    // Hent alle aktive iCal-feeds fra databasen
    const allFeeds = await storage.getAllIcalFeeds();
    
    if (!allFeeds || allFeeds.length === 0) {
      console.log('No iCal feeds found to sync');
      return;
    }

    const activeFeeds = allFeeds.filter(feed => feed.enabled && feed.feedType === 'import');
    console.log(`Found ${activeFeeds.length} active iCal feeds to sync (import type only)`);

    let successCount = 0;
    let errorCount = 0;

    // Synkroniser hver aktive feed
    for (const feed of activeFeeds) {
      try {
        await syncSingleIcalFeed(feed.id);
        successCount++;
        console.log(`Successfully synced feed: ${feed.name} (ID: ${feed.id})`);
      } catch (error) {
        errorCount++;
        console.error(`Failed to sync feed: ${feed.name} (ID: ${feed.id})`, error);
      }
    }

    console.log(`iCal sync completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('Error during automatic iCal sync:', error);
  }
}

/**
 * Synkroniser en enkelt iCal-feed
 */
async function syncSingleIcalFeed(feedId: number): Promise<void> {
  const feed = await storage.getIcalFeed(feedId);
  
  if (!feed || !feed.enabled) {
    throw new Error(`Feed ${feedId} not found or disabled`);
  }

  try {
    // Hent iCal-data fra ekstern URL med retry-logikk for rate limiting
    let response;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        response = await axios.get(feed.url, {
          headers: {
            'User-Agent': 'Smart-Hjem-Calendar/1.0 (https://smarthjem.as)',
            'Accept': 'text/calendar, application/ics, */*'
          },
          timeout: 30000, // 30 sekunder timeout
          maxRedirects: 5,
          validateStatus: (status) => status < 500 || status === 503 // Handle 503 separately
        });
        
        // If we get a 503 (Service Unavailable), wait and retry
        if (response.status === 503) {
          retryCount++;
          if (retryCount < maxRetries) {
            const waitTime = Math.min(5 * 60 * 1000, retryCount * 2 * 60 * 1000); // Max 5 minutes
            console.log(`Feed ${feed.name}: Got 503 error (rate limited), waiting ${waitTime/1000} seconds before retry ${retryCount}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            throw new Error(`Feed ${feed.name}: API rate limited after ${maxRetries} retries`);
          }
        }
        
        // Success or non-503 error, break the loop
        break;
      } catch (error) {
        if (retryCount < maxRetries - 1) {
          retryCount++;
          const waitTime = retryCount * 1000; // Simple backoff
          console.log(`Feed ${feed.name}: Request failed, retrying in ${waitTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }

    // Parse iCal-innhold
    const parsed = ical.parseICS(response.data);
    
    if (!parsed) {
      throw new Error('Could not parse iCal data');
    }

    // Hent eksisterende hendelser for denne feeden
    const existingEvents = await storage.getEventsByFeedId(feed.userId, feedId);
    
    // Definer bevaringsgrense - hendelser eldre enn dette beholdes alltid
    const now = new Date();
    const preservationThreshold = new Date(now.getTime() - (3 * 365 * 24 * 60 * 60 * 1000)); // 3 år tilbake - bevar minst 3 år med data
    
    // Use optimized time window: 30 days backward, 360 days forward (matching Beds24 sync)
    const syncWindowStart = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days back
    const syncWindowEnd = new Date(now.getTime() + (360 * 24 * 60 * 60 * 1000)); // 360 days forward
    
    console.log(`iCal sync window for ${feed.name}: ${syncWindowStart.toISOString().split('T')[0]} to ${syncWindowEnd.toISOString().split('T')[0]}`);
    console.log(`Using optimized time window: -30 days to +360 days (matching Beds24 sync)`);
    
    // Bygg map over eksisterende hendelser basert på UID
    const existingEventMap = new Map();
    const eventsToKeep = new Set();
    
    for (const event of existingEvents) {
      if (event.source && typeof event.source === 'object' && 'uid' in event.source) {
        const uid = event.source.uid as string;
        existingEventMap.set(uid, event);
        
        // Bevar alltid hendelser eldre enn bevaringsgrensen
        if (new Date(event.startTime) < preservationThreshold) {
          eventsToKeep.add(event.id);
          console.log(`Preserving historical event: ${event.title} from ${event.startTime}`);
        }
      }
    }
    
    // Hold styr på UIDs fra den nye feeden
    const currentFeedUids = new Set();
    
    // Prosesser hendelser fra feeden
    let savedEventCount = 0;
    let updatedEventCount = 0;
    let csvProtectedCount = 0;
    
    for (const [uid, event] of Object.entries(parsed)) {
      if (event.type === 'VEVENT' && event.start && event.summary) {
        try {
          const startDate = new Date(event.start);
          const endDate = event.end ? new Date(event.end) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          
          currentFeedUids.add(uid);
          
          // Filter out events outside the sync window (30 days back to 360 days forward)
          if (startDate < syncWindowStart || startDate > syncWindowEnd) {
            continue;
          }
          
          const existingEvent = existingEventMap.get(uid);
          
          if (existingEvent) {
            const eventTitle = event.summary.toString();
            
            // For Beds24 feeds, skip updating events for wrong room numbers
            if (feed.url.includes('beds24.com')) {
              const roomIdMatch = feed.url.match(/roomid=(\d+)/);
              if (roomIdMatch) {
                const expectedRoomId = roomIdMatch[1];
                const titleRoomMatch = eventTitle.match(/Room (\d+)/);
                if (titleRoomMatch) {
                  const eventRoomId = titleRoomMatch[1];
                  if (eventRoomId !== expectedRoomId) {
                    console.log(`Skipping update for wrong room: Expected ${expectedRoomId}, got ${eventRoomId} - ${eventTitle}`);
                    // Delete the existing event since it shouldn't be in this user's calendar
                    await storage.deleteEvent(existingEvent.id);
                    continue;
                  }
                }
              }
            }
            
            // Check if event is protected from CSV import
            if (existingEvent.csvProtected) {
              console.log(`Skipping update of CSV-protected event: ${existingEvent.title} (UID: ${uid})`);
              eventsToKeep.add(existingEvent.id);
              csvProtectedCount++;
              continue;
            }
            
            // Oppdater eksisterende hendelse hvis det er endringer
            const hasChanged = 
              existingEvent.title !== eventTitle ||
              existingEvent.description !== sanitizeEventDescription(event.description ? event.description.toString() : null) ||
              new Date(existingEvent.startTime).getTime() !== startDate.getTime() ||
              new Date(existingEvent.endTime).getTime() !== endDate.getTime();
            
            if (hasChanged) {
              await storage.updateEvent(existingEvent.id, {
                title: eventTitle,
                description: sanitizeEventDescription(event.description ? event.description.toString() : null),
                startTime: startDate,
                endTime: endDate,
                source: {
                  type: 'ical',
                  feedId: feedId,
                  uid: uid,
                  url: feed.url,
                  originalData: {
                    location: event.location || null,
                    organizer: event.organizer || null,
                    status: event.status || null
                  }
                }
              });
              updatedEventCount++;
            }
            eventsToKeep.add(existingEvent.id);
          } else {
            // For Beds24 feeds, filter out events for wrong room numbers
            const eventTitle = event.summary.toString();
            
            // Check if this is a Beds24 feed by URL pattern
            if (feed.url.includes('beds24.com')) {
              // Extract room ID from URL
              const roomIdMatch = feed.url.match(/roomid=(\d+)/);
              if (roomIdMatch) {
                const expectedRoomId = roomIdMatch[1];
                
                // Check if event title contains a room number
                const titleRoomMatch = eventTitle.match(/Room (\d+)/);
                if (titleRoomMatch) {
                  const eventRoomId = titleRoomMatch[1];
                  
                  // Skip if room number doesn't match
                  if (eventRoomId !== expectedRoomId) {
                    console.log(`Skipping event for wrong room: Expected ${expectedRoomId}, got ${eventRoomId} - ${eventTitle}`);
                    continue;
                  }
                }
              }
            }
            
            // Lag ny hendelse
            const eventData = {
              title: eventTitle,
              description: sanitizeEventDescription(event.description ? event.description.toString() : null),
              startTime: startDate,
              endTime: endDate,
              color: feed.color || '#6366f1',
              allDay: false,
              source: {
                type: 'ical',
                feedId: feedId,
                uid: uid,
                url: feed.url,
                originalData: {
                  location: event.location || null,
                  organizer: event.organizer || null,
                  status: event.status || null
                }
              }
            };
            
            await storage.createEvent(feed.userId, eventData);
            savedEventCount++;
          }
        } catch (eventError) {
          console.warn(`Skipped invalid event ${uid}:`, eventError);
        }
      }
    }
    
    // Delete events only if they meet ALL conditions:
    // 1. Not in the current feed (UID not found)
    // 2. Within the sync window (only delete events we actively sync)
    // 3. Newer than preservation threshold (keep historical events > 3 years)
    // 4. Not CSV-protected
    let deletedCount = 0;
    for (const event of existingEvents) {
      const eventDate = new Date(event.startTime);
      
      // Skip if event is marked for keeping or outside sync management scope
      if (eventsToKeep.has(event.id)) {
        continue;
      }
      
      // Preserve historical events (older than 3 years)
      if (eventDate < preservationThreshold) {
        console.log(`Preserving historical event outside sync window: ${event.title} from ${event.startTime}`);
        continue;
      }
      
      // Only delete events within the sync window - don't touch events outside
      if (eventDate < syncWindowStart || eventDate > syncWindowEnd) {
        console.log(`Keeping event outside sync window: ${event.title} from ${event.startTime}`);
        continue;
      }
      
      // Check if event is CSV-protected before deleting
      if (event.csvProtected) {
        console.log(`Skipping deletion of CSV-protected event: ${event.title} from ${event.startTime}`);
        csvProtectedCount++;
        continue;
      }
      
      // Event is within sync window, not protected, and not in current feed - delete it
      await storage.deleteEvent(event.id);
      deletedCount++;
      console.log(`Deleted event: ${event.title} from ${event.startTime}`);
    }

    // Oppdater lastSynced timestamp
    await storage.updateIcalFeed(feedId, {
      lastSynced: new Date()
    });

    console.log(`Feed ${feed.name}: synced ${savedEventCount} events, updated ${updatedEventCount} events, deleted ${deletedCount} events${csvProtectedCount > 0 ? `, CSV-protected: ${csvProtectedCount}` : ''}`);
  } catch (error) {
    console.error(`Error syncing feed ${feed.name}:`, error);
    throw error;
  }
}

/**
 * Planlegg automatisk daglig synkronisering ved midnatt
 * Returnerer interval-referanse for å kunne stoppe planleggingen
 */
export function scheduleAutomaticIcalSync(): NodeJS.Timeout {
  console.log('Scheduling automatic iCal sync every 1 minute...');
  
  // Start umiddelbart med første synkronisering
  syncAllIcalFeeds().catch(err => 
    console.error('Initial iCal sync failed:', err)
  );
  
  // Planlegg synkronisering hvert minutt
  const interval = setInterval(() => {
    syncAllIcalFeeds().catch(err => 
      console.error('Automatic iCal sync failed:', err)
    );
  }, 60 * 1000); // 1 minutt
  
  console.log('iCal sync will run every 1 minute');
  
  return interval;
}

/**
 * Manuell trigger for å synkronisere alle feeds (for testing/debug)
 */
export async function triggerManualIcalSync(): Promise<{ success: number; errors: number }> {
  console.log('Manual iCal sync triggered');
  
  const allFeeds = await storage.getAllIcalFeeds();
  const activeFeeds = allFeeds.filter(feed => feed.enabled);
  
  let successCount = 0;
  let errorCount = 0;

  for (const feed of activeFeeds) {
    try {
      await syncSingleIcalFeed(feed.id);
      successCount++;
    } catch (error) {
      errorCount++;
    }
  }

  return { success: successCount, errors: errorCount };
}

/**
 * Finn og fjern duplikat iCal-hendelser basert på tittel, dato og klokkeslett
 * Bruker effektiv SQL-basert tilnærming for stor ytelse
 */
export async function findAndRemoveDuplicateIcalEvents(): Promise<{ removed: number; found: number }> {
  console.log('Starting efficient SQL-based duplicate iCal events cleanup...');
  
  try {
    // Bruk direkte SQL for å finne og telle duplikater
    const duplicateCountResult = await storage.executeCustomQuery(`
      SELECT COUNT(*) as total_duplicates
      FROM (
        SELECT e.id, 
               ROW_NUMBER() OVER (PARTITION BY e.title, e.start_time, e.end_time, e.user_id ORDER BY e.id DESC) as rn
        FROM events e
        WHERE e.source IS NOT NULL 
          AND e.source->>'type' = 'ical'
      ) duplicates 
      WHERE rn > 1
    `);
    
    const totalDuplicatesFound = duplicateCountResult?.[0]?.total_duplicates || 0;
    
    if (totalDuplicatesFound === 0) {
      console.log('No duplicate iCal events found');
      return { found: 0, removed: 0 };
    }

    console.log(`Found ${totalDuplicatesFound} duplicate iCal events to remove`);

    // Bruk effektiv SQL for å slette duplikater (behold kun den nyeste av hver gruppe)
    const deleteResult = await storage.executeCustomQuery(`
      WITH duplicates AS (
        SELECT e.id, 
               ROW_NUMBER() OVER (PARTITION BY e.title, e.start_time, e.end_time, e.user_id ORDER BY e.id DESC) as rn
        FROM events e
        WHERE e.source IS NOT NULL 
          AND e.source->>'type' = 'ical'
      )
      DELETE FROM events 
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `);
    
    // PostgreSQL delete returnerer ikke antall rader på samme måte, så vi bruker totalDuplicatesFound
    const actualRemoved = parseInt(totalDuplicatesFound) || 0;
    
    console.log(`SQL-based duplicate cleanup completed. Found: ${totalDuplicatesFound}, Removed: ${actualRemoved}`);
    return { found: parseInt(totalDuplicatesFound), removed: actualRemoved };
    
  } catch (error) {
    console.error('Error during SQL-based duplicate cleanup:', error);
    throw error;
  }
}

/**
 * Mer avansert duplikatdeteksjon basert på likhet i innhold
 */
export async function findSimilarIcalEvents(similarityThreshold: number = 0.8): Promise<{ groups: any[]; totalEvents: number }> {
  console.log('Finding similar iCal events...');
  
  try {
    const allUsers = await storage.getAllUsers();
    const similarGroups: any[] = [];
    let totalEvents = 0;

    for (const user of allUsers) {
      const userEvents = await storage.getEvents(user.id);
      const icalEvents = userEvents.filter(event => 
        event.source && 
        typeof event.source === 'object' && 
        'feedId' in event.source
      );

      totalEvents += icalEvents.length;

      // Sammenlign hendelser for likhet
      for (let i = 0; i < icalEvents.length; i++) {
        for (let j = i + 1; j < icalEvents.length; j++) {
          const event1 = icalEvents[i];
          const event2 = icalEvents[j];
          
          const similarity = calculateEventSimilarity(event1, event2);
          
          if (similarity >= similarityThreshold) {
            // Sjekk om denne gruppen allerede eksisterer
            let existingGroup = similarGroups.find(group => 
              group.events.some((e: any) => e.id === event1.id || e.id === event2.id)
            );
            
            if (existingGroup) {
              // Legg til hendelse i eksisterende gruppe hvis den ikke allerede er der
              if (!existingGroup.events.some((e: any) => e.id === event1.id)) {
                existingGroup.events.push(event1);
              }
              if (!existingGroup.events.some((e: any) => e.id === event2.id)) {
                existingGroup.events.push(event2);
              }
            } else {
              // Opprett ny gruppe
              similarGroups.push({
                similarity: similarity,
                events: [event1, event2],
                user: {
                  id: user.id,
                  username: user.username
                }
              });
            }
          }
        }
      }
    }

    return { groups: similarGroups, totalEvents };
    
  } catch (error) {
    console.error('Error finding similar events:', error);
    throw error;
  }
}

/**
 * Beregn likhet mellom to hendelser
 */
function calculateEventSimilarity(event1: any, event2: any): number {
  let score = 0;
  let maxScore = 0;

  // Sammenlign tittel (viktigst)
  maxScore += 3;
  if (event1.title && event2.title) {
    const titleSimilarity = stringSimilarity(event1.title.toLowerCase(), event2.title.toLowerCase());
    score += titleSimilarity * 3;
  }

  // Sammenlign beskrivelse
  maxScore += 2;
  if (event1.description && event2.description) {
    const descSimilarity = stringSimilarity(event1.description.toLowerCase(), event2.description.toLowerCase());
    score += descSimilarity * 2;
  } else if (!event1.description && !event2.description) {
    score += 2; // Begge mangler beskrivelse
  }

  // Sammenlign startdato (veldig viktig)
  maxScore += 2;
  if (event1.startDate && event2.startDate) {
    const timeDiff = Math.abs(event1.startDate.getTime() - event2.startDate.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff === 0) score += 2;
    else if (hoursDiff <= 1) score += 1.5;
    else if (hoursDiff <= 24) score += 1;
  }

  // Sammenlign sluttdato
  maxScore += 1;
  if (event1.endDate && event2.endDate) {
    const timeDiff = Math.abs(event1.endDate.getTime() - event2.endDate.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff === 0) score += 1;
    else if (hoursDiff <= 1) score += 0.5;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Enkel strenglighetsalgoritme
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 || len2 === 0) return 0;
  
  // Beregn Levenshtein-avstand
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,
        matrix[j][i - 1] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - (matrix[len2][len1] / maxLen);
}