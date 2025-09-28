const os = require('os');
const process = require('process');
const logger = require('./loggerService');
const errorService = require('./errorService');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTimeHistory: []
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: { in: 0, out: 0 }
      },
      database: {
        connections: 0,
        queries: 0,
        slowQueries: 0,
        averageQueryTime: 0
      },
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {}
      },
      alerts: []
    };
    
    this.thresholds = {
      responseTime: 2000, // 2 seconds
      errorRate: 0.05, // 5%
      cpuUsage: 80, // 80%
      memoryUsage: 85, // 85%
      diskUsage: 90, // 90%
      slowQueryTime: 1000 // 1 second
    };
    
    this.intervals = {
      systemMetrics: null,
      cleanup: null,
      alerts: null
    };
    
    this.isMonitoring = false;
    this.startTime = Date.now();
  }

  // Start monitoring
  start() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startTime = Date.now();
    
    // System metrics collection
    this.intervals.systemMetrics = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
    
    // Cleanup old metrics
    this.intervals.cleanup = setInterval(() => {
      this.cleanupMetrics();
    }, 300000); // Every 5 minutes
    
    // Alert checking
    this.intervals.alerts = setInterval(() => {
      this.checkAlerts();
    }, 60000); // Every minute
    
    logger.info('Performance monitoring started');
  }

  // Stop monitoring
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    
    logger.info('Performance monitoring stopped');
  }

  // Middleware for request monitoring
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Track request start
      this.metrics.requests.total++;
      
      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        this.updateRequestMetrics(req, res, responseTime);
        
        // Call original end
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  // Update request metrics
  updateRequestMetrics(req, res, responseTime) {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    // Update response time
    this.metrics.requests.responseTimeHistory.push({
      timestamp: Date.now(),
      responseTime,
      endpoint,
      statusCode: res.statusCode
    });
    
    // Keep only last 1000 requests
    if (this.metrics.requests.responseTimeHistory.length > 1000) {
      this.metrics.requests.responseTimeHistory = 
        this.metrics.requests.responseTimeHistory.slice(-1000);
    }
    
    // Update success/failure counts
    if (res.statusCode >= 200 && res.statusCode < 400) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      
      // Track errors by endpoint
      if (!this.metrics.errors.byEndpoint[endpoint]) {
        this.metrics.errors.byEndpoint[endpoint] = 0;
      }
      this.metrics.errors.byEndpoint[endpoint]++;
    }
    
    // Update average response time
    const recentRequests = this.metrics.requests.responseTimeHistory.slice(-100);
    this.metrics.requests.averageResponseTime = 
      recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length;
  }

  // Collect system metrics
  collectSystemMetrics() {
    try {
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      this.metrics.system.cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;
      
      // Memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      this.metrics.system.memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      // Process memory
      const processMemory = process.memoryUsage();
      this.metrics.system.processMemory = {
        rss: processMemory.rss,
        heapUsed: processMemory.heapUsed,
        heapTotal: processMemory.heapTotal,
        external: processMemory.external
      };
      
      // Network interfaces (simplified)
      const networkInterfaces = os.networkInterfaces();
      this.metrics.system.networkInterfaces = Object.keys(networkInterfaces).length;
      
      // Uptime
      this.metrics.system.uptime = process.uptime();
      this.metrics.system.osUptime = os.uptime();
      
    } catch (error) {
      logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  // Track database operations
  trackDatabaseOperation(operation, duration, success = true) {
    this.metrics.database.queries++;
    
    if (duration > this.thresholds.slowQueryTime) {
      this.metrics.database.slowQueries++;
    }
    
    // Update average query time
    if (!this.metrics.database.averageQueryTime) {
      this.metrics.database.averageQueryTime = duration;
    } else {
      this.metrics.database.averageQueryTime = 
        (this.metrics.database.averageQueryTime + duration) / 2;
    }
    
    if (!success) {
      this.trackError('DATABASE_ERROR', operation);
    }
  }

  // Track errors
  trackError(type, context = null) {
    this.metrics.errors.total++;
    
    if (!this.metrics.errors.byType[type]) {
      this.metrics.errors.byType[type] = 0;
    }
    this.metrics.errors.byType[type]++;
    
    // Log error for analysis
    logger.warn('Error tracked', { type, context, timestamp: Date.now() });
  }

  // Check for alerts
  checkAlerts() {
    const currentTime = Date.now();
    const alerts = [];
    
    // Check response time
    if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        message: `Average response time (${this.metrics.requests.averageResponseTime.toFixed(2)}ms) exceeds threshold (${this.thresholds.responseTime}ms)`,
        severity: 'warning',
        value: this.metrics.requests.averageResponseTime,
        threshold: this.thresholds.responseTime,
        timestamp: currentTime
      });
    }
    
    // Check error rate
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.failed / this.metrics.requests.total : 0;
    
    if (errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${this.thresholds.errorRate * 100}%)`,
        severity: 'critical',
        value: errorRate,
        threshold: this.thresholds.errorRate,
        timestamp: currentTime
      });
    }
    
    // Check CPU usage
    if (this.metrics.system.cpuUsage > this.thresholds.cpuUsage) {
      alerts.push({
        type: 'HIGH_CPU_USAGE',
        message: `CPU usage (${this.metrics.system.cpuUsage.toFixed(2)}%) exceeds threshold (${this.thresholds.cpuUsage}%)`,
        severity: 'warning',
        value: this.metrics.system.cpuUsage,
        threshold: this.thresholds.cpuUsage,
        timestamp: currentTime
      });
    }
    
    // Check memory usage
    if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        message: `Memory usage (${this.metrics.system.memoryUsage.toFixed(2)}%) exceeds threshold (${this.thresholds.memoryUsage}%)`,
        severity: 'critical',
        value: this.metrics.system.memoryUsage,
        threshold: this.thresholds.memoryUsage,
        timestamp: currentTime
      });
    }
    
    // Add new alerts
    alerts.forEach(alert => {
      this.addAlert(alert);
    });
  }

  // Add alert
  addAlert(alert) {
    // Check if similar alert already exists (within last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const existingAlert = this.metrics.alerts.find(
      a => a.type === alert.type && a.timestamp > fiveMinutesAgo
    );
    
    if (!existingAlert) {
      this.metrics.alerts.push(alert);
      
      // Keep only last 100 alerts
      if (this.metrics.alerts.length > 100) {
        this.metrics.alerts = this.metrics.alerts.slice(-100);
      }
      
      // Log alert
      logger.warn('Performance alert triggered', alert);
      
      // Send notification (implement based on your notification system)
      this.sendAlert(alert);
    }
  }

  // Send alert notification
  sendAlert(alert) {
    // This would integrate with your notification system
    // For now, just log at appropriate level
    if (alert.severity === 'critical') {
      logger.error('Critical performance alert', alert);
    } else {
      logger.warn('Performance alert', alert);
    }
  }

  // Cleanup old metrics
  cleanupMetrics() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Cleanup response time history
    this.metrics.requests.responseTimeHistory = 
      this.metrics.requests.responseTimeHistory.filter(
        req => req.timestamp > oneHourAgo
      );
    
    // Cleanup old alerts
    this.metrics.alerts = this.metrics.alerts.filter(
      alert => alert.timestamp > oneHourAgo
    );
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      isMonitoring: this.isMonitoring,
      timestamp: Date.now()
    };
  }

  // Get performance summary
  getSummary() {
    const metrics = this.getMetrics();
    const errorRate = metrics.requests.total > 0 ? 
      metrics.requests.failed / metrics.requests.total : 0;
    
    return {
      health: this.calculateHealthScore(),
      requests: {
        total: metrics.requests.total,
        successful: metrics.requests.successful,
        failed: metrics.requests.failed,
        errorRate: errorRate,
        averageResponseTime: metrics.requests.averageResponseTime
      },
      system: {
        cpuUsage: metrics.system.cpuUsage,
        memoryUsage: metrics.system.memoryUsage,
        uptime: metrics.system.uptime
      },
      database: {
        queries: metrics.database.queries,
        slowQueries: metrics.database.slowQueries,
        averageQueryTime: metrics.database.averageQueryTime
      },
      activeAlerts: metrics.alerts.filter(
        alert => alert.timestamp > Date.now() - 5 * 60 * 1000
      ).length,
      timestamp: Date.now()
    };
  }

  // Calculate health score (0-100)
  calculateHealthScore() {
    let score = 100;
    
    // Deduct for high response time
    if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
      score -= 20;
    }
    
    // Deduct for high error rate
    const errorRate = this.metrics.requests.total > 0 ? 
      this.metrics.requests.failed / this.metrics.requests.total : 0;
    if (errorRate > this.thresholds.errorRate) {
      score -= 30;
    }
    
    // Deduct for high CPU usage
    if (this.metrics.system.cpuUsage > this.thresholds.cpuUsage) {
      score -= 20;
    }
    
    // Deduct for high memory usage
    if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage) {
      score -= 30;
    }
    
    return Math.max(0, score);
  }

  // Update thresholds
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', newThresholds);
  }

  // Generate performance report
  generateReport(timeRange = '1h') {
    const metrics = this.getMetrics();
    const now = Date.now();
    
    let timeRangeMs;
    switch (timeRange) {
      case '1h': timeRangeMs = 60 * 60 * 1000; break;
      case '24h': timeRangeMs = 24 * 60 * 60 * 1000; break;
      case '7d': timeRangeMs = 7 * 24 * 60 * 60 * 1000; break;
      default: timeRangeMs = 60 * 60 * 1000;
    }
    
    const cutoff = now - timeRangeMs;
    
    // Filter metrics by time range
    const recentRequests = metrics.requests.responseTimeHistory.filter(
      req => req.timestamp > cutoff
    );
    
    const recentAlerts = metrics.alerts.filter(
      alert => alert.timestamp > cutoff
    );
    
    return {
      timeRange,
      period: {
        start: new Date(cutoff).toISOString(),
        end: new Date(now).toISOString()
      },
      summary: this.getSummary(),
      requests: {
        total: recentRequests.length,
        averageResponseTime: recentRequests.length > 0 ? 
          recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / recentRequests.length : 0,
        slowRequests: recentRequests.filter(req => req.responseTime > this.thresholds.responseTime).length,
        errorRequests: recentRequests.filter(req => req.statusCode >= 400).length
      },
      alerts: {
        total: recentAlerts.length,
        byType: recentAlerts.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {}),
        bySeverity: recentAlerts.reduce((acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {})
      },
      generatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new PerformanceMonitor(); 