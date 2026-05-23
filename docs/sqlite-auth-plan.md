# 計劃：SQLite 登入系統與分數儲存（Treasure Hunt Game）

> **文件狀態**：已與最終實作同步（含 UI 修正）
> **最後更新**：2026-05-24

---

## 背景說明

遊戲原本是純前端 React SPA，每局遊戲完全無狀態、無使用者概念。本次目標：

1. 加入 **登入 / 註冊**流程，使用者資料以 SQLite 持久保存
2. 登入使用者的**分數自動儲存**（遊戲結束時觸發）
3. 支援**訪客模式**，可直接開始遊戲但不儲存分數

由於 `better-sqlite3` 需要 native binary，採用 Express 輕量後端。前端原有遊戲邏輯**完全不動**，僅增加三處小改動。

---

## 架構總覽

```
┌─────────────────────────────────┐     proxy /api/*     ┌────────────────────────────────┐
│  Vite 前端  (port 3000)          │ ──────────────────→  │  Express 後端  (port 3001)     │
│  React + TypeScript + shadcn    │                      │  better-sqlite3  + JWT         │
└─────────────────────────────────┘                      └────────────────────────────────┘
```

- 單一 `npm run dev` 透過 `concurrently` + `nodemon` 同時啟動兩個伺服器
- Vite proxy 將所有 `/api/*` 請求轉發至 port 3001，開發環境無 CORS 問題
- 認證狀態存於 React Context；JWT token 存於 `localStorage`
- `gameEnded` 變為 `true` 且使用者已登入時，fire-and-forget 自動儲存分數

---

## 檔案結構（僅列新增與修改）

```
claude_code_treasure_game/
├── .env                              新增  JWT_SECRET, PORT, DATABASE_PATH
├── server/                           新增  完整後端
│   ├── index.js                      Express 入口，監聽 port 3001
│   ├── database.js                   SQLite 初始化與 Schema
│   ├── middleware/
│   │   └── auth.js                   JWT Bearer Token 驗證中介層
│   └── routes/
│       ├── auth.js                   POST /api/auth/register、/api/auth/login
│       └── scores.js                 POST /api/scores、GET /api/scores/me、GET /api/scores/leaderboard
├── src/
│   ├── lib/
│   │   └── api.ts                    新增  型別安全的 apiFetch 工具函式
│   ├── context/
│   │   └── AuthContext.tsx           新增  認證狀態機 + Provider + useAuth hook
│   ├── components/
│   │   ├── AuthPage.tsx              新增  登入 / 註冊頁面 + 訪客模式連結
│   │   └── ScoreHistory.tsx          新增  個人歷史分數表格（遊戲結束後顯示）
│   ├── main.tsx                      修改  加入 AuthProvider 包覆、Toaster 通知
│   └── App.tsx                       修改  認證守衛、使用者 Header、分數自動儲存
├── vite.config.ts                    修改  新增 server.proxy 區塊
└── package.json                      修改  新增 dev/dev:client/dev:server/start 指令
```

---

## SQLite Schema

定義於 `server/database.js`，啟動時冪等建立（`IF NOT EXISTS`）。

```sql
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT    NOT NULL UNIQUE,
  password    TEXT    NOT NULL,        -- bcrypt hash，cost factor 12
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL,
  outcome      TEXT    NOT NULL CHECK(outcome IN ('win','tie','loss')),
  boxes_opened INTEGER NOT NULL,       -- 1、2 或 3
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score   ON scores(score DESC);
```

資料庫檔案位於 `./game.db`（已加入 `.gitignore`，連同 WAL 暫存檔 `.db-shm`、`.db-wal`）。

---

## 後端 API 路由

### `server/routes/auth.js`

| Method | Path | Body | 成功回應 | 錯誤碼 |
|--------|------|------|---------|--------|
| POST | `/api/auth/register` | `{ username, password }` | `{ token, user: {id, username} }` | 400 驗證失敗、409 名稱重複 |
| POST | `/api/auth/login`    | `{ username, password }` | `{ token, user: {id, username} }` | 400 驗證失敗、401 帳密錯誤 |

驗證規則：username 3–20 個英數字元；password ≥ 6 個字元。
JWT 以 `process.env.JWT_SECRET` 簽署，payload `{ id, username }`，有效期 7 天。

### `server/routes/scores.js`

