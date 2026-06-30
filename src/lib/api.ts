// Thin client for the Express + MongoDB backend.
// Set VITE_API_URL in your .env (e.g. VITE_API_URL=http://localhost:4000).
// If unset, the frontend stays on its built-in mock data.

export const API_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "";

export const API_ENABLED = !!API_URL;

const TOKEN_KEY = "csl_token_v1";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_ENABLED) throw new Error("API_URL not configured");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return res.json();
}

type ApiRecord = Record<string, unknown>;
type PaginatedResponse<T extends string> = Record<T, ApiRecord[]> & {
  total: number;
  page: number;
  limit: number;
  pages: number;
};
type AuthResponse = { token: string; user: ApiRecord };
type UserResponse = { user: ApiRecord };
type OkResponse = { ok: true; message?: string };
type ArtistListResponse = PaginatedResponse<"artists">;
type ArtistDetailResponse = {
  artist: ApiRecord;
  songs: ApiRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
type SongListResponse = PaginatedResponse<"songs">;
type SongDetailResponse = { song: ApiRecord };
type SongResponse = { song: ApiRecord };
type SongBatchResponse = { songs: ApiRecord[] };
type GroupListResponse = { groups: ApiRecord[] };
type GroupDetailResponse = { group: ApiRecord; users: ApiRecord[]; events: ApiRecord[] };
type GroupResponse = { group: ApiRecord };
type EventListResponse = { events: ApiRecord[] };
type EventResponse = { event: ApiRecord };
type StageResponse = { event: ApiRecord; songs: ApiRecord[]; state: ApiRecord | null };
type UserListResponse = PaginatedResponse<"users">;
type AdminUserCreateResponse = { user: ApiRecord; created: boolean; promoted: boolean };
type SettingsResponse = { settings: ApiRecord };
type SongFilters = {
  artistName?: string;
  key?: string;
  timeSignature?: string;
  source?: string;
  genre?: string;
  favoriteOnly?: boolean;
};
type SongListOptions = {
  sort?: "title" | "artist" | "key" | "recent";
  content?: "summary" | "full";
};

export const api = {
  // Auth
  google: (credential: string) =>
    request<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),
  register: (body: { name: string; username: string; password: string; email?: string }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (identifier: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  forgotPassword: (identifier: string, newPassword: string) =>
    request<OkResponse>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier, newPassword }),
    }),
  guest: () => request<AuthResponse>("/api/auth/guest", { method: "POST" }),
  me: () => request<UserResponse>("/api/auth/me"),
  getPublicSettings: () => request<SettingsResponse>("/api/settings/public"),
  getAdminSettings: () => request<SettingsResponse>("/api/settings/admin"),
  updateAdminSettings: (body: ApiRecord) =>
    request<SettingsResponse>("/api/settings/admin", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Artists / songs
  listArtists: (q = "", page = 1, limit = 24) =>
    request<ArtistListResponse>(
      `/api/artists?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`,
    ),
  getArtist: (slug: string, page = 1, limit = 24) =>
    request<ArtistDetailResponse>(
      `/api/artists/${encodeURIComponent(slug)}?page=${page}&limit=${limit}`,
    ),
  listSongs: (
    q = "",
    artistSlug = "",
    page = 1,
    limit = 24,
    filters: SongFilters = {},
    options: SongListOptions = {},
  ) =>
    request<SongListResponse>(
      `/api/songs?q=${encodeURIComponent(q)}&artistSlug=${encodeURIComponent(artistSlug)}&page=${page}&limit=${limit}&artistName=${encodeURIComponent(filters.artistName || "")}&key=${encodeURIComponent(filters.key || "")}&timeSignature=${encodeURIComponent(filters.timeSignature || "")}&source=${encodeURIComponent(filters.source || "")}&genre=${encodeURIComponent(filters.genre || "")}&favoriteOnly=${filters.favoriteOnly ? "true" : "false"}&sort=${encodeURIComponent(options.sort || "title")}&content=${encodeURIComponent(options.content || "summary")}`,
    ),
  getSongsByIds: (ids: string[]) =>
    request<SongBatchResponse>(
      `/api/songs/batch?ids=${encodeURIComponent(ids.filter(Boolean).join(","))}`,
    ),
  getSong: (songId: string) =>
    request<SongDetailResponse>(`/api/songs/${encodeURIComponent(songId)}`),
  setSongFavorite: (songId: string, favorite: boolean) =>
    request<{ favorite: boolean; favoriteSongIds: string[] }>(
      `/api/songs/${encodeURIComponent(songId)}/favorite`,
      {
        method: "POST",
        body: JSON.stringify({ favorite }),
      },
    ),
  createSong: (body: ApiRecord) =>
    request<SongResponse>(`/api/songs`, { method: "POST", body: JSON.stringify(body) }),
  updateSong: (songId: string, body: ApiRecord) =>
    request<SongResponse>(`/api/songs/${encodeURIComponent(songId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  reindexSongSearch: (limit = 1000) =>
    request<{ updated: number; scanned: number; remaining: number }>(
      `/api/songs/admin/reindex-search`,
      {
        method: "POST",
        body: JSON.stringify({ limit }),
      },
    ),
  deleteSong: (songId: string) =>
    request<{ ok: true }>(`/api/songs/${encodeURIComponent(songId)}`, { method: "DELETE" }),

  // Groups
  listGroups: () => request<GroupListResponse>(`/api/groups`),
  createGroup: (body: ApiRecord) =>
    request<GroupResponse>(`/api/groups`, { method: "POST", body: JSON.stringify(body) }),
  getGroup: (id: string) => request<GroupDetailResponse>(`/api/groups/${id}`),
  updateGroup: (id: string, body: ApiRecord) =>
    request<GroupResponse>(`/api/groups/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteGroup: (id: string) =>
    request<{ ok: true }>(`/api/groups/${encodeURIComponent(id)}`, { method: "DELETE" }),
  joinGroup: (inviteCode: string) =>
    request<GroupResponse>(`/api/groups/join/${encodeURIComponent(inviteCode)}`, {
      method: "POST",
    }),
  addMember: (id: string, userId: string, role = "Member") =>
    request<GroupResponse>(`/api/groups/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ userId, role }),
    }),
  setMemberRole: (id: string, userId: string, role: string) =>
    request<GroupResponse>(`/api/groups/${id}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  // Events / playlists
  listEvents: (groupId: string) => request<EventListResponse>(`/api/events?groupId=${groupId}`),
  createEvent: (body: ApiRecord) =>
    request<EventResponse>(`/api/events`, { method: "POST", body: JSON.stringify(body) }),
  getEvent: (id: string) => request<EventResponse>(`/api/events/${encodeURIComponent(id)}`),
  updateEvent: (id: string, body: ApiRecord) =>
    request<EventResponse>(`/api/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteEvent: (id: string) =>
    request<{ ok: true }>(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
  getStage: (id: string) => request<StageResponse>(`/api/live/${encodeURIComponent(id)}/stage`),
  updatePlaylist: (id: string, plId: string, body: ApiRecord) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePlaylist: (id: string, plId: string) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}`, { method: "DELETE" }),
  addPlaylist: (id: string, name: string, description = "") =>
    request<EventResponse>(`/api/events/${id}/playlists`, {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  addPlaylistItem: (
    id: string,
    plId: string,
    songId: string,
    partName?: string,
    arrangement?: ApiRecord[],
    transpose?: number,
  ) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}/items`, {
      method: "POST",
      body: JSON.stringify({ songId, partName, arrangement, transpose }),
    }),
  updatePlaylistItem: (id: string, plId: string, itemId: string, body: ApiRecord) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removePlaylistItem: (id: string, plId: string, itemId: string) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}/items/${itemId}`, {
      method: "DELETE",
    }),
  reorderPlaylist: (id: string, plId: string, from: number, to: number) =>
    request<EventResponse>(`/api/events/${id}/playlists/${plId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),
  listUsers: (q = "", page = 1, limit = 20) =>
    request<UserListResponse>(`/api/users?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`),
  createAdminUser: (body: { name: string; email: string; username: string; password: string }) =>
    request<AdminUserCreateResponse>(`/api/users/admin/create`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
