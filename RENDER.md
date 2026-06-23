# Render 部署步驟（簡明）

1. 將專案推到 GitHub（或其他 Git 支援的遠端）。
2. 登入 https://render.com，點選 "New" → "Web Service"。
3. 連接你的 GitHub 帳號，選擇要部署的 repository。
4. 設定：Environment 選 `Node`，Build Command 可填 `npm install`，Start Command 填 `npm start`。
5. 在 Environment Variables 加入：
   - `SESSION_SECRET` = 任意長且安全的字串
   - 若使用 MongoDB Atlas，`MONGO_URI` = 你的連線字串
6. 點 Deploy，Render 會自動建置並提供一個公開網址（例如 `https://<your-service>.onrender.com`）。

測試：在公開網址上執行「註冊 → 登入 → 新增帳目 → 刪除帳目 → 登出」，確認功能及權限隔離。

若需使用 `render.yaml`（Infrastructure-as-code）已包含在專案根目錄，可在 Render 的 UI 選擇從 YAML 部署。
