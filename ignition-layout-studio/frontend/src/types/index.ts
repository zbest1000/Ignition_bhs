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
  industry?: string;
  safetyLevel?: string;
  aiIntegration?: {
    provider: string;
    enableSuggestions?: boolean;
  };
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
  category: 'cad' | 'pdf' | 'image' | 'data' | 'document';
  uploadedAt: string;
  metadata?: Record<string, any>;
  validation?: {
    warnings: string[];
    detectedType?: string;
  };
}

// Enhanced Conveyor System Types
export interface ConveyorProperties {
  // Physical properties
  length?: number;
  width?: number;
  height?: number;
  beltWidth?: number;
  angle?: number; // degrees, supports any angle 0-360
  curveRadius?: number;
  curveAngle?: number; // degrees for curved sections

  // Visual properties
  direction?: ConveyorDirection;
  beltType?: 'flat' | 'troughed' | 'roller' | 'chain';
  supportType?: 'floor' | 'ceiling' | 'wall';
  legHeight?: number;

  // Operational properties
  speed?: number;
  capacity?: number;
  material?: string;
  zones?: ConveyorZone[];
}

export interface ConveyorZone {
  id: string;
  type: 'straight' | 'curve' | 'merge' | 'divert' | 'incline' | 'decline';
  startPosition: number;
  length: number;
  angle?: number;
  elevation?: number;
}

export type ConveyorDirection = 'forward' | 'reverse' | 'bidirectional';

export interface ConveyorRendering {
  segments: ConveyorSegment[];
  supports: ConveyorSupport[];
  accessories: ConveyorAccessory[];
}

export interface ConveyorSegment {
  type: 'straight' | 'curved' | 'inclined';
  start: Point;
  end: Point;
  angle: number;
  length: number;
  width: number;
  height: number;
  beltWidth: number;
  curveCenter?: Point;
  curveRadius?: number;
  curveAngle?: number;
  elevation?: number;
  supports: number; // number of support legs
}

export interface ConveyorSupport {
  position: Point;
  type: 'leg' | 'bracket' | 'suspension';
  height: number;
  width: number;
}

export interface ConveyorAccessory {
  type: 'motor' | 'sensor' | 'guide' | 'guard' | 'emergency_stop';
  position: Point;
  orientation: number;
}

// Component Types - Aligned with Ignition 8.1+ Perspective and Vision
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
  ignitionProperties: IgnitionComponentProperties;
  conveyorProperties?: ConveyorProperties;
  conveyorRendering?: ConveyorRendering;
  createdAt: string;
  updatedAt: string;
}

