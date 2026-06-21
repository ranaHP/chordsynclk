import { createFileRoute } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { normalizeUser } from "@/lib/view-models";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const [users, setUsers] = useState<Array<ReturnType<typeof normalizeUser>>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.listUsers("");
        if (cancelled) return;
        setUsers((res.users || []).map(normalizeUser));
      } catch {
        if (cancelled) return;
        setUsers([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-black">Users</h1>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="text-[10px] uppercase tracking-widest text-white/40 bg-white/[0.02]">
              <tr>
                <th className="text-left p-3">Performer</th>
                <th className="text-left p-3">Handle</th>
                <th className="text-left p-3">Bio</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 flex items-center gap-3">
                    <img src={u.avatar} alt={u.name} className="size-9 rounded-full" />
                    <span className="font-bold">{u.name}</span>
                  </td>
                  <td className="p-3 text-white/60">{u.handle}</td>
                  <td className="p-3 text-white/50 truncate max-w-xs">{u.bio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
