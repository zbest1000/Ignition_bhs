const errorService = require('../../services/errorService');

describe('ErrorService', () => {
  describe('createError', () => {
    test('should create standard error with default values', () => {
      const error = errorService.createError('VALIDATION_ERROR', 'Invalid input');

      expect(error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        userMessage: 'Please check your input and try again.',
        statusCode: 400,
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    test('should create error with custom user message', () => {
      const error = errorService.createError(
        'FILE_TOO_LARGE',
        'File exceeds limit',
        'Please select a smaller file'
      );

      expect(error.userMessage).toBe('Please select a smaller file');
    });

    test('should create error with metadata', () => {
      const metadata = { fileName: 'test.jpg', size: 5000000 };
      const error = errorService.createError(
        'FILE_TOO_LARGE',
        'File exceeds limit',
        null,
        metadata
      );

      expect(error.metadata).toEqual(metadata);
    });
  });

  describe('getHttpStatus', () => {
    test('should return correct HTTP status for known error codes', () => {
      expect(errorService.getHttpStatus('VALIDATION_ERROR')).toBe(400);
      expect(errorService.getHttpStatus('FILE_NOT_FOUND')).toBe(404);
      expect(errorService.getHttpStatus('UNAUTHORIZED')).toBe(401);
      expect(errorService.getHttpStatus('RATE_LIMIT_EXCEEDED')).toBe(429);
      expect(errorService.getHttpStatus('INTERNAL_ERROR')).toBe(500);
    });

    test('should return 500 for unknown error codes', () => {
      expect(errorService.getHttpStatus('UNKNOWN_ERROR')).toBe(500);
    });
  });

  describe('getUserMessage', () => {
    test('should return user-friendly messages for known error codes', () => {
      expect(errorService.getUserMessage('VALIDATION_ERROR')).toBe(
        'Please check your input and try again.'
      );
      expect(errorService.getUserMessage('FILE_TOO_LARGE')).toBe(
        'The file you selected is too large. Please choose a smaller file.'
      );
      expect(errorService.getUserMessage('UNAUTHORIZED')).toBe(
        'You are not authorized to perform this action.'
      );
    });

    test('should return generic message for unknown error codes', () => {
      expect(errorService.getUserMessage('UNKNOWN_ERROR')).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });
  });

  describe('formatErrorResponse', () => {
    test('should format error response correctly', () => {
      const error = new Error('Database connection failed');
      const response = errorService.formatErrorResponse(error, 'req123');

      expect(response).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database connection failed',
          userMessage: 'An unexpected error occurred. Please try again.',
          statusCode: 500,
          timestamp: expect.any(String),
          requestId: 'req123'
        }
      });
    });

    test('should handle error objects with custom properties', () => {
      const customError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid file format',
        userMessage: 'Please upload a valid image file',
        statusCode: 400,
        metadata: { allowedFormats: ['jpg', 'png'] }
      };

      const response = errorService.formatErrorResponse(customError, 'req456');

      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.metadata).toEqual({ allowedFormats: ['jpg', 'png'] });
      expect(response.error.requestId).toBe('req456');
    });
  });

  describe('isOperationalError', () => {
    test('should identify operational errors', () => {
      const operationalError = errorService.createError('VALIDATION_ERROR', 'Invalid input');
      const systemError = new Error('System failure');

      expect(errorService.isOperationalError(operationalError)).toBe(true);
      expect(errorService.isOperationalError(systemError)).toBe(false);
    });
  });

  describe('logError', () => {
    test('should log error with context', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');
      const context = { userId: 123, action: 'upload' };

      errorService.logError(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        expect.stringContaining('Test error'),
        expect.stringContaining('userId')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error code definitions', () => {
    test('should have all required error codes defined', () => {
      const requiredCodes = [
        'VALIDATION_ERROR',
        'FILE_TOO_LARGE',
        'INVALID_FILE_TYPE',
        'FILE_NOT_FOUND',
        'UNAUTHORIZED',
        'RATE_LIMIT_EXCEEDED',
        'OCR_PROCESSING_ERROR',
        'AI_SERVICE_ERROR',
        'INTERNAL_ERROR'
      ];

      requiredCodes.forEach(code => {
        expect(errorService.getHttpStatus(code)).toBeDefined();
        expect(errorService.getUserMessage(code)).toBeDefined();
      });
    });
  });
});
