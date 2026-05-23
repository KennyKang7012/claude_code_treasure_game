require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const scoresRoutes = require('./routes/scores');

const app = express();
const PORT = process.env.PORT || 3001;

// 中介層
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/scores', scoresRoutes);

// 健康檢查
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🗄️  後端伺服器已啟動：http://localhost:${PORT}`);
});
