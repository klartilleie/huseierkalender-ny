import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User, IcalFeed, InsertIcalFeed, Event } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import MonthView from "@/components/calendar/MonthView";
import SystemSettings from "@/components/admin/SystemSettings";
import BackupManager from "@/components/admin/BackupManager";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Trash2, 
  Edit, 
  UserPlus, 
  Calendar, 
  Users, 
  Link as LinkIcon, 
  Plus,
  ExternalLink,
  PaintBucket,
  Palette,
  LayoutDashboard,
  RefreshCw,
  AlertCircle,
  RotateCw,
  Database,
  Lock,
  Unlock,
  Ban,
  KeyRound,
  ClipboardCopy,
  Copy
} from "lucide-react";

// No need for a custom interface since User now includes isAdmin
type AdminUser = User;

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  // User management states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isCalendarViewOpen, setIsCalendarViewOpen] = useState(false);
  const [userCalendarId, setUserCalendarId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    isAdmin: false,
  });
  const [newUserIcalImport, setNewUserIcalImport] = useState({
    url: "",
    name: "",
    enabled: true,
  });
  
  // Password management states
  const [resetLink, setResetLink] = useState("");
  const [isResetLinkDialogOpen, setIsResetLinkDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [userIdForPasswordChange, setUserIdForPasswordChange] = useState<number | null>(null);
  const [userNameForPasswordChange, setUserNameForPasswordChange] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  
  // iCal feed management states 
  const [isCreateIcalDialogOpen, setIsCreateIcalDialogOpen] = useState(false);
  const [isEditIcalDialogOpen, setIsEditIcalDialogOpen] = useState(false);
  const [selectedIcalFeed, setSelectedIcalFeed] = useState<IcalFeed | null>(null);
  const [newIcalFeed, setNewIcalFeed] = useState<InsertIcalFeed>({
    name: "",
    url: "",
    color: "#e11d48", // Red color by default
    enabled: true,
    userId: currentUser?.id || 0, // Set default userId to current user
  });
  
  // Design management is now handled by the SystemSettings component

  // Query to fetch all users
  const {
    data: users,
    isLoading,
    error,
  } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      return response.json();
    },
  });
  
  // Password management mutations
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number, newPassword: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/change-password`, { newPassword });
    },
    onSuccess: () => {
      toast({
        title: "Passord endret",
        description: "Brukerens passord har blitt endret",
        variant: "default",
      });
      setIsChangePasswordDialogOpen(false);
      setNewPassword("");
      setUserIdForPasswordChange(null);
      setUserNameForPasswordChange(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke endre passord: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const generatePasswordResetLinkMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reset-password`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tilbakestillingslenke generert",
        description: "Kopier lenken og send den til brukeren",
        variant: "default",
      });
      // Vis tilbakestillingslenken til admin
      setResetLink(data.resetLink);
      setIsResetLinkDialogOpen(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke generere tilbakestillingslenke: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Query to fetch all iCal feeds
  const {
    data: icalFeeds,
    isLoading: isIcalLoading,
    error: icalError,
  } = useQuery<IcalFeed[]>({
    queryKey: ["/api/ical-feeds"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ical-feeds");
      return response.json();
    },
  });
  
  // Query to fetch all users' iCal feeds (for admin view)
  const {
    data: allUsersIcalFeeds,
    isLoading: isAllUsersIcalLoading,
    error: allUsersIcalError,
  } = useQuery<(IcalFeed & { userInfo: { id: number, username: string, name: string, email?: string } })[]>({
    queryKey: ["/api/admin/all-ical-feeds"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/all-ical-feeds");
      return response.json();
    },
    enabled: !!currentUser?.isAdmin, // Only fetch if user is admin
  });
  
  // Query to fetch user's events
  const {
    data: userEvents = [],
    isLoading: isUserEventsLoading,
    error: userEventsError,
  } = useQuery<Event[]>({
    queryKey: ["/api/admin/user-events", userCalendarId],
    queryFn: async () => {
      if (!userCalendarId) return [];
      const response = await apiRequest("GET", `/api/admin/user-events/${userCalendarId}`);
      return response.json();
    },
    enabled: !!userCalendarId && isCalendarViewOpen,
  });

  // Mutation to create a new user
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const response = await apiRequest("POST", "/api/admin/users", userData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bruker opprettet",
        description: "Ny bruker har blitt lagt til",
        variant: "default",
      });
      setIsCreateDialogOpen(false);
      setNewUser({
        username: "",
        name: "",
        email: "",
        password: "",
        isAdmin: false,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke opprette bruker: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to update a user
  const updateUserMutation = useMutation({
    mutationFn: async (userData: AdminUser) => {
      const response = await apiRequest(
        "PUT",
        `/api/admin/users/${userData.id}`,
        userData
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bruker oppdatert",
        description: "Brukerinformasjonen har blitt oppdatert",
        variant: "default",
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke oppdatere bruker: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Bruker slettet",
        description: "Brukeren har blitt slettet fra systemet",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke slette bruker: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to create a new iCal feed
  const createIcalFeedMutation = useMutation({
    mutationFn: async (feedData: InsertIcalFeed) => {
      const response = await apiRequest("POST", "/api/ical-feeds", feedData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "iCal Feed opprettet",
        description: "Ny iCal feed har blitt lagt til",
        variant: "default",
      });
      setIsCreateIcalDialogOpen(false);
      setNewIcalFeed({
        name: "",
        url: "",
        color: "#e11d48",
        enabled: true,
        userId: currentUser?.id || 0,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-ical-feeds"] });
      
      // Automatisk synkroniser den nye feeden for å hente all informasjon umiddelbart
      if (data && data.id) {
        toast({
          title: "Synkroniserer kalender",
          description: "Henter hendelser fra den nye kalenderen...",
          variant: "default",
        });
        syncIcalFeedMutation.mutate(data.id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke opprette iCal feed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to update an iCal feed
  const updateIcalFeedMutation = useMutation({
    mutationFn: async (feedData: IcalFeed) => {
      const { id, ...updateData } = feedData;
      const response = await apiRequest(
        "PUT",
        `/api/ical-feeds/${id}`,
        updateData
      );
      const jsonData = await response.json();
      return { ...jsonData, id };
    },
    onSuccess: (data) => {
      toast({
        title: "iCal Feed oppdatert",
        description: "Feed-informasjon har blitt oppdatert",
        variant: "default",
      });
      
      // Automatically sync the updated feed if the URL was changed
      const feedId = data.id;
      const wasUrlUpdated = selectedIcalFeed && selectedIcalFeed.url !== data.url;
      
      setIsEditIcalDialogOpen(false);
      setSelectedIcalFeed(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-ical-feeds"] });
      
      // Always sync after update to ensure fresh data
      if (feedId) {
        syncIcalFeedMutation.mutate(feedId);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke oppdatere iCal feed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete an iCal feed
  const deleteIcalFeedMutation = useMutation({
    mutationFn: async (feedId: number) => {
      await apiRequest("DELETE", `/api/ical-feeds/${feedId}`);
    },
    onSuccess: () => {
      toast({
        title: "iCal Feed slettet",
        description: "Feeden har blitt slettet fra systemet",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke slette iCal feed: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to sync an iCal feed
  const syncIcalFeedMutation = useMutation({
    mutationFn: async (feedId: number) => {
      // Marker denne feeden som synkroniseres
      setSyncingFeeds((prev) => [...prev, feedId]);
      try {
        const response = await apiRequest("POST", `/api/ical-feeds/${feedId}/sync`);
        return { feedId, data: await response.json() };
      } catch (error) {
        // Fjern fra synkroniseringslisten ved feil
        setSyncingFeeds((prev) => prev.filter(id => id !== feedId));
        throw error;
      }
    },
    onSuccess: (result) => {
      const { feedId, data } = result;
      
      // Fjern fra synkroniseringslisten
      setSyncingFeeds((prev) => prev.filter(id => id !== feedId));
      
      toast({
        title: "Synkronisering vellykket",
        description: `${data.message}${data.syncedCount ? ` (${data.syncedCount} hendelser)` : ''}`,
        variant: "default",
      });
      
      // Manuelt oppdater data i queryClient cache for umiddelbar UI-oppdatering
      const now = new Date();
      const updateCache = (oldData: any[] | undefined, feedId: number) => {
        if (!oldData) return oldData;
        return oldData.map(feed => {
          if (feed.id === feedId) {
            return { ...feed, lastSynced: now.toISOString() };
          }
          return feed;
        });
      };
      
      // Oppdater cachen for både admin og bruker feeds
      queryClient.setQueryData(["/api/ical-feeds"], oldData => updateCache(oldData, feedId));
      queryClient.setQueryData(["/api/admin/all-ical-feeds"], oldData => updateCache(oldData, feedId));
      
      // Force refetch av andre query-er som avhenger av iCal-data
      queryClient.refetchQueries({ queryKey: ["/api/ical-feed-events"] });
      queryClient.refetchQueries({ queryKey: ["/api/events"] });
      
      // Oppdater dato i UI-elementet til å vise nåværende tid
      setLastSyncTime(now);
    },
    onError: (error: Error, feedId: number) => {
      // Fjern fra synkroniseringslisten ved feil
      setSyncingFeeds((prev) => prev.filter(id => id !== feedId));
      
      toast({
        title: "Synkroniseringsfeil",
        description: `Kunne ikke synkronisere feed: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // State for tracking sync status
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncingFeeds, setSyncingFeeds] = useState<number[]>([]);

  // Mutation to sync all iCal feeds
  const syncAllIcalFeedsMutation = useMutation({
    mutationFn: async () => {
      // Synkroniser alle feeds i listen
      const feedIds = allUsersIcalFeeds?.map(feed => feed.id) || [];
      
      // Legg til alle feed-ids i synkroniseringslisten
      setSyncingFeeds(feedIds);
      
      // Vis melding om at vi starter synkronisering
      toast({
        title: "Synkroniserer alle iCal-feeder",
        description: `Starter synkronisering av ${feedIds.length} iCal-feeder...`,
        variant: "default",
      });
      
      // Oppretter et løfte for hver feed-synkronisering
      const syncPromises = feedIds.map(async (feedId) => {
        try {
          const response = await apiRequest("POST", `/api/ical-feeds/${feedId}/sync`);
          return { 
            feedId, 
            success: true, 
            data: await response.json() 
          };
        } catch (error) {
          console.error(`Feil ved synkronisering av feed ${feedId}:`, error);
          return { 
            feedId, 
            success: false, 
            error: true, 
            message: error instanceof Error ? error.message : 'Ukjent feil' 
          };
        }
      });
      
      // Vent på at alle synkroniseringer fullføres
      const results = await Promise.all(syncPromises);
      
      // Tøm synkroniseringslisten
      setSyncingFeeds([]);
      
      return { 
        feedsCount: feedIds.length,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
        results 
      };
    },
    onSuccess: (data) => {
      toast({
        title: "Synkronisering fullført",
        description: `${data.successCount} av ${data.feedsCount} iCal-feeder ble synkronisert.${data.errorCount > 0 ? ` ${data.errorCount} feeder feilet.` : ''}`,
        variant: "default",
      });
      
      // Manuelt oppdater data i queryClient cache for umiddelbar UI-oppdatering
      const now = new Date();
      const updateCache = (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(feed => {
          if (data.results.some(r => r.success && r.feedId === feed.id)) {
            return { ...feed, lastSynced: now.toISOString() };
          }
          return feed;
        });
      };
      
      // Oppdater cachen for både admin og bruker feeds
      queryClient.setQueryData(["/api/ical-feeds"], oldData => updateCache(oldData));
      queryClient.setQueryData(["/api/admin/all-ical-feeds"], oldData => updateCache(oldData));
      
      // Force refetch av andre query-er som avhenger av iCal-data
      queryClient.refetchQueries({ queryKey: ["/api/ical-feed-events"] });
      queryClient.refetchQueries({ queryKey: ["/api/events"] });
      
      // Oppdater siste synkroniseringstid i UI
      setLastSyncTime(now);
    },
    onError: (error: Error) => {
      // Tøm synkroniseringslisten ved feil
      setSyncingFeeds([]);
      
      toast({
        title: "Feil",
        description: `Kunne ikke synkronisere alle iCal-feeder: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to block a user
  const blockUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number, reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/block`, { reason });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bruker blokkert",
        description: "Brukeren har blitt blokkert fra systemet",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Blokkeringsfeil",
        description: `Kunne ikke blokkere bruker: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation to unblock a user
  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/unblock`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bruker avblokkert",
        description: "Blokkeringen av brukeren har blitt fjernet",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Avblokkeringsfeil",
        description: `Kunne ikke fjerne blokkering: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Event handlers for users
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create user first
    createUserMutation.mutate(newUser, {
      onSuccess: (createdUser) => {
        // If an iCal import URL was provided, create iCal feed for the new user
        if (newUserIcalImport.url && newUserIcalImport.name) {
          createIcalFeedMutation.mutate({
            url: newUserIcalImport.url,
            name: newUserIcalImport.name,
            enabled: newUserIcalImport.enabled,
            color: "#ef4444", // Default red color
            userId: createdUser.id
          });
        }
        
        // Reset the iCal import form
        setNewUserIcalImport({
          url: "",
          name: "",
          enabled: true
        });
      }
    });
  };
  
  // Password management handlers
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdForPasswordChange || !newPassword) return;
    
    changePasswordMutation.mutate({ 
      userId: userIdForPasswordChange, 
      newPassword 
    });
  };
  
  const openChangePasswordDialog = (userId: number, username: string) => {
    setUserIdForPasswordChange(userId);
    setUserNameForPasswordChange(username);
    setNewPassword("");
    setIsChangePasswordDialogOpen(true);
  };
  
  const handleGenerateResetLink = (userId: number) => {
    generatePasswordResetLinkMutation.mutate(userId);
  };
  
  const handleCopyResetLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      toast({
        title: "Kopiert",
        description: "Tilbakestillingslenken er kopiert til utklippstavlen",
        variant: "default",
      });
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUserMutation.mutate(selectedUser);
    }
  };

  const openEditDialog = (user: AdminUser) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (userId: number) => {
    if (window.confirm("Er du sikker på at du vil slette denne brukeren?")) {
      deleteUserMutation.mutate(userId);
    }
  };
  
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [userToBlock, setUserToBlock] = useState<number | null>(null);
  const [blockReason, setBlockReason] = useState("");
  
  const handleOpenBlockDialog = (userId: number) => {
    setUserToBlock(userId);
    setBlockReason("");
    setIsBlockDialogOpen(true);
  };
  
  const handleBlockUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (userToBlock && blockReason.trim()) {
      blockUserMutation.mutate({ userId: userToBlock, reason: blockReason });
      setIsBlockDialogOpen(false);
    }
  };
  
  const handleUnblockUser = (userId: number) => {
    if (window.confirm("Er du sikker på at du vil fjerne blokkeringen av denne brukeren?")) {
      unblockUserMutation.mutate(userId);
    }
  };

  // Event handlers for iCal feeds
  const handleCreateIcalFeed = (e: React.FormEvent) => {
    e.preventDefault();
    createIcalFeedMutation.mutate(newIcalFeed);
  };

  const handleUpdateIcalFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIcalFeed) {
      updateIcalFeedMutation.mutate(selectedIcalFeed);
    }
  };

  const openEditIcalDialog = (feed: IcalFeed) => {
    setSelectedIcalFeed(feed);
    setIsEditIcalDialogOpen(true);
  };

  const handleDeleteIcalFeed = (feedId: number) => {
    if (window.confirm("Er du sikker på at du vil slette denne iCal feeden?")) {
      deleteIcalFeedMutation.mutate(feedId);
    }
  };
  
  // Handle opening user calendar view
  const openUserCalendarView = (userId: number) => {
    setUserCalendarId(userId);
    setIsCalendarViewOpen(true);
  };

  // Design settings are now handled by the SystemSettings component

  // Get the selected user name
  const selectedUserName = userCalendarId && users ? 
    users.find(u => u.id === userCalendarId)?.name || 'Bruker' : 'Bruker';
  
  // Calendar view state  
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Function to handle event click
  const handleEventClick = (event: Event) => {
    toast({
      title: event.title,
      description: `${format(new Date(event.startTime), 'PPP', { locale: nb })} ${event.allDay ? '(hele dagen)' : format(new Date(event.startTime), 'HH:mm')}`,
      variant: "default"
    });
  };
  
  // Function to handle date click
  const handleDateClick = (date: Date) => {
    // Just for demonstration, no action needed
  };

  // Check access for admin page
  if (!currentUser?.isAdmin) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Tilgang nektet</h1>
        <p>Du har ikke tilgang til administrasjonssiden.</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Feil</h1>
        <p>Det oppstod en feil under lasting av brukerdata.</p>
      </div>
    );
  }

  // Render the admin page with tabs
  return (
    <Layout>
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Administrasjon</CardTitle>
            <CardDescription>Administrer brukere, iCal feeds og design i systemet</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-8">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users size={16} />
                  Brukere
                </TabsTrigger>
                <TabsTrigger value="ical" className="flex items-center gap-2">
                  <Calendar size={16} />
                  Min iCal Link
                </TabsTrigger>
                <TabsTrigger value="all-ical" className="flex items-center gap-2">
                  <LinkIcon size={16} />
                  Alle iCal Linker
                </TabsTrigger>
                <TabsTrigger value="design" className="flex items-center gap-2">
                  <Palette size={16} />
                  Design
                </TabsTrigger>
                <TabsTrigger value="backup" className="flex items-center gap-2">
                  <Database size={16} />
                  Backup
                </TabsTrigger>
              </TabsList>
              
              {/* Users Tab */}
              <TabsContent value="users">
                <div className="flex justify-end mb-4">
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <UserPlus size={16} />
                    Legg til bruker
                  </Button>
                </div>
                
                <Table>
                  <TableCaption>Liste over alle brukere i systemet</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Kalender</TableHead>
                      <TableHead className="text-right">Handlinger</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.isAdmin ? (
                              <Badge variant="default">Admin</Badge>
                            ) : (
                              <Badge variant="outline">Bruker</Badge>
                            )}
                            
                            {user.isBlocked && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <Ban className="h-3 w-3" />
                                Blokkert
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs flex items-center gap-1"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/api/ical/${user.id}`);
                                toast({
                                  title: "Kopiert til utklippstavlen",
                                  description: "Kalender-URLen er kopiert til utklippstavlen",
                                  variant: "default",
                                });
                              }}
                            >
                              <LinkIcon className="h-3.5 w-3.5 text-slate-500" />
                              Kopier iCal
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs flex items-center gap-1"
                              onClick={() => openUserCalendarView(user.id)}
                            >
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              Vis kalender
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                              title="Rediger bruker"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openChangePasswordDialog(user.id, user.username)}
                              title="Endre passord"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleGenerateResetLink(user.id)}
                              title="Generer tilbakestillingslenke"
                            >
                              <ClipboardCopy className="h-4 w-4" />
                            </Button>
                            {user.isBlocked ? (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleUnblockUser(user.id)}
                                disabled={user.id === currentUser?.id}
                                title="Fjern blokkering"
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleOpenBlockDialog(user.id)}
                                disabled={user.id === currentUser?.id}
                                title="Blokker bruker"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              
              {/* All iCal Links Tab */}
              <TabsContent value="all-ical">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold">Alle iCal Linker</h2>
                    {lastSyncTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Sist synkronisert: {format(lastSyncTime, 'dd.MM.yyyy HH:mm:ss', { locale: nb })}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => syncAllIcalFeedsMutation.mutate()}
                      className="flex items-center gap-2"
                      disabled={syncAllIcalFeedsMutation.isPending || !allUsersIcalFeeds?.length}
                      variant="default"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncingFeeds.length > 0 ? 'animate-spin' : ''}`} />
                      {syncingFeeds.length > 0
                        ? `Synkroniserer (${syncingFeeds.length}/${allUsersIcalFeeds?.length || 0})...` 
                        : `Synkroniser alle (${allUsersIcalFeeds?.length || 0})`}
                    </Button>
                    <Button 
                      onClick={() => {
                        setNewIcalFeed({
                          name: "",
                          url: "",
                          color: "#e11d48",
                          enabled: true,
                          userId: users?.[0]?.id || currentUser?.id || 0,
                        });
                        setIsCreateIcalDialogOpen(true);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Legg til iCal Link
                    </Button>
                  </div>
                </div>
                
                {isAllUsersIcalLoading ? (
                  <div className="flex justify-center my-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : allUsersIcalError ? (
                  <p className="text-destructive">Kunne ikke laste alle iCal feeds</p>
                ) : (
                  <Table>
                    <TableCaption>Liste over alle iCal feeds på tvers av alle brukere</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Farge</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Bruker</TableHead>
                        <TableHead>Sist synkronisert</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsersIcalFeeds?.map((feed) => (
                        <TableRow key={feed.id}>
                          <TableCell>{feed.id}</TableCell>
                          <TableCell>{feed.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            <div className="flex items-center">
                              <span className="truncate mr-2">{feed.url}</span>
                              <a href={feed.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <ExternalLink className="h-4 w-4 text-slate-400" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: feed.color || '#e11d48' }} 
                              />
                              <span>{feed.color || '#e11d48'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {feed.enabled ? (
                              <Badge variant="default" className="bg-green-600">Aktiv</Badge>
                            ) : (
                              <Badge variant="outline">Inaktiv</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {feed.userInfo?.name || `Bruker #${feed.userId}`}
                            <div className="text-xs text-muted-foreground truncate">
                              {feed.userInfo?.email || feed.userInfo?.username}
                            </div>
                          </TableCell>
                          <TableCell>
                            {feed.lastSynced ? (
                              <span title={new Date(feed.lastSynced).toLocaleString()}>
                                {format(new Date(feed.lastSynced), 'dd.MM.yyyy HH:mm', { locale: nb })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Aldri</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => syncIcalFeedMutation.mutate(feed.id)}
                                disabled={syncIcalFeedMutation.isPending}
                                title="Synkroniser med ekstern kalender"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncIcalFeedMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  openEditIcalDialog({
                                    id: feed.id,
                                    name: feed.name,
                                    url: feed.url,
                                    color: feed.color || '#e11d48',
                                    enabled: feed.enabled || false,
                                    userId: feed.userId,
                                    lastSynced: feed.lastSynced
                                  });
                                }}
                                title="Rediger feed"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteIcalFeed(feed.id)}
                                title="Slett feed"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              
              {/* Min iCal Link Tab */}
              <TabsContent value="ical">
                <div className="flex justify-end mb-4">
                  <Button 
                    onClick={() => setIsCreateIcalDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Legg til Min iCal Link
                  </Button>
                </div>
                
                {isIcalLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : icalError ? (
                  <div className="text-center py-10">
                    <p className="text-destructive">Kunne ikke laste iCal feeds</p>
                  </div>
                ) : (
                  <Table>
                    <TableCaption>Liste over egne iCal feeds</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Farge</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Eier</TableHead>
                        <TableHead>Sist synkronisert</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {icalFeeds?.map((feed) => (
                        <TableRow key={feed.id}>
                          <TableCell>{feed.id}</TableCell>
                          <TableCell>{feed.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            <div className="flex items-center">
                              <span className="truncate mr-2">{feed.url}</span>
                              <a href={feed.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <ExternalLink className="h-4 w-4 text-slate-400" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: feed.color || '#e11d48' }} 
                              />
                              <span>{feed.color || '#e11d48'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {feed.enabled ? (
                              <Badge variant="default" className="bg-green-600">Aktiv</Badge>
                            ) : (
                              <Badge variant="outline">Inaktiv</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {users?.find(user => user.id === feed.userId)?.name || `Bruker #${feed.userId}`}
                          </TableCell>
                          <TableCell>
                            {feed.lastSynced ? (
                              <span title={new Date(feed.lastSynced).toLocaleString()}>
                                {new Date(feed.lastSynced).toLocaleDateString()} {new Date(feed.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Aldri</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => syncIcalFeedMutation.mutate(feed.id)}
                                disabled={syncIcalFeedMutation.isPending}
                                title="Synkroniser med ekstern kalender"
                              >
                                <RefreshCw className={`h-4 w-4 ${syncIcalFeedMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditIcalDialog(feed)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => handleDeleteIcalFeed(feed.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              
              {/* Design Tab */}
              <TabsContent value="design">
                <div className="space-y-8">
                  <div className="grid lg:grid-cols-2 gap-8">
                    {/* System Settings Component */}
                    <div className="lg:col-span-2">
                      <SystemSettings />
                    </div>
                    
                    {/* Legacy Design Settings - Will be replaced */}
                    <div className="border rounded-md p-4 bg-slate-50">
                      <h3 className="text-lg font-medium mb-4">Legacy Design Settings</h3>
                      <p className="text-muted-foreground mb-2">These settings are being replaced by the new system settings above.</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* Backup Tab */}
              <TabsContent value="backup">
                <BackupManager />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Block User Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Blokker bruker</DialogTitle>
            <DialogDescription>
              Blokkerte brukere vil ikke kunne logge på systemet. Skriv inn årsaken til blokkeringen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBlockUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="blockReason" className="text-right">
                  Årsak
                </Label>
                <Textarea
                  id="blockReason"
                  placeholder="Skriv inn årsak til blokkeringen..."
                  className="col-span-3"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => setIsBlockDialogOpen(false)}
              >
                Avbryt
              </Button>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={!blockReason.trim()}
              >
                Blokker bruker
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Add User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Legg til ny bruker</DialogTitle>
            <DialogDescription>
              Opprett en ny brukerkonto i systemet. Fyll inn brukerinformasjonen nedenfor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  E-post
                </Label>
                <Input
                  id="username"
                  type="email"
                  className="col-span-3"
                  value={newUser.username}
                  onChange={(e) => {
                    // Oppdater både brukernavn og e-post med samme verdi
                    setNewUser({ 
                      ...newUser, 
                      username: e.target.value,
                      email: e.target.value 
                    });
                  }}
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Navn
                </Label>
                <Input
                  id="name"
                  className="col-span-3"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Passord
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="col-span-3"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="text-right">
                  <Label htmlFor="isAdmin">Admin</Label>
                </div>
                <div className="col-span-3 flex items-center space-x-2">
                  <Checkbox
                    id="isAdmin"
                    checked={newUser.isAdmin}
                    onCheckedChange={(checked) =>
                      setNewUser({
                        ...newUser,
                        isAdmin: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="isAdmin">Er administrator</Label>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-2">
                <h4 className="text-sm font-medium mb-2">iCal kalenderimport (valgfritt)</h4>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="icalName" className="text-right">
                    Navn
                  </Label>
                  <Input
                    id="icalName"
                    className="col-span-3"
                    value={newUserIcalImport.name}
                    onChange={(e) => setNewUserIcalImport({ ...newUserIcalImport, name: e.target.value })}
                    placeholder="F.eks. 'Google Kalender'"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4 mt-2">
                  <Label htmlFor="icalUrl" className="text-right">
                    iCal URL
                  </Label>
                  <Input
                    id="icalUrl"
                    className="col-span-3"
                    value={newUserIcalImport.url}
                    onChange={(e) => setNewUserIcalImport({ ...newUserIcalImport, url: e.target.value })}
                    placeholder="https://eksempel.no/kalender.ics"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Opprett bruker</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rediger bruker</DialogTitle>
            <DialogDescription>
              Gjør endringer i brukerinformasjonen. Klikk lagre når du er ferdig.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleUpdateUser}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-username" className="text-right">
                    E-post
                  </Label>
                  <Input
                    id="edit-username"
                    type="email"
                    className="col-span-3"
                    value={selectedUser.username}
                    onChange={(e) =>
                      setSelectedUser({ 
                        ...selectedUser, 
                        username: e.target.value,
                        email: e.target.value 
                      })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Navn
                  </Label>
                  <Input
                    id="edit-name"
                    className="col-span-3"
                    value={selectedUser.name}
                    onChange={(e) =>
                      setSelectedUser({ ...selectedUser, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="text-right">
                    <Label htmlFor="edit-isAdmin">Admin</Label>
                  </div>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox
                      id="edit-isAdmin"
                      checked={selectedUser.isAdmin || false}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          isAdmin: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="edit-isAdmin">Er administrator</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Lagre endringer</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add iCal Feed Dialog */}
      <Dialog open={isCreateIcalDialogOpen} onOpenChange={setIsCreateIcalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Legg til ny iCal-feed</DialogTitle>
            <DialogDescription>
              Legg til en ekstern kalender via iCal-URL. Fyll inn feed-informasjonen nedenfor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateIcalFeed}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="feed-name" className="text-right">
                  Navn
                </Label>
                <Input
                  id="feed-name"
                  className="col-span-3"
                  value={newIcalFeed.name}
                  onChange={(e) => setNewIcalFeed({ ...newIcalFeed, name: e.target.value })}
                  required
                  placeholder="F.eks. 'Jobbkalender'"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="feed-url" className="text-right">
                  URL
                </Label>
                <Input
                  id="feed-url"
                  className="col-span-3"
                  value={newIcalFeed.url}
                  onChange={(e) => setNewIcalFeed({ ...newIcalFeed, url: e.target.value })}
                  required
                  placeholder="https://eksempel.no/kalender.ics"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="feed-color" className="text-right">
                  Farge
                </Label>
                <div className="col-span-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {['#ef4444', '#f97316', '#eab308', '#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899'].map((color) => (
                      <div 
                        key={color}
                        className={`w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 ${
                          newIcalFeed.color === color ? "ring-2 ring-offset-2" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewIcalFeed({ ...newIcalFeed, color })}
                      />
                    ))}
                  </div>
                  <div 
                    className="w-6 h-6 rounded-full border" 
                    style={{ backgroundColor: newIcalFeed.color || '#ef4444' }} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div className="text-right">
                  <Label htmlFor="feed-enabled">Status</Label>
                </div>
                <div className="col-span-3 flex items-center space-x-2">
                  <Checkbox
                    id="feed-enabled"
                    checked={newIcalFeed.enabled === true}
                    onCheckedChange={(checked) =>
                      setNewIcalFeed({
                        ...newIcalFeed,
                        enabled: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="feed-enabled">Aktiv</Label>
                </div>
              </div>
              
              {/* Bruker-velger (synlig bare for admin) */}
              {currentUser?.isAdmin && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="feed-user" className="text-right">
                    Bruker
                  </Label>
                  <Select 
                    value={String(newIcalFeed.userId)} 
                    onValueChange={(value) => 
                      setNewIcalFeed({
                        ...newIcalFeed,
                        userId: parseInt(value)
                      })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Velg bruker" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.name} ({user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">Lagre</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit iCal Feed Dialog */}
      <Dialog open={isEditIcalDialogOpen} onOpenChange={setIsEditIcalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rediger iCal-kanal</DialogTitle>
            <DialogDescription>
              Oppdater informasjon for denne iCal-kanalen.
            </DialogDescription>
          </DialogHeader>
          {selectedIcalFeed && (
            <form onSubmit={handleUpdateIcalFeed}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-feed-name" className="text-right">
                    Navn
                  </Label>
                  <Input
                    id="edit-feed-name"
                    className="col-span-3"
                    value={selectedIcalFeed.name}
                    onChange={(e) =>
                      setSelectedIcalFeed({ ...selectedIcalFeed, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-feed-url" className="text-right">
                    URL
                  </Label>
                  <Input
                    id="edit-feed-url"
                    className="col-span-3"
                    value={selectedIcalFeed.url}
                    onChange={(e) =>
                      setSelectedIcalFeed({ ...selectedIcalFeed, url: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-feed-color" className="text-right">
                    Farge
                  </Label>
                  <div className="col-span-3 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {['#ef4444', '#f97316', '#eab308', '#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899'].map((color) => (
                        <div 
                          key={color}
                          className={`w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 ${
                            selectedIcalFeed.color === color ? "ring-2 ring-offset-2" : ""
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedIcalFeed({ ...selectedIcalFeed, color })}
                        />
                      ))}
                    </div>
                    <div 
                      className="w-6 h-6 rounded-full border" 
                      style={{ backgroundColor: selectedIcalFeed.color || '#ef4444' }} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <div className="text-right">
                    <Label htmlFor="edit-feed-enabled">Status</Label>
                  </div>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox
                      id="edit-feed-enabled"
                      checked={selectedIcalFeed.enabled === true}
                      onCheckedChange={(checked) =>
                        setSelectedIcalFeed({
                          ...selectedIcalFeed,
                          enabled: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="edit-feed-enabled">Aktiv</Label>
                  </div>
                </div>
                {users && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-feed-userId" className="text-right">
                      Bruker
                    </Label>
                    <select
                      id="edit-feed-userId"
                      className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={selectedIcalFeed.userId}
                      onChange={(e) =>
                        setSelectedIcalFeed({
                          ...selectedIcalFeed,
                          userId: Number(e.target.value),
                        })
                      }
                      required
                    >
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">Lagre endringer</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* User Calendar View Dialog */}
      <Dialog open={isCalendarViewOpen} onOpenChange={setIsCalendarViewOpen}>
        <DialogContent className="sm:max-w-[800px] h-[80vh]">
          <DialogHeader>
            <DialogTitle>Kalender for {selectedUserName}</DialogTitle>
            <DialogDescription>
              Oversikt over brukerens kalenderaktiviteter og avtaler
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden h-full">
            {isUserEventsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : userEventsError ? (
              <div className="text-center py-10">
                <p className="text-destructive">Kunne ikke laste hendelser</p>
              </div>
            ) : (
              <div className="h-[600px] overflow-y-auto pb-8">
                <MonthView 
                  currentDate={currentDate}
                  events={userEvents}
                  onDateClick={handleDateClick}
                  onEventClick={handleEventClick}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsCalendarViewOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Password change dialog */}
      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Endre passord</DialogTitle>
            <DialogDescription>
              Endre passordet for brukeren {userNameForPasswordChange}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-password" className="text-right">
                  Nytt passord
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  className="col-span-3"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={!newPassword || changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lagre nytt passord
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Password reset link dialog */}
      <Dialog open={isResetLinkDialogOpen} onOpenChange={setIsResetLinkDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Tilbakestillingslenke for passord</DialogTitle>
            <DialogDescription>
              Kopier denne lenken og send den til brukeren. Lenken er gyldig i 24 timer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <Input
                value={resetLink}
                readOnly
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleCopyResetLink}>
                <Copy className="h-4 w-4 mr-2" />
                Kopier
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetLinkDialogOpen(false)}>
              Lukk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}