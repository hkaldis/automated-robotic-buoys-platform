import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, Users, Compass, Waves, Sailboat } from "lucide-react";
import alconmarksLogoWhite from "@assets/ALCON_MARKS_LOGO_WHITE_BACKGROUND_1768786798926.jpeg";

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
    <div className="min-h-screen flex flex-col bg-slate-900 dark:bg-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-40 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-primary/5 rounded-full blur-2xl" />
      </div>
      
      <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-4">
        <img 
          src={alconmarksLogoWhite} 
          alt="Alconmarks" 
          className="h-10 md:h-12 rounded-md"
        />
        <Button 
          variant="outline" 
          onClick={() => setLocation("/login")}
          className="border-slate-600 dark:border-slate-600 text-slate-100 dark:text-slate-100 bg-slate-800/50 dark:bg-slate-800/50 backdrop-blur-sm"
          data-testid="button-login-header"
        >
          Sign In
        </Button>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12 max-w-3xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-primary/20 rounded-md border border-primary/30">
              <Sailboat className="h-8 w-8 text-primary" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-100 dark:text-slate-100 mb-4">
            Automated Robotic
            <span className="block text-primary">Race Buoys</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-300 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            Revolutionize your sailing races with intelligent, GPS-controlled marker buoys. 
            Create, modify, and manage race courses in real-time.
          </p>
          
          <Button
            size="lg"
            onClick={() => setLocation("/login")}
            data-testid="button-enter-control-center"
          >
            Enter Control Center
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-12">
          <div className="bg-slate-800/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-700 dark:border-slate-700 rounded-md p-6 text-center hover-elevate">
            <div className="p-3 bg-primary/20 rounded-md w-fit mx-auto mb-4 border border-primary/30">
              <Navigation className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-100 dark:text-slate-100 mb-2">Course Management</h3>
            <p className="text-sm text-slate-400 dark:text-slate-400">
              Create triangle, trapezoid, or custom courses with real-time positioning
            </p>
          </div>
          
          <div className="bg-slate-800/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-700 dark:border-slate-700 rounded-md p-6 text-center hover-elevate">
            <div className="p-3 bg-primary/20 rounded-md w-fit mx-auto mb-4 border border-primary/30">
              <Compass className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-100 dark:text-slate-100 mb-2">Wind Integration</h3>
            <p className="text-sm text-slate-400 dark:text-slate-400">
              Automatic course alignment based on live wind data from buoy sensors
            </p>
          </div>
          
          <div className="bg-slate-800/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-700 dark:border-slate-700 rounded-md p-6 text-center hover-elevate">
            <div className="p-3 bg-primary/20 rounded-md w-fit mx-auto mb-4 border border-primary/30">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-slate-100 dark:text-slate-100 mb-2">Role-Based Access</h3>
            <p className="text-sm text-slate-400 dark:text-slate-400">
              Club managers, event managers, and race officers with tailored permissions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
          <div>
            <div className="text-3xl font-bold text-slate-100 dark:text-slate-100">50+</div>
            <div className="text-sm text-slate-400 dark:text-slate-400">Racing Events</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-100 dark:text-slate-100">15</div>
            <div className="text-sm text-slate-400 dark:text-slate-400">Sailing Clubs</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-100 dark:text-slate-100">100+</div>
            <div className="text-sm text-slate-400 dark:text-slate-400">Active Buoys</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-slate-100 dark:text-slate-100">24/7</div>
            <div className="text-sm text-slate-400 dark:text-slate-400">Real-time Tracking</div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-slate-700 dark:border-slate-700 px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400">
            <Waves className="h-4 w-4" />
            <span className="text-sm">PWA enabled - Add to Home Screen for best tablet experience</span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-500">
            &copy; 2025 Alconmarks. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
