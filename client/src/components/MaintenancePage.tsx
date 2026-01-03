import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Settings, Users, LogIn, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface MaintenancePageProps {
  message?: string;
}

export default function MaintenancePage({ message = "Siden er under oppgradering og vil være tilgjengelig igjen snart" }: MaintenancePageProps) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Innlogging feilet");
      }

      const userData = await response.json();

      if (userData.isAdmin) {
        toast({
          title: "Innlogging vellykket",
          description: "Du er nå logget inn som administrator",
        });
        
        // Invalidate auth and maintenance queries to trigger re-render
        await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/maintenance-status"] });
        
        // Small delay to ensure invalidation completed, then reload
        setTimeout(() => {
          window.location.reload();
        }, 200);
      } else {
        toast({
          title: "Tilgang nektet",
          description: "Kun administratorer kan logge inn under vedlikehold",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Innlogging feilet",
        description: error.message || "Ugyldig brukernavn eller passord",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black flex items-center justify-center px-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[length:50px_50px] opacity-20"></div>
      
      <div className="relative max-w-2xl w-full">
        <Card className="bg-slate-800/90 border-slate-600 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <div className="relative p-6 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full shadow-lg">
                <Wrench className="h-12 w-12 text-slate-900 animate-pulse" />
                <div className="absolute -top-2 -right-2 bg-yellow-300 rounded-full p-2">
                  <Settings className="h-4 w-4 text-slate-900 animate-spin" style={{animationDuration: '3s'}} />
                </div>
              </div>
            </div>
            
            <CardTitle className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 bg-clip-text text-transparent mb-2">
              Smart Hjem
            </CardTitle>
            <p className="text-slate-300 text-xl font-medium">Kalenderløsning</p>
          </CardHeader>
          
          <CardContent className="text-center space-y-6">
            <div className="bg-gradient-to-r from-yellow-400/10 to-yellow-500/10 border border-yellow-400/30 rounded-lg p-6">
              <h3 className="text-yellow-400 text-xl font-semibold mb-3">
                Systemoppgradering pågår
              </h3>
              <p className="text-slate-200 text-lg leading-relaxed">
                {message}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <Users className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="font-medium text-slate-300">Brukeropplevelse</p>
                <p>Forbedrer ytelse og stabilitet</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <Settings className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="font-medium text-slate-300">Nye funksjoner</p>
                <p>Legger til forbedringer</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <Wrench className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="font-medium text-slate-300">Vedlikehold</p>
                <p>Oppdaterer systemkomponenter</p>
              </div>
            </div>
            
            <div className="pt-6 space-y-4">
              {!showAdminLogin ? (
                <>
                  <Button 
                    onClick={() => setShowAdminLogin(true)}
                    className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 hover:from-yellow-500 hover:to-yellow-600 font-semibold text-lg px-8 py-3 rounded-lg shadow-lg transition-all duration-300"
                  >
                    <Settings className="mr-2 h-5 w-5" />
                    Admin innlogging
                  </Button>
                  
                  <p className="text-slate-400 text-sm">
                    Kun administratorer kan logge inn under oppgraderingen
                  </p>
                </>
              ) : (
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6 max-w-md mx-auto">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="text-center mb-4">
                      <h3 className="text-yellow-400 text-lg font-semibold">Administrator innlogging</h3>
                      <p className="text-slate-400 text-sm mt-1">Kun administratorer kan logge inn under vedlikehold</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-slate-300">Brukernavn</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-slate-200"
                        placeholder="Skriv inn brukernavn"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-300">Passord</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-slate-800 border-slate-600 text-slate-200 pr-10"
                          placeholder="Skriv inn passord"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-slate-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-slate-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 hover:from-yellow-500 hover:to-yellow-600 font-semibold"
                      >
                        {isLoading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900 mr-2"></div>
                            Logger inn...
                          </div>
                        ) : (
                          <>
                            <LogIn className="mr-2 h-4 w-4" />
                            Logg inn
                          </>
                        )}
                      </Button>
                      
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAdminLogin(false);
                          setUsername("");
                          setPassword("");
                          setShowPassword(false);
                        }}
                        className="px-4 border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Avbryt
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-600">
              <div className="flex items-center justify-center space-x-2 text-slate-500 text-sm">
                <span>Smart Hjem AS</span>
                <span>•</span>
                <span>Teknisk support</span>
                <span>•</span>
                <span className="text-yellow-400">v2.0</span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Systemet vil være tilbake til normal drift snart
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}