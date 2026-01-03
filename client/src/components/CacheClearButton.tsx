import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CacheClearButton() {
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();

  const clearAllCaches = async () => {
    setIsClearing(true);
    
    try {
      // Clear service worker caches
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        
        await new Promise((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.cacheCleared) {
              resolve(true);
            }
          };
          
          navigator.serviceWorker.controller.postMessage('clearCache', [messageChannel.port2]);
          
          // Timeout after 3 seconds
          setTimeout(() => resolve(false), 3000);
        });
      }
      
      // Clear browser caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear React Query cache
      const queryClient = await import('../lib/queryClient').then(m => m.queryClient);
      queryClient.clear();
      
      toast({
        title: "Cache tømt",
        description: "All midlertidig data er slettet. Siden vil lastes inn på nytt.",
      });
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast({
        title: "Feil ved tømming av cache",
        description: "Prøv å oppdatere siden manuelt.",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={clearAllCaches}
      disabled={isClearing}
      className="gap-2"
    >
      {isClearing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Tømmer cache...
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4" />
          Tøm cache
        </>
      )}
    </Button>
  );
}