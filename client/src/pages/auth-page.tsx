import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CalendarIcon, User, Lock } from "lucide-react";
import { loginSchema } from "@shared/schema";
import logoImage from "@/assets/smart-hjem-logo.png";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DeviceViewSelector } from "@/components/DeviceViewSelector";
import { useLanguage } from "@/hooks/use-language";
import { CacheClearButton } from "@/components/CacheClearButton";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Clear any problematic cache on auth page load
  useEffect(() => {
    console.log('AuthPage loaded - clearing cache if needed');
  }, []);

  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(data);
  };

  const { t } = useLanguage();
      
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-black text-yellow-400">
      {/* Language and Device View selectors */}
      <div className="absolute top-4 right-4 flex flex-col gap-4 z-20">
        <LanguageSelector />
        <DeviceViewSelector />
      </div>
      
      {/* Centered logo at the top - justert for å unngå overlapping på mobil */}
      <div className="hidden md:flex absolute top-0 left-0 right-0 justify-center pt-4 z-10">
        <img 
          src={logoImage} 
          alt="Smart Hjem AS Logo" 
          className="h-80" 
        />
      </div>

      {/* Mobil-vennlig logo (mindre og ikke absolute-posisjonert) */}
      <div className="md:hidden flex justify-center pt-4 mb-2">
        <img 
          src={logoImage} 
          alt="Smart Hjem AS Logo" 
          className="h-32" 
        />
      </div>

      <div className="flex items-center justify-center p-4 md:p-8 md:pt-36">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex flex-col items-center mb-4">
              <h1 className="text-3xl font-bold text-yellow-400">{t("login.calendar")}</h1>
            </div>
            <p className="text-yellow-300 mt-2">{t("login.tagline")}</p>
          </div>

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-yellow-400">{t("login.welcome")}</CardTitle>
              <CardDescription className="text-yellow-300">{t("login.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-yellow-400">{t("login.email")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-5 w-5 text-yellow-300" />
                            <Input 
                              type="email"
                              placeholder={t("login.emailPlaceholder")}
                              className="pl-10 bg-gray-800 border-gray-700 text-yellow-200" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-yellow-400">{t("login.password")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-5 w-5 text-yellow-300" />
                            <Input 
                              type="password" 
                              placeholder={t("login.passwordPlaceholder")}
                              className="pl-10 bg-gray-800 border-gray-700 text-yellow-200" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black" 
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? t("login.button.loading") : t("login.button")}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <p className="text-yellow-300 text-sm text-center">
                {t("login.newAccount")}
              </p>
              
              {/* Cache clear button for login issues */}
              <div className="flex justify-center mb-4">
                <CacheClearButton />
              </div>
              
              {/* Kundeservice informasjon */}
              <div className="border-t border-gray-700 pt-4 mt-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    <h3 className="text-sm font-medium text-yellow-400">{t("login.customerService")}</h3>
                  </div>
                  <a href="tel:47714646" className="text-sm font-medium hover:underline text-yellow-300">477 14 646</a>
                  <div className="text-xs text-yellow-300">
                    <span className="block">{t("contact.hours")}</span>
                  </div>
                  <a 
                    href="mailto:kundeservice@smarthjem.as" 
                    className="text-xs mt-1 bg-yellow-500/20 px-3 py-1.5 rounded hover:bg-yellow-500/30 transition text-yellow-400 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    {t("login.sendEmail")}
                  </a>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Right side hero */}
      <div className="hidden md:flex flex-col justify-center p-8 pt-60 bg-gray-900">
        <div className="max-w-md mx-auto">
          <h2 className="text-3xl font-bold text-yellow-400 mb-4">
            {t("login.hero.title")}
          </h2>
          <p className="text-lg text-yellow-300 mb-8">
            {t("login.hero.description")}
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="bg-gray-800 p-2 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-yellow-400">{t("login.feature1.title")}</h3>
                <p className="text-yellow-300">{t("login.feature1.description")}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-gray-800 p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4"></path>
                  <path d="M16 2v4"></path>
                  <rect x="2" y="6" width="20" height="16" rx="2"></rect>
                  <path d="M2.5 10h19"></path>
                  <path d="M7 14h.01"></path>
                  <path d="M12 14h.01"></path>
                  <path d="M17 14h.01"></path>
                  <path d="M7 18h.01"></path>
                  <path d="M12 18h.01"></path>
                  <path d="M17 18h.01"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-yellow-400">{t("login.feature2.title")}</h3>
                <p className="text-yellow-300">{t("login.feature2.description")}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-gray-800 p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11h1z"></path>
                  <path d="M9 11a1 1 0 0 1 .117 1.993L9 13H8a1 1 0 0 1-.117-1.993L8 11h1z"></path>
                  <path d="M14 11a1 1 0 0 1 .117 1.993L14 13h-1a1 1 0 0 1-.117-1.993L13 11h1z"></path>
                  <path d="M19 11a1 1 0 0 1 .117 1.993L19 13h-1a1 1 0 0 1-.117-1.993L18 11h1z"></path>
                  <path d="M2 6v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-yellow-400">{t("login.feature3.title")}</h3>
                <p className="text-yellow-300">{t("login.feature3.description")}</p>
              </div>
            </div>
            
            {/* Tom div som erstatter kontaktknapp */}
            <div className="mt-10"></div>
          </div>
        </div>
      </div>
      
      {/* Copyright footer */}
      <div className="fixed bottom-0 left-0 right-0 text-center p-2 text-yellow-300 text-sm bg-black bg-opacity-70 z-10">
        &copy; {new Date().getFullYear()} {t("contact.company")}. {t("login.copyright")}
      </div>
    </div>
  );
}
