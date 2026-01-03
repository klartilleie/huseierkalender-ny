import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, User, MessageSquare, Lock, Send, ArrowLeft } from "lucide-react";
import type { AdminAgreement, AgreementNote } from "@shared/schema";

// Form schema for notes
const noteFormSchema = z.object({
  content: z.string().min(1, "Innhold er påkrevd"),
  isPrivate: z.boolean().default(false)
});

type NoteFormData = z.infer<typeof noteFormSchema>;

interface EnrichedAgreement extends AdminAgreement {
  userName: string;
  adminName: string;
}

interface EnrichedNote extends AgreementNote {
  authorName: string;
  authorIsAdmin: boolean;
}

interface AgreementDetailsProps {
  agreementId: number;
  isAdmin?: boolean;
}

export function AgreementDetails({ agreementId, isAdmin = false }: AgreementDetailsProps) {
  const { toast } = useToast();
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Fetch agreement details
  const { data: agreement, isLoading: loadingAgreement } = useQuery<EnrichedAgreement>({
    queryKey: [`/api/admin-agreements/${agreementId}`]
  });

  // Fetch agreement notes
  const { data: notes = [], isLoading: loadingNotes } = useQuery<EnrichedNote[]>({
    queryKey: [`/api/admin-agreements/${agreementId}/notes`]
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: NoteFormData) =>
      apiRequest(`/api/admin-agreements/${agreementId}/notes`, {
        method: "POST",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin-agreements/${agreementId}/notes`] });
      setIsAddingNote(false);
      noteForm.reset();
      toast({
        title: "Notat lagt til",
        description: "Notatet har blitt lagret."
      });
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke legge til notat. Prøv igjen.",
        variant: "destructive"
      });
    }
  });

  // Form for notes
  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
      isPrivate: false
    }
  });

  const onSubmitNote = (data: NoteFormData) => {
    createNoteMutation.mutate(data);
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

  if (loadingAgreement || loadingNotes) {
    return (
      <div className="p-4">
        <p>Laster avtaledetaljer...</p>
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="p-4">
        <p>Avtale ikke funnet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => window.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Tilbake
      </Button>

      {/* Agreement Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{agreement.title}</CardTitle>
              <CardDescription className="flex items-center gap-4 text-base">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {isAdmin ? `Bruker: ${agreement.userName}` : `Admin: ${agreement.adminName}`}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(agreement.meetingDate), "dd.MM.yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(agreement.meetingDate), "HH:mm")}
                </span>
              </CardDescription>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agreement.status)}`}>
              {getStatusText(agreement.status)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {agreement.meetingLocation && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{agreement.meetingLocation}</span>
            </div>
          )}
          {agreement.description && (
            <div>
              <h3 className="font-semibold mb-2">Beskrivelse</h3>
              <p className="text-muted-foreground">{agreement.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Notater og diskusjon
              </CardTitle>
              <CardDescription>
                {isAdmin ? "Legg til notater som brukeren kan se, eller private notater kun for admin" : "Se notater fra møtet"}
              </CardDescription>
            </div>
            {!isAddingNote && (
              <Button onClick={() => setIsAddingNote(true)}>
                Legg til notat
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Note Form */}
          {isAddingNote && (
            <Card className="border-2 border-primary/20">
              <CardContent className="pt-6">
                <Form {...noteForm}>
                  <form onSubmit={noteForm.handleSubmit(onSubmitNote)} className="space-y-4">
                    <FormField
                      control={noteForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notat</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Skriv ditt notat her..."
                              className="resize-none"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isAdmin && (
                      <FormField
                        control={noteForm.control}
                        name="isPrivate"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Privat notat (kun synlig for admin)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingNote(false);
                          noteForm.reset();
                        }}
                      >
                        Avbryt
                      </Button>
                      <Button type="submit" disabled={createNoteMutation.isPending}>
                        <Send className="h-4 w-4 mr-2" />
                        {createNoteMutation.isPending ? "Sender..." : "Send notat"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Notes List */}
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Ingen notater lagt til ennå</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Card key={note.id} className={note.isPrivate ? "border-orange-200 bg-orange-50/50" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {note.authorName}
                        </span>
                        {note.authorIsAdmin && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                            Admin
                          </span>
                        )}
                        {note.isPrivate && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Privat
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.createdAt), "dd.MM.yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}