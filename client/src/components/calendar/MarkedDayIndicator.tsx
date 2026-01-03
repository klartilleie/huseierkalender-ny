import React from "react";
import { MarkedDay } from "@shared/schema";
import { isSameDay } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MarkedDayIndicatorProps {
  date: Date;
  markedDays: MarkedDay[];
  onClick: (markedDay: MarkedDay) => void;
}

export default function MarkedDayIndicator({ date, markedDays, onClick }: MarkedDayIndicatorProps) {
  // Filter marked days for the current date
  const daysForDate = markedDays.filter(markedDay => 
    isSameDay(new Date(markedDay.date), date)
  );

  if (daysForDate.length === 0) {
    return null;
  }

  return (
    <div className="flex mt-1 justify-center gap-1">
      {daysForDate.map((markedDay) => (
        <TooltipProvider key={markedDay.id}>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(markedDay);
                }}
                className="w-3 h-3 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300"
                style={{ backgroundColor: markedDay.color || "#8b5cf6" }}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div>
                <span className="font-medium">{markedDay.markerType}</span>
                {markedDay.notes && <p className="text-xs text-muted-foreground">{markedDay.notes}</p>}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}