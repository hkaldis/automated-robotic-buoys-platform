import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Plus, Trash2, LogOut, Loader2, Play, UserPlus } from "lucide-react";
import type { Event, SailClub, UserEventAccess } from "@shared/schema";
import alconmarksLogo from "@assets/IMG_0084_1_1768808004796.png";

interface SafeUser {
  id: string;
  username: string;
  role: string;
  sailClubId: string | null;
}

export default function ClubDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventType, setNewEventType] = useState<"race" | "training">("race");
  const [newEventBoatClass, setNewEventBoatClass] = useState("Laser");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data: club } = useQuery<SailClub>({
    queryKey: ["/api/sail-clubs", user?.sailClubId],
    enabled: !!user?.sailClubId,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const clubEvents = events.filter((e) => e.sailClubId === user?.sailClubId);
  const eventManagers = users.filter((u) => u.role === "event_manager" && u.sailClubId === user?.sailClubId);

  const createEventMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; boatClass: string; sailClubId: string }) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEventDialogOpen(false);
      setNewEventName("");
      toast({ title: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      toast({ title: "Event manager created successfully" });
    },
    onError: (err: any) => {
      const message = err?.message?.includes("409") ? "Username already exists" : "Failed to create user";
      toast({ title: message, variant: "destructive" });
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async ({ userId, eventId }: { userId: string; eventId: string }) => {
      const res = await apiRequest("POST", `/api/users/${userId}/events`, { eventId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Access granted successfully" });
      setAccessDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to grant access", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  const handleCreateEvent = () => {
    if (newEventName.trim() && user?.sailClubId) {
      createEventMutation.mutate({
        name: newEventName.trim(),
        type: newEventType,
        boatClass: newEventBoatClass,
        sailClubId: user.sailClubId,
      });
    }
  };

  const handleCreateUser = () => {
    if (newUsername.trim() && newPassword.trim()) {
      createUserMutation.mutate({
        username: newUsername.trim(),
        password: newPassword,
        role: "event_manager",
      });
    }
  };

  const handleOpenEvent = (eventId: string) => {
    setLocation(`/race/${eventId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={alconmarksLogo} alt="Alconmarks" className="h-8 rounded" />
          <div>
            <h1 className="font-semibold">{club?.name || "Club Dashboard"}</h1>
            <p className="text-sm text-muted-foreground">Club Manager</p>
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
        <Tabs defaultValue="events">
          <TabsList className="mb-4">
            <TabsTrigger value="events" className="gap-2" data-testid="tab-events">
              <Calendar className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="managers" className="gap-2" data-testid="tab-managers">
              <Users className="h-4 w-4" />
              Event Managers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Events</CardTitle>
                  <CardDescription>Races and training sessions</CardDescription>
                </div>
                <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-event">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Event</DialogTitle>
                      <DialogDescription>Add a new race or training event</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-name">Event Name</Label>
                        <Input
                          id="event-name"
                          value={newEventName}
                          onChange={(e) => setNewEventName(e.target.value)}
                          placeholder="Enter event name"
                          data-testid="input-event-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="event-type">Type</Label>
                        <Select value={newEventType} onValueChange={(v) => setNewEventType(v as "race" | "training")}>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="race">Race</SelectItem>
                            <SelectItem value="training">Training</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="boat-class">Boat Class</Label>
                        <Input
                          id="boat-class"
                          value={newEventBoatClass}
                          onChange={(e) => setNewEventBoatClass(e.target.value)}
                          placeholder="e.g., Laser, 420, etc."
                          data-testid="input-boat-class"
                        />
                      </div>
                      <Button
                        onClick={handleCreateEvent}
                        disabled={createEventMutation.isPending || !newEventName.trim()}
                        className="w-full"
                        data-testid="button-create-event"
                      >
                        {createEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : clubEvents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No events found. Create your first event.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Boat Class</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubEvents.map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell>
                            <Badge variant={event.type === "race" ? "default" : "secondary"}>
                              {event.type === "race" ? "Race" : "Training"}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.boatClass}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEvent(event.id)}
                              data-testid={`button-open-event-${event.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="managers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Event Managers</CardTitle>
                  <CardDescription>Users who can manage specific events</CardDescription>
                </div>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-manager">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Event Manager
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Event Manager</DialogTitle>
                      <DialogDescription>Add a new event manager for your club</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username"
                          data-testid="input-manager-username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter password"
                          data-testid="input-manager-password"
                        />
                      </div>
                      <Button
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending || !newUsername.trim() || !newPassword.trim()}
                        className="w-full"
                        data-testid="button-create-manager"
                      >
                        {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Manager"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : eventManagers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No event managers found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventManagers.map((u) => (
                        <TableRow key={u.id} data-testid={`row-manager-${u.id}`}>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setAccessDialogOpen(true);
                              }}
                              data-testid={`button-grant-access-${u.id}`}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteUserMutation.mutate(u.id)}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-manager-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Grant Event Access</DialogTitle>
                  <DialogDescription>Select an event to grant access</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {clubEvents.map((event) => (
                    <Button
                      key={event.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        if (selectedUserId) {
                          grantAccessMutation.mutate({ userId: selectedUserId, eventId: event.id });
                        }
                      }}
                      disabled={grantAccessMutation.isPending}
                      data-testid={`button-select-event-${event.id}`}
                    >
                      {event.name} ({event.type})
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
