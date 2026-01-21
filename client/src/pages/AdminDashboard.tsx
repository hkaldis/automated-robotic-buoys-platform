import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest, invalidateRelatedQueries } from "@/lib/queryClient";
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
import { Building2, Users, Plus, Trash2, LogOut, Loader2, Calendar, Play, Pencil, Anchor, ArrowRight, RotateCcw } from "lucide-react";
import type { SailClub, UserRole, Event, Buoy } from "@shared/schema";
import { useBoatClasses } from "@/hooks/use-api";
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
  const [newEventBoatClassId, setNewEventBoatClassId] = useState<string>("");
  const [newEventClubId, setNewEventClubId] = useState("");
  const [editingClub, setEditingClub] = useState<SailClub | null>(null);
  const [editClubName, setEditClubName] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventType, setEditEventType] = useState<"race" | "training">("race");
  const [editEventBoatClassId, setEditEventBoatClassId] = useState<string>("");
  const [buoyDialogOpen, setBuoyDialogOpen] = useState(false);
  const [assignBuoyDialogOpen, setAssignBuoyDialogOpen] = useState(false);
  const [newBuoyName, setNewBuoyName] = useState("");
  const [newBuoyLat, setNewBuoyLat] = useState("0");
  const [newBuoyLng, setNewBuoyLng] = useState("0");
  const [newBuoyOwnership, setNewBuoyOwnership] = useState<"platform_owned" | "long_rental" | "event_rental">("platform_owned");
  const [selectedBuoyForAssign, setSelectedBuoyForAssign] = useState<Buoy | null>(null);
  const [assignToClubId, setAssignToClubId] = useState("");

  const { data: clubs = [], isLoading: clubsLoading } = useQuery<SailClub[]>({
    queryKey: ["/api/sail-clubs"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: boatClassesData, isLoading: boatClassesLoading } = useBoatClasses();
  const boatClasses = boatClassesData || [];

  const { data: buoys = [], isLoading: buoysLoading } = useQuery<Buoy[]>({
    queryKey: ["/api/buoys"],
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
    mutationFn: async (data: { name: string; type: string; boatClass: string; boatClassId: string | null; sailClubId: string }) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("events");
      setEventDialogOpen(false);
      setNewEventName("");
      setNewEventClubId("");
      setNewEventBoatClassId("");
      toast({ title: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; type?: string; boatClass?: string; boatClassId?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("events");
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
      invalidateRelatedQueries("events");
      toast({ title: "Event deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete event", variant: "destructive" });
    },
  });

  const createBuoyMutation = useMutation({
    mutationFn: async (data: { name: string; lat: number; lng: number; ownershipType: string }) => {
      const res = await apiRequest("POST", "/api/buoys", {
        ...data,
        inventoryStatus: "in_inventory",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      setBuoyDialogOpen(false);
      setNewBuoyName("");
      setNewBuoyLat("0");
      setNewBuoyLng("0");
      setNewBuoyOwnership("platform_owned");
      toast({ title: "Buoy created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create buoy", variant: "destructive" });
    },
  });

  const deleteBuoyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/buoys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      toast({ title: "Buoy deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete buoy", variant: "destructive" });
    },
  });

  const assignBuoyToClubMutation = useMutation({
    mutationFn: async ({ buoyId, sailClubId }: { buoyId: string; sailClubId: string }) => {
      const res = await apiRequest("POST", `/api/buoys/${buoyId}/assign-club`, { sailClubId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      setAssignBuoyDialogOpen(false);
      setSelectedBuoyForAssign(null);
      setAssignToClubId("");
      toast({ title: "Buoy assigned to club" });
    },
    onError: () => {
      toast({ title: "Failed to assign buoy", variant: "destructive" });
    },
  });

  const releaseBuoyToInventoryMutation = useMutation({
    mutationFn: async (buoyId: string) => {
      const res = await apiRequest("POST", `/api/buoys/${buoyId}/release-inventory`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      toast({ title: "Buoy returned to inventory" });
    },
    onError: () => {
      toast({ title: "Failed to release buoy", variant: "destructive" });
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
    if (newEventName.trim() && newEventClubId && newEventBoatClassId) {
      const selectedBoatClass = boatClasses.find(bc => bc.id === newEventBoatClassId);
      createEventMutation.mutate({
        name: newEventName.trim(),
        type: newEventType,
        boatClass: selectedBoatClass?.name || "Unknown",
        boatClassId: newEventBoatClassId,
        sailClubId: newEventClubId,
      });
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventName(event.name);
    setEditEventType(event.type as "race" | "training");
    setEditEventBoatClassId(event.boatClassId || "");
    setEditEventDialogOpen(true);
  };

  const handleUpdateEvent = () => {
    if (editingEvent && editEventName.trim()) {
      const selectedBoatClass = boatClasses.find(bc => bc.id === editEventBoatClassId);
      updateEventMutation.mutate({
        id: editingEvent.id,
        name: editEventName.trim(),
        type: editEventType,
        boatClass: selectedBoatClass?.name || editingEvent.boatClass,
        boatClassId: editEventBoatClassId || null,
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

  const handleCreateBuoy = () => {
    if (newBuoyName.trim()) {
      createBuoyMutation.mutate({
        name: newBuoyName.trim(),
        lat: parseFloat(newBuoyLat) || 0,
        lng: parseFloat(newBuoyLng) || 0,
        ownershipType: newBuoyOwnership,
      });
    }
  };

  const handleOpenAssignDialog = (buoy: Buoy) => {
    setSelectedBuoyForAssign(buoy);
    setAssignToClubId("");
    setAssignBuoyDialogOpen(true);
  };

  const handleAssignBuoyToClub = () => {
    if (selectedBuoyForAssign && assignToClubId) {
      assignBuoyToClubMutation.mutate({
        buoyId: selectedBuoyForAssign.id,
        sailClubId: assignToClubId,
      });
    }
  };

  const getInventoryStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      in_inventory: "secondary",
      assigned_club: "default",
      assigned_event: "outline",
      maintenance: "destructive",
      retired: "destructive",
    };
    const labels: Record<string, string> = {
      in_inventory: "In Inventory",
      assigned_club: "At Club",
      assigned_event: "At Event",
      maintenance: "Maintenance",
      retired: "Retired",
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const getOwnershipBadge = (ownership: string) => {
    const labels: Record<string, string> = {
      platform_owned: "Platform Owned",
      long_rental: "Long Rental",
      event_rental: "Event Rental",
    };
    return <Badge variant="outline">{labels[ownership] || ownership}</Badge>;
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
            <TabsTrigger value="buoys" className="gap-2" data-testid="tab-buoys">
              <Anchor className="h-4 w-4" />
              Buoys
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
                        <Select value={newEventBoatClassId} onValueChange={setNewEventBoatClassId}>
                          <SelectTrigger id="boat-class" data-testid="select-boat-class">
                            <SelectValue placeholder={boatClassesLoading ? "Loading..." : "Select boat class"} />
                          </SelectTrigger>
                          <SelectContent>
                            {boatClassesLoading ? (
                              <div className="flex items-center justify-center p-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                            ) : (
                              boatClasses.map((bc) => (
                                <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleCreateEvent}
                        disabled={createEventMutation.isPending || !newEventName.trim() || !newEventClubId || !newEventBoatClassId}
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

          <TabsContent value="buoys">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Buoy Inventory</CardTitle>
                  <CardDescription>Manage robotic buoys across the platform</CardDescription>
                </div>
                <Dialog open={buoyDialogOpen} onOpenChange={setBuoyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-buoy">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Buoy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Buoy</DialogTitle>
                      <DialogDescription>Register a new robotic buoy to the inventory</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="buoy-name">Buoy Name</Label>
                        <Input
                          id="buoy-name"
                          value={newBuoyName}
                          onChange={(e) => setNewBuoyName(e.target.value)}
                          placeholder="e.g., Buoy-001"
                          data-testid="input-buoy-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="buoy-lat">Latitude</Label>
                          <Input
                            id="buoy-lat"
                            type="number"
                            step="0.000001"
                            value={newBuoyLat}
                            onChange={(e) => setNewBuoyLat(e.target.value)}
                            data-testid="input-buoy-lat"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="buoy-lng">Longitude</Label>
                          <Input
                            id="buoy-lng"
                            type="number"
                            step="0.000001"
                            value={newBuoyLng}
                            onChange={(e) => setNewBuoyLng(e.target.value)}
                            data-testid="input-buoy-lng"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buoy-ownership">Ownership Type</Label>
                        <Select value={newBuoyOwnership} onValueChange={(v) => setNewBuoyOwnership(v as "platform_owned" | "long_rental" | "event_rental")}>
                          <SelectTrigger data-testid="select-buoy-ownership">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="platform_owned">Platform Owned</SelectItem>
                            <SelectItem value="long_rental">Long Rental</SelectItem>
                            <SelectItem value="event_rental">Event Rental</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleCreateBuoy}
                        disabled={createBuoyMutation.isPending || !newBuoyName.trim()}
                        className="w-full"
                        data-testid="button-create-buoy"
                      >
                        {createBuoyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Buoy"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {buoysLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : buoys.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No buoys in inventory. Add your first buoy.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Ownership</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Battery</TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buoys.map((buoy) => (
                        <TableRow key={buoy.id} data-testid={`row-buoy-${buoy.id}`}>
                          <TableCell className="font-medium">{buoy.name}</TableCell>
                          <TableCell>{getOwnershipBadge(buoy.ownershipType)}</TableCell>
                          <TableCell>{getInventoryStatusBadge(buoy.inventoryStatus)}</TableCell>
                          <TableCell>{getClubName(buoy.sailClubId)}</TableCell>
                          <TableCell>
                            <Badge variant={buoy.battery > 20 ? "secondary" : "destructive"}>
                              {buoy.battery}%
                            </Badge>
                          </TableCell>
                          <TableCell className="flex gap-1">
                            {buoy.inventoryStatus === "in_inventory" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenAssignDialog(buoy)}
                                title="Assign to Club"
                                data-testid={`button-assign-buoy-${buoy.id}`}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}
                            {(buoy.inventoryStatus === "assigned_club" || buoy.inventoryStatus === "assigned_event") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => releaseBuoyToInventoryMutation.mutate(buoy.id)}
                                disabled={releaseBuoyToInventoryMutation.isPending}
                                title="Return to Inventory"
                                data-testid={`button-release-buoy-${buoy.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteBuoyMutation.mutate(buoy.id)}
                              disabled={deleteBuoyMutation.isPending}
                              data-testid={`button-delete-buoy-${buoy.id}`}
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
        </Tabs>
      </main>

      <Dialog open={assignBuoyDialogOpen} onOpenChange={setAssignBuoyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Buoy to Club</DialogTitle>
            <DialogDescription>
              Assign {selectedBuoyForAssign?.name} to a sailing club
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-club">Select Club</Label>
              <Select value={assignToClubId} onValueChange={setAssignToClubId}>
                <SelectTrigger data-testid="select-assign-club">
                  <SelectValue placeholder="Select a club" />
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
              onClick={handleAssignBuoyToClub}
              disabled={assignBuoyToClubMutation.isPending || !assignToClubId}
              className="w-full"
              data-testid="button-confirm-assign-buoy"
            >
              {assignBuoyToClubMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign to Club"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Select value={editEventBoatClassId} onValueChange={setEditEventBoatClassId}>
                <SelectTrigger id="edit-boat-class" data-testid="select-edit-boat-class">
                  <SelectValue placeholder={boatClassesLoading ? "Loading..." : "Select boat class"} />
                </SelectTrigger>
                <SelectContent>
                  {boatClassesLoading ? (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    boatClasses.map((bc) => (
                      <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
