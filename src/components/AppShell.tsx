import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Users, Calendar, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/lib/store";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const NavLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className="text-sm font-medium text-white/60 hover:text-amber-glow transition-colors"
      activeProps={{ className: "text-amber-glow" }}
      activeOptions={{ exact: to === "/" }}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-stage-black text-white/90 relative overflow-x-hidden">
      <AmbientStage />
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-stage-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="size-9 bg-amber-glow rounded-lg flex items-center justify-center gap-0.5">
              <div className="w-1 h-4 bg-stage-black rounded-full animate-eq" style={{ animationDelay: "0ms" }} />
              <div className="w-1 h-6 bg-stage-black rounded-full animate-eq" style={{ animationDelay: "150ms" }} />
              <div className="w-1 h-3 bg-stage-black rounded-full animate-eq" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
              ChordSync <span className="text-amber-glow">Live</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <NavLink to="/" label="Home" />
            <NavLink to="/search" label="Browse" />
            <NavLink to="/collections" label="Collections" />
            <NavLink to="/groups" label="Groups" />
            <NavLink to="/users" label="Users" />
            {user?.isAdmin && <NavLink to="/admin" label="Admin" />}
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setOpen((v) => !v)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 transition-colors"
                >
                  <span className="hidden sm:block text-xs text-white/70 font-medium">{user.name}</span>
                  <img src={user.avatar} alt={user.name} className="size-8 rounded-full ring-1 ring-white/15" />
                </button>
                {open && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-xl bg-stage-elevated border border-white/10 shadow-2xl py-1 animate-fade-in-up"
                    onMouseLeave={() => setOpen(false)}
                  >
                    <div className="px-3 py-2 text-xs text-white/40">{user.email}</div>
                    <button
                      onClick={() => { logout(); setOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2"
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/auth" className="px-3 py-1.5 rounded-full bg-amber-glow text-stage-black text-xs font-bold">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 pb-28 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-card border-t border-white/10 px-2 pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center">
          {[
            { to: "/", icon: Home, label: "Home" },
            { to: "/search", icon: Search, label: "Browse" },
            { to: "/groups", icon: Users, label: "Groups" },
            { to: "/users", icon: Calendar, label: "Users" },
            ...(user?.isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin" }] : []),
          ].map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${active ? "text-amber-glow" : "text-white/50"}`}
              >
                <Icon className="size-5" />
                <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function AmbientStage() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute -top-[20%] -left-[10%] size-[60vw] bg-amber-glow/10 blur-[120px] rounded-full" />
      <div className="absolute -bottom-[10%] right-[5%] size-[40vw] bg-neon-sync/5 blur-[120px] rounded-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(251,191,36,0.05),transparent_60%)]" />
    </div>
  );
}
