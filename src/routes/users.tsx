import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { api, API_ENABLED } from "@/lib/api";
import { USERS } from "@/lib/mock-data";
import { useAuth } from "@/lib/store";
import { normalizeUser } from "@/lib/view-models";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Performers - ChordSync Live" }] }),
  component: UsersPage,
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function UsersPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState(USERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED || !user) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.listUsers(q);
        if (cancelled) return;
        setUsers((res.users || []).map(normalizeUser));
      } catch (error: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(error, "Failed to load performers"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [q, user]);

  const list =
    API_ENABLED && user
      ? users
      : USERS.filter(
          (entry) =>
            !q ||
            entry.name.toLowerCase().includes(q.toLowerCase()) ||
            entry.handle.toLowerCase().includes(q.toLowerCase()),
        );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 space-y-6">
        <header>
          <h1 className="text-3xl sm:text-4xl font-black">Performers</h1>
          <p className="text-sm text-white/40">Find your next jam partner.</p>
        </header>
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search performers..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-stage-card border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-glow/50 transition-all"
          />
        </div>
        {loading && <p className="text-sm text-white/50">Loading performers...</p>}
        {error && <p className="text-xs text-amber-glow">{error}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map((entry) => (
            <div
              key={entry.id}
              className="glass-card rounded-2xl p-5 text-center hover:border-amber-glow/30 transition-colors"
            >
              <img
                src={entry.avatar}
                alt={entry.name}
                className="size-20 mx-auto rounded-full ring-2 ring-amber-glow/20"
              />
              <h3 className="font-bold mt-3 truncate">{entry.name}</h3>
              <p className="text-[10px] text-white/40">{entry.handle}</p>
              <p className="text-xs text-white/60 mt-2 line-clamp-2">{entry.bio}</p>
              <button className="mt-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/70 hover:text-amber-glow hover:border-amber-glow/30">
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