// Ignition 8.1+ Component Types
export type ComponentType =
  // Perspective Components (Ignition 8.1+)
  | 'perspective.label'
  | 'perspective.button'
  | 'perspective.led-display'
  | 'perspective.numeric-entry'
  | 'perspective.dropdown'
  | 'perspective.checkbox'
  | 'perspective.radio-group'
  | 'perspective.slider'
  | 'perspective.gauge'
  | 'perspective.chart'
  | 'perspective.table'
  | 'perspective.tree'
  | 'perspective.image'
  | 'perspective.video'
  | 'perspective.web-browser'
  | 'perspective.symbol'
  | 'perspective.container'
  | 'perspective.coordinate-container'
  | 'perspective.flex-container'
  | 'perspective.breakpoint-container'
  | 'perspective.tab-container'
  | 'perspective.docked-view'
  | 'perspective.embedded-view'
  | 'perspective.popup'
  | 'perspective.alarm-status-table'
  | 'perspective.tag-browse-tree'
  | 'perspective.power-chart'
  | 'perspective.cylindrical-tank'
  | 'perspective.pipe'
  | 'perspective.motor'
  | 'perspective.pump'
  | 'perspective.valve'
  | 'perspective.conveyor'
  | 'perspective.vessel'
  // Vision Components (Legacy but still supported)
  | 'vision.label'
  | 'vision.button'
  | 'vision.led-display'
  | 'vision.numeric-entry'
  | 'vision.dropdown'
  | 'vision.checkbox'
  | 'vision.radio-group'
  | 'vision.slider'
  | 'vision.gauge'
  | 'vision.chart'
  | 'vision.table'
  | 'vision.tree'
  | 'vision.image'
  | 'vision.symbol'
  | 'vision.container'
  | 'vision.template-canvas'
  | 'vision.template-repeater'
  | 'vision.alarm-status-table'
  | 'vision.tag-browse-tree'
  | 'vision.power-chart'
  | 'vision.cylindrical-tank'
  | 'vision.pipe'
  | 'vision.motor'
  | 'vision.pump'
  | 'vision.valve'
  | 'vision.conveyor'
  | 'vision.vessel'
  // Industrial/Custom Components (dot notation)
  | 'industrial.straight-conveyor'
  | 'industrial.curve-90'
  | 'industrial.curve-45'
  | 'industrial.curve-180'
  | 'industrial.diverter'
  | 'industrial.merge'
  | 'industrial.motor'
  | 'industrial.eds-machine'
  | 'industrial.scanner'
  | 'industrial.pusher'
  | 'industrial.lifter'
  | 'industrial.turntable'
  | 'industrial.spiral-conveyor'
  | 'industrial.accumulation-conveyor'
  | 'industrial.belt-conveyor'
  | 'industrial.roller-conveyor'
  | 'industrial.chain-conveyor'
  | 'industrial.sorter'
  | 'industrial.scale'
  | 'industrial.wrapper'
  | 'industrial.palletizer'
  | 'industrial.depalletizer'
  | 'industrial.robot-arm'
  | 'industrial.agv-station'
  | 'industrial.safety-gate'
  | 'industrial.emergency-stop'
  | 'industrial.sensor'
  | 'industrial.photo-eye'
  | 'industrial.proximity-sensor'
  | 'industrial.label-printer'
  | 'industrial.barcode-scanner'
  | 'industrial.rfid-reader'
  // Industrial/Custom Components (underscore notation for compatibility)
  | 'straight_conveyor'
  | 'belt_conveyor'
  | 'roller_conveyor'
  | 'chain_conveyor'
  | 'accumulation_conveyor'
  | 'accumulation'
  | 'curve_90'
  | 'curve_45'
  | 'curve_180'
  | 'curve_90_conveyor'
  | 'curve_45_conveyor'
  | 'curve_180_conveyor'
  | 'angled_conveyor'
  | 'diverter'
  | 'merge'
  | 'merge_conveyor'
  | 'divert_conveyor'
  | 'sorter'
  | 'sortation'
  | 'sortation_conveyor'
  | 'motor'
  | 'drive_motor'
  | 'pusher'
  | 'lifter'
  | 'eds_machine'
  | 'scanner'
  | 'scale'
  | 'wrapper'
  | 'barcode_scanner'
  | 'rfid_reader'
  | 'turntable'
  | 'spiral_conveyor'
  | 'palletizer'
  | 'depalletizer'
  | 'robot_arm'
  | 'agv_station'
  | 'safety_gate'
  | 'emergency_stop'
  | 'sensor'
  | 'photo_eye'
  | 'proximity_sensor'
  | 'label_printer'
  | 'valve'
  | 'pneumatic_valve'
  | 'tank'
  | 'storage_tank'
  | 'custom';

// Ignition 8.1+ Specific Properties
export interface IgnitionComponentProperties {
  // Common Ignition Properties
  name: string;
  enabled: boolean;
  visible: boolean;
  quality: 'Good' | 'Bad' | 'Uncertain';

  // Perspective Specific
  perspective?: {
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    style: {
      classes?: string[];
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderRadius?: number;
      opacity?: number;
      transform?: string;
    };
    props: Record<string, any>;
    events?: {
      onActionPerformed?: string;
      onMouseEnter?: string;
      onMouseLeave?: string;
      onMouseClick?: string;
      onTouchStart?: string;
      onTouchEnd?: string;
    };
  };

  // Vision Specific
  vision?: {
    bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    background: string;
    foreground: string;
    font: {
      family: string;
      size: number;
      style: 'plain' | 'bold' | 'italic' | 'bold-italic';
    };
    border: {
      color: string;
      width: number;
      style: 'solid' | 'dashed' | 'dotted';
    };
    events?: {
      actionPerformed?: string;
      mouseEntered?: string;
      mouseExited?: string;
      mousePressed?: string;
      mouseReleased?: string;
      propertyChange?: string;
    };
  };

