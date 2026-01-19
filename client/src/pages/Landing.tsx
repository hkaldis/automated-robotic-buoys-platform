import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Anchor, Navigation, Users, Calendar, Loader2 } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === "super_admin") {
        setLocation("/admin");
      } else if (user.role === "club_manager") {
        setLocation("/club");
      } else if (user.role === "event_manager") {
        setLocation("/events");
      }
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <Anchor className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-2">RoBuoys</h1>
        <p className="text-xl text-muted-foreground">
          Robotic Buoys Race Management Platform
        </p>
      </div>

      <Card className="w-full max-w-md mb-8">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Manage sailing race courses with automated robotic buoys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            size="lg"
            onClick={() => setLocation("/login")}
            data-testid="button-enter-control-center"
          >
            Enter Control Center
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
        <div className="flex flex-col items-center text-center p-4">
          <Navigation className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold">Course Management</h3>
          <p className="text-sm text-muted-foreground">
            Create and modify race courses in real-time
          </p>
        </div>
        <div className="flex flex-col items-center text-center p-4">
          <Users className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold">Role-Based Access</h3>
          <p className="text-sm text-muted-foreground">
            Club managers and event managers with specific permissions
          </p>
        </div>
        <div className="flex flex-col items-center text-center p-4">
          <Calendar className="h-8 w-8 text-primary mb-2" />
          <h3 className="font-semibold">Event Control</h3>
          <p className="text-sm text-muted-foreground">
            Manage races and training events
          </p>
        </div>
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        PWA enabled - Add to Home Screen for best experience
      </div>
    </div>
  );
}
