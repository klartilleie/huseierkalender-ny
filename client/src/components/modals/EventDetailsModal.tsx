import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Event, IcalEventNote } from "@shared/schema";
import { Calendar, Clock, Trash2, Edit, AlertTriangle, PenLine, Save, Globe, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/lib/translation-service";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import AddEventModal from "./AddEventModal";

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
}

export default function EventDetailsModal({ isOpen, onClose, event }: EventDetailsModalProps) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [existingNoteId, setExistingNoteId] = useState<number | null>(null);
  
  // Translation state
  const {
    isTranslating,
    translatedText,
    error: translationError,
    translate,
    resetTranslation,
    isTranslated
  } = useTranslation(event.description);

  // Determine if this is an external event (from iCal feed)
  const isExternalEvent = String(event.id).startsWith('ical-');
  
  // Extract the external event ID for iCal events
  const eventExternalId = isExternalEvent ? String(event.id) : "";
  
  // Safely access source information with type checking
  const sourceInfo = isExternalEvent && event.source && 
    typeof event.source === 'object' ? 
    (event.source as any) : 
    null;
    
  // Tillatelseskontroller for å avgjøre hvem som kan gjøre hva med denne hendelsen
  const isAdmin = user?.isAdmin === true;
  const isOwnEvent = user?.id === event.userId;
  const canEdit = !isExternalEvent && (isOwnEvent || isAdmin);
  const canDelete = !isExternalEvent && (isOwnEvent || isAdmin);
  
  // Fetch existing note for this iCal event
  const { data: eventNote, isLoading: isLoadingNote } = useQuery<IcalEventNote>({
    queryKey: [`/api/ical-event-notes/event/${eventExternalId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isExternalEvent && eventExternalId !== "",
    retry: false,
    // We'll catch 404s (note not found) in the useEffect, not with onError
    // Removing onError as it's causing TypeScript errors with TanStack Query v5
  });
  
  // Set notes from the fetched data
  useEffect(() => {
    if (eventNote && 'notes' in eventNote && 'id' in eventNote) {
      setNotes(eventNote.notes);
      setExistingNoteId(eventNote.id);
    }
  }, [eventNote]);
  
  // Create a new note
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ical-event-notes", {
        eventExternalId,
        notes
      });
      return await res.json();
    },
    onSuccess: (data: IcalEventNote) => {
      queryClient.invalidateQueries({ queryKey: [`/api/ical-event-notes/event/${eventExternalId}`] });
      setExistingNoteId(data.id);
      setIsEditingNotes(false);
      toast({
        title: "Note saved",
        description: "Your note has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save note",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Update an existing note
  const updateNoteMutation = useMutation({
    mutationFn: async () => {
      if (!existingNoteId) return null;
      const res = await apiRequest("PUT", `/api/ical-event-notes/${existingNoteId}`, {
        notes
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ical-event-notes/event/${eventExternalId}`] });
      setIsEditingNotes(false);
      toast({
        title: "Note updated",
        description: "Your note has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update note",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Delete a note
  const deleteNoteMutation = useMutation({
    mutationFn: async () => {
      if (!existingNoteId) return null;
      await apiRequest("DELETE", `/api/ical-event-notes/${existingNoteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ical-event-notes/event/${eventExternalId}`] });
      setNotes("");
      setExistingNoteId(null);
      setIsEditingNotes(false);
      toast({
        title: "Note deleted",
        description: "Your note has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete note",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const handleSaveNotes = () => {
    if (existingNoteId) {
      updateNoteMutation.mutate();
    } else {
      createNoteMutation.mutate();
    }
  };
  
  const handleToggleEditNotes = () => {
    setIsEditingNotes(!isEditingNotes);
  };
  
  const handleDeleteNotes = () => {
    if (existingNoteId) {
      deleteNoteMutation.mutate();
    }
  };

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/events/${event.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event deleted",
        description: "Your event has been successfully deleted.",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke slette hendelse",
        description: "Hei du kan ikke slette en Bookingen da den er bindende",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteEventMutation.mutate();
  };

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const formatEventDate = () => {
    const startDate = new Date(event.startTime);
    
    if (event.allDay) {
      return format(startDate, "MMMM d, yyyy");
    }
    
    return format(startDate, "MMMM d, yyyy");
  };

  const formatEventTime = () => {
    const startDate = new Date(event.startTime);
    
    if (event.allDay) {
      return "All day";
    }
    
    let timeString = format(startDate, "h:mm a");
    
    if (event.endTime) {
      const endDate = new Date(event.endTime);
      timeString += ` - ${format(endDate, "h:mm a")}`;
    }
    
    return timeString;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between p-1 rounded-t-lg" style={{ backgroundColor: (event.color || "#ef4444") as string }}>
              <DialogTitle className="text-white font-semibold p-2">
                {event.title.replace(/https?:\/\/\S+/g, "Lenke")}
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">Detaljert visning av kalenderhendelse</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-slate-500 mr-2" />
              <span className="text-slate-800">{formatEventDate()}</span>
            </div>
            
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-slate-500 mr-2" />
              <span className="text-slate-800">{formatEventTime()}</span>
            </div>
            
            {event.description && (
              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-slate-700">
                    {isTranslated ? 'Oversatt beskrivelse:' : 'Beskrivelse:'}
                  </h3>
                  
                  {/* Translation button */}
                  {event.description && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => isTranslated ? resetTranslation() : translate(language === 'no' ? 'en' : 'no')}
                      disabled={isTranslating}
                      className="text-xs flex items-center gap-1"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t('translation.translating')}
                        </>
                      ) : isTranslated ? (
                        <>
                          <Globe className="h-3 w-3" />
                          {t('translation.backToOriginal')}
                        </>
                      ) : (
                        <>
                          <Globe className="h-3 w-3" />
                          {t('translation.button')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Show translated or original text */}
                {translationError && (
                  <p className="text-red-500 text-sm mb-2">{t('translation.error')}</p>
                )}
                
                <p className="text-slate-800 whitespace-pre-line">
                  {isTranslated && translatedText 
                    ? translatedText.replace(/<a\s+(?:[^>]*?\s+)?href=([^>]*)>(.*?)<\/a>|https?:\/\/\S+/g, "www.smarthjem.as") 
                    : event.description.replace(/<a\s+(?:[^>]*?\s+)?href=([^>]*)>(.*?)<\/a>|https?:\/\/\S+/g, "www.smarthjem.as")}
                </p>
              </div>
            )}
            
            {event.routes && event.routes.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Routes:</h3>
                <div className="flex flex-wrap gap-2">
                  {event.routes.map((route, index) => (
                    <div 
                      key={index}
                      className="px-2 py-1 bg-primary-100 text-primary-800 rounded-md text-sm flex items-center"
                    >
                      <div className="w-3 h-3 bg-primary-500 rounded-sm mr-2"></div>
                      {route}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {isExternalEvent && (
              <>
                <div className="flex items-start gap-2 p-2 border rounded-md bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800">
                      Hei du kan ikke slette en Bookingen da den er bindende.
                    </p>
                    {event.source && typeof event.source === 'object' && 'feedName' in (event.source as object) && (
                      <p className="text-xs text-amber-700 mt-1">
                        Kilde: {(event.source as any).feedName}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Additional iCal event details section */}
                {event.description && (
                  <div className="pt-3 border-t border-slate-200">
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Beskrivelse:</h3>
                    <div className="p-3 bg-slate-50 rounded-md">
                      <div className="text-slate-800 whitespace-pre-line text-sm">
                        {event.description ? event.description.replace(/<a\s+(?:[^>]*?\s+)?href=([^>]*)>(.*?)<\/a>|https?:\/\/\S+/g, "www.smarthjem.as") : ""}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Notes section for iCal events */}
                <div className="pt-3 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-slate-700">Personlige notater</h3>
                    <div className="flex gap-2">
                      {existingNoteId && !isEditingNotes && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={handleDeleteNotes}
                          disabled={deleteNoteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {!isEditingNotes ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 gap-1"
                          onClick={handleToggleEditNotes}
                        >
                          <PenLine className="h-4 w-4" />
                          {existingNoteId ? "Rediger notat" : "Legg til notat"}
                        </Button>
                      ) : (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="h-8 gap-1"
                          onClick={handleSaveNotes}
                          disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                          Lagre
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {isLoadingNote ? (
                    <div className="h-20 flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : isEditingNotes ? (
                    <div className="space-y-2">
                      <Label htmlFor="notes">Dine notater for denne hendelsen</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Legg til dine personlige notater om denne hendelsen..."
                        className="min-h-[100px]"
                      />
                      <p className="text-xs text-slate-500">
                        Disse notatene er kun synlige for deg og deles ikke med kalendereieren.
                      </p>
                    </div>
                  ) : existingNoteId ? (
                    <div className="p-3 bg-slate-50 rounded-md">
                      <p className="text-slate-800 whitespace-pre-line">{notes}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">
                      Ingen personlige notater lagt til for denne hendelsen enda.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            {/* Knapper for vanlige hendelser */}
            {!isExternalEvent && (
              <>
                {canEdit && (
                  <Button 
                    variant="outline" 
                    onClick={handleEdit}
                    className="gap-1"
                  >
                    <Edit className="h-4 w-4" />
                    Rediger
                  </Button>
                )}
                {canDelete && (
                  <Button 
                    variant="destructive" 
                    onClick={handleDelete}
                    className="gap-1"
                    disabled={deleteEventMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteEventMutation.isPending ? "Sletter..." : "Slett"}
                  </Button>
                )}
              </>
            )}
            
            {/* Fjernet muligheten for admin til å redigere eller slette iCal-hendelser */}
            <Button 
              variant="outline" 
              onClick={onClose}
            >
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette hendelsen "{event.title}". Denne handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit event modal */}
      {isEditModalOpen && (
        <AddEventModal 
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            onClose();
          }}
          initialDate={new Date(event.startTime)}
        />
      )}
    </>
  );
}
