# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install           # Install all dependencies (frontend + backend)
npm run dev           # Start BOTH servers concurrently (Vite on :3000, Express on :3001)
npm run dev:client    # Frontend only (Vite)
npm run dev:server    # Backend only (nodemon)
npm run build         # Production build → outputs to build/ (not dist/)
npm start             # Run backend in production mode
npm run deploy:gh     # Build with GitHub Pages base URL and deploy to gh-pages branch
```

There are no lint or test scripts configured.

**Before first run**: create a `.env` file in the project root:
```
JWT_SECRET=your-secret-key
PORT=3001
DATABASE_PATH=./game.db
```

**Port conflict check**: if the backend fails to start, run `lsof -i :3001` to detect stale Node processes and kill them before restarting.

## Architecture

This project has two layers that must run together:

```
Vite frontend (:3000)  ──/api/* proxy──▶  Express backend (:3001)
     React + TypeScript                    better-sqlite3 + JWT
```

### Frontend (`src/`)

The game UI is in **`src/App.tsx`**. It renders three treasure chests; one randomly contains treasure (+$150), others contain skeletons (-$50). Game ends when treasure is found or all chests are opened.

**Auth flow** — `App.tsx` reads `useAuth()` at the top and gates rendering:
- `status === 'loading'` → amber loading screen
- `status === 'unauthenticated'` → renders `<AuthPage />` (full-page replace, no router)
- `status === 'authenticated'` or `'guest'` → renders the game

**State in `App.tsx`**:
- `boxes: Box[]` — `{ id, isOpen, hasTreasure }` for three chests
- `score: number` — running score
- `gameEnded: boolean` — triggers Game Over panel and score auto-save

**Auth state machine** (`src/context/AuthContext.tsx`):

| Status | Trigger | UI |
|--------|---------|-----|
| `loading` | App mount, reading localStorage | Loading screen |
| `unauthenticated` | No token in localStorage | `<AuthPage />` |
| `authenticated` | Login/register success | Game + user header |
| `guest` | "Continue as guest" clicked | Game + guest header |

JWT token is stored in `localStorage` as `auth_token`. Client-side decoding (no signature verify) extracts `{ id, username }` on mount. `logout()` handles both sign-out and guest → auth page transitions.

**Key files**:
- `src/context/AuthContext.tsx` — `AuthProvider`, `useAuth()` hook, all auth state
- `src/lib/api.ts` — `apiFetch<T>()` typed fetch wrapper that injects `Authorization: Bearer` header
- `src/components/AuthPage.tsx` — Login/register UI. Uses custom `useState` tab buttons (NOT shadcn `Tabs` — Tailwind v4 breaks `data-[state=active]` selectors on Radix UI). Card width set via `style={{ width: '420px' }}`, not `max-w-md`.
- `src/components/ScoreHistory.tsx` — Fetches `GET /api/scores/me` on mount; shown after game ends for authenticated users

**UI components** (`src/components/ui/`): Pre-generated shadcn/ui backed by Radix UI. Import from `@/components/ui/<name>`. **Do not use shadcn `Tabs` with Tailwind v4** — use custom controlled state instead.

**Path alias**: `@` → `src/` (configured in `vite.config.ts`).

**Vite quirk**: `vite.config.ts` has version-pinned aliases (e.g. `'motion@*': 'motion'`) — do not remove them.

### Backend (`server/`)

Plain CommonJS (no TypeScript). Three files handle all logic:

- `server/database.js` — opens `game.db` via `better-sqlite3`, runs `CREATE TABLE IF NOT EXISTS` for `users` and `scores`, exports the `db` instance. Uses WAL mode (`PRAGMA journal_mode = WAL`).
- `server/middleware/auth.js` — verifies `Authorization: Bearer <token>` with `jwt.verify`; attaches `req.user = { id, username }`.
- `server/routes/auth.js` — `POST /api/auth/register` and `/api/auth/login`. Passwords hashed with bcrypt (cost 12). Returns `{ token, user }`.
- `server/routes/scores.js` — `POST /api/scores` (auth required), `GET /api/scores/me` (auth required), `GET /api/scores/leaderboard` (public).

**SQLite schema**:
```sql
users  (id, username UNIQUE, password, created_at)
scores (id, user_id → users.id CASCADE, score, outcome CHECK('win'|'tie'|'loss'), boxes_opened, created_at)
```

**Score auto-save**: a `useEffect` in `App.tsx` fires when `gameEnded` becomes `true` and `user` + `token` are present. Fire-and-forget — errors show a toast but don't interrupt the game.

## Styling

- **Tailwind CSS v4** — utility classes inline in JSX. `src/index.css` is the compiled output; do not edit directly.
- **Custom/global styles** → `src/styles/globals.css`.
- Primary theme: amber palette (`amber-50` through `amber-900`).
- Explicit pixel values (e.g. `style={{ width: '420px' }}`) are preferred over Tailwind width utilities like `max-w-md` when Tailwind v4 compatibility is uncertain.

## Assets

| Path | Purpose |
|------|---------|
| `src/assets/treasure_closed.png` | Closed chest |
| `src/assets/treasure_opened.png` | Open chest with treasure |
| `src/assets/treasure_opened_skeleton.png` | Open chest with skeleton |
| `src/assets/key.png` | Custom cursor shown on hover over closed chest |
| `src/audios/chest_open.mp3` | Treasure sound |
| `src/audios/chest_open_with_evil_laugh.mp3` | Skeleton sound |

Audio is imported as ES module assets and played via `new Audio(src).play()`.

## Deployment

本專案支援兩種部署目標，各有對應的 Claude Code 自訂指令。

### 快速指令

| 指令 | 平台 | 功能 |
|------|------|------|
| `/deploy_vercel` | Vercel | 完整部署（前端 + 後端 API） |
| `/deploy_github_page` | GitHub Pages | 靜態前端部署（僅訪客模式） |

### 線上網址

| 平台 | 網址 |
|------|------|
| Vercel（完整版） | https://claudecodetreasuregame-zeta.vercel.app |
| GitHub Pages（訪客版） | https://kennykang7012.github.io/claude_code_treasure_game/ |
| GitHub 程式碼 | https://github.com/KennyKang7012/claude_code_treasure_game |

### 功能差異

| 功能 | GitHub Pages | Vercel |
|------|:-----------:|:------:|
| 訪客模式遊玩 | ✅ | ✅ |
| 登入 / 註冊 | ❌ | ✅ |
| 分數儲存 | ❌ | ✅ |

### 關鍵部署設定

**`vercel.json`** — Vercel 路由設定，`/api/*` 導向 Serverless Function：
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)",     "destination": "/index.html"   }
  ]
}
```

**`vite.config.ts`** — `base` 必須在 `defineConfig` **根層級**（不可放在 `build` 內，否則靜默忽略導致白畫面）：
```ts
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/claude_code_treasure_game/' : '/',
  build: { target: 'esnext', outDir: 'build' },
})
```

**`server/index.js`** — Vercel 環境不自行 listen，改用 `module.exports = app`：
```js
if (process.env.VERCEL !== '1') {
  app.listen(PORT, ...);
}
module.exports = app;
```

**`server/database.js`** — Vercel Serverless 只有 `/tmp` 可寫入：
```js
const dbPath = process.env.VERCEL === '1' ? '/tmp/game.db' : './game.db';
```

### Vercel 環境變數

Vercel 上只需設定一個環境變數（`.env` 不會被上傳）：

```bash
vercel env add JWT_SECRET production
```

`PORT` 和 `DATABASE_PATH` 不需要設定。

### 注意事項

- **SQLite 在 Vercel 上是短暫性的**：Serverless Function 冷啟動後 `/tmp/game.db` 會清空。`server/routes/scores.js` 已加入容錯邏輯，儲存分數前若找不到使用者會從 JWT 自動補建。
- **詳細排查文件**：見 `docs/` 目錄下的各知識庫檔案。
