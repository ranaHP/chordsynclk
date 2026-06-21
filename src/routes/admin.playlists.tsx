import { createFileRoute, Link } from "@tanstack/react-router";
import { useData } from "@/lib/store";

export const Route = createFileRoute("/admin/playlists")({
  component: AdminPlaylists,
});

function AdminPlaylists() {
  const { events } = useData();
  const rows = events.flatMap(e => e.playlists.map(p => ({ event: e, p })));
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-black">Playlists</h1>
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-[10px] uppercase tracking-widest text-white/40 bg-white/[0.02]">
              <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Event</th><th className="text-left p-3">Items</th><th className="text-right p-3"></th></tr>
            </thead>
            <tbody>
              {rows.map(({ event, p }) => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-3 font-bold">{p.name}</td>
                  <td className="p-3 text-white/60">{event.name}</td>
                  <td className="p-3 text-white/60">{p.items.length}</td>
                  <td className="p-3 text-right"><Link to="/events/$eventId" params={{ eventId: event.id }} className="text-amber-glow text-xs font-bold uppercase tracking-widest">Edit</Link></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="p-8 text-center text-white/40">No playlists yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
