import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Trash2, 
  Plus, 
  Calendar, 
  History,
  Check,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Beds24Config {
  id: number;
  userId: number;
  apiKey: string;
  propId: string;
  syncEnabled: boolean;
  syncHistoricalDays: number;
  syncFutureDays: number;
  lastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
  refreshToken?: string | null;
  hasOAuth?: boolean;
}

interface User {
  id: number;
  username: string;
  name: string;
  isAdmin: boolean;
}

export default function AdminBeds24Config() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [editingConfig, setEditingConfig] = useState<Partial<Beds24Config>>({
    syncEnabled: true,
    syncHistoricalDays: 365,
    syncFutureDays: 365,
    propId: '',
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Fetch all Beds24 configs
  const { data: configs = [], refetch: refetchConfigs } = useQuery<Beds24Config[]>({
    queryKey: ["/api/admin/beds24-configs"],
  });

  // Fetch specific user's config when selected
  const { data: userConfig } = useQuery<Beds24Config | null>({
    queryKey: [`/api/admin/beds24-config/${selectedUserId}`],
    enabled: !!selectedUserId,
  });

  // Update editing config when user config loads
  useEffect(() => {
    if (userConfig) {
      setEditingConfig(userConfig);
    } else if (selectedUserId) {
      setEditingConfig({
        syncEnabled: true,
        syncHistoricalDays: 365,
        syncFutureDays: 365,
        propId: '',
      });
    }
  }, [userConfig, selectedUserId]);

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { userId: number; config: Partial<Beds24Config> }) => {
      const response = await apiRequest("POST", `/api/admin/beds24-config/${data.userId}`, data.config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Konfigurasjon lagret",
        description: "Beds24 konfigurasjon har blitt lagret.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/beds24-configs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/beds24-config/${selectedUserId}`] });
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke lagre konfigurasjon.",
        variant: "destructive",
      });
    },
  });

  // Delete configuration mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/admin/beds24-config/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Konfigurasjon slettet",
        description: "Beds24 konfigurasjon har blitt slettet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/beds24-configs"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/beds24-config/${selectedUserId}`] });
      setSelectedUserId(null);
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke slette konfigurasjon.",
        variant: "destructive",
      });
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("POST", `/api/admin/beds24-sync/${userId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      const description = data.eventsCreated > 0 
        ? `${data.eventsCreated} nye bookinger lagt til, ${data.eventsUpdated || 0} oppdatert, ${data.eventsDeleted || 0} slettet.`
        : `Ingen nye bookinger funnet. ${data.eventsUpdated || 0} oppdatert, ${data.eventsDeleted || 0} slettet.`;
      
      toast({
        title: "✅ Synkronisering fullført",
        description: description,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/beds24-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Feil ved synkronisering",
        description: error.message || "Kunne ikke synkronisere data fra Beds24. Sjekk API-nøkkel og Property ID.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!selectedUserId) return;
    
    if (!editingConfig.propId) {
      toast({
        title: "Manglende informasjon",
        description: "Eiendoms-ID (Property ID) er påkrevd.",
        variant: "destructive",
      });
      return;
    }

    // Use master OAuth config - no individual API key needed
    const configToSave = {
      ...editingConfig,
      usesMasterOAuth: true
    };

    saveMutation.mutate({ userId: selectedUserId, config: configToSave });
  };

  const handleDelete = (userId: number) => {
    if (confirm("Er du sikker på at du vil slette denne konfigurasjonen?")) {
      deleteMutation.mutate(userId);
    }
  };

  const handleSync = (userId: number) => {
    syncMutation.mutate(userId);
  };

  // Get configured user IDs for easy lookup
  const configuredUserIds = new Set(configs.map(c => c.userId));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Beds24 API Konfigurasjon
        </CardTitle>
        <CardDescription>
          Administrer Beds24 integrasjon for å hente historiske og fremtidige bookingdata.
          Beds24 API gir tilgang til all bookinghistorikk, mens iCal kun viser fremtidige hendelser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User selection and add new config */}
        <div className="flex gap-2">
          <Select
            value={selectedUserId?.toString() || ""}
            onValueChange={(value) => setSelectedUserId(parseInt(value))}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Velg en bruker for å konfigurere Beds24" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter(u => !u.isAdmin)
                .sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
                .map((user) => {
                  const config = configs.find(c => c.userId === user.id);
                  return (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <span className="flex items-center justify-between w-full">
                        <span>{user.name || user.username}</span>
                        {config && (
                          <span className="ml-2 text-xs text-green-600">✓ Konfigurert</span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
          
          {selectedUserId && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {userConfig ? 'Rediger' : 'Legg til'} konfigurasjon
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {userConfig ? 'Rediger' : 'Ny'} Beds24 konfigurasjon
                  </DialogTitle>
                  <DialogDescription>
                    Konfigurer Beds24 API-tilgang for denne brukeren.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>OAuth-tilkobling aktiv</strong> - Systemet bruker master-kontoen for alle API-kall. 
                      Du trenger bare å angi Property ID for denne brukeren.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propId">Eiendoms ID (Property ID) *</Label>
                    <Input
                      id="propId"
                      value={editingConfig.propId || ''}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        propId: e.target.value
                      })}
                      placeholder="f.eks. 270243"
                    />
                    <p className="text-xs text-gray-500">
                      Finn Property ID i Beds24 under Properties &gt; Basic Info
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="historicalDays">
                      Antall dager bakover å hente historikk
                    </Label>
                    <Input
                      id="historicalDays"
                      type="number"
                      min="0"
                      max="1095"
                      value={editingConfig.syncHistoricalDays || 365}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        syncHistoricalDays: parseInt(e.target.value)
                      })}
                    />
                    <p className="text-xs text-gray-500">
                      Maks 3 år (1095 dager) tilbake i tid
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="futureDays">
                      Antall dager fremover å hente bookinger
                    </Label>
                    <Input
                      id="futureDays"
                      type="number"
                      min="0"
                      max="730"
                      value={editingConfig.syncFutureDays || 365}
                      onChange={(e) => setEditingConfig({
                        ...editingConfig,
                        syncFutureDays: parseInt(e.target.value)
                      })}
                    />
                    <p className="text-xs text-gray-500">
                      Maks 2 år (730 dager) frem i tid
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="syncEnabled" className="cursor-pointer">
                      Aktiver automatisk synkronisering
                    </Label>
                    <Switch
                      id="syncEnabled"
                      checked={editingConfig.syncEnabled}
                      onCheckedChange={(checked) => setEditingConfig({
                        ...editingConfig,
                        syncEnabled: checked
                      })}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Avbryt
                    </Button>
                    <Button onClick={handleSave} disabled={saveMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {saveMutation.isPending ? 'Lagrer...' : 'Lagre'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Active configurations list */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Aktive konfigurasjoner ({configs.length})
          </h3>
          
          {configs.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              Ingen Beds24 konfigurasjoner er satt opp ennå.
            </p>
          ) : (
            <div className="space-y-2">
              {configs.map((config) => {
                const user = users.find(u => u.id === config.userId);
                return (
                  <div
                    key={config.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {user?.name || user?.username || `Bruker #${config.userId}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          Property ID: {config.propId}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <History className="h-3 w-3" />
                            {config.syncHistoricalDays} dager bakover
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {config.syncFutureDays} dager fremover
                          </span>
                        </div>
                        {config.lastSync && (
                          <p className="text-xs text-gray-500 mt-1">
                            Sist synkronisert: {new Date(config.lastSync).toLocaleString('nb-NO')}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                          config.syncEnabled 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {config.syncEnabled ? (
                            <>
                              <Check className="h-3 w-3" />
                              Aktiv
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3" />
                              Inaktiv
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUserId(config.userId);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Rediger
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(config.userId)}
                        disabled={syncMutation.isPending || !config.syncEnabled}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${
                          syncMutation.isPending ? 'animate-spin' : ''
                        }`} />
                        Synkroniser nå
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(config.userId)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Slett
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User overview table */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Oversikt alle brukere
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 text-sm">Bruker</th>
                  <th className="text-left p-2 text-sm">Property ID</th>
                  <th className="text-center p-2 text-sm">Status</th>
                  <th className="text-center p-2 text-sm">Sist synkronisert</th>
                  <th className="text-center p-2 text-sm">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(u => !u.isAdmin)
                  .sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username))
                  .map((user) => {
                    const config = configs.find(c => c.userId === user.id);
                    return (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm">{user.name || user.username}</td>
                        <td className="p-2 text-sm">
                          {config ? config.propId : <span className="text-gray-400">Ikke konfigurert</span>}
                        </td>
                        <td className="p-2 text-center">
                          {config ? (
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                              config.syncEnabled 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {config.syncEnabled ? (
                                <><Check className="h-3 w-3" /> Aktiv</>
                              ) : (
                                <><X className="h-3 w-3" /> Inaktiv</>
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center text-xs text-gray-500">
                          {config?.lastSync ? new Date(config.lastSync).toLocaleString('nb-NO') : '—'}
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            {config ? 'Rediger' : 'Konfigurer'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Information panel */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <h4 className="font-semibold text-green-900 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Beds24 OAuth-integrasjon aktiv
          </h4>
          <p className="text-sm text-green-800">
            Systemet er koblet til Beds24 med full lese- og skrivetilgang via OAuth. 
            For å koble en bruker til sin eiendom:
          </p>
          <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
            <li>Velg bruker fra listen ovenfor</li>
            <li>Klikk "Konfigurer"</li>
            <li>Skriv inn Property ID fra Beds24 (finnes under Properties &gt; Basic Info)</li>
            <li>Klikk "Lagre" for å aktivere synkronisering</li>
          </ol>
          <div className="mt-3 p-2 bg-green-100 rounded">
            <p className="text-xs text-green-900">
              <strong>20 eiendommer tilgjengelig</strong> - Alle eiendommer i Beds24-kontoen er tilgjengelige for synkronisering.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}