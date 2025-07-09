const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

class OCRService {
  constructor() {
    this.paddleOCRPath = process.env.PADDLE_OCR_MCP_PATH || null;
    this.useMockOCR = !this.paddleOCRPath;
    
    if (this.useMockOCR) {
      console.warn('PaddleOCR MCP path not configured. Using mock OCR service.');
    } else {
      console.log('PaddleOCR MCP configured at:', this.paddleOCRPath);
    }
  }

  async processImage(imagePath) {
    if (this.useMockOCR) {
      return this.mockOCRProcess(imagePath);
    }
    
    try {
      // Call PaddleOCR MCP
      const result = await this.callPaddleOCRMCP(imagePath);
      return this.parseOCRResult(result);
    } catch (error) {
      console.error('PaddleOCR MCP failed, falling back to mock:', error);
      return this.mockOCRProcess(imagePath);
    }
  }

  async callPaddleOCRMCP(imagePath) {
    return new Promise((resolve, reject) => {
      const args = [
        'ocr',
        '--image', imagePath,
        '--output-format', 'json'
      ];

      const paddleProcess = spawn(this.paddleOCRPath, args);
      let stdout = '';
      let stderr = '';

      paddleProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      paddleProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      paddleProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`PaddleOCR process exited with code ${code}: ${stderr}`));
        } else {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse OCR output: ${parseError.message}`));
          }
        }
      });

      paddleProcess.on('error', (error) => {
        reject(new Error(`Failed to start PaddleOCR process: ${error.message}`));
      });
    });
  }

  parseOCRResult(ocrResult) {
    const texts = [];
    const components = [];

    // Parse PaddleOCR output format
    if (ocrResult.results && Array.isArray(ocrResult.results)) {
      ocrResult.results.forEach((item) => {
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
      return [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys)
      ];
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
}

module.exports = new OCRService();