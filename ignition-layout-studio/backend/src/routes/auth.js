const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateTokenPair, authenticate, authorize, refreshToken } = require('../middleware/auth');
const logger = require('../services/loggerService');
const errorService = require('../services/errorService');
const crypto = require('crypto');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation middleware
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
];

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const validatePasswordReset = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
];

// Register new user
router.post('/register', authLimiter, validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        errorService.formatErrorResponse(
          errorService.createError('VALIDATION_ERROR', 'Validation failed', null, { errors: errors.array() }),
          req.id
        )
      );
    }

    const { username, email, password, firstName, lastName, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json(
        errorService.formatErrorResponse(
          errorService.createError('CONFLICT', 'User already exists with this email or username'),
          req.id
        )
      );
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role || 'user', // Default to 'user' role
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    });

    // Generate tokens
    const tokens = generateTokenPair(user.id);

    logger.info('User registered successfully', { userId: user.id, username, email });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    logger.error('Registration failed', { error: error.message, stack: error.stack });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Login user
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        errorService.formatErrorResponse(
          errorService.createError('VALIDATION_ERROR', 'Validation failed', null, { errors: errors.array() }),
          req.id
        )
      );
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Invalid credentials'),
          req.id
        )
      );
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Account is temporarily locked due to too many failed login attempts'),
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

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      await user.incrementLoginAttempts();
      
      logger.warn('Invalid login attempt', { userId: user.id, email, ip: req.ip });
      
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Invalid credentials'),
          req.id
        )
      );
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    
    // Update last login
    await user.update({ lastLogin: new Date() });

    // Generate tokens
    const tokens = generateTokenPair(user.id);

    logger.info('User logged in successfully', { userId: user.id, email });

    res.json({
      success: true,
      message: 'Login successful',
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });

  } catch (error) {
    logger.error('Login failed', { error: error.message, stack: error.stack });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Refresh token
router.post('/refresh', refreshToken);

// Logout user
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a production app, you might want to blacklist the token
    // For now, we'll just log the logout
    logger.info('User logged out', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        emailVerified: req.user.emailVerified,
        lastLogin: req.user.lastLogin,
        preferences: req.user.preferences,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Profile fetch failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Update user profile
router.put('/profile', authenticate, [
  body('firstName').optional().isLength({ min: 1, max: 50 }),
  body('lastName').optional().isLength({ min: 1, max: 50 }),
  body('preferences').optional().isObject(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        errorService.formatErrorResponse(
          errorService.createError('VALIDATION_ERROR', 'Validation failed', null, { errors: errors.array() }),
          req.id
        )
      );
    }

    const { firstName, lastName, preferences } = req.body;
    
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (preferences !== undefined) updates.preferences = preferences;

    await req.user.update(updates);

    logger.info('User profile updated', { userId: req.user.id, updates: Object.keys(updates) });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        preferences: req.user.preferences,
        updatedAt: req.user.updatedAt
      }
    });

  } catch (error) {
    logger.error('Profile update failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Change password
router.post('/change-password', authenticate, validatePasswordChange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        errorService.formatErrorResponse(
          errorService.createError('VALIDATION_ERROR', 'Validation failed', null, { errors: errors.array() }),
          req.id
        )
      );
    }

    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const isValidPassword = await req.user.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(401).json(
        errorService.formatErrorResponse(
          errorService.createError('UNAUTHORIZED', 'Current password is incorrect'),
          req.id
        )
      );
    }

    // Update password
    await req.user.update({ password: newPassword });

    logger.info('Password changed successfully', { userId: req.user.id });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Admin routes
// Get all users (admin only)
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (search) {
      where[require('sequelize').Op.or] = [
        { username: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { email: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { firstName: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { lastName: { [require('sequelize').Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Users fetch failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Update user role (admin only)
router.put('/users/:userId/role', authenticate, authorize('admin'), [
  body('role').isIn(['admin', 'manager', 'user', 'viewer']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        errorService.formatErrorResponse(
          errorService.createError('VALIDATION_ERROR', 'Validation failed', null, { errors: errors.array() }),
          req.id
        )
      );
    }

    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json(
        errorService.formatErrorResponse(
          errorService.createError('NOT_FOUND', 'User not found'),
          req.id
        )
      );
    }

    await user.update({ role });

    logger.info('User role updated', { userId, newRole: role, updatedBy: req.user.id });

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('User role update failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

// Deactivate user (admin only)
router.put('/users/:userId/deactivate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json(
        errorService.formatErrorResponse(
          errorService.createError('NOT_FOUND', 'User not found'),
          req.id
        )
      );
    }

    await user.update({ isActive: false });

    logger.info('User deactivated', { userId, deactivatedBy: req.user.id });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    logger.error('User deactivation failed', { error: error.message });
    
    return res.status(500).json(
      errorService.formatErrorResponse(error, req.id)
    );
  }
});

module.exports = router; 