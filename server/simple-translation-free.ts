import { Language } from '../client/src/hooks/use-language';

// Interface for translation request
export interface TranslationRequest {
  text: string;
  targetLanguage: Language;
  sourceLanguage?: Language;
}

// Interface for translation response
export interface TranslationResponse {
  translatedText: string;
  success: boolean;
}

// Enkelt ordbok for vanlige ord og fraser
const dictionary: Record<string, { no: string; en: string }> = {
  // Måneder
  'january': { no: 'januar', en: 'January' },
  'february': { no: 'februar', en: 'February' },
  'march': { no: 'mars', en: 'March' },
  'april': { no: 'april', en: 'April' },
  'may': { no: 'mai', en: 'May' },
  'june': { no: 'juni', en: 'June' },
  'july': { no: 'juli', en: 'July' },
  'august': { no: 'august', en: 'August' },
  'september': { no: 'september', en: 'September' },
  'october': { no: 'oktober', en: 'October' },
  'november': { no: 'november', en: 'November' },
  'december': { no: 'desember', en: 'December' },
  
  // Ukedager
  'monday': { no: 'mandag', en: 'Monday' },
  'tuesday': { no: 'tirsdag', en: 'Tuesday' },
  'wednesday': { no: 'onsdag', en: 'Wednesday' },
  'thursday': { no: 'torsdag', en: 'Thursday' },
  'friday': { no: 'fredag', en: 'Friday' },
  'saturday': { no: 'lørdag', en: 'Saturday' },
  'sunday': { no: 'søndag', en: 'Sunday' },
  
  // Vanlige ord for kalender
  'today': { no: 'i dag', en: 'Today' },
  'tomorrow': { no: 'i morgen', en: 'Tomorrow' },
  'yesterday': { no: 'i går', en: 'Yesterday' },
  'week': { no: 'uke', en: 'Week' },
  'month': { no: 'måned', en: 'Month' },
  'year': { no: 'år', en: 'Year' },
  'day': { no: 'dag', en: 'Day' },
  'date': { no: 'dato', en: 'Date' },
  'time': { no: 'tid', en: 'Time' },
  'calendar': { no: 'kalender', en: 'Calendar' },
  'event': { no: 'hendelse', en: 'Event' },
  'meeting': { no: 'møte', en: 'Meeting' },
  'appointment': { no: 'avtale', en: 'Appointment' },
  'booking': { no: 'booking', en: 'Booking' },
  'reservation': { no: 'reservasjon', en: 'Reservation' },
  
  // Status
  'confirmed': { no: 'bekreftet', en: 'Confirmed' },
  'pending': { no: 'venter', en: 'Pending' },
  'cancelled': { no: 'avlyst', en: 'Cancelled' },
  'completed': { no: 'fullført', en: 'Completed' },
  
  // Vanlige fraser
  'new booking': { no: 'ny booking', en: 'New Booking' },
  'check-in': { no: 'innsjekking', en: 'Check-in' },
  'check-out': { no: 'utsjekking', en: 'Check-out' },
  'guest': { no: 'gjest', en: 'Guest' },
  'owner': { no: 'eier', en: 'Owner' },
  'property': { no: 'eiendom', en: 'Property' },
  'vacation rental': { no: 'ferieutleie', en: 'Vacation Rental' },
  'holiday home': { no: 'feriehus', en: 'Holiday Home' },
  
  // Handlinger
  'create': { no: 'opprett', en: 'Create' },
  'edit': { no: 'rediger', en: 'Edit' },
  'delete': { no: 'slett', en: 'Delete' },
  'save': { no: 'lagre', en: 'Save' },
  'cancel': { no: 'avbryt', en: 'Cancel' },
  'add': { no: 'legg til', en: 'Add' },
  'remove': { no: 'fjern', en: 'Remove' },
  'update': { no: 'oppdater', en: 'Update' },
  
  // Utbetalinger
  'payout': { no: 'utbetaling', en: 'Payout' },
  'payment': { no: 'betaling', en: 'Payment' },
  'amount': { no: 'beløp', en: 'Amount' },
  'balance': { no: 'saldo', en: 'Balance' },
  'paid': { no: 'betalt', en: 'Paid' },
  'unpaid': { no: 'ubetalt', en: 'Unpaid' },
  'invoice': { no: 'faktura', en: 'Invoice' },
  'receipt': { no: 'kvittering', en: 'Receipt' },
  
  // Brukere
  'user': { no: 'bruker', en: 'User' },
  'admin': { no: 'administrator', en: 'Admin' },
  'administrator': { no: 'administrator', en: 'Administrator' },
  'customer': { no: 'kunde', en: 'Customer' },
  'support': { no: 'støtte', en: 'Support' },
  'help': { no: 'hjelp', en: 'Help' }
};

