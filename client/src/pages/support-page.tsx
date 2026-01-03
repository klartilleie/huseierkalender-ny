import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle, 
  PlusCircle,
  Paperclip,
  Download,
  X,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

// Types
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

const ticketSchema = z.object({
  title: z.string().min(5, "Tittel må være minst 5 tegn"),
  category: z.string().min(1, "Velg en kategori"),
  priority: z.string().min(1, "Velg prioritet"),
  message: z.string().min(10, "Beskrivelse må være minst 10 tegn"),
  department: z.string().optional(),
  // Ekstra felt for avtaler
  meetingDate: z.string().optional(),
  meetingLocation: z.string().optional()
});

type TicketFormData = z.infer<typeof ticketSchema>;

const messageSchema = z.object({
  message: z.string().min(1, "Meldingen kan ikke være tom")
});

type MessageFormData = z.infer<typeof messageSchema>;

export default function SupportPage() {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<string>("tickets");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Fetch tickets
  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery<Ticket[]>({
    queryKey: ['/api/support/tickets'],
    enabled: true
  });

  // Fetch messages for active ticket
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<TicketMessage[]>({
    queryKey: ['/api/support/tickets', activeTicket?.id, 'messages'],
    enabled: !!activeTicket?.id
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketFormData) => {
      return apiRequest('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      toast({
        title: "Henvendelse opprettet",
        description: "Din henvendelse er registrert og vil bli behandlet snart."
      });
      setActiveTab("tickets");
      ticketForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; attachmentUrl?: string }) => {
      if (!activeTicket) throw new Error('Ingen aktiv sak');
      
      return apiRequest(`/api/support/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/support/tickets', activeTicket?.id, 'messages'] 
      });
      messageForm.reset();
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved sending",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', activeTicket?.id.toString() || '');
      
      return apiRequest('/api/support/upload', {
        method: 'POST',
        body: formData
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved filopplasting",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Forms
  const ticketForm = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      category: "",
      priority: "",
      message: "",
      department: "",
      meetingDate: "",
      meetingLocation: ""
    }
  });

  // Watch for category changes to show/hide appointment fields
  const selectedCategory = ticketForm.watch("category");

  const messageForm = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      message: ""
    }
  });

  const onSubmitTicket = (data: TicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const onSubmitMessage = async (data: MessageFormData) => {
    let attachmentUrl;
    
    if (selectedFile) {
      try {
        const uploadResult = await uploadFileMutation.mutateAsync(selectedFile);
        attachmentUrl = uploadResult.url;
      } catch (error) {
        return;
      }
    }

    sendMessageMutation.mutate({
      message: data.message,
      attachmentUrl
    });
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setActiveTicket(ticket);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fil for stor",
          description: "Maksimal filstørrelse er 10MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kundeservice</h1>
          <p className="text-gray-600">
            Send inn henvendelser og få hjelp fra vårt kundeservice-team
          </p>
        </div>

        <Tabs defaultValue="tickets" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="tickets">Mine henvendelser</TabsTrigger>
            <TabsTrigger value="new">Ny henvendelse</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tickets">
            <div className="grid md:grid-cols-3 gap-6">
              {!activeTicket && (
                <div className="md:col-span-1 tickets-list">
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
                                className={`p-3 border rounded-md cursor-pointer transition-colors hover:bg-gray-50 ${
                                  activeTicket?.id === ticket.id ? 'bg-blue-50 border-blue-200' : ''
                                }`}
                                onClick={() => handleSelectTicket(ticket)}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-blue-600">
                                    #{ticket.caseNumber}
                                  </span>
                                  <Badge 
                                    variant={ticket.status === 'open' ? 'destructive' : 
                                             ticket.status === 'in_progress' ? 'default' : 'secondary'}
                                  >
                                    {ticket.status === 'open' ? 'Åpen' :
                                     ticket.status === 'in_progress' ? 'Under behandling' : 'Lukket'}
                                  </Badge>
                                </div>
                                <h4 className="font-medium text-sm mb-1 truncate">{ticket.title}</h4>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{ticket.category}</span>
                                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {activeTicket ? (
                <div className="md:col-span-3">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {activeTicket.title}
                            <Badge 
                              variant={activeTicket.status === 'open' ? 'destructive' : 
                                       activeTicket.status === 'in_progress' ? 'default' : 'secondary'}
                            >
                              {activeTicket.status === 'open' ? 'Åpen' :
                               activeTicket.status === 'in_progress' ? 'Under behandling' : 'Lukket'}
                            </Badge>
                          </CardTitle>
                          <CardDescription>
                            Sak #{activeTicket.caseNumber} • {activeTicket.category} • 
                            Opprettet {format(new Date(activeTicket.createdAt), 'dd.MM.yyyy HH:mm')}
                          </CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => setActiveTicket(null)}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Tilbake
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-grow flex flex-col">
                      <ScrollArea className="flex-grow mb-4 h-[400px]">
                        <div className="space-y-4">
                          {isLoadingMessages ? (
                            <div className="flex justify-center p-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          ) : messages.length === 0 ? (
                            <div className="text-center p-4 text-muted-foreground">
                              Ingen meldinger ennå
                            </div>
                          ) : (
                            messages.map(msg => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.isAdminMessage ? 'justify-start' : 'justify-end'}`}
                              >
                                <div
                                  className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                                    msg.isAdminMessage
                                      ? 'bg-gray-100 text-gray-900'
                                      : 'bg-blue-600 text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    {msg.isAdminMessage ? (
                                      <User className="h-4 w-4" />
                                    ) : (
                                      <MessageSquare className="h-4 w-4" />
                                    )}
                                    <span className="text-xs opacity-70">
                                      {msg.isAdminMessage ? 'Kundeservice' : 'Du'}
                                    </span>
                                    <span className="text-xs opacity-70">
                                      {format(new Date(msg.createdAt), 'HH:mm')}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                  {msg.attachmentUrl && (
                                    <div className="mt-2">
                                      <a
                                        href={msg.attachmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100"
                                      >
                                        <Paperclip className="h-3 w-3" />
                                        Vedlegg
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>

                      {!activeTicket.isClosed && (
                        <div className="border-t pt-4">
                          <Form {...messageForm}>
                            <form onSubmit={messageForm.handleSubmit(onSubmitMessage)} className="space-y-4">
                              {selectedFile && (
                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                                  <Paperclip className="h-4 w-4" />
                                  <span className="text-sm flex-grow">{selectedFile.name}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={removeSelectedFile}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              <FormField
                                control={messageForm.control}
                                name="message"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Skriv din melding..."
                                        className="min-h-[80px]"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Paperclip className="h-4 w-4 mr-1" />
                                    Legg ved fil
                                  </Button>
                                </div>

                                <Button 
                                  type="submit" 
                                  disabled={sendMessageMutation.isPending}
                                >
                                  {sendMessageMutation.isPending ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  ) : (
                                    <Send className="h-4 w-4 mr-2" />
                                  )}
                                  Send
                                </Button>
                              </div>
                            </form>
                          </Form>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="md:col-span-2">
                  <Card className="h-full">
                    <CardContent className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                      <h3 className="text-lg font-medium mb-2">Ingen henvendelse valgt</h3>
                      <p className="text-muted-foreground">
                        Velg en henvendelse fra listen til venstre eller opprett en ny
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Opprett ny henvendelse</CardTitle>
                <CardDescription>
                  Fyll ut skjemaet under for å sende inn din henvendelse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...ticketForm}>
                  <form onSubmit={ticketForm.handleSubmit(onSubmitTicket)} className="space-y-6">
                    <FormField
                      control={ticketForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tittel</FormLabel>
                          <FormControl>
                            <Input placeholder="Kort beskrivelse av problemet" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={ticketForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kategori</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Velg kategori" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="technical">🔧 Teknisk støtte</SelectItem>
                                <SelectItem value="billing">💰 Fakturering</SelectItem>
                                <SelectItem value="account">👤 Konto</SelectItem>
                                <SelectItem value="calendar">📅 Kalender</SelectItem>
                                <SelectItem value="appointment">🤝 Avtale/Møte</SelectItem>
                                <SelectItem value="other">❓ Annet</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={ticketForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prioritet</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Velg prioritet" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Lav</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">Høy</SelectItem>
                                <SelectItem value="urgent">Kritisk</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Appointment-specific fields */}
                    {selectedCategory === "appointment" && (
                      <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="text-sm font-medium text-blue-800 flex items-center gap-2">
                          🤝 Avtale-detaljer
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={ticketForm.control}
                            name="meetingDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ønsket dato og tid</FormLabel>
                                <FormControl>
                                  <Input
                                    type="datetime-local"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={ticketForm.control}
                            name="meetingLocation"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Møtested</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="F.eks. Telefon, Kontor, Teams"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <FormField
                      control={ticketForm.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beskrivelse</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Beskriv ditt problem eller henvendelse i detalj..."
                              className="min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={createTicketMutation.isPending}
                    >
                      {createTicketMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send henvendelse
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}