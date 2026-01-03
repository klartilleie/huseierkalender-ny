import { useState } from "react";
import { format, startOfYear, addMonths, getDaysInMonth, startOfMonth, getDay, isSameDay, addYears, subYears, getWeek, startOfWeek, addDays } from "date-fns";
import { Event, MarkedDay } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompactYearViewProps {
  currentDate: Date;
  events: Event[];
  markedDays?: MarkedDay[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  showWeekNumbers?: boolean;
}

export default function CompactYearView({ 
  currentDate, 
  events, 
  markedDays = [], 
  onDateClick, 
  onEventClick,
  showWeekNumbers = true
}: CompactYearViewProps) {
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  
  // Norwegian month names
  const monthNames = [
    "Jan", "Feb", "Mars", "April", "Mai", "Juni",
    "Juli", "Aug", "Sep", "Okt", "Nov", "Des"
  ];
  
  // Norwegian weekday abbreviations
  const weekdays = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"];

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = event.endTime ? new Date(event.endTime) : new Date(event.startTime);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      return (eventStart <= dayEnd && eventEnd >= dayStart);
    });
  };

  // Check if date has events
  const hasEvents = (date: Date) => {
    return getEventsForDate(date).length > 0;
  };

  // Check if date has user events (rød farge)
  const hasUserEvents = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    return dayEvents.some(event => {
      // User events have positive numeric IDs and no source property
      return (typeof event.id === 'number' && event.id > 0 && !event.source);
    });
  };

  // Check if date has iCal events (blå farge)  
  const hasIcalEvents = (date: Date) => {
    const dayEvents = getEventsForDate(date);
    return dayEvents.some(event => {
      // iCal events have negative IDs or source property
      return (event.source || (typeof event.id === 'number' && event.id < 0));
    });
  };

  // Check if date is marked
  const isMarked = (date: Date) => {
    return markedDays.some(markedDay => 
      isSameDay(new Date(markedDay.date), date)
    );
  };

  // Generate calendar grid for a month
  const generateMonthGrid = (monthIndex: number) => {
    const monthDate = new Date(viewYear, monthIndex, 1);
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDayOfMonth = startOfMonth(monthDate);
    const startDay = (getDay(firstDayOfMonth) + 6) % 7; // Adjust for Monday start
    
    const weeks = [];
    let currentWeek = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      currentWeek.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, monthIndex, day);
      currentWeek.push(date);
      
      // If week is complete, add to weeks array
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Add remaining days to complete last week
    while (currentWeek.length < 7 && currentWeek.length > 0) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  // Get week number for the first day of each week
  const getWeekNumberForWeek = (week: (Date | null)[]) => {
    const firstDate = week.find(date => date !== null);
    return firstDate ? getWeek(firstDate) : null;
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setViewYear(viewYear - 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <h2 className="text-xl font-semibold text-gray-900">
          {viewYear}
        </h2>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setViewYear(viewYear + 1)}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Year grid */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, monthIndex) => {
          const weeks = generateMonthGrid(monthIndex);
          
          return (
            <div key={monthIndex} className="border border-gray-200 rounded">
              {/* Month header */}
              <div className="bg-gray-50 px-2 py-1 text-center border-b border-gray-200">
                <h3 className="text-xs font-medium text-gray-700">
                  {monthNames[monthIndex]}
                </h3>
              </div>
              
              {/* Weekday headers */}
              <div className="grid grid-cols-8 border-b border-gray-100">
                {showWeekNumbers && (
                  <div className="text-[8px] text-gray-400 text-center py-1">
                    Uke
                  </div>
                )}
                {weekdays.map((day, index) => (
                  <div key={index} className="text-[8px] text-gray-400 text-center py-1">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="p-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-8 gap-0">
                    {/* Week number */}
                    {showWeekNumbers && (
                      <div className="text-[8px] text-gray-400 text-center py-0.5 flex items-center justify-center">
                        {getWeekNumberForWeek(week)}
                      </div>
                    )}
                    
                    {/* Week days */}
                    {week.map((date, dayIndex) => {
                      if (!date) {
                        return <div key={dayIndex} className="h-4 w-4"></div>;
                      }
                      
                      const isToday = isSameDay(date, new Date());
                      const isSelected = isSameDay(date, currentDate);
                      const hasEventsOnDate = hasEvents(date);
                      const hasUserEventsOnDate = hasUserEvents(date);
                      const hasIcalEventsOnDate = hasIcalEvents(date);
                      const isMarkedDate = isMarked(date);
                      
                      // Determine background color based on event types
                      let bgColor = "";
                      let textColor = "";
                      let tooltipText = `${format(date, 'dd.MM.yyyy')}`;
                      
                      if (isToday) {
                        bgColor = "bg-blue-600";
                        textColor = "text-white font-bold";
                      } else if (isSelected) {
                        bgColor = "bg-blue-100";
                        textColor = "text-blue-800 font-semibold";
                      } else if (hasUserEventsOnDate && hasIcalEventsOnDate) {
                        // Both user and iCal events - purple text
                        bgColor = "";
                        textColor = "text-purple-600 font-bold";
                        tooltipText += " - Bruker og booking hendelser";
                      } else if (hasUserEventsOnDate) {
                        // Only user events - red text (very visible)
                        bgColor = "";
                        textColor = "text-red-600 font-bold";
                        tooltipText += " - Bruker hendelser";
                      } else if (hasIcalEventsOnDate) {
                        // Only iCal events - rosa text (very visible)
                        bgColor = "";
                        textColor = "text-pink-600 font-bold";
                        tooltipText += " - Booking hendelser";
                      } else if (isMarkedDate) {
                        // Only marked day - green text
                        bgColor = "";
                        textColor = "text-green-600 font-bold";
                        tooltipText += " - Markert dag";
                      } else {
                        // No events - default
                        bgColor = "";
                        textColor = "text-gray-600";
                      }
                      
                      // Determine inline style for text color to ensure visibility
                      let textStyle = {};
                      if (hasUserEventsOnDate && hasIcalEventsOnDate) {
                        textStyle = { color: '#9333ea', fontWeight: 'bold' }; // Purple
                      } else if (hasUserEventsOnDate) {
                        textStyle = { color: '#dc2626', fontWeight: 'bold' }; // Red
                      } else if (hasIcalEventsOnDate) {
                        textStyle = { color: '#ec4899', fontWeight: 'bold' }; // Rosa for iCal
                      } else if (isMarkedDate) {
                        textStyle = { color: '#059669', fontWeight: 'bold' }; // Green
                      }

                      return (
                        <button
                          key={dayIndex}
                          onClick={() => onDateClick(date)}
                          className={cn(
                            "h-4 w-4 text-[8px] text-center hover:bg-blue-100 transition-colors rounded-sm flex items-center justify-center",
                            bgColor,
                            !hasEventsOnDate && !isMarkedDate ? textColor : ""
                          )}
                          style={hasEventsOnDate || isMarkedDate ? textStyle : {}}
                          title={tooltipText}
                        >
                          {format(date, 'd')}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Toggle for week numbers */}
      <div className="flex items-center justify-center mt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showWeekNumbers}
            onChange={() => {}}
            className="rounded"
            readOnly
          />
          Vis ukenummer
        </label>
      </div>
    </div>
  );
}