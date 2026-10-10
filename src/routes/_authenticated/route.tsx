import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Crown, FileText, History, LayoutDashboard, LogOut, ScanLine, Settings, ShieldCheck, Stethoscope, User, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scan", label: "Scan X-Ray", icon: ScanLine },
  { to: "/history", label: "History", icon: History },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/doctors", label: "Find Doctor", icon: Stethoscope },
  { to: "/appointments", label: "Appointments", icon: Calendar },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/doctor-portal", label: "Doctor portal", icon: UserRound },
] as const;

function Shell() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Link to="/dashboard" className="px-2 py-3 font-display text-lg text-sidebar-accent-foreground">PneumoScan<span className="text-sidebar-primary"> AI</span></Link>
        <nav className="mt-4 flex flex-1 flex-col gap-1 text-sm">
          {nav.map(({ to, label, icon: I }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>
              <I className="size-4" />{label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>
              <ShieldCheck className="size-4" />Admin review
            </Link>
          )}
        </nav>
        <Link to="/status" className="px-3 py-2 text-xs opacity-70 hover:opacity-100">System status</Link>
        <button onClick={signOut} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"><LogOut className="size-4" />Sign out</button>
      </aside>
      <div className="flex-1">
        <div className="flex gap-2 overflow-x-auto border-b bg-sidebar p-2 text-xs text-sidebar-foreground md:hidden">
          {nav.map(({ to, label }) => <Link key={to} to={to} className="whitespace-nowrap rounded px-2 py-1" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>{label}</Link>)}
          <button onClick={signOut} className="whitespace-nowrap px-2">Sign out</button>
        </div>
        <main className="mx-auto max-w-5xl p-6 md:p-10"><Outlet /></main>
      </div>
    </div>
  );
}
