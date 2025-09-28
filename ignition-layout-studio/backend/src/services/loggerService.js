const fs = require('fs');
const path = require('path');
const util = require('util');

class LoggerService {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logLevels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();

    // Create log files
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.combinedLogFile = path.join(this.logDir, 'combined.log');
    this.accessLogFile = path.join(this.logDir, 'access.log');

    // Initialize log rotation
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;

    this.initializeLogRotation();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  initializeLogRotation() {
    // Check log files size periodically
    setInterval(() => {
      this.rotateLogsIfNeeded();
    }, 60000); // Check every minute
  }

  rotateLogsIfNeeded() {
    const logFiles = [this.errorLogFile, this.combinedLogFile, this.accessLogFile];

    logFiles.forEach(logFile => {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.maxLogSize) {
          this.rotateLog(logFile);
        }
      }
    });
  }

  rotateLog(logFile) {
    try {
      // Move existing log files
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldFile = `${logFile}.${i}`;
        const newFile = `${logFile}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log to .1
      if (fs.existsSync(logFile)) {
        fs.renameSync(logFile, `${logFile}.1`);
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      message: typeof message === 'string' ? message : util.inspect(message),
      ...meta
    };

    // Add stack trace for errors
    if (level === 'error' && meta.error instanceof Error) {
      logEntry.stack = meta.error.stack;
      logEntry.errorMessage = meta.error.message;
    }

    return JSON.stringify(logEntry);
  }

  writeToFile(logEntry) {
    try {
      fs.appendFileSync(this.combinedLogFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...this.sanitizeMeta(meta),
      ...(this.requestId && { requestId: this.requestId })
    };

    // Write to file
    this.writeToFile(logEntry);

    // Console output (in development and test environments)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      const consoleMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      
      if (level === 'error') {
        console.error(consoleMessage, this.sanitizeMeta(meta));
      } else if (level === 'warn') {
        console.warn(consoleMessage, this.sanitizeMeta(meta));
      } else {
        console.log(consoleMessage, this.sanitizeMeta(meta));
      }
    }
  }

  // Specialized logging methods for tests
  logApiRequest(method, endpoint, statusCode, duration) {
    this.info(`API Request: ${method} ${endpoint}`, {
      method,
      endpoint,
      statusCode,
      duration: `${duration}ms`
    });
  }

  logFileOperation(operation, filename, userId) {
    this.info(`File Operation: ${operation}`, {
      operation,
      filename,
      userId
    });
  }

  logAiProcessing(type, status, sessionId) {
    this.info(`AI Processing: ${type}`, {
      type,
      status,
      sessionId
    });
  }

  logSecurityEvent(event, ip, details = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      ip,
      ...details
    });
  }

  // Sanitize metadata to remove sensitive information
  sanitizeMeta(meta) {
    if (!meta || typeof meta !== 'object') return meta;
    
    const sanitized = { ...meta };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  trace(message, meta = {}) {
    this.log('trace', message, meta);
  }

  // HTTP access logging
  logAccess(req, res, responseTime) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length') || 0
    };

    const message = JSON.stringify(logEntry);
    this.writeToFile(message);
  }

  // Database operation logging
  logDatabase(operation, table, duration, error = null) {
    const meta = {
      operation,
      table,
      duration: `${duration}ms`,
      error: error ? error.message : null
    };

    if (error) {
      this.error(`Database operation failed: ${operation} on ${table}`, meta);
    } else {
      this.debug(`Database operation: ${operation} on ${table}`, meta);
    }
  }

  // API operation logging
  logAPI(endpoint, method, statusCode, duration, error = null) {
    const meta = {
      endpoint,
      method,
      statusCode,
      duration: `${duration}ms`,
      error: error ? error.message : null
    };

    if (error) {
      this.error(`API operation failed: ${method} ${endpoint}`, meta);
    } else {
      this.info(`API operation: ${method} ${endpoint}`, meta);
    }
  }

  // File operation logging
  logFile(operation, filename, size = null, error = null) {
    const meta = {
      operation,
      filename,
      size: size ? `${size} bytes` : null,
      error: error ? error.message : null
    };

    if (error) {
      this.error(`File operation failed: ${operation} on ${filename}`, meta);
    } else {
      this.info(`File operation: ${operation} on ${filename}`, meta);
    }
  }

  // OCR operation logging
  logOCR(fileId, provider, duration, componentsFound = 0, error = null) {
    const meta = {
      fileId,
      provider,
      duration: `${duration}ms`,
      componentsFound,
      error: error ? error.message : null
    };

    if (error) {
      this.error(`OCR processing failed for file ${fileId}`, meta);
    } else {
      this.info(`OCR processing completed for file ${fileId}`, meta);
    }
  }

  // AI operation logging
  logAI(provider, operation, tokens = null, cost = null, error = null) {
    const meta = {
      provider,
      operation,
      tokens,
      cost,
      error: error ? error.message : null
    };

    if (error) {
      this.error(`AI operation failed: ${operation} with ${provider}`, meta);
    } else {
      this.info(`AI operation: ${operation} with ${provider}`, meta);
    }
  }

  // Security event logging
  logSecurity(event, ip, userAgent, details = {}) {
    const meta = {
      event,
      ip,
      userAgent,
      ...details
    };

    this.warn(`Security event: ${event}`, meta);
  }

  // Performance logging
  logPerformance(operation, duration, details = {}) {
    const meta = {
      operation,
      duration: `${duration}ms`,
      ...details
    };

    if (duration > 5000) {
      // Log slow operations
      this.warn(`Slow operation detected: ${operation}`, meta);
    } else {
      this.debug(`Performance: ${operation}`, meta);
    }
  }

  // Memory usage logging
  logMemoryUsage() {
    const memUsage = process.memoryUsage();
    const meta = {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    };

    this.debug('Memory usage', meta);
  }

  // Get log statistics
  getLogStats() {
    const stats = {
      errorLogSize: 0,
      combinedLogSize: 0,
      accessLogSize: 0,
      logLevel: this.logLevel,
      logDirectory: this.logDir
    };

    try {
      if (fs.existsSync(this.errorLogFile)) {
        stats.errorLogSize = fs.statSync(this.errorLogFile).size;
      }
      if (fs.existsSync(this.combinedLogFile)) {
        stats.combinedLogSize = fs.statSync(this.combinedLogFile).size;
      }
      if (fs.existsSync(this.accessLogFile)) {
        stats.accessLogSize = fs.statSync(this.accessLogFile).size;
      }
    } catch (error) {
      this.error('Failed to get log stats', { error });
    }

    return stats;
  }

  // Clear all logs
  clearLogs() {
    try {
      const logFiles = [this.errorLogFile, this.combinedLogFile, this.accessLogFile];

      logFiles.forEach(logFile => {
        if (fs.existsSync(logFile)) {
          fs.unlinkSync(logFile);
        }

        // Remove rotated files
        for (let i = 1; i <= this.maxLogFiles; i++) {
          const rotatedFile = `${logFile}.${i}`;
          if (fs.existsSync(rotatedFile)) {
            fs.unlinkSync(rotatedFile);
          }
        }
      });

      this.info('All log files cleared');
    } catch (error) {
      this.error('Failed to clear logs', { error });
    }
  }
}

// Export singleton instance
module.exports = new LoggerService();
