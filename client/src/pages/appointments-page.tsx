import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, Clock, User, Mail, Phone, MapPin, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

interface AppointmentFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  description: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
}

export default function AppointmentsPage() {
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<AppointmentFormData>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    description: '',
    preferredDate: '',
    preferredTime: '10:00',
    location: 'Telefon/Teams'
  });

  // Initialize Google API
  useEffect(() => {
    const initializeGapi = async () => {
      if (!window.gapi) return;
      
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: [DISCOVERY_DOC],
        });
        setGapiInited(true);
      } catch (error) {
        console.error('Error initializing GAPI:', error);
      }
    };

    const initializeGis = () => {
      if (!window.google?.accounts?.oauth2) return;
      
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse.error !== undefined) {
            console.error('Auth error:', tokenResponse);
            return;
          }
          setIsAuthorized(true);
          toast({
            title: "Google Calendar tilkoblet",
            description: "Du kan nå booke avtaler direkte til kalenderen."
          });
        },
      });
      setTokenClient(client);
      setGisInited(true);
    };

    // Load Google APIs
    const loadGoogleApis = () => {
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.onload = () => {
        window.gapi.load('client', initializeGapi);
      };
      document.head.appendChild(gapiScript);

      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      gisScript.onload = initializeGis;
      document.head.appendChild(gisScript);
    };

    if (!window.gapi && !window.google) {
      loadGoogleApis();
    } else {
      if (window.gapi) initializeGapi();
      if (window.google) initializeGis();
    }
  }, []);

  const handleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  };

  const handleSignOut = () => {
    if (window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(window.gapi.client.getToken().access_token);
      setIsAuthorized(false);
      toast({
        title: "Logget ut",
        description: "Du er nå logget ut av Google Calendar."
      });
    }
  };

  const createCalendarEvent = async () => {
    if (!isAuthorized || !window.gapi.client.calendar) {
      throw new Error('Not authorized or calendar API not loaded');
    }

    const startDateTime = new Date(`${formData.preferredDate}T${formData.preferredTime}`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const event = {
      summary: `Avtale: ${formData.subject}`,
      description: `
Avtale med: ${formData.name}
E-post: ${formData.email}
Telefon: ${formData.phone}

Beskrivelse:
${formData.description}
      `.trim(),
      location: formData.location,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'Europe/Oslo',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'Europe/Oslo',
      },
      attendees: [
        { email: formData.email }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    const request = window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return request;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!CLIENT_ID || !API_KEY) {
      toast({
        title: "Konfigurationsfeil",
        description: "Google API-nøkler mangler. Kontakt administrator.",
        variant: "destructive"
      });
      return;
    }

    if (!isAuthorized) {
      toast({
        title: "Ikke autorisert",
        description: "Du må først koble til Google Calendar.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createCalendarEvent();
      toast({
        title: "Avtale opprettet! ✅",
        description: `Avtale med ${formData.name} er lagt inn i kalenderen.`
      });
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        description: '',
        preferredDate: '',
        preferredTime: '10:00',
        location: 'Telefon/Teams'
      });
    } catch (error) {
      console.error('Error creating calendar event:', error);
      toast({
        title: "Feil ved booking",
        description: "Kunne ikke opprette avtale. Prøv igjen.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canSubmit = gapiInited && gisInited && isAuthorized && CLIENT_ID && API_KEY;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Calendar className="h-8 w-8 text-blue-600" />
            Book Avtale
          </h1>
          <p className="text-gray-600">
            Book møte direkte til Google Calendar
          </p>
        </div>

        {/* API Keys Status */}
        {(!CLIENT_ID || !API_KEY) && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              ⚠️ Google API-nøkler mangler. Legg til VITE_GOOGLE_CLIENT_ID og VITE_GOOGLE_API_KEY i miljøvariabler.
            </AlertDescription>
          </Alert>
        )}

        {/* Google Calendar Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${isAuthorized ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              Google Calendar
            </CardTitle>
            <CardDescription>
              {isAuthorized 
                ? "Tilkoblet - klar for booking"
                : "Koble til Google Calendar for å booke avtaler"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isAuthorized ? (
              <Button 
                onClick={handleAuth} 
                disabled={!gapiInited || !gisInited || !CLIENT_ID || !API_KEY}
                className="w-full"
              >
                {gapiInited && gisInited ? 'Koble til Google Calendar' : 'Laster...'}
              </Button>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>Google Calendar tilkoblet</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Logg ut
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointment Form */}
        <Card>
          <CardHeader>
            <CardTitle>Ny Avtale</CardTitle>
            <CardDescription>
              Fyll ut skjemaet for å booke en avtale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Fullt navn *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Ola Nordmann"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-appointment-name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">E-post *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ola@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10"
                      required
                      data-testid="input-appointment-email"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+47 123 45 678"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="pl-10"
                      data-testid="input-appointment-phone"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">Møtested</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="location"
                      type="text"
                      placeholder="Telefon/Teams/Kontor"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      className="pl-10"
                      data-testid="input-appointment-location"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Emne *</Label>
                <Input
                  id="subject"
                  type="text"
                  placeholder="Hva skal møtet handle om?"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  required
                  data-testid="input-appointment-subject"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preferredDate">Ønsket dato *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="preferredDate"
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                      className="pl-10"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      data-testid="input-appointment-date"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="preferredTime">Ønsket klokkeslett</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="preferredTime"
                      type="time"
                      value={formData.preferredTime}
                      onChange={(e) => handleInputChange('preferredTime', e.target.value)}
                      className="pl-10"
                      data-testid="input-appointment-time"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea
                  id="description"
                  placeholder="Beskriv hva møtet skal handle om, eventuelle spørsmål eller ønsker..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  data-testid="textarea-appointment-description"
                />
              </div>

              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="w-full"
                data-testid="button-book-appointment"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Oppretter avtale...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Book avtale
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Information */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-blue-800 mb-2">Informasjon:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Avtaler opprettes direkte i Google Calendar</li>
              <li>• Du får automatisk e-postvarsel 24 timer før møtet</li>
              <li>• Standard møtevarighet er 1 time</li>
              <li>• Du kan endre eller avlyse avtalen direkte i Google Calendar</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}