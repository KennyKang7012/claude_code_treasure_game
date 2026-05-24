const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Vercel serverless 只有 /tmp 可寫；本地開發使用專案根目錄
const dbPath = process.env.VERCEL === '1'
  ? '/tmp/game.db'
  : path.resolve(process.env.DATABASE_PATH || './game.db');
const db = new Database(dbPath);

// 啟用外鍵約束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建立資料表（冪等）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scores (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score        INTEGER NOT NULL,
    outcome      TEXT    NOT NULL CHECK(outcome IN ('win','tie','loss')),
    boxes_opened INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
  CREATE INDEX IF NOT EXISTS idx_scores_score   ON scores(score DESC);
`);

module.exports = db;
