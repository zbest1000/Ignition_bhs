const express = require('express');
const router = express.Router();

const { getRateLimitConfig, updateRateLimitConfig } = require('../middleware/security');

// Get current rate-limit settings
router.get('/rate-limit', (req, res) => {
  res.json(getRateLimitConfig());
});

// Update rate-limit settings
router.post('/rate-limit', (req, res) => {
  const { api, auth, upload } = req.body || {};
  updateRateLimitConfig({ api, auth, upload });
  res.json({ success: true, config: getRateLimitConfig() });
});

module.exports = router; 