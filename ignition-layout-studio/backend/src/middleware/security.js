const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');
const logger = require('../services/loggerService');

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// ---- Dynamic rate-limit configuration ----
let rateLimitConfig = {
  api: { windowMs: parseInt(process.env.API_RATE_WINDOW_MS || '900000'), max: parseInt(process.env.API_RATE_MAX || '1000') },
  auth: { windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS || '900000'), max: parseInt(process.env.AUTH_RATE_MAX || '50') },
  upload: { windowMs: parseInt(process.env.UPLOAD_RATE_WINDOW_MS || '60000'), max: parseInt(process.env.UPLOAD_RATE_MAX || '100') }
};

const createDynamicLimiter = (key, message) => rateLimit({
  windowMs: () => rateLimitConfig[key].windowMs,
  max: () => rateLimitConfig[key].max,
  message: { error: message, code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req,res) => {
    logger.warn('Rate limit exceeded', { ip:req.ip, userAgent:req.get('User-Agent'), endpoint:req.originalUrl });
    res.status(429).json({ error: message, code: 'RATE_LIMIT_EXCEEDED', retryAfter: Math.ceil(rateLimitConfig[key].windowMs/1000) });
  }
});

// Replace static limiters with dynamic ones
const apiRateLimit = createDynamicLimiter('api','Too many API requests');
const authRateLimit = createDynamicLimiter('auth','Too many authentication attempts');
const uploadRateLimit = createDynamicLimiter('upload','Too many upload requests');

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const errors = [];

    // Validate based on schema
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (!value || value.trim() === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value) {
        // String validation
        if (rules.type === 'string') {
          if (typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          } else {
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${field} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be at most ${rules.maxLength} characters`);
            }
            if (rules.pattern && !rules.pattern.test(value)) {
              errors.push(`${field} format is invalid`);
            }
          }
        }

        // Email validation
        if (rules.type === 'email') {
          if (!validator.isEmail(value)) {
            errors.push(`${field} must be a valid email`);
          }
        }

        // URL validation
        if (rules.type === 'url') {
          if (!validator.isURL(value)) {
            errors.push(`${field} must be a valid URL`);
          }
        }

        // Number validation
        if (rules.type === 'number') {
          if (isNaN(value)) {
            errors.push(`${field} must be a number`);
          } else {
            const num = Number(value);
            if (rules.min !== undefined && num < rules.min) {
              errors.push(`${field} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && num > rules.max) {
              errors.push(`${field} must be at most ${rules.max}`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Remove dangerous characters
      return validator.escape(value.trim());
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize body
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }

  next();
};

// Suspicious activity detection
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script|javascript:|vbscript:|onload=|onerror=)/i,
    /(union\s+select|drop\s+table|insert\s+into|delete\s+from)/i,
    /(\.\.\/|\.\.\\|\/etc\/passwd|\/proc\/)/i,
    /(eval\s*\(|exec\s*\(|system\s*\()/i
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const suspicious = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (suspicious) {
    logger.error('Suspicious activity detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query
    });

    return res.status(400).json({
      error: 'Invalid input detected',
      code: 'SUSPICIOUS_ACTIVITY'
    });
  }

  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      logger.warn('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

// Helper accessors for admin route
const getRateLimitConfig = () => JSON.parse(JSON.stringify(rateLimitConfig));
const updateRateLimitConfig = (updates = {}) => {
  ['api','auth','upload'].forEach(k=>{
    if(updates[k]){
      if(updates[k].windowMs!==undefined) rateLimitConfig[k].windowMs = parseInt(updates[k].windowMs);
      if(updates[k].max!==undefined) rateLimitConfig[k].max = parseInt(updates[k].max);
    }
  });
};

module.exports = {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  speedLimiter,
  validateInput,
  sanitizeInput,
  detectSuspiciousActivity,
  requestLogger,
  getRateLimitConfig,
  updateRateLimitConfig
};
