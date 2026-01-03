import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SystemSetting } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Settings, Wrench, Mail } from "lucide-react";

// Color picker component placeholder (to be added later with packager_tool)
interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <Input
      type="color"
      value={color}
      onChange={(e) => onChange(e.target.value)}
      className="w-14 h-10 p-1 cursor-pointer"
    />
  );
}

export default function SystemSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("farger");
  
  // Settings state
  const [frontPageBgColor, setFrontPageBgColor] = useState("#000000");
  const [frontPageTextColor, setFrontPageTextColor] = useState("#fde047");
  const [eventColor, setEventColor] = useState("#ef4444");
  
  // Maintenance mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Siden er under ombygging og vil være snart tilbake");
  
  // Email notifications state
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true);
  
  // Fetch system settings
  const { data: systemSettings, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ["/api/system-settings"],
    staleTime: 60000, // 1 minute
  });
  
  // Update settings mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("PUT", `/api/system-settings/${key}`, { value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Innstillinger oppdatert",
        description: "Systeminnstillingene har blitt oppdatert.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved oppdatering",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Create setting mutation (for new settings)
  const createSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiRequest("POST", "/api/system-settings", { key, value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: "Innstilling opprettet",
        description: "Ny systeminnstilling har blitt lagt til.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved oppretting",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Load settings on component mount
  useEffect(() => {
    if (systemSettings) {
      // For each setting, update the corresponding state
      systemSettings.forEach((setting) => {
        if (setting.key === "frontPage.backgroundColor") {
          setFrontPageBgColor(setting.value);
        } else if (setting.key === "frontPage.textColor") {
          setFrontPageTextColor(setting.value);
        } else if (setting.key === "calendar.eventColor") {
          setEventColor(setting.value);
        } else if (setting.key === "maintenance.enabled") {
          setMaintenanceEnabled(setting.value === 'true');
        } else if (setting.key === "maintenance.message") {
          setMaintenanceMessage(setting.value);
        } else if (setting.key === "emailNotifications.enabled") {
          setEmailNotificationsEnabled(setting.value !== 'false');
        }
      });
    }
  }, [systemSettings]);
  
  // Maintenance mode toggle mutation
  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ enabled, message }: { enabled: boolean; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/maintenance-mode", { enabled, message });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      toast({
        title: data.enabled ? "Vedlikeholdsmodus aktivert" : "Vedlikeholdsmodus deaktivert",
        description: data.enabled ? 
          "Systemet er nå i vedlikeholdsmodus. Brukere vil se vedlikeholdssiden." :
          "Systemet er tilbake til normal drift.",
        variant: data.enabled ? "default" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil ved endring av vedlikeholdsmodus",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to save a setting (creates or updates)
  const saveSetting = async (key: string, value: string) => {
    // Check if setting exists
    const existingSetting = systemSettings?.find(s => s.key === key);
    
    if (existingSetting) {
      // Update existing
      updateSettingMutation.mutate({ key, value });
    } else {
      // Create new
      createSettingMutation.mutate({ key, value });
    }
  };
  
  const isPending = createSettingMutation.isPending || updateSettingMutation.isPending || toggleMaintenanceMutation.isPending;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Systeminnstillinger</CardTitle>
        <CardDescription>
          Administrer systeminnstillinger for kalenderløsningen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="farger">Farger</TabsTrigger>
            <TabsTrigger value="vedlikehold">Vedlikehold</TabsTrigger>
            <TabsTrigger value="annet">Andre innstillinger</TabsTrigger>
          </TabsList>
          
          <TabsContent value="farger">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="frontPageBgColor">Forside bakgrunnsfarge</Label>
                <div className="flex items-center space-x-4">
                  <ColorPicker
                    color={frontPageBgColor}
                    onChange={setFrontPageBgColor}
                  />
                  <Input
                    id="frontPageBgColor"
                    value={frontPageBgColor}
                    onChange={(e) => setFrontPageBgColor(e.target.value)}
                    className="w-28"
                  />
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: frontPageBgColor }}
                  ></div>
                  <Button
                    onClick={() => saveSetting("frontPage.backgroundColor", frontPageBgColor)}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lagre
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="frontPageTextColor">Forside tekstfarge</Label>
                <div className="flex items-center space-x-4">
                  <ColorPicker
                    color={frontPageTextColor}
                    onChange={setFrontPageTextColor}
                  />
                  <Input
                    id="frontPageTextColor"
                    value={frontPageTextColor}
                    onChange={(e) => setFrontPageTextColor(e.target.value)}
                    className="w-28"
                  />
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: frontPageTextColor }}
                  ></div>
                  <Button
                    onClick={() => saveSetting("frontPage.textColor", frontPageTextColor)}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lagre
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="eventColor">Hendelse farge</Label>
                <div className="flex items-center space-x-4">
                  <ColorPicker
                    color={eventColor}
                    onChange={setEventColor}
                  />
                  <Input
                    id="eventColor"
                    value={eventColor}
                    onChange={(e) => setEventColor(e.target.value)}
                    className="w-28"
                  />
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: eventColor }}
                  ></div>
                  <Button
                    onClick={() => saveSetting("calendar.eventColor", eventColor)}
                    disabled={isPending}
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lagre
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="vedlikehold">
            <div className="space-y-6">
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <Wrench className="h-5 w-5" />
                    Vedlikeholdsmodus
                  </CardTitle>
                  <CardDescription className="text-orange-700">
                    Aktiver vedlikeholdsmodus for å vise en vedlikeholdsside til alle brukere mens du gjør systemendringer.
                    Adminbrukere kan fortsatt logge inn og bruke systemet normalt.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="maintenance-toggle" className="text-orange-800 font-medium">
                        Vedlikeholdsmodus aktiv
                      </Label>
                      <p className="text-sm text-orange-700">
                        {maintenanceEnabled ? "Systemet er i vedlikeholdsmodus" : "Systemet er i normal drift"}
                      </p>
                    </div>
                    <Switch
                      id="maintenance-toggle"
                      checked={maintenanceEnabled}
                      onCheckedChange={setMaintenanceEnabled}
                      className="data-[state=checked]:bg-orange-600"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-message" className="text-orange-800 font-medium">
                      Vedlikeholdsmelding
                    </Label>
                    <Textarea
                      id="maintenance-message"
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      placeholder="Melding som vises til brukere under vedlikehold..."
                      className="min-h-[100px] border-orange-300 focus:border-orange-500"
                      rows={4}
                    />
                    <p className="text-sm text-orange-600">
                      Denne meldingen vises til alle ikke-admin brukere når vedlikeholdsmodus er aktiv.
                    </p>
                  </div>
                  
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => toggleMaintenanceMutation.mutate({ 
                        enabled: maintenanceEnabled, 
                        message: maintenanceMessage 
                      })}
                      disabled={isPending}
                      className={maintenanceEnabled ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                    >
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {maintenanceEnabled ? "Aktiver vedlikehold" : "Deaktiver vedlikehold"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="annet">
            <div className="space-y-6">
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Mail className="h-5 w-5" />
                    E-postvarsler
                  </CardTitle>
                  <CardDescription className="text-blue-700">
                    Aktiver eller deaktiver automatiske e-postvarsler til brukere ved kalenderendringer.
                    Når aktivert, sendes e-post til bruker og kopi til avsender.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="email-toggle" className="text-blue-800 font-medium">
                        E-postvarsler aktivert
                      </Label>
                      <p className="text-sm text-blue-700">
                        {emailNotificationsEnabled ? "E-postvarsler sendes ved kalenderendringer" : "E-postvarsler er deaktivert"}
                      </p>
                    </div>
                    <Switch
                      id="email-toggle"
                      checked={emailNotificationsEnabled}
                      onCheckedChange={(checked) => {
                        setEmailNotificationsEnabled(checked);
                        saveSetting("emailNotifications.enabled", checked ? 'true' : 'false');
                      }}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                  
                  <div className="bg-white p-4 rounded-md border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">Slik fungerer e-postvarsler:</h4>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                      <li>E-post sendes automatisk ved nye bookinger, endringer eller slettinger</li>
                      <li>Kopi av alle e-poster sendes til avsender-adressen</li>
                      <li>Kopien inneholder informasjon om hvem som mottok e-posten</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          Fargeinnstillinger påvirker utseendet til hele løsningen.
        </p>
      </CardFooter>
    </Card>
  );
}