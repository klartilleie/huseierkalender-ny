import { format, isSameDay, addHours, isBefore, isAfter, addDays, subDays } from "date-fns";
import { Event } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useState, TouchEvent } from "react";

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  onTimeClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onChangeDay?: (date: Date) => void;
}

export default function DayView({ 
  currentDate, 
  events, 
  onTimeClick, 
  onEventClick,
  onChangeDay 
}: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();
  const isToday = isSameDay(currentDate, now);
  const isMobile = useMediaQuery("(max-width: 640px)");
  
  // Touch gesture handling variables
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;
  
  // Handle touch start event
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };
  
  // Handle touch move event
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  // Handle touch end event
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !onChangeDay) return;
    
    // Calculate distance of swipe
    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;
    
    if (isSwipe) {
      // Swipe left -> next day
      if (distance > 0) {
        onChangeDay(addDays(currentDate, 1));
      }
      // Swipe right -> previous day
      else {
        onChangeDay(subDays(currentDate, 1));
      }
    }
    
    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  // Get events for the current day
  const dailyEvents = events.filter(event => 
    isSameDay(new Date(event.startTime), currentDate)
  );

  // Check if event belongs to this hour slot
  const isEventInHourSlot = (event: Event, hour: number) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = event.endTime ? new Date(event.endTime) : new Date(eventStart);
    eventEnd.setHours(eventEnd.getHours() + (event.endTime ? 0 : 1)); // Default to 1 hour if no end time
    
    const slotStart = new Date(currentDate);
    slotStart.setHours(hour, 0, 0, 0);
    
    const slotEnd = new Date(currentDate);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    
    return (
      isBefore(eventStart, slotEnd) &&
      isAfter(eventEnd, slotStart)
    );
  };

  // Format time to display
  const formatTimeDisplay = (hour: number) => {
    return format(new Date().setHours(hour, 0, 0, 0), 'h a');
  };

  // Filter hours to display based on mobile or desktop view
  const displayHours = isMobile
    ? hours.filter(hour => hour >= 6 && hour <= 21) // Show only 6 AM to 9 PM on mobile
    : hours;

  return (
    <div 
      className="flex-1 overflow-auto p-2 md:p-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="max-w-4xl mx-auto">
        {/* Day navigation controls for mobile */}
        {isMobile && onChangeDay && (
          <div className="flex items-center justify-between p-2 mb-2 bg-gray-50 rounded-md">
            <button 
              onClick={() => onChangeDay(subDays(currentDate, 1))}
              className="p-1 rounded-full hover:bg-gray-200 touch-manipulation"
              aria-label="Previous day"
            >
              &lt;
            </button>
            <h3 className="text-sm font-medium">
              {format(currentDate, 'EEE, MMM d')}
            </h3>
            <button 
              onClick={() => onChangeDay(addDays(currentDate, 1))}
              className="p-1 rounded-full hover:bg-gray-200 touch-manipulation"
              aria-label="Next day"
            >
              &gt;
            </button>
          </div>
        )}

        {/* Day title - show detailed format on desktop, simpler on mobile */}
        <h2 className={cn(
          "font-bold text-center mb-3 md:mb-4",
          isMobile ? "text-base" : "text-xl"
        )}>
          {isMobile 
            ? format(currentDate, 'EEEE, MMMM d') 
            : format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {displayHours.map((hour) => {
            const isCurrentHour = isToday && now.getHours() === hour;
            const hourEvents = dailyEvents.filter(event => isEventInHourSlot(event, hour));
            
            return (
              <div 
                key={hour} 
                className={cn(
                  "grid border-b border-slate-200 hover:bg-slate-50 transition touch-manipulation",
                  isCurrentHour && "bg-primary-50/20",
                  isMobile ? "grid-cols-6" : "grid-cols-12"
                )}
                onClick={() => {
                  const date = new Date(currentDate);
                  date.setHours(hour);
                  onTimeClick(date);
                }}
              >
                {/* Time column */}
                <div className={cn(
                  "border-r border-slate-200 text-right",
                  isMobile ? "col-span-1 py-2 px-2" : "col-span-2 py-3 px-4"
                )}>
                  <span className={cn(
                    isMobile ? "text-xs" : "text-sm",
                    isCurrentHour ? "font-bold text-primary-700" : "text-slate-500"
                  )}>
                    {formatTimeDisplay(hour)}
                  </span>
                </div>
                
                {/* Events column */}
                <div className={cn(
                  isCurrentHour ? "bg-primary-50/20" : "",
                  isMobile ? "col-span-5 py-1 px-2 min-h-[50px]" : "col-span-10 py-2 px-3 min-h-[80px]"
                )}>
                  {hourEvents.length > 0 ? (
                    <div className={cn(
                      "space-y-1"
                    )}>
                      {hourEvents.map((event, index) => (
                        <div
                          key={index}
                          className={cn(
                            "rounded text-white cursor-pointer",
                            isMobile ? "px-1.5 py-0.5" : "px-2 py-1"
                          )}
                          style={{ backgroundColor: (event.color as string) || "#ef4444" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                        >
                          <div className={cn(
                            isMobile ? "text-xs" : "text-sm font-medium"
                          )}>
                            {isMobile && event.title.length > 15 
                              ? `${event.title.substring(0, 14)}…` 
                              : event.title}
                          </div>
                          <div className={cn(
                            "opacity-90",
                            isMobile ? "text-[10px]" : "text-xs"
                          )}>
                            {format(new Date(event.startTime), 'h:mm a')}
                            {event.endTime && ` - ${format(new Date(event.endTime), 'h:mm a')}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className={cn(
                        "text-slate-400",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}>
                        No events
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
