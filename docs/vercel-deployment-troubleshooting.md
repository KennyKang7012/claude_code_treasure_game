# Vercel 部署問題排查知識庫

本文記錄將本專案（Vite + React 前端 + Express 後端 + SQLite）部署至 Vercel 時，
實際遭遇的三個問題、根本原因與解決方案。

---

## 問題一：部署建置失敗 — `Function Runtimes must have a valid version`

### 錯誤訊息

```
Error: Function Runtimes must have a valid version,
       for example `now-php@1.0.0`.
```

### 發生時機

第一次執行 `vercel --prod --yes` 時，Vercel 的建置伺服器直接中止。

### 根本原因

`vercel.json` 的 `functions` 區塊中，指定了沒有版本號的 runtime：

```json
// ❌ 錯誤寫法
{
  "functions": {
    "api/index.js": {
      "runtime": "@vercel/node"   ← 沒有版本號，Vercel 拒絕接受
    }
  }
}
```

Vercel v2 規範中，若要明確指定 runtime 必須帶版本（如 `@vercel/node@3.0.0`）。
但實務上，放在 `api/` 目錄下的 `.js` 檔案，Vercel **會自動偵測為 Node.js**，根本不需要手動宣告。

### 解決方案

直接移除 `functions` 區塊，讓 Vercel 自動判斷：

```json
// ✅ 正確寫法
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)",     "destination": "/index.html"   }
  ]
}
```

### 學到的原則

> 放在 `api/` 目錄下的 Node.js 檔案，Vercel 會自動識別，不需要也不應該手動指定 `runtime`。

---

## 問題二：登入與註冊失敗 — `secretOrPrivateKey must have a value`

### 錯誤訊息

前端顯示：`伺服器錯誤，請稍後再試`

Vercel Function 日誌（`vercel logs --expand`）：

```
Register error: Error: secretOrPrivateKey must have a value
  at module.exports [as sign] (jsonwebtoken/sign.js:111:20)
  at signToken (server/routes/auth.js:20:14)
```

### 發生時機

部署成功後，嘗試在前端進行「註冊」或「登入」時，API 回傳 500 錯誤。

### 根本原因

本機開發時，`JWT_SECRET` 存放在 `.env` 檔案中：

```
# .env（本機）
JWT_SECRET=your-secret-key
```

但 `.env` 已被加入 `.gitignore`，**不會被上傳到 Vercel**。
Vercel 的 Serverless Function 讀不到這個變數，`process.env.JWT_SECRET` 為 `undefined`，
導致 `jwt.sign()` 在嘗試簽發 token 時直接拋錯。

### 解決方案

**方式 A：CLI（推薦）**

```bash
# 產生安全的隨機密鑰並直接設定
echo "secret-$(openssl rand -hex 16)" | vercel env add JWT_SECRET production --yes

# 確認已設定
vercel env ls

# 重新部署讓設定生效
vercel --prod --yes
```

**方式 B：Dashboard 網頁**

`Vercel 專案` → `Settings` → `Environment Variables` → 填入 `JWT_SECRET` 並勾選 **Production** → `Save` → 重新部署

### 學到的原則

> **所有 `.env` 裡的機密變數，都必須在 Vercel Dashboard 或 CLI 上另行設定。**
> 部署後若出現 500 錯誤，第一步永遠先跑 `vercel logs --expand` 看真正的錯誤訊息，
> 而不是猜測前端顯示的通用錯誤文字。

---

## 問題三：分數儲存間歇性失敗 — `SQLITE_CONSTRAINT_FOREIGNKEY`

### 錯誤訊息

前端顯示：`分數儲存失敗`

Vercel Function 日誌：

```
Save score error: SqliteError: FOREIGN KEY constraint failed
  at server/routes/scores.js:25:25
  { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }
```

### 發生時機

登入後進行遊戲，遊戲結束時自動儲存分數——**有時成功，有時失敗**，無規律。

