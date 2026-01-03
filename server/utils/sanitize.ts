/**
 * Utility functions for sanitizing event data
 */

/**
 * Remove email addresses from text to protect user privacy
 * @param text - The text to sanitize
 * @returns The text with email addresses removed
 */
export function removeEmailFromDescription(text: string | null | undefined): string {
  if (!text) return '';
  
  // Remove email addresses (matches most common email patterns)
  // This regex matches email-like patterns and replaces them
  let sanitized = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email removed]');
  
  // Also remove lines that contain "Email:" followed by any content up to newline
  sanitized = sanitized.replace(/Email:\s*[^\n]*/gi, '');
  
  // Clean up any double newlines left behind
  sanitized = sanitized.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Trim whitespace
  return sanitized.trim();
}

/**
 * Sanitize event description for storage
 * Applies all privacy and formatting rules
 */
export function sanitizeEventDescription(description: string | null | undefined): string {
  // Apply email removal
  return removeEmailFromDescription(description);
}