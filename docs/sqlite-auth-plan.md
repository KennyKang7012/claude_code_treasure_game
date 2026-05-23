# Plan: SQLite Auth + Score Persistence for Treasure Hunt Game

## Context
The game is currently a pure front-end React SPA — every game session is stateless; there is no concept of users or history. The goal is to add:
1. A **Sign Up / Sign In** flow backed by a real SQLite database
2. **Per-user score persistence** — automatically saved when a game ends
3. **Guest mode** — play immediately with no account; scores are not stored

Because `better-sqlite3` (the canonical synchronous SQLite driver for Node) requires native binaries, we need a thin Express backend. The front-end stays almost entirely unchanged; only three small additions to `App.tsx` are needed.

---

## Architecture Overview

```
┌─────────────────────────────────┐     proxy /api/*     ┌────────────────────────────────┐
│  Vite frontend  (port 3000)     │ ──────────────────→  │  Express backend  (port 3001)  │
│  React + TypeScript + shadcn    │                      │  better-sqlite3  + JWT         │
└─────────────────────────────────┘                      └────────────────────────────────┘
```

- Single `npm run dev` starts both servers via `concurrently` + `nodemon`
- `vite.config.ts` proxy forwards all `/api/*` requests to port 3001, eliminating CORS issues in dev
- Auth state lives in React Context; JWT stored in `localStorage`
- Score is auto-saved (fire-and-forget) when `gameEnded` flips to `true` and user is logged in

---

## Complete File Structure (new and modified files only)

```
claude_code_treasure_game/
├── .env                              NEW  JWT_SECRET, PORT
├── server/                           NEW  entire backend
│   ├── index.js                      Express entry point
│   ├── database.js                   SQLite init + schema
│   ├── middleware/
│   │   └── auth.js                   JWT Bearer verifier
│   └── routes/
│       ├── auth.js                   POST /api/auth/register, /api/auth/login
│       └── scores.js                 POST /api/scores, GET /api/scores/me, GET /api/scores/leaderboard
├── src/
│   ├── lib/
│   │   └── api.ts                    NEW  typed apiFetch wrapper
│   ├── context/
│   │   └── AuthContext.tsx           NEW  auth state, provider, useAuth hook
│   ├── components/
│   │   ├── AuthPage.tsx              NEW  Sign In / Sign Up tabs + Guest link
│   │   └── ScoreHistory.tsx          NEW  personal score table (shown in Game Over panel)
│   ├── main.tsx                      MODIFIED  wrap App with AuthProvider, add <Toaster>
│   └── App.tsx                       MODIFIED  auth gate + user header bar + score-save effect
├── vite.config.ts                    MODIFIED  add server.proxy block
└── package.json                      MODIFIED  new scripts + backend dependencies
```

---

## SQLite Schema

Defined in `server/database.js`, created idempotently on startup via `IF NOT EXISTS`.

```sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,        -- bcrypt hash, cost factor 12
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL,
  outcome      TEXT    NOT NULL CHECK(outcome IN ('win','tie','loss')),
  boxes_opened INTEGER NOT NULL,       -- 1, 2, or 3
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score   ON scores(score DESC);
```

The database file lands at `./game.db` (project root, gitignored).

---

## Backend API Routes

### `server/routes/auth.js`

| Method | Path | Body | Success Response | Error Codes |
|--------|------|------|-----------------|-------------|
| POST | `/api/auth/register` | `{ username, password }` | `{ token, user: {id, username} }` | 400 validation, 409 duplicate |
| POST | `/api/auth/login`    | `{ username, password }` | `{ token, user: {id, username} }` | 400 validation, 401 bad creds |

Validation: username 3–20 alphanumeric chars; password ≥ 6 chars.
JWT signed with `process.env.JWT_SECRET`, payload `{ id, username }`, expires in `'7d'`.

### `server/routes/scores.js`

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/api/scores` | Bearer JWT | `{ id, score, outcome, created_at }` |
| GET  | `/api/scores/me` | Bearer JWT | array of last 20 scores, newest first |
| GET  | `/api/scores/leaderboard` | none | top 10: `[{ username, best_score, games_played }]` |

Leaderboard query:
```sql
SELECT u.username, MAX(s.score) AS best_score, COUNT(*) AS games_played
FROM scores s JOIN users u ON s.user_id = u.id
GROUP BY s.user_id ORDER BY best_score DESC LIMIT 10
```

---

## Auth State Machine (Frontend)

```typescript
// src/context/AuthContext.tsx
type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  user: { id: number; username: string } | null;
  token: string | null;
  login:    (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout:   () => void;
  playAsGuest: () => void;
}
```

**On mount**: read `localStorage.getItem('auth_token')`. If present, decode JWT payload (client-side, no verify) for `{ id, username }`, set status `'authenticated'`. If absent, set status `'unauthenticated'`.

**`login` / `register`**: call respective API endpoint; on success, write token to `localStorage`, update state to `'authenticated'`.

**`logout`**: clear `localStorage`, set status `'unauthenticated'`.

**`playAsGuest`**: set status `'guest'` (no localStorage write).

---

## App.tsx Auth Gate (minimal changes)

App.tsx gets **4 additions** only — existing game logic is untouched:

**1. Auth gate at top of component render:**
```tsx
const { status, user, token, logout } = useAuth();

if (status === 'loading') return (
  <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center">
    <div className="text-amber-700 text-lg">Loading…</div>
  </div>
);

