require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { logger } = require('./lib/logger');
const { initSupabase } = require('./lib/supabase');
const { setupCronJobs } = require('./lib/cron');
const { bootstrapPlatform } = require('./lib/bootstrap');
const { crawlerMiddleware } = require('./middleware/crawler');

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const tenantRoutes = require('./routes/tenant');
const customerRoutes = require('./routes/customer');
const routerRoutes = require('./routes/routers');
const packageRoutes = require('./routes/packages');
const paymentRoutes = require('./routes/payments');
const shopRoutes = require('./routes/shop');
const portalRoutes = require('./routes/portal');
const analyticsRoutes = require('./routes/analytics');
const loyaltyRoutes = require('./routes/loyalty');
const notificationRoutes = require('./routes/notifications');
const platformRoutes = require('./routes/platform');
const jobsRoutes = require('./routes/jobs');
const billingRoutes = require('./routes/billing');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time dashboard
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to routes
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Raw body for webhook signature verification
app.use('/api/payments/mpesa/callback', express.raw({ type: '*/*' }));
app.use('/api/payments/paystack/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Social Media Crawler Middleware
app.use(crawlerMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth/', authLimiter);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tenant/billing', billingRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/routers', routerRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/jobs', jobsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Socket.io ────────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join:admin', () => socket.join('admin-room'));
  socket.on('join:tenant', (tenantId) => socket.join(`tenant-${tenantId}`));

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await initSupabase();
    await bootstrapPlatform();
    setupCronJobs();
    server.listen(PORT, () => {
      logger.info(`🚀 FlowFi backend running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
