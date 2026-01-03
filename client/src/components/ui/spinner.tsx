import React from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock, RefreshCw } from "lucide-react";

type SpinnerVariant = "calendar" | "clock" | "refresh" | "dots";
type SpinnerSize = "sm" | "md" | "lg" | "xl";

interface SpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
  text?: string;
}

export function Spinner({ 
  variant = "calendar", 
  size = "md", 
  className, 
  text 
}: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg"
  };

  const iconClass = `${sizeClasses[size]} animate-spin text-primary`;
  
  const getIconByVariant = () => {
    switch (variant) {
      case "calendar":
        return <Calendar className={cn(iconClass, "animate-pulse")} />
      case "clock":
        return <Clock className={iconClass} />
      case "refresh":
        return <RefreshCw className={iconClass} />
      case "dots":
        return (
          <div className={cn("flex gap-1", sizeClasses[size])}>
            <div className={`rounded-full bg-primary ${size === "sm" ? "h-1 w-1" : "h-2 w-2"} animate-bounce`} style={{ animationDelay: "0ms" }}></div>
            <div className={`rounded-full bg-primary ${size === "sm" ? "h-1 w-1" : "h-2 w-2"} animate-bounce`} style={{ animationDelay: "150ms" }}></div>
            <div className={`rounded-full bg-primary ${size === "sm" ? "h-1 w-1" : "h-2 w-2"} animate-bounce`} style={{ animationDelay: "300ms" }}></div>
          </div>
        )
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      {variant === "calendar" ? (
        <div className="relative">
          <Calendar className={cn(sizeClasses[size], "text-primary")} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-${size === "sm" ? "1" : size === "md" ? "2" : "3"} w-${size === "sm" ? "1" : size === "md" ? "2" : "3"} rounded-full bg-primary animate-ping`}></div>
          </div>
        </div>
      ) : (
        getIconByVariant()
      )}
      {text && <p className={cn("text-slate-600 font-medium", textSizeClasses[size])}>{text}</p>}
    </div>
  );
}

// Animated calendar page flip
export function CalendarFlipSpinner({ 
  size = "md", 
  className, 
  text 
}: Omit<SpinnerProps, "variant">) {
  const sizeClasses = {
    sm: { outer: "h-6 w-6", inner: "h-4 w-4" },
    md: { outer: "h-8 w-8", inner: "h-6 w-6" },
    lg: { outer: "h-12 w-12", inner: "h-9 w-9" },
    xl: { outer: "h-16 w-16", inner: "h-12 w-12" }
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg"
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className={cn("relative flex items-center justify-center border-2 border-primary rounded-md", sizeClasses[size].outer)}>
        {/* Calendar top bar */}
        <div className="absolute top-0 left-0 right-0 h-1/4 bg-primary rounded-t-sm"></div>
        
        {/* Flipping page */}
        <div className={cn(
          "absolute bg-white border border-slate-300", 
          sizeClasses[size].inner,
          "animate-[flip_1.5s_ease-in-out_infinite]"
        )}
        style={{
          transformOrigin: "center right",
          boxShadow: "0 0 5px rgba(0,0,0,0.1)"
        }}
        ></div>
      </div>
      {text && <p className={cn("text-slate-600 font-medium", textSizeClasses[size])}>{text}</p>}
    </div>
  );
}

// Loading spinner with date numbers
export function DateSpinner({ 
  size = "md", 
  className, 
  text 
}: Omit<SpinnerProps, "variant">) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-xl"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
    xl: "text-lg"
  };

  // Generate dates 1-31
  const dates = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className="relative">
        <div className={cn("grid grid-cols-7 gap-0.5 p-1 border border-primary rounded bg-white", {
          "w-16": size === "sm",
          "w-20": size === "md",
          "w-24": size === "lg",
          "w-32": size === "xl",
        })}>
          {dates.map((date, index) => (
            <div 
              key={date}
              className={cn(
                "flex items-center justify-center aspect-square rounded-full", 
                sizeClasses[size],
                date % 7 === 0 ? "text-primary animate-pulse" : "text-slate-600",
                {
                  "font-bold": new Date().getDate() === date,
                  "bg-primary text-white": new Date().getDate() === date
                }
              )}
            >
              {date}
            </div>
          ))}
        </div>
        
        {/* Animated dot */}
        <div 
          className={cn("absolute rounded-full bg-primary animate-ping", {
            "h-1 w-1": size === "sm",
            "h-1.5 w-1.5": size === "md",
            "h-2 w-2": size === "lg",
            "h-3 w-3": size === "xl"
          })}
          style={{
            top: "40%",
            left: "40%"
          }}
        ></div>
      </div>
      {text && <p className={cn("text-slate-600 font-medium", textSizeClasses[size])}>{text}</p>}
    </div>
  );
}