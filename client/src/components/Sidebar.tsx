import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar, Settings, User, Link as LinkIcon, X, LogOut, Users, Phone, Mail, Clock, MessageSquare, Globe, DollarSign, Handshake } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@/assets/logo.png";
import { useDevicePreference } from "@/hooks/use-device-preference";
import { useLanguage } from "@/hooks/use-language";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onICalClick: () => void;
}

export default function Sidebar({ isOpen, onClose, onICalClick }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { isCurrentlyMobile } = useDevicePreference();
  const { language, setLanguage, t } = useLanguage();
  const isMobile = isCurrentlyMobile;

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const sidebarClass = `fixed inset-y-0 left-0 z-50 w-64 transform ${
    isOpen ? "translate-x-0" : "-translate-x-full"
  } transition-transform duration-300 ease-in-out md:translate-x-0 bg-white border-r border-slate-200 flex flex-col`;

  const isActive = (path: string) => location === path;

  return (
    <div className={sidebarClass}>
      {/* Header - more compact for mobile */}
      <div className="py-2 px-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={logoImage} 
              alt="Smart Hjem AS Logo" 
              className={isMobile ? "h-8" : "h-10"} 
            />
            <h1 className={`font-medium ${isMobile ? "text-base" : "text-lg"} text-primary`}>
              {isMobile ? "Booking" : "Bookingkalender"}
            </h1>
          </div>
          <button 
            className="md:hidden text-slate-500 hover:text-slate-700"
            onClick={onClose}
            aria-label="Lukk meny"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* User Profile - simplified for mobile */}
      {user && (
        <div className={`${isMobile ? "p-2" : "p-3"} border-b border-slate-200`}>
          <div className="flex items-center space-x-2 mb-2">
            <div className={`${isMobile ? "h-8 w-8" : "h-10 w-10"} rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className={`font-medium ${isMobile ? "text-xs" : "text-sm"}`}>{user.name}</p>
              <p className={`${isMobile ? "text-[10px]" : "text-xs"} text-slate-500`}>{user.email}</p>
            </div>
          </div>
          

        </div>
      )}
      
      {/* Navigation - optimized spacing for mobile */}
      <nav className={`flex-1 ${isMobile ? "p-2 space-y-0.5" : "p-4 space-y-1"} overflow-y-auto`}>
        <Button
          variant={isActive("/") ? "secondary" : "ghost"}
          className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${isActive("/") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
          onClick={() => {
            setLocation("/");
            onClose();
          }}
        >
          <Calendar className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
          <span className={isMobile ? "text-sm" : ""}>{t("nav.calendar")}</span>
        </Button>
        

        
        {/* Kundeservice-knapp midlertidig fjernet */}

        {/* Payouts for regular users */}
        <Button
          variant={isActive("/payouts") ? "secondary" : "ghost"}
          className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${isActive("/payouts") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
          onClick={() => {
            setLocation("/payouts");
            onClose();
          }}
        >
          <DollarSign className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
          <span className={isMobile ? "text-sm" : ""}>Utbetalinger</span>
        </Button>
        
        {/* User Agreements */}
        {!user?.isAdmin && !user?.isMiniAdmin && (
          <Button
            variant={location.startsWith("/user/agreements") ? "secondary" : "ghost"}
            className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${location.startsWith("/user/agreements") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
            onClick={() => {
              setLocation("/user/agreements");
              onClose();
            }}
          >
            <Handshake className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
            <span className={isMobile ? "text-sm" : ""}>Mine avtaler</span>
          </Button>
        )}
        
        {/* Standard user options */}
        <Button
          variant={isActive("/prices") ? "secondary" : "ghost"}
          className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${isActive("/prices") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
          onClick={() => {
            setLocation("/prices");
            onClose();
          }}
        >
          <DollarSign className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
          <span className={isMobile ? "text-sm" : ""}>{user?.isAdmin ? t("nav.pricesAdmin") : t("nav.prices")}</span>
        </Button>

        <Button
          variant={isActive("/settings") ? "secondary" : "ghost"}
          className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${isActive("/settings") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
          onClick={() => {
            setLocation("/settings");
            onClose();
          }}
        >
          <Settings className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
          <span className={isMobile ? "text-sm" : ""}>{t("nav.settings")}</span>
        </Button>
        
        {/* Language Switcher */}
        <Button
          variant="ghost"
          className={`w-full justify-start text-slate-600 hover:bg-slate-100 transition ${isMobile ? "h-9 py-1" : ""}`}
          onClick={() => {
            setLanguage(language === "no" ? "en" : "no");
            onClose();
          }}
        >
          <Globe className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
          <span className={isMobile ? "text-sm" : ""}>{language === "no" ? "English" : "Norsk"}</span>
        </Button>
        
        {/* Admin-only section */}
        {(user?.isAdmin || user?.isMiniAdmin) && (
          <>
            <div className={`${isMobile ? "pt-2 pb-1" : "pt-4 pb-2"}`}>
              <p className={`px-2 ${isMobile ? "text-[10px]" : "text-xs"} font-semibold text-slate-500 uppercase tracking-wider`}>
{t("nav.adminTools")}
              </p>
            </div>
            
            <Button
              variant="ghost"
              className={`w-full justify-start text-slate-600 hover:bg-slate-100 transition ${isMobile ? "h-9 py-1" : ""}`}
              onClick={() => {
                setLocation("/admin");
                onClose();
              }}
            >
              <User className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
              <span className={isMobile ? "text-sm" : ""}>{t("nav.users")}</span>
            </Button>
            
            
            <Button
              variant={location.startsWith("/admin/agreements") ? "secondary" : "ghost"}
              className={`w-full justify-start ${isMobile ? "h-9 py-1" : ""} ${location.startsWith("/admin/agreements") ? "bg-primary-50 text-primary font-medium" : "text-slate-600"}`}
              onClick={() => {
                setLocation("/admin/agreements");
                onClose();
              }}
            >
              <Handshake className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
              <span className={isMobile ? "text-sm" : ""}>Admin avtaler</span>
            </Button>
          </>
        )}
      </nav>
      
      {/* Contact and Logout - more compact for mobile */}
      <div className={`${isMobile ? "p-2 space-y-1.5" : "p-4 space-y-2"} border-t border-slate-200`}>
        {/* Contact card - optimized for mobile */}
        <div className={`mb-2 rounded-md bg-primary/5 ${isMobile ? "p-2" : "p-3"} border border-primary/20`}>
          <h3 className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-primary mb-1`}>Kundeservice</h3>
          
          <div className="flex flex-col space-y-1">
            <a 
              href="tel:47714646" 
              className="flex items-center font-medium hover:underline text-slate-700"
              onClick={isMobile ? onClose : undefined}
            >
              <Phone className={`${isMobile ? "h-3 w-3 mr-1.5" : "h-4 w-4 mr-2"}`} />
              <span className={`${isMobile ? "text-xs" : "text-sm"}`}>477 14 646</span>
            </a>
            
            <div className="flex items-center text-slate-700">
              <Clock className={`${isMobile ? "h-3 w-3 mr-1.5" : "h-3.5 w-3.5 mr-2"}`} />
              <span className={`${isMobile ? "text-[10px]" : "text-xs"}`}>Man-Fre: 09:00-16:00</span>
            </div>
          </div>
        </div>
        
        {/* Email and logout */}
        <div className="flex flex-col space-y-1.5">
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "default"}
            className={`w-full justify-start text-slate-600 hover:bg-slate-100 transition ${isMobile ? "h-8" : ""}`}
            onClick={() => {
              window.location.href = "mailto:kundeservice@smarthjem.as";
              if (isMobile) onClose();
            }}
          >
            <Mail className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
            <span className={isMobile ? "text-sm" : ""}>Kontakt Kundeservice</span>
          </Button>
          
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "default"}
            className={`w-full justify-start text-slate-600 hover:bg-slate-100 transition ${isMobile ? "h-8" : ""}`}
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className={`${isMobile ? "mr-2 h-4 w-4" : "mr-3 h-5 w-5"}`} />
            <span className={isMobile ? "text-sm" : ""}>{logoutMutation.isPending ? "Logger ut..." : "Logg ut"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
