import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, format } from "date-fns";
import { Event } from "@shared/schema";

// Get calendar days for month view
export function getCalendarDays(currentDate: Date) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = [];
  let day = calendarStart;
  
  while (day <= calendarEnd) {
    days.push({
      date: day,
      isCurrentMonth: isSameMonth(day, currentDate),
      isToday: isSameDay(day, new Date()),
      isSelected: isSameDay(day, currentDate),
      dateString: format(day, "yyyy-MM-dd"),
    });
    day = addDays(day, 1);
  }
  
  return days;
}

// Get calendar days for week view
export function getWeekDays(currentDate: Date) {
  const weekStart = startOfWeek(currentDate);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    days.push({
      date: day,
      isToday: isSameDay(day, new Date()),
      isSelected: isSameDay(day, currentDate),
      dateString: format(day, "yyyy-MM-dd"),
    });
  }
  
  return days;
}

// Get hours for day or week view
export function getHoursForDay() {
  return Array.from({ length: 24 }, (_, i) => i);
}

// Group events by date
export function groupEventsByDate(events: Event[]) {
  const grouped: Record<string, Event[]> = {};
  
  events.forEach(event => {
    const date = format(new Date(event.startTime), "yyyy-MM-dd");
    grouped[date] = grouped[date] || [];
    grouped[date].push(event);
  });
  
  return grouped;
}

// Filter events for a specific date
export function getEventsForDate(events: Event[], date: Date) {
  return events.filter(event => {
    const eventDate = new Date(event.startTime);
    return isSameDay(eventDate, date);
  });
}

// Format time for display
export function formatEventTime(event: Event) {
  const start = new Date(event.startTime);
  
  if (event.allDay) {
    return "All day";
  }
  
  let timeString = format(start, "h:mm a");
  
  if (event.endTime) {
    const end = new Date(event.endTime);
    timeString += ` - ${format(end, "h:mm a")}`;
  }
  
  return timeString;
}
