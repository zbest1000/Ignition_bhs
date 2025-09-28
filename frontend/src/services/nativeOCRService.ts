import Tesseract, { Worker, RecognizeResult } from 'tesseract.js';
import { Component, OCRResult, TextBlock } from '../types';

interface OCRProgress {
  status: string;
  progress: number;
  userJobId?: string;
}

interface ComponentPattern {
  pattern: RegExp;
  type: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  extractId?: (match: RegExpMatchArray) => string;
}

export class NativeOCRService {
  private worker: Worker | null = null;
  private isInitialized = false;
  private progressCallbacks: Map<string, (progress: OCRProgress) => void> = new Map();

  // Component detection patterns for industrial equipment
  private componentPatterns: ComponentPattern[] = [
    // Conveyors
    {
      pattern: /CONV[_\-\s]?(\d+|[A-Z]\d+)/gi,
      type: 'straight-conveyor',
      category: 'conveyor',
      defaultWidth: 200,
      defaultHeight: 50,
      extractId: (match) => match[1]
    },
    {
      pattern: /CV[_\-\s]?(\d+)/gi,
      type: 'straight-conveyor',
      category: 'conveyor',
      defaultWidth: 200,
      defaultHeight: 50,
      extractId: (match) => match[1]
    },
    {
      pattern: /CURVE[_\-\s]?(\d+|[A-Z]\d+)/gi,
      type: 'curved-conveyor',
      category: 'conveyor',
      defaultWidth: 150,
      defaultHeight: 150,
      extractId: (match) => match[1]
    },
    // Motors
    {
      pattern: /MOTOR[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.motor',
      category: 'equipment',
      defaultWidth: 80,
      defaultHeight: 80,
      extractId: (match) => match[1]
    },
    {
      pattern: /M[_\-]?(\d+)(?!\d)/gi,
      type: 'perspective.motor',
      category: 'equipment',
      defaultWidth: 80,
      defaultHeight: 80,
      extractId: (match) => match[1]
    },
    // Pumps
    {
      pattern: /PUMP[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.pump',
      category: 'equipment',
      defaultWidth: 100,
      defaultHeight: 100,
      extractId: (match) => match[1]
    },
    {
      pattern: /P[_\-]?(\d+)(?!\d)/gi,
      type: 'perspective.pump',
      category: 'equipment',
      defaultWidth: 100,
      defaultHeight: 100,
      extractId: (match) => match[1]
    },
    // Valves
    {
      pattern: /VALVE[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.valve',
      category: 'equipment',
      defaultWidth: 60,
      defaultHeight: 60,
      extractId: (match) => match[1]
    },
    {
      pattern: /V[_\-]?(\d+)(?!\d)/gi,
      type: 'perspective.valve',
      category: 'equipment',
      defaultWidth: 60,
      defaultHeight: 60,
      extractId: (match) => match[1]
    },
    // Tanks
    {
      pattern: /TANK[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.cylindrical-tank',
      category: 'storage',
      defaultWidth: 150,
      defaultHeight: 200,
      extractId: (match) => match[1]
    },
    {
      pattern: /T[_\-]?(\d+)(?!\d)/gi,
      type: 'perspective.cylindrical-tank',
      category: 'storage',
      defaultWidth: 150,
      defaultHeight: 200,
      extractId: (match) => match[1]
    },
    // Vessels
    {
      pattern: /VESSEL[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.vessel',
      category: 'storage',
      defaultWidth: 120,
      defaultHeight: 180,
      extractId: (match) => match[1]
    },
    // Pipes
    {
      pattern: /PIPE[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.pipe',
      category: 'piping',
      defaultWidth: 200,
      defaultHeight: 20,
      extractId: (match) => match[1]
    },
    // Diverters
    {
      pattern: /DIVERTER[_\-\s]?(\d+)/gi,
      type: 'perspective.conveyor',
      category: 'conveyor',
      defaultWidth: 150,
      defaultHeight: 100,
      extractId: (match) => match[1]
    },
    {
      pattern: /DIV[_\-\s]?(\d+)/gi,
      type: 'perspective.conveyor',
      category: 'conveyor',
      defaultWidth: 150,
      defaultHeight: 100,
      extractId: (match) => match[1]
    },
    // Mergers
    {
      pattern: /MERGE[_\-\s]?(\d+)/gi,
      type: 'perspective.conveyor',
      category: 'conveyor',
      defaultWidth: 150,
      defaultHeight: 100,
      extractId: (match) => match[1]
    },
    // Sensors
    {
      pattern: /SENSOR[_\-\s]?([A-Z]?\d+)/gi,
      type: 'perspective.symbol',
      category: 'instrumentation',
      defaultWidth: 40,
      defaultHeight: 40,
      extractId: (match) => match[1]
    },
    {
      pattern: /S[_\-]?(\d+)(?!\d)/gi,
      type: 'perspective.symbol',
      category: 'instrumentation',
      defaultWidth: 40,
      defaultHeight: 40,
      extractId: (match) => match[1]
    },
    // HMI/Control Panels
    {
      pattern: /HMI[_\-\s]?(\d+)/gi,
      type: 'perspective.container',
      category: 'control',
      defaultWidth: 200,
      defaultHeight: 150,
      extractId: (match) => match[1]
    },
    {
      pattern: /PANEL[_\-\s]?(\d+)/gi,
      type: 'perspective.container',
      category: 'control',
      defaultWidth: 180,
      defaultHeight: 240,
      extractId: (match) => match[1]
    },
  ];

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await Tesseract.createWorker({
        logger: (m) => {
          // Handle progress updates
          if (m.status && m.progress !== undefined) {
            this.notifyProgress(m.userJobId || 'default', {
              status: m.status,
              progress: m.progress,
              userJobId: m.userJobId
            });
          }
          console.log('OCR Progress:', m);
        },
        errorHandler: (error) => {
          console.error('OCR Error:', error);
        }
      });

      // Load language data - using English by default
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');

      // Set OCR parameters for better accuracy on technical drawings
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/.() ',
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
        preserve_interword_spaces: '1',
      });

      this.isInitialized = true;
      console.log('Native OCR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  private notifyProgress(jobId: string, progress: OCRProgress): void {
    const callback = this.progressCallbacks.get(jobId);
    if (callback) {
      callback(progress);
    }
  }

  public onProgress(jobId: string, callback: (progress: OCRProgress) => void): void {
    this.progressCallbacks.set(jobId, callback);
  }

  public removeProgressListener(jobId: string): void {
    this.progressCallbacks.delete(jobId);
  }

  public async processImage(
    imageUrl: string,
    options: {
      jobId?: string;
      preprocessImage?: boolean;
      detectComponents?: boolean;
      language?: string;
    } = {}
  ): Promise<OCRResult> {
    const {
      jobId = 'default',
      preprocessImage = true,
      detectComponents = true,
      language = 'eng'
    } = options;

    try {
      // Ensure worker is initialized
      if (!this.isInitialized || !this.worker) {
        await this.initializeWorker();
      }

      if (!this.worker) {
        throw new Error('OCR worker initialization failed');
      }

      // Preprocess image if needed
      let processedImageUrl = imageUrl;
      if (preprocessImage) {
        processedImageUrl = await this.preprocessImage(imageUrl);
      }

      // Set language if different
      if (language !== 'eng') {
        await this.worker.loadLanguage(language);
        await this.worker.initialize(language);
      }

      // Perform OCR
      const result = await this.worker.recognize(processedImageUrl, {
        rotateAuto: true,
      });

      // Convert Tesseract result to our format
      const ocrResult = this.convertToOCRResult(result);

      // Detect components if requested
      if (detectComponents) {
        const components = this.detectComponents(ocrResult);
        return {
          ...ocrResult,
          components
        };
      }

      return ocrResult;
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    } finally {
      this.removeProgressListener(jobId);
    }
  }

  private async preprocessImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Apply preprocessing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale conversion
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Increase contrast
          const contrast = 1.5;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const newGray = factor * (gray - 128) + 128;
          
          // Apply threshold for better text detection
          const threshold = 128;
          const finalGray = newGray > threshold ? 255 : 0;
          
          data[i] = finalGray;
          data[i + 1] = finalGray;
          data[i + 2] = finalGray;
        }

        ctx.putImageData(imageData, 0, 0);
        
        // Return as data URL
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for preprocessing'));
      };

      img.src = imageUrl;
    });
  }

  private convertToOCRResult(tesseractResult: RecognizeResult): OCRResult {
    const textBlocks: TextBlock[] = [];
    
    // Process each line of text
    tesseractResult.data.lines.forEach(line => {
      if (line.text.trim()) {
        textBlocks.push({
          text: line.text.trim(),
          bbox: {
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0
          },
          confidence: line.confidence / 100 // Convert to 0-1 scale
        });
      }
    });

    // Also process individual words for better component detection
    tesseractResult.data.words.forEach(word => {
      if (word.text.trim() && word.confidence > 50) {
        // Check if this word is already part of a line
        const isInLine = textBlocks.some(block => 
          block.text.includes(word.text.trim())
        );
        
        if (!isInLine) {
          textBlocks.push({
            text: word.text.trim(),
            bbox: {
              x: word.bbox.x0,
              y: word.bbox.y0,
              width: word.bbox.x1 - word.bbox.x0,
              height: word.bbox.y1 - word.bbox.y0
            },
            confidence: word.confidence / 100
          });
        }
      }
    });

    return {
      textBlocks,
      metadata: {
        processingTime: Date.now(), // Will be calculated by caller
        imageSize: {
          width: tesseractResult.data.imageWidth || 0,
          height: tesseractResult.data.imageHeight || 0
        }
      }
    };
  }

  public detectComponents(ocrResult: OCRResult): Partial<Component>[] {
    const components: Partial<Component>[] = [];
    const usedTexts = new Set<string>();

    // Process each text block
    ocrResult.textBlocks.forEach(block => {
      if (usedTexts.has(block.text)) return;

      // Try to match against each pattern
      for (const patternDef of this.componentPatterns) {
        const matches = Array.from(block.text.matchAll(patternDef.pattern));
        
        for (const match of matches) {
          const componentId = patternDef.extractId ? patternDef.extractId(match) : match[1];
          const fullMatch = match[0];
          
          // Create component
          const component: Partial<Component> = {
            id: `ocr-${patternDef.type}-${componentId}-${Date.now()}`,
            name: fullMatch,
            componentType: patternDef.type as any,
            geometry: {
              x: block.bbox.x,
              y: block.bbox.y,
              width: patternDef.defaultWidth,
              height: patternDef.defaultHeight,
              rotation: 0
            },
            style: {
              visible: true,
              opacity: 1,
              locked: false,
              zIndex: 0
            },
            metadata: {
              layer: 'default',
              source: 'ocr',
              ocrText: fullMatch,
              confidence: block.confidence,
              category: patternDef.category
            }
          };

          // Add specific properties based on component type
          if (patternDef.type.includes('conveyor')) {
            component.conveyorProperties = {
              speed: 100,
              direction: 'forward',
              beltWidth: 40,
              angle: 0
            };
            
            if (patternDef.type === 'curved-conveyor') {
              component.conveyorProperties.curveAngle = 90;
              component.conveyorProperties.curveRadius = 75;
            }
          }

          components.push(component);
          usedTexts.add(fullMatch);
        }
      }
    });

    // Try to detect relationships between components
    this.detectComponentRelationships(components, ocrResult);

    return components;
  }

  private detectComponentRelationships(
    components: Partial<Component>[],
    ocrResult: OCRResult
  ): void {
    // Look for connection indicators
    const connectionPatterns = [
      /(?:TO|FROM|->|→|FEEDS?|CONNECTS?)/gi,
      /LINE[_\-\s]?(\d+)/gi,
      /FLOW[_\-\s]?(\d+)/gi
    ];

    ocrResult.textBlocks.forEach(block => {
      for (const pattern of connectionPatterns) {
        if (pattern.test(block.text)) {
          // Find nearby components
          const nearbyComponents = components.filter(comp => {
            if (!comp.geometry) return false;
            const distance = Math.sqrt(
              Math.pow(comp.geometry.x - block.bbox.x, 2) +
              Math.pow(comp.geometry.y - block.bbox.y, 2)
            );
            return distance < 200; // Within 200 pixels
          });

          // Add relationship metadata
          nearbyComponents.forEach(comp => {
            if (!comp.metadata) comp.metadata = { layer: 'default', source: 'ocr' };
            comp.metadata.connectionText = block.text;
            comp.metadata.nearbyComponents = nearbyComponents
              .filter(c => c !== comp)
              .map(c => c.id || '')
              .filter(id => id);
          });
        }
      }
    });
  }

  public async processMultipleImages(
    imageUrls: string[],
    options?: {
      preprocessImage?: boolean;
      detectComponents?: boolean;
      language?: string;
    }
  ): Promise<OCRResult[]> {
    const results: OCRResult[] = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const jobId = `batch-${i}`;
      const result = await this.processImage(imageUrls[i], {
        ...options,
        jobId
      });
      results.push(result);
    }
    
    return results;
  }

  public async detectText(imageUrl: string): Promise<string> {
    const result = await this.processImage(imageUrl, {
      detectComponents: false,
      preprocessImage: false
    });
    
    return result.textBlocks
      .map(block => block.text)
      .join(' ');
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  // Utility method to check if text likely contains component identifiers
  public isLikelyComponentText(text: string): boolean {
    return this.componentPatterns.some(pattern => 
      pattern.pattern.test(text)
    );
  }

  // Get supported component types
  public getSupportedComponentTypes(): string[] {
    return [...new Set(this.componentPatterns.map(p => p.type))];
  }

  // Get pattern definitions for documentation
  public getPatternDefinitions(): Array<{
    pattern: string;
    type: string;
    category: string;
    example: string;
  }> {
    return this.componentPatterns.map(p => ({
      pattern: p.pattern.source,
      type: p.type,
      category: p.category,
      example: this.generateExampleForPattern(p.pattern)
    }));
  }

  private generateExampleForPattern(pattern: RegExp): string {
    const source = pattern.source;
    if (source.includes('CONV')) return 'CONV_01';
    if (source.includes('MOTOR')) return 'MOTOR_M1';
    if (source.includes('PUMP')) return 'PUMP_P1';
    if (source.includes('VALVE')) return 'VALVE_V1';
    if (source.includes('TANK')) return 'TANK_T1';
    if (source.includes('SENSOR')) return 'SENSOR_S1';
    return 'COMPONENT_01';
  }
}

// Export singleton instance
export const nativeOCRService = new NativeOCRService();
