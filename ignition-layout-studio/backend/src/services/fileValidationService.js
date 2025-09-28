const path = require('path');
const fs = require('fs').promises;

class FileValidationService {
  constructor() {
    this.supportedFormats = {
      // CAD Files
      cad: {
        extensions: ['.dwg', '.dxf'],
        mimeTypes: ['application/acad', 'image/vnd.dwg', 'application/dxf'],
        maxSize: 200 * 1024 * 1024, // 200MB
        description: 'AutoCAD Drawing files for importing layout designs'
      },

      // Images for OCR
      image: {
        extensions: ['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp', '.svg'],
        mimeTypes: [
          'image/png',
          'image/jpeg',
          'image/tiff',
          'image/bmp',
          'image/webp',
          'image/svg+xml'
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        description: 'Images containing HMI layouts for OCR processing and vector graphics'
      },

      // PDF Documents
      pdf: {
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        maxSize: 100 * 1024 * 1024, // 100MB
        description: 'PDF documents with layout diagrams or specifications'
      },

      // Data Files
      data: {
        extensions: ['.xlsx', '.xls', '.csv', '.json'],
        mimeTypes: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/json'
        ],
        maxSize: 25 * 1024 * 1024, // 25MB
        description: 'Data files containing component specifications or tag lists'
      },

      // Document Files
      document: {
        extensions: ['.doc', '.docx', '.rtf', '.txt'],
        mimeTypes: [
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/rtf',
          'text/plain'
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        description:
          'Document files containing specifications, procedures, or technical documentation'
      },

      // Archive Files
      archive: {
        extensions: ['.zip', '.rar', '.7z'],
        mimeTypes: [
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed'
        ],
        maxSize: 500 * 1024 * 1024, // 500MB
        description: 'Compressed archives containing multiple project files'
      }
    };

    this.dangerousExtensions = [
      '.exe',
      '.bat',
      '.cmd',
      '.com',
      '.scr',
      '.pif',
      '.vbs',
      '.js',
      '.jar',
      '.app',
      '.deb',
      '.pkg',
      '.dmg',
      '.iso',
      '.msi',
      '.dll',
      '.so',
      '.dylib'
    ];

    this.commonMistakes = {
      '.ppt': 'PowerPoint files are not supported. Please export as PDF or images.',
      '.pptx': 'PowerPoint files are not supported. Please export as PDF or images.',
      '.gif': 'GIF files are not supported for OCR. Please convert to PNG or JPEG.',
      '.ico': 'Icon files are not supported. Please use PNG or JPEG format.',
      '.eps': 'EPS files are not supported. Please convert to PDF or PNG.',
      '.ai': 'Adobe Illustrator files are not supported. Please export as PDF or PNG.',
      '.psd': 'Photoshop files are not supported. Please export as PNG or JPEG.',
      '.sketch': 'Sketch files are not supported. Please export as PNG or PDF.'
    };
  }

  /**
   * Validate a single file
   */
  validateFile(file) {
    const errors = [];
    const warnings = [];

    // Basic file validation
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors, warnings };
    }

    if (!file.originalname) {
      errors.push('File has no name');
      return { isValid: false, errors, warnings };
    }

    // Extension validation
    const extension = path.extname(file.originalname).toLowerCase();
    const fileName = path.basename(file.originalname, extension);

    if (!extension) {
      errors.push('File has no extension. Please ensure your file has a proper file extension.');
      return { isValid: false, errors, warnings };
    }

    // Check for dangerous files
    if (this.dangerousExtensions.includes(extension)) {
      errors.push(`Executable files (${extension}) are not allowed for security reasons.`);
      return { isValid: false, errors, warnings };
    }

    // Check for common mistakes
    if (this.commonMistakes[extension]) {
      errors.push(this.commonMistakes[extension]);
      return { isValid: false, errors, warnings };
    }

    // Find supported category
    const category = this.findFileCategory(extension, file.mimetype);

    if (!category) {
      const suggestion = this.suggestAlternative(extension);
      errors.push(`File format ${extension} is not supported. ${suggestion}`);
      return {
        isValid: false,
        errors,
        warnings,
        suggestedFormats: this.getSupportedFormatsString()
      };
    }

    // Size validation
    const maxSize = this.supportedFormats[category].maxSize;
    if (file.size > maxSize) {
      errors.push(
        `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size ` +
          `for ${category} files (${this.formatFileSize(maxSize)}). ` +
          `Please compress or reduce the file size.`
      );
    }

    // MIME type validation
    const expectedMimeTypes = this.supportedFormats[category].mimeTypes;
    if (file.mimetype && !expectedMimeTypes.includes(file.mimetype)) {
      warnings.push(
        `File MIME type (${file.mimetype}) doesn't match expected types for ${extension} files. ` +
          `This might indicate a renamed file or corruption.`
      );
    }

    // File name validation
    if (fileName.length === 0) {
      errors.push('File name cannot be empty');
    }

    if (fileName.length > 255) {
      errors.push('File name is too long (maximum 255 characters)');
    }