  // Tag Bindings (Ignition 8.1+ format)
  tagBindings?: {
    [propertyName: string]: {
      tagPath: string;
      bidirectional?: boolean;
      writeMode?: 'direct' | 'indirect';
      expression?: string;
    };
  };

  // Named Queries (Ignition 8.1+)
  namedQueries?: {
    [queryName: string]: {
      project: string;
      path: string;
      parameters?: Record<string, any>;
    };
  };

  // Security (Ignition 8.1+)
  security?: {
    roles?: string[];
    zones?: string[];
  };
}

// Ignition 8.1+ Export Formats
export interface IgnitionPerspectiveView {
  meta: {
    version: string;
    created: string;
    modified: string;
  };
  params: {
    [paramName: string]: {
      dataType: string;
      value?: any;
    };
  };
  props: {
    defaultSize: {
      width: number;
      height: number;
    };
  };
  root: {
    type: string;
    version: string;
    props: Record<string, any>;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    children?: IgnitionPerspectiveComponent[];
  };
}

export interface IgnitionPerspectiveComponent {
  type: string;
  version: string;
  props: Record<string, any>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  meta: {
    name: string;
  };
  children?: IgnitionPerspectiveComponent[];
}

export interface IgnitionVisionWindow {
  version: string;
  windowInfo: {
    title: string;
    width: number;
    height: number;
    resizable: boolean;
    maximizable: boolean;
    minimizable: boolean;
    modal: boolean;
  };
  rootContainer: {
    type: 'rootContainer';
    background: string;
    components: IgnitionVisionComponent[];
  };
}

export interface IgnitionVisionComponent {
  type: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  properties: Record<string, any>;
  events?: Record<string, string>;
  components?: IgnitionVisionComponent[];
}

// Ignition 8.1+ Tag Structure
export interface IgnitionTagDefinition {
  name: string;
  tagType: 'AtomicTag' | 'UdtInstance' | 'Folder';
  dataType:
    | 'Int1'
    | 'Int2'
    | 'Int4'
    | 'Int8'
    | 'Float4'
    | 'Float8'
    | 'Boolean'
    | 'String'
    | 'DateTime'
    | 'Document';
  value?: any;
  opcItemPath?: string;
  opcServer?: string;
  deadband?: number;
  historyProvider?: string;
  historyEnabled?: boolean;
  alarmConfig?: {
    enabled: boolean;
    modes: IgnitionAlarmMode[];
  };
  security?: {
    readRoles?: string[];
    writeRoles?: string[];
  };
}

export interface IgnitionAlarmMode {
  name: string;
  setpoint: number;
  deadband: number;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  enabled: boolean;
}

// Ignition 8.1+ Project Structure
export interface IgnitionProjectExport {
  ignition: {
    version: string;
    edition: 'Standard' | 'Maker' | 'Edge';
  };
  project: {
    title: string;
    description: string;
    enabled: boolean;
    inheritable: boolean;
  };
  tags?: IgnitionTagDefinition[];
  perspectives?: {
    views: IgnitionPerspectiveView[];
    resources: any[];
  };
  vision?: {
    windows: IgnitionVisionWindow[];
    templates: any[];
  };
  namedQueries?: any[];
  scripts?: any[];
  translation?: any[];
}

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
  source: 'manual' | 'ocr' | 'import' | 'text-description';
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

export type CanvasTool = 'select' | 'pan' | 'draw' | 'text' | 'measure' | 'delete';

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
  'components-deleted': (componentIds: string[]) => void;
  'template-created': (template: Template) => void;
  'template-updated': (template: Template) => void;
  'template-deleted': (templateId: string) => void;
  'files-uploaded': (files: FileInfo[]) => void;
  'file-deleted': (fileId: string) => void;
  'ocr-started': (data: { fileId: string; status: string }) => void;
  'ocr-completed': (data: {
    fileId: string;
    status: string;
    componentsFound: number;
    components: Component[];
  }) => void;
  'ocr-error': (data: { fileId: string; error: string }) => void;
}
