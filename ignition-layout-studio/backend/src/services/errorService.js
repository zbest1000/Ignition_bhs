const logger = require('./loggerService');

class ErrorService {
  constructor() {
    this.errorCodes = {
      // General errors
      INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
      BAD_REQUEST: 'BAD_REQUEST',
      UNAUTHORIZED: 'UNAUTHORIZED',
      FORBIDDEN: 'FORBIDDEN',
      NOT_FOUND: 'NOT_FOUND',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

      // File operation errors
      FILE_NOT_FOUND: 'FILE_NOT_FOUND',
      FILE_TOO_LARGE: 'FILE_TOO_LARGE',
      INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
      INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
      FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
      FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',

      // Project errors
      PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
      PROJECT_ACCESS_DENIED: 'PROJECT_ACCESS_DENIED',
      INVALID_PROJECT_ID: 'INVALID_PROJECT_ID',
      PROJECT_CREATION_FAILED: 'PROJECT_CREATION_FAILED',

      // Component errors
      COMPONENT_NOT_FOUND: 'COMPONENT_NOT_FOUND',
      INVALID_COMPONENT_TYPE: 'INVALID_COMPONENT_TYPE',
      COMPONENT_CREATION_FAILED: 'COMPONENT_CREATION_FAILED',

      // OCR errors
      OCR_PROCESSING_FAILED: 'OCR_PROCESSING_FAILED',
      OCR_TIMEOUT: 'OCR_TIMEOUT',
      OCR_PROVIDER_ERROR: 'OCR_PROVIDER_ERROR',
      INVALID_OCR_INPUT: 'INVALID_OCR_INPUT',

      // AI errors
      AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
      AI_QUOTA_EXCEEDED: 'AI_QUOTA_EXCEEDED',
      AI_TIMEOUT: 'AI_TIMEOUT',
      INVALID_AI_INPUT: 'INVALID_AI_INPUT',
      AI_PROCESSING_FAILED: 'AI_PROCESSING_FAILED',

      // Database errors
      DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
      DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
      DATABASE_CONSTRAINT_ERROR: 'DATABASE_CONSTRAINT_ERROR',

      // Export errors
      EXPORT_FAILED: 'EXPORT_FAILED',
      INVALID_EXPORT_FORMAT: 'INVALID_EXPORT_FORMAT',
      EXPORT_TIMEOUT: 'EXPORT_TIMEOUT',

      // Security errors
      INVALID_TOKEN: 'INVALID_TOKEN',
      TOKEN_EXPIRED: 'TOKEN_EXPIRED',
      INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
      SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY'
    };

    this.httpStatusCodes = {
      [this.errorCodes.INTERNAL_SERVER_ERROR]: 500,
      [this.errorCodes.BAD_REQUEST]: 400,
      [this.errorCodes.UNAUTHORIZED]: 401,
      [this.errorCodes.FORBIDDEN]: 403,
      [this.errorCodes.NOT_FOUND]: 404,
      [this.errorCodes.VALIDATION_ERROR]: 422,
      [this.errorCodes.RATE_LIMIT_EXCEEDED]: 429,

      [this.errorCodes.FILE_NOT_FOUND]: 404,
      [this.errorCodes.FILE_TOO_LARGE]: 413,
      [this.errorCodes.INVALID_FILE_TYPE]: 415,
      [this.errorCodes.INVALID_MIME_TYPE]: 415,
      [this.errorCodes.FILE_UPLOAD_FAILED]: 500,
      [this.errorCodes.FILE_PROCESSING_FAILED]: 500,

      [this.errorCodes.PROJECT_NOT_FOUND]: 404,
      [this.errorCodes.PROJECT_ACCESS_DENIED]: 403,
      [this.errorCodes.INVALID_PROJECT_ID]: 400,
      [this.errorCodes.PROJECT_CREATION_FAILED]: 500,

      [this.errorCodes.COMPONENT_NOT_FOUND]: 404,
      [this.errorCodes.INVALID_COMPONENT_TYPE]: 400,
      [this.errorCodes.COMPONENT_CREATION_FAILED]: 500,

      [this.errorCodes.OCR_PROCESSING_FAILED]: 500,
      [this.errorCodes.OCR_TIMEOUT]: 408,
      [this.errorCodes.OCR_PROVIDER_ERROR]: 502,
      [this.errorCodes.INVALID_OCR_INPUT]: 400,

      [this.errorCodes.AI_PROVIDER_ERROR]: 502,
      [this.errorCodes.AI_QUOTA_EXCEEDED]: 429,
      [this.errorCodes.AI_TIMEOUT]: 408,
      [this.errorCodes.INVALID_AI_INPUT]: 400,
      [this.errorCodes.AI_PROCESSING_FAILED]: 500,

      [this.errorCodes.DATABASE_CONNECTION_ERROR]: 503,
      [this.errorCodes.DATABASE_QUERY_ERROR]: 500,
      [this.errorCodes.DATABASE_CONSTRAINT_ERROR]: 409,

      [this.errorCodes.EXPORT_FAILED]: 500,
      [this.errorCodes.INVALID_EXPORT_FORMAT]: 400,
      [this.errorCodes.EXPORT_TIMEOUT]: 408,

      [this.errorCodes.INVALID_TOKEN]: 401,
      [this.errorCodes.TOKEN_EXPIRED]: 401,
      [this.errorCodes.INSUFFICIENT_PERMISSIONS]: 403,
      [this.errorCodes.SUSPICIOUS_ACTIVITY]: 403
    };

    this.userFriendlyMessages = {
      [this.errorCodes.INTERNAL_SERVER_ERROR]:
        'An unexpected error occurred. Please try again later.',
      [this.errorCodes.BAD_REQUEST]: 'The request was invalid. Please check your input.',
      [this.errorCodes.UNAUTHORIZED]: 'Authentication required. Please log in.',
      [this.errorCodes.FORBIDDEN]:
        'Access denied. You do not have permission to perform this action.',
      [this.errorCodes.NOT_FOUND]: 'The requested resource was not found.',
      [this.errorCodes.VALIDATION_ERROR]: 'The provided data is invalid.',
      [this.errorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',

      [this.errorCodes.FILE_NOT_FOUND]: 'The requested file was not found.',
      [this.errorCodes.FILE_TOO_LARGE]: 'The file is too large. Maximum size is 50MB.',
      [this.errorCodes.INVALID_FILE_TYPE]: 'This file type is not supported.',
      [this.errorCodes.INVALID_MIME_TYPE]: 'Invalid file format detected.',
      [this.errorCodes.FILE_UPLOAD_FAILED]: 'File upload failed. Please try again.',
      [this.errorCodes.FILE_PROCESSING_FAILED]: 'File processing failed. Please try again.',

      [this.errorCodes.PROJECT_NOT_FOUND]: 'Project not found.',
      [this.errorCodes.PROJECT_ACCESS_DENIED]: 'Access to this project is denied.',
      [this.errorCodes.INVALID_PROJECT_ID]: 'Invalid project ID.',
      [this.errorCodes.PROJECT_CREATION_FAILED]: 'Failed to create project. Please try again.',

      [this.errorCodes.COMPONENT_NOT_FOUND]: 'Component not found.',
      [this.errorCodes.INVALID_COMPONENT_TYPE]: 'Invalid component type.',
      [this.errorCodes.COMPONENT_CREATION_FAILED]: 'Failed to create component. Please try again.',

      [this.errorCodes.OCR_PROCESSING_FAILED]: 'OCR processing failed. Please try again.',
      [this.errorCodes.OCR_TIMEOUT]: 'OCR processing timed out. Please try again.',
      [this.errorCodes.OCR_PROVIDER_ERROR]: 'OCR service is temporarily unavailable.',
      [this.errorCodes.INVALID_OCR_INPUT]: 'Invalid input for OCR processing.',

      [this.errorCodes.AI_PROVIDER_ERROR]: 'AI service is temporarily unavailable.',
      [this.errorCodes.AI_QUOTA_EXCEEDED]: 'AI service quota exceeded. Please try again later.',
      [this.errorCodes.AI_TIMEOUT]: 'AI processing timed out. Please try again.',
      [this.errorCodes.INVALID_AI_INPUT]: 'Invalid input for AI processing.',
      [this.errorCodes.AI_PROCESSING_FAILED]: 'AI processing failed. Please try again.',

      [this.errorCodes.DATABASE_CONNECTION_ERROR]: 'Database connection failed. Please try again.',
      [this.errorCodes.DATABASE_QUERY_ERROR]: 'Database operation failed. Please try again.',
      [this.errorCodes.DATABASE_CONSTRAINT_ERROR]: 'Data constraint violation.',

      [this.errorCodes.EXPORT_FAILED]: 'Export failed. Please try again.',
      [this.errorCodes.INVALID_EXPORT_FORMAT]: 'Invalid export format.',
      [this.errorCodes.EXPORT_TIMEOUT]: 'Export timed out. Please try again.',

      [this.errorCodes.INVALID_TOKEN]: 'Invalid authentication token.',
      [this.errorCodes.TOKEN_EXPIRED]: 'Authentication token has expired.',
      [this.errorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions.',
      [this.errorCodes.SUSPICIOUS_ACTIVITY]: 'Suspicious activity detected.'
    };
  }

  /**
   * Create a standardized error object
   */
  createError(code, message = null, userMessage = null, metadata = {}) {
    const error = {
      code: code,
      message: message || this.userFriendlyMessages[code] || 'Unknown error',
      userMessage: userMessage || this.userFriendlyMessages[code] || 'Please check your input and try again.',
      statusCode: this.httpStatusCodes[code] || 500,
      timestamp: new Date().toISOString(),
      requestId: this.generateErrorId(),
      metadata: metadata
    };

    return error;
  }

  /**
   * Get HTTP status code for error code
   */
  getHttpStatus(code) {
    return this.httpStatusCodes[code] || 500;
  }

  /**
   * Get user-friendly message for error code
   */
  getUserMessage(code) {
    return this.userFriendlyMessages[code] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Format error response for API
   */
  formatErrorResponse(error, requestId = null) {
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
        userMessage: error.userMessage || this.getUserMessage(error.code),
        timestamp: new Date().toISOString(),
        requestId: requestId || this.generateErrorId(),
        ...(error.metadata && { metadata: error.metadata })
      }
    };
  }

  /**
   * Check if error is operational (expected) vs programming error
   */
  isOperationalError(error) {
    return error.code && this.errorCodes[error.code];
  }

  /**
   * Log error with context
   */
  logError(error, context = {}) {
    const errorMeta = {
      code: error.code,
      message: error.message,
      stack: error.stack,
      ...context
    };

    if (this.isOperationalError(error)) {
      logger.warn('Operational error occurred', errorMeta);
    } else {
      logger.error('Unexpected error occurred', errorMeta);
    }
  }

  /**
   * Handle and log errors
   */
  handleError(error, req = null, context = {}) {
    const errorId = this.generateErrorId();

    // Determine if this is a known error or unexpected
    const isKnownError = error.code && this.errorCodes[error.code];

    // Create error metadata
    const errorMeta = {
      errorId,
      code: error.code || this.errorCodes.INTERNAL_SERVER_ERROR,
      statusCode: error.statusCode || 500,
      message: error.message,
      details: error.details || {},
      context,
      timestamp: error.timestamp || new Date().toISOString(),
      ...this.extractRequestInfo(req)
    };

    // Log the error
    if (isKnownError && error.statusCode < 500) {
      logger.warn('Client error occurred', errorMeta);
    } else {
      logger.error('Server error occurred', {
        ...errorMeta,
        error: error.originalError || error,
        stack: error.stack
      });
    }

    return {
      errorId,
      ...errorMeta
    };
  }

  /**
   * Send standardized error response
   */
  sendErrorResponse(res, error, req = null, context = {}) {
    const errorInfo = this.handleError(error, req, context);

    const response = {
      success: false,
      error: {
        code: errorInfo.code,
        message: this.userFriendlyMessages[errorInfo.code] || error.message,
        details: errorInfo.details,
        errorId: errorInfo.errorId,
        timestamp: errorInfo.timestamp
      }
    };

    // Add debug information in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        originalMessage: error.message,
        stack: error.stack,
        context: errorInfo.context
      };
    }

