import { Button } from "@/components/ui/button";
import { useDevicePreference } from "@/hooks/use-device-preference";
import { Smartphone, Monitor, Laptop } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DeviceViewSelector() {
  const { devicePreference, setDevicePreference } = useDevicePreference();
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Ikoner som vises basert på valgt enhet
  const getDeviceIcon = () => {
    switch (devicePreference) {
      case "mobile":
        return <Smartphone className="h-5 w-5 text-yellow-400" />;
      case "desktop":
        return <Monitor className="h-5 w-5 text-yellow-400" />;
      default:
        return <Laptop className="h-5 w-5 text-yellow-400" />;
    }
  };

  // Legger til event listener for å lukke menyen når man klikker utenfor
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    // Legg til event listener når menyen er åpen
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // Fjern event listener når komponenten unmountes eller menyen lukkes
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  return (
    <div 
      ref={menuRef}
      className="relative bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-700"
    >
      {/* Alltid synlig ikon */}
      <div 
        className="flex items-center justify-center p-2 cursor-pointer" 
        onClick={toggleExpanded}
      >
        {getDeviceIcon()}
      </div>

      {/* Utvidet meny */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 backdrop-blur-sm p-2 rounded-lg shadow-md border border-gray-700 z-50 min-w-[180px]">
          <div className="flex items-center justify-center mb-2">
            <Laptop className="h-4 w-4 mr-1 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">Enhetsvisning</span>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant={devicePreference === "auto" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDevicePreference("auto");
                setIsExpanded(false);
              }}
              className={`text-xs h-8 px-3 py-1 font-medium w-full justify-start ${devicePreference === "auto" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-transparent text-yellow-400 hover:text-yellow-300 border-yellow-500"}`}
            >
              <Laptop className={`h-3.5 w-3.5 mr-2 ${devicePreference === "auto" ? "text-black" : ""}`} />
              Auto
            </Button>
            <Button
              variant={devicePreference === "mobile" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDevicePreference("mobile");
                setIsExpanded(false);
              }}
              className={`text-xs h-8 px-3 py-1 font-medium flex items-center w-full justify-start ${devicePreference === "mobile" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-transparent text-yellow-400 hover:text-yellow-300 border-yellow-500"}`}
            >
              <Smartphone className={`h-3.5 w-3.5 mr-2 ${devicePreference === "mobile" ? "text-black" : ""}`} />
              Mobil
            </Button>
            <Button
              variant={devicePreference === "desktop" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDevicePreference("desktop");
                setIsExpanded(false);
              }}
              className={`text-xs h-8 px-3 py-1 font-medium flex items-center w-full justify-start ${devicePreference === "desktop" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-transparent text-yellow-400 hover:text-yellow-300 border-yellow-500"}`}
            >
              <Monitor className={`h-3.5 w-3.5 mr-2 ${devicePreference === "desktop" ? "text-black" : ""}`} />
              PC
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}