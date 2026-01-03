import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventFormSchema, InsertEvent, User } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  // La admin opprette hendelser direkte på en brukers kalender
  targetUserId?: number | null;
}

// Color options removed - using fixed red color #ef4444

export default function AddEventModal({ isOpen, onClose, initialDate = new Date(), targetUserId = null }: AddEventModalProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(targetUserId);
  const [isAllDay, setIsAllDay] = useState<boolean>(false); // Fjernet i UI men trengs fortsatt i modellen
  
  // Hent alle brukere hvis admin
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: currentUser?.isAdmin === true,
  });
  
  // Sett opp defaultvalue for brukervelger
  useEffect(() => {
    if (currentUser?.isAdmin && !selectedUserId) {
      // Hvis vi har en targetUserId, bruk den, ellers bruk admin sin egen ID
      setSelectedUserId(targetUserId ?? currentUser.id);
    }
  }, [currentUser, targetUserId]);
  
  // Format date for the form
  const formattedDate = format(initialDate, "yyyy-MM-dd");
  
  // Set fixed start time to 11:00
  const startTime = new Date(initialDate);
  startTime.setHours(11, 0, 0);
  const formattedTime = "11:00";
  
  // Set fixed end time to 15:00
  const endTime = new Date(initialDate);
  endTime.setHours(15, 0, 0);
  const formattedEndTime = "15:00";

  // Set up form with validation - using red as fixed color
  const form = useForm<z.infer<typeof eventFormSchema>>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "Eiersperre tid",
      description: "",
      startTime: startTime,
      endTime: endTime,
      allDay: false, // Aldri null, alltid false som default
      color: "#ef4444", // Red color fixed for all events
      routes: [], // Empty array instead of null
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      console.log("Creating event with data:", data);
      try {
        // Velg riktig endepunkt basert på admin-rollen og valgt bruker
        let endpoint = "/api/events";
        
        // Hvis admin og har valgt en annen bruker enn seg selv
        if (currentUser?.isAdmin && selectedUserId && selectedUserId !== currentUser.id) {
          endpoint = `/api/admin/user-events/${selectedUserId}`;
          console.log(`Admin creates event for user with ID ${selectedUserId}`);
        }
        
        // Send til riktig endepunkt med ekstra feilhåndtering
        try {
          const res = await apiRequest("POST", endpoint, data);
          
          // Sjekk om responsen er OK
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: 'Ukjent serverfeil' }));
            throw new Error(errorData.message || 'Feil ved oppretting av hendelse');
          }
          
          const jsonData = await res.json();
          console.log("Event created successfully, response:", jsonData);
          return jsonData;
        } catch (fetchError) {
          console.error("Fetch error during event creation:", fetchError);
          throw new Error(fetchError instanceof Error ? fetchError.message : 'Nettverksfeil ved oppretting av hendelse');
        }
      } catch (error) {
        console.error("Error creating event:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Event creation mutation succeeded");
      // Oppdater flere queries for å sikre at alle visninger oppdateres
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feed-events"] });
      
      // Hvis vi er admin og ser på en annen brukers kalender, oppdater også den
      if (currentUser?.isAdmin && selectedUserId && selectedUserId !== currentUser.id) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/admin/user-calendar", selectedUserId] 
        });
      }
      
      toast({
        title: "Hendelse opprettet",
        description: currentUser?.isAdmin && selectedUserId && selectedUserId !== currentUser.id
          ? "Hendelsen har blitt lagret på brukerens kalender."
          : "Hendelsen har blitt lagret.",
      });
      onClose();
    },
    onError: (error: Error) => {
      console.error("Event creation mutation failed:", error);
      toast({
        title: "Kunne ikke opprette hendelse",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof eventFormSchema>) => {
    console.log("Form submitted with data:", data);
    console.log("Form state:", form.formState);
    
    try {
      // Sjekk og fiks validation errors
      if (Object.keys(form.formState.errors).length > 0) {
        console.error("Form validation errors:", form.formState.errors);
        toast({
          title: "Valideringsfeil",
          description: "Vennligst fyll ut alle påkrevde felt korrekt",
          variant: "destructive",
        });
        return;
      }
    
      // Construct date objects from form inputs
      const startDate = new Date(form.getValues("startTime"));
      const endDate = data.endTime ? new Date(data.endTime) : new Date(startDate);
      
      // Sjekk at datoobjektene er gyldige
      if (isNaN(startDate.getTime())) {
        console.error("Invalid start date:", startDate);
        toast({
          title: "Ugyldig startdato",
          description: "Vennligst velg en gyldig dato",
          variant: "destructive",
        });
        return;
      }
      
      if (endDate && isNaN(endDate.getTime())) {
        console.error("Invalid end date:", endDate);
        toast({
          title: "Ugyldig sluttdato",
          description: "Vennligst velg en gyldig dato",
          variant: "destructive",
        });
        return;
      }
      
      // Sett alltid faste tider
      startDate.setHours(11, 0, 0);
      endDate.setHours(15, 0, 0);
      
      console.log("Processed dates - start:", startDate, "end:", endDate);
      
      // Prepare data for API - always set color to red
      const eventData: InsertEvent = {
        ...data,
        startTime: startDate,
        endTime: endDate,
        allDay: isAllDay,
        color: "#ef4444", // Ensure red color is always set
        routes: data.routes || [], // Sikre at routes alltid er et array
        source: data.source || undefined, // Sørg for at source er riktig format
      };
      
      console.log("Submitting event data:", eventData);
      createEventMutation.mutate(eventData);
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Feil ved sending av skjema",
        description: error instanceof Error ? error.message : "Ukjent feil",
        variant: "destructive",
      });
    }
  };

  // Toggle all-day event
  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    form.setValue("allDay", checked);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="add-event-description">
        <DialogHeader>
          <DialogTitle>Legg til ny hendelse</DialogTitle>
          <p id="add-event-description" className="text-sm text-muted-foreground mt-1">
            Du kan opprette hendelser over flere dager ved å velge forskjellige verdier for fra-dato og til-dato.
          </p>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tittel</FormLabel>
                  <FormControl>
                    <Input placeholder="Eiersperre tid" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Brukervelger - kun synlig for administrator */}
            {currentUser?.isAdmin && (
              <div className="mb-4">
                <Label htmlFor="user-select">Velg bruker for hendelsen</Label>
                <Select 
                  value={selectedUserId ? String(selectedUserId) : String(currentUser.id)}
                  onValueChange={(value) => setSelectedUserId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Velg bruker" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name || user.username} {user.id === currentUser.id && "(Meg)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* "Hele dagen"-alternativet fjernet som forespurt */}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Fra dato</Label>
                <Input 
                  type="date" 
                  id="startDate" 
                  defaultValue={formattedDate}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    const currentStartTime = new Date(form.getValues("startTime"));
                    date.setHours(currentStartTime.getHours(), currentStartTime.getMinutes());
                    form.setValue("startTime", date);
                    
                    // Hvis sluttdato er før startdato, sett sluttdato lik startdato
                    const endDate = form.getValues("endTime");
                    if (endDate && date > endDate) {
                      form.setValue("endTime", date);
                    }
                  }}
                />
              </div>
              
              <div>
                <Label htmlFor="endDate">Til dato</Label>
                <Input 
                  type="date" 
                  id="endDate" 
                  defaultValue={formattedDate}
                  onChange={(e) => {
                    // Sikker håndtering av datum
                    if (e.target.value) {
                      const date = new Date(e.target.value);
                      // Fast tid, alltid 15:00
                      date.setHours(15, 0, 0);
                      form.setValue("endTime", date);
                    }
                  }}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Starttid (Fast tid)</Label>
                <Input 
                  type="time" 
                  id="startTime" 
                  value={formattedTime}
                  readOnly
                  disabled
                  className="bg-slate-100"
                />
              </div>
              
              <div>
                <Label htmlFor="endTime">Sluttid (Fast tid)</Label>
                <Input 
                  type="time" 
                  id="endTime" 
                  value={formattedEndTime}
                  readOnly
                  disabled
                  className="bg-slate-100"
                />
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beskrivelse</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Skriv inn beskrivelse av hendelsen" 
                      className="h-24"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Routes selection and color selection removed */}
            
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Avbryt
              </Button>
              <Button 
                type="submit"
                disabled={createEventMutation.isPending}
              >
                {createEventMutation.isPending ? "Lagrer..." : "Lagre hendelse"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
