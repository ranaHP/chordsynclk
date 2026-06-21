# ChordSync Live — Backend

Express + MongoDB (Mongoose) + Socket.IO. Google Identity Services (ID token) sign-in, JWT sessions.

## Setup

```bash
cd backend
cp .env.example .env       # fill GOOGLE_CLIENT_ID, JWT_SECRET, MONGODB_URI
npm install                # or: bun install
npm run seed               # optional: seed sample artists/songs/users
npm run dev                # http://localhost:4000
```

Frontend: set `VITE_API_URL=http://localhost:4000` in the root `.env` so the React app talks to this backend.

## Auth (Google ID token + JWT)

1. Frontend uses Google Identity Services to obtain an ID token.
2. `POST /api/auth/google` with `{ credential: "<id_token>" }` → backend verifies with `google-auth-library`, upserts user, returns `{ token, user }`.
3. Frontend stores `token` and sends `Authorization: Bearer <token>` on every request.
4. `GET /api/auth/me` returns the current user.

## REST endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/google` | — | Exchange Google ID token for JWT |
| GET | `/api/auth/me` | ✓ | Current user |
| GET | `/api/users` | ✓ | List users |
| GET | `/api/users/:id` | ✓ | Get user |
| PATCH | `/api/users/:id` | ✓ self/admin | Update profile |
| GET | `/api/artists` | — | List/paginate artists (`?q=&page=&limit=`) |
| GET | `/api/artists/:slug` | — | Artist + its songs |
| GET | `/api/songs` | — | List/search songs (`?q=&artistSlug=&page=&limit=`) |
| GET | `/api/songs/:songId` | — | Full song with sections + lines |
| GET | `/api/groups` | ✓ | Groups the user belongs to |
| POST | `/api/groups` | ✓ | Create group |
| GET | `/api/groups/:id` | ✓ | Group detail (members, events) |
| PATCH | `/api/groups/:id` | ✓ owner | Update group |
| DELETE | `/api/groups/:id` | ✓ owner | Delete group |
| POST | `/api/groups/:id/members` | ✓ | Add member `{ userId, role }` |
| PATCH | `/api/groups/:id/members/:userId` | ✓ | Change role |
| DELETE | `/api/groups/:id/members/:userId` | ✓ | Remove member |
| GET | `/api/events?groupId=` | ✓ | List events |
| POST | `/api/events` | ✓ | Create event |
| GET | `/api/events/:id` | ✓ | Event with playlists |
| PATCH/DELETE | `/api/events/:id` | ✓ | Update / delete |
| POST | `/api/events/:id/playlists` | ✓ | Add playlist |
| PATCH/DELETE | `/api/events/:id/playlists/:plId` | ✓ | Update / delete |
| POST | `/api/events/:id/playlists/:plId/items` | ✓ | Add song item `{ songId, partName? }` |
| DELETE | `/api/events/:id/playlists/:plId/items/:itemId` | ✓ | Remove item |
| POST | `/api/events/:id/playlists/:plId/reorder` | ✓ | `{ from, to }` |
| GET | `/api/live/:eventId` | ✓ | Snapshot of live session |

## Socket.IO (live sync)

Connect with `auth: { token }`. Join an event room and broadcast scroll state.

```js
const socket = io("http://localhost:4000", { auth: { token } });
socket.emit("live:join", { eventId });
socket.on("live:state",   ({ index, scrollTop, scrollerId, viewers }) => {});
socket.on("live:viewers", ({ count, users }) => {});

// Scroller only:
socket.emit("live:take-scroller");
socket.emit("live:index", { index });
socket.emit("live:scroll", { scrollTop, scrollPct });   // throttle to ~30fps client-side
socket.emit("live:playback", { playing, speed });
```

Server broadcasts `live:state` to everyone else in the room so non-scrollers' fullscreen view follows the Scroller's scroll position automatically.

## Data models

See `src/models/`. `Artist` and `Song` follow the exact schema you provided (including `lines`, `sections`, `sectionFlow`, indexes).
