import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CalendarIcon, Copy, Share } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { nb } from 'date-fns/locale';

interface CollaborativeEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: Date;
}

export default function CollaborativeEventModal({
  open,
  onOpenChange,
  date
}: CollaborativeEventModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultDate = date || new Date();
  const defaultStartTime = new Date(defaultDate);
  defaultStartTime.setHours(11, 0, 0, 0); // 11:00
  const defaultEndTime = new Date(defaultDate);
  defaultEndTime.setHours(15, 0, 0, 0); // 15:00

  const form = useForm({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      allDay: false,
    },
  });

  const handleSubmit = async (data: any) => {
    setIsCreating(true);
    try {
      const response = await apiRequest("POST", "/api/collaborative-events", data);
      
      if (!response.ok) {
        throw new Error("Failed to create collaborative event");
      }
      
      const event = await response.json();
      setCreatedEvent(event);
      
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-events"] });
      
      toast({
        title: "Arrangement opprettet",
        description: "Samarbeidsarrangementet er opprettet. Du kan nå dele det med andre.",
      });
    } catch (error) {
      console.error("Error creating collaborative event:", error);
      toast({
        title: "Feil ved oppretting",
        description: "Kunne ikke opprette samarbeidsarrangementet. Vennligst prøv igjen.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyShareLink = () => {
    if (!createdEvent) return;
    
    const shareLink = `${window.location.origin}/collaborate/${createdEvent.collaborationCode}`;
    navigator.clipboard.writeText(shareLink);
    
    toast({
      title: "Lenke kopiert",
      description: "Delings-lenken er kopiert til utklippstavlen.",
    });
  };
  
  const resetForm = () => {
    setCreatedEvent(null);
    form.reset({
      title: "",
      description: "",
      startTime: defaultStartTime,
      endTime: defaultEndTime,
      allDay: false,
    });
  };

  const closeAndReset = () => {
    onOpenChange(false);
    setTimeout(resetForm, 200); // Reset after dialog closes
  };

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {createdEvent ? "Samarbeidsarrangement opprettet" : "Nytt samarbeidsarrangement"}
          </DialogTitle>
          <DialogDescription>
            {createdEvent 
              ? "Kopier lenken nedenfor for å dele arrangementet med andre deltakere." 
              : "Opprett et nytt arrangement som flere kan samarbeide om."}
          </DialogDescription>
        </DialogHeader>

        {createdEvent ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <h3 className="font-semibold">{createdEvent.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {format(new Date(createdEvent.startTime), "PPP", { locale: nb })}
                {" "}
                {format(new Date(createdEvent.startTime), "HH:mm")}
                {" - "}
                {format(new Date(createdEvent.endTime), "HH:mm")}
              </p>
              {createdEvent.description && (
                <p className="mt-2 text-sm">{createdEvent.description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Input 
                  readOnly
                  value={`${window.location.origin}/collaborate/${createdEvent.collaborationCode}`}
                  className="pr-10"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={copyShareLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={copyShareLink} size="sm">
                <Share className="h-4 w-4 mr-2" />
                Del
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tittel</FormLabel>
                    <FormControl>
                      <Input placeholder="Angi arrangement tittel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Startdato</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: nb })
                              ) : (
                                <span>Velg en dato</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                const newDate = new Date(date);
                                const currentTime = field.value ? field.value : new Date();
                                
                                newDate.setHours(
                                  currentTime.getHours(),
                                  currentTime.getMinutes(),
                                  0,
                                  0
                                );
                                
                                field.onChange(newDate);
                              }
                            }}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starttid</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value ? format(field.value, "HH:mm") : "11:00"}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            const newDate = new Date(field.value);
                            newDate.setHours(hours, minutes, 0, 0);
                            field.onChange(newDate);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Sluttdato</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: nb })
                              ) : (
                                <span>Velg en dato</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              if (date) {
                                const newDate = new Date(date);
                                const currentTime = field.value ? field.value : new Date();
                                
                                newDate.setHours(
                                  currentTime.getHours(),
                                  currentTime.getMinutes(),
                                  0,
                                  0
                                );
                                
                                field.onChange(newDate);
                              }
                            }}
                            disabled={(date) => {
                              const startTime = form.getValues("startTime");
                              return date < new Date(new Date(startTime).setHours(0, 0, 0, 0));
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sluttid</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value ? format(field.value, "HH:mm") : "15:00"}
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":").map(Number);
                            const newDate = new Date(field.value);
                            newDate.setHours(hours, minutes, 0, 0);
                            field.onChange(newDate);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beskrivelse</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Legg til detaljer for arrangementet"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAndReset}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Oppretter..." : "Opprett arrangement"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {createdEvent && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAndReset}>
              Lukk
            </Button>
            <Button type="button" onClick={resetForm}>
              Opprett nytt arrangement
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}