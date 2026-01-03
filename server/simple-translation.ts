import { Language } from '../client/src/hooks/use-language';

// Interface for translation request
export interface TranslationRequest {
  text: string;
  sourceLanguage?: Language;
  targetLanguage: Language;
}

// Interface for translation response
export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
  success: boolean;
  error?: string;
}

// Vanlige norske fraser og deres engelske oversettelser
const norwegianToEnglish: Record<string, string> = {
  "mandag": "Monday",
  "tirsdag": "Tuesday",
  "onsdag": "Wednesday",
  "torsdag": "Thursday",
  "fredag": "Friday",
  "lørdag": "Saturday",
  "søndag": "Sunday",
  
  "januar": "January",
  "februar": "February", 
  "mars": "March",
  "april": "April",
  "mai": "May",
  "juni": "June",
  "juli": "July",
  "august": "August",
  "september": "September",
  "oktober": "October",
  "november": "November",
  "desember": "December",
  
  "møte": "meeting",
  "avtale": "appointment",
  "ferie": "vacation",
  "helligdag": "holiday",
  "lunsj": "lunch",
  "middag": "dinner",
  "frokost": "breakfast",
  
  "med": "with",
  "hos": "at",
  "på": "on",
  "i": "in",
  "til": "to",
  "fra": "from",
  
  "hei": "hello",
  "takk": "thank you",
  "velkommen": "welcome",
  "ja": "yes",
  "nei": "no",
  
  "kunde": "customer",
  "klient": "client",
  "jobb": "work",
  "kontor": "office",
  "hjemme": "home",
  
  "viktig": "important",
  "haster": "urgent",
  "avlyst": "cancelled",
  "utsatt": "postponed",
  "bekreftet": "confirmed",
  "oppsagt": "canceled",
  
  "time": "hour",
  "dag": "day",
  "uke": "week",
  "måned": "month",
  "år": "year",
  
  "plan": "plan",
  "avtale": "appointment",
  "hendelse": "event",
  "oppgave": "task",
  
  "privat": "private",
  "arbeid": "work",
  "forretning": "business",
  "personlig": "personal",
  
  "tilgjengelig": "available",
  "opptatt": "busy",
  "fraværende": "away",
  
  "skole": "school",
  "fødseldag": "birthday",
  "jubileum": "anniversary",
  "høytid": "holiday",
  
  "fast tid": "fixed time",
  "tid ikke spesifisert": "time not specified",
  
  "notater": "notes",
  "beskrivelse": "description",
  "sted": "location",
  "varighet": "duration",
  
  "deltakere": "participants",
  "arrangør": "organizer",
  "gjest": "guest",
  "kontakt": "contact",
  
  "hele dagen": "all day",
  "gjentakende": "recurring",
  "varsling": "reminder",
  
  "kalenderdeling": "calendar sharing",
  "synkronisering": "synchronization",
  "import": "import",
  "eksport": "export",
  
  "passord": "password",
  "brukernavn": "username",
  "epost": "email",
  "telefon": "phone",
  
  "farger": "colors",
  "visning": "view",
  "innstillinger": "settings",
  "profil": "profile",
  
  "lagre": "save",
  "avbryt": "cancel",
  "slett": "delete",
  "rediger": "edit",
  "oppdater": "update",
  "legg til": "add",
};

// Vanlige engelske fraser og deres norske oversettelser
const englishToNorwegian: Record<string, string> = {};

// Populer engelsk-til-norsk oppslag basert på norsk-til-engelsk
Object.entries(norwegianToEnglish).forEach(([norwegian, english]) => {
  englishToNorwegian[english.toLowerCase()] = norwegian;
});

/**
 * Enkel oversettelse basert på ordliste og enkel setningsstruktur
 * 
 * @param text Tekst som skal oversettes
 * @param targetLanguage Målspråk (no eller en)
 * @param sourceLanguage Kildespråk (vil bli detektert automatisk hvis ikke angitt)
 * @returns Et TranslationResponse-objekt med oversettelsesresultatet
 */
