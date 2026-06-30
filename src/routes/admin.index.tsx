import { createFileRoute } from "@tanstack/react-router";
import { useAppSettings } from "@/lib/app-settings";
import { API_ENABLED, api } from "@/lib/api";
import { USERS } from "@/lib/mock-data";
import { useData } from "@/lib/store";
import { normalizeSong } from "@/lib/view-models";
import {
  Activity,
  Music,
  Save,
  Settings2,
  TerminalSquare,
  Users,
  Calendar,
  ListMusic,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

type ViewSong = ReturnType<typeof normalizeSong>;

function AdminDashboard() {
  const { groups, events } = useData();
  const { settings, saveAdminSettings, loading: settingsLoading } = useAppSettings();
  const [songs, setSongs] = useState<ViewSong[]>([]);
  const [songTotal, setSongTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [notice, setNotice] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    siteFontScalePercent: 100,
    songReaderFontPercent: 73,
    stageReaderFontPercent: 100,
    adminTerminalTitle: "ChordSync Admin Terminal",
    recommendationTrackingEnabled: true,
  });
  const playlists = events.reduce((n, e) => n + e.playlists.length, 0);

  useEffect(() => {
    setSettingsForm({
      siteFontScalePercent: settings.siteFontScalePercent,
      songReaderFontPercent: settings.songReaderFontPercent,
      stageReaderFontPercent: settings.stageReaderFontPercent,
      adminTerminalTitle: settings.adminTerminalTitle,
      recommendationTrackingEnabled: settings.recommendationTrackingEnabled,
    });
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    async function loadSongs() {
      if (!API_ENABLED) return;

      try {
        const res = await api.listSongs("", "", 1, 6, {}, { sort: "recent" });
        if (cancelled) return;
        setSongs((res.songs || []).map(normalizeSong));
        setSongTotal(res.total || 0);
      } catch {
        if (cancelled) return;
        setSongs([]);
      }
    }

    loadSongs();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: "Songs", value: songTotal, icon: Music, color: "amber-glow" },
    { label: "Users", value: USERS.length, icon: Users, color: "neon-sync" },
    { label: "Groups", value: groups.length, icon: Users, color: "amber-glow" },
    { label: "Events", value: events.length, icon: Calendar, color: "neon-hot" },
    { label: "Playlists", value: playlists, icon: ListMusic, color: "amber-glow" },
  ];

  const recommendationViews = songs.filter((song) => song.isFavorite).length;

  const saveTerminalSettings = async () => {
    setSaving(true);
    setNotice("");
    try {
      await saveAdminSettings(settingsForm);
      setNotice("Terminal settings saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save terminal settings");
    } finally {
      setSaving(false);
    }
  };

  const runSearchReindex = async () => {
    if (!API_ENABLED) {
      setNotice("API_URL not configured");
      return;
    }

    setReindexing(true);
    setNotice("");
    try {
      const result = await api.reindexSongSearch(1500);
      setNotice(
        result.remaining > 0
          ? `Search index updated for ${result.updated} songs. ${result.remaining} still remaining.`
          : `Search index updated for ${result.updated} songs.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to reindex song search");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8">
      <header>
        <h1 className="text-3xl sm:text-4xl font-black">{settings.adminTerminalTitle}</h1>
        <p className="text-sm text-white/40">
          Global site controls, reading defaults, and library activity from one admin terminal.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5">
            <s.icon className="size-5 text-amber-glow mb-3" />
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs uppercase tracking-widest text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="grid xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="glass-card rounded-2xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-glow/20 bg-amber-glow/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-glow">
                <TerminalSquare className="size-3.5" />
                Admin Terminal
              </div>
              <h3 className="mt-3 text-xl font-black">Site configuration</h3>
              <p className="mt-1 text-sm text-white/45">
                Control global font scale and default reader sizes for the whole app.
              </p>
            </div>
            <button
              onClick={() => void saveTerminalSettings()}
              disabled={saving || settingsLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-glow px-4 py-2 text-sm font-black text-stage-black disabled:opacity-60"
            >
              <Save className="size-4" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {notice && <p className="text-xs text-amber-glow">{notice}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <TerminalField
              label="Site font scale"
              hint="Changes base font size across the site"
              value={settingsForm.siteFontScalePercent}
              onChange={(value) =>
                setSettingsForm((current) => ({ ...current, siteFontScalePercent: value }))
              }
            />
            <TerminalField
              label="Song chord default"
              hint="Default reader percent for normal song page"
              value={settingsForm.songReaderFontPercent}
              onChange={(value) =>
                setSettingsForm((current) => ({ ...current, songReaderFontPercent: value }))
              }
            />
            <TerminalField
              label="Stage default"
              hint="Default reader percent for live stage mode"
              value={settingsForm.stageReaderFontPercent}
              onChange={(value) =>
                setSettingsForm((current) => ({ ...current, stageReaderFontPercent: value }))
              }
            />
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Terminal title</p>
              <input
                value={settingsForm.adminTerminalTitle}
                onChange={(e) =>
                  setSettingsForm((current) => ({
                    ...current,
                    adminTerminalTitle: e.target.value,
                  }))
                }
                className="mt-3 w-full rounded-xl border border-white/10 bg-stage-black/50 px-3 py-2 text-sm text-white outline-none focus:border-amber-glow/40"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Recommendation tracking</p>
                <p className="text-xs text-white/45">
                  Keeps song-open history for recommendations.
                </p>
              </div>
              <button
                onClick={() =>
                  setSettingsForm((current) => ({
                    ...current,
                    recommendationTrackingEnabled: !current.recommendationTrackingEnabled,
                  }))
                }
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  settingsForm.recommendationTrackingEnabled
                    ? "bg-amber-glow text-stage-black"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {settingsForm.recommendationTrackingEnabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Song search index</p>
                <p className="text-xs text-white/45">
                  Rebuild fast part, section, chord, and lyric search data for existing songs.
                </p>
              </div>
              <button
                onClick={() => void runSearchReindex()}
                disabled={reindexing || settingsLoading}
                className="rounded-xl border border-amber-glow/30 bg-amber-glow/10 px-3 py-2 text-xs font-bold text-amber-glow disabled:opacity-60"
              >
                {reindexing ? "Indexing..." : "Reindex search"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-amber-glow" />
              <h3 className="font-black text-lg">Live config preview</h3>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <PreviewLine label="Site font scale" value={`${settings.siteFontScalePercent}%`} />
              <PreviewLine
                label="Song chord default"
                value={`${settings.songReaderFontPercent}%`}
              />
              <PreviewLine label="Stage default" value={`${settings.stageReaderFontPercent}%`} />
              <PreviewLine
                label="Recommendation tracking"
                value={settings.recommendationTrackingEnabled ? "Enabled" : "Disabled"}
              />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-neon-sync" />
              <h3 className="font-black text-lg">Terminal telemetry</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <TelemetryCard label="Tracked Songs" value={songTotal} />
              <TelemetryCard label="Favorite Signals" value={recommendationViews} />
              <TelemetryCard label="Events" value={events.length} />
              <TelemetryCard label="Groups" value={groups.length} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-black text-lg mb-4">Recent songs</h3>
          <div className="space-y-2">
            {songs.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <img src={s.cover} alt={s.title} className="size-10 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.title}</p>
                  <p className="text-[10px] text-white/40 truncate">
                    {s.artist} • {s.genre}
                  </p>
                </div>
                <span className="chord-text text-xs">{s.key}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-black text-lg mb-4">Upcoming events</h3>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                <img src={e.image} alt={e.name} className="size-10 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{e.name}</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(e.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TerminalField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={40}
          max={220}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 accent-amber-glow"
        />
        <input
          type="number"
          min={40}
          max={220}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 40)}
          className="w-20 rounded-xl border border-white/10 bg-stage-black/50 px-3 py-2 text-sm text-white outline-none focus:border-amber-glow/40"
        />
      </div>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2">
      <span className="text-white/50">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function TelemetryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
    </div>
  );
}
