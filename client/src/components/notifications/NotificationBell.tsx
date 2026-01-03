import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from './NotificationProvider';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  // Vis bare varslingsklokken hvis brukeren er autentisert
  return (
    <div className="relative inline-block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-9 w-9"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 px-1.5 min-w-5 flex items-center justify-center"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="p-4 font-medium flex items-center justify-between">
            <h2 className="text-lg">Varsler</h2>
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => markAllAsRead()}
                className="text-xs hover:bg-muted"
              >
                Marker alle som lest
              </Button>
            )}
          </div>
          <Separator />
          <ScrollArea className="max-h-[60vh] overflow-y-auto p-0">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-center text-muted-foreground">
                <p>Du har ingen varsler</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 border-b last:border-b-0 flex flex-col ${!notification.read ? 'bg-muted/30' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-medium text-sm">{notification.title}</h3>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-muted"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <span className="sr-only">Marker som lest</span>
                            <div className="h-2 w-2 rounded-full bg-primary"></div>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 rounded-full hover:bg-muted"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <span className="sr-only">Fjern</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                          </svg>
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(notification.createdAt), 'PPp', { locale: nb })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}