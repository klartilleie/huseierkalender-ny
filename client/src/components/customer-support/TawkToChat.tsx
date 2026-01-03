import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface TawkToChatProps {
  propertyId?: string;
  widgetId?: string;
}

export default function TawkToChat({
  propertyId = '65b9e1a68d261e1b5f7a77e4',
  widgetId = '1hmothdvg'
}: TawkToChatProps) {
  const { user } = useAuth();

  useEffect(() => {
    // This follows the exact Tawk.to embed code structure
    const addTawkToWidget = () => {
      try {
        window.Tawk_API = window.Tawk_API || {};
        window.Tawk_LoadStart = new Date();
        
        const s1 = document.createElement("script");
        const s0 = document.getElementsByTagName("script")[0];
        
        s1.async = true;
        s1.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
        s1.charset = 'UTF-8';
        s1.setAttribute('crossorigin', '*');
        
        // Add error handling for script loading
        s1.onerror = (error) => {
          console.warn('Tawk.to widget failed to load:', error);
        };
        
        if (s0 && s0.parentNode) {
          s0.parentNode.insertBefore(s1, s0);
        } else {
          document.head.appendChild(s1);
        }
      } catch (error) {
        console.warn('Failed to initialize Tawk.to widget:', error);
      }
    };

    // Add the widget if it's not already on the page
    if (!document.querySelector(`script[src*="embed.tawk.to/${propertyId}"]`)) {
      addTawkToWidget();
    }

    // Clean up on component unmount
    return () => {
      try {
        const tawkScript = document.querySelector(`script[src*="embed.tawk.to/${propertyId}"]`);
        if (tawkScript && tawkScript.parentNode) {
          tawkScript.parentNode.removeChild(tawkScript);
        }
        
        // Also clean up Tawk widget iframe if present
        const tawkWidget = document.querySelector('#tawk-widget');
        if (tawkWidget && tawkWidget.parentNode) {
          tawkWidget.parentNode.removeChild(tawkWidget);
        }
      } catch (error) {
        console.warn('Error cleaning up Tawk.to widget:', error);
      }
    };
  }, [propertyId, widgetId]);

  // No visible content is rendered by this component
  return null;
}

// Add TypeScript definitions for Tawk.to global variables
declare global {
  interface Window {
    Tawk_API?: {
      onLoad?: () => void;
      setAttributes?: (attributes: any, callback?: (error: any) => void) => void;
      visitor?: {
        name?: string;
        email?: string;
      };
      customStyle?: {
        zIndex: number;
        visibility: {
          desktop: {
            position: string;
            yOffset: number;
            xOffset: number;
          };
          mobile: {
            position: string;
            yOffset: number;
            xOffset: number;
          };
        };
      };
    };
    Tawk_LoadStart?: Date;
  }
}