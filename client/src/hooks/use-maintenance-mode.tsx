import { useQuery } from "@tanstack/react-query";

interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

export function useMaintenanceMode() {
  return useQuery<MaintenanceStatus>({
    queryKey: ["/api/maintenance-status"],
    queryFn: async () => {
      const response = await fetch("/api/maintenance-status");
      if (!response.ok) {
        throw new Error("Failed to fetch maintenance status");
      }
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 30000, // Data is fresh for 30 seconds
  });
}