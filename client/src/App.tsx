import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import NotFound from "./pages/not-found";
import HomePage from "./pages/home-page";
import AuthPage from "./pages/auth-page";
import AdminPage from "./pages/admin-page";
import SettingsPage from "./pages/settings-page";

import ResetPasswordPage from "./pages/reset-password-page";
import CaseManagementPage from "./pages/case-management-page";
import SupportPage from "./pages/support-page-new";
import PricesPage from "./pages/PricesPage";
import PayoutsPage from "./pages/payouts-page";
import AdminAgreementsPage from "./pages/admin-agreements-page";
import AdminAgreementDetailsPage from "./pages/admin-agreement-details-page";
import UserAgreementsPage from "./pages/user-agreements-page";
import UserAgreementDetailsPage from "./pages/user-agreement-details-page";
import AppointmentsPage from "./pages/appointments-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider, useAuth } from "./hooks/use-auth";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
import NotificationBell from "./components/notifications/NotificationBell";
import { LanguageProvider } from "./hooks/use-language";
import { DevicePreferenceProvider } from "./hooks/use-device-preference";
import ErrorBoundary from "./components/ErrorBoundary";
import { useMaintenanceMode } from "./hooks/use-maintenance-mode";
import MaintenancePage from "./components/MaintenancePage";

function Router() {
  const { user } = useAuth();
  const { data: maintenanceStatus, isLoading: maintenanceLoading } = useMaintenanceMode();
  
  // Show maintenance page for non-admin users when maintenance mode is active
  if (!maintenanceLoading && maintenanceStatus?.enabled && (!user || !user.isAdmin)) {
    return <MaintenancePage message={maintenanceStatus.message} />;
  }
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <ProtectedRoute path="/admin" component={AdminPage} adminOnly={true} />
      <ProtectedRoute path="/settings" component={SettingsPage} />

      <ProtectedRoute path="/cases" component={CaseManagementPage} />
      <ProtectedRoute path="/support" component={SupportPage} />
      <ProtectedRoute path="/appointments" component={AppointmentsPage} />
      <ProtectedRoute path="/prices" component={PricesPage} />
      <ProtectedRoute path="/payouts" component={PayoutsPage} />
      <ProtectedRoute path="/admin/agreements" component={AdminAgreementsPage} adminOnly={true} />
      <ProtectedRoute path="/admin/agreements/:id" component={AdminAgreementDetailsPage} adminOnly={true} />
      <ProtectedRoute path="/user/agreements" component={UserAgreementsPage} />
      <ProtectedRoute path="/user/agreements/:id" component={UserAgreementDetailsPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="*" component={HomePage} />
    </Switch>
  );
}

function App() {
  // Add loading indicator to help debug white screen issues
  console.log('App component is rendering');

  try {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <DevicePreferenceProvider>
              <AuthProvider>
                <NotificationProvider>
                  <TooltipProvider>
                    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
                      <Toaster />
                      <Router />
                      <NotificationBell />
                    </div>
                  </TooltipProvider>
                </NotificationProvider>
              </AuthProvider>
            </DevicePreferenceProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Smart Hjem Kalender
          </h1>
          <p className="text-gray-600 mb-4">
            Applikasjonen kunne ikke lastes. Prøv å oppdatere siden.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Oppdater siden
          </button>
        </div>
      </div>
    );
  }
}

export default App;