import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Edit, 
  HelpCircle, 
  Loader2, 
  MapPin, 
  Share2, 
  ThumbsDown, 
  ThumbsUp, 
  Users, 
  X, 
  MessageSquare,
  AlertCircle,
  User
} from "lucide-react";
import { format, formatRelative } from "date-fns";
import { nb } from 'date-fns/locale';
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface CollaborativeEventDetailsProps {
  eventId: number;
}

export default function CollaborativeEventDetails({ eventId }: CollaborativeEventDetailsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newSuggestion, setNewSuggestion] = useState({
    type: "",
    originalValue: "",
    suggestedValue: "",
    message: ""
  });
  
  // Fetch event details
  const { data: event, isLoading: isEventLoading, error: eventError } = useQuery({
    queryKey: [`/api/events/${eventId}`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch event details");
      }
      return response.json();
    }
  });
  
  // Fetch collaborators
  const { data: collaborators, isLoading: isCollaboratorsLoading } = useQuery({
    queryKey: [`/api/collaborative-events/${eventId}/collaborators`],
    queryFn: async () => {
      const response = await fetch(`/api/collaborative-events/${eventId}/collaborators`);
      if (!response.ok) {
        throw new Error("Failed to fetch collaborators");
      }
      return response.json();
    },
    enabled: !!eventId
  });
  
  // Fetch suggestions
  const { data: suggestions, isLoading: isSuggestionsLoading } = useQuery({
    queryKey: [`/api/events/${eventId}/suggestions`],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/suggestions`);
      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }
      return response.json();
    },
    enabled: !!eventId
  });

  // Create a new suggestion
  const createSuggestionMutation = useMutation({
    mutationFn: async (suggestion: any) => {
      const response = await apiRequest("POST", `/api/events/${eventId}/suggestions`, suggestion);
      if (!response.ok) {
        throw new Error("Failed to create suggestion");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/suggestions`] });
      toast({
        title: "Forslag sendt",
        description: "Ditt forslag er sendt og venter på godkjenning.",
      });
      closeDialogs();
    },
    onError: (error) => {
      toast({
        title: "Feil ved sending av forslag",
        description: (error as Error).message || "Kunne ikke sende forslaget. Prøv igjen senere.",
        variant: "destructive",
      });
    }
  });

  // Resolve a suggestion (approve or reject)
  const resolveSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, status }: { suggestionId: number, status: 'approved' | 'rejected' }) => {
      const response = await apiRequest("POST", `/api/suggestions/${suggestionId}/resolve`, { status });
      if (!response.ok) {
        throw new Error("Failed to resolve suggestion");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/suggestions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({
        title: "Forslag behandlet",
        description: "Forslaget er behandlet og oppdatert.",
      });
    },
    onError: (error) => {
      toast({
        title: "Feil ved behandling av forslag",
        description: (error as Error).message || "Kunne ikke behandle forslaget. Prøv igjen senere.",
        variant: "destructive",
      });
    }
  });

  // Leave the collaborative event
  const leaveEventMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/collaborative-events/${eventId}/collaborators/${user?.id}`);
      if (!response.ok) {
        throw new Error("Failed to leave event");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborative-events"] });
      toast({
        title: "Arrangement forlatt",
        description: "Du er ikke lenger deltaker i dette arrangementet.",
      });
      setLocation("/collaborative");
    },
    onError: (error) => {
      toast({
        title: "Feil ved forlating av arrangement",
        description: (error as Error).message || "Kunne ikke forlate arrangementet. Prøv igjen senere.",
        variant: "destructive",
      });
    }
  });

  // Close all open dialogs
  const closeDialogs = () => {
    // Reset new suggestion form
    setNewSuggestion({
      type: "",
      originalValue: "",
      suggestedValue: "",
      message: ""
    });
  };

  // Check if current user is the owner
  const isOwner = event && user && event.userId === user.id;
  
  // Check if current user is a collaborator
  const isCollaborator = collaborators && user && collaborators.some(
    (collaborator: any) => collaborator.userId === user.id
  );

  // Prepare suggestions
  const pendingSuggestions = suggestions?.filter((s: any) => s.status === "pending") || [];
  const resolvedSuggestions = suggestions?.filter((s: any) => s.status !== "pending") || [];

  // Handle copying share link
  const copyShareLink = () => {
    if (!event) return;
    
    const shareLink = `${window.location.origin}/collaborate/${event.collaborationCode}`;
    navigator.clipboard.writeText(shareLink);
    
    toast({
      title: "Lenke kopiert",
      description: "Delings-lenken er kopiert til utklippstavlen.",
    });
  };

  if (isEventLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (eventError || !event) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-medium mb-2">Kunne ikke laste arrangement</h3>
        <p className="text-muted-foreground mb-4">
          Arrangementet finnes ikke eller du har ikke tilgang til det.
        </p>
        <Button onClick={() => setLocation("/collaborative")}>
          Tilbake til arrangementer
        </Button>
      </div>
    );
  }

  // Check if event is collaborative
  if (!event.isCollaborative) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <h3 className="text-lg font-medium mb-2">Ikke et samarbeidsarrangement</h3>
        <p className="text-muted-foreground mb-4">
          Dette arrangementet støtter ikke samarbeid.
        </p>
        <Button onClick={() => setLocation("/")}>
          Tilbake til kalenderen
        </Button>
      </div>
    );
  }

  const handleSuggestEdit = (type: string, originalValue: string) => {
    setNewSuggestion({
      type,
      originalValue,
      suggestedValue: originalValue,
      message: ""
    });
  };

  const submitSuggestion = () => {
    if (!newSuggestion.type || !newSuggestion.suggestedValue) {
      toast({
        title: "Manglende informasjon",
        description: "Vennligst fyll ut alle påkrevde felt.",
        variant: "destructive",
      });
      return;
    }
    
    createSuggestionMutation.mutate(newSuggestion);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
          <div className="flex space-x-4 text-muted-foreground text-sm">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {format(new Date(event.startTime), "PPP", { locale: nb })}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {format(new Date(event.startTime), "HH:mm")} - {format(new Date(event.endTime), "HH:mm")}
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center">
                <Share2 className="h-4 w-4 mr-2" />
                Del
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Del arrangement</DialogTitle>
                <DialogDescription>
                  Alle med denne lenken kan bli med på arrangementet.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center space-x-2 mt-4">
                <div className="grid flex-1 gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/collaborate/${event.collaborationCode}`}
                  />
                </div>
                <Button size="sm" className="px-3" onClick={copyShareLink}>
                  <span className="sr-only">Kopier</span>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={copyShareLink}>Kopier lenke</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {isCollaborator && !isOwner && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center text-destructive">
                  <X className="h-4 w-4 mr-2" />
                  Forlat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Forlat arrangement</DialogTitle>
                  <DialogDescription>
                    Er du sikker på at du vil forlate dette arrangementet? Du vil ikke lenger ha tilgang til det.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => closeDialogs()}>Avbryt</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => leaveEventMutation.mutate()}
                    disabled={leaveEventMutation.isPending}
                  >
                    {leaveEventMutation.isPending ? "Forlater..." : "Forlat arrangement"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Detaljer</TabsTrigger>
          <TabsTrigger value="participants">
            Deltakere
            {!isCollaboratorsLoading && collaborators?.length > 0 && (
              <Badge variant="secondary" className="ml-2">{collaborators.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            Forslag
            {!isSuggestionsLoading && pendingSuggestions.length > 0 && (
              <Badge className="ml-2">{pendingSuggestions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Arrangementsdetaljer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Tittel</h3>
                    {isCollaborator && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleSuggestEdit("title", event.title)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Foreslå endring av tittel</DialogTitle>
                            <DialogDescription>
                              Ditt forslag må godkjennes av arrangementets eier.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Nåværende tittel:</h4>
                              <div className="bg-muted p-3 rounded-md text-sm">{event.title}</div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Ditt forslag:</h4>
                              <Input 
                                value={newSuggestion.suggestedValue}
                                onChange={(e) => setNewSuggestion({
                                  ...newSuggestion,
                                  suggestedValue: e.target.value
                                })}
                              />
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Kommentar (valgfritt):</h4>
                              <Textarea 
                                placeholder="Forklar hvorfor du foreslår denne endringen"
                                value={newSuggestion.message}
                                onChange={(e) => setNewSuggestion({
                                  ...newSuggestion,
                                  message: e.target.value
                                })}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={closeDialogs}>Avbryt</Button>
                            <Button onClick={submitSuggestion} disabled={createSuggestionMutation.isPending}>
                              {createSuggestionMutation.isPending ? "Sender..." : "Send forslag"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                <p>{event.title}</p>
                <Separator />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Tid og dato</h3>
                    {isCollaborator && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleSuggestEdit("startTime", event.startTime)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Foreslå endring av tid</DialogTitle>
                            <DialogDescription>
                              Ditt forslag må godkjennes av arrangementets eier.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Nåværende tid:</h4>
                              <div className="bg-muted p-3 rounded-md text-sm">
                                {format(new Date(event.startTime), "PPP", { locale: nb })}{" "}
                                {format(new Date(event.startTime), "HH:mm")} - {format(new Date(event.endTime), "HH:mm")}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Kommentar (valgfritt):</h4>
                              <Textarea 
                                placeholder="Foreslå et nytt tidspunkt og forklar hvorfor"
                                value={newSuggestion.message}
                                onChange={(e) => setNewSuggestion({
                                  ...newSuggestion,
                                  suggestedValue: "Ny tid foreslått - se kommentar",
                                  message: e.target.value
                                })}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={closeDialogs}>Avbryt</Button>
                            <Button onClick={submitSuggestion} disabled={createSuggestionMutation.isPending}>
                              {createSuggestionMutation.isPending ? "Sender..." : "Send forslag"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{format(new Date(event.startTime), "PPP", { locale: nb })}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>
                      {format(new Date(event.startTime), "HH:mm")} - {format(new Date(event.endTime), "HH:mm")}
                    </span>
                  </div>
                </div>
                <Separator />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Beskrivelse</h3>
                    {isCollaborator && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleSuggestEdit("description", event.description || "")}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Foreslå endring av beskrivelse</DialogTitle>
                            <DialogDescription>
                              Ditt forslag må godkjennes av arrangementets eier.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Nåværende beskrivelse:</h4>
                              <div className="bg-muted p-3 rounded-md text-sm">
                                {event.description || <em>Ingen beskrivelse</em>}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Ditt forslag:</h4>
                              <Textarea 
                                value={newSuggestion.suggestedValue}
                                onChange={(e) => setNewSuggestion({
                                  ...newSuggestion,
                                  suggestedValue: e.target.value
                                })}
                                rows={4}
                              />
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Kommentar (valgfritt):</h4>
                              <Textarea 
                                placeholder="Forklar hvorfor du foreslår denne endringen"
                                value={newSuggestion.message}
                                onChange={(e) => setNewSuggestion({
                                  ...newSuggestion,
                                  message: e.target.value
                                })}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={closeDialogs}>Avbryt</Button>
                            <Button onClick={submitSuggestion} disabled={createSuggestionMutation.isPending}>
                              {createSuggestionMutation.isPending ? "Sender..." : "Send forslag"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
                <p className="text-sm">
                  {event.description || <span className="text-muted-foreground italic">Ingen beskrivelse</span>}
                </p>
                <Separator />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Delingskode</h3>
                <div className="flex items-center space-x-2">
                  <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                    {event.collaborationCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={copyShareLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Del denne koden med andre som skal delta på arrangementet.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="participants" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Deltakere</CardTitle>
            </CardHeader>
            <CardContent>
              {isCollaboratorsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {collaborators && collaborators.length > 0 ? (
                    <div className="space-y-2">
                      {collaborators.map((collaborator: any) => (
                        <div key={collaborator.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md">
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{collaborator.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{collaborator.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Ble med {formatRelative(new Date(collaborator.joinedAt), new Date(), { locale: nb })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={collaborator.role === "owner" ? "default" : "outline"}>
                            {collaborator.role === "owner" ? "Arrangør" : "Deltaker"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <h3 className="font-medium mb-1">Ingen deltakere</h3>
                      <p className="text-sm text-muted-foreground">
                        Det er ingen deltakere i dette arrangementet ennå.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Del arrangementskoden med andre for å invitere dem.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="suggestions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Forslag til endringer</CardTitle>
            </CardHeader>
            <CardContent>
              {isSuggestionsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center">
                      <HelpCircle className="h-4 w-4 mr-2 text-amber-500" />
                      Ventende forslag
                    </h3>
                    
                    {pendingSuggestions.length === 0 ? (
                      <div className="bg-muted/50 rounded-md p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Det er ingen ventende forslag for dette arrangementet.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingSuggestions.map((suggestion: any) => (
                          <div key={suggestion.id} className="border rounded-md overflow-hidden">
                            <div className="bg-muted p-3 flex justify-between items-start">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{suggestion.suggestedByName[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{suggestion.suggestedByName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatRelative(new Date(suggestion.createdAt), new Date(), { locale: nb })}
                                  </p>
                                </div>
                              </div>
                              <Badge>
                                {suggestion.type === "title" ? "Tittel" : 
                                 suggestion.type === "description" ? "Beskrivelse" : 
                                 suggestion.type === "startTime" ? "Tidspunkt" : 
                                 suggestion.type}
                              </Badge>
                            </div>
                            
                            <div className="p-3">
                              {suggestion.type === "startTime" ? (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Foreslår endring av tidspunkt</p>
                                  <p className="text-sm">{suggestion.message}</p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="bg-muted/50 p-2 rounded-md">
                                    <p className="text-xs text-muted-foreground mb-1">Nåværende verdi:</p>
                                    <p className="text-sm">{suggestion.originalValue || <em>Ingen verdi</em>}</p>
                                  </div>
                                  
                                  <div className="bg-blue-50 dark:bg-blue-950/50 p-2 rounded-md">
                                    <p className="text-xs text-muted-foreground mb-1">Foreslått verdi:</p>
                                    <p className="text-sm">{suggestion.suggestedValue}</p>
                                  </div>
                                  
                                  {suggestion.message && (
                                    <div className="mt-2">
                                      <p className="text-xs text-muted-foreground mb-1">Kommentar:</p>
                                      <p className="text-sm">{suggestion.message}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {isOwner && (
                                <div className="mt-4 flex space-x-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => resolveSuggestionMutation.mutate({
                                      suggestionId: suggestion.id,
                                      status: 'rejected'
                                    })}
                                    disabled={resolveSuggestionMutation.isPending}
                                  >
                                    <ThumbsDown className="h-4 w-4 mr-1" />
                                    Avvis
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => resolveSuggestionMutation.mutate({
                                      suggestionId: suggestion.id,
                                      status: 'approved'
                                    })}
                                    disabled={resolveSuggestionMutation.isPending}
                                  >
                                    <ThumbsUp className="h-4 w-4 mr-1" />
                                    Godkjenn
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {resolvedSuggestions.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Behandlede forslag
                      </h3>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Foreslått av</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Dato</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resolvedSuggestions.map((suggestion: any) => (
                            <TableRow key={suggestion.id}>
                              <TableCell>
                                {suggestion.type === "title" ? "Tittel" : 
                                 suggestion.type === "description" ? "Beskrivelse" : 
                                 suggestion.type === "startTime" ? "Tidspunkt" : 
                                 suggestion.type}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span>{suggestion.suggestedByName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={suggestion.status === "approved" ? "default" : "secondary"}>
                                  {suggestion.status === "approved" ? "Godkjent" : "Avvist"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {format(new Date(suggestion.updatedAt), "dd.MM.yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                Alle deltakere kan foreslå endringer til arrangementet, men kun eieren kan godkjenne dem.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}