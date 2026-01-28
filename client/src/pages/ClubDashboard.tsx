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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Users, Plus, Trash2, LogOut, Loader2, Play, UserPlus, Pencil, Anchor, ArrowRight, RotateCcw, Globe } from "lucide-react";
import { EventExternalInfo } from "@/components/EventExternalInfo";
import type { Event, SailClub, UserEventAccess, Buoy, BuoyInventoryStatus } from "@shared/schema";
import { useBoatClasses } from "@/hooks/use-api";
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
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventType, setNewEventType] = useState<"race" | "training">("race");
  const [newEventBoatClassId, setNewEventBoatClassId] = useState<string>("");
  const [newEventStartDate, setNewEventStartDate] = useState("");
  const [newEventEndDate, setNewEventEndDate] = useState("");
  
  // Event filter state
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [eventHidePast, setEventHidePast] = useState(true);
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventType, setEditEventType] = useState<"race" | "training">("race");
  const [editEventBoatClassId, setEditEventBoatClassId] = useState<string>("");
  const [editEventStartDate, setEditEventStartDate] = useState("");
  const [editEventEndDate, setEditEventEndDate] = useState("");
  const [editEventManage2SailUrl, setEditEventManage2SailUrl] = useState("");
  const [editEventRacingRulesUrl, setEditEventRacingRulesUrl] = useState("");

  const { data: club } = useQuery<SailClub>({
    queryKey: ["/api/sail-clubs", user?.sailClubId],
    enabled: !!user?.sailClubId,
  });

  // Build events query with filters
  const eventsQueryParams = new URLSearchParams();
  if (eventTypeFilter !== "all") eventsQueryParams.set("type", eventTypeFilter);
  if (eventHidePast) eventsQueryParams.set("hidePast", "true");
  const eventsQueryString = eventsQueryParams.toString();
  
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", eventsQueryString],
    queryFn: async () => {
      const res = await fetch(`/api/events${eventsQueryString ? `?${eventsQueryString}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: boatClassesData, isLoading: boatClassesLoading } = useBoatClasses();
  const boatClasses = boatClassesData || [];

  const { data: buoys = [], isLoading: buoysLoading } = useQuery<Buoy[]>({
    queryKey: ["/api/buoys"],
  });
  
  const clubEvents = events.filter((e) => e.sailClubId === user?.sailClubId);
  const eventManagers = users.filter((u) => u.role === "event_manager" && u.sailClubId === user?.sailClubId);
  const clubBuoys = buoys.filter((b) => b.sailClubId === user?.sailClubId);
  const [assignBuoyDialogOpen, setAssignBuoyDialogOpen] = useState(false);
  const [selectedBuoyForEvent, setSelectedBuoyForEvent] = useState<Buoy | null>(null);
  const [assignToEventId, setAssignToEventId] = useState("");
  
  // State for managing buoys from the events list
  const [manageBuoysDialogOpen, setManageBuoysDialogOpen] = useState(false);
  const [selectedEventForBuoys, setSelectedEventForBuoys] = useState<Event | null>(null);
  
  // State for inline buoy assignment popover (controlled per event)
  const [openPopoverEventId, setOpenPopoverEventId] = useState<string | null>(null);
  
  // State for external info dialog
  const [externalInfoDialogOpen, setExternalInfoDialogOpen] = useState(false);
  const [selectedEventForExternalInfo, setSelectedEventForExternalInfo] = useState<Event | null>(null);

  const createEventMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; boatClass: string; boatClassId: string | null; sailClubId: string; startDate?: string; endDate?: string }) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateRelatedQueries("events");
      setEventDialogOpen(false);
      setNewEventName("");
      setNewEventStartDate("");
      setNewEventEndDate("");
      toast({ title: "Event created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create event", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; type?: string; boatClass?: string; boatClassId?: string | null; startDate?: string; endDate?: string; manage2SailUrl?: string | null; racingRulesUrl?: string | null }) => {
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

  const assignBuoyToEventMutation = useMutation({
    mutationFn: async ({ buoyId, eventId }: { buoyId: string; eventId: string }) => {
      const res = await apiRequest("POST", `/api/buoys/${buoyId}/assign-event`, { eventId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      setAssignBuoyDialogOpen(false);
      setSelectedBuoyForEvent(null);
      setAssignToEventId("");
      toast({ title: "Buoy assigned to event" });
    },
    onError: () => {
      toast({ title: "Failed to assign buoy to event", variant: "destructive" });
    },
  });

  const releaseBuoyFromEventMutation = useMutation({
    mutationFn: async ({ buoyId, eventId }: { buoyId: string; eventId: string }) => {
      const res = await apiRequest("POST", `/api/buoys/${buoyId}/release-event`);
      return { response: await res.json(), eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${data.eventId}/buoys`] });
      toast({ title: "Buoy returned to club" });
    },
    onError: () => {
      toast({ title: "Failed to return buoy to club", variant: "destructive" });
    },
  });

  const handleOpenAssignEventDialog = (buoy: Buoy) => {
    setSelectedBuoyForEvent(buoy);
    setAssignToEventId("");
    setAssignBuoyDialogOpen(true);
  };

  const handleAssignBuoyToEvent = () => {
    if (selectedBuoyForEvent && assignToEventId) {
      assignBuoyToEventMutation.mutate({
        buoyId: selectedBuoyForEvent.id,
        eventId: assignToEventId,
      });
    }
  };

  const getInventoryStatusBadge = (status: BuoyInventoryStatus | string) => {
    const variants: Record<BuoyInventoryStatus, "default" | "secondary" | "outline" | "destructive"> = {
      in_inventory: "secondary",
      assigned_club: "default",
      assigned_event: "outline",
      maintenance: "destructive",
      retired: "destructive",
    };
    const labels: Record<BuoyInventoryStatus, string> = {
      in_inventory: "In Inventory",
      assigned_club: "At Club",
      assigned_event: "At Event",
      maintenance: "Maintenance",
      retired: "Retired",
    };
    const key = status as BuoyInventoryStatus;
    return <Badge variant={variants[key] || "outline"}>{labels[key] || status}</Badge>;
  };

  const getEventName = (eventId: string | null) => {
    if (!eventId) return "-";
    const event = events.find((e) => e.id === eventId);
    return event?.name || "-";
  };

  // Get buoys assigned to a specific event
  const getBuoysForEvent = (eventId: string) => {
    return clubBuoys.filter(
      (b) => b.eventId === eventId && b.inventoryStatus === "assigned_event"
    );
  };

  // Handle direct assign from events table (closes popover on success)
  const handleDirectAssign = (buoyId: string, eventId: string) => {
    assignBuoyToEventMutation.mutate({ buoyId, eventId }, {
      onSuccess: () => {
        setOpenPopoverEventId(null);
      },
    });
  };

  // Handle direct release from events table
  const handleDirectRelease = (buoyId: string, eventId: string) => {
    releaseBuoyFromEventMutation.mutate({ buoyId, eventId });
  };

  const handleCreateEvent = () => {
    if (newEventName.trim() && user?.sailClubId && newEventBoatClassId && newEventStartDate) {
      const selectedBoatClass = boatClasses.find(bc => bc.id === newEventBoatClassId);
      createEventMutation.mutate({
        name: newEventName.trim(),
        type: newEventType,
        boatClass: selectedBoatClass?.name || "Unknown",
        boatClassId: newEventBoatClassId,
        sailClubId: user.sailClubId,
        startDate: newEventStartDate,
        endDate: newEventEndDate || undefined,
      });
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setEditEventName(event.name);
    setEditEventType(event.type as "race" | "training");
    setEditEventBoatClassId(event.boatClassId || "");
    setEditEventStartDate(event.startDate ? new Date(event.startDate).toISOString().split("T")[0] : "");
    setEditEventEndDate(event.endDate ? new Date(event.endDate).toISOString().split("T")[0] : "");
    setEditEventManage2SailUrl(event.manage2SailUrl || "");
    setEditEventRacingRulesUrl(event.racingRulesUrl || "");
    setEditEventDialogOpen(true);
  };

  // Handle opening the manage buoys dialog from events list
  const handleManageBuoys = (event: Event) => {
    setSelectedEventForBuoys(event);
    setManageBuoysDialogOpen(true);
  };

  // Get buoys available for assignment (at club, not at any event)
  const availableBuoys = clubBuoys.filter(
    (b) => b.inventoryStatus === "assigned_club" && !b.eventId
  );

  // Get buoys assigned to the selected event
  const eventBuoys = selectedEventForBuoys
    ? clubBuoys.filter((b) => 
        b.eventId === selectedEventForBuoys.id && 
        b.inventoryStatus === "assigned_event"
      )
    : [];

  // Quick assign from events tab
  const handleQuickAssignBuoy = (buoyId: string) => {
    if (selectedEventForBuoys) {
      assignBuoyToEventMutation.mutate({
        buoyId,
        eventId: selectedEventForBuoys.id,
      });
    }
  };

  // Quick release from events tab (from manage buoys dialog)
  const handleQuickReleaseBuoy = (buoyId: string) => {
    if (selectedEventForBuoys) {
      releaseBuoyFromEventMutation.mutate({ buoyId, eventId: selectedEventForBuoys.id });
    }
  };

  const handleUpdateEvent = () => {
    if (editingEvent && editEventName.trim() && editEventStartDate) {
      const selectedBoatClass = boatClasses.find(bc => bc.id === editEventBoatClassId);
      updateEventMutation.mutate({
        id: editingEvent.id,
        name: editEventName.trim(),
        type: editEventType,
        boatClass: selectedBoatClass?.name || editingEvent.boatClass,
        boatClassId: editEventBoatClassId || null,
        startDate: editEventStartDate,
        endDate: editEventEndDate || undefined,
        manage2SailUrl: editEventManage2SailUrl.trim() || null,
        racingRulesUrl: editEventRacingRulesUrl.trim() || null,
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
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between gap-4">
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
            <TabsTrigger value="buoys" className="gap-2" data-testid="tab-buoys">
              <Anchor className="h-4 w-4" />
              Buoys
            </TabsTrigger>
            <TabsTrigger value="managers" className="gap-2" data-testid="tab-managers">
              <Users className="h-4 w-4" />
              Event Managers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Events</CardTitle>
                    <CardDescription>Races and training sessions</CardDescription>
                  </div>
                  <Button onClick={() => setEventDialogOpen(true)} data-testid="button-add-event">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-32" data-testid="select-event-type-filter">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="race">Race</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={eventHidePast ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEventHidePast(!eventHidePast)}
                    data-testid="button-toggle-hide-past"
                  >
                    {eventHidePast ? "Showing Upcoming" : "Showing All"}
                  </Button>
                </div>
              </CardHeader>
              <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
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
                              [...boatClasses].sort((a, b) => a.name.localeCompare(b.name)).map((bc) => (
                                <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="event-start-date">Start Date</Label>
                          <Input
                            id="event-start-date"
                            type="date"
                            value={newEventStartDate}
                            onChange={(e) => setNewEventStartDate(e.target.value)}
                            data-testid="input-event-start-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="event-end-date">End Date (optional)</Label>
                          <Input
                            id="event-end-date"
                            type="date"
                            value={newEventEndDate}
                            onChange={(e) => setNewEventEndDate(e.target.value)}
                            min={newEventStartDate}
                            data-testid="input-event-end-date"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateEvent}
                        disabled={createEventMutation.isPending || !newEventName.trim() || !newEventBoatClassId || !newEventStartDate}
                        className="w-full"
                        data-testid="button-create-event"
                      >
                        {createEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Boat Class</TableHead>
                        <TableHead>Buoys</TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubEvents.map((event) => {
                        const eventBuoysForRow = getBuoysForEvent(event.id);
                        return (
                          <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                            <TableCell className="font-medium">{event.name}</TableCell>
                            <TableCell className="text-sm">
                              {event.startDate ? (
                                <span>
                                  {new Date(event.startDate).toLocaleDateString()}
                                  {event.endDate && event.endDate !== event.startDate && (
                                    <> - {new Date(event.endDate).toLocaleDateString()}</>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={event.type === "race" ? "default" : "secondary"}>
                                {event.type === "race" ? "Race" : "Training"}
                              </Badge>
                            </TableCell>
                            <TableCell>{event.boatClass}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {eventBuoysForRow.map((buoy) => (
                                  <Badge 
                                    key={buoy.id} 
                                    variant="outline" 
                                    className="flex items-center gap-1"
                                  >
                                    <span>{buoy.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDirectRelease(buoy.id, event.id)}
                                      disabled={releaseBuoyFromEventMutation.isPending || assignBuoyToEventMutation.isPending}
                                      title="Return to Club"
                                      data-testid={`button-release-${buoy.id}`}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  </Badge>
                                ))}
                                {availableBuoys.length > 0 && (
                                  <Popover 
                                    open={openPopoverEventId === event.id} 
                                    onOpenChange={(open) => setOpenPopoverEventId(open ? event.id : null)}
                                  >
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={assignBuoyToEventMutation.isPending || releaseBuoyFromEventMutation.isPending}
                                        data-testid={`button-add-buoy-${event.id}`}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-2" align="start">
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium mb-2">Assign Buoy</p>
                                        {availableBuoys.map((buoy) => (
                                          <Button
                                            key={buoy.id}
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => handleDirectAssign(buoy.id, event.id)}
                                            disabled={assignBuoyToEventMutation.isPending || releaseBuoyFromEventMutation.isPending}
                                            data-testid={`button-assign-${buoy.id}-to-${event.id}`}
                                          >
                                            {buoy.name}
                                          </Button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                                {eventBuoysForRow.length === 0 && availableBuoys.length === 0 && (
                                  <span className="text-muted-foreground text-sm">No buoys</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEvent(event.id)}
                                title="Open Event"
                                data-testid={`button-open-event-${event.id}`}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleManageBuoys(event)}
                                title="Manage Buoys"
                                data-testid={`button-manage-buoys-${event.id}`}
                              >
                                <Anchor className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedEventForExternalInfo(event);
                                  setExternalInfoDialogOpen(true);
                                }}
                                title="External Info"
                                data-testid={`button-external-info-${event.id}`}
                              >
                                <Globe className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditEvent(event)}
                                title="Edit Event"
                                data-testid={`button-edit-event-${event.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteEventMutation.mutate(event.id)}
                                disabled={deleteEventMutation.isPending}
                                title="Delete Event"
                                data-testid={`button-delete-event-${event.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buoys">
            <Card>
              <CardHeader>
                <CardTitle>Club Buoys</CardTitle>
                <CardDescription>Buoys assigned to your club - assign them to events as needed</CardDescription>
              </CardHeader>
              <CardContent>
                {buoysLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : clubBuoys.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No buoys assigned to this club yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubBuoys.map((buoy) => (
                        <TableRow key={buoy.id} data-testid={`row-buoy-${buoy.id}`}>
                          <TableCell className="font-medium">{buoy.name}</TableCell>
                          <TableCell className="text-muted-foreground">{buoy.serialNumber || "-"}</TableCell>
                          <TableCell>{getInventoryStatusBadge(buoy.inventoryStatus)}</TableCell>
                          <TableCell>{getEventName(buoy.eventId)}</TableCell>
                          <TableCell className="flex gap-1">
                            {buoy.inventoryStatus === "assigned_club" && !buoy.eventId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenAssignEventDialog(buoy)}
                                title="Assign to Event"
                                data-testid={`button-assign-event-${buoy.id}`}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            )}
                            {buoy.inventoryStatus === "assigned_event" && buoy.eventId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => buoy.eventId && releaseBuoyFromEventMutation.mutate({ buoyId: buoy.id, eventId: buoy.eventId })}
                                disabled={releaseBuoyFromEventMutation.isPending}
                                title="Return to Club"
                                data-testid={`button-release-event-${buoy.id}`}
                              >
                                <RotateCcw className="h-4 w-4" />
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
                      Add Manager
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Event Manager</DialogTitle>
                      <DialogDescription>Add a new event manager for this club</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Enter username"
                          data-testid="input-username"
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
                          data-testid="input-password"
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
                      {eventManagers.map((manager) => (
                        <TableRow key={manager.id} data-testid={`row-manager-${manager.id}`}>
                          <TableCell className="font-medium">{manager.username}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedUserId(manager.id);
                                setAccessDialogOpen(true);
                              }}
                              data-testid={`button-grant-access-${manager.id}`}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteUserMutation.mutate(manager.id)}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-manager-${manager.id}`}
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

      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Event Access</DialogTitle>
            <DialogDescription>Select an event to grant access to this manager</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                {event.name}
              </Button>
            ))}
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
                    [...boatClasses].sort((a, b) => a.name.localeCompare(b.name)).map((bc) => (
                      <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-event-start-date">Start Date *</Label>
                <Input
                  id="edit-event-start-date"
                  type="date"
                  value={editEventStartDate}
                  onChange={(e) => setEditEventStartDate(e.target.value)}
                  data-testid="input-edit-event-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-event-end-date">End Date</Label>
                <Input
                  id="edit-event-end-date"
                  type="date"
                  value={editEventEndDate}
                  onChange={(e) => setEditEventEndDate(e.target.value)}
                  data-testid="input-edit-event-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manage2sail-url">Manage2Sail URL</Label>
              <Input
                id="edit-manage2sail-url"
                type="url"
                value={editEventManage2SailUrl}
                onChange={(e) => setEditEventManage2SailUrl(e.target.value)}
                placeholder="https://www.manage2sail.com/en-US/event/..."
                data-testid="input-edit-manage2sail-url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-racingrules-url">Racing Rules URL</Label>
              <Input
                id="edit-racingrules-url"
                type="url"
                value={editEventRacingRulesUrl}
                onChange={(e) => setEditEventRacingRulesUrl(e.target.value)}
                placeholder="https://www.racingrulesofsailing.org/events/..."
                data-testid="input-edit-racingrules-url"
              />
            </div>
            <Button
              onClick={handleUpdateEvent}
              disabled={updateEventMutation.isPending || !editEventName.trim() || !editEventStartDate}
              className="w-full"
              data-testid="button-update-event"
            >
              {updateEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignBuoyDialogOpen} onOpenChange={setAssignBuoyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Buoy to Event</DialogTitle>
            <DialogDescription>
              Assign {selectedBuoyForEvent?.name} to an event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-event">Select Event</Label>
              <Select value={assignToEventId} onValueChange={setAssignToEventId}>
                <SelectTrigger data-testid="select-assign-event">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {clubEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAssignBuoyToEvent}
              disabled={assignBuoyToEventMutation.isPending || !assignToEventId}
              className="w-full"
              data-testid="button-confirm-assign-event"
            >
              {assignBuoyToEventMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign to Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageBuoysDialogOpen} onOpenChange={setManageBuoysDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Buoys - {selectedEventForBuoys?.name}</DialogTitle>
            <DialogDescription>
              Assign or retrieve buoys for this event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {eventBuoys.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assigned to Event ({eventBuoys.length})</Label>
                <div className="border rounded-md divide-y">
                  {eventBuoys.map((buoy) => (
                    <div key={buoy.id} className="flex items-center justify-between p-3">
                      <div>
                        <span className="font-medium">{buoy.name}</span>
                        {buoy.serialNumber && (
                          <span className="text-sm text-muted-foreground ml-2">({buoy.serialNumber})</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickReleaseBuoy(buoy.id)}
                        disabled={releaseBuoyFromEventMutation.isPending}
                        data-testid={`button-retrieve-buoy-${buoy.id}`}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Return to Club
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {availableBuoys.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Available Buoys ({availableBuoys.length})</Label>
                <div className="border rounded-md divide-y">
                  {availableBuoys.map((buoy) => (
                    <div key={buoy.id} className="flex items-center justify-between p-3">
                      <div>
                        <span className="font-medium">{buoy.name}</span>
                        {buoy.serialNumber && (
                          <span className="text-sm text-muted-foreground ml-2">({buoy.serialNumber})</span>
                        )}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleQuickAssignBuoy(buoy.id)}
                        disabled={assignBuoyToEventMutation.isPending}
                        data-testid={`button-assign-buoy-${buoy.id}`}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No buoys available. All club buoys are assigned to events.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={externalInfoDialogOpen} onOpenChange={setExternalInfoDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] overflow-hidden flex flex-col p-6">
          {selectedEventForExternalInfo && (
            <EventExternalInfo
              eventId={selectedEventForExternalInfo.id}
              eventName={selectedEventForExternalInfo.name}
              onClose={() => setExternalInfoDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