| Method | Path | 認證 | 回應 |
|--------|------|------|------|
| POST | `/api/scores` | Bearer JWT | `{ id, score, outcome, boxes_opened, created_at }` |
| GET  | `/api/scores/me` | Bearer JWT | 最近 20 筆，由新至舊 |
| GET  | `/api/scores/leaderboard` | 不需要 | 最高分前 10 名：`[{ username, best_score, games_played }]` |

排行榜查詢：
```sql
SELECT u.username, MAX(s.score) AS best_score, COUNT(*) AS games_played
FROM scores s JOIN users u ON s.user_id = u.id
GROUP BY s.user_id ORDER BY best_score DESC LIMIT 10
```

---

## 前端認證狀態機

```typescript
// src/context/AuthContext.tsx
type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'guest';

interface AuthContextValue {
  status: AuthStatus;
  user: { id: number; username: string } | null;
  token: string | null;
  login:       (username: string, password: string) => Promise<void>;
  register:    (username: string, password: string) => Promise<void>;
  logout:      () => void;   // 登出 OR 訪客返回登入頁，皆呼叫此函式
  playAsGuest: () => void;
}
```

| 狀態 | 觸發條件 | 畫面 |
|------|---------|------|
| `loading` | 初始化，讀取 localStorage | 全螢幕 amber 載入動畫 |
| `unauthenticated` | localStorage 無 token | 顯示 `<AuthPage />` |
| `authenticated` | 登入 / 註冊成功 | 顯示遊戲，右上角顯示使用者名稱 + 登出按鈕 |
| `guest` | 點擊「以訪客身分繼續」 | 顯示遊戲，右上角顯示「訪客模式」+ 返回登入按鈕 |

**mount 時**：讀取 `localStorage.getItem('auth_token')`，若存在則 client-side 解碼 JWT payload 取得 `{ id, username }`，設定為 `authenticated`；否則設定為 `unauthenticated`。

**`logout()`**：清除 localStorage token，狀態重設為 `unauthenticated`。訪客模式的「← 返回登入」也呼叫同一函式。

---

## AuthPage 元件（`src/components/AuthPage.tsx`）

> ⚠️ **實作注意**：原計劃使用 shadcn `Tabs` 元件，但因 **Tailwind v4 對 Radix UI `data-[state=active]` 選擇器支援不一致**，導致 Tab 切換失效。最終改為自訂 `useState` 控制的 tab 按鈕。

### 使用的 shadcn 元件
`Card`、`CardHeader`、`CardTitle`、`CardDescription`、`CardContent`、`Input`、`Label`、`Button`

### 佈局
- 全螢幕 amber 漸層背景（與遊戲畫面一致）
- 卡片固定寬度 `style={{ width: '420px', maxWidth: 'calc(100vw - 48px)' }}`（不使用 `max-w-md`，避免 Tailwind v4 相容性問題）
- 卡片內自訂切換按鈕（`activeTab === 'login'` 條件渲染對應表單）
- 卡片下方「以訪客身分繼續（不儲存分數）→」連結

### Tab 切換實作（自訂，非 shadcn Tabs）

```tsx
const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

// Tab 按鈕區塊
<div className="flex rounded-lg overflow-hidden border-2 border-amber-200 mb-6">
  <button type="button"
    onClick={() => { setActiveTab('login'); setLoginError(''); }}
    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
      activeTab === 'login' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'
    }`}>
    🔑 登入
  </button>
  <button type="button"
    onClick={() => { setActiveTab('register'); setRegError(''); }}
    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
      activeTab === 'register' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 hover:bg-amber-50'
    }`}>
    🗺️ 註冊
  </button>
</div>

{activeTab === 'login' && <form onSubmit={handleLogin}>...</form>}
{activeTab === 'register' && <form onSubmit={handleRegister}>...</form>}
```

---

## App.tsx 修改（最小變動）

原有遊戲邏輯完全不動，僅新增以下四處：

**1. Auth 狀態守衛（render 最頂部）**
```tsx
const { status, user, token, logout } = useAuth();

if (status === 'loading') return (
  <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100 flex items-center justify-center">
    <div className="text-amber-700 text-lg animate-pulse">載入中…</div>
  </div>
);

if (status === 'unauthenticated') return <AuthPage />;
```

