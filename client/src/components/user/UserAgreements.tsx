import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, MessageSquare, Eye } from "lucide-react";
import type { AdminAgreement } from "@shared/schema";

interface EnrichedAgreement extends AdminAgreement {
  userName: string;
  adminName: string;
}

export function UserAgreements() {
  // Fetch user's agreements
  const { data: agreements = [], isLoading } = useQuery<EnrichedAgreement[]>({
    queryKey: ["/api/admin-agreements"]
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "text-blue-600 bg-blue-50";
      case "completed":
        return "text-green-600 bg-green-50";
      case "cancelled":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Planlagt";
      case "completed":
        return "Fullført";
      case "cancelled":
        return "Kansellert";
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <p>Laster dine avtaler...</p>
      </div>
    );
  }

  // Sort agreements by date, with scheduled first, then recent completed
  const sortedAgreements = [...agreements].sort((a, b) => {
    // Scheduled agreements first
    if (a.status === "scheduled" && b.status !== "scheduled") return -1;
    if (b.status === "scheduled" && a.status !== "scheduled") return 1;
    
    // Then sort by date
    return new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime();
  });

  // Separate upcoming and past agreements
  const now = new Date();
  const upcomingAgreements = sortedAgreements.filter(
    a => a.status === "scheduled" && new Date(a.meetingDate) >= now
  );
  const pastAgreements = sortedAgreements.filter(
    a => a.status !== "scheduled" || new Date(a.meetingDate) < now
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Mine avtaler med admin</h2>
        <p className="text-muted-foreground">
          Se dine planlagte møter og tidligere avtaler med administrasjonen
        </p>
      </div>

      {/* Upcoming Agreements */}
      {upcomingAgreements.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Kommende avtaler</h3>
          <div className="grid gap-4">
            {upcomingAgreements.map((agreement) => (
              <Card key={agreement.id} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{agreement.title}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(agreement.meetingDate), "dd.MM.yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(agreement.meetingDate), "HH:mm")}
                        </span>
                        {agreement.meetingLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {agreement.meetingLocation}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agreement.status)}`}>
                      {getStatusText(agreement.status)}
                    </span>
                  </div>
                </CardHeader>
                {agreement.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{agreement.description}</p>
                  </CardContent>
                )}
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `/user/agreements/${agreement.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Se detaljer og notater
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Agreements */}
      {pastAgreements.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Tidligere avtaler</h3>
          <div className="grid gap-4">
            {pastAgreements.map((agreement) => (
              <Card key={agreement.id} className={agreement.status === "cancelled" ? "opacity-75" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{agreement.title}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(agreement.meetingDate), "dd.MM.yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(agreement.meetingDate), "HH:mm")}
                        </span>
                        {agreement.meetingLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {agreement.meetingLocation}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agreement.status)}`}>
                      {getStatusText(agreement.status)}
                    </span>
                  </div>
                </CardHeader>
                {agreement.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{agreement.description}</p>
                  </CardContent>
                )}
                <CardContent>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = `/user/agreements/${agreement.id}`}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Se notater fra møtet
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No agreements */}
      {agreements.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">Du har ingen avtaler med admin ennå</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}