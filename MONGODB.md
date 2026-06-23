# MongoDB Atlas 快速教學

這裡列出最簡短的步驟，讓你能快速建立一個 Atlas Cluster 並取得 `MONGO_URI`：

1. 前往 https://www.mongodb.com/cloud/atlas，註冊並登入。
2. 建立免費 Cluster（選擇 Shared / M0 tier）。
3. 在左側選單選 "Database Access" → 新增一個使用者（設定使用者名稱與密碼）。
4. 在 "Network Access" 新增允許的 IP，測試時可以使用 `0.0.0.0/0`（僅測試用途）。
5. 回到 Clusters，按 "Connect" → 選 "Connect your application"，複製提供的連線字串。

範例連線字串：

```
mongodb+srv://<username>:<password>@cluster0.<id>.mongodb.net/<dbname>?retryWrites=true&w=majority
```

使用時請：
- 把 `<username>` 與 `<password>` 換成步驟 3 建立的使用者帳密。
- 把 `<dbname>` 換成你要使用的資料庫名稱（例如 `sonydb`）。

把完整字串放到 Render 的環境變數 `MONGO_URI`（或本機 `.env` 的 `MONGO_URI`）。切勿把 `.env` 推上 GitHub。

安全性建議：
- 不要在生產環境使用 `0.0.0.0/0`，應限制至可信 IP。
- 使用強密碼並妥善管理 `SESSION_SECRET`。