**2. 右上角使用者資訊 Header**（登入使用者 vs 訪客模式各顯示不同內容）
```tsx
<div className="absolute top-4 right-4 flex items-center gap-3">
  {user ? (
    <>
      <span className="text-amber-800 text-sm font-medium">👤 {user.username}</span>
      <Button variant="outline" size="sm" onClick={logout}
        className="border-amber-400 text-amber-700 hover:bg-amber-100">
        登出
      </Button>
    </>
  ) : (
    <>
      <span className="text-amber-700 text-sm italic">訪客模式</span>
      <Button variant="outline" size="sm" onClick={logout}
        className="border-amber-400 text-amber-700 hover:bg-amber-100">
        ← 返回登入
      </Button>
    </>
  )}
</div>
```

**3. 分數自動儲存 useEffect**
```tsx
useEffect(() => {
  if (!gameEnded || !user || !token) return;
  const outcome = score > 0 ? 'win' : score === 0 ? 'tie' : 'loss';
  const boxes_opened = boxes.filter(b => b.isOpen).length;
  apiFetch('/api/scores', {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, outcome, boxes_opened }),
  })
    .then(() => toast.success('分數已儲存！'))
    .catch(() => toast.error('分數儲存失敗'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [gameEnded]);
```

**4. 遊戲結束面板下方顯示歷史分數**
```tsx
{user && token && <ScoreHistory token={token} />}
```

---

## ScoreHistory 元件（`src/components/ScoreHistory.tsx`）

Props：`{ token: string }`，mount 時 fetch `GET /api/scores/me`。

顯示欄位：日期（`zh-TW` locale 格式）、分數（正值綠色 / 負值紅色）、結果表情符號（🏆/🤝/💀）、開箱數（`N / 3`）。表格上方另顯示個人最高分。

---

## Package.json 指令

```json
"scripts": {
  "dev":        "concurrently -n client,server -c cyan,yellow \"npm run dev:client\" \"npm run dev:server\"",
  "dev:client": "vite",
  "dev:server": "nodemon server/index.js",
  "build":      "vite build",
  "start":      "node server/index.js"
}
```

### 相依套件

**Runtime**：`express`、`better-sqlite3`、`bcrypt`、`jsonwebtoken`、`cors`、`dotenv`

**Dev**：`@types/better-sqlite3`、`@types/bcrypt`、`@types/jsonwebtoken`、`@types/cors`、`concurrently`、`nodemon`

---

## Vite Proxy（`vite.config.ts`）

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

## .env 環境變數（已加入 .gitignore）

```
JWT_SECRET=change-me-before-deploying
PORT=3001
DATABASE_PATH=./game.db
```

---

## `src/lib/api.ts`

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
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}
```

---

## 已知注意事項

| 項目 | 說明 |
|------|------|
| Tailwind v4 + Radix Tabs | `data-[state=active]` 選擇器在 Tailwind v4 下不穩定，已改用自訂 tab 按鈕取代 shadcn Tabs |
| SQLite WAL 模式 | server 未正常關閉（SIGKILL）時，WAL 可能未 checkpoint，重啟後資料仍完整（SQLite 自動回放 WAL）；正常 SIGTERM 關閉則會自動 checkpoint |
| Port 衝突 | `npm run dev` 啟動前請確認 port 3001 無殘留 process（可用 `lsof -i :3001` 檢查）|
| JWT 安全性 | 目前採 localStorage 儲存（適合本地開發）；正式環境建議改用 httpOnly cookie + CSRF 保護 |

---

## 驗收測試清單

1. `npm run dev` → 同時啟動 Vite（3000）與 Express（3001）
2. 開啟 `http://localhost:3000` → 顯示登入 / 註冊頁面
3. 點擊「🗺️ 註冊」tab → 表單切換正確；填入資料後建立帳號成功
4. 登入後進入遊戲 → 右上角顯示「👤 {username}」與「登出」按鈕
5. 遊戲結束 → 出現「分數已儲存！」toast，下方顯示歷史分數表格
6. 再玩一局 → 新分數追加至表格
7. 點擊「登出」→ 返回登入頁
8. 點擊「以訪客身分繼續」→ 正常遊戲，右上角顯示「訪客模式」+ 「← 返回登入」按鈕
9. 在訪客模式點擊「← 返回登入」→ 返回登入 / 註冊頁面
10. 遊戲結束後**無** toast、無歷史分數表格（訪客不儲存）
11. 以已存在帳號重新登入 → 歷史分數顯示正確
12. 輸入錯誤密碼 → 表單內顯示「⚠️ 使用者名稱或密碼錯誤」
13. 重複使用者名稱 → 表單內顯示「⚠️ 此使用者名稱已被使用」
14. 直接訪問 `http://localhost:3001/api/scores/leaderboard` → 回傳 JSON 排行榜資料
