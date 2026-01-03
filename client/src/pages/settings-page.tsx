import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  User,
  Lock,
  Save,
  Trash2,
  Loader2,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  // User profile state
  const [profile, setProfile] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    accountNumber: user?.accountNumber || "",
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updatedProfile: typeof profile) => {
      const response = await apiRequest(
        "PUT",
        `/api/user/profile`,
        updatedProfile
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profil oppdatert",
        description: "Din profilinformasjon har blitt oppdatert",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke oppdatere profil: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Password update mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await apiRequest("PUT", `/api/user/password`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Passord oppdatert",
        description: "Ditt passord har blitt endret",
        variant: "default",
      });
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke oppdatere passord: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Account deletion mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/user/account`);
    },
    onSuccess: () => {
      toast({
        title: "Konto slettet",
        description: "Din konto har blitt slettet fra systemet",
        variant: "default",
      });
      logoutMutation.mutate();
      navigate("/auth");
    },
    onError: (error: Error) => {
      toast({
        title: "Feil",
        description: `Kunne ikke slette konto: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Handle profile form submission
  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profile);
  };

  // Handle password form submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passordene matcher ikke",
        description: "Det nye passordet og bekreftelsen må være like",
        variant: "destructive",
      });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Passordet er for kort",
        description: "Passordet må være minst 6 tegn",
        variant: "destructive",
      });
      return;
    }
    
    updatePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  // Handle account deletion
  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  // Copy iCal URL to clipboard
  const copyIcalUrl = () => {
    if (user) {
      const url = `${window.location.origin}/api/ical/${user.id}`;
      navigator.clipboard.writeText(url);
      toast({
        title: "Kopiert til utklippstavlen",
        description: "Kalender-URLen er kopiert til utklippstavlen",
        variant: "default",
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-10 text-center">
        <h1 className="text-2xl font-bold mb-4">Ikke innlogget</h1>
        <p>Du må være innlogget for å se denne siden.</p>
        <Button className="mt-4" onClick={() => navigate("/auth")}>
          Gå til innlogging
        </Button>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.userSettings")}</CardTitle>
            <CardDescription>
              {t("settings.manageAccount")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User size={16} />
                  Profil
                </TabsTrigger>
                <TabsTrigger value="password" className="flex items-center gap-2">
                  <Lock size={16} />
                  Passord
                </TabsTrigger>
                <TabsTrigger value="calendar" className="flex items-center gap-2">
                  <ExternalLink size={16} />
                  Kalender-lenke
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <form onSubmit={handleProfileSubmit}>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Navn</Label>
                      <Input
                        id="name"
                        type="text"
                        value={profile.name}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">E-post</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="phoneNumber">Telefonnummer</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="+47 000 00 000"
                        value={profile.phoneNumber}
                        onChange={(e) =>
                          setProfile({ ...profile, phoneNumber: e.target.value })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Brukes for SMS-varsler ved nye bookinger
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="accountNumber">Kontonummer</Label>
                      <Input
                        id="accountNumber"
                        type="text"
                        placeholder="0000 00 00000"
                        value={profile.accountNumber}
                        onChange={(e) =>
                          setProfile({ ...profile, accountNumber: e.target.value })
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        For utbetalinger
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="username">Brukernavn</Label>
                      <Input
                        id="username"
                        type="text"
                        value={user.username}
                        disabled
                      />
                      <p className="text-sm text-muted-foreground">
                        Brukernavnet kan ikke endres
                      </p>
                    </div>

                    <div className="flex justify-between mt-4">
                      <Button
                        type="submit"
                        className="flex items-center gap-2"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <Save size={16} />
                        Lagre endringer
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            className="flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            Slett konto
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Er du sikker på at du vil slette kontoen din?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              <div className="flex flex-col gap-2">
                                <p>
                                  Dette vil slette all din informasjon og alle dine
                                  kalenderdata permanent. Denne handlingen kan ikke
                                  angres.
                                </p>
                                <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 mt-2">
                                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                  <p className="text-sm">
                                    Alle dine hendelser og dataene dine vil bli
                                    slettet permanent.
                                  </p>
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteAccount}
                              disabled={deleteAccountMutation.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleteAccountMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Slett kontoen min
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </form>
              </TabsContent>

              {/* Password Tab */}
              <TabsContent value="password">
                <form onSubmit={handlePasswordSubmit}>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">Nåværende passord</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            currentPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="new-password">Nytt passord</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="confirm-password">Bekreft passord</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="flex items-center gap-2 w-full mt-4"
                      disabled={updatePasswordMutation.isPending}
                    >
                      {updatePasswordMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      <Lock size={16} />
                      Oppdater passord
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* Calendar Tab */}
              <TabsContent value="calendar">
                <div className="space-y-6">
                  <div className="grid gap-3">
                    <h3 className="text-lg font-medium">Din personlige kalender-URL</h3>
                    <p className="text-sm text-muted-foreground">
                      Bruk denne URLen for å abonnere på din personlige kalender fra 
                      eksterne kalender-applikasjoner som Google Calendar, Apple Calendar 
                      eller Microsoft Outlook.
                    </p>

                    <div className="relative mt-2">
                      <Input
                        value={`${window.location.origin}/api/ical/${user.id}`}
                        readOnly
                        className="pr-20 font-mono"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={copyIcalUrl}
                          className="h-7 w-7"
                        >
                          <Copy className="h-4 w-4" />
                          <span className="sr-only">Kopier URL</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`${window.location.origin}/api/ical/${user.id}`, '_blank')}
                          className="h-7 w-7"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Åpne i ny fane</span>
                        </Button>
                      </div>
                    </div>

                    <h4 className="text-sm font-medium mt-4">Instruksjoner for import</h4>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div className="p-3 bg-muted rounded-md">
                        <h5 className="font-semibold mb-1">Google Calendar</h5>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Gå til Google Calendar</li>
                          <li>Klikk på + ved &quot;Andre kalendere&quot;</li>
                          <li>Velg &quot;Fra URL&quot;</li>
                          <li>Lim inn URL-en ovenfor og klikk &quot;Legg til kalender&quot;</li>
                        </ol>
                      </div>
                      
                      <div className="p-3 bg-muted rounded-md">
                        <h5 className="font-semibold mb-1">Apple Calendar</h5>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Åpne Calendar-appen</li>
                          <li>Gå til Fil &gt; Ny kalenderabonnement</li>
                          <li>Lim inn URL-en ovenfor og klikk &quot;Abonner&quot;</li>
                        </ol>
                      </div>
                      
                      <div className="p-3 bg-muted rounded-md">
                        <h5 className="font-semibold mb-1">Outlook</h5>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Gå til Outlook-kalenderen</li>
                          <li>Klikk på &quot;Legg til kalender&quot; og deretter &quot;Abonner fra web&quot;</li>
                          <li>Lim inn URL-en ovenfor og klikk &quot;Importer&quot;</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}