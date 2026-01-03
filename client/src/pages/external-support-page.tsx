import { useState } from "react";
import { useTranslation } from "@/hooks/use-language";
import TawkToChat from "@/components/customer-support/TawkToChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  PhoneCall, 
  Mail, 
  Clock, 
  Calendar, 
  MessageSquare, 
  FileText, 
  HelpCircle,
  ExternalLink
} from "lucide-react";

export default function ExternalSupportPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("chat");
  
  // Customer support contact information
  const supportInfo = {
    phone: "477 14 646",
    email: "kundeservice@smarthjem.as",
    hours: "Mandag-Fredag 09:00-16:00",
  };

  // Common support topics
  const supportTopics = [
    {
      id: "account",
      title: t("support.accountIssues"),
      description: t("support.accountIssuesDesc"),
      icon: <FileText className="h-5 w-5" />
    },
    {
      id: "calendar",
      title: t("support.calendarIssues"),
      description: t("support.calendarIssuesDesc"),
      icon: <Calendar className="h-5 w-5" />
    },
    {
      id: "technical",
      title: t("support.technicalIssues"),
      description: t("support.technicalIssuesDesc"),
      icon: <HelpCircle className="h-5 w-5" />
    }
  ];

  // Load Tawk.to chat widget
  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        {t("support.customerSupport")}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t("support.customerSupportDesc")}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main content area */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("support.howCanWeHelp")}</CardTitle>
              <CardDescription>
                {t("support.chooseContactMethod")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 mb-8">
                  <TabsTrigger value="chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t("support.liveChat")}
                  </TabsTrigger>
                  <TabsTrigger value="call">
                    <PhoneCall className="h-4 w-4 mr-2" />
                    {t("support.call")}
                  </TabsTrigger>
                  <TabsTrigger value="email">
                    <Mail className="h-4 w-4 mr-2" />
                    {t("support.email")}
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="chat" className="mt-0">
                  <div className="text-center p-10 border rounded-lg bg-muted/10">
                    <MessageSquare className="h-12 w-12 mx-auto text-primary/70 mb-4" />
                    <h3 className="text-xl font-medium mb-2">{t("support.startChatting")}</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      {t("support.chatInstructions")}
                    </p>
                    <Button 
                      size="lg" 
                      onClick={() => {
                        // Redirect to the email section as a fallback
                        window.open(`mailto:${supportInfo.email}`, '_self');
                      }}
                    >
                      {t("support.openChat")}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      {t("support.chatHours", { hours: supportInfo.hours })}
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="call" className="mt-0">
                  <div className="text-center p-10 border rounded-lg bg-muted/10">
                    <PhoneCall className="h-12 w-12 mx-auto text-primary/70 mb-4" />
                    <h3 className="text-xl font-medium mb-2">{t("support.callUs")}</h3>
                    <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                      {t("support.callUsDesc")}
                    </p>
                    <a 
                      href={`tel:${supportInfo.phone}`}
                      className="text-2xl font-bold text-primary block mb-6"
                    >
                      {supportInfo.phone}
                    </a>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                      <Clock className="h-4 w-4" />
                      <span>{supportInfo.hours}</span>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="email" className="mt-0">
                  <div className="text-center p-10 border rounded-lg bg-muted/10">
                    <Mail className="h-12 w-12 mx-auto text-primary/70 mb-4" />
                    <h3 className="text-xl font-medium mb-2">{t("support.emailUs")}</h3>
                    <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                      {t("support.emailUsDesc")}
                    </p>
                    <a 
                      href={`mailto:${supportInfo.email}`}
                      className="text-xl font-medium text-primary block mb-6"
                    >
                      {supportInfo.email}
                    </a>
                    <Button asChild variant="outline">
                      <a href={`mailto:${supportInfo.email}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        {t("support.sendEmail")}
                      </a>
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact info card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("support.contactInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <PhoneCall className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">{t("support.phoneNumber")}</div>
                  <a href={`tel:${supportInfo.phone}`} className="text-primary hover:underline">
                    {supportInfo.phone}
                  </a>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">{t("support.emailAddress")}</div>
                  <a href={`mailto:${supportInfo.email}`} className="text-primary hover:underline">
                    {supportInfo.email}
                  </a>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="font-medium">{t("support.businessHours")}</div>
                  <div className="text-muted-foreground">{supportInfo.hours}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Common topics card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("support.commonTopics")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supportTopics.map((topic) => (
                <div key={topic.id} className="group">
                  <button 
                    className="flex items-start w-full text-left gap-3 hover:bg-muted/50 p-2 rounded-md transition-colors"
                    onClick={() => {
                      setActiveTab("chat");
                      // Redirect to the email section as a fallback
                      window.open(`mailto:${supportInfo.email}`, '_self');
                    }}
                  >
                    <div className="mt-0.5 text-muted-foreground group-hover:text-primary">
                      {topic.icon}
                    </div>
                    <div>
                      <div className="font-medium group-hover:text-primary">{topic.title}</div>
                      <div className="text-sm text-muted-foreground">{topic.description}</div>
                    </div>
                  </button>
                  {topic.id !== supportTopics[supportTopics.length - 1].id && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* FAQ button */}
          <Button variant="outline" className="w-full" asChild>
            <a href="/faq">
              <HelpCircle className="h-4 w-4 mr-2" />
              {t("support.viewFAQ")}
              <ExternalLink className="h-3 w-3 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      {/* Chat widget is loaded through TawkToChat component */}
      <TawkToChat />
    </div>
  );
}