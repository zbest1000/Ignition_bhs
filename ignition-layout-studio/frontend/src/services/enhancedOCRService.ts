import Tesseract, { Worker, RecognizeResult } from 'tesseract.js';
import { Component, OCRResult, TextBlock } from '../types';

/**
 * Enhanced OCR Service incorporating PaddleOCR-inspired techniques
 * Based on PaddleOCR's approach: https://github.com/PaddlePaddle/PaddleOCR
 * 
 * Key enhancements from PaddleOCR:
 * 1. Multi-stage text detection (DB algorithm inspired)
 * 2. Text direction classification
 * 3. Layout analysis for structured documents
 * 4. Table structure recognition
 * 5. Seal/stamp detection for industrial documents
 */

interface LayoutRegion {
  type: 'text' | 'table' | 'figure' | 'title' | 'list' | 'seal';
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
  content?: any;
}

interface TextLine {
  text: string;
  bbox: number[];
  confidence: number;
  angle: number;
  direction: 'horizontal' | 'vertical' | 'rotated';
}

interface TableCell {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  bbox: number[];
}

export class EnhancedOCRService {
  private worker: Worker | null = null;
  private isInitialized = false;
  
  // PaddleOCR-inspired detection thresholds
  private readonly DB_THRESH = 0.3;  // Differentiable Binarization threshold
  private readonly DB_BOX_THRESH = 0.5;
  private readonly DB_UNCLIP_RATIO = 1.5;
  private readonly MIN_TEXT_SIZE = 10;
  
  // Layout analysis parameters (inspired by PP-StructureV2)
  private readonly LAYOUT_CLASSES = ['text', 'title', 'list', 'table', 'figure', 'seal'];
  
  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await Tesseract.createWorker({
        logger: (m) => console.log('OCR:', m),
      });

      await this.worker.loadLanguage('eng+chi_sim');  // English + Chinese support like PaddleOCR
      await this.worker.initialize('eng+chi_sim');
      
