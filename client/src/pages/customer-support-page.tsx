import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/hooks/use-language";
import useDocumentTitle from "@/hooks/use-document-title";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, PlusCircle, CheckCircle } from "lucide-react";

import SupportTicketList from "@/components/customer-support/SupportTicketList";
import SupportTicketDetails from "@/components/customer-support/SupportTicketDetails";
import CreateTicketDialog from "@/components/customer-support/CreateTicketDialog";

// Type definitions for better type safety
type SupportTicket = {
  id: number;
  userId: number;
  adminId: number | null;
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
};

export default function CustomerSupportPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("open");
  
  // Set document title
  useDocumentTitle(t("caseManagement.pageTitle"));

  // Query to get all tickets
  const { 
    data: tickets = [], 
    isLoading: isLoadingTickets 
  } = useQuery<SupportTicket[]>({
    queryKey: ['/api/cases'],
    enabled: !!user,
  });

  // Create new ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async (formData: any) => {
      console.log("Sending message:", formData.message);
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create support ticket');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("caseManagement.caseCreatedTitle"),
        description: t("caseManagement.caseCreatedDescription"),
      });
      setIsNewTicketDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
    },
    onError: (error: Error) => {
      toast({
        title: t("caseManagement.errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter tickets by open/closed status
  const openTickets = tickets.filter(ticket => !ticket.isClosed) || [];
  const closedTickets = tickets.filter(ticket => ticket.isClosed) || [];

  // Handle creating a new ticket
  const handleCreateTicket = (formData: any) => {
    createTicketMutation.mutate(formData);
  };

  // Handle selecting a ticket to view
  const handleSelectTicket = (ticketId: number) => {
    setSelectedTicketId(ticketId);
  };

  return (
    <Layout>
      <div className="container p-4 mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t("caseManagement.title")}</h1>
          <Button onClick={() => setIsNewTicketDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            {t("caseManagement.newCase")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left panel - Ticket list */}
          <div className="md:col-span-1">
            <Tabs 
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="open" className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span>{t("caseManagement.openCases")}</span>
                  {openTickets.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {openTickets.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span>{t("caseManagement.closedCases")}</span>
                  {closedTickets.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {closedTickets.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="mt-4">
                <SupportTicketList
                  tickets={openTickets}
                  isLoading={isLoadingTickets}
                  noTicketsMessage={t("caseManagement.noOpenCases")}
                  noTicketsDescription={t("caseManagement.noOpenCasesDescription")}
                  onCreateTicket={() => setIsNewTicketDialogOpen(true)}
                  onSelectTicket={handleSelectTicket}
                  selectedTicketId={selectedTicketId}
                />
              </TabsContent>

              <TabsContent value="closed" className="mt-4">
                <SupportTicketList
                  tickets={closedTickets}
                  isLoading={isLoadingTickets}
                  noTicketsMessage={t("caseManagement.noClosedCases")}
                  noTicketsDescription={t("caseManagement.noClosedCasesDescription")}
                  onSelectTicket={handleSelectTicket}
                  selectedTicketId={selectedTicketId}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right panel - Ticket details or placeholder */}
          <div className="md:col-span-2">
            {selectedTicketId ? (
              <SupportTicketDetails 
                ticketId={selectedTicketId} 
                onClose={() => setSelectedTicketId(null)} 
              />
            ) : (
              <div className="border rounded-lg p-8 h-full flex flex-col items-center justify-center text-center bg-muted/20">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t("caseManagement.noCaseSelected")}</h2>
                <p className="text-muted-foreground max-w-md">
                  {t("caseManagement.selectCaseDescription")}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => setIsNewTicketDialogOpen(true)}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t("caseManagement.createFirstCase")}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Create new ticket dialog */}
        <CreateTicketDialog
          open={isNewTicketDialogOpen}
          onOpenChange={setIsNewTicketDialogOpen}
          onSubmit={handleCreateTicket}
          isSubmitting={createTicketMutation.isPending}
        />
      </div>
    </Layout>
  );
}