/**
 * Enkel oversettelse uten ekstern API
 * Bruker ordbok for vanlige ord, ellers returnerer originalteksten
 */
export async function translateText(
  text: string,
  targetLanguage: Language,
  sourceLanguage?: Language
): Promise<TranslationResponse> {
  try {
    // Hvis samme språk, returner originalteksten
    if (sourceLanguage && sourceLanguage === targetLanguage) {
      return {
        translatedText: text,
        success: true
      };
    }
    
    // Sjekk om teksten finnes i ordboken (case-insensitive)
    const lowerText = text.toLowerCase().trim();
    const translation = dictionary[lowerText];
    
    if (translation) {
      const translatedText = targetLanguage === 'no' ? translation.no : translation.en;
      // Behold original case hvis mulig
      if (text[0] === text[0].toUpperCase()) {
        return {
          translatedText: translatedText.charAt(0).toUpperCase() + translatedText.slice(1),
          success: true
        };
      }
      return {
        translatedText,
        success: true
      };
    }
    
    // Prøv å oversette enkeltord i setninger
    const words = text.split(' ');
    let translated = false;
    const translatedWords = words.map(word => {
      const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
      const punctuation = word.match(/[.,!?;:]$/)?.[0] || '';
      
      if (dictionary[cleanWord]) {
        translated = true;
        const trans = targetLanguage === 'no' ? dictionary[cleanWord].no : dictionary[cleanWord].en;
        // Behold case
        if (word[0] === word[0].toUpperCase()) {
          return trans.charAt(0).toUpperCase() + trans.slice(1) + punctuation;
        }
        return trans + punctuation;
      }
      return word;
    });
    
    if (translated) {
      return {
        translatedText: translatedWords.join(' '),
        success: true
      };
    }
    
    // Hvis ingen oversettelse funnet, returner originalteksten
    return {
      translatedText: text,
      success: false
    };
    
  } catch (error) {
    console.error('Translation error:', error);
    return {
      translatedText: text,
      success: false
    };
  }
}

/**
 * Enkel språkdeteksjon basert på vanlige ord
 */
export function detectLanguage(text: string): Language | null {
  if (!text || text.trim().length === 0) {
    return null;
  }
  
  const lowerText = text.toLowerCase();
  
  // Norske ord og mønstre
  const norwegianPatterns = [
    'å', 'æ', 'ø', 
    'jeg', 'du', 'han', 'hun', 'vi', 'de',
    'og', 'eller', 'men', 'for', 'til', 'fra', 'med',
    'ikke', 'har', 'er', 'var', 'skal', 'vil', 'kan',
    'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag',
    'januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'
  ];
  
  // Engelske ord og mønstre
  const englishPatterns = [
    'the', 'a', 'an', 'is', 'are', 'was', 'were',
    'i', 'you', 'he', 'she', 'we', 'they',
    'and', 'or', 'but', 'for', 'to', 'from', 'with',
    'not', 'have', 'has', 'had', 'will', 'would', 'can', 'could',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  let norwegianScore = 0;
  let englishScore = 0;
  
  // Tell forekomster av typiske ord
  norwegianPatterns.forEach(pattern => {
    if (lowerText.includes(pattern)) {
      norwegianScore++;
    }
  });
  
  englishPatterns.forEach(pattern => {
    if (lowerText.includes(pattern)) {
      englishScore++;
    }
  });
  
  // Returner språket med høyest score
  if (norwegianScore > englishScore) {
    return 'no';
  } else if (englishScore > norwegianScore) {
    return 'en';
  }
  
  // Standard til engelsk hvis usikker
  return 'en';
}