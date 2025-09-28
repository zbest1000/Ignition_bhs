import { nativeOCRService } from './nativeOCRService';
import { enhancedOCRService } from './enhancedOCRService';
import { OCRResult, Component } from '../types';

/**
 * Hybrid Processing Service
 * Routes processing between frontend and backend based on file size and complexity
 * Both use Tesseract.js - backend has more CPU/memory for complex tasks
 * Includes line and drawing detection for engineering diagrams
 */

export interface ProcessingMode {
  mode: 'auto' | 'frontend' | 'backend' | 'hybrid';
  reason?: string;
}

export interface ProcessingOptions {
  mode?: ProcessingMode['mode'];
  preferPrivacy?: boolean;
  enableLineDetection?: boolean;
  enableDrawingAnalysis?: boolean;
  maxFrontendSize?: number; // MB
}

export interface LineSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
  type: 'horizontal' | 'vertical' | 'diagonal';
  thickness: number;
  confidence: number;
}

export interface DrawingElement {
  type: 'line' | 'rectangle' | 'circle' | 'arc' | 'polygon';
  geometry: any;
  properties: Record<string, any>;
}

export interface HybridResult extends OCRResult {
  processingLocation: 'frontend' | 'backend' | 'hybrid';
  processingTime: number;
  lines?: LineSegment[];
  drawingElements?: DrawingElement[];
  fallbackUsed?: boolean;
}

class HybridProcessingService {
  private readonly DEFAULT_MAX_FRONTEND_SIZE = 10 * 1024 * 1024; // 10MB
  private networkAvailable = true;
  private deviceCapability: 'low' | 'medium' | 'high' = 'medium';

  constructor() {
    this.checkNetworkStatus();
    this.assessDevice();
  }

  private async checkNetworkStatus(): Promise<void> {
    try {
      await fetch('/api/ping', { method: 'HEAD' });
      this.networkAvailable = true;
    } catch {
      this.networkAvailable = false;
    }
  }

  private assessDevice(): void {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = (navigator as any).deviceMemory || 4;
    
    if (cores >= 8 && memory >= 8) this.deviceCapability = 'high';
    else if (cores >= 4 && memory >= 4) this.deviceCapability = 'medium';
    else this.deviceCapability = 'low';
  }

  private determineMode(file: File | string, options: ProcessingOptions): ProcessingMode {
    if (options.mode && options.mode !== 'auto') {
      return { mode: options.mode, reason: 'User specified' };
    }

    const fileSize = typeof file === 'string' ? 0 : file.size;
    const maxSize = options.maxFrontendSize || this.DEFAULT_MAX_FRONTEND_SIZE;

    if (options.preferPrivacy) {
      return { mode: 'frontend', reason: 'Privacy preference' };
    }

    if (!this.networkAvailable) {
      return { mode: 'frontend', reason: 'Offline' };
    }

    if (fileSize > maxSize) {
      return { mode: 'backend', reason: 'Large file' };
    }

    if (this.deviceCapability === 'low') {
      return { mode: 'backend', reason: 'Low device capability' };
    }

    return { mode: 'frontend', reason: 'Default' };
  }

  public async processOCR(
    file: File | string,
    options: ProcessingOptions = {}
  ): Promise<HybridResult> {
    const start = performance.now();
    const mode = this.determineMode(file, options);
    
    let result: HybridResult;

    switch (mode.mode) {
      case 'backend':
        result = await this.processBackend(file, options);
        break;
      case 'hybrid':
        result = await this.processHybrid(file, options);
        break;
      default:
        result = await this.processFrontend(file, options);
    }

    result.processingTime = performance.now() - start;

    // Add line/drawing detection if requested
    if (options.enableLineDetection || options.enableDrawingAnalysis) {
      const imageUrl = typeof file === 'string' ? file : await this.fileToDataUrl(file);
      
      if (options.enableLineDetection) {
        result.lines = await this.detectLines(imageUrl);
      }
      
      if (options.enableDrawingAnalysis) {
        result.drawingElements = await this.detectDrawingElements(imageUrl);
      }
    }

    return result;
  }

  private async processFrontend(file: File | string, options: ProcessingOptions): Promise<HybridResult> {
    const imageUrl = typeof file === 'string' ? file : await this.fileToDataUrl(file);
    const result = await enhancedOCRService.processImage(imageUrl, {
      enableLayoutAnalysis: true,
      detectComponents: true
    });
    
    return {
      ...result,
      processingLocation: 'frontend',
      processingTime: 0
    };
  }

