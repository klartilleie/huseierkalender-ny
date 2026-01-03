import { useState, ReactNode } from "react";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Calendar, Menu } from "lucide-react";
import ICalModal from "./modals/ICalModal";
import logoImage from "@/assets/logo.png";
import { useDevicePreference } from "@/hooks/use-device-preference";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isICalModalOpen, setIsICalModalOpen] = useState(false);
  const { isCurrentlyMobile } = useDevicePreference();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onICalClick={() => setIsICalModalOpen(true)}
      />
      
      <div className="md:pl-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Mobile header with menu button - optimized for small screens */}
        <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center justify-between px-2 h-12">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="h-8 w-8 text-slate-600"
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-1 overflow-hidden">
              <img 
                src={logoImage} 
                alt="Smart Hjem AS Logo" 
                className="h-7 object-contain" 
              />
              {isCurrentlyMobile ? (
                <h1 className="text-base font-medium text-primary truncate max-w-[160px]">
                  Booking
                </h1>
              ) : (
                <h1 className="text-base font-medium text-primary truncate max-w-[160px]">
                  Bookingkalender
                </h1>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {/* Notification Bell - Only show when user is logged in */}
              {user && <NotificationBell />}
              
              {/* iCal button on mobile header for quick access */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsICalModalOpen(true)}
                className="h-8 w-8 text-slate-600"
                title="iCal innstillinger"
              >
                <Calendar className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
      
      {/* Modals */}
      <ICalModal isOpen={isICalModalOpen} onClose={() => setIsICalModalOpen(false)} />
    </div>
  );
}