const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../services/loggerService');
const errorService = require('../services/errorService');

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  return 'development-jwt-secret-min-32-chars-long';
})();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET must be set in production environment');
  }
  return 'development-refresh-secret-min-32-chars-long';
})();

const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Validate JWT secrets length
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (JWT_REFRESH_SECRET.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

// Generate JWT token
const generateToken = (userId, type = 'access') => {
  const secret = type === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
  const expiresIn = type === 'refresh' ? JWT_REFRESH_EXPIRES_IN : JWT_EXPIRES_IN;
  
  return jwt.sign({ userId, type }, secret, { expiresIn });
};

// Generate token pair
const generateTokenPair = (userId) => {
  return {
    accessToken: generateToken(userId, 'access'),
    refreshToken: generateToken(userId, 'refresh')
  };
};

// Verify JWT token
const verifyToken = (token, type = 'access') => {
  try {
    const secret = type === 'refresh' ? JWT_REFRESH_SECRET : JWT_SECRET;
    const decoded = jwt.verify(token, secret);
    
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'No token provided'),
          req.id
        )
      );
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token, 'access');
    
    // Find user
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'User not found'),
          req.id
        )
      );
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Account is deactivated'),
          req.id
        )
      );
    }
    
    // Check if account is locked
    if (user.isLocked()) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Account is locked'),
          req.id
        )
      );
    }
    
    // Add user to request
    req.user = user;
    req.token = token;
    
    logger.debug('User authenticated', { userId: user.id, username: user.username });
    next();
    
  } catch (error) {
    logger.warn('Authentication failed', { error: error.message, ip: req.ip });
    
    return res.status(401).json(
      errorService.formatErrorResponse(
        errorService.createError('UNAUTHORIZED', 'Invalid token'),
        req.id
      )
    );
  }
};

// Optional authentication (for public endpoints with optional user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token provided, continue without user
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token, 'access');
    
    const user = await User.findByPk(decoded.userId);
    if (user && user.isActive && !user.isLocked()) {
      req.user = user;
      req.token = token;
    }
    
    next();
    
  } catch (error) {
    // Invalid token, but continue without user
    next();
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Authentication required'),
          req.id
        )
      );
    }
    
    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', { 
        userId: req.user.id, 
        userRole: req.user.role, 
        requiredRoles: roles 
      });
      
      return res.status(403).json(
        errorService.formatErrorResponse(
          errorService.createError('FORBIDDEN', 'Insufficient permissions'),
          req.id
        )
      );
    }
    
    next();
  };
};

// Permission-based authorization middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Authentication required'),
          req.id
        )
      );
    }
    
    if (!req.user.hasPermission(permission)) {
      logger.warn('Permission denied', { 
        userId: req.user.id, 
        userRole: req.user.role, 
        requiredPermission: permission 
      });
      
      return res.status(403).json(
        errorService.formatErrorResponse(
          errorService.createError('FORBIDDEN', `Permission '${permission}' required`),
          req.id
        )
      );
    }
    
    next();
  };
};

// Project access middleware
const requireProjectAccess = (accessType = 'read') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(
          errorService.formatErrorResponse(
            errorService.createError('UNAUTHORIZED', 'Authentication required'),
            req.id
          )
        );
      }
      
      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        return res.status(400).json(
          errorService.formatErrorResponse(
            errorService.createError('VALIDATION_ERROR', 'Project ID required'),
            req.id
          )
        );
      }
      
      const ProjectDB = require('../models/ProjectDB');
      const project = await ProjectDB.findByPk(projectId);
      
      if (!project) {
        return res.status(404).json(
          errorService.formatErrorResponse(
            errorService.createError('NOT_FOUND', 'Project not found'),
            req.id
          )
        );
      }
      
      // Check access based on type
      let hasAccess = false;
      if (accessType === 'read') {
        hasAccess = project.canUserAccess(req.user);
      } else if (accessType === 'write') {
        hasAccess = project.canUserEdit(req.user);
      }
      
      if (!hasAccess) {
        logger.warn('Project access denied', { 
          userId: req.user.id, 
          projectId, 
          accessType 
        });
        
        return res.status(403).json(
          errorService.formatErrorResponse(
            errorService.createError('FORBIDDEN', 'Project access denied'),
            req.id
          )
        );
      }
      
      req.project = project;
      next();
      
    } catch (error) {
      logger.error('Project access check failed', { error: error.message });
      
      return res.status(500).json(
        errorService.formatErrorResponse(error, req.id)
      );
    }
  };
};

// Rate limiting by user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    }
    
    const userRequests = requests.get(userId) || [];
    
    if (userRequests.length >= maxRequests) {
      logger.warn('User rate limit exceeded', { userId, requestCount: userRequests.length });
      
      return res.status(429).json(
        errorService.formatErrorResponse(
          errorService.createError('RATE_LIMIT_EXCEEDED', 'Too many requests'),
          req.id
        )
      );
    }
    
    userRequests.push(now);
    requests.set(userId, userRequests);
    
    next();
  };
};

// Refresh token middleware
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Refresh token required'),
          req.id
        )
      );
    }
    
    const decoded = verifyToken(refreshToken, 'refresh');
    
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive || user.isLocked()) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Invalid refresh token'),
          req.id
        )
      );
    }
    
    // Generate new token pair
    const tokens = generateTokenPair(user.id);
    
    res.json({
      success: true,
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
    
  } catch (error) {
    logger.warn('Token refresh failed', { error: error.message });
    
    return res.status(401).json(
      errorService.formatErrorResponse(
        errorService.createError('UNAUTHORIZED', 'Invalid refresh token'),
        req.id
      )
    );
  }
};

module.exports = {
  generateToken,
  generateTokenPair,
  verifyToken,
  authenticate,
  optionalAuth,
  authorize,
  requirePermission,
  requireProjectAccess,
  userRateLimit,
  refreshToken
}; 