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
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "./hooks/use-auth";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
import NotificationBell from "./components/notifications/NotificationBell";
import { LanguageProvider } from "./hooks/use-language";
import { DevicePreferenceProvider } from "./hooks/use-device-preference";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/admin" component={AdminPage} adminOnly={true} />
      <ProtectedRoute path="/settings" component={SettingsPage} />

      <ProtectedRoute path="/cases" component={CaseManagementPage} />
      <ProtectedRoute path="/support" component={SupportPage} />
      <ProtectedRoute path="/prices" component={PricesPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DevicePreferenceProvider>
          <AuthProvider>
            <NotificationProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
                <NotificationBell />
              </TooltipProvider>
            </NotificationProvider>
          </AuthProvider>
        </DevicePreferenceProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;