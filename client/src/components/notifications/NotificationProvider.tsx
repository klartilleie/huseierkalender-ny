import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNotificationSound, NotificationSoundType } from './NotificationSound';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Typer for notifikasjoner
export interface Notification {
  id: string;
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'collaboration_invite' | 'system';
  title: string;
  message: string;
  eventId?: number;
  createdAt: Date;
  read: boolean;
  userId: number; // Mottaker
  fromUserId?: number; // Avsender, hvis relevant
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Sound type mapping
const notificationSoundMap: Record<Notification['type'], NotificationSoundType> = {
  'event_created': 'calendar-add',
  'event_updated': 'calendar-update',
  'event_deleted': 'calendar-delete',
  'collaboration_invite': 'collaboration',
  'system': 'reminder'
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { playSound, soundComponent } = useNotificationSound();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // WebSocket forbindelse
  useEffect(() => {
    if (!user) return;
    
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    
    const setupWebSocket = () => {
      // WebSocket setup function to keep code organized
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          console.log('WebSocket forbindelse opprettet');
          // Send autentiseringsmelding for å identifisere brukeren
          if (socket && socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({
                type: 'auth',
                userId: user.id
              }));
            } catch (error) {
              console.error('Feil ved sending av autentiseringsmelding:', error);
            }
          }
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Håndter ulike meldingstyper
            if (data.type === 'notification') {
              const notification = data.notification as Notification;
              
              // Legg til i notifikasjonslisten
              setNotifications(prev => [notification, ...prev]);
              
              // Vis toast og spill lyd hvis relevant
              if (!notification.read) {
                toast({
                  title: notification.title,
                  description: notification.message,
                });
                
                // Spill passende lyd
                const soundType = notificationSoundMap[notification.type] || 'calendar-add';
                playSound(soundType);
              }
            }
          } catch (error) {
            console.error('Feil ved håndtering av WebSocket-melding:', error);
          }
        };
        
        socket.onerror = (error) => {
          console.warn('WebSocket feil (ikke kritisk):', error);
          // Don't throw error that would crash the app - just log it
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket forbindelse lukket', event.code, event.reason);
          // Attempt reconnection after delay, but don't crash if failed
          if (event.code !== 1000) { // Not normal closure
            reconnectTimeout = setTimeout(() => {
              try {
                setupWebSocket();
              } catch (error) {
                console.error('Reconnection failed:', error);
              }
            }, 5000);
          }
        };
        
        return socket;
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
        return null;
      }
    };
    
    // Registrer først med API for å få tillatelse til å koble til
    const registerForNotifications = async () => {
      try {
        const response = await fetch('/api/notifications/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.log(`Registreringssvar ikke OK: ${response.status}`);
          // Vi setter opp WebSocket likevel, da feilen kan være på server-siden
          // men brukeren kan fortsatt motta varsler
          socket = setupWebSocket();
          return;
        }
        
        const data = await response.json();
        console.log('Registrert for varsler:', data);
        socket = setupWebSocket();
      } catch (error) {
        console.error('Feil ved registrering for varsler:', error);
        // Forsøk å sette opp WebSocket selv ved feil
        socket = setupWebSocket();
      }
    };
    
    // Kjør registreringsfunksjonen
    registerForNotifications();
    
    // Oppryddingsfunksjon
    return () => {
      try {
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (socket && socket.readyState !== WebSocket.CLOSED) {
          socket.close(1000, 'Component unmounting');
        }
      } catch (error) {
        console.error("Error cleaning up WebSocket:", error);
      }
    };
  }, [user, toast, playSound]);
  
  // Beregn antall uleste
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Marker som lest
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };
  
  // Marker alle som lest
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };
  
  // Slett notifikasjon
  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => 
      prev.filter(n => n.id !== notificationId)
    );
  };
  
  // Fjern alle notifikasjoner
  const clearAllNotifications = () => {
    setNotifications([]);
  };
  
  return (
    <NotificationContext.Provider 
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications
      }}
    >
      {children}
      {soundComponent}
    </NotificationContext.Provider>
  );
}

// Hook for å bruke notifikasjoner
export function useNotifications() {
  const context = useContext(NotificationContext);
  
  if (!context) {
    throw new Error('useNotifications må brukes innenfor en NotificationProvider');
  }
  
  return context;
}