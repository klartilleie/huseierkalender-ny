import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import useDocumentTitle from "@/hooks/use-document-title";
import { format } from "date-fns";

// Komponenter
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Ikoner
import {
  MessageSquare,
  PlusCircle,
  Send,
  RefreshCw,
  Inbox,
  CheckCircle,
} from "lucide-react";

// Typer for bedre typesikkerhet
interface Ticket {
  id: number;
  userId: number;
  adminId: number | null;
  department: string | null;
  caseNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedById: number | null;
  messages?: TicketMessage[];
}

interface TicketMessage {
  id: number;
  caseId: number;
  senderId: number;
  targetUserId: number | null;
  message: string;
  isAdminMessage: boolean;
  isRead: boolean;
  createdAt: string;
  attachmentUrl: string | null;
}

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sett dokumenttittel
  useDocumentTitle("Kundeservice");
  
  // Tilstandshåndtering
  const [activeTab, setActiveTab] = useState("tickets");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketData, setNewTicketData] = useState({
    title: "",
    category: "technical",
    message: ""
  });
  
  // Kategorier for hendelsesoppretting
  const categories = [
    { id: "technical", name: "Teknisk problem", color: "red" },
    { id: "billing", name: "Fakturering", color: "yellow" },
    { id: "support", name: "Kundestøtte", color: "blue" },
    { id: "info", name: "Informasjonsforespørsel", color: "gray" },
    { id: "complaint", name: "Klage", color: "red" }
  ];
  
  // Henter hendelser basert på brukertype (admin eller vanlig bruker)
  const isAdmin = user?.isAdmin === true;
  
  // Bruker riktig API-endepunkt basert på brukertype
  const ticketsEndpoint = isAdmin ? '/api/admin/cases' : '/api/cases';
  
  const { 
    data: tickets = [], 
    isLoading: isLoadingTickets,
    refetch: refetchTickets
  } = useQuery<Ticket[]>({
    queryKey: [ticketsEndpoint],
    enabled: !!user
  });
  
  // Henter meldinger for aktiv hendelse
  const { 
    data: serverMessages = [], 
    isLoading: isLoadingMessages
  } = useQuery<TicketMessage[]>({
    queryKey: ['/api/cases', activeTicket?.id, 'messages'],
    enabled: !!activeTicket,
    refetchInterval: 5000, // Auto-oppdaterer meldinger hvert 5. sekund
  });
  
  // For visning av meldinger
  // Vi slår sammen meldinger fra både server og aktiv sak for å sikre at ingen meldinger forsvinner
  const messages = useMemo(() => {
    // Logg til debugging
    console.log("Viser meldinger:", { 
      activeTicket, 
      serverMessages, 
      harMeldinger: activeTicket?.messages?.length
    });
    
    // Kombiner meldinger fra begge kilder for å sikre at vi ikke mister meldinger
    let allMessages: TicketMessage[] = [];
    
    // PRIORITET 1: Bruk alltid serverMessages først - disse er hentet direkte fra API
    if (serverMessages && serverMessages.length > 0) {
      // Filtrer meldinger for å sikre at de har gyldig innhold
      const filteredServerMessages = serverMessages.filter(message => 
        message && 
        typeof message === 'object' && 
        'message' in message && 
        message.message && // Sikre at message ikke er tom
        'senderId' in message
      );
      
      // Logger antall og innhold av meldinger
      console.log(`Fant ${filteredServerMessages.length} gyldige meldinger fra server`);
      filteredServerMessages.forEach((msg, i) => {
        console.log(`Servermelding ${i+1}: ${msg.id}, innhold: "${msg.message?.substring(0, 20)}...", avsender: ${msg.senderId}`);
      });
      
      // Legg til alle filtrerte servermeldinger
      allMessages = [...filteredServerMessages];
    }
    
    // PRIORITET 2: Fyll på med meldinger fra activeTicket 
    // hvis vi mangler meldinger eller ikke har noen fra server
    if (
      activeTicket?.messages && 
      Array.isArray(activeTicket.messages) && 
      activeTicket.messages.length > 0 &&
      (allMessages.length === 0 || allMessages.length < activeTicket.messages.length)
    ) {
      console.log("Bruker også meldinger fra activeTicket");
      
      // Filtrer meldinger for å sikre at de har gyldig innhold
      const filteredTicketMessages = activeTicket.messages.filter(message => 
        message && 
        typeof message === 'object' && 
        'message' in message && 
        message.message && // Sikre at message ikke er tom
        'senderId' in message
      );
      
      // Legg til meldinger som ikke allerede finnes i allMessages
      filteredTicketMessages.forEach(message => {
        if (!allMessages.some(m => m.id === message.id)) {
          allMessages.push(message);
        }
      });
    }
    
    // Sorter meldingene etter dato
    allMessages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    console.log("Endelige meldinger som vises:", allMessages);
    return allMessages;
  }, [activeTicket, serverMessages]);
  
  // Opprett ny hendelse
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: ticketData.title,
          category: ticketData.category,
          priority: "medium", // Standard prioritet
          status: "open",
          message: ticketData.message // Meldingen som skal sendes
        }),
      });
      
      if (!response.ok) {
        // Håndter valideringsfeil
        const errorData = await response.json();
        
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map((err: any) => err.message).join('\\n');
          throw new Error(errorMessages);
        }
        
        throw new Error('Kunne ikke opprette henvendelse. Vennligst prøv igjen.');
      }
      
      const newCase = await response.json();
      console.log("Ny henvendelse opprettet:", newCase);
      return newCase;
    },
    onSuccess: async (newCase) => {
      console.log("Henvendelse opprettet, data mottatt:", newCase);
      
      // VIKTIG: Vi må først oppdatere cachen for nye meldinger før vi oppdaterer listen av saker
      // for å unngå at listen overskriver det aktive valget
      
      // Sjekk om vi har mottatt meldinger med saken fra serveren
      if (newCase.messages && newCase.messages.length > 0) {
        console.log("Saken inneholder meldinger fra serveren:", newCase.messages);
        
        // Sett det direkte i React Query-cachen
        queryClient.setQueryData(
          ['/api/cases', newCase.id, 'messages'], 
          newCase.messages
        );
      }
      // Hvis vi ikke har meldinger, men brukeren skrev en melding, oppretter vi en lokal melding
      else if (newTicketData.message.trim()) {
        console.log("Lager lokal representasjon av meldingen");
        
        // Opprett et lokalt meldingsobjekt som vises umiddelbart
        const tempMessage: TicketMessage = {
          id: -1,
          caseId: newCase.id,
          senderId: user?.id || 0,
          targetUserId: null,
          message: newTicketData.message,
          isAdminMessage: false,
          isRead: false,
          createdAt: new Date().toISOString(),
          attachmentUrl: null
        };
        
        // Sett det direkte i React Query-cachen
        queryClient.setQueryData(
          ['/api/cases', newCase.id, 'messages'], 
          [tempMessage]
        );
      }
      
      // Sett den nyopprettede henvendelsen som aktiv 
      // VIKTIG: Vi gjør dette FØR vi invaliderer listen, for å sikre at vi ikke mister fokus
      setActiveTicket(newCase);
      setActiveTab("tickets");
      
      // VIKTIG: Oppdaterer lokalt cache for å inkludere den nye henvendelsen uten å vente på ny nettverkshenting
      // Dette forhindrer at fokus flytter seg når listen hentes på nytt
      const currentTickets = queryClient.getQueryData<Ticket[]>(['/api/cases']) || [];
      
      // Bevar den nye saken med meldingene intakte
      const newCaseWithMessages = {
        ...newCase,
        // Forsikre oss om at meldingene følger med
        messages: newCase.messages || []
      };
      
      // Oppdater cachen med den nye saken
      queryClient.setQueryData(
        ['/api/cases'],
        [newCaseWithMessages, ...currentTickets]
      );
      
      // VIKTIG: Deaktiver automatisk oppdatering av listen midlertidig
      // for å sikre at vår cache ikke blir overskrevet
      const previousQueryConfig = queryClient.getQueryState(['/api/cases'])?.fetchOptions;
      queryClient.setQueryDefaults(['/api/cases'], {
        staleTime: 60000, // 1 minutt - dette hindrer automatisk oppdatering
        gcTime: 900000,   // 15 minutter - holder data lenger i minnet
      });
      
      // Nullstill skjemaet
      setNewTicketData({
        title: "",
        category: "technical",
        message: ""
      });
      
      toast({
        title: "Henvendelse opprettet",
        description: "Din henvendelse er nå sendt til kundeservice",
      });
      
      // Til slutt, oppdater listen av saker for å sikre at vi har nyeste data
      // men på en måte som bevarer vår aktive hendelse og dens meldinger
      setTimeout(() => {
        // Vi vil oppdatere listen, men vi vil også beholde vår aktive sak
        const fetchNewList = async () => {
          try {
            // Hent ny liste
            const response = await fetch('/api/cases');
            const newCases = await response.json();
            
            // Finn vår aktive sak i den nye listen
            const updatedActiveCase = newCases.find((c: Ticket) => c.id === newCase.id);
            
            // Sjekk om aktiv sak har mistet meldingene
            if (updatedActiveCase && (!updatedActiveCase.messages || updatedActiveCase.messages.length === 0)) {
              // Bevar de opprinnelige meldingene
              updatedActiveCase.messages = newCase.messages || [];
              console.log("Bevarer meldinger under oppdatering av listen", updatedActiveCase);
            }
            
            // Oppdater cachen med den nye listen, men bevar den aktive saken
            queryClient.setQueryData(['/api/cases'], newCases);
            
            // Oppdater vår aktive sak
            if (updatedActiveCase) {
              setActiveTicket(updatedActiveCase);
            }
          } catch (error) {
            console.error("Feil under oppdatering av saklisten:", error);
          }
        };
        
        fetchNewList();
      }, 2000);
      
      // Gjenopprett standard spørringsinnstillinger etter 3 minutter
      setTimeout(() => {
        queryClient.resetQueries({ queryKey: ['/api/cases'] });
      }, 180000);
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved opprettelse av henvendelse",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Send melding
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string, isAdmin?: boolean }) => {
      if (!activeTicket) return null;
      
      const response = await fetch(`/api/cases/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke sende melding. Vennligst prøv igjen.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/cases', activeTicket?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved sending av melding",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Lukk sak
  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/cases/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke lukke henvendelsen. Vennligst prøv igjen.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Henvendelse lukket",
        description: "Henvendelsen er nå markert som lukket",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved lukking av henvendelse",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Reaktiver sak
  const reopenTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await fetch(`/api/cases/${ticketId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke gjenåpne henvendelsen. Vennligst prøv igjen.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      toast({
        title: "Henvendelse gjenåpnet",
        description: "Henvendelsen er nå markert som åpen igjen",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved gjenåpning av henvendelse",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Utløs scrolling til bunnen når meldinger endres
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Hjelpefunksjon for å hente statusvisningsnavn
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'open': return 'Åpen';
      case 'in_progress': 
      case 'in-progress': return 'Under behandling';
      case 'closed': return 'Lukket';
      default: return status;
    }
  };
  
  // Hjelpefunksjon for å få farge basert på status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': 
      case 'in-progress': return 'bg-yellow-500';
      case 'closed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Håndter sending av melding
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;
    
    sendMessageMutation.mutate({
      message: newMessage,
      isAdmin: false
    });
  };
  
  // Håndter opprettelse av ny henvendelse
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    createTicketMutation.mutate(newTicketData);
  };
  
  // Håndter velging av aktiv henvendelse
  const handleSelectTicket = (ticket: Ticket) => {
    setActiveTicket(ticket);
  };
  
  // Render komponenten
  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6 min-h-[calc(100vh-4rem)]">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Kundeservice</h1>
          <Button 
            variant="outline" 
            onClick={() => refetchTickets()}
            disabled={isLoadingTickets}
          >
            {isLoadingTickets ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Oppdater</span>
          </Button>
        </div>
        
        <Tabs defaultValue="tickets" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="tickets">Mine henvendelser</TabsTrigger>
            <TabsTrigger value="new">Ny henvendelse</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tickets">
            <div className="grid md:grid-cols-3 gap-6">
              {activeTicket ? (
                // Vis detaljer for aktiv sak
                <div className="md:col-span-3">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {activeTicket.title}
                            <Badge 
                              variant="outline" 
                              className={`ml-2 ${
                                activeTicket.status === 'closed' ? 'bg-red-100 text-red-800' : 
                                activeTicket.status === 'in-progress' || activeTicket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {getStatusDisplay(activeTicket.status)}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="flex flex-col gap-1 mt-1">
                            <span>Saksnummer: {activeTicket.caseNumber}</span>
                            <span>Opprettet: {format(new Date(activeTicket.createdAt), 'dd.MM.yyyy HH:mm')}</span>
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {!activeTicket.isClosed ? (
                            <Button onClick={() => closeTicketMutation.mutate(activeTicket.id)} variant="destructive" size="sm">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Lukk henvendelse
                            </Button>
                          ) : (
                            <Button onClick={() => reopenTicketMutation.mutate(activeTicket.id)} variant="outline" size="sm">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Gjenåpne
                            </Button>
                          )}
                          <Button 
                            onClick={() => setActiveTicket(null)}
                            variant="ghost" 
                            size="sm"
                          >
                            Tilbake til listen
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <div className="flex-grow flex flex-col">
                      <div className="p-4 flex-grow overflow-auto">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                          <div className="space-y-4">

                            {isLoadingMessages ? (
                              <div className="flex flex-col gap-4">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className="flex gap-2 animate-pulse">
                                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                                    <div className="flex-1">
                                      <div className="h-4 w-1/4 mb-2 bg-gray-200 rounded"></div>
                                      <div className="h-12 w-full bg-gray-200 rounded"></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : messages && messages.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground">
                                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>Ingen meldinger i denne henvendelsen ennå</p>
                              </div>
                            ) : (
                              messages && messages.map(message => (
                                <div key={message.id} className="flex gap-3">
                                  <Avatar>
                                    <AvatarFallback className={message.isAdminMessage ? "bg-blue-100 text-blue-800" : ""}>
                                      {message.isAdminMessage ? 'A' : (user?.name?.charAt(0) || 'U')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col gap-1 flex-grow">
                                    <div className="flex justify-between">
                                      <span className="text-sm font-medium">
                                        {message.isAdminMessage ? "Kundeservice" : user?.name || "Du"}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(message.createdAt), 'dd.MM.yyyy HH:mm')}
                                      </span>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
                                      <p className="whitespace-pre-wrap">{message.message}</p>
                                    </div>
                                    {message.attachmentUrl && (
                                      <a 
                                        href={message.attachmentUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-500 hover:underline mt-1 flex items-center"
                                      >
                                        <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                        </svg>
                                        Vedlegg
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>
                      </div>
                      
                      <Separator />
                      
                      <CardContent className="pt-3 flex-shrink-0">
                        {!activeTicket.isClosed ? (
                          <form onSubmit={handleSendMessage} className="flex gap-2">
                            <Textarea 
                              placeholder="Skriv en melding her..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              className="min-h-[80px]"
                            />
                            <Button 
                              type="submit" 
                              className="mt-auto self-end"
                              disabled={sendMessageMutation.isPending || !newMessage.trim()}
                            >
                              {sendMessageMutation.isPending ? 
                                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" /> : 
                                <Send className="h-4 w-4" />
                              }
                            </Button>
                          </form>
                        ) : (
                          <div className="bg-gray-100 text-center p-4 rounded-md">
                            <p className="text-muted-foreground">Denne henvendelsen er lukket. Gjenåpne for å sende flere meldinger.</p>
                          </div>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                </div>
              ) : (
                // Vis liste over henvendelser når ingen er valgt
                <>
                  <div className="md:col-span-1">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle>Henvendelser</CardTitle>
                        <CardDescription>
                          {tickets.length === 0 
                            ? "Du har ingen henvendelser" 
                            : `Du har ${tickets.length} henvendelser`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[calc(100vh-20rem)]">
                          {isLoadingTickets ? (
                            <div className="flex flex-col gap-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="p-3 border rounded-md animate-pulse">
                                  <div className="h-4 w-3/4 mb-2 bg-gray-200 rounded"></div>
                                  <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
                                </div>
                              ))}
                            </div>
                          ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center p-4">
                              <Inbox className="h-12 w-12 mb-4 text-gray-400" />
                              <h3 className="text-lg font-medium mb-1">Ingen henvendelser</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Du har ikke opprettet noen henvendelser ennå
                              </p>
                              <Button onClick={() => setActiveTab("new")}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Ny henvendelse
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {tickets.map(ticket => (
                                <div 
                                  key={ticket.id}
                                  onClick={() => handleSelectTicket(ticket)}
                                  className={`p-3 border rounded-md cursor-pointer hover:border-primary transition-colors ${
                                    activeTicket?.id === ticket.id ? 'border-primary bg-primary/5' : ''
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-medium truncate">{ticket.title}</h4>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        ticket.status === 'closed' ? 'bg-red-100 text-red-800' : 
                                        ticket.status === 'in-progress' || ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {getStatusDisplay(ticket.status)}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{ticket.caseNumber}</span>
                                    <span>{format(new Date(ticket.updatedAt), 'dd.MM.yyyy')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Card className="h-full">
                      <CardHeader>
                        <CardTitle>Detaljer</CardTitle>
                        <CardDescription>
                          Velg en henvendelse fra listen for å se detaljer
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-center h-[calc(100vh-20rem)]">
                        <div className="text-center">
                          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-20" />
                          <h3 className="text-lg font-medium mb-2">Ingen henvendelse valgt</h3>
                          <p className="text-muted-foreground mb-4">
                            Velg en henvendelse fra listen til venstre
                          </p>
                          <Button onClick={() => setActiveTab("new")} variant="outline">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Opprett ny henvendelse
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Opprett ny henvendelse</CardTitle>
                <CardDescription>
                  Fyll ut skjemaet nedenfor for å opprette en ny henvendelse til kundeservice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label htmlFor="ticket-title" className="text-sm font-medium">
                        Tittel på henvendelse
                      </label>
                      <Input
                        id="ticket-title"
                        value={newTicketData.title}
                        onChange={(e) => setNewTicketData({ ...newTicketData, title: e.target.value })}
                        placeholder="Kort beskrivelse av henvendelsen (minst 3 tegn)"
                        minLength={3}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="ticket-category" className="text-sm font-medium">
                        Kategori
                      </label>
                      <Select
                        value={newTicketData.category}
                        onValueChange={(value) => setNewTicketData({ ...newTicketData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Velg kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="ticket-message" className="text-sm font-medium">
                        Melding
                      </label>
                      <Textarea
                        id="ticket-message"
                        value={newTicketData.message}
                        onChange={(e) => setNewTicketData({ ...newTicketData, message: e.target.value })}
                        placeholder="Beskriv henvendelsen din her..."
                        className="min-h-[150px]"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={
                      !newTicketData.title.trim() ||
                      !newTicketData.message.trim() ||
                      createTicketMutation.isPending
                    }
                    className="w-full"
                  >
                    {createTicketMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sender henvendelse...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Send henvendelse
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}