import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { icalFeedFormSchema, IcalFeed } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface ICalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const colorOptions = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f97316", label: "Orange" },
  { value: "#22c55e", label: "Green" },
  { value: "#ef4444", label: "Red" },
];

export default function ICalModal({ isOpen, onClose }: ICalModalProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch existing iCal feeds
  const { data: feeds = [], isLoading } = useQuery<IcalFeed[]>({
    queryKey: ["/api/ical-feeds"]
  });

  // Form for adding new iCal feed
  const form = useForm<z.infer<typeof icalFeedFormSchema>>({
    resolver: zodResolver(icalFeedFormSchema),
    defaultValues: {
      name: "",
      url: "",
      color: "#8b5cf6",
      enabled: true,
    },
  });

  // Add iCal feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async (data: z.infer<typeof icalFeedFormSchema>) => {
      const res = await apiRequest("POST", "/api/ical-feeds", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feed-events"] });
      form.reset();
      toast({
        title: "Kalender lagt til",
        description: "iCal-feeden har blitt lagt til.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke legge til kalender",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update iCal feed mutation
  const updateFeedMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<z.infer<typeof icalFeedFormSchema>> }) => {
      // Fjern lastSynced fra dataobjektet hvis den eksisterer
      const cleanData = { ...data };
      if ('lastSynced' in cleanData) {
        delete cleanData.lastSynced;
      }
      
      console.log("Sender data til serveren:", cleanData);
      const res = await apiRequest("PUT", `/api/ical-feeds/${id}`, cleanData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feed-events"] });
      toast({
        title: "Kalender oppdatert",
        description: "iCal-feeden har blitt oppdatert.",
      });
    },
    onError: (error: any) => {
      console.error("Feil ved oppdatering av iCal-feed:", error);
      let errorMessage = "En ukjent feil oppstod.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response && error.response.data) {
        errorMessage = JSON.stringify(error.response.data);
      }
      
      toast({
        title: "Kunne ikke oppdatere kalenderen",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete iCal feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ical-feeds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ical-feed-events"] });
      setDeleteId(null);
      toast({
        title: "Kalender slettet",
        description: "iCal-feeden har blitt slettet.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Kunne ikke slette kalenderen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof icalFeedFormSchema>) => {
    addFeedMutation.mutate(data);
  };

  // Toggle feed enabled state
  const toggleFeedEnabled = (feed: IcalFeed, enabled: boolean) => {
    updateFeedMutation.mutate({
      id: feed.id,
      data: { enabled }
    });
  };

  // Handle feed deletion
  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId !== null) {
      deleteFeedMutation.mutate(deleteId);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Administrer iCal-feeder</DialogTitle>
          </DialogHeader>
          
          {/* Existing feeds */}
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            <h3 className="text-sm font-medium text-slate-700">Dine kalendere</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : feeds.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Ingen kalendere er lagt til ennå. Legg til en iCal-feed nedenfor.
              </p>
            ) : (
              feeds.map((feed) => (
                <Card key={feed.id} className="border border-slate-200">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: feed.color || "#8b5cf6" }}
                        />
                        <CardTitle className="text-base">{feed.name}</CardTitle>
                      </div>
                      <Switch 
                        checked={feed.enabled === true} 
                        onCheckedChange={(checked) => toggleFeedEnabled(feed, checked)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="py-0">
                    <CardDescription className="text-xs truncate max-w-xs">
                      {feed.url}
                    </CardDescription>
                  </CardContent>
                  <CardFooter className="py-2 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(feed.id)}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
          
          {/* Add new feed form */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-4">Legg til ny kalender</h3>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kalendernavn</FormLabel>
                      <FormControl>
                        <Input placeholder="Jobbkalender" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>iCal URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/calendar.ics" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        For Google Calendar: Bruk formatet<br/>
                        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">https://calendar.google.com/calendar/ical/[din-email]%40group.calendar.google.com/public/basic.ics</code>
                        <br/>eller<br/>
                        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">https://www.google.com/calendar/ical/[din-email]/public/basic.ics</code>
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kalenderfarge</FormLabel>
                      <div className="flex items-center space-x-2">
                        {colorOptions.map((color) => (
                          <div 
                            key={color.value}
                            className={`w-8 h-8 rounded-full cursor-pointer ${
                              field.value === color.value ? "ring-2 ring-offset-2" : ""
                            }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => form.setValue("color", color.value)}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="mt-6">
                  <Button 
                    type="submit"
                    disabled={addFeedMutation.isPending}
                  >
                    {addFeedMutation.isPending ? "Lagrer..." : "Lagre"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slett denne kalenderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent fjerne denne kalenderen og alle dens hendelser fra visningen din.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Slett
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
