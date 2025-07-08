// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  files: FileInfo[];
  components: Component[];
  templates: Template[];
  layers: Layer[];
  settings: ProjectSettings;
  metadata: Record<string, any>;
  tagMappings: Record<string, string>;
  exportHistory: ExportRecord[];
}

export interface ProjectSettings {
  gridSize: number;
  snapToGrid: boolean;
  showLabels: boolean;
  units: string;
}

// File Types
export interface FileInfo {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  extension: string;
  category: 'cad' | 'pdf' | 'image' | 'data';
  uploadedAt: string;
  metadata?: Record<string, any>;
}

// Component Types
export interface Component {
  id: string;
  type: ComponentType;
  templateId?: string;
  group?: string;
  equipmentId: string;
  label: string;
  geometry: ComponentGeometry;
  style: ComponentStyle;
  tags: ComponentTags;
  metadata: ComponentMetadata;
  animations: Animation[];
  scripts: ComponentScripts;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export type ComponentType = 
  | 'straight_conveyor' 
  | 'curve_90' 
  | 'curve_45' 
  | 'curve_180'
  | 'diverter'
  | 'merge'
  | 'motor'
  | 'eds_machine'
  | 'sensor'
  | 'custom';

export interface ComponentGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  length?: number;
  radius?: number;
  angle?: number;
  points?: Point[];
  path?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ComponentStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface ComponentTags {
  status?: string;
  fault?: string;
  speed?: string;
  direction?: string;
  [key: string]: string | undefined;
}

export interface ComponentMetadata {
  layer: string;
  source: 'manual' | 'ocr' | 'import';
  sourceFileId?: string;
  ocrText?: string;
  confidence?: number;
  category?: string;
  nearbyComponents?: string[];
  [key: string]: any;
}

export interface ComponentScripts {
  onClick?: string;
  onHover?: string;
  onValueChange?: string;
  [key: string]: string | undefined;
}

// Template Types
export interface Template {
  id: string;
  name: string;
  type: 'component' | 'symbol' | 'view';
  category: string;
  description: string;
  version: string;
  baseComponent: BaseComponent;
  parameters: TemplateParameter[];
  svgTemplate: string;
  perspectiveTemplate: any;
  visionTemplate: any;
  animations: Animation[];
  events: TemplateEvents;
  tagMappings: Record<string, string>;
  expressions: Record<string, string>;
  scripts: TemplateScripts;
  metadata: TemplateMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface BaseComponent {
  type: ComponentType;
  defaultWidth: number;
  defaultHeight: number;
  defaultProperties: Record<string, any>;
}

export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'tag' | 'color';
  required: boolean;
  defaultValue: any;
  description: string;
}

export interface Animation {
  id: string;
  type: 'color' | 'position' | 'rotation' | 'scale' | 'opacity';
  property: string;
  binding?: string;
  expression?: string;
  activeColor?: string;
  inactiveColor?: string;
  duration?: number;
  easing?: string;
}

export interface TemplateEvents {
  onClick?: string;
  onHover?: string;
  onValueChange?: string;
}

export interface TemplateScripts {
  transform?: string;
  custom: string[];
}

export interface TemplateMetadata {
  author: string;
  tags: string[];
  ignitionVersion: string;
  [key: string]: any;
}

// Layer Types
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color?: string;
  order: number;
}

// Export Types
export interface ExportRecord {
  id: string;
  type: 'svg' | 'perspective' | 'vision' | 'package';
  exportId: string;
  exportedAt: string;
  options?: Record<string, any>;
  viewName?: string;
  windowName?: string;
  componentsCount?: number;
  templatesIncluded?: boolean;
}

export interface ExportOptions {
  includeSVG?: boolean;
  includePerspective?: boolean;
  includeVision?: boolean;
  includeTemplates?: boolean;
  includeMetadata?: boolean;
  viewName?: string;
  windowName?: string;
}

// Canvas Types
export interface CanvasState {
  zoom: number;
  pan: Point;
  selectedComponents: string[];
  hoveredComponent?: string;
  tool: CanvasTool;
  showGrid: boolean;
  snapToGrid: boolean;
  showLabels: boolean;
}

export type CanvasTool = 
  | 'select' 
  | 'pan' 
  | 'draw' 
  | 'text' 
  | 'measure' 
  | 'delete';

// OCR Types
export interface OCRResult {
  textBlocks: TextBlock[];
  metadata: {
    processingTime: number;
    imageSize: {
      width: number;
      height: number;
    };
  };
}

export interface TextBlock {
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

// Socket Events
export interface SocketEvents {
  'project-updated': (project: Project) => void;
  'component-created': (component: Component) => void;
  'component-updated': (component: Component) => void;
  'component-deleted': (componentId: string) => void;
  'components-bulk-updated': (components: Component[]) => void;
  'template-created': (template: Template) => void;
  'template-updated': (template: Template) => void;
  'template-deleted': (templateId: string) => void;
  'files-uploaded': (files: FileInfo[]) => void;
  'file-deleted': (fileId: string) => void;
  'ocr-started': (data: { fileId: string; status: string }) => void;
  'ocr-completed': (data: { fileId: string; status: string; componentsFound: number; components: Component[] }) => void;
  'ocr-error': (data: { fileId: string; error: string }) => void;
}