### 根本原因

這是 **Vercel Serverless Function + SQLite** 的架構性限制，失敗流程如下：

```
步驟 1：你向 Instance A 發出「註冊」請求
        → SQLite 在 Instance A 的 /tmp/game.db 建立 users 資料（user_id = 1）
        → JWT token 記錄 { id: 1, username: "xxx" }

步驟 2：Vercel 因流量或閒置，啟動全新的 Instance B（冷啟動）
        → Instance B 的 /tmp/game.db 是空白的，沒有任何使用者資料

步驟 3：遊戲結束，「儲存分數」請求送到 Instance B
        → INSERT INTO scores (user_id = 1, ...)
        → users 表中找不到 id = 1 的使用者
        → SQLite 外鍵約束（FOREIGN KEY）失敗
        → 500 錯誤
```

**關鍵**：Vercel 每個 Serverless Function 執行個體的 `/tmp` 目錄是**完全獨立且隨時被清空**的，
不同 instance 之間**不共享**任何本地檔案，包含 SQLite 的 `.db` 檔。

### 解決方案

#### 短期修復（已套用）

在 `server/routes/scores.js` 的儲存分數路由中，加入容錯邏輯：
儲存前先查詢使用者是否存在，若不存在就從 **JWT token 的資料自動補建**。

```js
// server/routes/scores.js — POST /api/scores
try {
  // Vercel 冷啟動時 /tmp/game.db 是空的，但 JWT 仍帶著有效的 user 資訊
  // 若找不到使用者，從 JWT 資料補建，確保外鍵不會失敗
  const existing = db
    .prepare('SELECT id FROM users WHERE id = ?')
    .get(req.user.id);

  if (!existing) {
    db.prepare(
      'INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)'
    ).run(req.user.id, req.user.username, '[jwt-restored]');
  }

  // 正常儲存分數...
}
```

這個方法讓分數儲存不再因冷啟動而失敗，但**資料仍不會跨 instance 持久保存**。

#### 長期解法（若需要真正持久化）

用雲端資料庫取代本機 SQLite，推薦以下免費方案：

| 服務 | 特色 | 適合情境 |
|------|------|---------|
| **Vercel Postgres** | 與 Vercel 原生整合，改動最小 | 已在 Vercel 部署的專案 |
| **Supabase** | 免費額度大，有管理介面 | 需要後台查看資料 |
| **Turso** | 雲端 SQLite，語法幾乎不用改 | 想繼續用 SQLite 語法 |
| **PlanetScale** | MySQL 相容，全球分散式 | 高流量需求 |

### 學到的原則

> **Vercel Serverless Function 的 `/tmp` 目錄是短暫的（ephemeral）。**
> 任何寫入 `/tmp` 的資料（包含 SQLite `.db` 檔）都不應該被視為持久儲存。
> 若應用程式需要跨請求保留資料，必須使用外部資料庫服務。

---

## 快速診斷流程

遇到 Vercel 部署或 API 問題時，依序執行：

```bash
# 1. 確認最新部署狀態
vercel ls

# 2. 查看真實錯誤訊息（最重要）
vercel logs dpl_<deployment-id> --expand

# 3. 確認環境變數是否齊全
vercel env ls

# 4. 直接打 API 測試（繞過前端）
curl -s https://your-app.vercel.app/api/health
curl -s -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# 5. 修完後重新部署
vercel --prod --yes
```

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [vercel-env-variables.md](./vercel-env-variables.md) | 如何在 Vercel 上設定環境變數的完整教學 |
| [sqlite-auth-plan.md](./sqlite-auth-plan.md) | SQLite 認證系統的設計規劃 |
| `vercel.json` | 本專案的 Vercel 部署設定 |
| `api/index.js` | Vercel Serverless Function 入口點 |
| `server/routes/scores.js` | 含冷啟動容錯邏輯的分數儲存路由 |
