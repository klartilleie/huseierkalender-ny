import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, Menu, Grid3X3, Maximize2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "@shared/schema";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDevicePreference } from "@/hooks/use-device-preference";
import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface CalendarHeaderProps {
  currentDate: Date;
  currentView: "month" | "week" | "day";
  onDateChange: (date: Date) => void;
  onViewChange: (view: "month" | "week" | "day") => void;
  onAddEvent: () => void;
  users?: User[];
  selectedUserId?: number | null;
  onUserChange?: (userId: number) => void;
  calendarSize?: "large" | "compact";
  onCalendarSizeChange?: (size: "large" | "compact") => void;
}

export default function CalendarHeader({
  currentDate,
  currentView,
  onDateChange,
  onViewChange,
  onAddEvent,
  users,
  selectedUserId,
  onUserChange,
  calendarSize = "large",
  onCalendarSizeChange,
}: CalendarHeaderProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isCurrentlyMobile } = useDevicePreference();
  const isMobile = isCurrentlyMobile;
  // Navigate to today
  const goToToday = () => {
    onDateChange(new Date());
  };

  // Navigate to previous period
  const goToPrevious = () => {
    if (currentView === "month") {
      onDateChange(subMonths(currentDate, 1));
    } else if (currentView === "week") {
      onDateChange(subWeeks(currentDate, 1));
    } else {
      onDateChange(subDays(currentDate, 1));
    }
  };

  // Navigate to next period
  const goToNext = () => {
    if (currentView === "month") {
      onDateChange(addMonths(currentDate, 1));
    } else if (currentView === "week") {
      onDateChange(addWeeks(currentDate, 1));
    } else {
      onDateChange(addDays(currentDate, 1));
    }
  };

  // Format the header title
  const getHeaderTitle = () => {
    if (currentView === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (currentView === "week") {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "MMMM d")} - ${format(end, "d, yyyy")}`;
      } else if (start.getFullYear() === end.getFullYear()) {
        return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
      } else {
        return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
      }
    } else {
      return format(currentDate, "EEEE, MMMM d, yyyy");
    }
  };

  return (
    <div className="border-b border-slate-200 p-2 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4">
        {/* Mobile View Header */}
        {isMobile ? (
          <>
            {/* Mobile Header - Simplified for mobile */}
            <div className="flex flex-col w-full gap-1.5">
              {/* Top row: Title and Add */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <h2 className="text-base font-medium">Kalender</h2>
                </div>
                <Button 
                  size="sm" 
                  onClick={onAddEvent}
                  className="h-7 px-2 rounded-md bg-primary text-white hover:bg-primary-600"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Ny</span>
                </Button>
              </div>
              
              {/* Second row: Navigation controls */}
              <div className="flex items-center justify-between gap-1">
                {/* Month Navigator */}
                <div className="flex items-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={goToPrevious}
                    className="h-7 w-7 p-0 rounded-md hover:bg-slate-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="px-2 py-1 text-xs font-medium rounded-md bg-primary-50 border border-primary-100 text-primary-700 text-center min-w-[80px]">
                    {format(currentDate, 'MMM yyyy')}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={goToNext}
                    className="h-7 w-7 p-0 rounded-md hover:bg-slate-100"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Today Button */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToToday}
                    className="h-7 px-2 text-xs font-medium text-slate-600"
                  >
                    I dag
                  </Button>
                  
                  {/* View Switcher */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2">
                        <CalendarIcon className="h-3 w-3 mr-1" />
                        <span className="text-xs capitalize">
                          {currentView === "month" ? "Måned" : currentView === "week" ? "Uke" : "Dag"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewChange("month")}>
                        Måned
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewChange("week")}>
                        Uke
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewChange("day")}>
                        Dag
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* User selector for admin and mini admin - Third row */}
              {(user?.isAdmin || user?.isMiniAdmin) && users && users.length > 0 && onUserChange && (
                <div className="flex justify-end mt-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2">
                        <Users className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs truncate max-w-[100px]">
                          {selectedUserId === user.id 
                            ? "Min kalender" 
                            : users.find(u => u.id === selectedUserId)?.name || "Bruker"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onUserChange(user.id)}>
                        Min kalender
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {users
                        .filter(u => u.id !== user.id)
                        .map(u => (
                          <DropdownMenuItem key={u.id} onClick={() => onUserChange(u.id)}>
                            {u.name}
                          </DropdownMenuItem>
                        ))
                      }
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Desktop View Header */
          <>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold">{t("calendar.title")}</h2>
              
              {/* User selection dropdown for admin and mini admin users */}
              {(user?.isAdmin || user?.isMiniAdmin) && users && users.length > 0 && onUserChange && (
                <div className="flex items-center ml-2">
                  <Select
                    value={selectedUserId?.toString() || user.id.toString()}
                    onValueChange={(value) => onUserChange(parseInt(value))}
                  >
                    <SelectTrigger className="h-9 w-[220px] pl-2 pr-1 text-sm bg-gray-50 border-gray-200">
                      <SelectValue placeholder="Velg bruker..." />
                      <Users className="h-4 w-4 ml-1 text-gray-400" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={user.id.toString()}>Min kalender</SelectItem>
                      {users
                        .filter(u => u.id !== user.id)
                        .map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>
                            {u.name} ({u.username})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {/* Desktop: Calendar navigation */}
            <div className="flex items-center justify-center space-x-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToPrevious}
                className="rounded-md hover:bg-slate-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="px-5 py-1.5 text-base font-semibold rounded-md bg-primary-50 border border-primary-100 text-primary-700 min-w-[160px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={goToNext}
                className="rounded-md hover:bg-slate-100"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Desktop: View controls and Add Event button */}
            <div className="flex items-center space-x-2">
              {/* Calendar Size Toggle */}
              {onCalendarSizeChange && (
                <div className="flex items-center border border-slate-300 rounded-md overflow-hidden">
                  <Button
                    variant={calendarSize === "large" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onCalendarSizeChange("large")}
                    className="px-2 py-1 text-xs rounded-none"
                  >
                    <Maximize2 className="h-3 w-3 mr-1" />
                    Stor
                  </Button>
                  <Button
                    variant={calendarSize === "compact" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onCalendarSizeChange("compact")}
                    className="px-2 py-1 text-xs rounded-none"
                  >
                    <Grid3X3 className="h-3 w-3 mr-1" />
                    Kompakt
                  </Button>
                </div>
              )}
              
              <div className="inline-flex border border-slate-300 rounded-md overflow-hidden">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={goToToday}
                  className="px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  I dag
                </Button>
                <Button 
                  variant={currentView === "month" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => onViewChange("month")}
                  className={`px-3 py-1 text-sm font-medium ${
                    currentView === "month" 
                      ? "bg-primary text-white" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Måned
                </Button>
                <Button 
                  variant={currentView === "week" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => onViewChange("week")}
                  className={`px-3 py-1 text-sm font-medium ${
                    currentView === "week" 
                      ? "bg-primary text-white" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Uke
                </Button>
                <Button 
                  variant={currentView === "day" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => onViewChange("day")}
                  className={`px-3 py-1 text-sm font-medium ${
                    currentView === "day" 
                      ? "bg-primary text-white" 
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Dag
                </Button>
              </div>
              <Button 
                size="icon" 
                onClick={onAddEvent}
                className="p-1.5 rounded-md bg-primary text-white hover:bg-primary-600"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
