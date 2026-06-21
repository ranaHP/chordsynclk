# ChordSync Event + Group Page Fix

This package keeps the original visual layout and fixes these URLs:

- `http://127.0.0.1:5174/events/e1`
- `http://localhost:5173/groups/6a36d7e2deeb3ec030ebd970`

## What was fixed

- Event detail page now loads MongoDB event data through `/api/events/:id`.
- Group detail page now loads MongoDB group, members, and events through `/api/groups/:id`.
- The exact group id `6a36d7e2deeb3ec030ebd970` is supported.
- The exact event id `e1` is supported through `eventId` in MongoDB.
- Playlist create/edit/delete/add song/reorder/remove now uses backend APIs when `VITE_API_URL` is configured.
- Local mock fallback is still present only as a safety fallback if the backend is unavailable, so the layout never breaks while developing.
- Backend CORS now allows localhost/127.0.0.1 on ports 5173 and 5174.
- A collaboration seed script was added: `npm run seed:collab`.

## Setup

Frontend `.env`:

```env
VITE_API_URL=http://127.0.0.1:4000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Backend `backend/.env`:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/chordsync
JWT_SECRET=replace-with-long-random-string
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000
```

## Run

Terminal 1:

```bash
cd backend
npm install
copy .env.example .env
npm run seed:collab
npm run dev
```

Terminal 2:

```bash
npm install
copy .env.example .env
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174/events/e1
http://localhost:5173/groups/6a36d7e2deeb3ec030ebd970
```

If the frontend says API failed, log in first or check `/api/health` on the backend.
