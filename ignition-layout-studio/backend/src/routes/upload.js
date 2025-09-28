const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const fileValidationService = require('../services/fileValidationService');
const errorService = require('../services/errorService');
const logger = require('../services/loggerService');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.body.projectId || req.params.projectId;
    const uploadDir = path.join(__dirname, '../../uploads', projectId);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB (will be validated per category)
    files: 20 // Maximum 20 files
  },
  fileFilter: (req, file, cb) => {
    // Basic validation - detailed validation happens later
    const validation = fileValidationService.validateFile(file);

    if (validation.isValid) {
      cb(null, true);
    } else {
      const errorMessage = validation.errors.join('; ');
      cb(new Error(errorMessage));
    }
  }
});

// File upload endpoint
router.post('/:projectId', upload.array('files', 20), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
        code: 'NO_FILES_PROVIDED',
        message: 'Please select at least one file to upload.',
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    // Comprehensive file validation
    const validation = fileValidationService.validateFiles(files);

    if (!validation.isValid) {
      // Clean up uploaded files if validation fails
      await Promise.all(
        files.map(async file => {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            logger.error('Error cleaning up file after validation failure', { 
              file: file.filename, 
              error: err.message 
            });
          }
        })
      );

      return res.status(400).json({
        error: 'File validation failed',
        code: 'VALIDATION_FAILED',
        message: 'One or more files failed validation. Please check the file formats and sizes.',
        errors: validation.errors,
        warnings: validation.warnings,
        results: validation.results,
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    // Process uploaded files with additional content validation
    const processedFiles = await Promise.all(
      files.map(async (file, index) => {
        const validationResult = validation.results[index];

        const fileInfo = {
          id: uuidv4(),
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimeType: file.mimetype,
          extension: path.extname(file.originalname).toLowerCase(),
          category: validationResult.category,
          uploadedAt: new Date().toISOString(),
          validation: {
            isValid: validationResult.isValid,
            warnings: validationResult.warnings,
            metadata: validationResult.metadata
          }
        };

        // Additional content validation
        try {
          const contentValidation = await fileValidationService.validateFileContent(
            file.path,
            validationResult.category
          );

          if (contentValidation.warnings.length > 0) {
            fileInfo.validation.warnings.push(...contentValidation.warnings);
          }

          if (contentValidation.detectedType) {
            fileInfo.validation.detectedType = contentValidation.detectedType;
          }
        } catch (contentError) {
          logger.warn('Content validation failed for file', { 
            file: file.originalname, 
            error: contentError.message 
          });
          fileInfo.validation.warnings.push('Could not validate file content - file may be corrupted');
        }

        // Extract metadata based on file type
        if (fileInfo.category === 'image') {
          try {
            fileInfo.metadata = await extractImageMetadata(file.path);
          } catch (metadataError) {
            logger.warn('Error extracting image metadata', { 
              file: file.originalname, 
              error: metadataError.message 
            });
            fileInfo.validation.warnings.push('Could not extract image metadata');
          }
        }

        return fileInfo;
      })
    );

    // Update project with new files
    const Project = require('../models/Project');
    let project;
    
    try {
      project = await Project.load(projectId);
    } catch (projectError) {
      // Clean up uploaded files if project loading fails
      await Promise.all(
        files.map(async file => {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            logger.error('Error cleaning up file after project load failure', { 
              file: file.filename, 
              error: err.message 
            });
          }
        })
      );
      
      return res.status(404).json({
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID '${projectId}' does not exist or could not be loaded.`,
        projectId
      });
    }

    processedFiles.forEach(file => {
      project.addFile(file);
    });

    try {
      await project.save();
    } catch (saveError) {
      logger.error('Failed to save project after file upload', { 
        projectId, 
        error: saveError.message 
      });
      return res.status(500).json({
        error: 'Failed to save project',
        code: 'PROJECT_SAVE_FAILED',
        message: 'Files were uploaded but could not be saved to the project. Please try again.',
        details: saveError.message
      });
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(projectId).emit('files-uploaded', {
      files: processedFiles,
      summary: validation.summary
    });

    res.json({
      success: true,
      message: `Successfully uploaded ${processedFiles.length} file(s)`,
      files: processedFiles,
      summary: validation.summary,
      warnings: validation.warnings,
      projectId
    });
  } catch (error) {
    logger.error('File upload failed', { 
      error: error.message, 
      stack: error.stack,
      projectId: req.params.projectId
    });

    // Clean up files on error
    if (req.files) {
      await Promise.all(
        req.files.map(async file => {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            logger.error('Error cleaning up file after upload failure', { 
              file: file.filename, 
              error: err.message 
            });
          }
        })
      );
    }

    // Handle specific error types
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: 'One or more files exceed the maximum allowed size. Please reduce file size or compress files.',
        maxSize: '500MB',
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        message: 'Maximum 20 files allowed per upload. Please upload fewer files.',
        maxFiles: 20,
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field',
        code: 'UNEXPECTED_FILE_FIELD',
        message: 'Invalid file upload format. Please ensure you are uploading files correctly.',
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    // Default error response
    res.status(500).json({
      error: 'File upload failed',
      code: 'UPLOAD_FAILED',
      message: 'An unexpected error occurred during file upload. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      supportedFormats: fileValidationService.getSupportedFormatsDetails()
    });
  }
});

// Delete file endpoint
router.delete('/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const Project = require('../models/Project');
    let project;
    
    try {
      project = await Project.load(projectId);
    } catch (projectError) {
      return res.status(404).json({ 
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID '${projectId}' does not exist or could not be loaded.`,
        projectId
      });
    }

    const file = project.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ 
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
        message: `File with ID '${fileId}' was not found in the project.`,
        fileId
      });
    }

    // Delete physical file
    try {
      await fs.unlink(file.path);
    } catch (err) {
      logger.warn('Error deleting physical file', { 
        file: file.originalName, 
        path: file.path,
        error: err.message 
      });
    }

    // Remove from project
    project.files = project.files.filter(f => f.id !== fileId);
    
    try {
      await project.save();
    } catch (saveError) {
      logger.error('Failed to save project after file deletion', { 
        projectId, 
        fileId,
        error: saveError.message 
      });
      return res.status(500).json({
        error: 'Failed to update project',
        code: 'PROJECT_SAVE_FAILED',
        message: 'The file was deleted but the project could not be updated. Please refresh the page.',
        details: saveError.message
      });
    }

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('file-deleted', fileId);

    res.json({ 
      success: true, 
      fileId,
      message: `File '${file.originalName}' was successfully deleted.`
    });
  } catch (error) {
    logger.error('File deletion failed', { 
      error: error.message, 
      stack: error.stack,
      projectId: req.params.projectId,
      fileId: req.params.fileId
    });
    
    res.status(500).json({
      error: 'File deletion failed',
      code: 'DELETE_FAILED',
      message: 'An unexpected error occurred while deleting the file. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get file info endpoint
router.get('/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const Project = require('../models/Project');
    let project;
    
    try {
      project = await Project.load(projectId);
    } catch (projectError) {
      return res.status(404).json({ 
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID '${projectId}' does not exist or could not be loaded.`,
        projectId
      });
    }

    const file = project.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ 
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
        message: `File with ID '${fileId}' was not found in the project.`,
        fileId
      });
    }

    res.json(file);
  } catch (error) {
    logger.error('Failed to get file info', { 
      error: error.message, 
      stack: error.stack,
      projectId: req.params.projectId,
      fileId: req.params.fileId
    });
    
    res.status(500).json({
      error: 'Failed to get file info',
      code: 'GET_FILE_FAILED',
      message: 'An unexpected error occurred while retrieving file information. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get supported file formats endpoint
router.get('/formats', (req, res) => {
  try {
    res.json({
      success: true,
      supportedFormats: fileValidationService.getSupportedFormatsDetails(),
      allExtensions: fileValidationService.getSupportedFormatsString()
    });
  } catch (error) {
    logger.error('Failed to get supported formats', { 
      error: error.message, 
      stack: error.stack
    });
    
    res.status(500).json({
      error: 'Failed to get supported formats',
      code: 'GET_FORMATS_FAILED',
      message: 'An unexpected error occurred while retrieving supported file formats. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Validate files before upload (preview validation)
router.post('/validate', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files provided for validation',
        code: 'NO_FILES_PROVIDED',
        message: 'Please select at least one file to validate.',
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    const validation = fileValidationService.validateFiles(files);

    // Clean up uploaded files (this is just validation)
    await Promise.all(
      files.map(async file => {
        try {
          await fs.unlink(file.path);
        } catch (err) {
          logger.error('Error cleaning up validation file', { 
            file: file.filename, 
            error: err.message 
          });
        }
      })
    );

    res.json({
      success: true,
      validation,
      supportedFormats: fileValidationService.getSupportedFormatsDetails()
    });
  } catch (error) {
    logger.error('File validation failed', { 
      error: error.message, 
      stack: error.stack
    });

    // Clean up files on error
    if (req.files) {
      await Promise.all(
        req.files.map(async file => {
          try {
            await fs.unlink(file.path);
          } catch (err) {
            logger.error('Error cleaning up validation file after error', { 
              file: file.filename, 
              error: err.message 
            });
          }
        })
      );
    }

    // Handle specific multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        message: 'One or more files exceed the maximum allowed size for validation.',
        maxSize: '500MB',
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        code: 'TOO_MANY_FILES',
        message: 'Maximum 20 files allowed for validation.',
        maxFiles: 20,
        supportedFormats: fileValidationService.getSupportedFormatsDetails()
      });
    }

    res.status(500).json({
      error: 'File validation failed',
      code: 'VALIDATION_FAILED',
      message: 'An unexpected error occurred during file validation. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      supportedFormats: fileValidationService.getSupportedFormatsDetails()
    });
  }
});

// Helper function to extract image metadata
async function extractImageMetadata(filePath) {
  const sharp = require('sharp');
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    console.error('Error extracting image metadata:', error);
    return {};
  }
}

module.exports = router;
