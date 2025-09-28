const request = require('supertest');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Mock dependencies
jest.mock('../../services/loggerService');
jest.mock('../../services/errorService');
jest.mock('../../services/fileValidationService');
jest.mock('../../services/ocrService');

const logger = require('../../services/loggerService');
const errorService = require('../../services/errorService');
const fileValidationService = require('../../services/fileValidationService');
const ocrService = require('../../services/ocrService');

// Create test app
const app = express();
app.use(express.json());

// Mock multer middleware
const mockMulter = {
  array: jest.fn(() => (req, res, next) => {
    req.files = [
      {
        fieldname: 'files',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: 'uploads/',
        filename: 'test-123.jpg',
        path: 'uploads/test-123.jpg'
      }
    ];
    next();
  })
};

// Mock upload route
app.post('/api/upload', mockMulter.array('files', 10), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Validate files
    const validationResults = [];
    for (const file of files) {
      const validation = await fileValidationService.validateFile(file);
      validationResults.push(validation);
    }

    // Check for validation errors
    const invalidFiles = validationResults.filter(result => !result.isValid);
    if (invalidFiles.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        invalidFiles: invalidFiles.map(f => f.errors)
      });
    }

    // Process OCR for image files
    const processedFiles = [];
    for (const file of files) {
      let ocrResult = null;
      if (file.mimetype.startsWith('image/')) {
        ocrResult = await ocrService.processImage(file.path);
      }

      processedFiles.push({
        filename: file.originalname,
        size: file.size,
        type: file.mimetype,
        path: file.path,
        ocrResult
      });
    }

    logger.logFileOperation('upload', files.map(f => f.originalname).join(', '), 'test-user');

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: processedFiles,
      warnings: []
    });
  } catch (error) {
    logger.error('Upload error:', { error: error.message });
    const errorResponse = errorService.formatErrorResponse(error, req.id);
    res.status(errorResponse.error.statusCode).json(errorResponse);
  }
});

describe('Upload Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    fileValidationService.validateFile.mockResolvedValue({
      isValid: true,
      errors: []
    });

    ocrService.processImage.mockResolvedValue({
      text: 'Sample OCR text',
      confidence: 0.95
    });

    errorService.formatErrorResponse.mockReturnValue({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Test error',
        statusCode: 500
      }
    });
  });

  describe('POST /api/upload', () => {
    test('should successfully upload valid files', async () => {
      const response = await request(app).post('/api/upload').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Files uploaded successfully');
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0]).toEqual({
        filename: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        path: 'uploads/test-123.jpg',
        ocrResult: {
          text: 'Sample OCR text',
          confidence: 0.95
        }
      });
    });

    test('should return error when no files uploaded', async () => {
      // Mock empty files
      const emptyMulter = {
        array: jest.fn(() => (req, res, next) => {
          req.files = [];
          next();
        })
      };

      const emptyApp = express();
      emptyApp.use(express.json());
      emptyApp.post('/api/upload', emptyMulter.array('files', 10), async (req, res) => {
        const files = req.files;
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No files uploaded'
          });
        }
      });

      const response = await request(emptyApp).post('/api/upload').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No files uploaded');
    });

    test('should handle file validation errors', async () => {
      fileValidationService.validateFile.mockResolvedValue({
        isValid: false,
        errors: ['File too large', 'Invalid file type']
      });

      const response = await request(app).post('/api/upload').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File validation failed');
      expect(response.body.invalidFiles).toHaveLength(1);
      expect(response.body.invalidFiles[0]).toEqual(['File too large', 'Invalid file type']);
    });

    test('should handle OCR processing errors gracefully', async () => {
      ocrService.processImage.mockRejectedValue(new Error('OCR service unavailable'));

      const response = await request(app).post('/api/upload').expect(500);

      expect(response.body.success).toBe(false);
      expect(errorService.formatErrorResponse).toHaveBeenCalledWith(expect.any(Error), undefined);
    });

    test('should process non-image files without OCR', async () => {
      // Mock text file upload
      const textMulter = {
        array: jest.fn(() => (req, res, next) => {
          req.files = [
            {
              fieldname: 'files',
              originalname: 'document.txt',
              encoding: '7bit',
              mimetype: 'text/plain',
              size: 512,
              destination: 'uploads/',
              filename: 'document-123.txt',
              path: 'uploads/document-123.txt'
            }
          ];
          next();
        })
      };

      const textApp = express();
      textApp.use(express.json());
      textApp.post('/api/upload', textMulter.array('files', 10), async (req, res) => {
        const files = req.files;
        const processedFiles = [];

        for (const file of files) {
          let ocrResult = null;
          if (file.mimetype.startsWith('image/')) {
            ocrResult = await ocrService.processImage(file.path);
          }

          processedFiles.push({
            filename: file.originalname,
            size: file.size,
            type: file.mimetype,
            path: file.path,
            ocrResult
          });
        }

        res.json({
          success: true,
          message: 'Files uploaded successfully',
          files: processedFiles,
          warnings: []
        });
      });

      const response = await request(textApp).post('/api/upload').expect(200);

      expect(response.body.files[0].ocrResult).toBeNull();
      expect(ocrService.processImage).not.toHaveBeenCalled();
    });

    test('should log file operations', async () => {
      await request(app).post('/api/upload').expect(200);

      expect(logger.logFileOperation).toHaveBeenCalledWith('upload', 'test.jpg', 'test-user');
    });

    test('should validate file types and sizes', async () => {
      await request(app).post('/api/upload').expect(200);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith({
        fieldname: 'files',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: 'uploads/',
        filename: 'test-123.jpg',
        path: 'uploads/test-123.jpg'
      });
    });
  });

  describe('Error handling', () => {
    test('should handle unexpected errors', async () => {
      fileValidationService.validateFile.mockRejectedValue(new Error('Validation service error'));

      const response = await request(app).post('/api/upload').expect(500);

      expect(logger.error).toHaveBeenCalledWith('Upload error:', {
        error: 'Validation service error'
      });
      expect(errorService.formatErrorResponse).toHaveBeenCalled();
    });
  });
});
