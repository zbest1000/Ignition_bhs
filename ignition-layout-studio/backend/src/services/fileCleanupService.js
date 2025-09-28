const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const logger = require('./loggerService');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);

class FileCleanupService {
  constructor() {
    this.cleanupIntervals = new Map();
    this.tempFileRegistry = new Map();
    this.maxFileAge = 24 * 60 * 60 * 1000; // 24 hours
    this.maxTempFileAge = 1 * 60 * 60 * 1000; // 1 hour
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB

    // Directories to monitor
    this.monitoredDirectories = [
      path.join(__dirname, '../../uploads'),
      path.join(__dirname, '../../exports'),
      path.join(__dirname, '../../temp'),
      path.join(__dirname, '../../cache')
    ];

    this.initializeCleanupSchedule();
  }

  /**
   * Initialize cleanup schedules
   */
  initializeCleanupSchedule() {
    // Clean up temporary files every 15 minutes
    this.cleanupIntervals.set(
      'temp',
      setInterval(
        () => {
          this.cleanupTemporaryFiles();
        },
        15 * 60 * 1000
      )
    );

    // Clean up old files every hour
    this.cleanupIntervals.set(
      'old',
      setInterval(
        () => {
          this.cleanupOldFiles();
        },
        60 * 60 * 1000
      )
    );

    // Clean up cache when it gets too large every 30 minutes
    this.cleanupIntervals.set(
      'cache',
      setInterval(
        () => {
          this.cleanupCache();
        },
        30 * 60 * 1000
      )
    );

    // Memory monitoring every 5 minutes
    this.cleanupIntervals.set(
      'memory',
      setInterval(
        () => {
          this.monitorMemoryUsage();
        },
        5 * 60 * 1000
      )
    );

    logger.info('File cleanup service initialized');
  }

  /**
   * Register a temporary file for cleanup
   */
  registerTempFile(filePath, maxAge = this.maxTempFileAge) {
    const fileInfo = {
      path: filePath,
      createdAt: Date.now(),
      maxAge: maxAge,
      cleanupCallback: null
    };

    this.tempFileRegistry.set(filePath, fileInfo);
    logger.debug('Registered temporary file', { filePath, maxAge });

    return fileInfo;
  }

  /**
   * Register a cleanup callback for a file
   */
  registerCleanupCallback(filePath, callback) {
    if (this.tempFileRegistry.has(filePath)) {
      this.tempFileRegistry.get(filePath).cleanupCallback = callback;
    }
  }

  /**
   * Unregister a temporary file
   */
  unregisterTempFile(filePath) {
    if (this.tempFileRegistry.has(filePath)) {
      this.tempFileRegistry.delete(filePath);
      logger.debug('Unregistered temporary file', { filePath });
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTemporaryFiles() {
    const now = Date.now();
    const filesToCleanup = [];

    // Check registered temporary files
    for (const [filePath, fileInfo] of this.tempFileRegistry) {
      if (now - fileInfo.createdAt > fileInfo.maxAge) {
        filesToCleanup.push({ filePath, fileInfo });
      }
    }

    // Clean up expired files
    for (const { filePath, fileInfo } of filesToCleanup) {
      try {
        // Execute cleanup callback if provided
        if (fileInfo.cleanupCallback) {
          await fileInfo.cleanupCallback(filePath);
        }

        // Remove file if it exists
        if (await this.fileExists(filePath)) {
          await unlink(filePath);
          logger.info('Cleaned up temporary file', { filePath });
        }

        // Unregister the file
        this.unregisterTempFile(filePath);
      } catch (error) {
        logger.error('Failed to cleanup temporary file', {
          filePath,
          error: error.message
        });
      }
    }

    // Clean up temp directories
    await this.cleanupTempDirectories();
  }

  /**
   * Clean up old files in monitored directories
   */
  async cleanupOldFiles() {
    for (const directory of this.monitoredDirectories) {
      try {
        if (await this.directoryExists(directory)) {
          await this.cleanupDirectoryOldFiles(directory);
        }
      } catch (error) {
        logger.error('Failed to cleanup old files in directory', {
          directory,
          error: error.message
        });
      }
    }
  }

  /**
   * Clean up old files in a specific directory
   */
  async cleanupDirectoryOldFiles(directory) {
    try {
      const files = await readdir(directory);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);

        try {
          const stats = await stat(filePath);

          if (stats.isFile() && now - stats.mtime.getTime() > this.maxFileAge) {
            await unlink(filePath);
            cleanedCount++;
            logger.debug('Cleaned up old file', { filePath });
          }
        } catch (error) {
          logger.warn('Failed to process file during cleanup', {
            filePath,
            error: error.message
          });
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up old files', { directory, cleanedCount });
      }
    } catch (error) {
      logger.error('Failed to cleanup directory', {
        directory,
        error: error.message
      });
    }
  }

  /**
   * Clean up cache when it exceeds size limit
   */
  async cleanupCache() {
    const cacheDir = path.join(__dirname, '../../cache');

    if (!(await this.directoryExists(cacheDir))) {
      return;
    }

    try {
      const totalSize = await this.getDirectorySize(cacheDir);

      if (totalSize > this.maxCacheSize) {
        logger.info('Cache size exceeded limit, cleaning up', {
          totalSize: `${Math.round(totalSize / 1024 / 1024)}MB`,
          limit: `${Math.round(this.maxCacheSize / 1024 / 1024)}MB`
        });

        await this.cleanupCacheByAge(cacheDir);
      }
    } catch (error) {
      logger.error('Failed to cleanup cache', { error: error.message });
    }
  }

  /**
   * Clean up cache files by age (oldest first)
   */
  async cleanupCacheByAge(cacheDir) {
    try {
      const files = await readdir(cacheDir);
      const fileStats = [];

      // Get file stats
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        try {
          const stats = await stat(filePath);
          if (stats.isFile()) {
            fileStats.push({
              path: filePath,
              size: stats.size,
              mtime: stats.mtime.getTime()
            });
          }
        } catch (error) {
          logger.warn('Failed to get file stats', { filePath, error: error.message });
        }
      }

      // Sort by modification time (oldest first)
      fileStats.sort((a, b) => a.mtime - b.mtime);

      // Remove files until we're under the limit
      let totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
      let removedCount = 0;

      for (const file of fileStats) {
        if (totalSize <= this.maxCacheSize * 0.8) {
          // Clean to 80% of limit
          break;
        }

        try {
          await unlink(file.path);
          totalSize -= file.size;
          removedCount++;
          logger.debug('Removed cache file', { path: file.path });
        } catch (error) {
          logger.warn('Failed to remove cache file', {
            path: file.path,
            error: error.message
          });
        }
      }

      logger.info('Cache cleanup completed', {
        removedCount,
        newSize: `${Math.round(totalSize / 1024 / 1024)}MB`
      });
    } catch (error) {
      logger.error('Failed to cleanup cache by age', { error: error.message });
    }
  }

