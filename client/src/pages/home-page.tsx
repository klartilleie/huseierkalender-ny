import { useState, useEffect } from "react";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import CompactYearView from "@/components/calendar/CompactYearView";
import AddEventModal from "@/components/modals/AddEventModal";
import EventDetailsModal from "@/components/modals/EventDetailsModal";
import MarkDayModal from "@/components/modals/MarkDayModal";
import MarkedDayDetailsModal from "@/components/modals/MarkedDayDetailsModal";
import Layout from "@/components/Layout";
import { Event, MarkedDay, User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

type CalendarView = "month" | "week" | "day";
type CalendarSize = "large" | "compact";

export default function HomePage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [calendarSize, setCalendarSize] = useState<CalendarSize>("large");
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  
  // User selection state for admin users
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [viewingOtherUser, setViewingOtherUser] = useState(false);
  
  // Marked day states
  const [showMarkDayModal, setShowMarkDayModal] = useState(false);
  const [selectedMarkedDay, setSelectedMarkedDay] = useState<MarkedDay | null>(null);
  const [showMarkedDayDetailsModal, setShowMarkedDayDetailsModal] = useState(false);

  // Fetch users for admin and mini admin dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      if (!user?.isAdmin && !user?.isMiniAdmin) return [];
      const response = await apiRequest("GET", "/api/admin/users");
      return response.json();
    },
    enabled: !!(user?.isAdmin || user?.isMiniAdmin),
  });

  // Effect to reset selected user if admin/mini admin status changes
  useEffect(() => {
    if (!user?.isAdmin && !user?.isMiniAdmin) {
      setSelectedUserId(null);
      setViewingOtherUser(false);
    }
  }, [user?.isAdmin, user?.isMiniAdmin]);

  // Calculate date range for events based on current view
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (currentView === "month") {
      start.setDate(1);
      start.setDate(start.getDate() - start.getDay()); // Start from the first Sunday
      end.setMonth(end.getMonth() + 1, 0); // Last day of current month
      end.setDate(end.getDate() + (6 - end.getDay())); // End on the last Saturday
    } else if (currentView === "week") {
      start.setDate(start.getDate() - start.getDay()); // Start from Sunday
      end.setDate(end.getDate() + (6 - start.getDay())); // End on Saturday
    } else {
      // Day view - just the current day
    }
    
    return { start, end };
  };

  const { start, end } = getDateRange();

  // State for å spore om det er første lasting av brukerens kalender
  const [initialLoadComplete, setInitialLoadComplete] = useState<Record<string, boolean>>({});
  
  // Fetch user events from selected user if an admin is viewing another user's calendar
  // Using the new admin-calendar endpoint for fresh data
  const { data: userEvents = [] } = useQuery<Event[]>({
    queryKey: ["/api/admin/user-calendar", selectedUserId, { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async ({ queryKey }) => {
      const [_, userId, params] = queryKey;
      if (!userId) return [];
      
      console.log("Home view (Admin): Fetching user calendar for", userId);
      
      // Sjekk om dette er første gang vi laster kalenderen for denne brukeren
      const userIdString = String(userId);
      const isFirstLoad = !initialLoadComplete[userIdString];
      
      // Bruk det nye endepunktet, tving refresh bare ved første lasting
      const forceRefreshParam = isFirstLoad ? '?force_refresh=true' : '';
      const response = await apiRequest("GET", `/api/admin/user-calendar/${userId}${forceRefreshParam}`);
      
      // Merk at vi har fullført første lasting
      if (isFirstLoad) {
        setInitialLoadComplete(prev => ({...prev, [userIdString]: true}));
      }
      
      return response.json();
    },
    enabled: !!user?.isAdmin && !!selectedUserId && viewingOtherUser,
    staleTime: 5000, // Redusert stale-tid for raskere oppdateringer
    refetchInterval: 30000, // Polling hver 30. sekund
    refetchOnWindowFocus: true, // Oppdater når admin kommer tilbake til vinduet
  });

  // Fetch events (personal events)
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events", { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const res = await fetch(`/api/events?${searchParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    enabled: !viewingOtherUser, // Only fetch personal events when not viewing another user's calendar
    staleTime: 30000, // Cache for 30 seconds to avoid refetching when switching between views
  });

  // Fetch iCal events with date filtering for better performance
  const { data: icalEvents = [] } = useQuery<Event[]>({
    queryKey: ["/api/ical-feed-events", { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const res = await fetch(`/api/ical-feed-events?${searchParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch iCal events");
      return res.json();
    },
    enabled: !!user && !viewingOtherUser, // Only fetch if user is logged in and not viewing another user's calendar
    staleTime: 30000, // Cache for 30 seconds to avoid refetching when switching between views
  });
  
  // Handle user change in dropdown
  const handleUserChange = (userId: number) => {
    if (user?.id === userId) {
      // Return to personal calendar
      setSelectedUserId(null);
      setViewingOtherUser(false);
    } else {
      // View another user's calendar
      setSelectedUserId(userId);
      setViewingOtherUser(true);
    }
  };

  // Fetch user marked days when viewing another user's calendar
  const { data: userMarkedDays = [] } = useQuery<MarkedDay[]>({
    queryKey: ["/api/admin/user-marked-days", selectedUserId, { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async ({ queryKey }) => {
      const [_, userId, params] = queryKey;
      if (!userId) return [];
      
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const response = await apiRequest("GET", `/api/admin/user-marked-days/${userId}?${searchParams.toString()}`);
      return response.json();
    },
    enabled: !!user?.isAdmin && !!selectedUserId && viewingOtherUser,
  });

  // Fetch personal marked days
  const { data: personalMarkedDays = [] } = useQuery<MarkedDay[]>({
    queryKey: ["/api/marked-days", { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async ({ queryKey }) => {
      const [_, params] = queryKey;
      const searchParams = new URLSearchParams(params as Record<string, string>);
      const res = await fetch(`/api/marked-days?${searchParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch marked days");
      return res.json();
    },
    enabled: !viewingOtherUser,
    staleTime: 60000, // Cache marked days for 1 minute since they change less frequently
  });

  // Use the appropriate events and marked days based on whether admin is viewing another user's calendar
  const allEvents = viewingOtherUser ? userEvents : [...events, ...icalEvents];
  const markedDays = viewingOtherUser ? userMarkedDays : personalMarkedDays;

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleViewChange = (view: CalendarView) => {
    setCurrentView(view);
  };

  const handleCalendarSizeChange = (size: CalendarSize) => {
    setCalendarSize(size);
    // When switching to compact view, default to month view for better experience
    if (size === "compact") {
      setCurrentView("month");
    }
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  };

  const handleAddEvent = () => {
    setShowAddEventModal(true);
  };
  
  // Handle context menu on date (right-click)
  const handleDateContextMenu = (date: Date, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent the browser's context menu
    setCurrentDate(date);
    setShowMarkDayModal(true);
  };
  
  // Handle marked day click
  const handleMarkedDayClick = (markedDay: MarkedDay) => {
    setSelectedMarkedDay(markedDay);
    setShowMarkedDayDetailsModal(true);
  };

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {viewingOtherUser && selectedUserId && (
          <div className="bg-amber-50 border-b border-amber-200 p-2 text-center text-amber-800">
            <p className="text-sm">
              Du ser nå kalenderen til: <span className="font-semibold">
                {users.find(u => u.id === selectedUserId)?.name || 'Bruker'}
              </span>
            </p>
          </div>
        )}
        
        {!viewingOtherUser && user?.adminInfo && (
          <div className="bg-blue-50 border-b border-blue-200 p-3 text-blue-800">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-sm font-semibold mb-1">Melding fra administrator:</h3>
              <div className="text-sm whitespace-pre-wrap">
                {user.adminInfo}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {user.adminInfoUpdatedAt && (
                  <p>Oppdatert: {new Date(user.adminInfoUpdatedAt).toLocaleDateString('no-NO', {
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                )}
              </div>
            </div>
          </div>
        )}
        

        <div className="px-6 py-4">
          <CalendarHeader
            currentDate={currentDate}
            currentView={currentView}
            onDateChange={handleDateChange}
            onViewChange={handleViewChange}
            onAddEvent={handleAddEvent}
            calendarSize={calendarSize}
            onCalendarSizeChange={handleCalendarSizeChange}
            users={users}
            selectedUserId={selectedUserId}
            onUserChange={handleUserChange}
          />
          
          {calendarSize === "compact" ? (
            <CompactYearView 
              currentDate={currentDate} 
              events={allEvents}
              markedDays={markedDays}
              onEventClick={handleEventClick}
              onDateClick={(date) => {
                setCurrentDate(date);
                setShowAddEventModal(true);
              }}
              showWeekNumbers={true}
            />
          ) : (
            <>
              {currentView === "month" && (
                <MonthView 
                  currentDate={currentDate} 
                  events={allEvents}
                  markedDays={markedDays}
                  onEventClick={handleEventClick}
                  onMarkedDayClick={handleMarkedDayClick}
                  onContextMenu={handleDateContextMenu}
                  onDateClick={(date) => {
                    setCurrentDate(date);
                    setShowAddEventModal(true);
                  }}
                  onChangeMonth={handleDateChange}
                />
              )}
              
              {currentView === "week" && (
                <WeekView 
                  currentDate={currentDate} 
                  events={allEvents} 
                  onEventClick={handleEventClick}
                  onDateClick={(date) => {
                    setCurrentDate(date);
                    setShowAddEventModal(true);
                  }}
                  onChangeWeek={handleDateChange}
                />
              )}
              
              {currentView === "day" && (
                <DayView 
                  currentDate={currentDate} 
                  events={allEvents} 
                  onEventClick={handleEventClick}
                  onTimeClick={(date) => {
                    setCurrentDate(date);
                    setShowAddEventModal(true);
                  }}
                  onChangeDay={handleDateChange}
                />
              )}
            </>
          )}
          

        </div>
      </div>

      {/* Modals */}
      {showAddEventModal && (
        <AddEventModal
          isOpen={showAddEventModal}
          onClose={() => setShowAddEventModal(false)}
          initialDate={currentDate}
        />
      )}
      
      {showEventDetailsModal && selectedEvent && (
        <EventDetailsModal
          isOpen={showEventDetailsModal}
          onClose={() => setShowEventDetailsModal(false)}
          event={selectedEvent}
        />
      )}
      
      {/* Mark Day Modal */}
      {showMarkDayModal && (
        <MarkDayModal
          isOpen={showMarkDayModal}
          onClose={() => setShowMarkDayModal(false)}
          initialDate={currentDate}
        />
      )}
      
      {/* Marked Day Details Modal */}
      {showMarkedDayDetailsModal && selectedMarkedDay && (
        <MarkedDayDetailsModal
          isOpen={showMarkedDayDetailsModal}
          onClose={() => setShowMarkedDayDetailsModal(false)}
          markedDay={selectedMarkedDay}
        />
      )}
    </Layout>
  );
}
