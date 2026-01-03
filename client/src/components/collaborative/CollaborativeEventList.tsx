import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PlusCircle, CalendarPlus, Users, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { nb } from 'date-fns/locale';
import CollaborativeEventModal from "@/components/modals/CollaborativeEventModal";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function CollaborativeEventList() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: collaborativeEvents, isLoading, error } = useQuery({
    queryKey: ["/api/collaborative-events"],
    queryFn: async () => {
      const response = await fetch("/api/collaborative-events");
      if (!response.ok) {
        throw new Error("Failed to fetch collaborative events");
      }
      return response.json();
    }
  });

  const joinCollaborativeEvent = async (code: string) => {
    try {
      const event = await fetchEventByCode(code);
      if (!event) {
        toast({
          title: "Feil",
          description: "Kunne ikke finne arrangementet. Kontroller koden og prøv igjen.",
          variant: "destructive",
        });
        return;
      }
      
      const response = await apiRequest("POST", `/api/collaborative-events/${event.id}/join`);
      
      if (!response.ok) {
        throw new Error("Failed to join event");
      }
      
      toast({
        title: "Deltakelse bekreftet",
        description: "Du er nå lagt til som deltaker i arrangementet.",
      });
      
      // Redirect to event details page
      setLocation(`/collaborative/${event.id}`);
    } catch (error) {
      console.error("Error joining event:", error);
      toast({
        title: "Kunne ikke bli med",
        description: "Det oppstod en feil ved tilkobling til arrangementet. Vennligst prøv igjen.",
        variant: "destructive",
      });
    }
  };

  const fetchEventByCode = async (code: string) => {
    try {
      const response = await fetch(`/api/collaborative-events/${code}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching event by code:", error);
      return null;
    }
  };

  const handleJoinWithCode = () => {
    const code = prompt("Skriv inn arrangementskoden:");
    if (code) {
      joinCollaborativeEvent(code);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-destructive">Kunne ikke laste samarbeidsarrangementer</p>
        <Button 
          variant="outline" 
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Prøv igjen
        </Button>
      </div>
    );
  }

  const ownedEvents = collaborativeEvents?.filter((event: any) => event.isCollaborativeOwner);
  const participatingEvents = collaborativeEvents?.filter((event: any) => !event.isCollaborativeOwner);

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Samarbeidsarrangementer</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleJoinWithCode}
              className="flex items-center"
            >
              <Users className="mr-2 h-4 w-4" />
              Bli med på arrangement
            </Button>
            <Button onClick={() => setCreateModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Nytt arrangement
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="owned">
              Dine arrangementer
              {ownedEvents?.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ownedEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="participating">
              Deltar på
              {participatingEvents?.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {participatingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {collaborativeEvents?.length === 0 ? (
              <EmptyState onCreateNew={() => setCreateModalOpen(true)} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collaborativeEvents?.map((event: any) => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onClick={() => setLocation(`/collaborative/${event.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="owned" className="mt-4">
            {!ownedEvents || ownedEvents.length === 0 ? (
              <EmptyState 
                title="Ingen egne arrangementer" 
                description="Du har ikke opprettet noen samarbeidsarrangementer ennå."
                onCreateNew={() => setCreateModalOpen(true)} 
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedEvents.map((event: any) => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onClick={() => setLocation(`/collaborative/${event.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="participating" className="mt-4">
            {!participatingEvents || participatingEvents.length === 0 ? (
              <EmptyState 
                title="Ingen deltakelser" 
                description="Du deltar ikke på noen samarbeidsarrangementer ennå."
                buttonText="Bli med på arrangement" 
                buttonIcon={<Users className="h-4 w-4 mr-2" />}
                onCreateNew={handleJoinWithCode} 
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participatingEvents.map((event: any) => (
                  <EventCard 
                    key={event.id} 
                    event={event} 
                    onClick={() => setLocation(`/collaborative/${event.id}`)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CollaborativeEventModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </>
  );
}

interface EventCardProps {
  event: any;
  onClick: () => void;
}

function EventCard({ event, onClick }: EventCardProps) {
  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="line-clamp-1" title={event.title}>
          {event.title}
        </CardTitle>
        <CardDescription>
          {format(new Date(event.startTime), "PPP", { locale: nb })}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        {event.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Ingen beskrivelse
          </p>
        )}
      </CardContent>
      <CardFooter className="pt-2 flex justify-between items-center">
        <Badge variant={event.isCollaborativeOwner ? "default" : "secondary"}>
          {event.isCollaborativeOwner ? "Arrangør" : "Deltaker"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onClick}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Se detaljer
        </Button>
      </CardFooter>
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  onCreateNew: () => void;
}

function EmptyState({ 
  title = "Ingen samarbeidsarrangementer", 
  description = "Det er ingen aktive samarbeidsarrangementer ennå.",
  buttonText = "Opprett arrangement",
  buttonIcon = <CalendarPlus className="h-4 w-4 mr-2" />,
  onCreateNew 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="bg-muted rounded-full p-3 mb-4">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        {description}
      </p>
      <Button onClick={onCreateNew}>
        {buttonIcon}
        {buttonText}
      </Button>
    </div>
  );
}