  private async processBackend(file: File | string, options: ProcessingOptions): Promise<HybridResult> {
    try {
      // Backend also uses Tesseract.js but with more resources
      const formData = new FormData();
      if (typeof file === 'string') {
        const response = await fetch(file);
        const blob = await response.blob();
        formData.append('file', blob);
      } else {
        formData.append('file', file);
      }
      
      const response = await fetch('/api/ocr/process-tesseract', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Backend failed');
      
      const result = await response.json();
      return {
        ...result,
        processingLocation: 'backend',
        processingTime: 0
      };
    } catch (error) {
      // Fallback to frontend
      const result = await this.processFrontend(file, options);
      return { ...result, fallbackUsed: true };
    }
  }

  private async processHybrid(file: File | string, options: ProcessingOptions): Promise<HybridResult> {
    // Quick frontend preview
    const imageUrl = typeof file === 'string' ? file : await this.fileToDataUrl(file);
    const quickResult = await nativeOCRService.processImage(imageUrl, {
      preprocessImage: false,
      detectComponents: true
    });

    // Enhance with backend if available
    if (this.networkAvailable) {
      try {
        const backendResult = await this.processBackend(file, options);
        return {
          ...backendResult,
          components: this.mergeComponents(quickResult.components || [], backendResult.components || []),
          processingLocation: 'hybrid'
        };
      } catch {
        // Continue with frontend only
      }
    }

    // Enhanced frontend processing
    const enhancedResult = await enhancedOCRService.processImage(imageUrl, {
      enableLayoutAnalysis: true,
      detectComponents: true
    });

    return {
      ...enhancedResult,
      processingLocation: 'hybrid'
    };
  }

  private async detectLines(imageUrl: string): Promise<LineSegment[]> {
    const lines: LineSegment[] = [];
    
    try {
      const canvas = await this.loadImageToCanvas(imageUrl);
      const ctx = canvas.getContext('2d');
      if (!ctx) return lines;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const edges = this.detectEdges(imageData);
      const houghLines = this.houghTransform(edges, canvas.width, canvas.height);
      
      // Convert to LineSegment format
      for (const line of houghLines) {
        lines.push({
          start: { x: line.x1, y: line.y1 },
          end: { x: line.x2, y: line.y2 },
          type: this.classifyLine(line),
          thickness: 1,
          confidence: line.confidence
        });
      }
    } catch (error) {
      console.error('Line detection failed:', error);
    }
    
    return lines;
  }

  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const edges = new Uint8ClampedArray(width * height);
    
    // Simple Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Sobel X
        const gx = 
          -data[((y-1)*width + (x-1))*4] + data[((y-1)*width + (x+1))*4] +
          -2*data[(y*width + (x-1))*4] + 2*data[(y*width + (x+1))*4] +
          -data[((y+1)*width + (x-1))*4] + data[((y+1)*width + (x+1))*4];
        
        // Sobel Y
        const gy = 
          -data[((y-1)*width + (x-1))*4] - 2*data[((y-1)*width + x)*4] - data[((y-1)*width + (x+1))*4] +
          data[((y+1)*width + (x-1))*4] + 2*data[((y+1)*width + x)*4] + data[((y+1)*width + (x+1))*4];
        
        const magnitude = Math.sqrt(gx*gx + gy*gy);
        edges[y*width + x] = magnitude > 50 ? 255 : 0;
      }
    }
    
    return edges;
  }

  private houghTransform(edges: Uint8ClampedArray, width: number, height: number): any[] {
    const lines: any[] = [];
    const rhoMax = Math.sqrt(width*width + height*height);
    const accumulator: Map<string, number> = new Map();
    
    // Vote for lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y*width + x] === 255) {
          for (let theta = 0; theta < 180; theta++) {
            const rad = theta * Math.PI / 180;
            const rho = x * Math.cos(rad) + y * Math.sin(rad);
            const key = `${Math.round(rho)},${theta}`;
            accumulator.set(key, (accumulator.get(key) || 0) + 1);
          }
        }
      }
    }
    
    // Find peaks
    const threshold = 50;
    for (const [key, votes] of accumulator.entries()) {
      if (votes > threshold) {
        const [rho, theta] = key.split(',').map(Number);
        const rad = theta * Math.PI / 180;
        
        // Convert to line endpoints
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        if (Math.abs(Math.sin(rad)) > 0.001) {
          x1 = 0;
          y1 = rho / Math.sin(rad);
          x2 = width;
          y2 = (rho - x2 * Math.cos(rad)) / Math.sin(rad);
        } else {
          x1 = rho / Math.cos(rad);
          y1 = 0;
          x2 = rho / Math.cos(rad);
          y2 = height;
        }
        
        lines.push({ x1, y1, x2, y2, confidence: votes / 100 });
      }
    }
    
    return lines;
  }

  private classifyLine(line: any): LineSegment['type'] {
    const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
    const absAngle = Math.abs(angle);
    
    if (absAngle < 10 || absAngle > 170) return 'horizontal';
    if (absAngle > 80 && absAngle < 100) return 'vertical';
    return 'diagonal';
  }

  private async detectDrawingElements(imageUrl: string): Promise<DrawingElement[]> {
    const elements: DrawingElement[] = [];
    
    try {
      const canvas = await this.loadImageToCanvas(imageUrl);
      const ctx = canvas.getContext('2d');
      if (!ctx) return elements;

      // Detect rectangles
      const rectangles = this.detectRectangles(ctx, canvas.width, canvas.height);
      elements.push(...rectangles);
      
      // Detect circles
      const circles = this.detectCircles(ctx, canvas.width, canvas.height);
      elements.push(...circles);
    } catch (error) {
      console.error('Drawing detection failed:', error);
    }
    
    return elements;
  }

  private detectRectangles(ctx: CanvasRenderingContext2D, width: number, height: number): DrawingElement[] {
    const rectangles: DrawingElement[] = [];
    // Simplified rectangle detection - would need more sophisticated implementation
    return rectangles;
  }

  private detectCircles(ctx: CanvasRenderingContext2D, width: number, height: number): DrawingElement[] {
    const circles: DrawingElement[] = [];
    // Simplified circle detection - would need Hough Circle Transform
    return circles;
  }

  private async loadImageToCanvas(imageUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get context'));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  private mergeComponents(frontend: any[], backend: any[]): any[] {
    const merged = new Map();
    
    backend.forEach(comp => {
      const key = `${comp.name}-${Math.round(comp.geometry.x/10)}`;
      merged.set(key, comp);
    });
    
    frontend.forEach(comp => {
      const key = `${comp.name}-${Math.round(comp.geometry.x/10)}`;
      if (!merged.has(key)) {
        merged.set(key, comp);
      }
    });
    
    return Array.from(merged.values());
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const hybridProcessingService = new HybridProcessingService();
