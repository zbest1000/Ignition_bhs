const fs = require('fs');
const path = require('path');
const logger = require('../../services/loggerService');

// Mock fs module
jest.mock('fs');

describe('LoggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fs.existsSync to return false (directory doesn't exist)
    fs.existsSync.mockReturnValue(false);
    // Mock fs.mkdirSync to do nothing
    fs.mkdirSync.mockImplementation(() => {});
  });

  describe('info logging', () => {
    test('should log info messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test info message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        expect.stringContaining('Test info message')
      );

      consoleSpy.mockRestore();
    });

    test('should log info with metadata', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Test message', { userId: 123, action: 'upload' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        expect.stringContaining('Test message'),
        expect.stringContaining('userId'),
        expect.stringContaining('123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error logging', () => {
    test('should log error messages', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      logger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        expect.stringContaining('Test error message')
      );

      consoleSpy.mockRestore();
    });

    test('should log error with stack trace', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Test error');

      logger.error('Error occurred', { error: testError });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        expect.stringContaining('Error occurred'),
        expect.stringContaining('stack')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('warn logging', () => {
    test('should log warning messages', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.warn('Test warning message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARN'),
        expect.stringContaining('Test warning message')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('debug logging', () => {
    test('should log debug messages', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

      logger.debug('Test debug message');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG'),
        expect.stringContaining('Test debug message')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('specialized logging methods', () => {
    test('should log API requests', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.logApiRequest('POST', '/api/upload', 200, 150);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API'),
        expect.stringContaining('POST'),
        expect.stringContaining('/api/upload'),
        expect.stringContaining('200'),
        expect.stringContaining('150ms')
      );

      consoleSpy.mockRestore();
    });

    test('should log file operations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.logFileOperation('upload', 'test.jpg', 'user123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('FILE'),
        expect.stringContaining('upload'),
        expect.stringContaining('test.jpg'),
        expect.stringContaining('user123')
      );

      consoleSpy.mockRestore();
    });

    test('should log AI processing', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.logAiProcessing('OCR', 'processing', 'session123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI'),
        expect.stringContaining('OCR'),
        expect.stringContaining('processing'),
        expect.stringContaining('session123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('security logging', () => {
    test('should log security events', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      logger.logSecurityEvent('rate_limit_exceeded', '192.168.1.1', { endpoint: '/api/upload' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY'),
        expect.stringContaining('rate_limit_exceeded'),
        expect.stringContaining('192.168.1.1'),
        expect.stringContaining('endpoint')
      );

      consoleSpy.mockRestore();
    });
  });
});
