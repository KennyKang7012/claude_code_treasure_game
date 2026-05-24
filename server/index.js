require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const scoresRoutes = require('./routes/scores');

const app = express();
const PORT = process.env.PORT || 3001;

// 中介層 — 在 Vercel 上前後端同域，CORS 不需嚴格限制
const allowedOrigin = process.env.CORS_ORIGIN || (process.env.VERCEL === '1' ? '*' : 'http://localhost:3000');
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/scores', scoresRoutes);

// 健康檢查
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 只有在非 Vercel 環境才自行 listen（Vercel 會直接呼叫 module.exports）
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🗄️  後端伺服器已啟動：http://localhost:${PORT}`);
  });
}

module.exports = app;
