import React, { useEffect, useState, useRef } from 'react';

export type NotificationSoundType = 'calendar-add' | 'calendar-update' | 'calendar-delete' | 'collaboration' | 'reminder';

// Lydfiler for ulike varsler
const soundFiles: Record<NotificationSoundType, string> = {
  'calendar-add': '/sounds/calendar-add.mp3',
  'calendar-update': '/sounds/calendar-update.mp3',
  'calendar-delete': '/sounds/calendar-delete.mp3',
  'collaboration': '/sounds/collaboration.mp3',
  'reminder': '/sounds/reminder.mp3'
};

// Standard varighet hvis lyd ikke kan spilles av
const DEFAULT_DURATION = 1000;

interface NotificationSoundProps {
  isPlaying: boolean;
  soundType: NotificationSoundType;
  onComplete?: () => void;
}

/**
 * Komponent for å spille av varslingslyder
 */
export const NotificationSound: React.FC<NotificationSoundProps> = ({ 
  isPlaying, 
  soundType,
  onComplete
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  useEffect(() => {
    if (isPlaying) {
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(error => {
            console.error('Feil ved avspilling av lyd:', error);
            // Hvis lyden ikke kan spilles av, simuler likevel en lydhendelse
            if (onComplete) {
              window.setTimeout(onComplete, DEFAULT_DURATION);
            }
          });
        } else {
          // Hvis lydelementet ikke er tilgjengelig, simuler en lydhendelse
          if (onComplete) {
            window.setTimeout(onComplete, DEFAULT_DURATION);
          }
        }
      } catch (error) {
        console.error('Uventet feil ved avspilling av lyd:', error);
        if (onComplete) {
          window.setTimeout(onComplete, DEFAULT_DURATION);
        }
      }
    }
  }, [isPlaying, onComplete]);
  
  return (
    <audio 
      ref={audioRef}
      src={soundFiles[soundType]}
      onEnded={onComplete}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
};

/**
 * Hook for å spille av notifikasjonslyder
 */
export function useNotificationSound() {
  const [playingSound, setPlayingSound] = useState<NotificationSoundType | null>(null);
  
  const playSound = (soundType: NotificationSoundType) => {
    setPlayingSound(soundType);
  };
  
  const handleSoundComplete = () => {
    setPlayingSound(null);
  };
  
  const soundComponent = playingSound && (
    <NotificationSound
      isPlaying={true}
      soundType={playingSound}
      onComplete={handleSoundComplete}
    />
  );
  
  return { playSound, soundComponent };
}

/**
 * Statisk funksjon for å spille av lyd og vise toast-melding
 */
export function playNotificationWithToast(
  soundType: NotificationSoundType,
  toastFn: (props: any) => void,
  title: string,
  message: string
) {
  // Vis toast-melding
  toastFn({
    title,
    description: message,
  });
  
  // Spill varslingslyd
  const audio = new Audio(soundFiles[soundType]);
  audio.play().catch(error => {
    console.error('Feil ved avspilling av lyd:', error);
  });
}