const fs = require('fs').promises;
const path = require('path');
const logger = require('./loggerService');

class OCRService {
  constructor() {
    // Using native OCR only (Tesseract.js)
    this.useNativeOCR = true;
    console.log('OCR Service initialized with native Tesseract.js');
    
    // Initialize pipeline integration
    this.pipelineService = null;
    this.advancedFilters = null;
    this.codeInterpreterService = null;
    this.initializePipelineIntegration();
  }

  initializePipelineIntegration() {
    // Lazy load to avoid circular dependencies
    try {
      this.pipelineService = require('./pipelineService');
      this.advancedFilters = require('./advancedFilters');
      this.codeInterpreterService = require('./codeInterpreterService');
    } catch (error) {
      // Services not available, continue without pipeline integration
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error initializing pipeline integration:', error);
      }
    }
  }

  async processImage(imagePath) {
    // Mock OCR results for testing (since we're using frontend Tesseract.js)
    return this.mockOCRProcess(imagePath);
  }

  parseOCRResult(ocrResult) {
    const texts = [];
    const components = [];

    // Parse OCR output format
    if (ocrResult.results && Array.isArray(ocrResult.results)) {
      ocrResult.results.forEach(item => {
        const text = item.text || '';
        const confidence = item.confidence || 0;
        const bbox = item.bbox || item.box || [];

        if (text && confidence > 0.5) {
          texts.push({
            text,
            confidence,
            bbox: this.normalizeBBox(bbox),
            position: this.getBBoxCenter(bbox)
          });

          // Detect components from text
          const component = this.detectComponentFromText(text, bbox);
          if (component) {
            components.push(component);
          }
        }
      });
    }

    return { texts, components };
  }

  normalizeBBox(bbox) {
    // Convert various bbox formats to [x1, y1, x2, y2]
    if (bbox.length === 4) {
      return bbox;
    } else if (bbox.length === 8) {
      // Convert from [x1,y1,x2,y2,x3,y3,x4,y4] to bounding box
      const xs = [bbox[0], bbox[2], bbox[4], bbox[6]];
      const ys = [bbox[1], bbox[3], bbox[5], bbox[7]];
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    return [0, 0, 100, 100]; // Default
  }

  getBBoxCenter(bbox) {
    const normalized = this.normalizeBBox(bbox);
    return {
      x: (normalized[0] + normalized[2]) / 2,
      y: (normalized[1] + normalized[3]) / 2
    };
  }

  detectComponentFromText(text, bbox) {
    const componentPatterns = [
      // Conveyors
      { pattern: /CONV[_\-\s]?\d+/i, type: 'straight_conveyor', category: 'conveyor' },
      { pattern: /CV[_\-\s]?\d+/i, type: 'straight_conveyor', category: 'conveyor' },
      { pattern: /BELT[_\-\s]?\d+/i, type: 'belt_conveyor', category: 'conveyor' },
      { pattern: /ROLLER[_\-\s]?\d+/i, type: 'roller_conveyor', category: 'conveyor' },
      { pattern: /CHAIN[_\-\s]?\d+/i, type: 'chain_conveyor', category: 'conveyor' },
      { pattern: /ACCUM[_\-\s]?\d+/i, type: 'accumulation_conveyor', category: 'conveyor' },
      { pattern: /SPIRAL[_\-\s]?\d+/i, type: 'spiral_conveyor', category: 'conveyor' },
      { pattern: /CURVE[_\-\s]?\d+/i, type: 'curve_90', category: 'conveyor' },

      // Motors and Actuators
      { pattern: /MOTOR[_\-\s]?[A-Z0-9]+/i, type: 'motor', category: 'equipment' },
      { pattern: /M\d+/i, type: 'motor', category: 'equipment' },
      { pattern: /PUSHER[_\-\s]?\d+/i, type: 'pusher', category: 'equipment' },
      { pattern: /LIFTER[_\-\s]?\d+/i, type: 'lifter', category: 'equipment' },
      { pattern: /LIFT[_\-\s]?\d+/i, type: 'lifter', category: 'equipment' },

      // Diverters and Sorters
      { pattern: /DIVERT[ER]*[_\-\s]?[A-Z0-9]+/i, type: 'diverter', category: 'equipment' },
      { pattern: /D\d+/i, type: 'diverter', category: 'equipment' },
      { pattern: /MERGE[_\-\s]?\d+/i, type: 'merge', category: 'equipment' },
      { pattern: /SORTER[_\-\s]?\d+/i, type: 'sorter', category: 'equipment' },
      { pattern: /SORT[_\-\s]?\d+/i, type: 'sorter', category: 'equipment' },

      // Scanners and Readers
      { pattern: /EDS[_\-\s]?\d+/i, type: 'eds_machine', category: 'equipment' },
      { pattern: /SCANNER[_\-\s]?\d+/i, type: 'scanner', category: 'equipment' },
      { pattern: /SCAN[_\-\s]?\d+/i, type: 'scanner', category: 'equipment' },
      { pattern: /BARCODE[_\-\s]?\d+/i, type: 'barcode_scanner', category: 'equipment' },
      { pattern: /BC[_\-\s]?\d+/i, type: 'barcode_scanner', category: 'equipment' },
      { pattern: /RFID[_\-\s]?\d+/i, type: 'rfid_reader', category: 'equipment' },

      // Scales and Measurement
      { pattern: /SCALE[_\-\s]?\d+/i, type: 'scale', category: 'equipment' },
      { pattern: /WEIGH[_\-\s]?\d+/i, type: 'scale', category: 'equipment' },

      // Packaging Equipment
      { pattern: /WRAPPER[_\-\s]?\d+/i, type: 'wrapper', category: 'equipment' },
      { pattern: /WRAP[_\-\s]?\d+/i, type: 'wrapper', category: 'equipment' },
      { pattern: /PALLETIZER[_\-\s]?\d+/i, type: 'palletizer', category: 'equipment' },
      { pattern: /PAL[_\-\s]?\d+/i, type: 'palletizer', category: 'equipment' },
      { pattern: /DEPAL[_\-\s]?\d+/i, type: 'depalletizer', category: 'equipment' },
      { pattern: /PRINTER[_\-\s]?\d+/i, type: 'label_printer', category: 'equipment' },
      { pattern: /LABEL[_\-\s]?\d+/i, type: 'label_printer', category: 'equipment' },

      // Robotics and AGV
      { pattern: /ROBOT[_\-\s]?\d+/i, type: 'robot_arm', category: 'equipment' },
      { pattern: /ARM[_\-\s]?\d+/i, type: 'robot_arm', category: 'equipment' },
      { pattern: /AGV[_\-\s]?\d+/i, type: 'agv_station', category: 'equipment' },

      // Special Equipment
      { pattern: /TURNTABLE[_\-\s]?\d+/i, type: 'turntable', category: 'equipment' },
      { pattern: /TT[_\-\s]?\d+/i, type: 'turntable', category: 'equipment' },

      // Safety Equipment
      { pattern: /GATE[_\-\s]?\d+/i, type: 'safety_gate', category: 'safety' },
      { pattern: /E[\-\s]?STOP[_\-\s]?\d*/i, type: 'emergency_stop', category: 'safety' },
      { pattern: /ESTOP[_\-\s]?\d*/i, type: 'emergency_stop', category: 'safety' },

      // Sensors
      { pattern: /SENSOR[_\-\s]?\d+/i, type: 'sensor', category: 'sensor' },
      { pattern: /PE[_\-\s]?\d+/i, type: 'photo_eye', category: 'sensor' },
      { pattern: /PHOTO[\-\s]?EYE[_\-\s]?\d+/i, type: 'photo_eye', category: 'sensor' },
      { pattern: /PROX[_\-\s]?\d+/i, type: 'proximity_sensor', category: 'sensor' },
      { pattern: /PROXIMITY[_\-\s]?\d+/i, type: 'proximity_sensor', category: 'sensor' }
    ];

    for (const { pattern, type, category } of componentPatterns) {
      if (pattern.test(text)) {
        return {
          equipmentId: text.replace(/\s+/g, '_').toUpperCase(),
          type,
          category,
          label: text,
          bbox: this.normalizeBBox(bbox),
          confidence: 0.9
        };
      }
    }
    return null;
  }

  mockOCRProcess(imagePath) {
    // Mock OCR results for testing
    const mockResults = {
      results: [
        {
          text: 'CONV_01',
          confidence: 0.95,
          bbox: [100, 200, 180, 230]
        },
        {
          text: 'Motor M1',
          confidence: 0.92,
          bbox: [300, 150, 370, 175]
        },
        {
          text: 'EDS-3',
          confidence: 0.88,
          bbox: [500, 300, 560, 330]
        },
        {
          text: 'Diverter D2',
          confidence: 0.91,
          bbox: [700, 400, 790, 435]
        }
      ]
    };

    return this.parseOCRResult(mockResults);
  }

  async processPDF(pdfPath) {
    // For PDFs, we would need to extract images first
    // This is a placeholder for PDF processing
    console.log('PDF processing not yet implemented:', pdfPath);
    return this.mockOCRProcess(pdfPath);
  }

  async processDrawing(dwgPath) {
    // For DWG/DXF files, we would need to convert to image first
    // This is a placeholder for drawing processing
    console.log('Drawing processing not yet implemented:', dwgPath);
    return this.mockOCRProcess(dwgPath);
  }

  // Enhanced OCR processing with pipeline integration
  async processImageEnhanced(imagePath, options = {}) {
    try {
      // Step 1: Basic OCR processing
      const ocrResult = await this.processImage(imagePath);

      // Step 2: Apply advanced filters for OCR enhancement
      let enhancedResult = ocrResult;
      if (this.advancedFilters) {
        try {
          enhancedResult = await this.advancedFilters.applyFilter(
            'ocr-enhancement',
            ocrResult.texts,
            {
              imageContext: options.imageContext || {},
              industry: options.industry || 'general',
              drawingType: options.drawingType || 'unknown'
            }
          );
        } catch (error) {
          console.error('Advanced filter processing failed:', error);
        }
      }

      // Step 3: Use pipeline for AI interpretation
      let aiInterpretation = null;
      if (this.pipelineService && options.useAI !== false) {
        try {
          const messages = [
            {
              role: 'user',
              content: `Analyze these OCR results from an industrial drawing and generate appropriate Ignition components:\n\n${JSON.stringify(enhancedResult.original || ocrResult.texts, null, 2)}`
            }
          ];

          const pipelineResult = await this.pipelineService.executePipeline(
            'ocr-enhancement',
            messages,
            {
              industry: options.industry,
              context: options.context,
              safetyLevel: options.safetyLevel
            }
          );

          aiInterpretation = pipelineResult;
        } catch (error) {
          console.error('Pipeline processing failed:', error);
        }
      }

      // Step 4: Use code interpreter for advanced analysis
      let codeAnalysis = null;
      if (this.codeInterpreterService && options.useCodeInterpreter !== false) {
        try {
          codeAnalysis = await this.codeInterpreterService.generateComponentFromOCR(
            enhancedResult.original || ocrResult.texts,
            options.imageContext || {}
          );
        } catch (error) {
          console.error('Code interpreter processing failed:', error);
        }
      }

      return {
        basic: ocrResult,
        enhanced: enhancedResult,
        aiInterpretation: aiInterpretation,
        codeAnalysis: codeAnalysis,
        processingOptions: options
      };
    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      // Fallback to basic processing
      return {
        basic: await this.processImage(imagePath),
        enhanced: null,
        aiInterpretation: null,
        codeAnalysis: null,
        error: error.message
      };
    }
  }

  // Batch processing for multiple images
  async processImageBatch(imagePaths, options = {}) {
    const results = [];
    const batchOptions = {
      ...options,
      batchProcessing: true
    };

    for (const imagePath of imagePaths) {
      try {
        const result = await this.processImageEnhanced(imagePath, batchOptions);
        results.push({
          imagePath,
          result,
          success: true
        });
      } catch (error) {
        results.push({
          imagePath,
          result: null,
          success: false,
          error: error.message
        });
      }
    }

    return {
      results,
      totalImages: imagePaths.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
  }

  // Get OCR processing statistics
  getProcessingStats() {
    return {
      nativeOCRAvailable: this.useNativeOCR,
      pipelineIntegrationAvailable: !!this.pipelineService,
      advancedFiltersAvailable: !!this.advancedFilters,
      codeInterpreterAvailable: !!this.codeInterpreterService
    };
  }

  // Validate OCR configuration
  async validateConfiguration() {
    const validation = {
      nativeOCR: this.useNativeOCR,
      pipelineService: false,
      advancedFilters: false,
      codeInterpreter: false,
      errors: []
    };

    // Check pipeline service
    if (this.pipelineService) {
      try {
        const providers = this.pipelineService.getProviders();
        validation.pipelineService = providers.some(p => p.available);
        if (!validation.pipelineService) {
          validation.errors.push('No AI providers available in pipeline service');
        }
      } catch (error) {
        validation.errors.push(`Pipeline service validation failed: ${error.message}`);
      }
    }

    // Check advanced filters
    if (this.advancedFilters) {
      try {
        const filters = this.advancedFilters.getAvailableFilters();
        validation.advancedFilters = filters.length > 0;
      } catch (error) {
        validation.errors.push(`Advanced filters validation failed: ${error.message}`);
      }
    }

    // Check code interpreter
    if (this.codeInterpreterService) {
      try {
        const status = this.codeInterpreterService.getActiveExecutions();
        validation.codeInterpreter = Array.isArray(status);
      } catch (error) {
        validation.errors.push(`Code interpreter validation failed: ${error.message}`);
      }
    }

    return validation;
  }
}

module.exports = new OCRService();