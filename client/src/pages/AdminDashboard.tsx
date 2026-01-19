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
import { Building2, Users, Plus, Trash2, LogOut, Loader2, Calendar, Play, Pencil } from "lucide-react";
import type { SailClub, UserRole, Event } from "@shared/schema";
import alconmarksLogo from "@assets/IMG_0084_1_1768808004796.png";

interface SafeUser {
  id: string;
  username: string;
  role: UserRole;
  sailClubId: string | null;
  createdAt: string | null;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editClubDialogOpen, setEditClubDialogOpen] = useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"club_manager" | "event_manager">("club_manager");
  const [newUserClubId, setNewUserClubId] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventType, setNewEventType] = useState<"race" | "training">("race");
  const [newEventBoatClass, setNewEventBoatClass] = useState("Laser");
  const [newEventClubId, setNewEventClubId] = useState("");
  const [editingClub, setEditingClub] = useState<SailClub | null>(null);
  const [editClubName, setEditClubName] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventType, setEditEventType] = useState<"race" | "training">("race");
  const [editEventBoatClass, setEditEventBoatClass] = useState("");

  const { data: clubs = [], isLoading: clubsLoading } = useQuery<SailClub[]>({
    queryKey: ["/api/sail-clubs"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const createClubMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/sail-clubs", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sail-clubs"] });
      setClubDialogOpen(false);
      setNewClubName("");
      toast({ title: "Club created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create club", variant: "destructive" });
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await apiRequest("PATCH", `/api/sail-clubs/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sail-clubs"] });
      setEditClubDialogOpen(false);
      setEditingClub(null);
      toast({ title: "Club updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update club", variant: "destructive" });
    },
  });

  const deleteClubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sail-clubs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sail-clubs"] });
      toast({ title: "Club deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete club", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string; sailClubId?: string }) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setUserDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewUserRole("club_manager");
      setNewUserClubId("");
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => {
      const message = err?.message?.includes("409") ? "Username already exists" : "Failed to create user";
      toast({ title: message, variant: "destructive" });
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

  const createEventMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; boatClass: string; sailClubId: string }) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEventDialogOpen(false);
      setNewEventName("");
      setNewEventClubId("");
      toast({ title: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; type?: string; boatClass?: string }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setEditEventDialogOpen(false);
      setEditingEvent(null);
      toast({ title: "Event updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update event", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete event", variant: "destructive" });
    },
  });

  const handleCreateClub = () => {
    if (newClubName.trim()) {
      createClubMutation.mutate(newClubName.trim());
    }
  };

  const handleEditClub = (club: SailClub) => {
    setEditingClub(club);
    setEditClubName(club.name);
    setEditClubDialogOpen(true);
  };

  const handleUpdateClub = () => {
    if (editingClub && editClubName.trim()) {
      updateClubMutation.mutate({ id: editingClub.id, name: editClubName.trim() });
    }
  };

  const handleCreateUser = () => {
    if (newUsername.trim() && newPassword.trim()) {
      createUserMutation.mutate({
        username: newUsername.trim(),
        password: newPassword,
        role: newUserRole,
        sailClubId: newUserClubId || undefined,
      });
    }
  };

  const handleCreateEvent = () => {
    if (newEventName.trim() && newEventClubId) {
      createEventMutation.mutate({
        name: newEventName.trim(),
        type: newEventType,
        boatClass: newEventBoatClass,
        sailClubId: newEventClubId,
      });
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventName(event.name);
    setEditEventType(event.type as "race" | "training");
    setEditEventBoatClass(event.boatClass);
    setEditEventDialogOpen(true);
  };

  const handleUpdateEvent = () => {
    if (editingEvent && editEventName.trim()) {
      updateEventMutation.mutate({
        id: editingEvent.id,
        name: editEventName.trim(),
        type: editEventType,
        boatClass: editEventBoatClass,
      });
    }
  };

  const handleOpenEvent = (eventId: string) => {
    setLocation(`/race/${eventId}`);
  };

  const getClubName = (clubId: string | null) => {
    if (!clubId) return "None";
    const club = clubs.find((c) => c.id === clubId);
    return club?.name || "Unknown";
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      super_admin: "default",
      club_manager: "secondary",
      event_manager: "outline",
    };
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      club_manager: "Club Manager",
      event_manager: "Event Manager",
    };
    return <Badge variant={variants[role] || "outline"}>{labels[role] || role}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={alconmarksLogo} alt="Alconmarks" className="h-8 rounded" />
          <div>
            <h1 className="font-semibold">Alconmarks Admin</h1>
            <p className="text-sm text-muted-foreground">Super Admin Dashboard</p>
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
        <Tabs defaultValue="clubs">
          <TabsList className="mb-4">
            <TabsTrigger value="clubs" className="gap-2" data-testid="tab-clubs">
              <Building2 className="h-4 w-4" />
              Clubs
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-2" data-testid="tab-events">
              <Calendar className="h-4 w-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clubs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Sail Clubs</CardTitle>
                  <CardDescription>Manage sailing clubs in the system</CardDescription>
                </div>
                <Dialog open={clubDialogOpen} onOpenChange={setClubDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-club">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Club
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Club</DialogTitle>
                      <DialogDescription>Add a new sailing club to the system</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="club-name">Club Name</Label>
                        <Input
                          id="club-name"
                          value={newClubName}
                          onChange={(e) => setNewClubName(e.target.value)}
                          placeholder="Enter club name"
                          data-testid="input-club-name"
                        />
                      </div>
                      <Button
                        onClick={handleCreateClub}
                        disabled={createClubMutation.isPending || !newClubName.trim()}
                        className="w-full"
                        data-testid="button-create-club"
                      >
                        {createClubMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Club"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {clubsLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : clubs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No clubs found. Create your first club.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubs.map((club) => (
                        <TableRow key={club.id} data-testid={`row-club-${club.id}`}>
                          <TableCell className="font-medium">{club.name}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClub(club)}
                              data-testid={`button-edit-club-${club.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteClubMutation.mutate(club.id)}
                              disabled={deleteClubMutation.isPending}
                              data-testid={`button-delete-club-${club.id}`}
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
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>All Events</CardTitle>
                  <CardDescription>Manage races and training events across all clubs</CardDescription>
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
                        <Label htmlFor="event-club">Sail Club</Label>
                        <Select value={newEventClubId} onValueChange={setNewEventClubId}>
                          <SelectTrigger data-testid="select-event-club">
                            <SelectValue placeholder="Select club" />
                          </SelectTrigger>
                          <SelectContent>
                            {clubs.map((club) => (
                              <SelectItem key={club.id} value={club.id}>
                                {club.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                        disabled={createEventMutation.isPending || !newEventName.trim() || !newEventClubId}
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
                ) : events.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No events found. Create your first event.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Boat Class</TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell>{getClubName(event.sailClubId)}</TableCell>
                          <TableCell>
                            <Badge variant={event.type === "race" ? "default" : "secondary"}>
                              {event.type === "race" ? "Race" : "Training"}
                            </Badge>
                          </TableCell>
                          <TableCell>{event.boatClass}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEvent(event.id)}
                              data-testid={`button-open-event-${event.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditEvent(event)}
                              data-testid={`button-edit-event-${event.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteEventMutation.mutate(event.id)}
                              disabled={deleteEventMutation.isPending}
                              data-testid={`button-delete-event-${event.id}`}
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
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage user accounts and permissions</CardDescription>
                </div>
                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-user">
                      <Plus className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>Add a new user to the system</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username"
                          data-testid="input-new-username"
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
                          data-testid="input-new-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "club_manager" | "event_manager")}>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="club_manager">Club Manager</SelectItem>
                            <SelectItem value="event_manager">Event Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="club">Sail Club</Label>
                        <Select value={newUserClubId} onValueChange={setNewUserClubId}>
                          <SelectTrigger data-testid="select-club">
                            <SelectValue placeholder="Select club" />
                          </SelectTrigger>
                          <SelectContent>
                            {clubs.map((club) => (
                              <SelectItem key={club.id} value={club.id}>
                                {club.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending || !newUsername.trim() || !newPassword.trim()}
                        className="w-full"
                        data-testid="button-create-user"
                      >
                        {createUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
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
                ) : users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No users found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell>{getRoleBadge(u.role)}</TableCell>
                          <TableCell>{getClubName(u.sailClubId)}</TableCell>
                          <TableCell>
                            {u.role !== "super_admin" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteUserMutation.mutate(u.id)}
                                disabled={deleteUserMutation.isPending}
                                data-testid={`button-delete-user-${u.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={editClubDialogOpen} onOpenChange={setEditClubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Club</DialogTitle>
            <DialogDescription>Update the sailing club details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-club-name">Club Name</Label>
              <Input
                id="edit-club-name"
                value={editClubName}
                onChange={(e) => setEditClubName(e.target.value)}
                placeholder="Enter club name"
                data-testid="input-edit-club-name"
              />
            </div>
            <Button
              onClick={handleUpdateClub}
              disabled={updateClubMutation.isPending || !editClubName.trim()}
              className="w-full"
              data-testid="button-update-club"
            >
              {updateClubMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Club"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editEventDialogOpen} onOpenChange={setEditEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update the event details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-event-name">Event Name</Label>
              <Input
                id="edit-event-name"
                value={editEventName}
                onChange={(e) => setEditEventName(e.target.value)}
                placeholder="Enter event name"
                data-testid="input-edit-event-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-event-type">Type</Label>
              <Select value={editEventType} onValueChange={(v) => setEditEventType(v as "race" | "training")}>
                <SelectTrigger data-testid="select-edit-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="race">Race</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-boat-class">Boat Class</Label>
              <Input
                id="edit-boat-class"
                value={editEventBoatClass}
                onChange={(e) => setEditEventBoatClass(e.target.value)}
                placeholder="e.g., Laser, 420, etc."
                data-testid="input-edit-boat-class"
              />
            </div>
            <Button
              onClick={handleUpdateEvent}
              disabled={updateEventMutation.isPending || !editEventName.trim()}
              className="w-full"
              data-testid="button-update-event"
            >
              {updateEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
