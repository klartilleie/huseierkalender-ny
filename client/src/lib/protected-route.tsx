import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect, useState } from "react";

export function ProtectedRoute({
  path,
  component: Component,
  adminOnly = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  adminOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [showTimeout, setShowTimeout] = useState(false);

  // Force redirect to auth after 500ms if still loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.log('Authentication timeout - redirecting to auth page');
        setShowTimeout(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Force redirect after timeout or if loading fails
  if (showTimeout || (!isLoading && !user)) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Show loading state briefly
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center p-6">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Kontrollerer tilgang...</p>
          </div>
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check if route requires admin permissions
  if (adminOnly && !user.isAdmin && !user.isMiniAdmin) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-4">You need administrator privileges to access this page.</p>
          <Redirect to="/" />
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
