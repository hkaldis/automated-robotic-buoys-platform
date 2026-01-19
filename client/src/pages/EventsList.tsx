import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Loader2, Play, Calendar } from "lucide-react";
import type { Event } from "@shared/schema";
import alconmarksLogo from "@assets/ALCON_MARKS_LOGO_BLACK_BACKGROUND_1768786798926.jpeg";

export default function EventsList() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut, eventAccess } = useAuth();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const accessibleEvents = events.filter((e) => eventAccess.includes(e.id));

  const handleOpenEvent = (eventId: string) => {
    setLocation(`/race/${eventId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={alconmarksLogo} alt="Alconmarks" className="h-8 rounded" />
          <div>
            <h1 className="font-semibold">My Events</h1>
            <p className="text-sm text-muted-foreground">Event Manager</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{user?.username}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            disabled={isLoggingOut}
            data-testid="button-logout"
          >
            {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Assigned Events
            </CardTitle>
            <CardDescription>Events you have access to manage</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : accessibleEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">No events assigned yet.</p>
                <p className="text-sm text-muted-foreground">Contact your club manager to get access to events.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accessibleEvents.map((event) => (
                  <Card key={event.id} className="hover-elevate cursor-pointer" data-testid={`card-event-${event.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{event.name}</CardTitle>
                        <Badge variant={event.type === "race" ? "default" : "secondary"}>
                          {event.type === "race" ? "Race" : "Training"}
                        </Badge>
                      </div>
                      <CardDescription>{event.boatClass}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        className="w-full"
                        onClick={() => handleOpenEvent(event.id)}
                        data-testid={`button-open-event-${event.id}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Open Control
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
