const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../services/loggerService');
const errorService = require('../services/errorService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const router = express.Router();

// Validation middleware
const validateUser = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('role').optional().isIn(['admin', 'manager', 'user', 'viewer'])
];

const validateUserUpdate = [
  body('email').optional().isEmail().normalizeEmail(),
  body('username').optional().isLength({ min: 3, max: 50 }).trim(),
  body('role').optional().isIn(['admin', 'manager', 'user', 'viewer'])
];

// Get all users (admin only)
router.get('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (role) {
      where.role = role;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to fetch users'));
  }
});

// Get user by ID
router.get('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json(errorService.createError('USER_NOT_FOUND', 'User not found'));
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user', { error: error.message, userId: req.params.id });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to fetch user'));
  }
});

// Update user
router.put('/:id', authenticate, authorize(['admin']), validateUserUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(errorService.createError('VALIDATION_ERROR', 'Validation failed', errors.array()));
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json(errorService.createError('USER_NOT_FOUND', 'User not found'));
    }

    const { email, username, role, isActive } = req.body;

    // Check if email or username already exists (for other users)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json(errorService.createError('EMAIL_EXISTS', 'Email already exists'));
      }
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json(errorService.createError('USERNAME_EXISTS', 'Username already exists'));
      }
    }

    await user.update({
      email: email || user.email,
      username: username || user.username,
      role: role || user.role,
      isActive: isActive !== undefined ? isActive : user.isActive
    });

    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] }
    });

    logger.info('User updated', { userId: user.id, updatedBy: req.user.id });
    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user', { error: error.message, userId: req.params.id });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to update user'));
  }
});

// Delete user
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json(errorService.createError('USER_NOT_FOUND', 'User not found'));
    }

    // Prevent deleting yourself
    if (user.id === req.user.id) {
      return res.status(400).json(errorService.createError('CANNOT_DELETE_SELF', 'Cannot delete your own account'));
    }

    await user.destroy();
    logger.info('User deleted', { userId: user.id, deletedBy: req.user.id });
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting user', { error: error.message, userId: req.params.id });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to delete user'));
  }
});

// Get current user profile
router.get('/profile/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json(errorService.createError('USER_NOT_FOUND', 'User not found'));
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user profile', { error: error.message, userId: req.user.id });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to fetch profile'));
  }
});

// Update current user profile
router.put('/profile/me', authenticate, validateUserUpdate, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(errorService.createError('VALIDATION_ERROR', 'Validation failed', errors.array()));
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json(errorService.createError('USER_NOT_FOUND', 'User not found'));
    }

    const { email, username } = req.body;

    // Check if email or username already exists (for other users)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json(errorService.createError('EMAIL_EXISTS', 'Email already exists'));
      }
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json(errorService.createError('USERNAME_EXISTS', 'Username already exists'));
      }
    }

    await user.update({
      email: email || user.email,
      username: username || user.username
    });

    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] }
    });

    logger.info('User profile updated', { userId: user.id });
    res.json(updatedUser);
  } catch (error) {
    logger.error('Error updating user profile', { error: error.message, userId: req.user.id });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to update profile'));
  }
});

// Get user statistics (admin only)
router.get('/stats/overview', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const usersByRole = await User.findAll({
      attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true
    });

    const recentUsers = await User.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] }
    });

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole: usersByRole.reduce((acc, { role, count }) => {
        acc[role] = parseInt(count);
        return acc;
      }, {}),
      recentUsers
    });
  } catch (error) {
    logger.error('Error fetching user statistics', { error: error.message });
    res.status(500).json(errorService.createError('INTERNAL_ERROR', 'Failed to fetch statistics'));
  }
});

module.exports = router; 