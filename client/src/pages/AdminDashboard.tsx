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
import { Building2, Users, Plus, Trash2, LogOut, Loader2, Calendar, Play, Pencil, Anchor, ArrowRight, RotateCcw, Eye, X } from "lucide-react";
import type { SailClub, UserRole, Event, Buoy, BuoyAssignment } from "@shared/schema";
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
  const [newBuoySerialNumber, setNewBuoySerialNumber] = useState("");
  const [newBuoyOwnership, setNewBuoyOwnership] = useState<"platform_owned" | "long_rental" | "event_rental">("platform_owned");
  const [newBuoyWeatherSensor, setNewBuoyWeatherSensor] = useState("");
  const [newBuoyMotor, setNewBuoyMotor] = useState("");
  const [newBuoyCamera, setNewBuoyCamera] = useState("");
  const [newBuoyBatteryInfo, setNewBuoyBatteryInfo] = useState("");
  const [newBuoyOtherEquipment, setNewBuoyOtherEquipment] = useState("");
  const [selectedBuoyForAssign, setSelectedBuoyForAssign] = useState<Buoy | null>(null);
  const [assignToClubId, setAssignToClubId] = useState("");
  const [editBuoyDialogOpen, setEditBuoyDialogOpen] = useState(false);
  const [viewBuoyDialogOpen, setViewBuoyDialogOpen] = useState(false);
  const [editingBuoy, setEditingBuoy] = useState<Buoy | null>(null);
  const [editBuoyName, setEditBuoyName] = useState("");
  const [editBuoySerialNumber, setEditBuoySerialNumber] = useState("");
  const [editBuoyOwnership, setEditBuoyOwnership] = useState<"platform_owned" | "long_rental" | "event_rental">("platform_owned");
  const [editBuoyWeatherSensor, setEditBuoyWeatherSensor] = useState("");
  const [editBuoyMotor, setEditBuoyMotor] = useState("");
  const [editBuoyCamera, setEditBuoyCamera] = useState("");
  const [editBuoyBatteryInfo, setEditBuoyBatteryInfo] = useState("");
  const [editBuoyOtherEquipment, setEditBuoyOtherEquipment] = useState("");
  const [editBuoyStatus, setEditBuoyStatus] = useState<"in_inventory" | "assigned_club" | "assigned_event" | "maintenance" | "retired">("in_inventory");
  const [assignEventDialogOpen, setAssignEventDialogOpen] = useState(false);
  const [assignToEventId, setAssignToEventId] = useState("");
  const [buoyClubFilter, setBuoyClubFilter] = useState<string>("all");
  const [manageBuoysDialogOpen, setManageBuoysDialogOpen] = useState(false);
  const [selectedEventForBuoys, setSelectedEventForBuoys] = useState<Event | null>(null);
  
  // State for inline buoy assignment popover in events table
  const [openPopoverEventId, setOpenPopoverEventId] = useState<string | null>(null);

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

  const { data: buoyAssignments = [], isLoading: assignmentsLoading } = useQuery<BuoyAssignment[]>({
    queryKey: [`/api/buoys/${editingBuoy?.id}/assignments`],
    enabled: !!editingBuoy && viewBuoyDialogOpen,
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
    mutationFn: async (data: { 
      name: string; 
      serialNumber?: string;
      ownershipType: string;
      weatherSensorModel?: string;
      motorModel?: string;
      cameraModel?: string;
      batteryInfo?: string;
      otherEquipment?: string;
    }) => {
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
      setNewBuoySerialNumber("");
      setNewBuoyOwnership("platform_owned");
      setNewBuoyWeatherSensor("");
      setNewBuoyMotor("");
      setNewBuoyCamera("");
      setNewBuoyBatteryInfo("");
      setNewBuoyOtherEquipment("");
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
      toast({ title: "Failed to assign buoy to club", variant: "destructive" });
    },
  });

  const assignBuoyToEventMutation = useMutation({
    mutationFn: async ({ buoyId, eventId }: { buoyId: string; eventId: string }) => {
      const res = await apiRequest("POST", `/api/buoys/${buoyId}/assign-event`, { eventId });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${variables.eventId}/buoys`] });
      setAssignEventDialogOpen(false);
      setSelectedBuoyForAssign(null);
      setAssignToEventId("");
      toast({ title: "Buoy assigned to event" });
    },
    onError: () => {
      toast({ title: "Failed to assign buoy", variant: "destructive" });
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
      toast({ title: "Failed to release buoy", variant: "destructive" });
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

  const updateBuoyMutation = useMutation({
    mutationFn: async ({ id, ...data }: { 
      id: string;
      name?: string;
      serialNumber?: string;
      ownershipType?: string;
      inventoryStatus?: string;
      weatherSensorModel?: string;
      motorModel?: string;
      cameraModel?: string;
      batteryInfo?: string;
      otherEquipment?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/buoys/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buoys"] });
      setEditBuoyDialogOpen(false);
      setEditingBuoy(null);
      toast({ title: "Buoy updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update buoy", variant: "destructive" });
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

  // Get buoys assigned to a specific event
  const getBuoysForEvent = (eventId: string) => {
    return buoys.filter(
      (b) => b.eventId === eventId && b.inventoryStatus === "assigned_event"
    );
  };

  // Get buoys available for assignment to an event (assigned to the event's club but not to any event)
  const getAvailableBuoysForEvent = (event: Event) => {
    return buoys.filter(
      (b) => b.sailClubId === event.sailClubId && b.inventoryStatus === "assigned_club"
    );
  };

  // Buoys for the edit event dialog
  const editEventBuoys = editingEvent
    ? buoys.filter((b) => b.eventId === editingEvent.id && b.inventoryStatus === "assigned_event")
    : [];
  const editEventAvailableBuoys = editingEvent
    ? buoys.filter((b) => b.sailClubId === editingEvent.sailClubId && b.inventoryStatus === "assigned_club")
    : [];

  // Handle direct assign from events table (closes popover on success)
  const handleDirectAssignToEvent = (buoyId: string, eventId: string) => {
    assignBuoyToEventMutation.mutate({ buoyId, eventId }, {
      onSuccess: () => {
        setOpenPopoverEventId(null);
      },
    });
  };

  // Handle direct release from events table
  const handleDirectReleaseFromEvent = (buoyId: string, eventId: string) => {
    releaseBuoyFromEventMutation.mutate({ buoyId, eventId });
  };

  const handleCreateBuoy = () => {
    if (newBuoyName.trim()) {
      createBuoyMutation.mutate({
        name: newBuoyName.trim(),
        serialNumber: newBuoySerialNumber.trim() || undefined,
        ownershipType: newBuoyOwnership,
        weatherSensorModel: newBuoyWeatherSensor.trim() || undefined,
        motorModel: newBuoyMotor.trim() || undefined,
        cameraModel: newBuoyCamera.trim() || undefined,
        batteryInfo: newBuoyBatteryInfo.trim() || undefined,
        otherEquipment: newBuoyOtherEquipment.trim() || undefined,
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

  const handleOpenAssignEventDialog = (buoy: Buoy) => {
    setSelectedBuoyForAssign(buoy);
    setAssignToEventId("");
    setAssignEventDialogOpen(true);
  };

  const handleAssignBuoyToEvent = () => {
    if (selectedBuoyForAssign && assignToEventId) {
      assignBuoyToEventMutation.mutate({
        buoyId: selectedBuoyForAssign.id,
        eventId: assignToEventId,
      });
    }
  };

  const handleEditBuoy = (buoy: Buoy) => {
    setEditingBuoy(buoy);
    setEditBuoyName(buoy.name);
    setEditBuoySerialNumber(buoy.serialNumber || "");
    setEditBuoyOwnership(buoy.ownershipType as "platform_owned" | "long_rental" | "event_rental");
    setEditBuoyWeatherSensor(buoy.weatherSensorModel || "");
    setEditBuoyMotor(buoy.motorModel || "");
    setEditBuoyCamera(buoy.cameraModel || "");
    setEditBuoyBatteryInfo(buoy.batteryInfo || "");
    setEditBuoyOtherEquipment(buoy.otherEquipment || "");
    setEditBuoyStatus(buoy.inventoryStatus as "in_inventory" | "assigned_club" | "assigned_event" | "maintenance" | "retired");
    setEditBuoyDialogOpen(true);
  };

  const handleUpdateBuoy = () => {
    if (editingBuoy && editBuoyName.trim()) {
      updateBuoyMutation.mutate({
        id: editingBuoy.id,
        name: editBuoyName.trim(),
        serialNumber: editBuoySerialNumber.trim() || undefined,
        ownershipType: editBuoyOwnership,
        inventoryStatus: editBuoyStatus,
        weatherSensorModel: editBuoyWeatherSensor.trim() || undefined,
        motorModel: editBuoyMotor.trim() || undefined,
        cameraModel: editBuoyCamera.trim() || undefined,
        batteryInfo: editBuoyBatteryInfo.trim() || undefined,
        otherEquipment: editBuoyOtherEquipment.trim() || undefined,
      });
    }
  };

  const handleViewBuoy = (buoy: Buoy) => {
    setEditingBuoy(buoy);
    setViewBuoyDialogOpen(true);
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

  const filteredBuoys = buoys.filter((buoy) => {
    if (buoyClubFilter === "all") return true;
    if (buoyClubFilter === "unassigned") return !buoy.sailClubId;
    return buoy.sailClubId === buoyClubFilter;
  });

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
                        <TableHead>Buoys</TableHead>
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
                          <TableCell>
                            {(() => {
                              const eventBuoys = getBuoysForEvent(event.id);
                              const count = eventBuoys.length;
                              return (
                                <div className="flex items-center gap-2">
                                  <Badge variant={count > 0 ? "default" : "secondary"}>
                                    {count} {count === 1 ? "buoy" : "buoys"}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedEventForBuoys(event);
                                      setManageBuoysDialogOpen(true);
                                    }}
                                    title="Manage Buoys"
                                    data-testid={`button-manage-buoys-${event.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                              );
                            })()}
                          </TableCell>
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
                      <div className="grid grid-cols-2 gap-4">
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
                        <div className="space-y-2">
                          <Label htmlFor="buoy-serial">Serial Number</Label>
                          <Input
                            id="buoy-serial"
                            value={newBuoySerialNumber}
                            onChange={(e) => setNewBuoySerialNumber(e.target.value)}
                            placeholder="e.g., SN-2024-001"
                            data-testid="input-buoy-serial"
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
                      <div className="space-y-2">
                        <Label htmlFor="buoy-weather-sensor">Weather Sensor Model</Label>
                        <Input
                          id="buoy-weather-sensor"
                          value={newBuoyWeatherSensor}
                          onChange={(e) => setNewBuoyWeatherSensor(e.target.value)}
                          placeholder="e.g., Ultrasonic WS-100"
                          data-testid="input-buoy-weather-sensor"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buoy-motor">Motor Model</Label>
                        <Input
                          id="buoy-motor"
                          value={newBuoyMotor}
                          onChange={(e) => setNewBuoyMotor(e.target.value)}
                          placeholder="e.g., Torqeedo Travel 1103"
                          data-testid="input-buoy-motor"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buoy-camera">Camera Model</Label>
                        <Input
                          id="buoy-camera"
                          value={newBuoyCamera}
                          onChange={(e) => setNewBuoyCamera(e.target.value)}
                          placeholder="e.g., HD Webcam 720p"
                          data-testid="input-buoy-camera"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buoy-battery">Battery Info</Label>
                        <Input
                          id="buoy-battery"
                          value={newBuoyBatteryInfo}
                          onChange={(e) => setNewBuoyBatteryInfo(e.target.value)}
                          placeholder="e.g., 12V 100Ah LiFePO4"
                          data-testid="input-buoy-battery"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buoy-other">Other Equipment</Label>
                        <Input
                          id="buoy-other"
                          value={newBuoyOtherEquipment}
                          onChange={(e) => setNewBuoyOtherEquipment(e.target.value)}
                          placeholder="e.g., GPS, Solar panel 50W"
                          data-testid="input-buoy-other"
                        />
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
                <div className="flex items-center gap-4 mb-4">
                  <Label className="text-sm text-muted-foreground">Filter by Club:</Label>
                  <Select value={buoyClubFilter} onValueChange={setBuoyClubFilter}>
                    <SelectTrigger className="w-48" data-testid="select-buoy-club-filter">
                      <SelectValue placeholder="All Clubs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clubs</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {clubs.map((club) => (
                        <SelectItem key={club.id} value={club.id}>
                          {club.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {buoysLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredBuoys.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {buoys.length === 0 ? "No buoys in inventory. Add your first buoy." : "No buoys match the selected filter."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Ownership</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Club</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="w-36">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBuoys.map((buoy) => (
                        <TableRow key={buoy.id} data-testid={`row-buoy-${buoy.id}`}>
                          <TableCell className="font-medium">{buoy.name}</TableCell>
                          <TableCell className="text-muted-foreground">{buoy.serialNumber || "-"}</TableCell>
                          <TableCell>{getOwnershipBadge(buoy.ownershipType)}</TableCell>
                          <TableCell>{getInventoryStatusBadge(buoy.inventoryStatus)}</TableCell>
                          <TableCell>{getClubName(buoy.sailClubId)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-40 truncate">
                            {[buoy.weatherSensorModel, buoy.motorModel, buoy.cameraModel].filter(Boolean).join(", ") || "-"}
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewBuoy(buoy)}
                              title="View Details"
                              data-testid={`button-view-buoy-${buoy.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditBuoy(buoy)}
                              title="Edit Buoy"
                              data-testid={`button-edit-buoy-${buoy.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
                            {buoy.inventoryStatus === "assigned_club" && !buoy.eventId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenAssignEventDialog(buoy)}
                                title="Assign to Event"
                                data-testid={`button-assign-event-buoy-${buoy.id}`}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            )}
                            {buoy.inventoryStatus === "assigned_event" && buoy.eventId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => releaseBuoyFromEventMutation.mutate({ buoyId: buoy.id, eventId: buoy.eventId! })}
                                disabled={releaseBuoyFromEventMutation.isPending}
                                title="Return to Club"
                                data-testid={`button-release-event-${buoy.id}`}
                              >
                                <RotateCcw className="h-4 w-4 text-orange-500" />
                              </Button>
                            )}
                            {buoy.inventoryStatus === "assigned_club" && (
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

      <Dialog open={assignEventDialogOpen} onOpenChange={setAssignEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Buoy to Event</DialogTitle>
            <DialogDescription>
              Assign {selectedBuoyForAssign?.name} to an event
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
                  {events
                    .filter((e) => e.sailClubId === selectedBuoyForAssign?.sailClubId)
                    .map((event) => (
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

            {/* Buoy Management Section */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium">Buoys</Label>
              
              {/* Assigned Buoys */}
              {editEventBuoys.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Assigned ({editEventBuoys.length})</span>
                  <div className="border rounded-md divide-y">
                    {editEventBuoys.map((buoy) => (
                      <div key={buoy.id} className="flex items-center justify-between p-2">
                        <span className="text-sm">{buoy.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editingEvent && handleDirectReleaseFromEvent(buoy.id, editingEvent.id)}
                          disabled={releaseBuoyFromEventMutation.isPending || assignBuoyToEventMutation.isPending}
                          data-testid={`button-release-edit-buoy-${buoy.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Return to Club
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Available Buoys */}
              {editEventAvailableBuoys.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Available ({editEventAvailableBuoys.length})</span>
                  <div className="border rounded-md divide-y">
                    {editEventAvailableBuoys.map((buoy) => (
                      <div key={buoy.id} className="flex items-center justify-between p-2">
                        <span className="text-sm">{buoy.name}</span>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => editingEvent && handleDirectAssignToEvent(buoy.id, editingEvent.id)}
                          disabled={assignBuoyToEventMutation.isPending || releaseBuoyFromEventMutation.isPending}
                          data-testid={`button-assign-edit-buoy-${buoy.id}`}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : editEventBuoys.length === 0 ? (
                <p className="text-xs text-muted-foreground">No buoys assigned to this club.</p>
              ) : null}
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

      <Dialog open={editBuoyDialogOpen} onOpenChange={setEditBuoyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Buoy</DialogTitle>
            <DialogDescription>Update buoy details and hardware configuration</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-name">Buoy Name *</Label>
              <Input
                id="edit-buoy-name"
                value={editBuoyName}
                onChange={(e) => setEditBuoyName(e.target.value)}
                placeholder="e.g., Buoy Alpha"
                data-testid="input-edit-buoy-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-serial">Serial Number</Label>
              <Input
                id="edit-buoy-serial"
                value={editBuoySerialNumber}
                onChange={(e) => setEditBuoySerialNumber(e.target.value)}
                placeholder="e.g., SN-2024-001"
                data-testid="input-edit-buoy-serial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-ownership">Ownership Type</Label>
              <Select value={editBuoyOwnership} onValueChange={(val) => setEditBuoyOwnership(val as typeof editBuoyOwnership)}>
                <SelectTrigger id="edit-buoy-ownership" data-testid="select-edit-buoy-ownership">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform_owned">Platform Owned</SelectItem>
                  <SelectItem value="long_rental">Long-term Rental</SelectItem>
                  <SelectItem value="event_rental">Event Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-status">Status</Label>
              <Select value={editBuoyStatus} onValueChange={(val) => setEditBuoyStatus(val as typeof editBuoyStatus)}>
                <SelectTrigger id="edit-buoy-status" data-testid="select-edit-buoy-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_inventory">In Inventory</SelectItem>
                  <SelectItem value="assigned_club">Assigned to Club</SelectItem>
                  <SelectItem value="assigned_event">Assigned to Event</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-weather-sensor">Weather Sensor Model</Label>
              <Input
                id="edit-buoy-weather-sensor"
                value={editBuoyWeatherSensor}
                onChange={(e) => setEditBuoyWeatherSensor(e.target.value)}
                placeholder="e.g., Calypso Ultrasonic"
                data-testid="input-edit-buoy-weather-sensor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-motor">Motor Model</Label>
              <Input
                id="edit-buoy-motor"
                value={editBuoyMotor}
                onChange={(e) => setEditBuoyMotor(e.target.value)}
                placeholder="e.g., Torqeedo Travel 1103"
                data-testid="input-edit-buoy-motor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-camera">Camera Model</Label>
              <Input
                id="edit-buoy-camera"
                value={editBuoyCamera}
                onChange={(e) => setEditBuoyCamera(e.target.value)}
                placeholder="e.g., GoPro Hero 12"
                data-testid="input-edit-buoy-camera"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-battery">Battery Info</Label>
              <Input
                id="edit-buoy-battery"
                value={editBuoyBatteryInfo}
                onChange={(e) => setEditBuoyBatteryInfo(e.target.value)}
                placeholder="e.g., LiFePO4 100Ah"
                data-testid="input-edit-buoy-battery"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-buoy-other">Other Equipment</Label>
              <Input
                id="edit-buoy-other"
                value={editBuoyOtherEquipment}
                onChange={(e) => setEditBuoyOtherEquipment(e.target.value)}
                placeholder="e.g., Solar panel, LED lights"
                data-testid="input-edit-buoy-other"
              />
            </div>
          </div>
          <Button
            onClick={handleUpdateBuoy}
            disabled={updateBuoyMutation.isPending || !editBuoyName.trim()}
            className="w-full mt-4"
            data-testid="button-update-buoy"
          >
            {updateBuoyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Buoy"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={viewBuoyDialogOpen} onOpenChange={setViewBuoyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buoy Details</DialogTitle>
            <DialogDescription>{editingBuoy?.name}</DialogDescription>
          </DialogHeader>
          {editingBuoy && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Serial Number</Label>
                  <p className="font-medium">{editingBuoy.serialNumber || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Ownership</Label>
                  <div className="mt-1">{getOwnershipBadge(editingBuoy.ownershipType)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getInventoryStatusBadge(editingBuoy.inventoryStatus)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Club</Label>
                  <p className="font-medium">{getClubName(editingBuoy.sailClubId)}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs">Hardware Configuration</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Weather Sensor:</span>
                    <span>{editingBuoy.weatherSensorModel || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Motor:</span>
                    <span>{editingBuoy.motorModel || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Camera:</span>
                    <span>{editingBuoy.cameraModel || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Battery:</span>
                    <span>{editingBuoy.batteryInfo || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other:</span>
                    <span>{editingBuoy.otherEquipment || "-"}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs">Assignment History</Label>
                {assignmentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : buoyAssignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">No assignment history</p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {buoyAssignments.map((assignment) => (
                      <div key={assignment.id} className="text-xs border rounded p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {assignment.assignmentType === "club" ? "Club" : "Event"}
                          </span>
                          <Badge variant={assignment.status === "active" ? "default" : "secondary"} className="text-xs">
                            {assignment.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {assignment.startAt ? new Date(assignment.startAt).toLocaleDateString() : "N/A"}
                          {assignment.endAt && ` - ${new Date(assignment.endAt).toLocaleDateString()}`}
                        </div>
                        {assignment.notes && (
                          <div className="text-muted-foreground mt-1 italic">{assignment.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={() => {
                  setViewBuoyDialogOpen(false);
                  handleEditBuoy(editingBuoy);
                }}
                variant="outline"
                className="w-full"
                data-testid="button-view-to-edit-buoy"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Buoy
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manageBuoysDialogOpen} onOpenChange={setManageBuoysDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Buoys</DialogTitle>
            <DialogDescription>
              {selectedEventForBuoys ? `Assign and release buoys for "${selectedEventForBuoys.name}"` : "Manage event buoys"}
            </DialogDescription>
          </DialogHeader>
          {selectedEventForBuoys && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Assigned Buoys</Label>
                {(() => {
                  const eventBuoys = getBuoysForEvent(selectedEventForBuoys.id);
                  if (eventBuoys.length === 0) {
                    return <p className="text-muted-foreground text-sm">No buoys assigned to this event</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {eventBuoys.map((buoy) => (
                        <div key={buoy.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center gap-2">
                            <Anchor className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{buoy.name}</span>
                            {buoy.serialNumber && (
                              <span className="text-xs text-muted-foreground">({buoy.serialNumber})</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDirectReleaseFromEvent(buoy.id, selectedEventForBuoys.id)}
                            disabled={releaseBuoyFromEventMutation.isPending || assignBuoyToEventMutation.isPending}
                            data-testid={`button-release-buoy-${buoy.id}`}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Release
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs mb-2 block">Available Buoys</Label>
                {(() => {
                  const availableBuoys = getAvailableBuoysForEvent(selectedEventForBuoys);
                  if (availableBuoys.length === 0) {
                    return <p className="text-muted-foreground text-sm">No buoys available from this club</p>;
                  }
                  return (
                    <div className="space-y-2">
                      {availableBuoys.map((buoy) => (
                        <div key={buoy.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div className="flex items-center gap-2">
                            <Anchor className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{buoy.name}</span>
                            {buoy.serialNumber && (
                              <span className="text-xs text-muted-foreground">({buoy.serialNumber})</span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDirectAssignToEvent(buoy.id, selectedEventForBuoys.id)}
                            disabled={assignBuoyToEventMutation.isPending || releaseBuoyFromEventMutation.isPending}
                            data-testid={`button-assign-buoy-${buoy.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
