# GitHub Pages vs Vercel 部署差異知識庫

本文記錄本專案（Vite + React 前端 + Express 後端 + SQLite）分別部署至 GitHub Pages 與 Vercel 時的功能差異、錯誤行為與適用情境。

---

## 功能對照表

| 功能 | GitHub Pages | Vercel |
|------|:-----------:|:------:|
| 訪客模式遊玩 | ✅ | ✅ |
| 註冊帳號 | ❌ | ✅ |
| 登入帳號 | ❌ | ✅ |
| 遊戲分數儲存 | ❌ | ✅ |
| 排行榜 | ❌ | ✅ |
| 後端 API（`/api/*`）| ❌ | ✅ |
| 資料持久化 | ❌ | ⚠️ 短暫性（冷啟動會重置）|
| 免費額度 | ✅ 完全免費 | ✅ 免費方案可用 |
| 自訂指令 | `/deploy_github_page` | `/deploy_vercel` |

---

## 根本架構差異

### GitHub Pages
- **只能服務靜態檔案**（HTML、CSS、JS、圖片、音效）
- 沒有伺服器執行環境，**Express 後端完全不會被部署**
- 所有 `/api/*` 請求都會收到 GitHub 的 HTML 404 頁面
- 適合純前端專案（無後端需求）

### Vercel
- **同時部署前端（靜態）與後端（Serverless Function）**
- Express app 被包裝成 `api/index.js` Serverless Function
- 前後端同域，`/api/*` 請求由 Serverless Function 處理
- 適合需要後端 API 的全端專案

---

## 常見錯誤與原因

### GitHub Pages 上嘗試登入或註冊

**錯誤訊息**：
```
Unexpected token '<', "<html> <he"... is not valid JSON
```

**原因**：
1. 前端送出 `POST /api/auth/register`
2. GitHub Pages 找不到這個路徑，回傳一個 HTML 的 404 頁面
3. 前端的 `apiFetch()` 嘗試用 `response.json()` 解析回應
4. HTML 不是合法 JSON → 解析失敗，拋出此錯誤

**這不是 bug**，是靜態部署的架構限制，行為符合預期。

---

## 部署設定差異

### GitHub Pages 特有設定

**`vite.config.ts`** — `base` 必須設在根層級（不是 `build` 區塊內）：
```ts
export default defineConfig({
  // ✅ 正確：根層級
  base: process.env.GITHUB_PAGES === 'true' ? '/claude_code_treasure_game/' : '/',
  build: {
    outDir: 'build',
    // ❌ 錯誤：base 放在這裡會被忽略！
  },
})
```

**為什麼需要 `base`**：
GitHub Pages 的網址是 `https://<user>.github.io/<repo>/`，
Vite 預設以 `/` 為根路徑，不設定 `base` 的話，
CSS/JS 的路徑會是 `/assets/xxx.js`（找不到），
設定後會變成 `/claude_code_treasure_game/assets/xxx.js`（正確）。

**`package.json`** — 使用環境變數觸發正確的 base：
```json
"deploy:gh": "GITHUB_PAGES=true npm run build && gh-pages -d build"
```

### Vercel 特有設定

**`server/index.js`** — 條件式 listen，不在 Vercel 上自行啟動：
```js
if (process.env.VERCEL !== '1') {
  app.listen(PORT, ...);
}
module.exports = app;
```

**`server/database.js`** — Vercel 只有 `/tmp` 可寫入：
```js
const dbPath = process.env.VERCEL === '1'
  ? '/tmp/game.db'
  : path.resolve(process.env.DATABASE_PATH || './game.db');
```

**`vercel.json`** — 路由設定，API 導向 Serverless Function：
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/(.*)",     "destination": "/index.html"   }
  ]
}
```

---

## 白畫面排查（GitHub Pages）

若 GitHub Pages 上出現空白頁面：

1. 用瀏覽器開發者工具看 Console，若有 `404` 資源錯誤：
   - 檢查 `vite.config.ts` 的 `base` 是否在**根層級**
   - 確認 `deploy:gh` 腳本有帶 `GITHUB_PAGES=true`
   - 重新執行 `npm run deploy:gh`

2. 確認部署的 HTML 中資源路徑正確：
   ```bash
   curl -s https://<user>.github.io/<repo>/ | grep -o 'src="[^"]*"' | head -5
   # 正確：src="/claude_code_treasure_game/assets/xxx.js"
   # 錯誤：src="/assets/xxx.js"
   ```

---

## 適用情境建議

| 情境 | 建議平台 |
|------|---------|
| 展示純前端遊戲（無帳號需求）| GitHub Pages |
| 需要登入、儲存分數的完整版本 | Vercel |
| 課堂作業繳交（要求 github.io 網址）| GitHub Pages |
| 正式對外服務 | Vercel（或換用持久化資料庫）|
| 兩者都要 | 各自部署，GitHub Pages 僅訪客模式 |

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [vercel-deployment-troubleshooting.md](./vercel-deployment-troubleshooting.md) | Vercel 部署問題排查知識庫 |
| [vercel-env-variables.md](./vercel-env-variables.md) | Vercel 環境變數設定教學 |
| `.claude/commands/deploy_github_page.md` | `/deploy_github_page` 自訂指令 |
| `.claude/commands/deploy_vercel.md` | `/deploy_vercel` 自訂指令 |