  /**
   * Clean up temporary directories
   */
  async cleanupTempDirectories() {
    const tempDir = path.join(__dirname, '../../temp');

    if (!(await this.directoryExists(tempDir))) {
      return;
    }

    try {
      const items = await readdir(tempDir);

      for (const item of items) {
        const itemPath = path.join(tempDir, item);

        try {
          const stats = await stat(itemPath);

          if (stats.isDirectory()) {
            const isEmpty = await this.isDirectoryEmpty(itemPath);
            if (isEmpty) {
              await rmdir(itemPath);
              logger.debug('Removed empty temp directory', { itemPath });
            }
          }
        } catch (error) {
          logger.warn('Failed to process temp directory item', {
            itemPath,
            error: error.message
          });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp directories', { error: error.message });
    }
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    logger.debug('Memory usage', {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${rssMB}MB`
    });

    // Trigger garbage collection if memory usage is high
    if (heapUsedMB > 512) {
      // 512MB threshold
      logger.warn('High memory usage detected', { heapUsed: `${heapUsedMB}MB` });

      if (global.gc) {
        global.gc();
        logger.info('Garbage collection triggered');
      }
    }

    // Trigger aggressive cleanup if memory is very high
    if (heapUsedMB > 1024) {
      // 1GB threshold
      logger.warn('Very high memory usage, triggering cleanup', { heapUsed: `${heapUsedMB}MB` });
      this.cleanupTemporaryFiles();
    }
  }

  /**
   * Force cleanup of all temporary files
   */
  async forceCleanupAll() {
    logger.info('Force cleanup initiated');

    try {
      await this.cleanupTemporaryFiles();
      await this.cleanupOldFiles();
      await this.cleanupCache();

      if (global.gc) {
        global.gc();
      }

      logger.info('Force cleanup completed');
    } catch (error) {
      logger.error('Force cleanup failed', { error: error.message });
    }
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats() {
    return {
      registeredTempFiles: this.tempFileRegistry.size,
      monitoredDirectories: this.monitoredDirectories.length,
      maxFileAge: this.maxFileAge,
      maxTempFileAge: this.maxTempFileAge,
      maxCacheSize: `${Math.round(this.maxCacheSize / 1024 / 1024)}MB`,
      activeIntervals: this.cleanupIntervals.size
    };
  }

  /**
   * Utility methods
   */
  async fileExists(filePath) {
    try {
      await stat(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  async isDirectoryEmpty(dirPath) {
    try {
      const files = await readdir(dirPath);
      return files.length === 0;
    } catch (error) {
      return false;
    }
  }

  async getDirectorySize(dirPath) {
    try {
      const files = await readdir(dirPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        try {
          const stats = await stat(filePath);
          if (stats.isFile()) {
            totalSize += stats.size;
          }
        } catch (error) {
          // Ignore errors for individual files
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Shutdown cleanup service
   */
  shutdown() {
    logger.info('Shutting down file cleanup service');

    // Clear all intervals
    for (const [name, interval] of this.cleanupIntervals) {
      clearInterval(interval);
      logger.debug('Cleared cleanup interval', { name });
    }

    this.cleanupIntervals.clear();

    // Force final cleanup
    this.forceCleanupAll();
  }
}

// Export singleton instance
module.exports = new FileCleanupService();
