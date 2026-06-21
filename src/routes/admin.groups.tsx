import { createFileRoute } from "@tanstack/react-router";
import { useData, USERS } from "@/lib/store";

export const Route = createFileRoute("/admin/groups")({
  component: AdminGroups,
});

function AdminGroups() {
  const { groups } = useData();
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-black">Groups</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(g => (
          <div key={g.id} className="glass-card rounded-2xl overflow-hidden">
            <img src={g.image} alt={g.name} className="aspect-[16/9] w-full object-cover" />
            <div className="p-4">
              <h3 className="font-black">{g.name}</h3>
              <p className="text-xs text-white/40 line-clamp-2 mt-1">{g.description}</p>
              <div className="flex -space-x-2 mt-3">
                {g.members.slice(0,5).map(m => {
                  const u = USERS.find(x => x.id === m.userId);
                  return u ? <img key={m.userId} src={u.avatar} alt="" className="size-7 rounded-full ring-2 ring-stage-card" /> : null;
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <button className="text-[10px] uppercase tracking-widest font-bold text-amber-glow">Edit</button>
                <button className="text-[10px] uppercase tracking-widest font-bold text-white/40">Archive</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
