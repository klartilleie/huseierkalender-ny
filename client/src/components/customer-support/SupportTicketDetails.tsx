import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Send,
  Clock,
  Tag,
  User,
  UserCheck,
  CheckCircle,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Types used in this component
type SupportTicket = {
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
};

type SupportMessage = {
  id: number;
  caseId: number;
  senderId: number;
  targetUserId: number | null;
  message: string;
  isAdminMessage: boolean;
  isRead: boolean;
  createdAt: string;
  attachmentUrl: string | null;
};

type AdminUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

interface SupportTicketDetailsProps {
  ticketId: number;
  onClose: () => void;
}

export default function SupportTicketDetails({ ticketId, onClose }: SupportTicketDetailsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isClosingTicket, setIsClosingTicket] = useState(false);
  const [isReopeningTicket, setIsReopeningTicket] = useState(false);

  // Fetch ticket details
  const {
    data: ticketDetails,
    isLoading: isLoadingTicket,
  } = useQuery<SupportTicket>({
    queryKey: ['/api/cases', ticketId],
    enabled: !!ticketId,
  });

  // Fetch ticket messages using the dedicated endpoint
  const {
    data: messages,
    isLoading: isLoadingMessages,
  } = useQuery<SupportMessage[]>({
    queryKey: ['/api/cases', ticketId, 'messages'],
    enabled: !!ticketId,
    // Use the new dedicated endpoint for messages
    queryFn: async () => {
      const response = await fetch(`/api/cases/${ticketId}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      return response.json();
    },
    select: (data) => {
      // Ensure we have valid data and sort by createdAt
      if (!data || !Array.isArray(data)) return [];
      
      // Log data to help debug
      console.log("Message data from API:", data);
      
      // Filter out any null messages
      const validMessages = data.filter(msg => msg !== null);
      
      return [...validMessages].sort((a, b) => {
        // Safely handle potential invalid dates
        try {
          const dateA = new Date(a.createdAt || Date.now()).getTime();
          const dateB = new Date(b.createdAt || Date.now()).getTime();
          if (isNaN(dateA) || isNaN(dateB)) return 0;
          return dateA - dateB;
        } catch (error) {
          console.error("Error sorting dates:", error);
          return 0;
        }
      });
    },
  });

  // Fetch admin users for identifying message senders
  const { data: adminUsers } = useQuery<AdminUser[]>({
    queryKey: ['/api/admin/users'],
    enabled: user?.isAdmin,
  });

  // Send a new message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      console.log("Sending message:", messageText);
      const response = await fetch(`/api/cases/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }

      return await response.json();
    },
    onSuccess: () => {
      setNewMessage(""); // Clear the message input
      queryClient.invalidateQueries({ queryKey: ['/api/cases', ticketId, 'messages'] });
      // Scroll to bottom after refresh
      setTimeout(() => {
        scrollToBottom();
      }, 300);
    },
    onError: (error: Error) => {
      toast({
        title: t("caseManagement.errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cases/${ticketId}/close`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to close case');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("caseManagement.caseClosed"),
        description: t("caseManagement.caseClosedDescription"),
      });
      setIsClosingTicket(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases', ticketId] });
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

  // Reopen ticket mutation
  const reopenTicketMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/cases/${ticketId}/reopen`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reopen case');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("caseManagement.caseReopened"),
        description: t("caseManagement.caseReopenedDescription"),
      });
      setIsReopeningTicket(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases', ticketId] });
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

  // Handle send message button click
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  // Handle pressing Enter to send the message
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to the most recent message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Render priority badge
  const renderPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
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

  // Render status badge
  const renderStatusBadge = (status: string | null | undefined) => {
    if (!status) {
      return <Badge variant="outline">{t("caseManagement.statusOpen")}</Badge>;
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

  // Function to render individual message
  const renderMessage = (message: SupportMessage) => {
    // Safety check for invalid message object
    if (!message || typeof message !== 'object') {
      console.error("Invalid message object:", message);
      return null;
    }
    
    const isCurrentUserMessage = user?.isAdmin ? 
      !!message.isAdminMessage : !message.isAdminMessage;
    
    // Format date for display
    let formattedDate = "";
    try {
      if (message.createdAt) {
        const messageDate = new Date(message.createdAt);
        if (!isNaN(messageDate.getTime())) {
          formattedDate = format(messageDate, 'HH:mm dd.MM.yyyy');
        } else {
          formattedDate = t("caseManagement.dateNotAvailable");
        }
      } else {
        formattedDate = t("caseManagement.dateNotAvailable");
      }
    } catch (error) {
      formattedDate = t("caseManagement.dateNotAvailable");
      console.error("Error formatting date:", error);
    }

    // Get sender name
    let sender;
    if (message.isAdminMessage) {
      // For admin messages, find sender in admin users list
      const adminUser = adminUsers?.find(admin => admin.id === message.senderId);
      sender = adminUser?.name || adminUser?.username || t("caseManagement.administrator");
    } else {
      // For regular user messages
      if (ticketDetails && message.senderId === ticketDetails.userId) {
        // If message is from case owner
        const user = adminUsers?.find(u => u.id === ticketDetails.userId);
        sender = user?.name || user?.username || t("caseManagement.caseOwner");
      } else {
        // For other non-admin users
        const user = adminUsers?.find(u => u.id === message.senderId);
        sender = user?.name || user?.username || t("caseManagement.user");
      }
    }

    // Get target user info (for admin messages)
    let targetInfo = null;
    if (message.isAdminMessage && message.targetUserId) {
      const targetUser = adminUsers?.find(user => user.id === message.targetUserId);
      if (targetUser) {
        targetInfo = (
          <span className="text-xs font-medium bg-muted/30 rounded px-1.5 py-0.5 inline-flex items-center">
            <User className="h-3 w-3 mr-1" />
            {t("caseManagement.toUser")}: {targetUser.name || targetUser.username || t("common.user")}
          </span>
        );
      }
    }

    return (
      <div 
        key={message.id} 
        className={`mb-4 ${isCurrentUserMessage ? 'ml-auto' : 'mr-auto'} max-w-[80%]`}
      >
        <div className={`flex items-start gap-2 ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'}`}>
          <Avatar className={`h-8 w-8 ${isCurrentUserMessage ? 'bg-primary/20' : 'bg-muted'}`}>
            <AvatarFallback>
              {message.isAdminMessage ? 'A' : 'U'}
            </AvatarFallback>
          </Avatar>

          <div>
            {/* Sender and timestamp */}
            <div className={`text-xs text-muted-foreground mb-1 flex items-center gap-1 ${
                isCurrentUserMessage ? 'justify-end' : 'justify-start'
              }`
            }>
              <span>{sender}</span>
              <span>•</span>
              <span>{formattedDate}</span>
              {targetInfo && <span className="ml-1">{targetInfo}</span>}
            </div>
            
            {/* Message content */}
            <div 
              className={`rounded-lg px-3 py-2 whitespace-pre-wrap break-words ${
                isCurrentUserMessage 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.message && message.message.trim() 
                ? message.message 
                : t("caseManagement.emptyMessage", "<Tom melding>")}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Determine if user can close/reopen the case
  const canCloseCase = ticketDetails && !ticketDetails.isClosed;
  const canReopenCase = ticketDetails && ticketDetails.isClosed;

  if (isLoadingTicket) {
    return (
      <div className="h-full flex flex-col border rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="spinner mx-auto" />
            <p className="mt-2">{t("common.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticketDetails) {
    return (
      <div className="h-full flex flex-col border rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p>{t("caseManagement.ticketNotFound")}</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              {t("common.back")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Close case confirmation dialog */}
      <Dialog open={isClosingTicket} onOpenChange={setIsClosingTicket}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("caseManagement.closeCaseTitle")}</DialogTitle>
            <DialogDescription>
              {t("caseManagement.closeCaseDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              {t("caseManagement.closeCaseConfirmation")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsClosingTicket(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              onClick={() => closeTicketMutation.mutate()}
              disabled={closeTicketMutation.isPending}
            >
              {closeTicketMutation.isPending ? t("common.processing") : t("caseManagement.confirmClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen case dialog */}
      <Dialog open={isReopeningTicket} onOpenChange={setIsReopeningTicket}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("caseManagement.reopenCaseTitle")}</DialogTitle>
            <DialogDescription>
              {t("caseManagement.reopenCaseDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">
              {t("caseManagement.reopenCaseConfirmation")}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReopeningTicket(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              onClick={() => reopenTicketMutation.mutate()}
              disabled={reopenTicketMutation.isPending}
            >
              {reopenTicketMutation.isPending ? t("common.processing") : t("caseManagement.confirmReopen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main content */}
      <div className="h-full flex flex-col border rounded-lg overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("common.back")}
            </Button>
            <div className="flex items-center gap-2">
              {canCloseCase && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsClosingTicket(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t("caseManagement.closeCase")}
                </Button>
              )}
              {canReopenCase && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsReopeningTicket(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("caseManagement.reopenCase")}
                </Button>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold">{ticketDetails.title}</h2>

          {/* Case details in compact format */}
          <div className="flex flex-wrap gap-2 items-center mt-2">
            <div className="flex items-center text-sm text-muted-foreground">
              <Tag className="h-3.5 w-3.5 mr-1" />
              {ticketDetails.caseNumber}
            </div>
            {renderPriorityBadge(ticketDetails.priority)}
            {renderStatusBadge(ticketDetails.status)}
            {ticketDetails.isClosed && (
              <Badge variant="destructive">{t("caseManagement.closed")}</Badge>
            )}
          </div>
          
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            <div className="flex items-center">
              <span className="font-medium mr-1">{t("caseManagement.category")}:</span>
              <span>{ticketDetails.category}</span>
            </div>
            
            <div className="flex items-center">
              <span className="font-medium mr-1">{t("caseManagement.created")}:</span>
              <span>
              {ticketDetails.createdAt ? format(new Date(ticketDetails.createdAt), 'dd.MM.yyyy HH:mm') : ""}
            </span>
            </div>
            
            {ticketDetails.adminId && (
              <div className="flex items-center">
                <span className="font-medium mr-1">{t("caseManagement.assignedToAdmin")}:</span>
                <UserCheck className="h-3.5 w-3.5 mr-1" />
                <span>{t("caseManagement.customerService")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages section */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <h3 className="text-lg font-medium mb-3">{t("caseManagement.messages")}</h3>
          
          <ScrollArea className="flex-1 pr-4">
            {isLoadingMessages ? (
              <div className="text-center py-8">
                <div className="spinner" />
                <p className="mt-2">{t("common.loading")}</p>
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="text-center py-8 bg-muted/10 rounded-lg">
                <div className="mx-auto h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="mt-3 text-base font-medium">{t("caseManagement.noMessages")}</h4>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  {t("caseManagement.noMessagesDescription")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  if (!message) return null;
                  // Debug message content to console
                  console.log("Rendering message:", message.id, message.message);
                  return (
                    <div key={message.id || `msg-${index}`}>
                      {renderMessage(message)}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Message input */}
        {!ticketDetails.isClosed && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("caseManagement.typeMessage")}
                className="min-h-[80px]"
                disabled={sendMessageMutation.isPending}
              />
              <Button
                className="self-end"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                onClick={handleSendMessage}
              >
                {sendMessageMutation.isPending ? (
                  <div className="spinner h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Case closed notice */}
        {ticketDetails.isClosed && (
          <div className="p-4 border-t bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground">
              {t("caseManagement.caseClosedCannotReply")}
            </p>
            {user && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => setIsReopeningTicket(true)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                {t("caseManagement.reopenToReply")}
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}