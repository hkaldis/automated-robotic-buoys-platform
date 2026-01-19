import { useState } from "react";
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
import { Building2, Users, Plus, Trash2, LogOut, Loader2, Anchor } from "lucide-react";
import type { SailClub, UserRole } from "@shared/schema";

interface SafeUser {
  id: string;
  username: string;
  role: UserRole;
  sailClubId: string | null;
  createdAt: string | null;
}

export default function AdminDashboard() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"club_manager" | "event_manager">("club_manager");
  const [newUserClubId, setNewUserClubId] = useState("");

  const { data: clubs = [], isLoading: clubsLoading } = useQuery<SailClub[]>({
    queryKey: ["/api/sail-clubs"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
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

  const handleCreateClub = () => {
    if (newClubName.trim()) {
      createClubMutation.mutate(newClubName.trim());
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
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Anchor className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-semibold">RoBuoys Admin</h1>
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
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clubs.map((club) => (
                        <TableRow key={club.id} data-testid={`row-club-${club.id}`}>
                          <TableCell className="font-medium">{club.name}</TableCell>
                          <TableCell>
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
    </div>
  );
}