export async function translateText(
  text: string,
  targetLanguage: Language,
  sourceLanguage?: Language
): Promise<TranslationResponse> {
  try {
    // Bestem kildespråk hvis ikke spesifisert
    const fromLanguage = sourceLanguage || detectLanguage(text);
    
    // Hvis vi ikke kan bestemme kildespråket, returner originalteksten
    if (!fromLanguage) {
      return {
        translatedText: text,
        success: false,
        error: "Kunne ikke detektere kildespråket"
      };
    }
    
    // Hvis kilde- og målspråk er det samme, returner originalteksten
    if (fromLanguage === targetLanguage) {
      return {
        translatedText: text,
        detectedLanguage: fromLanguage,
        success: true
      };
    }
    
    // Velg riktig ordliste basert på oversettelsesretning
    const dictionary = 
      fromLanguage === 'no' && targetLanguage === 'en' 
        ? norwegianToEnglish 
        : englishToNorwegian;

    // Del opp teksten i ord
    let words = text.split(/(\s+|\b)/);
    let translatedWords = words.map(word => {
      // Sjekk om ordet finnes i ordboken (ikke skill mellom store og små bokstaver)
      const lowerWord = word.toLowerCase();
      if (dictionary[lowerWord]) {
        // Behold stor forbokstav hvis originalen har det
        if (word[0] === word[0].toUpperCase()) {
          return dictionary[lowerWord].charAt(0).toUpperCase() + dictionary[lowerWord].slice(1);
        }
        return dictionary[lowerWord];
      }
      // Hvis ordet ikke finnes i ordboken, behold originalen
      return word;
    });

    return {
      translatedText: translatedWords.join(''),
      detectedLanguage: fromLanguage,
      success: true
    };
  } catch (error) {
    console.error("Oversettelsesfeil:", error);
    return {
      translatedText: text,
      success: false,
      error: error instanceof Error ? error.message : "Ukjent oversettelsesfeil"
    };
  }
}

/**
 * Enkel språkdeteksjon basert på ordtelling
 * 
 * @param text Tekst som skal analyseres
 * @returns Detektert språkkode (no eller en) eller null hvis deteksjon feilet
 */
export function detectLanguage(text: string): Language | null {
  if (!text || text.trim().length === 0) {
    return null;
  }
  
  // Tell antall ord som er i den norske og engelske ordboken
  const words = text.toLowerCase().split(/\s+/);
  let norwegianCount = 0;
  let englishCount = 0;
  
  words.forEach(word => {
    if (norwegianToEnglish[word]) {
      norwegianCount++;
    }
    if (englishToNorwegian[word]) {
      englishCount++;
    }
  });
  
  // Gjør en enkel beslutning basert på ordtelling
  if (norwegianCount > englishCount) {
    return 'no';
  } else if (englishCount > norwegianCount) {
    return 'en';
  } else {
    // Hvis likt antall eller ingen treff, gjett basert på vanlige ord
    const norwegianCommonWords = ['og', 'i', 'er', 'det', 'på', 'til', 'med', 'av', 'for', 'som'];
    const englishCommonWords = ['and', 'in', 'is', 'it', 'on', 'to', 'with', 'of', 'for', 'that'];
    
    let norwegianCommonCount = 0;
    let englishCommonCount = 0;
    
    words.forEach(word => {
      if (norwegianCommonWords.includes(word)) {
        norwegianCommonCount++;
      }
      if (englishCommonWords.includes(word)) {
        englishCommonCount++;
      }
    });
    
    if (norwegianCommonCount > englishCommonCount) {
      return 'no';
    } else if (englishCommonCount > norwegianCommonCount) {
      return 'en';
    }
  }
  
  // Hvis vi fortsatt ikke kan bestemme språket, anta engelsk som standard
  return 'en';
}