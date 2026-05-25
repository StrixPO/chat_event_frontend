import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <Link to="/" className="text-base font-semibold tracking-tight">
          Eventchat
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New event</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <Button onClick={signOut} variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
