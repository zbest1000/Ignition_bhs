require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Import services
const logger = require('./services/loggerService');
const configService = require('./services/configService');
const { sequelize, testConnection } = require('./config/database');

// Import middleware
const { 
  securityHeaders, 
  apiRateLimit, 
  authRateLimit, 
  uploadRateLimit,
  requestLogger,
  sanitizeInput,
  detectSuspiciousActivity
} = require('./middleware/security');

// Import routes
const projectRoutes = require('./routes/project');
const componentRoutes = require('./routes/component');
const templateRoutes = require('./routes/template');
const uploadRoutes = require('./routes/upload');
const exportRoutes = require('./routes/export');
const ocrRoutes = require('./routes/ocr');
const aiRoutes = require('./routes/ai');
const pipelineRoutes = require('./routes/pipeline');
const codeInterpreterRoutes = require('./routes/codeInterpreter');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Get configuration
const config = configService.getServerConfig();

// Initialize database
const initDatabase = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      logger.error('Database connection failed');
      process.exit(1);
    }
    
    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }
  } catch (error) {
    logger.error('Unable to initialize database', { error: error.message });
    process.exit(1);
  }
};

// Security middleware
app.use(securityHeaders);
app.use(requestLogger);
app.use(sanitizeInput);
app.use(detectSuspiciousActivity);

// CORS configuration
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO setup (before routes so they can access it)
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Make io available to routes
app.set('io', io);

// Socket connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('join-project', (projectId) => {
    socket.join(projectId);
    logger.debug('Socket joined project', { socketId: socket.id, projectId });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Apply rate limiting
app.use('/api/auth', authRateLimit);
app.use('/api/upload', uploadRateLimit);
app.use('/api', apiRateLimit);

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/code-interpreter', codeInterpreterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log the error with context
  logger.error('Unhandled error', { 
    errorId,
    error: err.message, 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred. Please try again later.';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'The provided data is invalid. Please check your input and try again.';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_DATA_FORMAT';
    message = 'Invalid data format provided. Please check your input.';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    errorCode = 'FILE_NOT_FOUND';
    message = 'The requested file or resource was not found.';
  } else if (err.code === 'EACCES') {
    statusCode = 403;
    errorCode = 'ACCESS_DENIED';
    message = 'Access denied. Please check your permissions.';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds the maximum allowed limit.';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    errorCode = 'TOO_MANY_FILES';
    message = 'Too many files uploaded. Please reduce the number of files.';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    errorCode = 'UNEXPECTED_FILE_FIELD';
    message = 'Unexpected file field. Please check your upload format.';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'UPLOAD_ERROR';
    message = 'File upload error. Please check your files and try again.';
  } else if (err.code === 'EISDIR') {
    statusCode = 400;
    errorCode = 'INVALID_FILE_TYPE';
    message = 'Invalid file type. Directories are not allowed.';
  } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
    statusCode = 503;
    errorCode = 'RESOURCE_EXHAUSTED';
    message = 'Server is temporarily unable to handle the request. Please try again later.';
  } else if (err.code === 'ENOSPC') {
    statusCode = 507;
    errorCode = 'INSUFFICIENT_STORAGE';
    message = 'Insufficient storage space. Please contact support.';
  } else if (err.message && err.message.includes('timeout')) {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    message = 'Request timeout. Please try again with a smaller file or check your connection.';
  } else if (err.message && err.message.includes('network')) {
    statusCode = 503;
    errorCode = 'NETWORK_ERROR';
    message = 'Network error occurred. Please check your connection and try again.';
  }

  // Response object
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      errorId: errorId,
      timestamp: new Date().toISOString()
    }
  };

  // Add debug information in development
  if (process.env.NODE_ENV === 'development') {
    response.error.debug = {
      originalMessage: err.message,
      stack: err.stack,
      details: {
        name: err.name,
        code: err.code,
        path: err.path,
        value: err.value
      }
    };
  } else {
    // In production, provide a helpful tip
    response.error.tip = 'If this error persists, please contact support with the error ID.';
  }

  res.status(statusCode).json(response);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal, callback) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');

    // Close DB connection
    sequelize.close().then(() => {
      logger.info('Database connection closed');
      if (typeof callback === 'function') callback();
      else process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle nodemon restart signal to avoid EADDRINUSE
process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2', () => process.kill(process.pid, 'SIGUSR2')));

// Start server
const startServer = async () => {
  try {
    // Skip database initialization for now to get the server running
    logger.info('Skipping database initialization for development');
    
    server.listen(config.port, config.host, () => {
      logger.info(`Server running on ${config.host}:${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
        host: config.host
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };