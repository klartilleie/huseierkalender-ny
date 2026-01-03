import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Viser riktig flaggikon basert på valgt språk
  // Bruker bare Globe ikonet for nå, men kunne erstattet med flaggikoner
  const getLanguageIcon = () => {
    return <Globe className="h-5 w-5 text-yellow-400" />;
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
        {getLanguageIcon()}
      </div>

      {/* Utvidet meny */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 backdrop-blur-sm p-2 rounded-lg shadow-md border border-gray-700 z-50 min-w-[150px]">
          <div className="flex items-center justify-center mb-2">
            <Globe className="h-4 w-4 mr-1 text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400">Språk / Language</span>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant={language === "no" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setLanguage("no");
                setIsExpanded(false);
              }}
              className={`text-xs h-8 px-3 py-1 font-medium w-full justify-start ${language === "no" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-transparent text-yellow-400 hover:text-yellow-300 border-yellow-500"}`}
            >
              🇳🇴 Norsk
            </Button>
            <Button
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setLanguage("en");
                setIsExpanded(false);
              }}
              className={`text-xs h-8 px-3 py-1 font-medium w-full justify-start ${language === "en" ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-transparent text-yellow-400 hover:text-yellow-300 border-yellow-500"}`}
            >
              🇬🇧 English
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}