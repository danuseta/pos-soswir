require("dotenv").config();

const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const { pool, query } = require("./models/db");

const activityCleanup = require("./utils/activityCleanup");
const dailyStockScheduler = require("./utils/dailyStockScheduler");
const { authenticateToken, authorizeRole } = require("./middleware/authMiddleware");
const { logApiRequests } = require("./middleware/loggerMiddleware");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const productsRoutes = require("./routes/products");
const categoriesRoutes = require("./routes/categories");
const salesRoutes = require("./routes/sales");
const settingsRoutes = require("./routes/settings");
const dashboardRoutes = require("./routes/dashboard");
const transactionsRoutes = require("./routes/transactions");
const suppliersRoutes = require("./routes/suppliers");
const dailyStockRoutes = require("./routes/dailyStock");
const activityCleanupRoutes = require("./routes/activity-cleanup");
const shiftsRoutes = require("./routes/shifts");

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const isStaging = process.env.NODE_ENV === 'staging';

if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY));
}

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads"), { fallthrough: false, maxAge: "7d" }));

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const frontendUrlWithProtocol = frontendUrl.startsWith('http') ? frontendUrl : `http://${frontendUrl}`;

app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      frontendUrlWithProtocol,
      'http://localhost:4173',
      'https://soswir-pos.vercel.app',
      'https://pos.soswir.com'
    ];
    
    console.log(`CORS check - Origin: ${origin}, Allowed origins:`, allowedOrigins);
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || !isProduction) {
      console.log(`CORS: Allowing origin ${origin}`);
      callback(null, true);
    } else {
      console.log(`CORS: Blocking origin ${origin}`);
      callback(new Error('CORS Policy: Origin not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: isProduction ? 6 : 1,
  threshold: 1024,
  memLevel: 8
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 1000 : 5000,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || req.path === '/';
  }
});

app.use('/api/', limiter);

app.use(express.json({ 
  limit: isProduction ? '10mb' : '50mb',
  verify: (req, res, buf, encoding) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      req.rawBody = buf;
      return false;
    }
    return true;
  }
}));

app.use(express.urlencoded({ 
  limit: isProduction ? '10mb' : '50mb', 
  extended: true,
  parameterLimit: 1000
}));

app.use(logApiRequests);

app.use((req, res, next) => {
  res.set({
    'X-Powered-By': 'Soswir POS',
    'X-Response-Time': Date.now(),
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    const [result] = await query("SELECT 1 AS healthy");

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      database: result.healthy === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV,
      version: require('./package.json').version,
      processId: process.pid,
      configuration: {
        frontendUrl: frontendUrlWithProtocol,
        cleanupEnabled: activityCleanup.status().isRunning
      }
    };
    
    res.status(200).json(healthData);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      environment: process.env.NODE_ENV
    });
  }
});

app.get('/metrics', authenticateToken, (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid,
    environment: process.env.NODE_ENV
  };
  res.json(metrics);
});

const initializeDatabase = async () => {
  try {
    await query("SELECT 1");
    const [{ t }] = await query("SELECT to_regclass('public.users') AS t");
    if (t === null) {
      console.error("❌ Skema belum dipasang. Jalankan: npm run db:init");
      process.exit(1);
    }
    console.log("✅ Database connection established successfully");

    if (process.env.CLEANUP_ENABLED !== 'false') {
      console.log("🚀 Initializing Activity Cleanup System...");
      await activityCleanup.initialize();
    }

  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    process.exit(1);
  }
};

initializeDatabase();

console.log("🚀 Server Configuration:");
console.log(`   - Port: ${port}`);
console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   - Frontend URL: ${frontendUrlWithProtocol}`);

app.get("/", (req, res) => {
  res.json({
    message: "🚀 Soswir POS Backend is running!",
    version: require('./package.json').version,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/daily-stock", dailyStockRoutes);
app.use("/api/activity-cleanup", activityCleanupRoutes);
app.use("/api/shifts", shiftsRoutes);

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /metrics',
      'POST /api/auth/login',
      'GET /api/products',
      'GET /api/dashboard'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('🚨 Global Error Handler:', {
    error: error.message,
    stack: isProduction ? undefined : error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(error.status || 500).json({
    error: isProduction ? 'Internal Server Error' : error.message,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: error.stack })
  });
});

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  const cleanup = async () => {
    try {
      if (activityCleanup && activityCleanup.destroy) {
        await activityCleanup.destroy();
        console.log('✅ Activity cleanup stopped');
      }

      dailyStockScheduler.stopScheduler();
      console.log('✅ Daily stock scheduler stopped');
      
      if (pool && pool.end) {
        await pool.end();
        console.log('✅ Database connections closed');
      }
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  setTimeout(() => {
    console.log('⏰ Force shutdown after 10 seconds timeout');
    process.exit(1);
  }, 10000);
  
  cleanup();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  if (!isProduction) {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

const server = app.listen(port, () => {
  dailyStockScheduler.setupScheduler();

  console.log(`
🚀 ===== SOSWIR POS BACKEND STARTED =====
📅 Timestamp: ${new Date().toISOString()}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🚪 Port: ${port}
🔗 URL: http://localhost:${port}
💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
🆔 Process ID: ${process.pid}
📦 Node Version: ${process.version}
⚡ Ready to handle requests!
========================================
  `);
  
  if (process.send && typeof process.send === 'function') {
    process.send('ready');
  }
});

server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;
