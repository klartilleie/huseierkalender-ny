import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, MessageSquare, AlertCircle, CheckCircle, ChevronRight, Tag, Clock, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { DialogNewCase } from "@/components/cases/DialogNewCase";
import CaseDetails from "@/components/cases/CaseDetails";
import useDocumentTitle from "@/hooks/use-document-title";
import Layout from "@/components/Layout";

type Case = {
  id: number;
  userId: number;
  adminId: number | null;
  caseNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedById: number | null;
};

export default function CaseManagementPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);
  const [activeCaseTab, setActiveCaseTab] = useState("open");
  
  useDocumentTitle(t("caseManagement.pageTitle"));

  // Query to get all cases for current user
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
    enabled: !!user,
  });

  // Create new case mutation
  const createCaseMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create case');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: t("caseManagement.caseCreatedTitle"),
        description: t("caseManagement.caseCreatedDescription"),
      });
      setIsNewCaseDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
    },
    onError: (error: Error) => {
      toast({
        title: t("caseManagement.errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get open and closed cases
  const openCases = cases?.filter(c => !c.isClosed) || [];
  const closedCases = cases?.filter(c => c.isClosed) || [];

  // Handle new case creation
  const handleCreateCase = (formData: any) => {
    createCaseMutation.mutate(formData);
  };

  // Render case priority badge
  const renderPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive">{t("caseManagement.priorityHigh")}</Badge>;
      case 'medium':
        return <Badge variant="default">{t("caseManagement.priorityMedium")}</Badge>;
      case 'low':
        return <Badge variant="outline">{t("caseManagement.priorityLow")}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Render case status badge
  const renderStatusBadge = (status: string, isClosed?: boolean) => {
    // Viser lukket-badge uansett hva statusen er hvis saken er lukket
    if (isClosed) {
      return <Badge variant="destructive">{t("caseManagement.closed")}</Badge>;
    }
    
    switch (status.toLowerCase()) {
      case 'open':
        return <Badge variant="secondary">{t("caseManagement.statusOpen")}</Badge>;
      case 'in_progress':
        return <Badge variant="default">{t("caseManagement.statusInProgress")}</Badge>;
      case 'resolved':
        return <Badge variant="success">{t("caseManagement.statusResolved")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Render a case card
  const renderCaseCard = (caseItem: Case) => (
    <Card 
      key={caseItem.id} 
      className={`mb-4 hover:shadow-md transition-shadow ${
        selectedCase === caseItem.id ? 'border-primary' : ''
      }`}
      onClick={() => setSelectedCase(caseItem.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">{caseItem.title}</CardTitle>
          {renderPriorityBadge(caseItem.priority)}
        </div>
        <CardDescription className="flex items-center space-x-1 text-sm">
          <Tag className="h-3.5 w-3.5" />
          <span>{caseItem.caseNumber}</span>
          <span>•</span>
          <Clock className="h-3.5 w-3.5" />
          <span>{format(new Date(caseItem.createdAt), 'dd.MM.yyyy')}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex space-x-2 items-center">
          <span className="font-medium text-sm">{t("caseManagement.category")}:</span>
          <span className="text-sm">{caseItem.category}</span>
        </div>
        <div className="flex space-x-2 items-center mt-1">
          <span className="font-medium text-sm">{t("caseManagement.status")}:</span>
          {renderStatusBadge(caseItem.status, caseItem.isClosed)}
        </div>
        {caseItem.adminId && (
          <div className="flex space-x-2 items-center mt-1">
            <span className="font-medium text-sm">{t("caseManagement.assignedToAdmin")}:</span>
            <span className="text-sm flex items-center">
              <UserCheck className="h-3.5 w-3.5 mr-1" />
              {t("caseManagement.customerService")}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedCase(caseItem.id)}>
          {t("caseManagement.viewCase")}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <Layout>
      <div className="container p-4 mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{t("caseManagement.title")}</h1>
          <Button onClick={() => setIsNewCaseDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            {t("caseManagement.newCase")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Tabs 
              defaultValue="open" 
              value={activeCaseTab}
              onValueChange={setActiveCaseTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="open" className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  <span>{t("caseManagement.openCases")}</span>
                  {openCases.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {openCases.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span>{t("caseManagement.closedCases")}</span>
                  {closedCases.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {closedCases.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="mt-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="spinner" />
                    <p className="mt-2">{t("common.loading")}</p>
                  </div>
                ) : openCases.length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">{t("caseManagement.noOpenCases")}</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                      {t("caseManagement.noOpenCasesDescription")}
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setIsNewCaseDialogOpen(true)}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      {t("caseManagement.createFirstCase")}
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-300px)] pr-4">
                    {openCases.map(caseItem => renderCaseCard(caseItem))}
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="closed" className="mt-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="spinner" />
                    <p className="mt-2">{t("common.loading")}</p>
                  </div>
                ) : closedCases.length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <CheckCircle className="h-10 w-10 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">{t("caseManagement.noClosedCases")}</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                      {t("caseManagement.noClosedCasesDescription")}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[calc(100vh-300px)] pr-4">
                    {closedCases.map(caseItem => renderCaseCard(caseItem))}
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="md:col-span-2">
            {selectedCase ? (
              <CaseDetails 
                caseId={selectedCase} 
                onClose={() => setSelectedCase(null)} 
              />
            ) : (
              <div className="border rounded-lg p-8 h-full flex flex-col items-center justify-center text-center bg-muted/20">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t("caseManagement.noCaseSelected")}</h2>
                <p className="text-muted-foreground max-w-md">
                  {t("caseManagement.selectCaseDescription")}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogNewCase 
          open={isNewCaseDialogOpen} 
          onOpenChange={setIsNewCaseDialogOpen}
          onSubmit={handleCreateCase}
        />
      </div>
    </Layout>
  );
}