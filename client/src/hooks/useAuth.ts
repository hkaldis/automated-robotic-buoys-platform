import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import type { User, UserRole } from "@shared/schema";

interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  sailClubId: string | null;
  createdAt: Date | null;
  createdBy: string | null;
}

interface AuthResponse {
  user: AuthUser;
  eventAccess?: string[];
}

interface LoginCredentials {
  username: string;
  password: string;
}

export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<AuthResponse | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return res.json() as Promise<{ user: AuthUser }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries();
    },
  });

  return {
    user: data?.user ?? null,
    eventAccess: data?.eventAccess ?? [],
    isLoading,
    isAuthenticated: !!data?.user,
    error,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    refetch,
  };
}
