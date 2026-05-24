# /deploy_vercel

將本專案部署至 Vercel 並回傳線上網址。

## 執行步驟

### 步驟 1 — 確認 Vercel CLI 已安裝並登入

```bash
vercel --version          # 若尚未安裝，執行 npm install -g vercel
vercel whoami             # 確認已登入，若未登入執行 vercel login
```

### 步驟 2 — 確認 `vercel.json` 存在且內容正確

在專案根目錄建立或確認 `vercel.json`，內容如下（**不可加入 `functions.runtime`，否則建置會失敗**）：

```json
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

### 步驟 3 — 確認 Serverless Function 入口點存在

確認 `api/index.js` 存在，內容為：

```js
module.exports = require('../server/index.js');
```

確認 `server/index.js` 已做以下兩項修改：

**① 條件式 listen（Vercel 不呼叫 app.listen，直接使用 module.exports）**

```js
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`伺服器已啟動：http://localhost:${PORT}`));
}
module.exports = app;
```

**② 動態 CORS（自動區分本機與 Vercel 環境）**

```js
const allowedOrigin = process.env.CORS_ORIGIN ||
  (process.env.VERCEL === '1' ? '*' : 'http://localhost:3000');
app.use(cors({ origin: allowedOrigin }));
```

確認 `server/database.js` 已做以下修改（Vercel 只有 `/tmp` 可寫入）：

```js
const dbPath = process.env.VERCEL === '1'
  ? '/tmp/game.db'
  : path.resolve(process.env.DATABASE_PATH || './game.db');
```

### 步驟 4 — 設定 Vercel 環境變數（首次部署必做）

`.env` 不會被上傳到 Vercel，必須手動設定：

```bash
# 產生隨機密鑰並設定（只需做一次）
echo "secret-$(openssl rand -hex 16)" | vercel env add JWT_SECRET production --yes

# 確認已設定
vercel env ls
```

> ⚠️ 若跳過此步驟，登入與註冊會回傳 500 錯誤，日誌會顯示：
> `Error: secretOrPrivateKey must have a value`

本專案只需要 `JWT_SECRET`。`PORT` 和 `DATABASE_PATH` 在 Vercel 上**不需要**設定。

### 步驟 5 — 部署至正式環境

```bash
vercel --prod --yes
```

### 步驟 6 — 確認部署成功

```bash
# 確認 API 正常運作
curl https://<your-app>.vercel.app/api/health
# 預期回傳：{"status":"ok"}

# 確認註冊功能正常
curl -s -X POST https://<your-app>.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
# 預期回傳：{"token":"...","user":{...}}
```

## 注意事項

- **SQLite 為短暫性儲存（Ephemeral）**：Vercel Serverless Function 每次冷啟動後，`/tmp/game.db` 都是空白的。已在 `server/routes/scores.js` 加入容錯邏輯，會在儲存分數前自動從 JWT token 補建使用者資料，避免外鍵約束失敗。若需要真正持久化的資料，應換用 Vercel Postgres、Supabase 或 Turso。

- **`vercel.json` 禁止指定 `runtime`**：`functions.runtime` 若無版本號會導致建置失敗（`Function Runtimes must have a valid version`）。`api/` 目錄下的 `.js` 檔案，Vercel 會自動識別為 Node.js，不需要手動宣告。

- **修改環境變數後需重新部署**：在 Dashboard 或 CLI 上新增、修改環境變數後，必須執行 `vercel --prod --yes` 才會生效。

- **若 `better-sqlite3` 原生模組編譯失敗**：在部署前執行 `npm rebuild better-sqlite3`。

- **問題排查**：遇到錯誤時先執行 `vercel logs --expand` 查看真正的錯誤訊息，再對症下藥。詳細排查知識點見 `docs/vercel-deployment-troubleshooting.md`。
