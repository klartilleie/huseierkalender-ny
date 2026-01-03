import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { InsertMarkedDay, markedDayFormSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface MarkDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  existingMarkedDay?: {
    id: number;
    date: Date;
    markerType: string;
    color: string;
    notes?: string;
  };
}

const markerTypes = [
  { value: "busy", label: "Busy" },
  { value: "vacation", label: "Vacation" },
  { value: "holiday", label: "Holiday" },
  { value: "other", label: "Other" },
];

const colorOptions = [
  { value: "#8b5cf6", label: "Purple" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Green" },
  { value: "#f59e0b", label: "Yellow" },
  { value: "#ef4444", label: "Red" },
  { value: "#6b7280", label: "Gray" },
];

export default function MarkDayModal({ 
  isOpen, 
  onClose, 
  initialDate = new Date(),
  existingMarkedDay
}: MarkDayModalProps) {
  const { toast } = useToast();
  const isEditing = Boolean(existingMarkedDay);
  
  const form = useForm<InsertMarkedDay>({
    resolver: zodResolver(markedDayFormSchema),
    defaultValues: {
      date: existingMarkedDay?.date || initialDate,
      markerType: existingMarkedDay?.markerType || "busy",
      color: existingMarkedDay?.color || "#8b5cf6",
      notes: existingMarkedDay?.notes || ""
    }
  });

  // Create marked day mutation
  const createMarkedDayMutation = useMutation({
    mutationFn: async (data: InsertMarkedDay) => {
      const res = await apiRequest("POST", "/api/marked-days", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marked-days"] });
      toast({
        title: "Day marked",
        description: "The day has been successfully marked in your calendar.",
      });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark day",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update marked day mutation
  const updateMarkedDayMutation = useMutation({
    mutationFn: async (data: InsertMarkedDay) => {
      const res = await apiRequest(
        "PUT", 
        `/api/marked-days/${existingMarkedDay?.id}`, 
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marked-days"] });
      toast({
        title: "Mark updated",
        description: "The day mark has been successfully updated.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update mark",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertMarkedDay) => {
    // Format the date properly
    const formattedData = {
      ...data,
      date: new Date(data.date)
    };

    if (isEditing && existingMarkedDay) {
      updateMarkedDayMutation.mutate(formattedData);
    } else {
      createMarkedDayMutation.mutate(formattedData);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Marked Day" : "Mark Calendar Day"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={format(new Date(field.value), "yyyy-MM-dd")}
                      onChange={(e) => {
                        field.onChange(new Date(e.target.value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="markerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marker Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a marker type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {markerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex space-x-2 items-center">
                    <div 
                      className="w-6 h-6 rounded-full" 
                      style={{ backgroundColor: field.value || "#8b5cf6" }}
                    />
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value || "#8b5cf6"}
                    >
                      <FormControl>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {colorOptions.map((color) => (
                          <SelectItem 
                            key={color.value} 
                            value={color.value}
                            className="flex items-center"
                          >
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: color.value }} 
                              />
                              <span>{color.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any additional notes here..." 
                      className="resize-none" 
                      rows={3}
                      {...field}
                      // Fix for the null value TypeScript error
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createMarkedDayMutation.isPending || updateMarkedDayMutation.isPending}
              >
                {createMarkedDayMutation.isPending || updateMarkedDayMutation.isPending
                  ? "Saving..."
                  : isEditing 
                    ? "Update" 
                    : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}