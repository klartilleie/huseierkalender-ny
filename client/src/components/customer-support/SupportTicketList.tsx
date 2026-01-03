import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, 
  MessageSquare, 
  ChevronRight, 
  Tag,
  UserCheck 
} from "lucide-react";

type Ticket = {
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

interface SupportTicketListProps {
  tickets: Ticket[];
  isLoading: boolean;
  noTicketsMessage: string;
  noTicketsDescription: string;
  onCreateTicket?: () => void;
  onSelectTicket: (ticketId: number) => void;
  selectedTicketId: number | null;
}

export default function SupportTicketList({
  tickets,
  isLoading,
  noTicketsMessage,
  noTicketsDescription,
  onCreateTicket,
  onSelectTicket,
  selectedTicketId
}: SupportTicketListProps) {
  const { t } = useTranslation();

  // Render ticket priority badge
  const renderPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive">{t("caseManagement.priorityHigh")}</Badge>;
      case 'medium':
        return <Badge variant="default">{t("caseManagement.priorityMedium")}</Badge>;
      case 'low':
        return <Badge variant="outline">{t("caseManagement.priorityLow")}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Render ticket status badge
  const renderStatusBadge = (status: string, isClosed?: boolean) => {
    if (isClosed) {
      return <Badge variant="destructive">{t("caseManagement.closed")}</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case 'open':
        return <Badge variant="secondary">{t("caseManagement.statusOpen")}</Badge>;
      case 'in_progress':
        return <Badge variant="default">{t("caseManagement.statusInProgress")}</Badge>;
      case 'resolved':
        return <Badge variant="success">{t("caseManagement.statusResolved")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Render a ticket card
  const renderTicketCard = (ticket: Ticket) => (
    <Card 
      key={ticket.id} 
      className={`mb-4 hover:shadow-md transition-shadow ${
        selectedTicketId === ticket.id ? 'border-primary' : ''
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">{ticket.title}</CardTitle>
          {renderPriorityBadge(ticket.priority)}
        </div>
        <CardDescription className="flex items-center space-x-1 text-sm">
          <Tag className="h-3.5 w-3.5" />
          <span>{ticket.caseNumber}</span>
          <span>•</span>
          <Clock className="h-3.5 w-3.5" />
          <span>{format(new Date(ticket.createdAt), 'dd.MM.yyyy')}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex space-x-2 items-center">
          <span className="font-medium text-sm">{t("caseManagement.category")}:</span>
          <span className="text-sm">{ticket.category}</span>
        </div>
        <div className="flex space-x-2 items-center mt-1">
          <span className="font-medium text-sm">{t("caseManagement.status")}:</span>
          {renderStatusBadge(ticket.status, ticket.isClosed)}
        </div>
        {ticket.adminId && (
          <div className="flex space-x-2 items-center mt-1">
            <span className="font-medium text-sm">{t("caseManagement.assignedToAdmin")}:</span>
            <span className="text-sm flex items-center">
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              {t("caseManagement.customerService")}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          variant="ghost" 
          size="sm" 
          className="ml-auto" 
          onClick={() => onSelectTicket(ticket.id)}
        >
          {t("caseManagement.viewCase")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="spinner" />
        <p className="mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/20">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">{noTicketsMessage}</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          {noTicketsDescription}
        </p>
        {onCreateTicket && (
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={onCreateTicket}
          >
            {t("caseManagement.createFirstCase")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-300px)] pr-4">
      {tickets.map(ticket => renderTicketCard(ticket))}
    </ScrollArea>
  );
}