if (status === 'unauthenticated') return <AuthPage />;
```

**2. User header bar** (inside the return JSX, inside the outer `<div>`, before existing content):
```tsx
<div className="absolute top-4 right-4 flex items-center gap-3">
  {user ? (
    <>
      <span className="text-amber-800 text-sm font-medium">👤 {user.username}</span>
      <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
    </>
  ) : (
    <span className="text-amber-700 text-sm italic">Playing as guest</span>
  )}
</div>
```

**3. Score auto-save effect** (new `useEffect` after existing effects):
```tsx
useEffect(() => {
  if (!gameEnded || !user || !token) return;
  const outcome = score > 0 ? 'win' : score === 0 ? 'tie' : 'loss';
  const boxes_opened = boxes.filter(b => b.isOpen).length;
  apiFetch('/api/scores', {
    method: 'POST',
    token,
    body: JSON.stringify({ score, outcome, boxes_opened }),
    headers: { 'Content-Type': 'application/json' },
  })
    .then(() => toast.success('Score saved!'))
    .catch(() => toast.error('Could not save score'));
}, [gameEnded]);
```

**4. Score history below Play Again button** (inside `{gameEnded && (…)}` block):
```tsx
{user && <ScoreHistory token={token} />}
```

---

## AuthPage Component (`src/components/AuthPage.tsx`)

Uses shadcn components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Input`, `Label`, `Button`.

Layout: full-screen amber gradient (matching game background), centered card with two tabs ("Sign In" / "Sign Up"), and a "Continue as Guest →" link below the card.

Each tab form: username + password fields, submit button, inline error `<p>` on failure.

---

## ScoreHistory Component (`src/components/ScoreHistory.tsx`)

Props: `{ token: string }`. Fetches `GET /api/scores/me` on mount.

Uses shadcn `Table` components. Shows: Date, Score (green/red colored), Outcome emoji, Chests Opened. Personal best highlighted in a `<p>` above the table.

---

## Package.json Changes

### New backend dependencies (runtime)
```bash
npm install express better-sqlite3 bcrypt jsonwebtoken cors dotenv
```

### New devDependencies
```bash
npm install --save-dev @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken @types/cors concurrently nodemon
```

### Updated scripts
```json
"scripts": {
  "dev":        "concurrently -n client,server -c cyan,yellow \"npm run dev:client\" \"npm run dev:server\"",
  "dev:client": "vite",
  "dev:server": "nodemon server/index.js",
  "build":      "vite build",
  "start":      "node server/index.js"
}
```

---

## Vite Proxy Addition (`vite.config.ts`)

Add inside the existing `server: { … }` block:
```typescript
server: {
  port: 3000,
  open: true,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
},
```

---

## .env File (gitignored)
```
JWT_SECRET=change-me-before-deploying
PORT=3001
DATABASE_PATH=./game.db
```

Add `game.db` and `.env` to `.gitignore`.

---

## `src/lib/api.ts` — Typed Fetch Wrapper

```typescript
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}
```

---

## Implementation Order (sequential, each step is independently testable)

1. **Install dependencies** — `npm install express better-sqlite3 bcrypt jsonwebtoken cors dotenv concurrently nodemon @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken @types/cors`
2. **Create `.env`** and add `game.db` + `.env` to `.gitignore`
3. **`server/database.js`** — init better-sqlite3, run schema, export `db`
4. **`server/middleware/auth.js`** — JWT Bearer verifier
5. **`server/routes/auth.js`** — register + login handlers
6. **`server/routes/scores.js`** — POST score, GET my scores, GET leaderboard
7. **`server/index.js`** — wire Express, mount routes, listen on PORT
8. **Update `package.json` scripts** — add dev/dev:client/dev:server/start
9. **Update `vite.config.ts`** — add proxy block
10. **`src/lib/api.ts`** — apiFetch helper
11. **`src/context/AuthContext.tsx`** — AuthProvider + useAuth hook
12. **`src/components/AuthPage.tsx`** — Sign In/Sign Up tabs + Guest link (uses shadcn Tabs, Card, Input, Label, Button)
13. **`src/components/ScoreHistory.tsx`** — personal score table (uses shadcn Table)
14. **Modify `src/main.tsx`** — wrap `<App />` with `<AuthProvider>`, import and add `<Toaster />` from sonner
15. **Modify `src/App.tsx`** — import `useAuth`, `apiFetch`, `toast`; add auth gate, user header bar, score-save useEffect, `<ScoreHistory>` in game-over panel

---

## Verification

1. Run `npm run dev` — should start both Vite (3000) and Express (3001) in one terminal
2. Open `http://localhost:3000` — should show the AuthPage (Sign In / Sign Up tabs)
3. Register a new user → should redirect to game, show "👤 username" in top-right
4. Play a game to completion → "Score saved! ✅" toast, ScoreHistory table appears below Play Again
5. Click Play Again, play again → second score appears in ScoreHistory
6. Sign Out → returns to AuthPage
7. Click "Continue as Guest →" → game runs normally, no score-save toast, no ScoreHistory table, "Playing as guest" label in top-right
8. Sign In with existing user → previous scores visible in ScoreHistory
9. Test wrong password → `401` error shown inline on Sign In form
10. Test duplicate username → `409` error shown inline on Sign Up form
11. Verify `game.db` file created at project root with `users` and `scores` tables populated
12. Hit `GET http://localhost:3001/api/scores/leaderboard` directly — should return JSON with top scores
