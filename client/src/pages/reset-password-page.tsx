import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { LanguageSelector } from "@/components/LanguageSelector";
import logoPath from "@/assets/logo.png";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/reset-password");
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Oppdater document title basert på språk
  useEffect(() => {
    document.title = t("app.title");
  }, [t]);

  useEffect(() => {
    // Get token from URL query parameters
    const query = new URLSearchParams(window.location.search);
    const tokenParam = query.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError(t("reset.error.noToken"));
    }
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validering
    if (newPassword.length < 6) {
      setError(t("reset.error.minLength"));
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError(t("reset.error.mismatch"));
      return;
    }
    
    if (!token) {
      setError(t("reset.error.noTokenAvailable"));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/reset-password", {
        token,
        newPassword
      });
      
      if (response.ok) {
        setSuccess(true);
        toast({
          title: t("reset.success"),
          description: t("reset.successDesc"),
          variant: "default",
        });
      } else {
        const data = await response.json();
        throw new Error(data.message || t("reset.error.generic"));
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("reset.error.generic"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-start md:justify-center items-center bg-gray-50">
      <div className="w-full max-w-md p-4 mt-8 md:mt-0">
        {/* Språkvelger - mer synlig på både mobil og desktop */}
        <div className="fixed top-4 right-4 md:top-8 md:right-8 z-50">
          <LanguageSelector />
        </div>
        
        {/* Logo - justert høyere opp på mobilvisning */}
        <div className="flex justify-center mb-4 md:mb-8 mt-4 md:mt-0">
          <img src={logoPath} alt="Smart Hjem AS Logo" className="h-24 md:h-36" />
        </div>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 mb-2 text-lg md:text-xl">
              <KeyRound className="h-5 w-5 md:h-6 md:w-6" />
              {t("reset.title")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("reset.description")}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("reset.error.title")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success ? (
              <Alert className="mb-4 bg-green-50 border-green-500">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700">{t("reset.success")}</AlertTitle>
                <AlertDescription className="text-green-600">
                  {t("reset.successDesc")}
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">{t("reset.newPassword")}</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">{t("reset.confirmPassword")}</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="h-10"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !token} 
                    className="h-10 mt-2"
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("reset.button")}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          
          <CardFooter>
            <div className="text-center w-full">
              {success ? (
                <Button variant="link" className="w-full" onClick={() => setLocation("/auth")}>
                  {t("reset.goToLogin")}
                </Button>
              ) : (
                <Button variant="link" className="w-full" onClick={() => setLocation("/auth")}>
                  {t("reset.backToLogin")}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
        
        {/* Mobilversjon: Kontaktinfo i bunn med språkstøtte */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{t("contact.company")}</p>
          <p>{t("contact.phone")}</p>
          <p>{t("contact.hours")}</p>
        </div>
      </div>
    </div>
  );
}