import { useEffect } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/hooks/use-language";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import useDocumentTitle from "@/hooks/use-document-title";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export default function HubspotSupportPage() {
  const { t } = useTranslation();
  
  // Set document title
  useDocumentTitle("Kundeservice | Smart Hjem AS");

  // Load Hubspot script when component mounts
  useEffect(() => {
    // Create script element
    const script = document.createElement("script");
    script.src = "https://js.hsforms.net/forms/embed/v2.js";
    script.charset = "utf-8";
    script.type = "text/javascript";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).hbspt) {
        (window as any).hbspt.forms.create({
          region: "na1",
          portalId: "21951305", // Dette er et eksempel-ID, må erstattes med din portal ID
          formId: "1234abcd-5678-efgh-9012-ijklmnopqrst", // Dette er et eksempel-ID, må erstattes med ditt skjema-ID
          target: "#hubspot-form-container",
          onFormSubmit: function($form: any) {
            console.log("Henvendelse sendt til Hubspot");
          }
        });
      }
    };
    
    // Add script to page
    document.body.appendChild(script);
    
    // Cleanup function to remove script when component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">Kundeservice</h1>
        
        <div className="space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Ny kundeserviceløsning</AlertTitle>
            <AlertDescription>
              Vi har oppgradert vår kundeserviceløsning for å gi deg bedre hjelp. 
              Fyll ut skjemaet nedenfor for å sende inn din henvendelse, så vil 
              vårt team følge opp så raskt som mulig.
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Send en henvendelse til vårt kundeserviceteam</CardTitle>
              <CardDescription>
                Fyll ut skjemaet under, så vil en av våre kundeservicemedarbeidere 
                ta kontakt med deg så snart som mulig.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hubspot form will be embedded here */}
              <div id="hubspot-form-container"></div>
              
              {/* Fallback message if form doesn't load */}
              <div id="hubspot-fallback" className="hidden">
                <p className="text-sm text-gray-600 mb-4">
                  Hvis skjemaet ikke lastes inn, kan du også kontakte oss via:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  <li>Telefon: 477 14 646 (Man-Fre: 09:00-16:00)</li>
                  <li>E-post: <a href="mailto:kundeservice@smarthjem.as" className="text-blue-600 hover:underline">kundeservice@smarthjem.as</a></li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Vanlige spørsmål</CardTitle>
              <CardDescription>
                Her finner du svar på noen av de vanligste spørsmålene våre kunder har.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-1">Hva er åpningstidene for kundeservice?</h3>
                  <p className="text-gray-600">Vår kundeservice er tilgjengelig mandag til fredag fra 09:00 til 16:00.</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-1">Hvor raskt kan jeg forvente svar?</h3>
                  <p className="text-gray-600">Vi streber etter å svare på alle henvendelser innen 24 timer på virkedager.</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-1">Kan jeg se tidligere henvendelser?</h3>
                  <p className="text-gray-600">Når vår nye løsning er ferdig implementert, vil du kunne se hele historikken over dine henvendelser i din brukerprofil.</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-1">Hvordan endrer jeg informasjon i min kalender?</h3>
                  <p className="text-gray-600">Du kan enkelt redigere hendelser ved å åpne kalenderen og klikke på hendelsen du vil endre. Du kan også legge til nye hendelser ved å klikke på ønsket dato.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}