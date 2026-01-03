import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Plus, Edit, Trash2, Eye, User as UserIcon } from "lucide-react";
import type { AdminAgreement, User } from "@shared/schema";
import { adminAgreementFormSchema } from "@shared/schema";

// Use shared schema for consistency with backend
type AgreementFormData = z.infer<typeof adminAgreementFormSchema>;

interface EnrichedAgreement extends AdminAgreement {
  userName: string;
  adminName: string;
  meetingLocation?: string;
}

export function AdminAgreements() {
  const { user: currentUser } = useAuth();
  const isReadOnly = currentUser?.isMiniAdmin && !currentUser?.isAdmin;
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<EnrichedAgreement | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<EnrichedAgreement | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");

  // Fetch all users for the dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"]
  });

  // Fetch agreements with optional user filter
  const { data: agreements = [], isLoading } = useQuery<EnrichedAgreement[]>({
    queryKey: ["/api/admin-agreements", selectedUserId !== "all" ? selectedUserId : undefined],
    queryFn: async () => {
      const params = selectedUserId !== "all" ? `?userId=${selectedUserId}` : "";
      const response = await fetch(`/api/admin-agreements${params}`);
      if (!response.ok) throw new Error('Failed to fetch agreements');
      return response.json();
    }
  });

  // Create agreement mutation
  const createMutation = useMutation({
    mutationFn: (data: AgreementFormData) => 
      apiRequest("POST", "/api/admin-agreements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-agreements"] });
      setIsCreateOpen(false);
      toast({
        title: "Avtale opprettet",
        description: "Avtalen har blitt opprettet og brukeren har fått varsel."
      });
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke opprette avtale. Prøv igjen.",
        variant: "destructive"
      });
    }
  });

  // Update agreement mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AgreementFormData> }) =>
      apiRequest("PUT", `/api/admin-agreements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-agreements"] });
      setEditingAgreement(null);
      toast({
        title: "Avtale oppdatert",
        description: "Avtalen har blitt oppdatert."
      });
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke oppdatere avtale. Prøv igjen.",
        variant: "destructive"
      });
    }
  });

  // Delete agreement mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin-agreements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin-agreements"] });
      toast({
        title: "Avtale slettet",
        description: "Avtalen har blitt slettet."
      });
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke slette avtale. Prøv igjen.",
        variant: "destructive"
      });
    }
  });

  // Form for creating/editing agreements
  const form = useForm<AgreementFormData>({
    resolver: zodResolver(adminAgreementFormSchema),
    defaultValues: {
      userId: 0,
      title: "",
      description: "",
      meetingDate: new Date(),
      endDate: null,
      meetingLocation: "",
      meetingType: "general",
      status: "scheduled"
    }
  });

  // Reset form when dialog opens/closes
  const handleCreateOpen = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      form.reset();
    }
  };

  const handleEditOpen = (agreement: EnrichedAgreement | null) => {
    setEditingAgreement(agreement);
    if (agreement) {
      form.reset({
        userId: agreement.userId,
        title: agreement.title,
        description: agreement.description || "",
        meetingDate: new Date(agreement.meetingDate),
        endDate: agreement.endDate ? new Date(agreement.endDate) : null,
        meetingLocation: agreement.location || "",
        meetingType: agreement.meetingType || "general",
        status: agreement.status as "scheduled" | "completed" | "cancelled"
      });
    } else {
      form.reset();
    }
  };

  const onSubmit = (data: AgreementFormData) => {
    if (editingAgreement) {
      updateMutation.mutate({ id: editingAgreement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "text-blue-600 bg-blue-50";
      case "completed":
        return "text-green-600 bg-green-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Planlagt";
      case "completed":
        return "Fullført";
      case "cancelled":
        return "Kansellert";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <p>Laster avtaler...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Avtaler</h2>
          <p className="text-muted-foreground">
            Oversikt over alle avtaler du har opprettet med brukere
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={isCreateOpen} onOpenChange={handleCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny avtale
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Opprett ny avtale</DialogTitle>
              <DialogDescription>
                Planlegg et møte eller avtale med en bruker
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bruker</FormLabel>
                      <Select
                        value={field.value?.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Velg bruker" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.filter(u => !u.isAdmin).map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name || user.username} ({user.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tittel</FormLabel>
                      <FormControl>
                        <Input placeholder="F.eks. Månedlig oppfølgingsmøte" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beskrivelse</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Beskriv hva møtet skal handle om..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dato og tid</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          value={field.value instanceof Date 
                            ? format(field.value, "yyyy-MM-dd'T'HH:mm")
                            : field.value || ""
                          }
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sted</FormLabel>
                      <FormControl>
                        <Input placeholder="F.eks. Kontor, Teams, Telefon" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="meetingType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Møtetype</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">Generelt</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="consultation">Konsultasjon</SelectItem>
                          <SelectItem value="review">Gjennomgang</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Planlagt</SelectItem>
                          <SelectItem value="completed">Fullført</SelectItem>
                          <SelectItem value="cancelled">Kansellert</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCreateOpen(false)}
                  >
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Oppretter..." : "Opprett avtale"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Filter Section */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-600" />
          <label className="text-sm font-medium text-gray-700">Filtrer etter bruker:</label>
        </div>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🔍 Alle brukere</SelectItem>
            {users.filter(u => !u.isAdmin).map((user) => (
              <SelectItem key={user.id} value={user.id.toString()}>
                👤 {user.name || user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-gray-600">
          {selectedUserId === "all" 
            ? `Viser alle ${agreements.length} avtaler du har opprettet`
            : `Viser ${agreements.length} avtaler for ${users.find(u => u.id.toString() === selectedUserId)?.name || 'valgt bruker'}`
          }
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingAgreement} onOpenChange={(open) => !open && handleEditOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rediger avtale</DialogTitle>
            <DialogDescription>
              Oppdater avtaledetaljer
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tittel</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beskrivelse</FormLabel>
                    <FormControl>
                      <Textarea 
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meetingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dato og tid</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="meetingLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sted</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Planlagt</SelectItem>
                        <SelectItem value="completed">Fullført</SelectItem>
                        <SelectItem value="cancelled">Kansellert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleEditOpen(null)}
                >
                  Avbryt
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Lagrer..." : "Lagre endringer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Agreements List */}
      <div className="grid gap-4">
        {agreements.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  {selectedUserId === "all" 
                    ? "Du har ikke opprettet noen avtaler ennå" 
                    : "Ingen avtaler funnet for denne brukeren"
                  }
                </p>
                {selectedUserId !== "all" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedUserId("all")}
                  >
                    Vis alle avtaler
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          agreements.map((agreement) => (
            <Card key={agreement.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{agreement.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {agreement.userName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(agreement.meetingDate), "dd.MM.yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(agreement.meetingDate), "HH:mm")}
                      </span>
                      {agreement.meetingLocation && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {agreement.meetingLocation}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agreement.status)}`}>
                      {getStatusText(agreement.status)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              {agreement.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{agreement.description}</p>
                </CardContent>
              )}
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `/admin/agreements/${agreement.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Se detaljer
                  </Button>
                  {!isReadOnly && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditOpen(agreement)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Rediger
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Er du sikker på at du vil slette denne avtalen?")) {
                            deleteMutation.mutate(agreement.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Slett
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}