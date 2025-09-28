const logger = require('./loggerService');

class APIMonitor {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      suspiciousActivity: new Map(),
      performanceMetrics: new Map()
    };
    
    this.thresholds = {
      maxRequestsPerMinute: 100,
      maxErrorsPerMinute: 20,
      maxSuspiciousActivitiesPerHour: 5,
      slowResponseThreshold: 5000 // 5 seconds
    };
    
    this.alertCooldown = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  // Track API request
  trackRequest(req, res, responseTime) {
    const key = this.getClientKey(req);
    const now = Date.now();
    
    // Track request count
    this.incrementMetric('requests', key, now);
    
    // Track performance
    if (responseTime > this.thresholds.slowResponseThreshold) {
      this.trackSlowResponse(req, responseTime);
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      this.incrementMetric('errors', key, now);
      this.trackError(req, res);
    }
    
    // Check for threshold violations
    this.checkThresholds(key);
  }

  // Track suspicious activity
  trackSuspiciousActivity(req, activityType, details = {}) {
    const key = this.getClientKey(req);
    const now = Date.now();
    
    this.incrementMetric('suspiciousActivity', key, now);
    
    logger.warn('Suspicious activity detected', {
      clientKey: key,
      activityType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      details
    });
    
    // Check if immediate action is needed
    const recentActivity = this.getRecentCount('suspiciousActivity', key, 60 * 60 * 1000); // 1 hour
    if (recentActivity >= this.thresholds.maxSuspiciousActivitiesPerHour) {
      this.triggerAlert('SUSPICIOUS_ACTIVITY_THRESHOLD', key, {
        count: recentActivity,
        activityType,
        details
      });
    }
  }

  // Track slow responses
  trackSlowResponse(req, responseTime) {
    const key = this.getClientKey(req);
    
    logger.warn('Slow response detected', {
      clientKey: key,
      responseTime,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    
    // Store performance metric
    if (!this.metrics.performanceMetrics.has(key)) {
      this.metrics.performanceMetrics.set(key, []);
    }
    
    this.metrics.performanceMetrics.get(key).push({
      timestamp: Date.now(),
      responseTime,
      url: req.originalUrl,
      method: req.method
    });
  }

  // Track errors
  trackError(req, res) {
    const key = this.getClientKey(req);
    
    logger.error('API error tracked', {
      clientKey: key,
      status: res.statusCode,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }

  // Check thresholds and trigger alerts
  checkThresholds(key) {
    const now = Date.now();
    const oneMinute = 60 * 1000;
    
    // Check request rate
    const requestCount = this.getRecentCount('requests', key, oneMinute);
    if (requestCount >= this.thresholds.maxRequestsPerMinute) {
      this.triggerAlert('HIGH_REQUEST_RATE', key, { count: requestCount });
    }
    
    // Check error rate
    const errorCount = this.getRecentCount('errors', key, oneMinute);
    if (errorCount >= this.thresholds.maxErrorsPerMinute) {
      this.triggerAlert('HIGH_ERROR_RATE', key, { count: errorCount });
    }
  }

  // Trigger alert with cooldown
  triggerAlert(alertType, key, details) {
    const alertKey = `${alertType}_${key}`;
    const now = Date.now();
    const cooldownPeriod = 15 * 60 * 1000; // 15 minutes
    
    // Check if alert is in cooldown
    if (this.alertCooldown.has(alertKey)) {
      const lastAlert = this.alertCooldown.get(alertKey);
      if (now - lastAlert < cooldownPeriod) {
        return; // Skip alert, still in cooldown
      }
    }
    
    // Set cooldown
    this.alertCooldown.set(alertKey, now);
    
    // Log alert
    logger.error('Security alert triggered', {
      alertType,
      clientKey: key,
      details,
      timestamp: new Date().toISOString()
    });
    
    // Here you could integrate with external alerting systems
    // Example: send to Slack, email, PagerDuty, etc.
    this.sendExternalAlert(alertType, key, details);
  }

  // Send external alert (placeholder for integration)
  sendExternalAlert(alertType, key, details) {
    // Placeholder for external alerting integration
    // You can integrate with services like:
    // - Slack webhooks
    // - Email notifications
    // - PagerDuty
    // - Discord webhooks
    // - SMS services
    
    if (process.env.SLACK_WEBHOOK_URL) {
      this.sendSlackAlert(alertType, key, details);
    }
  }

  // Send Slack alert
  async sendSlackAlert(alertType, key, details) {
    try {
      const payload = {
        text: `🚨 Security Alert: ${alertType}`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Client', value: key, short: true },
            { title: 'Alert Type', value: alertType, short: true },
            { title: 'Details', value: JSON.stringify(details, null, 2), short: false },
            { title: 'Timestamp', value: new Date().toISOString(), short: true }
          ]
        }]
      };
      
      // Send to Slack (you'd need to install axios or use native fetch)
      // await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
      
      logger.info('Slack alert sent', { alertType, key });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error: error.message });
    }
  }

  // Get client key (IP + User Agent hash)
  getClientKey(req) {
    const crypto = require('crypto');
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || 'unknown';
    
    return crypto.createHash('md5').update(`${ip}_${userAgent}`).digest('hex').substring(0, 8);
  }

  // Increment metric counter
  incrementMetric(metricType, key, timestamp) {
    if (!this.metrics[metricType].has(key)) {
      this.metrics[metricType].set(key, []);
    }
    
    this.metrics[metricType].get(key).push(timestamp);
  }

  // Get recent count for a metric
  getRecentCount(metricType, key, timeWindow) {
    if (!this.metrics[metricType].has(key)) {
      return 0;
    }
    
    const now = Date.now();
    const timestamps = this.metrics[metricType].get(key);
    
    return timestamps.filter(timestamp => now - timestamp <= timeWindow).length;
  }

  // Cleanup old metrics
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [metricType, metricMap] of Object.entries(this.metrics)) {
      for (const [key, timestamps] of metricMap.entries()) {
        if (Array.isArray(timestamps)) {
          const filtered = timestamps.filter(timestamp => now - timestamp <= maxAge);
          
          if (filtered.length === 0) {
            metricMap.delete(key);
          } else {
            metricMap.set(key, filtered);
          }
        }
      }
    }
    
    // Cleanup alert cooldowns
    for (const [alertKey, timestamp] of this.alertCooldown.entries()) {
      if (now - timestamp > 60 * 60 * 1000) { // 1 hour
        this.alertCooldown.delete(alertKey);
      }
    }
  }

  // Get monitoring statistics
  getStatistics() {
    const stats = {
      activeClients: 0,
      totalRequests: 0,
      totalErrors: 0,
      totalSuspiciousActivity: 0,
      alertsInCooldown: this.alertCooldown.size
    };
    
    for (const [metricType, metricMap] of Object.entries(this.metrics)) {
      if (metricType === 'performanceMetrics') continue;
      
      stats.activeClients = Math.max(stats.activeClients, metricMap.size);
      
      for (const timestamps of metricMap.values()) {
        if (metricType === 'requests') {
          stats.totalRequests += timestamps.length;
        } else if (metricType === 'errors') {
          stats.totalErrors += timestamps.length;
        } else if (metricType === 'suspiciousActivity') {
          stats.totalSuspiciousActivity += timestamps.length;
        }
      }
    }
    
    return stats;
  }

  // Shutdown cleanup
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Create singleton instance
const apiMonitor = new APIMonitor();

// Graceful shutdown
process.on('SIGTERM', () => apiMonitor.shutdown());
process.on('SIGINT', () => apiMonitor.shutdown());

module.exports = apiMonitor; 