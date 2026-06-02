require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const transactionsRoutes = require('./routes/transactions');
const analyticsRoutes = require('./routes/analytics');
const budgetRoutes = require('./routes/budget');
const predictRoutes = require('./routes/predict');
const chatRoutes = require('./routes/chat');

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Spendigo API',
    version: '1.0.0',
    docs: '/docs',
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/budget', budgetRoutes);
app.use('/predict', predictRoutes);
app.use('/chat', chatRoutes);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ detail: 'Endpoint tidak ditemukan' });
});

// Start server
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║   🚀 Spendigo API Server                      ║
║                                               ║
║   Running on: http://localhost:${PORT}          ║
║   Environment: ${process.env.NODE_ENV || 'development'}                  ║
║                                               ║
╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
