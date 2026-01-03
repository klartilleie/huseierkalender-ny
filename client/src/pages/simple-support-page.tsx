import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import useDocumentTitle from "@/hooks/use-document-title";
import { format } from "date-fns";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cva } from "class-variance-authority";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Send,
} from "lucide-react";

// Type definitions for better type safety
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

export default function SimpleSupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Set document title
  useDocumentTitle("Kundeservice");
  
  // State management
  const [activeTab, setActiveTab] = useState("tickets");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newTicketData, setNewTicketData] = useState({
    title: "",
    category: "technical",
    message: ""
  });
  
  // Categories for ticket creation
  const categories = [
    { id: "technical", name: "Teknisk problem", color: "red" },
    { id: "billing", name: "Fakturering", color: "yellow" },
    { id: "support", name: "Kundestøtte", color: "blue" },
    { id: "info", name: "Informasjonsforespørsel", color: "gray" },
    { id: "complaint", name: "Klage", color: "red" }
  ];

  // Fetch user's tickets
  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery<Ticket[]>({
    queryKey: ['/api/cases'],
    enabled: !!user
  });

  // Fetch messages for active ticket
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages,
    refetch: refetchMessages 
  } = useQuery<TicketMessage[]>({
    queryKey: ['/api/cases', activeTicket?.id, 'messages'],
    enabled: !!activeTicket,
    refetchInterval: 5000 // Auto-refresh messages every 5 seconds
  });

  // Create new ticket
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
          priority: "medium", // Default priority
          status: "open",
          message: ticketData.message // Meldingen som skal sendes
        }),
      });
      
      if (!response.ok) {
        // Parse error response
        const errorData = await response.json();
        
        // Check if this is a validation error
        if (errorData.errors && Array.isArray(errorData.errors)) {
          // Format validation error messages
          const errorMessages = errorData.errors.map((err: any) => err.message).join('\n');
          throw new Error(errorMessages);
        }
        
        throw new Error('Kunne ikke opprette henvendelse. Vennligst prøv igjen.');
      }
      
      const newCase = await response.json();
      console.log("Ny sak opprettet:", newCase);
      return newCase;
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      
      // Sett den nyopprettede henvendelsen som aktiv
      setActiveTicket(newCase);
      setActiveTab("tickets");
      
      // Hvis serveren returnerte saken med meldinger, vis dem med en gang
      if (newCase.messages) {
        console.log(`Saken inneholder ${newCase.messages.length} meldinger direkte fra server`);
        // Oppdater React Query cache med meldingene vi fikk fra server
        queryClient.setQueryData(['/api/cases', newCase.id, 'messages'], newCase.messages);
      } else {
        // Hvis ikke, last meldingene
        queryClient.invalidateQueries({ queryKey: ['/api/cases', newCase.id, 'messages'] });
      }
      
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
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved opprettelse av henvendelse",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string }) => {
      const response = await fetch(`/api/cases/${activeTicket?.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageData.message,
          isAdmin: false
        }),
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke sende melding. Vennligst prøv igjen.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force an immediate refetch of messages
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['/api/cases', activeTicket?.id, 'messages'] });
      setNewMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke sende melding",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Scroll to bottom when new messages come in
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle create ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketData.title.trim() || !newTicketData.message.trim()) {
      toast({
        title: "Manglende informasjon",
        description: "Vennligst fyll ut både tittel og melding",
        variant: "destructive"
      });
      return;
    }
    
    createTicketMutation.mutate(newTicketData);
  };

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;
    sendMessageMutation.mutate({ message: newMessage });
  };

  // Custom badge styles with color classes instead of variants
  const getBadgeClass = (category: string, isStatus = false): string => {
    let classes = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
    
    if (isStatus) {
      switch (category) {
        case "closed":
          return `${classes} bg-red-100 text-red-800 border border-red-200`;
        case "resolved":
          return `${classes} bg-green-100 text-green-800 border border-green-200`;
        default:
          return `${classes} bg-blue-100 text-blue-800 border border-blue-200`;
      }
    }
    
    const categoryObj = categories.find(c => c.id === category);
    if (categoryObj) {
      switch (categoryObj.color) {
        case "red":
          return `${classes} bg-red-100 text-red-800 border border-red-200`;
        case "yellow":
          return `${classes} bg-amber-100 text-amber-800 border border-amber-200`;
        case "blue":
          return `${classes} bg-blue-100 text-blue-800 border border-blue-200`;
        default:
          return `${classes} bg-gray-100 text-gray-800 border border-gray-200`;
      }
    }
    return `${classes} bg-gray-100 text-gray-800 border border-gray-200`;
  };

  // Get category display name
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Kundeservice</h1>
          <Button 
            onClick={() => setActiveTab("new")}
            variant="default"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Ny henvendelse
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tickets">Mine henvendelser</TabsTrigger>
            <TabsTrigger value="new">Ny henvendelse</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tickets">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Henvendelser</CardTitle>
                    <CardDescription>
                      Dine henvendelser til kundeservice
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[70vh] p-4">
                      {isLoadingTickets ? (
                        <div className="flex justify-center p-4">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : tickets.length === 0 ? (
                        <div className="text-center p-4 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mb-2 mx-auto opacity-20" />
                          <p>Ingen henvendelser funnet</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => setActiveTab("new")}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Opprett ny henvendelse
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tickets.map((ticket) => (
                            <Card
                              key={ticket.id}
                              className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                                activeTicket?.id === ticket.id
                                  ? "bg-accent"
                                  : "bg-background"
                              }`}
                              onClick={() => setActiveTicket(ticket)}
                            >
                              <CardContent className="p-3">
                                <div className="flex flex-col">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-medium truncate mr-2">{ticket.title}</h4>
                                    <span className={getBadgeClass(ticket.status, true)}>
                                      {ticket.status === "open" ? "Åpen" : 
                                       ticket.status === "closed" ? "Lukket" : 
                                       ticket.status === "resolved" ? "Løst" : ticket.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className={`${getBadgeClass(ticket.category)} text-[10px]`}>
                                      {getCategoryName(ticket.category)}
                                    </span>
                                    <span>
                                      {format(new Date(ticket.createdAt), "dd.MM.yyyy")}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              <div className="lg:col-span-2">
                {activeTicket ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col space-y-1.5">
                        <div className="flex items-center justify-between">
                          <CardTitle>{activeTicket.title}</CardTitle>
                          <span className={getBadgeClass(activeTicket.status, true)}>
                            {activeTicket.status === "open" ? "Åpen" : 
                             activeTicket.status === "closed" ? "Lukket" : 
                             activeTicket.status === "resolved" ? "Løst" : activeTicket.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={getBadgeClass(activeTicket.category)}>
                            {getCategoryName(activeTicket.category)}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(activeTicket.createdAt), "dd MMM yyyy, HH:mm")}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="flex flex-col h-[400px]">
                        <ScrollArea className="flex-1 p-4">
                          {isLoadingMessages ? (
                            <div className="flex items-center justify-center h-full">
                              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="text-center h-full flex flex-col items-center justify-center text-muted-foreground">
                              <MessageSquare className="h-12 w-12 mb-2 opacity-20" />
                              <p>Ingen meldinger i denne henvendelsen ennå</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {messages.map((msg: TicketMessage) => {
                                const isUserMessage = msg.senderId === user?.id;
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex ${
                                      isUserMessage ? "justify-end" : "justify-start"
                                    }`}
                                  >
                                    <div
                                      className={`rounded-lg p-3 max-w-[80%] ${
                                        isUserMessage
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted"
                                      }`}
                                    >
                                      <div className="flex items-center space-x-2 mb-1">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {isUserMessage ? user?.name?.charAt(0)?.toUpperCase() || "U" : "A"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium">
                                          {isUserMessage ? user?.name : "Support Team"}
                                        </span>
                                        <span className="text-xs opacity-70">
                                          {format(new Date(msg.createdAt), "HH:mm")}
                                        </span>
                                      </div>
                                      <p className="whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                  </div>
                                );
                              })}
                              <div ref={messagesEndRef} />
                            </div>
                          )}
                        </ScrollArea>
                        
                        {activeTicket.status !== "closed" && (
                          <div className="p-4 border-t">
                            <form onSubmit={handleSendMessage} className="flex space-x-2">
                              <Textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Skriv din melding her..."
                                className="flex-1 min-h-[60px] max-h-[120px]"
                              />
                              <Button
                                type="submit"
                                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                                className="self-end"
                              >
                                {sendMessageMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </form>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-full">
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                      <h3 className="text-lg font-medium mb-2">Ingen henvendelse valgt</h3>
                      <p className="text-muted-foreground">
                        Velg en henvendelse fra listen til venstre
                      </p>
                    </div>
                  </Card>
                )}
              </div>
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
                        placeholder="Kort beskrivelse av henvendelsen"
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