    res.status(errorInfo.statusCode).json(response);
  }

  /**
   * Create error middleware for Express
   */
  createErrorMiddleware() {
    return (error, req, res, next) => {
      // If response was already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(error);
      }

      this.sendErrorResponse(res, error, req, {
        route: req.route?.path,
        method: req.method,
        params: req.params,
        query: req.query
      });
    };
  }

  /**
   * Create async error handler wrapper
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validate and throw error if validation fails
   */
  validateOrThrow(condition, errorCode, message = null, details = {}) {
    if (!condition) {
      throw this.createError(errorCode, message, details);
    }
  }

  /**
   * Extract request information for logging
   */
  extractRequestInfo(req) {
    if (!req) return {};

    return {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection?.remoteAddress,
      referer: req.get('Referer')
    };
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert unknown errors to standardized format
   */
  normalizeError(error) {
    if (error.code && this.errorCodes[error.code]) {
      return error;
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      return this.createError(
        this.errorCodes.VALIDATION_ERROR,
        'Validation failed',
        { validationErrors: error.errors },
        error
      );
    }

    if (error.name === 'CastError') {
      return this.createError(
        this.errorCodes.BAD_REQUEST,
        'Invalid data format',
        { field: error.path, value: error.value },
        error
      );
    }

    if (error.code === 'ENOENT') {
      return this.createError(
        this.errorCodes.FILE_NOT_FOUND,
        'File not found',
        { path: error.path },
        error
      );
    }

    if (error.code === 'EACCES') {
      return this.createError(
        this.errorCodes.FORBIDDEN,
        'Access denied',
        { path: error.path },
        error
      );
    }

    // Default to internal server error
    return this.createError(
      this.errorCodes.INTERNAL_SERVER_ERROR,
      error.message || 'An unexpected error occurred',
      {},
      error
    );
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    // This would typically query a database or cache
    // For now, return mock data
    return {
      totalErrors: 0,
      errorsByCode: {},
      errorsByStatusCode: {},
      recentErrors: []
    };
  }
}

// Export singleton instance
module.exports = new ErrorService();
