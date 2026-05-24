# 如何在 Vercel 上設定環境變數

本教學說明如何將本機 `.env` 檔案中的環境變數，手動設定到 Vercel 的線上環境，讓部署後的應用程式能正常運作。

---

## 背景說明

本機開發時，敏感設定（如 JWT 密鑰、資料庫路徑）存放在 `.env` 檔案中。  
但 `.env` 已被加入 `.gitignore`，**不會被上傳到 Vercel**，因此必須在 Vercel 上另行設定。

本專案需要的環境變數：

| 變數名稱 | 是否需要在 Vercel 設定 | 說明 |
|----------|-----------------------|------|
| `JWT_SECRET` | ✅ **必須設定** | JWT 簽發與驗證所需的密鑰，沒有這個值登入與註冊會直接報錯 |
| `PORT` | ❌ 不需要 | Vercel 自行管理 port，程式碼使用 `module.exports = app` 而非 `app.listen()` |
| `DATABASE_PATH` | ❌ 不需要 | 程式碼已自動判斷：Vercel 環境使用 `/tmp/game.db`，本機才用此變數 |

---

## 方法一：Vercel Dashboard（網頁介面）

### 步驟 1 — 進入專案設定

1. 前往 [https://vercel.com](https://vercel.com) 並登入
2. 點選你的專案（例如 `claude_code_treasure_game`）
3. 點選上方導覽列的 **Settings**

### 步驟 2 — 開啟 Environment Variables 頁面

在左側選單找到並點選 **Environment Variables**

### 步驟 3 — 新增環境變數

填入以下欄位後點選 **Save**：

```
Key:   JWT_SECRET
Value: 你的密鑰（建議用隨機字串，例如 openssl rand -hex 32 產生）

Environments（勾選適用的環境）:
  ☑ Production    ← 正式站，必須勾選
  ☑ Preview       ← PR 預覽站（可選）
  ☑ Development   ← 本機 vercel dev（可選）
```

> ⚠️ **注意**：至少要勾選 **Production**，否則正式部署的站台不會讀到這個值。

### 步驟 4 — 重新部署

環境變數設定後**不會自動生效**，必須重新部署：

- **方式 A（Dashboard）**：上方點 **Deployments** → 最新一筆右側點 `⋯` → 選 **Redeploy**
- **方式 B（終端機）**：執行以下指令

```bash
vercel --prod --yes
```

---

## 方法二：Vercel CLI（終端機指令）

### 前置條件：確認已安裝並登入 CLI

```bash
# 安裝 Vercel CLI（若尚未安裝）
npm install -g vercel

# 確認版本
vercel --version

# 登入（會開啟瀏覽器驗證）
vercel login
```

### 常用指令一覽

```bash
# 新增環境變數（互動式輸入值）
vercel env add JWT_SECRET

# 指定只套用到特定環境
vercel env add JWT_SECRET production

# 查看目前所有已設定的環境變數
vercel env ls

# 刪除環境變數
vercel env rm JWT_SECRET

# 將 Vercel 上的環境變數拉回本機（存成 .env.local）
vercel env pull .env.local
```

### 實際操作範例

```bash
# 用 openssl 產生安全的隨機密鑰，並直接設定到 Vercel
echo "my-secret-$(openssl rand -hex 16)" | vercel env add JWT_SECRET production --yes

# 確認設定成功
vercel env ls
```

輸出範例：
```
 name        value      environments   created
 JWT_SECRET  Encrypted  Production     just now
```

### 設定完成後重新部署

```bash
vercel --prod --yes
```

---

## 三種 Vercel 環境說明

| 環境 | 觸發時機 | 適用場景 |
|------|---------|---------|
| **Production** | `vercel --prod` 部署 | 正式對外的網站 |
| **Preview** | 每次 git push 或 PR | 測試新功能，不影響正式站 |
| **Development** | 本機執行 `vercel dev` | 本機開發時模擬 Vercel 環境 |

同一個變數名稱可以在不同環境設定**不同的值**，例如：
- Production 的 `JWT_SECRET` 用高強度隨機值
- Development 的 `JWT_SECRET` 用簡單好記的測試值

---

## 常見錯誤排查

### ❌ 錯誤：`secretOrPrivateKey must have a value`

**原因**：`JWT_SECRET` 未在 Vercel 上設定，或設定後未重新部署。

**解法**：
```bash
vercel env add JWT_SECRET production
vercel --prod --yes
```

### ❌ 分數儲存失敗（`SQLITE_CONSTRAINT_FOREIGNKEY`）

**原因**：Vercel Serverless Function 冷啟動後，`/tmp/game.db` 是全新空白的，導致使用者資料不存在，外鍵約束失敗。

**說明**：這是 SQLite 搭配 Vercel Serverless 的架構限制，詳見 [sqlite-auth-plan.md](./sqlite-auth-plan.md)。  
目前已在 `server/routes/scores.js` 加入容錯邏輯，儲存分數前若找不到使用者，會從 JWT token 自動補建。

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `.env` | 本機環境變數（不上傳至 git） |
| `server/index.js` | 讀取 `JWT_SECRET`、`PORT`、`CORS_ORIGIN` |
| `server/database.js` | 自動判斷 `VERCEL===1` 時使用 `/tmp/game.db` |
| `vercel.json` | Vercel 部署設定（build command、rewrites） |
