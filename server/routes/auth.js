const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');

const router = express.Router();
const SALT_ROUNDS = 12;

// 使用者名稱驗證：3–20 個英數字元
function isValidUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9]{3,20}$/.test(username);
}

// 密碼驗證：至少 6 個字元
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: '使用者名稱需為 3–20 個英數字元' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: '密碼至少需要 6 個字元' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, passwordHash);

    const user = { id: result.lastInsertRowid, username };
    const token = signToken(user);

    return res.status(201).json({ token, user });
  } catch (err) {
    // SQLite UNIQUE constraint violated
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE'))) {
      return res.status(409).json({ error: '此使用者名稱已被使用' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: '使用者名稱需為 3–20 個英數字元' });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: '密碼至少需要 6 個字元' });
  }

  try {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!row) {
      return res.status(401).json({ error: '使用者名稱或密碼錯誤' });
    }

    const match = await bcrypt.compare(password, row.password);
    if (!match) {
      return res.status(401).json({ error: '使用者名稱或密碼錯誤' });
    }

    const user = { id: row.id, username: row.username };
    const token = signToken(user);

    return res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
});

module.exports = router;
