import { createContext, useState, useContext, ReactNode, useEffect } from "react";

export type DeviceViewType = "auto" | "mobile" | "desktop";

interface DevicePreferenceContextType {
  devicePreference: DeviceViewType;
  setDevicePreference: (preference: DeviceViewType) => void;
  isCurrentlyMobile: boolean;
}

const DevicePreferenceContext = createContext<DevicePreferenceContextType | null>(null);

export const DevicePreferenceProvider = ({ children }: { children: ReactNode }) => {
  const [devicePreference, setDevicePreference] = useState<DeviceViewType>(() => {
    // Check localStorage for saved preference, use auto as default
    const savedPreference = localStorage.getItem("devicePreference") as DeviceViewType;
    return (savedPreference === "mobile" || savedPreference === "desktop") ? savedPreference : "auto";
  });

  // Determine if we're currently on a mobile device
  const [isCurrentlyMobile, setIsCurrentlyMobile] = useState(false);

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem("devicePreference", devicePreference);
  }, [devicePreference]);

  useEffect(() => {
    // Detect actual device type using media query
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    
    const updateCurrentDeviceType = () => {
      // If preference is auto, follow the media query
      // Otherwise use the forced preference
      if (devicePreference === "auto") {
        setIsCurrentlyMobile(mediaQuery.matches);
      } else {
        setIsCurrentlyMobile(devicePreference === "mobile");
      }
    };

    // Initial check
    updateCurrentDeviceType();

    // Update when viewport size changes
    const handleChange = () => {
      updateCurrentDeviceType();
    };

    // Add listener for changes
    mediaQuery.addEventListener("change", handleChange);
    
    // Clean up
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [devicePreference]);

  return (
    <DevicePreferenceContext.Provider value={{ devicePreference, setDevicePreference, isCurrentlyMobile }}>
      {children}
    </DevicePreferenceContext.Provider>
  );
};

export const useDevicePreference = () => {
  const context = useContext(DevicePreferenceContext);
  if (!context) {
    throw new Error("useDevicePreference must be used within a DevicePreferenceProvider");
  }
  return context;
};