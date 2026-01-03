import { apiRequest } from "./queryClient";
import { Language } from "@/hooks/use-language";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/hooks/use-language";

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
 * Translate text using the API translation service
 * @param text The text to translate
 * @param targetLanguage The language to translate to
 * @param sourceLanguage The original language (optional, will be auto-detected if not provided)
 * @returns Promise with translation response
 */
export async function translateText(
  text: string,
  targetLanguage: Language,
  sourceLanguage?: Language
): Promise<TranslationResponse> {
  if (!text) {
    return {
      translatedText: "",
      success: false,
      error: "No text provided for translation"
    };
  }
  
  try {
    const response = await apiRequest("POST", "/api/translate", {
      text,
      targetLanguage,
      sourceLanguage
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Translation error:", error);
    return {
      translatedText: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown translation error"
    };
  }
}

/**
 * Hook for handling translation state and logic
 * @param text Initial text to translate
 * @param initialLanguage Initial language of the text
 * @returns Translation state and functions
 */
export function useTranslation(text: string | null, initialLanguage?: Language) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language } = useLanguage();
  
  // Reset translation when original text changes
  useEffect(() => {
    setTranslatedText(null);
    setError(null);
  }, [text]);
  
  const translate = useCallback(async (targetLang?: Language) => {
    if (!text) return;
    
    setIsTranslating(true);
    setError(null);
    
    try {
      // Use provided target language or determine based on current UI language
      const targetLanguage = targetLang || (language === 'no' ? 'en' : 'no');
      const sourceLang = initialLanguage || (language === 'no' ? 'no' : 'en');
      
      const result = await translateText(text, targetLanguage, sourceLang);
      
      if (result.success) {
        setTranslatedText(result.translatedText);
      } else {
        setError(result.error || "Failed to translate text");
        setTranslatedText(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error during translation");
      setTranslatedText(null);
    } finally {
      setIsTranslating(false);
    }
  }, [text, language, initialLanguage]);
  
  const resetTranslation = useCallback(() => {
    setTranslatedText(null);
    setError(null);
  }, []);
  
  return {
    isTranslating,
    translatedText,
    error,
    translate,
    resetTranslation,
    isTranslated: !!translatedText
  };
}