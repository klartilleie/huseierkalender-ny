import axios, { AxiosInstance } from 'axios';
import { storage } from './storage';
import type { Beds24Config, Event, InsertBeds24Config } from '@shared/schema';
import { nanoid } from 'nanoid';
import { sanitizeEventDescription } from './utils/sanitize';

// Beds24 API Base URLs
const BEDS24_API_V2_BASE = 'https://beds24.com/api/v2';
const BEDS24_JSON_API_BASE = 'https://beds24.com/api/json';

interface Beds24Booking {
  id: number;
  propertyId: number;
  roomId: number;
  firstNight: string; // YYYY-MM-DD
  lastNight: string; // YYYY-MM-DD
  arrivalTime?: string;
  departureTime?: string;
  guestFirstName?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  numAdult: number;
  numChild: number;
  status: string; // new, confirmed, cancelled, etc.
  price: number;
  currency: string;
  notes?: string;
  bookingTime: string; // ISO datetime
}

interface Beds24TokenResponse {
  token: string;
  expiresIn: number;
  refreshToken?: string;
}

export class Beds24ApiClient {
  private v2Instance: AxiosInstance;
  private jsonInstance: AxiosInstance;
  private userId: number;
  private config: Beds24Config | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(userId: number) {
    this.userId = userId;
    
    // API V2 instance
    this.v2Instance = axios.create({
      baseURL: BEDS24_API_V2_BASE,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // JSON API instance
    this.jsonInstance = axios.create({
      baseURL: BEDS24_JSON_API_BASE,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Initialize API client with user configuration
   */
  async initialize(): Promise<boolean> {
    try {
      // Fetch user's Beds24 configuration
      this.config = await storage.getBeds24Config(this.userId);
      
      if (!this.config || !this.config.apiKey) {
        console.log(`No Beds24 configuration found for user ${this.userId}`);
        return false;
      }

      // Check if we have OAuth tokens (new model) or long-life token (old model)
      if (this.config.refreshToken) {
        // OAuth model: Use refresh token to get fresh access token
        this.refreshToken = this.config.refreshToken;
        this.accessToken = this.config.apiKey; // Current access token
        this.tokenExpiry = this.config.tokenExpiry ? new Date(this.config.tokenExpiry) : null;
        
        // Check if access token is expired or about to expire (5 min buffer)
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        
        if (!this.tokenExpiry || this.tokenExpiry < fiveMinutesFromNow) {
          console.log(`Access token expired or expiring soon, refreshing for user ${this.userId}`);
          const refreshed = await this.refreshAccessToken();
          if (!refreshed) {
            console.error(`Failed to refresh access token for user ${this.userId}`);
            return false;
          }
        }
      } else {
        // Legacy model: Long-life token used as both access and refresh
        this.accessToken = this.config.apiKey;
        this.refreshToken = this.config.apiKey;
      }

      console.log(`Beds24 API initialized for user ${this.userId} with property ID ${this.config.propId}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize Beds24 API client:', error);
      return false;
    }
  }

  /**
   * Exchange inviteCode for access token (public method for setup)
   */
  async setupWithInviteCode(inviteCode: string, propId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Exchanging invite code for access token for user ${this.userId}`);
      
      const response = await this.v2Instance.get('/authentication/setup', {
        headers: {
          'code': inviteCode.trim(),
          'accept': 'application/json'
        }
      });

      if (response.data && response.data.token) {
        this.accessToken = response.data.token;
        this.refreshToken = response.data.refreshToken;
        
        // Set expiry time (usually 24 hours)
        const expiresIn = response.data.expiresIn || 86400;
        this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
        
        // Store all tokens in database
        const configData: any = {
          userId: this.userId,
          apiKey: response.data.token, // Current access token
          refreshToken: response.data.refreshToken,
          tokenExpiry: this.tokenExpiry,
          scopes: 'read/bookings,write/bookings', // Default scopes for write access
          propId: propId,
          syncEnabled: true,
          updatedAt: new Date()
        };
        
        await storage.upsertBeds24Config(this.userId, configData);
        this.config = await storage.getBeds24Config(this.userId);
        
        console.log(`Successfully setup Beds24 with invite code for user ${this.userId}`);
        return { success: true };
      }
      
      console.error('No token received from exchange:', response.data);
      return { success: false, error: 'No token received from Beds24' };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('Failed to exchange invite code:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Setup with direct API key (long-life token)
   */
  async setupWithApiKey(apiKey: string, propId: string): Promise<boolean> {
    try {
      // Save configuration
      const configData: Partial<InsertBeds24Config> = {
        userId: this.userId,
        apiKey: apiKey,
        propId: propId,
        syncEnabled: true,
        updatedAt: new Date()
      };
      await storage.upsertBeds24Config(this.userId, configData);

      // Update local config
      this.config = await storage.getBeds24Config(this.userId);
      
      // Initialize with the new API key
      return await this.initialize();
    } catch (error) {
      console.error('Failed to setup Beds24 API with API key:', error);
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('No refresh token available');
      return false;
    }

    try {
      const response = await this.v2Instance.get('/authentication/token', {
        headers: {
          'refreshToken': this.refreshToken
        }
      });

      if (response.data && response.data.token) {
        this.accessToken = response.data.token;
        
        // Calculate new expiry time (default 24 hours)
        const expiresIn = response.data.expiresIn || 86400;
        this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);
        
        // Save updated token to database
        if (this.config) {
          const updateData: any = {
            apiKey: response.data.token,
            tokenExpiry: this.tokenExpiry,
            updatedAt: new Date()
          };
          await storage.upsertBeds24Config(this.userId, updateData);
          console.log(`Saved refreshed access token for user ${this.userId}, expires at ${this.tokenExpiry}`);
        }
        
        console.log('Successfully refreshed access token');
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Failed to refresh token:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.accessToken) {
      console.error('No access token available');
      return false;
    }

    try {
      // Test with proper API v2 - token goes in header
      const response = await this.v2Instance.get('/properties', {
        headers: {
          'token': this.accessToken
        }
      });

      console.log(`Beds24 API v2 connection test successful for user ${this.userId}`);
      console.log(`Test response:`, JSON.stringify(response.data).substring(0, 200));
      
      // Check if we got valid data or an error
      if (response.data && response.data.error) {
        console.error(`Beds24 test failed: ${response.data.error}`);
        return false;
      }
      
      return response.status === 200;
    } catch (error: any) {
      console.error('Failed to test Beds24 API connection:', error.response?.data || error.message);
      // If we get 401, try to refresh the token
      if (error.response?.status === 401 && this.refreshToken) {
        console.log('Access token expired, trying to refresh...');
        return await this.refreshAccessToken();
      }
      return false;
    }
  }

  /**
   * Fetch bookings from Beds24 with support for delta sync
   */
  async fetchBookings(fromDate?: Date, toDate?: Date, modifiedSince?: Date): Promise<Beds24Booking[]> {
    if (!this.accessToken) {
      throw new Error('Beds24 API not initialized - no access token');
    }

    try {
      // Build query parameters for proper API v2
      const params: any = {};

      // Add date filters if provided
      if (fromDate) {
        params.arrivalFrom = fromDate.toISOString().split('T')[0];
      }
      if (toDate) {
        params.arrivalTo = toDate.toISOString().split('T')[0];
      }

      // Add delta sync support - use modifiedSince for API v2
      if (modifiedSince) {
        // Format as ISO 8601 date-time string for API v2
        params.modifiedSince = modifiedSince.toISOString();
        console.log(`Delta sync: fetching bookings modified since ${params.modifiedSince}`);
      }

      // Filter by property ID if configured - REQUIRED
      if (this.config?.propId) {
        // Use propertyId parameter for API v2
        params.propertyId = this.config.propId;
        console.log(`Fetching bookings for property ${this.config.propId} only`);
      } else {
        // Do NOT fetch all properties - this is a critical error
        console.error(`CRITICAL: No property ID configured for user ${this.userId} - cannot sync without property ID`);
        throw new Error('Property ID is required for Beds24 sync');
      }

      // Use proper API v2 endpoint with token in header
      console.log(`Sending Beds24 API v2 request to /bookings`);
      console.log(`Query params:`, JSON.stringify(params));
      
      const response = await this.v2Instance.get('/bookings', {
        headers: {
          'token': this.accessToken
        },
        params: params
      });
      
      console.log(`Beds24 API v2 response status: ${response.status}`);
      console.log(`Response type: ${typeof response.data}`);
      console.log(`Response data preview:`, JSON.stringify(response.data).substring(0, 500));
      
      // Handle API v2 response format
      let bookings: any[] = [];
      
      if (response.data) {
        // Check for error response
        if (response.data.error || response.data.message) {
          console.error('Beds24 API error:', response.data);
          throw new Error(response.data.error || response.data.message || 'Unknown API error');
        }
        
        // API v2 returns object with data array for bookings
        if (response.data.data && Array.isArray(response.data.data)) {
          bookings = response.data.data;
        } else if (Array.isArray(response.data)) {
          bookings = response.data;
        } else {
          console.warn('Unexpected response format:', JSON.stringify(response.data).substring(0, 200));
        }
      }
      
      // Log the first booking to understand the structure
      if (bookings.length > 0) {
        const sample = bookings[0];
        console.log(`Sample booking structure:`, JSON.stringify(sample).substring(0, 500));
        console.log(`Available fields in booking:`, Object.keys(sample));
        
        // Check for guest name fields specifically
        const nameFields = Object.keys(sample).filter(key => 
          key.toLowerCase().includes('name') || 
          key.toLowerCase().includes('guest') || 
          key.toLowerCase().includes('first') || 
          key.toLowerCase().includes('last')
        );
        console.log(`Available name-related fields:`, nameFields);
      }
      
      console.log(`Fetched ${bookings.length} bookings from Beds24 for property ${this.config?.propId} of user ${this.userId}`);
      return bookings as Beds24Booking[];
    } catch (error: any) {
      // Handle rate limiting
      if (error.response?.status === 429) {
        console.warn('Beds24 API rate limit reached, will retry later');
        throw new Error('API rate limit reached');
      }
      
      // Handle authentication errors
      if (error.response?.status === 401 && this.refreshToken) {
        console.log('Access token expired, refreshing and retrying...');
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          return this.fetchBookings(fromDate, toDate, modifiedSince);
        }
        console.error('Authentication failed - check API key');
        throw new Error('Authentication failed');
      }

      console.error('Failed to fetch Beds24 bookings:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Convert Beds24 booking to calendar event
   */
  convertBookingToEvent(booking: any): Partial<Event> | null {
    // Try different possible ID fields
    const bookingId = (booking.id || booking.bookId || booking.bookingId || booking.booking_id)?.toString() || 'unknown';
    
    // Check if we have valid date fields - Beds24 API v2 uses "arrival" and "departure"
    const firstNight = booking.arrival || booking.firstNight || booking.arrivalDate;
    const lastNight = booking.departure || booking.lastNight || booking.departureDate;
    
    if (!firstNight || !lastNight) {
      console.warn(`Booking ${bookingId} missing dates - firstNight: ${firstNight}, lastNight: ${lastNight}`);
      return null;
    }
    
    // Parse dates safely - Beds24 uses YYYY-MM-DD format
    let startTime: Date;
    let endTime: Date;
    
    try {
      startTime = new Date(firstNight + 'T14:00:00'); // Default check-in time
      endTime = new Date(lastNight + 'T11:00:00'); // Default check-out time
      
      // Validate dates
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        console.error(`Invalid dates for booking ${bookingId}: ${firstNight} - ${lastNight}`);
        return null;
      }
      
      // Add one day to end time as lastNight is the last night of stay
      endTime.setDate(endTime.getDate() + 1);
    } catch (error) {
      console.error(`Error parsing dates for booking ${bookingId}:`, error);
      return null;
    }
    
    // Handle guest name - try to extract from various fields
    let guestName = 'Guest';
    
    // Try to get guest name from standard fields first
    if (booking.guestFirstName || booking.guestName || booking.lastName) {
      const firstName = booking.guestFirstName || '';
      const lastName = booking.guestName || booking.lastName || '';
      guestName = `${firstName} ${lastName}`.trim() || 'Guest';
    }
    
    // Try alternative field names that Beds24 might use
    if (guestName === 'Guest') {
      const firstName = booking.firstName || booking.first_name || booking.guest_first_name || '';
      const lastName = booking.lastName || booking.last_name || booking.guest_last_name || booking.surname || '';
      if (firstName || lastName) {
        guestName = `${firstName} ${lastName}`.trim() || 'Guest';
      }
    }
    
    // Check custom fields that might contain guest information
    if (guestName === 'Guest') {
      // Check custom1-10 fields which might contain guest name
      for (let i = 1; i <= 10; i++) {
        const customField = booking[`custom${i}`];
        if (customField && typeof customField === 'string' && customField.length > 3) {
          // Check if this looks like a name (contains only letters and spaces, reasonable length)
          const namePattern = /^[A-Za-zÆØÅæøå\s\-\.]{4,50}$/;
          if (namePattern.test(customField) && customField.split(' ').length >= 2) {
            // Don't use if it's a generic term
            const isGeneric = ['guest', 'customer', 'user', 'client'].some(term => 
              customField.toLowerCase().includes(term)
            );
            if (!isGeneric) {
              guestName = customField.trim();
              console.log(`Found guest name in custom${i}: "${guestName}"`);
              break;
            }
          }
        }
      }
    }
    
    
    // If still "Guest", try to extract from comments field (often contains guest info)
    if (guestName === 'Guest' && booking.comments) {
      
      // Try different patterns for guest name extraction from comments
      // NOTE: Be very careful with regex patterns to avoid matching hotel terms
      const patterns = [
        /Guest:\s*([A-ZÆØÅ][^\n\r\*]+)/i, // Must start with capital letter
        /Name:\s*([A-ZÆØÅ][^\n\r\*]+)/i,  // Must start with capital letter
        /Navn:\s*([A-ZÆØÅ][^\n\r\*]+)/i,
        /Gjest:\s*([A-ZÆØÅ][^\n\r\*]+)/i,
        // Look for email patterns and extract name before @
        /([A-Za-z]+(?:\.[A-Za-z]+)*)\@/i,
        // Look for Norwegian name patterns that start with capital letters
        /\b([A-ZÆØÅ][a-zæøå]{2,15}\s+[A-ZÆØÅ][a-zæøå]{2,15})\b/
      ];
      
      // List of hotel/booking-related terms that should NOT be considered names
      const excludePatterns = [
        /non smoking/i,
        /smoking requested/i,
        /pet allowed/i,
        /child aged/i,
        /adult/i,
        /breakfast/i,
        /parking/i,
        /wifi/i,
        /reservation/i,
        /booking/i,
        /payment/i,
        /arriving/i,
        /departing/i,
        /pre.*paid/i,
        /number of/i,
        /booked rate/i,
        /view booking/i
      ];
      
      for (const pattern of patterns) {
        const match = booking.comments.match(pattern);
        if (match && match[1] && match[1].trim() !== 'Guest' && match[1].length > 3) {
          let extractedName = match[1].trim();
          
          // Clean up extracted name
          extractedName = extractedName.replace(/[\*\.,;:]+$/, ''); // Remove trailing punctuation
          extractedName = extractedName.replace(/^[\*\.,;:]+/, ''); // Remove leading punctuation
          
          // Check if this looks like a hotel term rather than a name
          const isHotelTerm = excludePatterns.some(exclude => exclude.test(extractedName));
          
          // Validate it looks like a real name (not hotel terms)
          if (!isHotelTerm && 
              extractedName.split(' ').length >= 2 && 
              extractedName.length <= 50 &&
              extractedName.length >= 4) {
            guestName = extractedName;
            console.log(`Extracted guest name from comments: "${guestName}" using pattern ${pattern}`);
            break;
          } else if (isHotelTerm) {
            console.log(`Skipped hotel term: "${extractedName}"`);
          }
        }
      }
    }

    // Build description with PUBLIC information only (EXCLUDING private notes)
    const rawDescription = [
      `Booking ID: ${bookingId}`,
      `Guest: ${guestName}`,
      booking.guestEmail ? `Email: ${booking.guestEmail}` : null,
      booking.guestPhone ? `Phone: ${booking.guestPhone}` : null,
      booking.numAdult || booking.numChild ? `Adults: ${booking.numAdult || 0}, Children: ${booking.numChild || 0}` : null,
      booking.price ? `Price: ${booking.price} ${booking.currency || ''}` : null
      // SECURITY: Private notes excluded - contains sensitive information not meant for calendar users
    ].filter(Boolean).join('\n');
    
    // Sanitize the description to remove email addresses
    const description = sanitizeEventDescription(rawDescription);

    return {
      title: guestName, // Only show guest name in title
      description: description,
      startTime: startTime,
      endTime: endTime,
      color: this.getStatusColor(booking.status || 'new'),
      allDay: true,
      source: {
        type: 'beds24',
        bookingId: bookingId,
        propertyId: booking.propertyId?.toString() || booking.propId?.toString() || '',
        roomId: booking.roomId?.toString() || '',
        status: booking.status || 'new',
        lastModified: booking.bookingTime || new Date().toISOString(),
        uid: `beds24-${bookingId}` // Unique identifier
      },
      // Mark if name needs to be enhanced from iCal
      _needsNameEnhancement: guestName === 'Guest'
    };
  }

  /**
   * Get color based on booking status
   */
  private getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'new': '#10b981', // green
      'confirmed': '#3b82f6', // blue
      'cancelled': '#ef4444', // red
      'black': '#000000', // black (owner block)
      'request': '#f59e0b', // amber
      'inquiry': '#8b5cf6' // purple
    };
    
    return statusColors[status.toLowerCase()] || '#6b7280'; // gray default
  }

  /**
   * Create a block/blackout in Beds24 for the specified dates
   * This is used when a user creates a calendar event to block availability
   */
  async createBlock(startDate: Date, endDate: Date, title?: string): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Beds24 API not initialized - no access token' };
    }

    if (!this.config?.propId) {
      return { success: false, error: 'No property ID configured for Beds24' };
    }

    try {
      const arrivalDate = startDate.toISOString().split('T')[0];
      let departureDate = endDate.toISOString().split('T')[0];
      
      // Beds24 krever at departure er minst dagen etter arrival
      // Hvis inn- og utsjekk er samme dag, sett departure til dagen etter
      if (arrivalDate === departureDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        departureDate = nextDay.toISOString().split('T')[0];
        console.log(`Same-day event detected, adjusting departure to ${departureDate}`);
      }
      
      console.log(`Creating Beds24 block for user ${this.userId}: ${arrivalDate} to ${departureDate}`);

      const payload = {
        propertyId: parseInt(this.config.propId),
        arrival: arrivalDate,
        departure: departureDate,
        status: 'black',
        firstName: title || 'Eier',
        lastName: 'Sperre',
        numAdult: 0,
        numChild: 0
      };

      console.log('Beds24 block payload:', JSON.stringify(payload));

      const response = await this.v2Instance.post('/bookings', payload, {
        headers: {
          'token': this.accessToken
        }
      });

      console.log('Beds24 block response:', JSON.stringify(response.data));

      if (response.data && (response.data.id || response.data.bookId)) {
        const bookingId = (response.data.id || response.data.bookId).toString();
        console.log(`Successfully created Beds24 block with ID: ${bookingId}`);
        return { success: true, bookingId };
      }

      if (response.data && response.data.error) {
        console.error('Beds24 block error:', response.data.error);
        return { success: false, error: response.data.error };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to create Beds24 block:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Delete a block/booking from Beds24
   */
  async deleteBlock(bookingId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Beds24 API not initialized - no access token' };
    }

    try {
      console.log(`Deleting Beds24 block ${bookingId} for user ${this.userId}`);

      const response = await this.v2Instance.delete(`/bookings/${bookingId}`, {
        headers: {
          'token': this.accessToken
        }
      });

      console.log('Beds24 delete response:', JSON.stringify(response.data));

      if (response.status === 200 || response.status === 204) {
        console.log(`Successfully deleted Beds24 block ${bookingId}`);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from Beds24' };
    } catch (error: any) {
      console.error('Failed to delete Beds24 block:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Update a block/booking in Beds24
   */
  async updateBlock(bookingId: string, startDate: Date, endDate: Date, title?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Beds24 API not initialized - no access token' };
    }

    try {
      const arrivalDate = startDate.toISOString().split('T')[0];
      let departureDate = endDate.toISOString().split('T')[0];
      
      // Beds24 krever at departure er minst dagen etter arrival
      // Hvis inn- og utsjekk er samme dag, sett departure til dagen etter
      if (arrivalDate === departureDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        departureDate = nextDay.toISOString().split('T')[0];
        console.log(`Same-day event detected, adjusting departure to ${departureDate}`);
      }
      
      console.log(`Updating Beds24 block ${bookingId} for user ${this.userId}: ${arrivalDate} to ${departureDate}`);

      const payload = {
        arrival: arrivalDate,
        departure: departureDate,
        firstName: title || 'Eier',
        lastName: 'Sperre'
      };

      const response = await this.v2Instance.put(`/bookings/${bookingId}`, payload, {
        headers: {
          'token': this.accessToken
        }
      });

      console.log('Beds24 update response:', JSON.stringify(response.data));

      if (response.status === 200) {
        console.log(`Successfully updated Beds24 block ${bookingId}`);
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from Beds24' };
    } catch (error: any) {
      console.error('Failed to update Beds24 block:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Sync bookings to calendar with delta sync support
   */
  async syncBookingsToCalendar(): Promise<{ synced: number; updated: number; deleted: number }> {
    if (!this.config || !this.config.syncEnabled) {
      console.log(`Beds24 sync disabled for user ${this.userId}`);
      return { synced: 0, updated: 0, deleted: 0 };
    }

    try {
      // Check if user has an active Beds24 iCal feed - if so, skip API sync to avoid duplicates
      // iCal feeds from Beds24 contain better guest names, so we prefer them
      const userIcalFeeds = await storage.getUserIcalFeeds(this.userId);
      const activeBeds24IcalFeed = userIcalFeeds?.find(feed => 
        feed.enabled && 
        feed.feedType === 'import' && 
        feed.url.includes('beds24.com')
      );
      
      if (activeBeds24IcalFeed) {
        console.log(`User ${this.userId} has active Beds24 iCal feed "${activeBeds24IcalFeed.name}" - skipping API sync to prevent duplicates`);
        return { synced: 0, updated: 0, deleted: 0 };
      }

      // Calculate date range - 30 days backward, 360 days forward
      const now = new Date();
      const fromDate = new Date(now);
      const toDate = new Date(now);
      
      // Set time window: 30 days back, 360 days forward
      fromDate.setDate(fromDate.getDate() - 30);
      fromDate.setHours(0, 0, 0, 0);
      
      toDate.setDate(toDate.getDate() + 360);
      toDate.setHours(23, 59, 59, 999);
      
      console.log(`Date range for user ${this.userId}: ${fromDate.toISOString().split('T')[0]} to ${toDate.toISOString().split('T')[0]}`);
      console.log(`Using optimized time window: -30 days to +360 days`);

      // Determine if we should use delta sync
      let modifiedSince: Date | undefined;
      if (this.config.lastSync) {
        // Use lastSync minus 10 minutes as safety buffer
        modifiedSince = new Date(this.config.lastSync);
        modifiedSince.setMinutes(modifiedSince.getMinutes() - 10);
        console.log(`Delta sync enabled: fetching changes since ${modifiedSince.toISOString()} (10 min buffer from ${this.config.lastSync})`);
      } else {
        console.log(`First sync for user ${this.userId} - fetching all bookings in time window`);
      }

      // Fetch bookings from Beds24 with delta sync if applicable
      const bookings = await this.fetchBookings(fromDate, toDate, modifiedSince);
      console.log(`Delta sync: fetched ${bookings.length} bookings from Beds24`);
      
      // Get ALL events for this user to check for duplicates from iCal or other sources
      const allUserEvents = await storage.getEvents(this.userId);
      
      // Get existing Beds24 events for this user
      const existingEvents = await storage.getBeds24Events(this.userId);
      
      // Create a map of existing Beds24 events by booking ID
      const existingMap = new Map<string, Event>();
      for (const event of existingEvents) {
        if (event.source && typeof event.source === 'object' && 'bookingId' in event.source) {
          existingMap.set(event.source.bookingId as string, event);
        }
      }
      
      // Also create a map to check for duplicates from iCal or other sources
      // We'll check by date, title similarity to avoid duplicates
      const existingByDate = new Map<string, Event[]>();
      for (const event of allUserEvents) {
        // Skip Beds24 events as they're handled separately
        if (event.source && typeof event.source === 'object' && 'type' in event.source && event.source.type === 'beds24') {
          continue;
        }
        const dateKey = event.startTime ? new Date(event.startTime).toISOString().split('T')[0] : '';
        if (dateKey) {
          if (!existingByDate.has(dateKey)) {
            existingByDate.set(dateKey, []);
          }
          existingByDate.get(dateKey)!.push(event);
        }
      }

      let synced = 0;
      let updated = 0;
      const processedIds = new Set<string>();

      // Process each booking
      for (const booking of bookings) {
        // Check if booking has required fields
        if (!booking || typeof booking !== 'object' || Array.isArray(booking)) {
          console.warn('Invalid booking object, skipping');
          continue;
        }
        
        // Try different possible ID fields (Beds24 might use different field names)
        const bookingId = (booking.id || (booking as any).bookId || (booking as any).bookingId || (booking as any).booking_id)?.toString();
        
        if (!bookingId) {
          console.warn('Booking missing ID, skipping:', JSON.stringify(booking).substring(0, 200));
          continue;
        }
        
        processedIds.add(bookingId);

        // Validate that booking belongs to configured property
        const bookingPropertyId = (booking.propertyId || booking.propId || booking.property_id)?.toString();
        if (this.config?.propId && bookingPropertyId && bookingPropertyId !== this.config.propId) {
          console.error(`CRITICAL: Booking ${bookingId} belongs to property ${bookingPropertyId} but user ${this.userId} is configured for property ${this.config.propId}`);
          continue; // Skip this booking - it's for the wrong property
        }

        // Check if this booking might be an echo of our own calendar events
        // Only skip if it's obviously from our own calendar system
        const bookingTitle = booking.summary || booking.title || '';
        
        // Only skip if title contains very specific patterns from our calendar exports
        if (bookingTitle && (bookingTitle.includes('Guest - Room') || bookingTitle.includes('[Calendar Export]'))) {
          console.log(`Skipping confirmed echo booking ${bookingId}: Title "${bookingTitle}" indicates it's from our own calendar`);
          continue;
        }
        
        // Additional check: if comments contain our own system signature
        const comments = booking.comments || '';
        if (comments.includes('Generated by Smart Hjem Calendar') || comments.includes('[AUTO-CREATED]')) {
          console.log(`Skipping echo booking ${bookingId}: Comments indicate it's from our own system`);
          continue;
        }

        const eventData = this.convertBookingToEvent(booking);
        
        // Skip if we couldn't convert the booking (invalid dates, etc.)
        if (!eventData) {
          console.warn(`Could not convert booking ${bookingId} to event`);
          continue;
        }
        
        // Check if this booking already exists from Beds24 API
        const existingEvent = existingMap.get(bookingId);

        if (existingEvent) {
          // Check if event is CSV-protected before updating
          if (existingEvent.csvProtected) {
            console.log(`Skipping update of CSV-protected event: Booking ${bookingId}`);
            processedIds.delete(bookingId); // Don't mark as processed so it won't be deleted
            continue;
          }
          
          // NEW FEATURE: Try to enhance existing Beds24 event name from iCal if it's still "Guest"
          if (existingEvent.title === 'Guest' && (eventData as any)._needsNameEnhancement) {
            const dateKey = eventData.startTime ? new Date(eventData.startTime).toISOString().split('T')[0] : '';
            const existingOnDate = dateKey ? existingByDate.get(dateKey) || [] : [];
            
            if (existingOnDate.length > 0) {
              console.log(`Trying to enhance existing Beds24 event ${bookingId} with name from iCal events on ${dateKey}`);
              
              for (const icalEvent of existingOnDate) {
                if (icalEvent.source && typeof icalEvent.source === 'object' && 
                    'type' in icalEvent.source && icalEvent.source.type === 'ical') {
                  
                  const icalStart = new Date(icalEvent.startTime);
                  const bedsStart = new Date(eventData.startTime!);
                  const bedsEnd = new Date(eventData.endTime!);
                  
                  const datesOverlap = icalStart >= bedsStart && icalStart < bedsEnd;
                  
                  if (datesOverlap && icalEvent.title && icalEvent.title !== 'Guest' && 
                      icalEvent.title.length > 3 && !icalEvent.title.includes('Room ')) {
                    console.log(`Enhanced existing Beds24 event ${bookingId} with name "${icalEvent.title}" from iCal`);
                    eventData.title = icalEvent.title;
                    eventData.description = sanitizeEventDescription(`${eventData.description}\n[Name enhanced from iCal: ${icalEvent.title}]`);
                    break;
                  }
                }
              }
            }
          }
          
          // Remove the enhancement marker before comparison
          delete (eventData as any)._needsNameEnhancement;
          
          // Check if update is needed
          const needsUpdate = 
            existingEvent.title !== eventData.title ||
            existingEvent.description !== eventData.description ||
            existingEvent.startTime?.getTime() !== eventData.startTime?.getTime() ||
            existingEvent.endTime?.getTime() !== eventData.endTime?.getTime() ||
            (existingEvent.source as any)?.status !== booking.status;

          if (needsUpdate) {
            // PROTECTION: Don't overwrite CSV-protected events
            if (existingEvent.csvProtected) {
              console.log(`Skipping update of CSV-protected event ${bookingId} (${existingEvent.title})`);
            } else {
              await storage.updateEvent(existingEvent.id, eventData);
              updated++;
            }
          }
        } else {
          // Check if a similar event already exists from iCal or other sources
          const dateKey = eventData.startTime ? new Date(eventData.startTime).toISOString().split('T')[0] : '';
          const existingOnDate = dateKey ? existingByDate.get(dateKey) || [] : [];
          
          // NEW FEATURE: If Beds24 event has no guest name, try to enhance it with name from iCal
          if ((eventData as any)._needsNameEnhancement && existingOnDate.length > 0) {
            console.log(`Trying to enhance Beds24 event ${bookingId} with name from iCal events on ${dateKey}`);
            
            for (const icalEvent of existingOnDate) {
              // Only check iCal events
              if (icalEvent.source && typeof icalEvent.source === 'object' && 
                  'type' in icalEvent.source && icalEvent.source.type === 'ical') {
                
                // Check if dates overlap (iCal event starts same day or within booking period)
                const icalStart = new Date(icalEvent.startTime);
                const icalEnd = new Date(icalEvent.endTime);
                const bedsStart = new Date(eventData.startTime!);
                const bedsEnd = new Date(eventData.endTime!);
                
                // Check if iCal event overlaps with Beds24 booking dates
                const datesOverlap = icalStart >= bedsStart && icalStart < bedsEnd;
                
                if (datesOverlap && icalEvent.title && icalEvent.title !== 'Guest' && 
                    icalEvent.title.length > 3 && !icalEvent.title.includes('Room ')) {
                  console.log(`Enhanced Beds24 event ${bookingId} with name "${icalEvent.title}" from iCal`);
                  eventData.title = icalEvent.title;
                  
                  // Update description to show source of name
                  eventData.description = `${eventData.description}\n[Name enhanced from iCal: ${icalEvent.title}]`;
                  break; // Use first matching iCal event
                }
              }
            }
          }
          
          // Remove the enhancement marker before saving
          delete (eventData as any)._needsNameEnhancement;
          
          // Check for duplicates by comparing dates and other properties
          let isDuplicate = false;
          
          for (const existing of existingOnDate) {
            // Check if the start times match (same booking on same day)
            const sameStartTime = existing.startTime && eventData.startTime &&
              new Date(existing.startTime).getTime() === new Date(eventData.startTime).getTime();
            
            // Check if the end times match
            const sameEndTime = existing.endTime && eventData.endTime &&
              new Date(existing.endTime).getTime() === new Date(eventData.endTime).getTime();
            
            // If both start and end times match, it's likely a duplicate
            if (sameStartTime && sameEndTime) {
              console.log(`Skipping duplicate booking based on dates: ${eventData.title} on ${dateKey}`);
              isDuplicate = true;
              break;
            }
            
            // Check if this is the same booking from different sources (iCal vs API)
            // Look for Beds24 booking ID in any form
            if (bookingId && bookingId !== 'unknown') {
              // Check if existing event has same booking ID (from iCal source)
              if (existing.source && typeof existing.source === 'object' && 'uid' in existing.source) {
                const existingUid = existing.source.uid as string;
                // iCal events from Beds24 have UIDs like "20250830140000-b74872811@beds24.com"
                if (existingUid.includes(`-b${bookingId}@beds24.com`)) {
                  console.log(`Skipping duplicate booking ${bookingId} - same booking exists from iCal source`);
                  isDuplicate = true;
                  break;
                }
              }
              
              // Also check description for booking ID
              if (existing.description && existing.description.includes(`Booking ID: ${bookingId}`)) {
                console.log(`Skipping duplicate booking ID ${bookingId} (already exists from iCal)`);
                isDuplicate = true;
                break;
              }
            }
            
            // If titles are not generic, check for name match
            if (eventData.title && eventData.title !== 'Guest' && 
                existing.title && existing.title !== 'Guest') {
              const titleLower = eventData.title.toLowerCase();
              const existingTitleLower = existing.title.toLowerCase();
              
              if (titleLower === existingTitleLower) {
                console.log(`Skipping duplicate booking with same guest name: ${eventData.title}`);
                isDuplicate = true;
                break;
              }
            }
          }
          
          if (!isDuplicate) {
            // Create new event
            await storage.createEvent(this.userId, eventData as any);
            synced++;
          }
        }
      }

      // Delete events that no longer exist in Beds24 API
      let deleted = 0;
      
      // First, delete Beds24 API events that are no longer in the API
      for (const [bookingId, event] of Array.from(existingMap.entries())) {
        if (!processedIds.has(bookingId)) {
          // Check if event is CSV-protected before deleting
          if (event.csvProtected) {
            console.log(`Preserving CSV-protected event: Booking ${bookingId}`);
            continue;
          }
          
          // Only delete if it's within our sync range
          const eventDate = new Date(event.startTime);
          if (eventDate >= fromDate && eventDate <= toDate) {
            console.log(`Deleting Beds24 API event ${bookingId} - no longer exists in API`);
            await storage.deleteEvent(event.id);
            deleted++;
          }
        }
      }
      
      // CRITICAL: Also check iCal events from Beds24 and remove if not in API
      // This handles the case where iCal feed still has booking but API doesn't
      for (const event of allUserEvents) {
        if (event.source && typeof event.source === 'object' && 
            'type' in event.source && event.source.type === 'ical' &&
            'uid' in event.source) {
          
          const uid = event.source.uid as string;
          // Check if this is a Beds24 iCal event (UID pattern: "20250830140000-b74872811@beds24.com")
          const beds24Match = uid.match(/-b(\d+)@beds24\.com$/);
          
          if (beds24Match) {
            const icalBookingId = beds24Match[1];
            
            // If this booking ID is not in the current API response, delete it
            if (!processedIds.has(icalBookingId)) {
              const eventDate = new Date(event.startTime);
              if (eventDate >= fromDate && eventDate <= toDate) {
                console.log(`Deleting orphaned iCal event ${icalBookingId} - booking no longer exists in Beds24 API`);
                await storage.deleteEvent(event.id);
                deleted++;
              }
            }
          }
        }
      }

      // Update lastSync timestamp after successful sync
      const syncCompleted = new Date();
      await storage.upsertBeds24Config(this.userId, {
        lastSync: syncCompleted,
        updatedAt: syncCompleted
      });
      
      console.log(`Beds24 sync completed for user ${this.userId}: ${synced} new, ${updated} updated, ${deleted} deleted`);
      console.log(`Delta sync: Updated lastSync to ${syncCompleted.toISOString()}`);
      return { synced, updated, deleted };
    } catch (error) {
      console.error(`Failed to sync Beds24 bookings for user ${this.userId}:`, error);
      throw error;
    }
  }
}

/**
 * Sync Beds24 calendar for a specific user (on-demand)
 */
export async function syncUserBeds24Calendar(userId: number): Promise<void> {
  try {
    // Check if user has Beds24 configuration
    const config = await storage.getBeds24Config(userId);
    
    if (!config || !config.syncEnabled) {
      return; // No Beds24 sync for this user
    }
    
    const client = new Beds24ApiClient(userId);
    const initialized = await client.initialize();
    
    if (initialized) {
      await client.syncBookingsToCalendar();
    }
  } catch (error) {
    console.error(`Error during on-demand Beds24 sync for user ${userId}:`, error);
  }
}

/**
 * Sync all users' Beds24 calendars
 */
export async function syncAllBeds24Calendars(): Promise<void> {
  console.log('Starting Beds24 sync for all users...');
  
  try {
    // Get all users with Beds24 configurations
    const configs = await storage.getAllBeds24Configs();
    
    if (configs.length === 0) {
      console.log('No Beds24 configurations found');
      return;
    }

    console.log(`Found ${configs.length} Beds24 configurations to sync`);
    
    // Process each configuration with delay to respect rate limits
    for (const config of configs) {
      if (!config.syncEnabled) {
        console.log(`Skipping disabled Beds24 sync for user ${config.userId}`);
        continue;
      }

      try {
        const client = new Beds24ApiClient(config.userId);
        const initialized = await client.initialize();
        
        if (initialized) {
          const result = await client.syncBookingsToCalendar();
          console.log(`Beds24 sync completed for user ${config.userId}:`, result);
        } else {
          console.error(`Failed to initialize Beds24 client for user ${config.userId}`);
        }
        
        // Wait 2 seconds between users to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error syncing Beds24 for user ${config.userId}:`, error);
      }
    }
    
    console.log('Beds24 sync completed for all users');
  } catch (error) {
    console.error('Error during Beds24 sync:', error);
  }
}

/**
 * Schedule automatic Beds24 sync
 */
export function scheduleBeds24Sync(): NodeJS.Timeout {
  // Run every 1 minute for frequent sync
  const interval = 60 * 1000; // 1 minute in milliseconds
  
  const timer = setInterval(async () => {
    await syncAllBeds24Calendars();
  }, interval);
  
  // Run initial sync after 30 seconds to let system start up
  setTimeout(async () => {
    await syncAllBeds24Calendars();
  }, 30000);
  
  console.log('Scheduled automatic Beds24 sync (every 1 minute)');
  
  return timer;
}