    // Check for special characters that might cause issues
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(fileName)) {
      warnings.push(
        'File name contains special characters that might cause issues. Consider renaming the file.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      category,
      metadata: {
        extension,
        category,
        maxAllowedSize: maxSize,
        description: this.supportedFormats[category].description
      }
    };
  }

  /**
   * Validate multiple files
   */
  validateFiles(files) {
    if (!Array.isArray(files)) {
      return {
        isValid: false,
        errors: ['Invalid file list provided'],
        warnings: [],
        results: []
      };
    }

    if (files.length === 0) {
      return {
        isValid: false,
        errors: ['No files provided'],
        warnings: [],
        results: []
      };
    }

    if (files.length > 20) {
      return {
        isValid: false,
        errors: ['Too many files. Maximum 20 files allowed per upload.'],
        warnings: [],
        results: []
      };
    }

    const results = files.map((file, index) => ({
      index,
      fileName: file.originalname,
      ...this.validateFile(file)
    }));

    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    const isValid = results.every(r => r.isValid);

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalSize = 1024 * 1024 * 1024; // 1GB total

    if (totalSize > maxTotalSize) {
      allErrors.push(
        `Total upload size (${this.formatFileSize(totalSize)}) exceeds maximum ` +
          `allowed total size (${this.formatFileSize(maxTotalSize)})`
      );
    }

    return {
      isValid: isValid && allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      results,
      totalSize,
      summary: this.generateUploadSummary(results)
    };
  }

  /**
   * Find file category based on extension and MIME type
   */
  findFileCategory(extension, mimeType) {
    for (const [category, config] of Object.entries(this.supportedFormats)) {
      if (config.extensions.includes(extension)) {
        return category;
      }
      if (mimeType && config.mimeTypes.includes(mimeType)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Suggest alternative formats for unsupported files
   */
  suggestAlternative(extension) {
    const suggestions = {
      '.ppt': 'Try exporting slides as PDF or individual images (PNG/JPEG).',
      '.pptx': 'Try exporting slides as PDF or individual images (PNG/JPEG).',
      '.gif': 'Try converting to PNG or JPEG format.',
      '.webm': 'Video files are not supported. Extract still frames as images.',
      '.mp4': 'Video files are not supported. Extract still frames as images.',
      '.avi': 'Video files are not supported. Extract still frames as images.'
    };

    return (
      suggestions[extension] ||
      `Please use one of the supported formats: ${this.getSupportedFormatsString()}`
    );
  }

  /**
   * Get formatted string of all supported formats
   */
  getSupportedFormatsString() {
    const allExtensions = Object.values(this.supportedFormats)
      .flatMap(config => config.extensions)
      .sort();

    return allExtensions.join(', ');
  }

  /**
   * Get detailed format information
   */
  getSupportedFormatsDetails() {
    return Object.entries(this.supportedFormats).map(([category, config]) => ({
      category,
      extensions: config.extensions,
      maxSize: this.formatFileSize(config.maxSize),
      description: config.description
    }));
  }

  /**
   * Format file size in human-readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate upload summary
   */
  generateUploadSummary(results) {
    const categories = {};
    const validFiles = results.filter(r => r.isValid);
    const invalidFiles = results.filter(r => !r.isValid);

    validFiles.forEach(result => {
      if (result.category) {
        categories[result.category] = (categories[result.category] || 0) + 1;
      }
    });

    return {
      total: results.length,
      valid: validFiles.length,
      invalid: invalidFiles.length,
      categories,
      hasWarnings: results.some(r => r.warnings.length > 0)
    };
  }

  /**
   * Validate file content (for additional security)
   */
  async validateFileContent(filePath, expectedCategory) {
    try {
      const stats = await fs.stat(filePath);

      // Check if file is actually empty
      if (stats.size === 0) {
        return {
          isValid: false,
          errors: ['File is empty'],
          warnings: []
        };
      }

      // Basic header validation for common formats
      const buffer = Buffer.alloc(16);
      const fd = await fs.open(filePath, 'r');
      await fd.read(buffer, 0, 16, 0);
      await fd.close();

      const headerValidation = this.validateFileHeader(buffer, expectedCategory);

      return headerValidation;
    } catch (error) {
      return {
        isValid: false,
        errors: [`File validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate file header/magic bytes
   */
  validateFileHeader(buffer, expectedCategory) {
    const errors = [];
    const warnings = [];

    // Common file signatures
    const signatures = {
      pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
      png: [0x89, 0x50, 0x4e, 0x47], // PNG
      jpeg: [0xff, 0xd8, 0xff], // JPEG
      zip: [0x50, 0x4b, 0x03, 0x04], // ZIP (also XLSX, DOCX)
      tiff: [0x49, 0x49, 0x2a, 0x00], // TIFF
      doc: [0xd0, 0xcf, 0x11, 0xe0], // MS Office (DOC)
      rtf: [0x7b, 0x5c, 0x72, 0x74], // RTF
      svg: [0x3c, 0x73, 0x76, 0x67] // <svg
    };

    let detectedType = null;

    for (const [type, signature] of Object.entries(signatures)) {
      if (signature.every((byte, index) => buffer[index] === byte)) {
        detectedType = type;
        break;
      }
    }

    // Special cases for ZIP-based files
    if (detectedType === 'zip') {
      if (expectedCategory === 'data') {
        detectedType = 'xlsx';
      } else if (expectedCategory === 'document') {
        detectedType = 'docx';
      }
    }

    if (detectedType && expectedCategory) {
      const categoryMappings = {
        pdf: 'pdf',
        png: 'image',
        jpeg: 'image',
        tiff: 'image',
        svg: 'image',
        xlsx: 'data',
        docx: 'document',
        doc: 'document',
        rtf: 'document',
        zip: 'archive'
      };

      if (categoryMappings[detectedType] !== expectedCategory) {
        warnings.push(
          `File header suggests ${detectedType} format, but extension indicates ${expectedCategory}. ` +
            `This might be a renamed file.`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedType
    };
  }
}

module.exports = new FileValidationService();
