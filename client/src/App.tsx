import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import RaceControl from "@/pages/RaceControl";
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import AdminDashboard from "@/pages/AdminDashboard";
import ClubDashboard from "@/pages/ClubDashboard";
import EventsList from "@/pages/EventsList";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

function AuthenticatedRedirect() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/landing" />;
  }

  if (user.role === "super_admin") {
    return <Redirect to="/admin" />;
  } else if (user.role === "club_manager") {
    return <Redirect to="/club" />;
  } else {
    return <Redirect to="/events" />;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthenticatedRedirect} />
      <Route path="/landing" component={Landing} />
      <Route path="/login" component={Login} />
      
      <Route path="/admin">
        <ProtectedRoute allowedRoles={["super_admin"]}>
          <AdminDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/club">
        <ProtectedRoute allowedRoles={["club_manager"]}>
          <ClubDashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/events">
        <ProtectedRoute allowedRoles={["event_manager"]}>
          <EventsList />
        </ProtectedRoute>
      </Route>

      <Route path="/race/:eventId">
        {(params: { eventId: string }) => (
          <ProtectedRoute allowedRoles={["super_admin", "club_manager", "event_manager"]}>
            <RaceControl eventId={params.eventId as string} />
          </ProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
