import { createFileRoute, Link } from "@tanstack/react-router";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/admin/events")({
  component: AdminEvents,
});

function AdminEvents() {
  const { events, groups } = useData();
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-black">Events</h1>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-[10px] uppercase tracking-widest text-white/40 bg-white/[0.02]">
              <tr><th className="text-left p-3">Event</th><th className="text-left p-3">Group</th><th className="text-left p-3">Date</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Playlists</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {events.map(e => {
                const g = groups.find(x => x.id === e.groupId);
                return (
                  <tr key={e.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 font-bold">{e.name}</td>
                    <td className="p-3 text-white/60">{g?.name ?? "—"}</td>
                    <td className="p-3 text-white/60">{new Date(e.date).toLocaleString()}</td>
                    <td className="p-3 text-white/60">{e.duration} min</td>
                    <td className="p-3 text-white/60">{e.playlists.length}</td>
                    <td className="p-3 text-right">
                      <Link to="/events/$eventId" params={{ eventId: e.id }} className="text-amber-glow text-xs font-bold uppercase tracking-widest">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
