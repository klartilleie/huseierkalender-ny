import { useState, useEffect, TouchEvent } from "react";
import { format, startOfWeek, addDays, isSameDay, addHours, isBefore, isAfter, parseISO, addWeeks, subWeeks } from "date-fns";
import { Event } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "../../hooks/use-media-query";

interface WeekViewProps {
  currentDate: Date;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onChangeWeek?: (date: Date) => void;
}

export default function WeekView({ currentDate, events, onDateClick, onEventClick, onChangeWeek }: WeekViewProps) {
  const [weekDays, setWeekDays] = useState<Date[]>([]);
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
    if (!touchStart || !touchEnd || !onChangeWeek) return;
    
    // Calculate distance of swipe
    const distance = touchStart - touchEnd;
    const isSwipe = Math.abs(distance) > minSwipeDistance;
    
    if (isSwipe) {
      // Swipe left -> next week
      if (distance > 0) {
        onChangeWeek(addWeeks(currentDate, 1));
      }
      // Swipe right -> previous week
      else {
        onChangeWeek(subWeeks(currentDate, 1));
      }
    }
    
    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // Calculate week days
  useEffect(() => {
    const days = [];
    const startDay = startOfWeek(currentDate);
    
    for (let i = 0; i < 7; i++) {
      days.push(addDays(startDay, i));
    }
    
    setWeekDays(days);
  }, [currentDate]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => 
      isSameDay(new Date(event.startTime), day)
    );
  };

  // Check if event belongs to this hour slot
  const isEventInHourSlot = (event: Event, day: Date, hour: number) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = event.endTime ? new Date(event.endTime) : new Date(eventStart);
    eventEnd.setHours(eventEnd.getHours() + (event.endTime ? 0 : 1)); // Default to 1 hour if no end time
    
    const slotStart = new Date(day);
    slotStart.setHours(hour, 0, 0, 0);
    
    const slotEnd = new Date(day);
    slotEnd.setHours(hour + 1, 0, 0, 0);
    
    return (
      isSameDay(eventStart, day) &&
      isBefore(eventStart, slotEnd) &&
      isAfter(eventEnd, slotStart)
    );
  };

  const isToday = (day: Date) => isSameDay(day, new Date());

  // Filter hours to display based on mobile or desktop view
  const displayHours = isMobile
    ? hours.filter(hour => hour >= 6 && hour <= 21) // Show only 6 AM to 9 PM on mobile
    : hours;
    
  return (
    <div 
      className="flex-1 overflow-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week Controls for Mobile */}
      {isMobile && onChangeWeek && (
        <div className="flex items-center justify-between p-2 mb-2 bg-gray-50 rounded-md">
          <button 
            onClick={() => onChangeWeek(subWeeks(currentDate, 1))}
            className="p-1 rounded-full hover:bg-gray-200"
            aria-label="Previous week"
          >
            &lt;
          </button>
          <h3 className="text-xs font-medium">
            {format(weekDays[0] || currentDate, 'MMM d')} - {format(weekDays[6] || addDays(currentDate, 6), 'MMM d')}
          </h3>
          <button 
            onClick={() => onChangeWeek(addWeeks(currentDate, 1))}
            className="p-1 rounded-full hover:bg-gray-200"
            aria-label="Next week"
          >
            &gt;
          </button>
        </div>
      )}
    
      <div className={cn(
        "grid border-b",
        isMobile ? "grid-cols-4" : "grid-cols-8" // Show fewer columns on mobile
      )}>
        {/* Time column header */}
        <div className="border-r border-slate-200 bg-white p-1 h-12 md:h-16">
          <div className="h-full flex items-end justify-center">
            <span className={cn(
              "text-slate-500 font-medium",
              isMobile ? "text-[9px]" : "text-xs"
            )}>
              Time
            </span>
          </div>
        </div>
        
        {/* Day columns headers - on mobile, show only select days */}
        {weekDays
          .filter((_, idx) => !isMobile || idx % 2 === 0) // On mobile, show Sun, Tue, Thu, Sat
          .map((day, index) => (
            <div 
              key={index} 
              className={cn(
                "border-r border-slate-200 cursor-pointer",
                isToday(day) ? "bg-primary-50 today-pulse" : "bg-white",
                isMobile ? "p-1 h-12" : "p-2 h-16"
              )}
              onClick={() => onDateClick(day)}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <span className={cn(
                  "text-slate-500 font-medium",
                  isMobile ? "text-[9px]" : "text-xs"
                )}>
                  {format(day, 'E')}
                </span>
                <span className={cn(
                  "font-bold mt-0.5",
                  isMobile ? "text-xs" : "text-sm",
                  isToday(day) ? "text-primary-700" : "text-slate-700"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
            </div>
          ))
        }
      </div>
      
      {/* Time slots */}
      <div className="relative">
        {displayHours.map((hour) => (
          <div 
            key={hour} 
            className={cn(
              "grid border-b border-slate-200",
              isMobile ? "grid-cols-4" : "grid-cols-8"
            )}
          >
            {/* Time column */}
            <div className="border-r border-slate-200 p-1 text-center">
              <span className={cn(
                "text-slate-500",
                isMobile ? "text-[9px]" : "text-xs"
              )}>
                {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
              </span>
            </div>
            
            {/* Day columns - on mobile, show only select days */}
            {weekDays
              .filter((_, idx) => !isMobile || idx % 2 === 0) // On mobile, show Sun, Tue, Thu, Sat
              .map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const hourEvents = dayEvents.filter(event => 
                  isEventInHourSlot(event, day, hour)
                );
                
                return (
                  <div 
                    key={dayIndex} 
                    className={cn(
                      "border-r border-slate-200 p-1 relative touch-manipulation",
                      isToday(day) ? "bg-primary-50/30" : ""
                    )}
                    style={{ 
                      minHeight: isMobile ? "45px" : "60px" 
                    }}
                    onClick={() => {
                      const date = new Date(day);
                      date.setHours(hour);
                      onDateClick(date);
                    }}
                  >
                    {hourEvents.map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        className={cn(
                          "mb-0.5 px-1 py-0.5 rounded text-white truncate",
                          isMobile ? "text-[8px]" : "text-xs"
                        )}
                        style={{ 
                          backgroundColor: (event.color as string) || "#ef4444" 
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        {isMobile && event.title.length > 8 
                          ? `${event.title.substring(0, 7)}…` 
                          : event.title}
                      </div>
                    ))}
                  </div>
                );
              })
            }
          </div>
        ))}
      </div>
    </div>
  );
}