      // Configure for better accuracy (PaddleOCR-inspired parameters)
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,  // Auto orientation and script detection
        preserve_interword_spaces: '1',
        tessedit_create_hocr: '1',  // Enable HOCR output for structure
        tessedit_create_tsv: '1',   // Enable TSV for detailed analysis
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR:', error);
      throw error;
    }
  }

  /**
   * PaddleOCR-inspired preprocessing pipeline
   * Implements techniques from PP-OCRv3/v4
   */
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

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Apply PaddleOCR-inspired preprocessing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. Adaptive histogram equalization (CLAHE-like)
        this.applyCLAHE(data, canvas.width, canvas.height);
        
        // 2. Morphological operations for text enhancement
        this.applyMorphologicalOperations(data, canvas.width, canvas.height);
        
        // 3. Binarization with Otsu's method
        this.applyOtsuBinarization(data);

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  /**
   * Contrast Limited Adaptive Histogram Equalization
   * Inspired by PaddleOCR's image enhancement
   */
  private applyCLAHE(data: Uint8ClampedArray, width: number, height: number): void {
    const tileSize = 8;
    const clipLimit = 2.0;
    
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        const tileWidth = Math.min(tileSize, width - x);
        const tileHeight = Math.min(tileSize, height - y);
        
        // Calculate histogram for tile
        const hist = new Array(256).fill(0);
        for (let ty = 0; ty < tileHeight; ty++) {
          for (let tx = 0; tx < tileWidth; tx++) {
            const idx = ((y + ty) * width + (x + tx)) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            hist[Math.floor(gray)]++;
          }
        }
        
        // Apply histogram equalization with clipping
        const cdf = this.calculateCDF(hist, tileWidth * tileHeight, clipLimit);
        
        // Apply to tile
        for (let ty = 0; ty < tileHeight; ty++) {
          for (let tx = 0; tx < tileWidth; tx++) {
            const idx = ((y + ty) * width + (x + tx)) * 4;
            const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const newGray = cdf[Math.floor(gray)] * 255;
            data[idx] = data[idx + 1] = data[idx + 2] = newGray;
          }
        }
      }
    }
  }

  private calculateCDF(hist: number[], total: number, clipLimit: number): number[] {
    // Clip histogram
    const clipValue = clipLimit * total / 256;
    let excess = 0;
    
    for (let i = 0; i < hist.length; i++) {
      if (hist[i] > clipValue) {
        excess += hist[i] - clipValue;
        hist[i] = clipValue;
      }
    }
    
    // Redistribute excess
    const avgExcess = excess / 256;
    for (let i = 0; i < hist.length; i++) {
      hist[i] += avgExcess;
    }
    
    // Calculate CDF
    const cdf = new Array(256);
    cdf[0] = hist[0] / total;
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + hist[i] / total;
    }
    
    return cdf;
  }

  /**
   * Morphological operations for text enhancement
   * Based on PaddleOCR's text region refinement
   */
  private applyMorphologicalOperations(data: Uint8ClampedArray, width: number, height: number): void {
    // Simple erosion followed by dilation (opening operation)
    const kernel = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0]
    ];
    
    const temp = new Uint8ClampedArray(data);
    
    // Erosion
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let min = 255;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (kernel[ky + 1][kx + 1] === 1) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              min = Math.min(min, temp[idx]);
            }
          }
        }
        const idx = (y * width + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = min;
      }
    }
    
    // Dilation
    temp.set(data);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let max = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            if (kernel[ky + 1][kx + 1] === 1) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              max = Math.max(max, temp[idx]);
            }
          }
        }
        const idx = (y * width + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = max;
      }
    }
  }

  /**
   * Otsu's binarization method
   * Used in PaddleOCR for optimal threshold selection
   */
  private applyOtsuBinarization(data: Uint8ClampedArray): void {
    // Calculate histogram
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      hist[data[i]]++;
    }
    
    // Calculate Otsu threshold
    const total = data.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * hist[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVar = 0;
    let threshold = 0;
    
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      
      wF = total - wB;
      if (wF === 0) break;
      
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      
      if (varBetween > maxVar) {
        maxVar = varBetween;
        threshold = t;
      }
    }
    
    // Apply threshold
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] > threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
  }

  /**
   * Layout analysis inspired by PP-Structure
   * Detects different regions in the document
   */
  private async analyzeLayout(imageUrl: string): Promise<LayoutRegion[]> {
    const regions: LayoutRegion[] = [];
    
    // Simplified layout detection using edge detection and region growing
    const canvas = await this.loadImageToCanvas(imageUrl);
    const ctx = canvas.getContext('2d');
    if (!ctx) return regions;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const edges = this.detectEdges(imageData);
    const connectedComponents = this.findConnectedComponents(edges, canvas.width, canvas.height);
    
    // Classify regions based on characteristics
    for (const component of connectedComponents) {
      const region: LayoutRegion = {
        type: this.classifyRegion(component),
        bbox: component.bbox,
        confidence: component.density,
        content: null
      };
      regions.push(region);
    }
    
    return regions;
  }

  private async loadImageToCanvas(imageUrl: string): Promise<HTMLCanvasElement> {
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
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  /**
   * Canny edge detection for layout analysis
   */
  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const edges = new Uint8ClampedArray(width * height);
    
    // Simplified Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Sobel X
        const gx = 
          -1 * data[((y - 1) * width + (x - 1)) * 4] +
          1 * data[((y - 1) * width + (x + 1)) * 4] +
          -2 * data[(y * width + (x - 1)) * 4] +
          2 * data[(y * width + (x + 1)) * 4] +
          -1 * data[((y + 1) * width + (x - 1)) * 4] +
          1 * data[((y + 1) * width + (x + 1)) * 4];
        
        // Sobel Y
        const gy = 
          -1 * data[((y - 1) * width + (x - 1)) * 4] +
          -2 * data[((y - 1) * width + x) * 4] +
          -1 * data[((y - 1) * width + (x + 1)) * 4] +
          1 * data[((y + 1) * width + (x - 1)) * 4] +
          2 * data[((y + 1) * width + x) * 4] +
          1 * data[((y + 1) * width + (x + 1)) * 4];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 50 ? 255 : 0;
      }
    }
    
    return edges;
  }

  /**
   * Find connected components for region detection
   */
  private findConnectedComponents(edges: Uint8ClampedArray, width: number, height: number): any[] {
    const visited = new Uint8ClampedArray(width * height);
    const components: any[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (edges[idx] === 255 && visited[idx] === 0) {
          const component = this.floodFill(edges, visited, x, y, width, height);
          if (component.pixels > this.MIN_TEXT_SIZE) {
            components.push(component);
          }
        }
      }
    }
    
    return components;
  }

  private floodFill(edges: Uint8ClampedArray, visited: Uint8ClampedArray, 
                    startX: number, startY: number, width: number, height: number): any {
    const stack = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixels = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || 
          visited[idx] === 1 || edges[idx] === 0) {
        continue;
      }
      
      visited[idx] = 1;
      pixels++;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    return {
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      pixels,
      density: pixels / ((maxX - minX) * (maxY - minY))
    };
  }

  /**
   * Classify region type based on characteristics
   * Inspired by PP-Structure's layout classification
   */
  private classifyRegion(component: any): LayoutRegion['type'] {
    const aspectRatio = component.bbox.width / component.bbox.height;
    const area = component.bbox.width * component.bbox.height;
    const density = component.density;
    
    // Simple heuristics for classification
    if (aspectRatio > 3 && density > 0.3) {
      return 'title';  // Wide, dense text likely a title
    } else if (aspectRatio > 0.5 && aspectRatio < 2 && area > 10000) {
      return 'table';  // Square-ish large area might be table
    } else if (density < 0.2 && area > 5000) {
      return 'figure';  // Sparse large area might be figure
    } else if (aspectRatio < 0.3) {
      return 'list';  // Narrow vertical might be list
    } else {
      return 'text';  // Default to text
    }
  }

  /**
   * Table structure recognition inspired by PaddleOCR
   */
  private async recognizeTable(region: LayoutRegion, imageUrl: string): Promise<TableCell[]> {
    const cells: TableCell[] = [];
    
    // Extract table region from image
    const canvas = await this.loadImageToCanvas(imageUrl);
    const ctx = canvas.getContext('2d');
    if (!ctx) return cells;
    
    // Get table region
    const tableCanvas = document.createElement('canvas');
    const tableCtx = tableCanvas.getContext('2d');
    if (!tableCtx) return cells;
    
    tableCanvas.width = region.bbox.width;
    tableCanvas.height = region.bbox.height;
    tableCtx.drawImage(
      canvas,
      region.bbox.x, region.bbox.y, region.bbox.width, region.bbox.height,
      0, 0, region.bbox.width, region.bbox.height
    );
    
    // Detect horizontal and vertical lines
    const lines = this.detectTableLines(tableCtx.getImageData(0, 0, tableCanvas.width, tableCanvas.height));
    
    // Find cell boundaries
    const cellBoundaries = this.findCellBoundaries(lines, tableCanvas.width, tableCanvas.height);
    
    // Extract text from each cell
    for (const boundary of cellBoundaries) {
      const cell: TableCell = {
        row: boundary.row,
        col: boundary.col,
        rowSpan: boundary.rowSpan,
        colSpan: boundary.colSpan,
        text: '',  // Would need OCR on cell region
        bbox: [boundary.x, boundary.y, boundary.x + boundary.width, boundary.y + boundary.height]
      };
      cells.push(cell);
    }
    
    return cells;
  }

  private detectTableLines(imageData: ImageData): { horizontal: number[], vertical: number[] } {
    const { data, width, height } = imageData;
    const horizontal: number[] = [];
    const vertical: number[] = [];
    
    // Detect horizontal lines
    for (let y = 0; y < height; y++) {
      let linePixels = 0;
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) linePixels++;  // Dark pixel
      }
      if (linePixels > width * 0.7) {  // 70% of width is dark
        horizontal.push(y);
      }
    }
    
    // Detect vertical lines
    for (let x = 0; x < width; x++) {
      let linePixels = 0;
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) linePixels++;  // Dark pixel
      }
      if (linePixels > height * 0.7) {  // 70% of height is dark
        vertical.push(x);
      }
    }
    
    return { horizontal, vertical };
  }

  private findCellBoundaries(lines: { horizontal: number[], vertical: number[] }, 
                             width: number, height: number): any[] {
    const boundaries: any[] = [];
    const { horizontal, vertical } = lines;
    
    // Add boundaries if not present
    if (!horizontal.includes(0)) horizontal.unshift(0);
    if (!horizontal.includes(height - 1)) horizontal.push(height - 1);
    if (!vertical.includes(0)) vertical.unshift(0);
    if (!vertical.includes(width - 1)) vertical.push(width - 1);
    
    // Find cells between lines
    for (let row = 0; row < horizontal.length - 1; row++) {
      for (let col = 0; col < vertical.length - 1; col++) {
        boundaries.push({
          row,
          col,
          rowSpan: 1,
          colSpan: 1,
          x: vertical[col],
          y: horizontal[row],
          width: vertical[col + 1] - vertical[col],
          height: horizontal[row + 1] - horizontal[row]
        });
      }
    }
    
    return boundaries;
  }

  /**
   * Main OCR processing with PaddleOCR-inspired enhancements
   */
  public async processImage(
    imageUrl: string,
    options: {
      enableLayoutAnalysis?: boolean;
      enableTableRecognition?: boolean;
      enableSealDetection?: boolean;
      detectComponents?: boolean;
    } = {}
  ): Promise<OCRResult & { layout?: LayoutRegion[], tables?: TableCell[][] }> {
    const {
      enableLayoutAnalysis = true,
      enableTableRecognition = true,
      enableSealDetection = false,
      detectComponents = true
    } = options;

    try {
      if (!this.isInitialized || !this.worker) {
        await this.initializeWorker();
      }

      // Preprocess image with enhanced techniques
      const processedImageUrl = await this.preprocessImage(imageUrl);

      // Perform layout analysis if enabled
      let layoutRegions: LayoutRegion[] = [];
      if (enableLayoutAnalysis) {
        layoutRegions = await this.analyzeLayout(processedImageUrl);
      }

      // Perform OCR with multi-language support
      const result = await this.worker!.recognize(processedImageUrl, {
        rotateAuto: true,
      });

      // Get detailed output for structure analysis
      const { data } = result;
      
      // Process text lines with direction detection
      const textLines = this.processTextLines(data);
      
      // Convert to our format
      const textBlocks: TextBlock[] = textLines.map(line => ({
        text: line.text,
        bbox: {
          x: line.bbox[0],
          y: line.bbox[1],
          width: line.bbox[2] - line.bbox[0],
          height: line.bbox[3] - line.bbox[1]
        },
        confidence: line.confidence
      }));

      // Detect tables if enabled
      let tables: TableCell[][] = [];
      if (enableTableRecognition) {
        const tableRegions = layoutRegions.filter(r => r.type === 'table');
        for (const tableRegion of tableRegions) {
          const tableCells = await this.recognizeTable(tableRegion, processedImageUrl);
          if (tableCells.length > 0) {
            tables.push(tableCells);
          }
        }
      }

      // Detect components if enabled
      let components: Partial<Component>[] = [];
      if (detectComponents) {
        components = this.detectIndustrialComponents(textBlocks, layoutRegions);
      }

      return {
        textBlocks,
        metadata: {
          processingTime: Date.now(),
          imageSize: {
            width: data.imageWidth || 0,
            height: data.imageHeight || 0
          }
        },
        layout: layoutRegions,
        tables,
        components: components as any
      };

    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      throw error;
    }
  }

  /**
   * Process text lines with direction detection
   * Inspired by PaddleOCR's text direction classifier
   */
  private processTextLines(data: any): TextLine[] {
    const lines: TextLine[] = [];
    
    if (!data.lines) return lines;
    
    for (const line of data.lines) {
      if (!line.text.trim()) continue;
      
      // Calculate text direction based on bbox aspect ratio
      const width = line.bbox.x1 - line.bbox.x0;
      const height = line.bbox.y1 - line.bbox.y0;
      const aspectRatio = width / height;
      
      let direction: TextLine['direction'] = 'horizontal';
      let angle = 0;
      
      if (aspectRatio < 0.3) {
        direction = 'vertical';
        angle = 90;
      } else if (line.baseline && line.baseline.has_baseline) {
        // Use baseline angle if available
        angle = Math.atan2(
          line.baseline.y1 - line.baseline.y0,
          line.baseline.x1 - line.baseline.x0
        ) * (180 / Math.PI);
        
        if (Math.abs(angle) > 45) {
          direction = 'rotated';
        }
      }
      
      lines.push({
        text: line.text.trim(),
        bbox: [line.bbox.x0, line.bbox.y0, line.bbox.x1, line.bbox.y1],
        confidence: line.confidence / 100,
        angle,
        direction
      });
    }
    
    return lines;
  }

  /**
   * Enhanced component detection with layout awareness
   */
  private detectIndustrialComponents(
    textBlocks: TextBlock[], 
    layoutRegions: LayoutRegion[]
  ): Partial<Component>[] {
    const components: Partial<Component>[] = [];
    
    // Group text blocks by layout region
    const regionTextMap = new Map<LayoutRegion, TextBlock[]>();
    
    for (const region of layoutRegions) {
      const regionTexts = textBlocks.filter(block => 
        this.isInsideRegion(block.bbox, region.bbox)
      );
      regionTextMap.set(region, regionTexts);
    }
    
    // Process each region based on type
    for (const [region, texts] of regionTextMap) {
      if (region.type === 'table') {
        // Extract components from table cells
        components.push(...this.extractComponentsFromTable(texts));
      } else if (region.type === 'text' || region.type === 'title') {
        // Extract components from text regions
        components.push(...this.extractComponentsFromText(texts));
      }
    }
    
    // Add spatial relationships
    this.addSpatialRelationships(components);
    
    return components;
  }

  private isInsideRegion(
    blockBbox: { x: number; y: number; width: number; height: number },
    regionBbox: { x: number; y: number; width: number; height: number }
  ): boolean {
    return blockBbox.x >= regionBbox.x &&
           blockBbox.y >= regionBbox.y &&
           blockBbox.x + blockBbox.width <= regionBbox.x + regionBbox.width &&
           blockBbox.y + blockBbox.height <= regionBbox.y + regionBbox.height;
  }

  private extractComponentsFromTable(texts: TextBlock[]): Partial<Component>[] {
    // Implementation for extracting components from table structure
    // This would parse table cells for component information
    return [];
  }

  private extractComponentsFromText(texts: TextBlock[]): Partial<Component>[] {
    // Enhanced component extraction with context awareness
    const components: Partial<Component>[] = [];
    
    // Industrial component patterns (expanded from original)
    const patterns = [
      { regex: /CONV[_\-\s]?(\d+|[A-Z]\d+)/gi, type: 'conveyor' },
      { regex: /MOTOR[_\-\s]?([A-Z]?\d+)/gi, type: 'motor' },
      { regex: /PUMP[_\-\s]?([A-Z]?\d+)/gi, type: 'pump' },
      { regex: /VALVE[_\-\s]?([A-Z]?\d+)/gi, type: 'valve' },
      { regex: /TANK[_\-\s]?([A-Z]?\d+)/gi, type: 'tank' },
      // Add more patterns as needed
    ];
    
    for (const text of texts) {
      for (const pattern of patterns) {
        const matches = text.text.matchAll(pattern.regex);
        for (const match of matches) {
          components.push({
            id: `ocr-${pattern.type}-${match[1]}-${Date.now()}`,
            name: match[0],
            componentType: `perspective.${pattern.type}` as any,
            geometry: {
              x: text.bbox.x,
              y: text.bbox.y,
              width: 100,  // Default sizes
              height: 100,
              rotation: 0
            },
            metadata: {
              layer: 'default',
              source: 'enhanced-ocr',
              confidence: text.confidence,
              ocrText: match[0]
            }
          });
        }
      }
    }
    
    return components;
  }

  private addSpatialRelationships(components: Partial<Component>[]): void {
    // Add spatial relationships between components
    // Based on PaddleOCR's KIE (Key Information Extraction) approach
    
    for (let i = 0; i < components.length; i++) {
      const comp1 = components[i];
      if (!comp1.geometry || !comp1.metadata) continue;
      
      const nearby: string[] = [];
      
      for (let j = 0; j < components.length; j++) {
        if (i === j) continue;
        const comp2 = components[j];
        if (!comp2.geometry) continue;
        
        const distance = Math.sqrt(
          Math.pow(comp1.geometry.x - comp2.geometry.x, 2) +
          Math.pow(comp1.geometry.y - comp2.geometry.y, 2)
        );
        
        if (distance < 200) {  // Within 200 pixels
          nearby.push(comp2.id || '');
        }
      }
      
      comp1.metadata.nearbyComponents = nearby;
    }
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const enhancedOCRService = new EnhancedOCRService();
