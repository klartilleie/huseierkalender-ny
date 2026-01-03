import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PlusCircle,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Send,
  User,
  Tag,
  Clock,
  RefreshCw
} from "lucide-react";

// Type definitions based on our schema
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

export default function SupportTicketPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [newTicketData, setNewTicketData] = useState({
    title: "",
    category: "technical",
    message: ""
  });
  
  // Categories for ticket creation with direct Norwegian text
  const categories = [
    { id: "technical", name: "Teknisk problem", color: "red" },
    { id: "billing", name: "Fakturering", color: "yellow" },
    { id: "support", name: "Kundestøtte", color: "blue" },
    { id: "info", name: "Informasjonsforespørsel", color: "gray" },
    { id: "complaint", name: "Klage", color: "red" }
  ];

  // Fetch user's tickets
  const { data: tickets = [] as Ticket[], isLoading: isLoadingTickets } = useQuery<Ticket[]>({
    queryKey: ['/api/cases'],
    enabled: !!user
  });

  // Fetch messages for active ticket
  const { data: messages = [] as TicketMessage[], isLoading: isLoadingMessages, refetch: refetchMessages } = useQuery<TicketMessage[]>({
    queryKey: ['/api/cases', activeTicket?.id, 'messages'],
    enabled: !!activeTicket,
    refetchInterval: 2000 // Auto-refetch every 2 seconds to show new messages
  });

  // Create new ticket
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ticketData)
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke opprette henvendelse. Vennligst prøv igjen senere.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Henvendelse sendt",
        description: "Din henvendelse er mottatt og vil bli behandlet av kundeservice",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      setNewTicketData({ title: "", category: "technical", message: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "En feil oppstod",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Send message in active ticket
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const response = await fetch(`/api/cases/${activeTicket?.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        throw new Error('Kunne ikke sende melding. Vennligst prøv igjen.');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Force an immediate refetch of messages to show the new message
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

  // Handle creating a new ticket
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTicketData.title.trim() || !newTicketData.message.trim()) {
      toast({
        title: t("caseManagement.error"),
        description: t("caseManagement.fillRequiredFields"),
        variant: "destructive"
      });
      return;
    }
    
    createTicketMutation.mutate({
      title: newTicketData.title,
      category: newTicketData.category,
      priority: "medium", // Endret fra "normal" til "medium" som er en gyldig verdi
      message: newTicketData.message
    });
  };

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !activeTicket) return;
    
    sendMessageMutation.mutate({
      message: newMessage,
      isAdmin: false
    });
  };

  // Render the badge for a category
  const renderCategoryBadge = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return null;
    
    const variantMap: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      "red": "destructive",
      "yellow": "outline",
      "blue": "default",
      "gray": "secondary"
    };
    
    return (
      <Badge variant={variantMap[category.color] || "default"}>
        {category.name}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Kundeservice henvendelser</h1>
        </div>
        
        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="tickets">
              <MessageSquare className="h-4 w-4 mr-2" />
              Mine henvendelser
            </TabsTrigger>
            <TabsTrigger value="new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Ny henvendelse
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tickets">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tickets list */}
              <div className="md:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Henvendelsesliste</CardTitle>
                    <CardDescription>
                      Dine kundeservice henvendelser
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTickets ? (
                      <div className="flex items-center justify-center p-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : tickets.length === 0 ? (
                      <div className="text-center p-6 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Ingen henvendelser funnet</p>
                        <p className="text-sm mt-1">Opprett din første henvendelse ved å klikke på 'Ny henvendelse'</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[500px]">
                        <div className="space-y-2">
                          {tickets.map((ticket: Ticket) => (
                            <div
                              key={ticket.id}
                              className={`p-3 rounded-md cursor-pointer transition-colors ${
                                activeTicket?.id === ticket.id
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-muted/50 border-transparent"
                              } border`}
                              onClick={() => setActiveTicket(ticket)}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="font-medium line-clamp-1">{ticket.title}</div>
                                  <div className="flex items-center mt-1 space-x-2">
                                    {renderCategoryBadge(ticket.category)}
                                    <div className="text-xs text-muted-foreground">
                                      {format(new Date(ticket.createdAt), "dd MMM yyyy")}
                                    </div>
                                  </div>
                                </div>
                                <Badge
                                  variant={
                                    ticket.status === "closed"
                                      ? "destructive"
                                      : ticket.status === "resolved"
                                      ? "outline"
                                      : "default"
                                  }
                                >
                                  {ticket.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Ticket details */}
              <div className="md:col-span-2">
                {activeTicket ? (
                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{activeTicket.title}</CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            {renderCategoryBadge(activeTicket.category)}
                            <Badge 
                              variant={
                                activeTicket.status === "closed"
                                  ? "destructive"
                                  : activeTicket.status === "resolved"
                                  ? "outline"
                                  : "default"
                              }
                            >
                              {activeTicket.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground flex items-center justify-end">
                            <Clock className="h-3 w-3 mr-1" />
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