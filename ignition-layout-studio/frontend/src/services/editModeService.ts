import { EditMode, EditHistoryEntry, EditPoint, Component, EditableComponent } from '../types';

export class EditModeService {
  private static instance: EditModeService;
  private editMode: EditMode = {
    enabled: false,
    selectedComponent: null,
    editPoints: [],
    activePoint: null,
    tool: 'select',
    snapToGrid: true,
    snapToPoints: true,
    snapDistance: 10,
    showDimensions: false,
    showAngles: false,
    history: [],
    historyIndex: -1,
  };

  private maxHistorySize = 50;
  private listeners: ((mode: EditMode) => void)[] = [];

  private constructor() {}

  static getInstance(): EditModeService {
    if (!EditModeService.instance) {
      EditModeService.instance = new EditModeService();
    }
    return EditModeService.instance;
  }

  // Subscribe to edit mode changes
  subscribe(listener: (mode: EditMode) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of changes
  private notify(): void {
    this.listeners.forEach(listener => listener(this.editMode));
  }

  // Get current edit mode state
  getEditMode(): EditMode {
    return { ...this.editMode };
  }

  // Enable/disable edit mode
  toggleEditMode(componentId?: string): void {
    this.editMode.enabled = !this.editMode.enabled;
    if (this.editMode.enabled && componentId) {
      this.editMode.selectedComponent = componentId;
    } else if (!this.editMode.enabled) {
      this.editMode.selectedComponent = null;
      this.editMode.editPoints = [];
      this.editMode.activePoint = null;
    }
    this.notify();
  }

  // Set selected component
  setSelectedComponent(componentId: string | null): void {
    this.editMode.selectedComponent = componentId;
    if (!componentId) {
      this.editMode.editPoints = [];
      this.editMode.activePoint = null;
      this.editMode.enabled = false;
    }
    this.notify();
  }

  // Set edit points for current component
  setEditPoints(points: EditPoint[]): void {
    this.editMode.editPoints = points;
    this.notify();
  }

  // Set active edit point
  setActivePoint(pointId: string | null): void {
    this.editMode.activePoint = pointId;
    this.notify();
  }

  // Change current tool
  setTool(tool: EditMode['tool']): void {
    this.editMode.tool = tool;
    this.notify();
  }

  // Toggle snap to grid
  toggleSnapToGrid(): void {
    this.editMode.snapToGrid = !this.editMode.snapToGrid;
    this.notify();
  }

  // Toggle snap to points
  toggleSnapToPoints(): void {
    this.editMode.snapToPoints = !this.editMode.snapToPoints;
    this.notify();
  }

  // Set snap distance
  setSnapDistance(distance: number): void {
    this.editMode.snapDistance = Math.max(5, Math.min(50, distance));
    this.notify();
  }

  // Toggle show dimensions
  toggleShowDimensions(): void {
    this.editMode.showDimensions = !this.editMode.showDimensions;
    this.notify();
  }

  // Toggle show angles
  toggleShowAngles(): void {
    this.editMode.showAngles = !this.editMode.showAngles;
    this.notify();
  }

  // Add history entry
  addHistoryEntry(entry: Omit<EditHistoryEntry, 'timestamp'>): void {
    // Remove any entries after current index
    this.editMode.history = this.editMode.history.slice(0, this.editMode.historyIndex + 1);

    // Add new entry
    this.editMode.history.push({
      ...entry,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.editMode.history.length > this.maxHistorySize) {
      this.editMode.history = this.editMode.history.slice(-this.maxHistorySize);
    }

    this.editMode.historyIndex = this.editMode.history.length - 1;
    this.notify();
  }

  // Undo last action
  undo(): EditHistoryEntry | null {
    if (this.editMode.historyIndex >= 0) {
      const entry = this.editMode.history[this.editMode.historyIndex];
      this.editMode.historyIndex--;
      this.notify();
      return entry;
    }
    return null;
  }

  // Redo last undone action
  redo(): EditHistoryEntry | null {
    if (this.editMode.historyIndex < this.editMode.history.length - 1) {
      this.editMode.historyIndex++;
      const entry = this.editMode.history[this.editMode.historyIndex];
      this.notify();
      return entry;
    }
    return null;
  }

  // Check if can undo
  canUndo(): boolean {
    return this.editMode.historyIndex >= 0;
  }

  // Check if can redo
  canRedo(): boolean {
    return this.editMode.historyIndex < this.editMode.history.length - 1;
  }

  // Clear history
  clearHistory(): void {
    this.editMode.history = [];
    this.editMode.historyIndex = -1;
    this.notify();
  }

  // Snap value to grid
  snapToGrid(value: number, gridSize: number = 10): number {
    if (!this.editMode.snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }

  // Find nearest snap point
  findNearestSnapPoint(x: number, y: number, excludePoint?: string): { x: number; y: number; snapped: boolean } {
    if (!this.editMode.snapToPoints || this.editMode.editPoints.length === 0) {
      return { x, y, snapped: false };
    }

    let minDistance = this.editMode.snapDistance;
    let snapX = x;
    let snapY = y;
    let snapped = false;

    for (const point of this.editMode.editPoints) {
      if (point.id === excludePoint) continue;

      const dx = Math.abs(x - point.x);
      const dy = Math.abs(y - point.y);

      // Snap to X coordinate
      if (dx < minDistance) {
        snapX = point.x;
        snapped = true;
      }

      // Snap to Y coordinate
      if (dy < minDistance) {
        snapY = point.y;
        snapped = true;
      }
    }

    return { x: snapX, y: snapY, snapped };
  }

  // Calculate angle between two points
  calculateAngle(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  // Calculate distance between two points
  calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Generate edit points for a component
  generateEditPoints(component: Component): EditPoint[] {
    const points: EditPoint[] = [];
    const { x, y, width, height } = component.geometry;

    switch (component.componentType) {
      case 'perspective.conveyor':
      case 'straight-conveyor':
      case 'curved-conveyor':
        // Conveyor edit points
        points.push(
          { id: 'start', x, y, type: 'vertex' },
          { id: 'end', x: x + width, y: y + height, type: 'vertex' }
        );
        
        if (component.componentType === 'curved-conveyor') {
          // Add control point for curve
          const midX = x + width / 2;
          const midY = y + height / 2;
          points.push({ id: 'control', x: midX, y: midY, type: 'control' });
        }
        break;

      case 'perspective.pipe':
        // Pipe with custom path
        if (component.customProperties?.path) {
          const path = component.customProperties.path as Array<{ x: number; y: number }>;
          path.forEach((point, index) => {
            points.push({
              id: `p${index}`,
              x: point.x,
              y: point.y,
              type: index === 0 || index === path.length - 1 ? 'vertex' : 'control',
            });
          });
        } else {
          // Default pipe points
          points.push(
            { id: 'start', x, y: y + height / 2, type: 'vertex' },
            { id: 'end', x: x + width, y: y + height / 2, type: 'vertex' }
          );
        }
        break;

      case 'perspective.cylindrical-tank':
      case 'perspective.vessel':
        // Tank/vessel corner points
        points.push(
          { id: 'tl', x, y, type: 'vertex' },
          { id: 'tr', x: x + width, y, type: 'vertex' },
          { id: 'br', x: x + width, y: y + height, type: 'vertex' },
          { id: 'bl', x, y: y + height, type: 'vertex' }
        );
        break;

      default:
        // Default rectangular edit points
        // Vertices (corners)
        points.push(
          { id: 'tl', x, y, type: 'vertex' },
          { id: 'tr', x: x + width, y, type: 'vertex' },
          { id: 'br', x: x + width, y: y + height, type: 'vertex' },
          { id: 'bl', x, y: y + height, type: 'vertex' }
        );
        
        // Midpoints (for edge manipulation)
        points.push(
          { id: 'tm', x: x + width / 2, y, type: 'midpoint' },
          { id: 'rm', x: x + width, y: y + height / 2, type: 'midpoint' },
          { id: 'bm', x: x + width / 2, y: y + height, type: 'midpoint' },
          { id: 'lm', x, y: y + height / 2, type: 'midpoint' }
        );
    }

    return points;
  }

  // Update component geometry from edit points
  updateComponentFromPoints(component: EditableComponent, points: EditPoint[]): Partial<EditableComponent> {
    const vertices = points.filter(p => p.type === 'vertex');
    
    if (vertices.length === 0) return {};

    // Calculate bounding box from vertices
    const xs = vertices.map(p => p.x);
    const ys = vertices.map(p => p.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const updates: Partial<EditableComponent> = {
      geometry: {
        ...component.geometry,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      editPoints: points,
    };

    // Update custom properties for specific component types
    if (component.componentType === 'perspective.pipe' && component.customProperties?.path) {
      const pathPoints = points
        .filter(p => p.id.startsWith('p'))
        .sort((a, b) => {
          const aIndex = parseInt(a.id.substring(1));
          const bIndex = parseInt(b.id.substring(1));
          return aIndex - bIndex;
        })
        .map(p => ({ x: p.x, y: p.y }));

      updates.customProperties = {
        ...component.customProperties,
        path: pathPoints,
      };
    }

    return updates;
  }

  // Convert midpoint to vertex
  convertMidpointToVertex(points: EditPoint[], midpointId: string): EditPoint[] {
    const midpoint = points.find(p => p.id === midpointId && p.type === 'midpoint');
    if (!midpoint) return points;

    // Change type to vertex
    const updatedPoints = points.map(p =>
      p.id === midpointId ? { ...p, type: 'vertex' as const } : p
    );

    // Generate new midpoints if needed
    // This would depend on the specific shape logic

    return updatedPoints;
  }

  // Add new edit point
  addEditPoint(points: EditPoint[], x: number, y: number, afterPointId?: string): EditPoint[] {
    const newPoint: EditPoint = {
      id: `p${Date.now()}`,
      x,
      y,
      type: 'vertex',
    };

    if (afterPointId) {
      const index = points.findIndex(p => p.id === afterPointId);
      if (index !== -1) {
        return [...points.slice(0, index + 1), newPoint, ...points.slice(index + 1)];
      }
    }

    return [...points, newPoint];
  }

  // Remove edit point
  removeEditPoint(points: EditPoint[], pointId: string): EditPoint[] {
    return points.filter(p => p.id !== pointId);
  }

  // Apply constraints to point movement
  applyConstraints(point: EditPoint, newX: number, newY: number): { x: number; y: number } {
    let x = newX;
    let y = newY;

    if (point.constraints) {
      const { minX, maxX, minY, maxY } = point.constraints;
      
      if (minX !== undefined) x = Math.max(minX, x);
      if (maxX !== undefined) x = Math.min(maxX, x);
      if (minY !== undefined) y = Math.max(minY, y);
      if (maxY !== undefined) y = Math.min(maxY, y);
    }

    return { x, y };
  }
}
