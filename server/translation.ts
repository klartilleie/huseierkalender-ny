import axios from 'axios';
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

/**
 * Translate text using OpenAI API
 * 
 * @param text Text to translate
 * @param targetLanguage Target language (no or en)
 * @param sourceLanguage Optional source language (will be auto-detected if not provided)
 * @returns A TranslationResponse object with the translation result
 */
export async function translateText(
  text: string,
  targetLanguage: Language,
  sourceLanguage?: Language
): Promise<TranslationResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        translatedText: text,
        success: false,
        error: "OpenAI API key is not configured. Please contact administrator."
      };
    }

    const languageMap: Record<Language, string> = {
      en: "English",
      no: "Norwegian"
    };
    
    const targetLanguageName = languageMap[targetLanguage];
    
    let prompt = "";
    if (sourceLanguage) {
      prompt = `Translate the following text from ${languageMap[sourceLanguage]} to ${targetLanguageName}: "${text}"`;
    } else {
      prompt = `Translate the following text to ${targetLanguageName}: "${text}"`;
    }
    
    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a professional translator. Translate the text exactly without adding any additional text or explanations. Just return the translated text." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    const translatedText = response.data.choices[0].message.content.trim();
    
    // Remove any quotation marks from the response
    const cleanedTranslation = translatedText.replace(/^["']|["']$/g, '');
    
    return {
      translatedText: cleanedTranslation,
      success: true
    };
  } catch (error: any) {
    console.error("Translation error:", error.response?.data || error.message);
    return {
      translatedText: "",
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Detect language of text
 * 
 * @param text Text to detect language for
 * @returns Detected language code (no or en) or null if detection failed
 */
export async function detectLanguage(text: string): Promise<Language | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a language detector. Detect if the text is in Norwegian or English. Only respond with 'no' for Norwegian or 'en' for English." },
          { role: "user", content: `Detect the language of this text: "${text}"` }
        ],
        temperature: 0.3,
        max_tokens: 10
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    
    const result = response.data.choices[0].message.content.trim().toLowerCase();
    
    if (result === 'no' || result === 'norwegian') {
      return 'no';
    } else if (result === 'en' || result === 'english') {
      return 'en';
    }
    
    return null;
  } catch (error) {
    console.error("Language detection error:", error);
    return null;
  }
}