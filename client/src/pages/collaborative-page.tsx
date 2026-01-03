import React from "react";
import { useRoute, useLocation } from "wouter";
import Layout from "@/components/Layout";
import CollaborativeEventList from "@/components/collaborative/CollaborativeEventList";
import CollaborativeEventDetails from "@/components/collaborative/CollaborativeEventDetails";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CollaborativePage() {
  const [match, params] = useRoute("/collaborative/:id");
  const [matchJoin, joinParams] = useRoute("/collaborate/:code");
  const [, setLocation] = useLocation();

  return (
    <Layout>
      <div className="container mx-auto py-6 max-w-6xl">
        {match && params?.id ? (
          <div className="space-y-4">
            <Button 
              variant="ghost" 
              className="mb-2 -ml-2"
              onClick={() => setLocation("/collaborative")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbake til oversikten
            </Button>
            
            <CollaborativeEventDetails eventId={parseInt(params.id)} />
          </div>
        ) : matchJoin && joinParams?.code ? (
          <JoinCollaborative code={joinParams.code} />
        ) : (
          <Tabs defaultValue="collaborative" className="space-y-4">
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="collaborative">Samarbeidsarrangementer</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="collaborative" className="space-y-4">
              <CollaborativeEventList />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}

interface JoinCollaborativeProps {
  code: string;
}

function JoinCollaborative({ code }: JoinCollaborativeProps) {
  const [, setLocation] = useLocation();
  const [isJoining, setIsJoining] = React.useState(false);
  const [event, setEvent] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/collaborative-events/${code}`);
        if (!response.ok) {
          throw new Error("Could not find event");
        }
        const data = await response.json();
        setEvent(data);
      } catch (err) {
        setError("Kunne ikke finne arrangementet. Kontroller koden og prøv igjen.");
      }
    };

    fetchEvent();
  }, [code]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      if (!event) {
        throw new Error("Event not found");
      }
      
      const response = await fetch(`/api/collaborative-events/${event.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to join event");
      }
      
      // Redirect to the collaborative event details page
      setLocation(`/collaborative/${event.id}`);
    } catch (err) {
      setError("Det oppstod en feil ved tilkobling til arrangementet. Vennligst prøv igjen.");
      setIsJoining(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg text-center">
        <h2 className="text-xl font-bold mb-4">Feil ved tilkobling</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => setLocation("/collaborative")}>
          Gå til samarbeidsarrangementer
        </Button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg text-center">
        <h2 className="text-xl font-bold mb-4">Laster arrangement...</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-5/6 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Bli med på samarbeidsarrangement</h2>
      <div className="space-y-4 mb-6">
        <div>
          <h3 className="font-medium text-sm text-muted-foreground">Arrangement:</h3>
          <p className="font-medium">{event.title}</p>
        </div>
        {event.description && (
          <div>
            <h3 className="font-medium text-sm text-muted-foreground">Beskrivelse:</h3>
            <p>{event.description}</p>
          </div>
        )}
        <div>
          <h3 className="font-medium text-sm text-muted-foreground">Arrangør:</h3>
          <p>{event.ownerName || "Ukjent arrangør"}</p>
        </div>
      </div>
      
      <div className="flex space-x-3">
        <Button variant="outline" onClick={() => setLocation("/collaborative")}>
          Avbryt
        </Button>
        <Button onClick={handleJoin} disabled={isJoining}>
          {isJoining ? "Blir med..." : "Bli med på arrangementet"}
        </Button>
      </div>
    </div>
  );
}