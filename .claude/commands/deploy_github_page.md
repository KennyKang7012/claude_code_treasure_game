# /deploy_github_page

將本專案的前端部署至 GitHub Pages 並回傳線上網址。

> ⚠️ **架構限制**：GitHub Pages 只能服務靜態檔案，**Express 後端不會被部署**。
> 因此登入、註冊、儲存分數等功能在 GitHub Pages 上無法使用，只有**訪客模式**可正常遊玩。
> 若需要完整功能（含後端），請改用 `/deploy_vercel`。

---

## 執行步驟

### 步驟 1 — 確認 git 已安裝

```bash
git --version
```

若未安裝：macOS 執行 `xcode-select --install`，或前往 https://git-scm.com 下載。

### 步驟 2 — 確認 gh CLI 已安裝並登入

```bash
gh --version
```

**若尚未安裝**（macOS）：
```bash
brew install gh
```

**若尚未安裝**（其他系統）：前往 https://cli.github.com 下載安裝。

安裝完成後登入：
```bash
gh auth login
# 選擇 GitHub.com → HTTPS → 用瀏覽器登入
```

確認登入狀態：
```bash
gh auth status
```

### 步驟 3 — 確認 GitHub 遠端倉庫已設定

```bash
git remote -v
```

**若尚未有遠端倉庫**，執行以下指令建立並連結：
```bash
# 在 GitHub 建立新 repo（互動式）
gh repo create

# 或直接指定名稱與權限建立
gh repo create <REPO_NAME> --public --source=. --remote=origin --push
```

**取得目前的 username 和 repo 名稱**（後續步驟會用到）：
```bash
# 從 remote URL 解析
git remote get-url origin
# 範例輸出：https://github.com/KennyKang7012/claude_code_treasure_game.git
# → username = KennyKang7012
# → repo     = claude_code_treasure_game
```

### 步驟 4 — 設定 Vite base URL（GitHub Pages 必要）

GitHub Pages 的網址格式為 `https://<username>.github.io/<repo>/`，
Vite 預設以 `/` 為根路徑，**不加 `base` 會導致 CSS、JS 全部 404**。

確認 `vite.config.ts` 的 `build` 區塊已加入 `base`：

```ts
build: {
  target: 'esnext',
  outDir: 'build',
  base: '/<REPO_NAME>/',   // ← 新增這行，<REPO_NAME> 替換成實際 repo 名稱
},
```

> 若 `base` 已存在且正確，可跳過此步驟。

修改後記得 commit：
```bash
git add vite.config.ts
git commit -m "設定 Vite base URL 以支援 GitHub Pages 部署"
```

### 步驟 5 — 安裝 gh-pages 套件（若尚未安裝）

```bash
# 確認是否已安裝
npm list gh-pages --depth=0

# 若未安裝
npm install --save-dev gh-pages
```

確認 `package.json` 的 `scripts` 區塊包含 deploy 指令：
```json
"deploy:gh": "gh-pages -d build"
```

若沒有，手動加入後 commit：
```bash
git add package.json
git commit -m "新增 GitHub Pages 部署腳本"
```

### 步驟 6 — 建置並部署至 GitHub Pages

```bash
npm run deploy:gh
```

此腳本等同於：
```bash
GITHUB_PAGES=true npm run build   # 以正確的 base URL 建置
gh-pages -d build                 # 推送 build/ 至 gh-pages 分支
```

確認 `build/` 目錄已產生且包含 `index.html`：
```bash
ls build/
```

> 若出現 `GITHUB_PAGES is not recognized` 錯誤（Windows 環境），
> 請改用：`cross-env GITHUB_PAGES=true npm run build && gh-pages -d build`
> 並先安裝：`npm install --save-dev cross-env`

此指令會將 `build/` 目錄的內容推送至 `gh-pages` 分支。
完成後終端機會顯示 `Published`。

### 步驟 8 — 確認 GitHub Pages 已啟用

```bash
# 查看目前 Pages 設定
gh api repos/<USERNAME>/<REPO>/pages 2>/dev/null || echo "Pages 尚未啟用"

# 若尚未啟用，透過 API 啟用（來源設為 gh-pages 分支）
gh api repos/<USERNAME>/<REPO>/pages \
  --method POST \
  --field source='{"branch":"gh-pages","path":"/"}' \
  2>/dev/null || echo "Pages 已存在或已啟用"
```

### 步驟 9 — 回傳線上網址並驗證

```bash
# 取得 GitHub Pages 網址
gh api repos/<USERNAME>/<REPO>/pages --jq '.html_url' 2>/dev/null \
  || echo "https://<USERNAME>.github.io/<REPO>/"
```

等待約 30–60 秒讓 GitHub 完成部署，再用 curl 驗證：
```bash
curl -sI https://<USERNAME>.github.io/<REPO>/ | head -5
# 預期看到 HTTP/2 200
```

---

## 注意事項

- **只有前端會被部署**：`/api/*` 路徑在 GitHub Pages 上不存在，登入、註冊、儲存分數均會失敗。只有「以訪客身分繼續」可正常遊玩。

- **首次啟用 Pages 需等待**：GitHub Pages 第一次啟用後需要 1–3 分鐘才會生效，出現 404 屬正常，稍後重整即可。

- **之後每次更新只需執行步驟 6–7**：`npm run build` → `npx gh-pages -d build`，`base` 設定和套件安裝只需要做一次。

- **`base` 設定只影響 GitHub Pages 建置**：本機開發（`npm run dev`）不受影響，Vercel 部署也不受影響（Vercel 會自動處理根路徑）。

- **若部署後畫面空白或資源 404**：檢查 `vite.config.ts` 的 `base` 是否與 repo 名稱完全一致（區分大小寫）。

- **問題排查**：
  ```bash
  # 查看 gh-pages 分支是否有內容
  git ls-remote origin gh-pages

  # 查看 GitHub Pages 部署狀態
  gh api repos/<USERNAME>/<REPO>/pages
  ```
