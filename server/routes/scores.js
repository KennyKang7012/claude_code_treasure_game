const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/scores — 儲存本局分數（需登入）
router.post('/', authenticateToken, (req, res) => {
  const { score, outcome, boxes_opened } = req.body;

  if (typeof score !== 'number') {
    return res.status(400).json({ error: 'score 必須為數字' });
  }
  if (!['win', 'tie', 'loss'].includes(outcome)) {
    return res.status(400).json({ error: 'outcome 必須為 win、tie 或 loss' });
  }
  if (![1, 2, 3].includes(boxes_opened)) {
    return res.status(400).json({ error: 'boxes_opened 必須為 1、2 或 3' });
  }

  try {
    const stmt = db.prepare(
      'INSERT INTO scores (user_id, score, outcome, boxes_opened) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(req.user.id, score, outcome, boxes_opened);

    const saved = db
      .prepare('SELECT id, score, outcome, boxes_opened, created_at FROM scores WHERE id = ?')
      .get(result.lastInsertRowid);

    return res.status(201).json(saved);
  } catch (err) {
    console.error('Save score error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

// GET /api/scores/me — 取得個人最近 20 筆記錄（需登入）
router.get('/me', authenticateToken, (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, score, outcome, boxes_opened, created_at
         FROM scores
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .all(req.user.id);

    return res.json(rows);
  } catch (err) {
    console.error('Get scores error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

// GET /api/scores/leaderboard — 排行榜（不需登入）
router.get('/leaderboard', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  try {
    const rows = db
      .prepare(
        `SELECT u.username, MAX(s.score) AS best_score, COUNT(*) AS games_played
         FROM scores s
         JOIN users u ON s.user_id = u.id
         GROUP BY s.user_id
         ORDER BY best_score DESC
         LIMIT ?`
      )
      .all(limit);

    return res.json(rows);
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

module.exports = router;
