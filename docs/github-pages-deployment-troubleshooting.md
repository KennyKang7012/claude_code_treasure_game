# GitHub Pages 部署問題排查知識庫

本文記錄將本專案部署至 GitHub Pages 時，實際遭遇的問題、根本原因與解決方案。

---

## 問題一：部署後網頁空白（白畫面）

### 錯誤現象

網址正常回傳 HTTP 200，頁面標題也顯示正確（`Interactive Treasure Box Game`），但畫面完全空白，沒有任何內容。

### 診斷方式

```bash
# 查看已部署的 HTML 中資源路徑
curl -s https://<user>.github.io/<repo>/ | grep -o 'src="[^"]*"\|href="[^"]*"' | head -5
```

**問題路徑（錯誤）**：
```
src="/assets/index-D-En03eM.js"
href="/assets/index-CrIFhWsR.css"
```

**正確路徑**：
```
src="/claude_code_treasure_game/assets/index-DVaxz-iX.js"
href="/claude_code_treasure_game/assets/index-CrIFhWsR.css"
```

瀏覽器請求 `/assets/xxx.js` 時，GitHub Pages 找不到這個路徑，回傳 404，React app 無法載入，畫面空白。

### 根本原因

Vite 的 `base` 設定被誤放在 `build` **區塊內部**，Vite 不識別這個位置，靜默忽略，導致資源路徑沒有加上 repo 前綴：

```ts
// ❌ 錯誤寫法：base 在 build 內，完全不生效
export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'build',
    base: process.env.GITHUB_PAGES === 'true' ? '/claude_code_treasure_game/' : '/',
  },
})
```

### 解決方案

**將 `base` 移到 `defineConfig` 的根層級**：

```ts
// ✅ 正確寫法：base 在根層級
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/claude_code_treasure_game/' : '/',
  build: {
    target: 'esnext',
    outDir: 'build',
  },
})
```

重新部署：
```bash
npm run deploy:gh
```

等待新版 hash 傳播（可用以下指令確認）：
```bash
until curl -s https://<user>.github.io/<repo>/ | grep -q "<新hash>"; do sleep 10; done
echo "新版本已上線"
```

### 學到的原則

> Vite 的 `base` 選項**只能**放在 `defineConfig({})` 的根層級，放在 `build: {}` 內會被靜默忽略，不會有任何警告或錯誤。

---

## 問題二：gh CLI 未安裝

### 錯誤現象

執行 `gh --version` 時回傳：
```
gh not found
```

或：
```
command not found: gh
```

### 根本原因

GitHub CLI（`gh`）不是 macOS 內建工具，需要手動安裝。

### 解決方案

**macOS（使用 Homebrew）**：
```bash
brew install gh
gh --version  # 確認安裝成功
```

**其他系統**：前往 https://cli.github.com 下載對應安裝包。

---

## 問題三：gh CLI 尚未登入 GitHub

### 錯誤現象

執行 `gh auth status` 時回傳：
```
You are not logged into any GitHub hosts. To log in, run: gh auth login
```

或後續操作出現：
```
gh: To get started with GitHub CLI, please run: gh auth login
```

### 解決方案

執行網頁驗證流程：
```bash
gh auth login --web --hostname github.com
```

指令會輸出類似：
```
! First copy your one-time code: 4F94-7D0C
Open this URL to continue in your web browser: https://github.com/login/device
```

操作步驟：
1. 前往 `https://github.com/login/device`
2. 輸入畫面上顯示的**一次性驗證碼**（格式 `XXXX-XXXX`）
3. 點選授權，等待終端機出現成功訊息

確認登入成功：
```bash
gh auth status
# 預期輸出：✓ Logged in to github.com account <USERNAME>
```

### 注意事項

- 驗證碼有時效限制，若超時需重新執行 `gh auth login --web`
- 登入完成後，token 會儲存在系統 keyring，之後不需要重新登入
- 若在 CI/CD 環境或無瀏覽器的環境，改用 token 登入：
  ```bash
  gh auth login --with-token <<< "your_github_token"
  ```

---

## 問題四：GitHub Pages 顯示舊版快取

### 錯誤現象

重新部署後，網頁仍顯示舊版本或白畫面，用 curl 驗證 HTML 中的 JS hash 仍是舊的。

### 根本原因

GitHub Pages 的 CDN 有快取，新部署的內容不會立即反映，通常需要 30 秒至數分鐘傳播。

### 解決方案

用以下指令等待新版本 hash 出現，確認真正上線：
```bash
# 將 <新hash> 替換為 npm run build 後 build/index.html 內的實際 hash
until curl -s https://<user>.github.io/<repo>/ | grep -q "<新hash>"; do
  sleep 10
done
echo "✅ 新版本已上線"
```

或直接等待 API 回傳 building → built：
```bash
until gh api repos/<user>/<repo>/pages --jq '.status' 2>/dev/null | grep -q "built"; do
  sleep 5
done
echo "✅ GitHub Pages 建置完成"
```

---

## 問題五：`GITHUB_PAGES is not recognized`（Windows 環境）

### 錯誤現象

Windows 環境執行 `npm run deploy:gh` 時出現：
```
'GITHUB_PAGES' is not recognized as an internal or external command
```

### 根本原因

`GITHUB_PAGES=true npm run build` 這種 inline 環境變數語法只在 Unix/macOS 的 shell 有效，Windows 的 CMD/PowerShell 不支援。

### 解決方案

安裝 `cross-env`：
```bash
npm install --save-dev cross-env
```

修改 `package.json` 的 `deploy:gh` 腳本：
```json
"deploy:gh": "cross-env GITHUB_PAGES=true npm run build && gh-pages -d build"
```

---

## 快速診斷流程

遇到 GitHub Pages 問題時，依序執行：

```bash
# 1. 確認 gh-pages 分支有內容
git ls-remote origin gh-pages

# 2. 確認 GitHub Pages 狀態
gh api repos/<user>/<repo>/pages --jq '{status,html_url,source}'

# 3. 確認部署的資源路徑是否正確
curl -s https://<user>.github.io/<repo>/ | grep -o 'src="[^"]*"' | head -3

# 4. 重新部署
npm run deploy:gh
```

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [github-pages-vs-vercel.md](./github-pages-vs-vercel.md) | 兩個平台的功能與架構差異 |
| [vercel-deployment-troubleshooting.md](./vercel-deployment-troubleshooting.md) | Vercel 部署問題排查 |
| `.claude/commands/deploy_github_page.md` | `/deploy_github_page` 自訂指令 |
