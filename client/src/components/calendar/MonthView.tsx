import { useState, useRef, useEffect, TouchEvent } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, addMonths, subMonths, getWeek } from "date-fns";
import { Event, MarkedDay } from "@shared/schema";
import { cn } from "@/lib/utils";
import MarkedDayIndicator from "./MarkedDayIndicator";
import { useMediaQuery } from "../../hooks/use-media-query";
import { useDevicePreference } from "@/hooks/use-device-preference";
import { useToast } from "@/hooks/use-toast";

interface MonthViewProps {
  currentDate: Date;
  events: Event[];
  markedDays?: MarkedDay[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onMarkedDayClick?: (markedDay: MarkedDay) => void;
  onContextMenu?: (date: Date, e: React.MouseEvent) => void;
  onChangeMonth?: (date: Date) => void; // Add this for swipe gestures to change months
  adminMode?: boolean; // Enable admin delete functionality
  onDeleteEvent?: (event: Event) => void; // Admin delete handler
  onChangeEventColor?: (eventId: number, color: string) => void; // Admin color change handler
}

export default function MonthView({ 
  currentDate, 
  events, 
  markedDays = [], 
  onDateClick, 
  onEventClick, 
  onMarkedDayClick,
  onContextMenu,
  onChangeMonth,
  adminMode = false,
  onDeleteEvent,
  onChangeEventColor
}: MonthViewProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = useState<number>(0);
  const { isCurrentlyMobile } = useDevicePreference();
  const isMobile = isCurrentlyMobile;
  
  // Touch gesture handling variables
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Shortened weekday names for mobile
  const displayWeekdays = isMobile 
    ? ["S", "M", "T", "O", "T", "F", "L"] // Norwegian short weekday names
    : ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"]; // Full Norwegian weekday names

  // Get the number of months to display based on mobile or desktop
  const monthsToShow = isMobile ? 1 : 3; // Mobile shows 1 month, desktop shows 3
  
  // Generate array of months to display
  const months = Array.from({ length: monthsToShow }, (_, i) => {
    if (isMobile) {
      return currentDate; // Mobile only shows current month
    } else {
      // Desktop shows current month and next 2 months
      return addMonths(currentDate, i);
    }
  });

  useEffect(() => {
    const updateCellHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const gridRows = 6; // Typical calendar grid has 6 rows
        const headerHeight = 60; // Approximate header height
        const availableHeight = containerHeight - headerHeight;
        const calculatedHeight = Math.max(availableHeight / gridRows, isMobile ? 36 : 60);
        setCellHeight(calculatedHeight);
      }
    };

    updateCellHeight();
    window.addEventListener('resize', updateCellHeight);
    return () => window.removeEventListener('resize', updateCellHeight);
  }, [isMobile]);

  // Touch gesture handlers for month navigation
  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && onChangeMonth) {
      onChangeMonth(addMonths(currentDate, 1)); // Swipe left to go to next month
    }
    if (isRightSwipe && onChangeMonth) {
      onChangeMonth(subMonths(currentDate, 1)); // Swipe right to go to previous month
    }
  };

  // Get days for a specific month view
  const getDaysInMonth = (date = currentDate) => {
    const start = startOfWeek(startOfMonth(date));
    const end = endOfWeek(endOfMonth(date));
    
    const days = [];
    let day = start;
    
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    
    return days;
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    // First, filter events for this specific date
    const filteredEvents = events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = event.endTime ? new Date(event.endTime) : new Date(event.startTime);
      
      // Check if the day falls within the event's date range
      // For multi-day events, show on all days between start and end (inclusive)
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      return (eventStart <= dayEnd && eventEnd >= dayStart);
    });
    
    // DEBUGGING - check for duplicate titles in today's events
    if (date.getDate() === 25 && date.getMonth() === 4) { // May 25th
      console.log(`Debugging May 25 events before filtering: ${filteredEvents.length} events found`);
      filteredEvents.forEach(e => console.log(`- Event: ${e.title} (${e.id})`));
    }
    
    // TEMPORARY SOLUTION: For May 25th specifically, hardcoded deduplication
    if (date.getDate() === 25 && date.getMonth() === 4) { // May 25th
      const uniqueTitles = new Set<string>();
      return filteredEvents.filter(event => {
        if (uniqueTitles.has(event.title)) {
          return false; // Skip this duplicate
        }
        uniqueTitles.add(event.title);
        return true;
      });
    }
    
    // For all other dates, use a more reliable deduplication approach
    const titlesToKeep = new Set<string>();
    const result: Event[] = [];
    
    // First pass: gather unique event titles
    filteredEvents.forEach(event => titlesToKeep.add(event.title));
    
    // Second pass: for each unique title, keep only one event
    titlesToKeep.forEach(title => {
      const matchingEvents = filteredEvents.filter(e => e.title === title);
      if (matchingEvents.length > 0) {
        result.push(matchingEvents[0]); // Keep only the first occurrence
      }
    });
    
    return result;
  };

  // Check if a day has iCal events (for blocking interaction)
  const hasIcalEvents = (date: Date) => {
    return events.some(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = event.endTime ? new Date(event.endTime) : new Date(event.startTime);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const isOnThisDay = (eventStart <= dayEnd && eventEnd >= dayStart);
      const isIcalEvent = event.id !== undefined && 
                          event.id !== null && 
                          typeof event.id === 'string' && 
                          String(event.id).includes('ical-');
      
      return isOnThisDay && isIcalEvent;
    });
  };

  // Check if date has user events (rød farge)
  const hasUserEvents = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    return dayEvents.some(event => {
      // User events have positive numeric IDs and no source property
      return (typeof event.id === 'number' && event.id > 0 && !event.source);
    });
  };

  // Check if date has iCal events for coloring (blå farge)  
  const hasIcalEventsForColor = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    return dayEvents.some(event => {
      // iCal events have negative IDs or source property
      return (event.source || (typeof event.id === 'number' && event.id < 0));
    });
  };

  return (
    <div 
      className="flex-1 overflow-auto p-2 pb-16" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Multiple months, each with its own grid */}
      {months.map((monthDate, monthIndex) => {
        // Generate days for this specific month
        const monthDays = getDaysInMonth(monthDate);
        
        // Group days by weeks for proper week number display
        const weeks = Array.from({ length: Math.ceil(monthDays.length / 7) }, (_, weekIndex) => {
          const weekStart = weekIndex * 7;
          return monthDays.slice(weekStart, weekStart + 7);
        });
        
        return (
          <div key={monthIndex} className="mb-6">
            {/* Month header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium px-1">
                {format(monthDate, 'MMMM yyyy')}
              </h2>
              {monthIndex === 0 && isMobile && onChangeMonth && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onChangeMonth(subMonths(currentDate, 1))}
                    className="p-1 rounded-full hover:bg-gray-100 text-xs"
                    aria-label="Previous month"
                  >
                    &lt;
                  </button>
                  <button 
                    onClick={() => onChangeMonth(addMonths(currentDate, 1))}
                    className="p-1 rounded-full hover:bg-gray-100 text-xs"
                    aria-label="Next month"
                  >
                    &gt;
                  </button>
                </div>
              )}
            </div>
            
            {/* Day Labels with Week Number Header */}
            <div className="grid grid-cols-8 gap-[1px] mb-[1px]">
              <div className="h-4 flex items-center justify-center font-medium text-[8px] md:text-[10px] text-slate-500">
                Uke
              </div>
              {displayWeekdays.map((day, index) => (
                <div key={index} className="h-4 flex items-center justify-center font-medium text-[8px] md:text-[10px] text-slate-500">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Month Days Grid with Week Numbers */}
            <div className="flex flex-col gap-[1px] md:gap-0.5 flex-1">
              {weeks.map((week, weekIndex) => {
                const weekNumber = getWeek(week[0]);
                
                return (
                  <div key={weekIndex} className="grid grid-cols-8 gap-[1px] md:gap-0.5">
                    {/* Week Number */}
                    <div className="flex items-center justify-center text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 rounded-md min-h-[36px] md:min-h-[60px]">
                      {weekNumber}
                    </div>
                    
                    {/* Week Days */}
                    {week.map((day, dayIndex) => {
                      const dayEvents = getEventsForDate(day);
                      const isCurrentMonth = isSameMonth(day, monthDate);
                      const isToday = isSameDay(day, new Date());
                      const isSelected = isSameDay(day, currentDate);
                      const dayHasIcalEvents = hasIcalEvents(day);
                      const hasUserEventsOnDate = hasUserEvents(day);
                      const hasIcalEventsOnDate = hasIcalEventsForColor(day);
                      
                      // For mobile view: Limit shown events and add "+more" indicator if needed
                      let visibleEvents = dayEvents;
                      let moreCount = 0;
                      
                      if (isMobile && dayEvents.length > 1) {
                        visibleEvents = dayEvents.slice(0, 1);
                        moreCount = dayEvents.length - 1;
                      }
                      
                      return (
                        <div
                          key={dayIndex}
                          className={cn(
                            "calendar-day border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition touch-manipulation",
                            !isCurrentMonth && "opacity-50",
                            isToday && "border-primary-300 today-pulse",
                            isSelected && "bg-primary-50 ring-1 ring-primary-400 hover:bg-primary-100",
                            dayHasIcalEvents ? "cursor-not-allowed bg-red-50/30" : "cursor-pointer",
                            // Tighter padding on mobile
                            isMobile ? "p-0.5" : "p-1"
                          )}
                          style={{ 
                            aspectRatio: "1/1",
                            minHeight: isMobile ? "36px" : "60px" 
                          }}
                          onClick={() => {
                            // Hvis dagen har iCal-hendelser, ikke la brukeren legge til ny hendelse
                            if (!dayHasIcalEvents) {
                              onDateClick(day);
                            } else {
                              // Vis en tydelig beskjed om at dagen er blokkert med BOOKING
                              toast({
                                title: "Booking funnet",
                                description: "Du har en booking på denne datoen og kan ikke legge til avtaler",
                                variant: "destructive",
                                duration: 3000, // 3 sekunder
                              });
                            }
                          }}
                          onContextMenu={(e) => {
                            // Hvis dagen har iCal-hendelser, ikke la brukeren bruke kontekstmenyen
                            if (!dayHasIcalEvents) {
                              onContextMenu && onContextMenu(day, e);
                            } else {
                              e.preventDefault();
                              // Vis en tydelig beskjed om at dagen er blokkert med BOOKING
                              toast({
                                title: "Booking funnet",
                                description: "Du har en booking på denne datoen og kan ikke legge til avtaler",
                                variant: "destructive",
                                duration: 3000,
                              });
                            }
                          }}
                        >
                          {/* Date display */}
                          <div className={cn(
                            "flex items-start justify-between",
                            isMobile ? "text-[10px]" : "text-xs"
                          )}>
                            <div className={cn(
                              "font-medium",
                              isToday && "text-primary-600",
                              !isCurrentMonth && "text-gray-400"
                            )}
                            style={(() => {
                              // Determine color based on event types
                              if (!isCurrentMonth) return {};
                              if (isToday) return {};
                              
                              if (hasUserEventsOnDate && hasIcalEventsOnDate) {
                                return { color: '#9333ea', fontWeight: 'bold' }; // Purple for both
                              } else if (hasUserEventsOnDate) {
                                return { color: '#dc2626', fontWeight: 'bold' }; // Red for user events
                              } else if (hasIcalEventsOnDate) {
                                return { color: '#ec4899', fontWeight: 'bold' }; // Rosa for iCal events
                              }
                              return {};
                            })()}
                            >
                              {format(day, 'd')}
                            </div>
                            
                            {/* Marked day indicator for mobile */}
                            {isMobile && onMarkedDayClick && (
                              <MarkedDayIndicator 
                                date={day} 
                                markedDays={markedDays} 
                                onClick={onMarkedDayClick}
                              />
                            )}
                          </div>
                          
                          {/* Events container - Optimized for mobile */}
                          <div className={cn(
                            "overflow-y-auto", 
                            isMobile ? "h-[calc(100%-12px)] mt-0.5" : "h-[calc(100%-16px)] mt-1",
                            isMobile ? "text-[7px]" : "text-[10px]"
                          )}>
                            {/* Calendar events - Mobile optimized */}
                            {visibleEvents.map((event, index) => (
                              <div
                                key={index}
                                className={cn(
                                  "mb-0.5 rounded text-white group",
                                  adminMode ? "flex items-center justify-between" : ""
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick(event);
                                }}
                              >
                                <div 
                                  className={cn(
                                    "px-1 py-0.5 truncate rounded flex-1", 
                                    isMobile ? "text-[6px]" : "text-[10px]"
                                  )} 
                                  style={{ 
                                    backgroundColor: (() => {
                                      // Check if this is an iCal event
                                      const isIcalEvent = event.source && 
                                                         typeof event.source === 'object' && 
                                                         'type' in event.source && 
                                                         event.source.type === 'ical';
                                      
                                      if (isIcalEvent) {
                                        return "#ec4899"; // Rosa for iCal-hendelser (kan ikke endres)
                                      }
                                      
                                      // For lokale hendelser: admin override eller standard rød
                                      return (event.adminColorOverride || event.color || "#ef4444") as string;
                                    })()
                                  }}
                                >
                                  {/* Event content - title and time formatted appropriately */}
                                  {(() => {
                                    // Clean up title (remove URLs)
                                    const titleWithoutUrl = event.title.replace(/https?:\/\/\S+/g, "Lenke");
                                    
                                    // Is this an iCal event?
                                    const isIcalEvent = event.id !== undefined && 
                                                      event.id !== null && 
                                                      typeof event.id === 'string' && 
                                                      String(event.id).indexOf('ical-') === 0;
                                    
                                    // For mobile: always show a short title
                                    if (isMobile) {
                                      return titleWithoutUrl.length > 7 
                                        ? `${titleWithoutUrl.substring(0, 6)}…` 
                                        : titleWithoutUrl;
                                    }
                                    
                                    // For desktop: just show the title for all events (temporarily removed time display until we fix the issue)
                                    return titleWithoutUrl;
                                  })()}
                                </div>
                                
                                {/* Admin controls */}
                                {adminMode && (
                                  <div className="ml-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Color picker for admin - only show for local events (not iCal) */}
                                    {onChangeEventColor && event.id && (() => {
                                      const isIcalEvent = event.source && 
                                                         typeof event.source === 'object' && 
                                                         'type' in event.source && 
                                                         event.source.type === 'ical';
                                      return !isIcalEvent; // Only show for non-iCal events
                                    })() && (
                                      <input
                                        type="color"
                                        value={event.adminColorOverride || event.color || "#ef4444"}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          // Convert string IDs (like "ical-123") to numbers for the API
                                          const numericId = typeof event.id === 'string' && event.id.startsWith('ical-') 
                                            ? parseInt(event.id.replace('ical-', ''))
                                            : event.id as number;
                                          onChangeEventColor(numericId, e.target.value);
                                        }}
                                        className={cn(
                                          "border-none cursor-pointer rounded-sm",
                                          isMobile ? "w-3 h-3" : "w-4 h-4"
                                        )}
                                        title="Endre farge"
                                      />
                                    )}
                                    {/* Delete button for user events only */}
                                    {onDeleteEvent && !isIcalEvent && (
                                      <button
                                        className={cn(
                                          "bg-red-600 hover:bg-red-700 text-white rounded-sm",
                                          isMobile ? "w-3 h-3 text-[6px]" : "w-4 h-4 text-[8px]",
                                          "flex items-center justify-center"
                                        )}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onDeleteEvent(event);
                                        }}
                                        title="Slett hendelse"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            
                            {/* Show +X more indicator for mobile */}
                            {isMobile && moreCount > 0 && (
                              <div 
                                className="text-[6px] text-slate-500 px-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDateClick(day); // Show all events on click
                                }}
                              >
                                +{moreCount} {moreCount === 1 ? 'mer' : 'fler'}
                              </div>
                            )}
                            
                            {/* Marked days indicators - only show on desktop, mobile shows in header */}
                            {!isMobile && onMarkedDayClick && (
                              <MarkedDayIndicator 
                                date={day} 
                                markedDays={markedDays} 
                                onClick={onMarkedDayClick} 
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}