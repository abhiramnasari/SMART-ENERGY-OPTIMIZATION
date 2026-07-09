import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, Bell, HardDrive, LayoutDashboard, LogOut, FileText, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({ component: AuthedLayout });

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/devices", label: "Devices", icon: HardDrive },
  { to: "/history", label: "History", icon: Activity },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

function AuthedLayout() {
  const { session, loading, user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Voltiq</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-border pt-4 text-sm">
          <div className="mb-3 px-2">
            <div className="truncate font-medium">{user?.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{role ?? "user"}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border p-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Zap className="h-4 w-4" /></div>
            <span className="font-semibold">Voltiq</span>
          </div>
          <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 md:hidden">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
              pathname === item.to ? "bg-sidebar-accent" : "text-muted-foreground"
            )}>
              <item.icon className="h-4 w-4" /> {item.label}
            </Link>
          ))}
        </div>
        <main className="flex-1 overflow-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
