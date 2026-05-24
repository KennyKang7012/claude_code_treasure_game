# /deploy_github_page

將本專案的前端部署至 GitHub Pages 並回傳線上網址。

> ⚠️ **架構限制**：GitHub Pages 只能服務靜態檔案，Express 後端不會被部署。
> 登入、註冊、儲存分數功能無法使用，只有**訪客模式**可正常遊玩。
> 若需要完整功能（含後端），請改用 `/deploy_vercel`。

---

## 執行指示（給 Claude）

依序執行以下每個步驟。每個步驟都必須實際執行 bash 指令來偵測狀態，並根據結果自動處理，不可只顯示說明文字後停下來等待。

---

### 步驟 1 — 確認 git 已安裝

執行：
```bash
git --version
```

- 若成功：繼續下一步。
- 若失敗（command not found）：告知使用者安裝 git，macOS 執行 `xcode-select --install`，然後停止並請使用者安裝後重新執行本指令。

---

### 步驟 2 — 確認 gh CLI 已安裝

執行：
```bash
gh --version 2>&1
```

- 若成功：繼續下一步。
- 若失敗（command not found）：
  - macOS 自動執行安裝：
    ```bash
    brew install gh
    ```
  - 安裝完成後確認版本，繼續下一步。
  - 若非 macOS（brew 不可用）：告知使用者前往 https://cli.github.com 下載後重新執行本指令。

---

### 步驟 3 — 確認已登入 GitHub（核心前置條件）

執行：
```bash
gh auth status 2>&1
```

**情況 A：輸出包含 `Logged in to github.com`** → 已登入，繼續下一步。

**情況 B：輸出包含 `not logged in` 或 `no credentials`** → 尚未登入，執行：
```bash
gh auth login --web --hostname github.com
```

此指令會輸出一組**一次性驗證碼**和**驗證網址**。將這兩項明確告知使用者：
> 「請前往 https://github.com/login/device 並輸入驗證碼：XXXX-XXXX」

等待背景程序完成（exit code 0），再執行一次 `gh auth status 2>&1` 確認登入成功後，繼續下一步。

---

### 步驟 4 — 確認 GitHub 遠端倉庫已設定（若無則自動建立）

執行：
```bash
git remote get-url origin 2>&1
```

**情況 A：成功回傳 URL（含 github.com）** → 遠端倉庫已存在，解析出 USERNAME 和 REPO_NAME 後繼續下一步。

**情況 B：失敗或無輸出** → 尚未設定遠端，自動建立 GitHub repo 並連結：
```bash
# 取得本機專案資料夾名稱作為 repo 名稱
REPO_NAME=$(basename "$PWD")

# 在 GitHub 建立公開 repo，並設為 origin
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
```

建立完成後再執行 `git remote get-url origin` 確認，解析出 USERNAME 和 REPO_NAME，繼續下一步。

---

### 步驟 5 — 確認 Vite base URL 已設定

執行：
```bash
grep -n "GITHUB_PAGES" vite.config.ts 2>&1
```

**情況 A：找到 `GITHUB_PAGES`** → 已設定，繼續下一步。

**情況 B：找不到** → 在 `vite.config.ts` 的 **`defineConfig` 根層級**加入 base 設定。

> ⚠️ 注意：`base` **必須放在根層級**，不可放在 `build: {}` 內部，
> 否則 Vite 會靜默忽略，導致部署後白畫面。

找到：
```ts
export default defineConfig({
  plugins: [react()],
  // ... 其他設定 ...
  build: {
    target: 'esnext',
    outDir: 'build',
  },
})
```

替換為（`base` 加在根層級，`build` 區塊不動）：
```ts
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 需要 base = /<repo-name>/；本機開發與 Vercel 保持 '/'
  base: process.env.GITHUB_PAGES === 'true' ? '/<REPO_NAME>/' : '/',
  // ... 其他設定 ...
  build: {
    target: 'esnext',
    outDir: 'build',
  },
})
```

（`<REPO_NAME>` 替換成步驟 4 取得的實際名稱）

修改後 commit：
```bash
git add vite.config.ts
git commit -m "設定 Vite base URL 以支援 GitHub Pages 部署"
```

---

### 步驟 6 — 確認 gh-pages 套件與部署腳本已安裝

執行：
```bash
npm list gh-pages --depth=0 2>&1
```

**情況 A：找到 gh-pages** → 繼續。

**情況 B：找不到** → 安裝：
```bash
npm install --save-dev gh-pages
```

執行：
```bash
grep "deploy:gh" package.json 2>&1
```

**若找不到 `deploy:gh`** → 在 `package.json` 的 `scripts` 區塊新增：
```json
"deploy:gh": "GITHUB_PAGES=true npm run build && gh-pages -d build"
```

修改後 commit：
```bash
git add package.json package-lock.json
git commit -m "新增 GitHub Pages 部署腳本與 gh-pages 套件"
```

---

### 步驟 7 — 推送最新程式碼至 GitHub

執行：
```bash
git push origin HEAD 2>&1
```

確認推送成功後繼續。

---

### 步驟 8 — 建置並部署至 GitHub Pages

執行：
```bash
npm run deploy:gh 2>&1
```

等待終端機出現 `Published` 字樣，確認部署成功後繼續。

若出現 `GITHUB_PAGES is not recognized`（Windows 環境）：
```bash
npm install --save-dev cross-env
# 並將 deploy:gh 腳本改為：
# "deploy:gh": "cross-env GITHUB_PAGES=true npm run build && gh-pages -d build"
```

---

### 步驟 9 — 確認 GitHub Pages 已啟用

從步驟 4 取得的 USERNAME 和 REPO_NAME，執行：
```bash
gh api repos/<USERNAME>/<REPO_NAME>/pages 2>&1
```

**情況 A：回傳包含 `html_url`** → 已啟用，繼續下一步。

**情況 B：回傳 404 或 "not found"** → 啟用 GitHub Pages：
```bash
gh api repos/<USERNAME>/<REPO_NAME>/pages \
  --method POST \
  --header "Accept: application/vnd.github+json" \
  --field build_type=legacy \
  --field source='{"branch":"gh-pages","path":"/"}' 2>&1
```

---

### 步驟 10 — 等待部署完成並回傳網址

執行以下指令等待網站上線（最多等待 3 分鐘）：
```bash
PAGES_URL="https://<USERNAME>.github.io/<REPO_NAME>/"
until curl -sI "$PAGES_URL" 2>/dev/null | grep -q "HTTP/2 200\|HTTP/1.1 200"; do
  sleep 10
done
echo "✅ 部署完成：$PAGES_URL"
```

最後明確告知使用者：

> 🎉 **GitHub Pages 部署完成！**
>
> 🌐 **線上網址**：`https://<USERNAME>.github.io/<REPO_NAME>/`
>
> 📦 **GitHub 程式碼**：`https://github.com/<USERNAME>/<REPO_NAME>`
>
> ⚠️ 注意：此版本只有訪客模式可玩，登入功能需後端支援（請用 `/deploy_vercel`）。

---

## 快速重新部署（之後每次更新只需這一步）

前置條件（gh 登入、repo、base 設定）都完成後，只需執行：
```bash
npm run deploy:gh
```
