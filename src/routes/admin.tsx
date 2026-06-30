import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Music, Users, Calendar, ListMusic, Shield, Home } from "lucide-react";
import { useAuth } from "@/lib/store";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — ChordSync Live" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/songs", label: "Songs", icon: Music },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/groups", label: "Groups", icon: Shield },
  { to: "/admin/events", label: "Events", icon: Calendar },
  { to: "/admin/playlists", label: "Playlists", icon: ListMusic },
];

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (user && !user.isAdmin) navigate({ to: "/" });
    if (!user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stage-black text-white flex items-center justify-center px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-glow">Admin Access</p>
          <p className="mt-2 text-sm text-white/60">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stage-black text-white flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/5 bg-sidebar p-4 sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2 mb-8 px-2">
          <div className="size-9 bg-amber-glow rounded-lg flex items-center justify-center gap-0.5">
            <div className="w-1 h-4 bg-stage-black rounded-full" />
            <div className="w-1 h-6 bg-stage-black rounded-full" />
            <div className="w-1 h-3 bg-stage-black rounded-full" />
          </div>
          <span className="font-extrabold">ChordSync</span>
          <span className="text-[10px] uppercase font-bold text-amber-glow tracking-wider ml-auto">
            Admin
          </span>
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-amber-glow/10 text-amber-glow" : "text-white/60 hover:bg-white/5 hover:text-white"}`}
              >
                <n.icon className="size-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/"
          className="mt-auto flex items-center gap-2 px-3 py-2 text-xs text-white/40 hover:text-white"
        >
          <Home className="size-3.5" /> Back to app
        </Link>
      </aside>

      {/* Mobile top bar for admin nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-sidebar/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-extrabold text-sm">
            ChordSync <span className="text-amber-glow">Admin</span>
          </Link>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar px-4 pb-2">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${active ? "bg-amber-glow text-stage-black" : "bg-white/5 text-white/60"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="flex-1 min-w-0 pt-24 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
