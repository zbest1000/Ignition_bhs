import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Circle, Image } from 'react-konva';
import { Component, EditMode, EditableComponent } from '../../types';
import ComponentShape from './ComponentShape';
import { EditableShape } from './EditableShape';
import { EditToolbar } from './EditToolbar';
import { EditModeService } from '../../services/editModeService';
import './Canvas.css';

interface CanvasProps {
  components: Component[];
  canvasState: any; // CanvasState type was removed, so using 'any' for now
  onCanvasStateChange: (state: Partial<any>) => void; // CanvasState type was removed, so using 'any' for now
  onComponentSelect: (componentIds: string[]) => void;
  onComponentUpdate: (componentId: string, updates: Partial<Component>) => void;
  onComponentCreate: (component: Partial<Component>) => void;
  width: number;
  height: number;
}

const Canvas: React.FC<CanvasProps> = ({
  components,
  canvasState,
  onCanvasStateChange,
  onComponentSelect,
  onComponentUpdate,
  onComponentCreate,
  width,
  height,
}) => {
  const stageRef = useRef<any>(null); // Konva.Stage type was removed, so using 'any'
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<any | null>(null); // Point type was removed, so using 'any'
  
  // Edit mode state
  const [editMode, setEditMode] = useState<EditMode>(() => 
    EditModeService.getInstance().getEditMode()
  );
  const editService = EditModeService.getInstance();

  // Subscribe to edit mode changes
  useEffect(() => {
    const unsubscribe = editService.subscribe(setEditMode);
    return unsubscribe;
  }, [editService]);

  // Keyboard shortcuts for edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'e':
          if (canvasState.selectedComponents?.length > 0) {
            handleToggleEdit();
          }
          break;
        case 'v':
          editService.setTool('select');
          break;
        case 'm':
          editService.setTool('move');
          break;
        case 'r':
          editService.setTool('rotate');
          break;
        case 's':
          if (!e.ctrlKey) {
            editService.setTool('scale');
          }
          break;
        case 'delete':
        case 'backspace':
          if (canvasState.selectedComponents?.length > 0) {
            handleDelete();
          }
          break;
        case 'z':
          if (e.ctrlKey && !e.shiftKey) {
            handleUndo();
          } else if (e.ctrlKey && e.shiftKey) {
            handleRedo();
          }
          break;
        case 'y':
          if (e.ctrlKey) {
            handleRedo();
          }
          break;
        case 'escape':
          if (editMode.enabled) {
            handleCancel();
          } else {
            onComponentSelect([]);
          }
          break;
        case 'enter':
          if (editMode.enabled) {
            handleSave();
          }
          break;
        case 'g':
          if (e.ctrlKey) {
            e.preventDefault();
            editService.toggleSnapToGrid();
          }
          break;
        case 'd':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            editService.toggleShowDimensions();
          }
          break;
        case 'a':
          if (e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            editService.toggleShowAngles();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canvasState.selectedComponents,
    editMode.enabled,
    handleToggleEdit,
    handleDelete,
    handleUndo,
    handleRedo,
    handleCancel,
    handleSave,
    onComponentSelect,
    editService
  ]);

  // Handle mouse wheel for zoom
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (e: any) => { // Konva.KonvaEventObject type was removed, so using 'any'
      e.evt.preventDefault();

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const scaleBy = 1.1;
      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

      // Limit zoom
      const limitedScale = Math.max(0.1, Math.min(5, newScale));

      stage.scale({ x: limitedScale, y: limitedScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * limitedScale,
        y: pointer.y - mousePointTo.y * limitedScale,
      };

      stage.position(newPos);
      stage.batchDraw();

      onCanvasStateChange({
        zoom: limitedScale,
        pan: newPos,
      });
    };

    stage.on('wheel', handleWheel);

    return () => {
      stage.off('wheel', handleWheel);
    };
  }, [onCanvasStateChange]);

  // Handle stage mouse down
  const handleStageMouseDown = (e: any) => { // Konva.KonvaEventObject type was removed, so using 'any'
    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // If clicking on empty space, start selection or deselect all
    if (e.target === stage || e.target.className === 'Layer') {
      if (canvasState.tool === 'select') {
        setIsSelecting(true);
        setDragStartPos(pos);
        setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });

        // Clear selection if not holding shift
        if (!e.evt.shiftKey) {
          onComponentSelect([]);
        }
      } else if (canvasState.tool === 'pan') {
        // Pan mode - handled by stage draggable
      }
    }
  };

  // Handle stage mouse move
  const handleStageMouseMove = (e: any) => { // Konva.KonvaEventObject type was removed, so using 'any'
    if (!isSelecting || !dragStartPos) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    setSelectionRect({
      x: Math.min(dragStartPos.x, pos.x),
      y: Math.min(dragStartPos.y, pos.y),
      width: Math.abs(pos.x - dragStartPos.x),
      height: Math.abs(pos.y - dragStartPos.y),
    });
  };

  // Handle stage mouse up
  const handleStageMouseUp = () => {
    if (isSelecting && selectionRect) {
      // Find components within selection rectangle
      const stage = stageRef.current;
      if (!stage) return;

      const selectedIds: string[] = [];

      components.forEach(component => {
        const node = stage.findOne(`#${component.id}`);
        if (!node) return;

        const box = node.getClientRect();

        // Check if component is within selection
        if (
          box.x >= selectionRect.x &&
          box.y >= selectionRect.y &&
          box.x + box.width <= selectionRect.x + selectionRect.width &&
          box.y + box.height <= selectionRect.y + selectionRect.height
        ) {
          selectedIds.push(component.id);
        }
      });

      if (selectedIds.length > 0) {
        onComponentSelect([...new Set([...canvasState.selectedComponents, ...selectedIds])]);
      }
    }

    setIsSelecting(false);
    setSelectionRect(null);
    setDragStartPos(null);
  };

  // Handle component click
  const handleComponentClick = (componentId: string, e: any) => { // Konva.KonvaEventObject type was removed, so using 'any'
    e.cancelBubble = true;

    if (canvasState.tool === 'select') {
      if (e.evt.shiftKey) {
        // Toggle selection
        const isSelected = canvasState.selectedComponents.includes(componentId);
        if (isSelected) {
                     onComponentSelect(canvasState.selectedComponents.filter((id: string) => id !== componentId));
        } else {
          onComponentSelect([...canvasState.selectedComponents, componentId]);
        }
      } else if (e.evt.ctrlKey || e.evt.metaKey) {
        // Add to selection
        if (!canvasState.selectedComponents.includes(componentId)) {
          onComponentSelect([...canvasState.selectedComponents, componentId]);
        }
      } else {
        // Single selection
        onComponentSelect([componentId]);
      }
    } else if (canvasState.tool === 'delete') {
      // Delete tool - handled by parent
      e.evt.preventDefault();
    }
  };

  // Handle component drag
  const handleComponentDrag = (componentId: string, newPosition: any) => { // Point type was removed, so using 'any'
    let finalPosition = newPosition;

    // Apply grid snapping if enabled
    if (canvasState.snapToGrid) {
      const gridSize = canvasState.showGrid ? 20 : 10;
      finalPosition = {
        x: Math.round(newPosition.x / gridSize) * gridSize,
        y: Math.round(newPosition.y / gridSize) * gridSize,
      };
    }

    onComponentUpdate(componentId, {
      geometry: {
        ...components.find(c => c.id === componentId)?.geometry!,
        ...finalPosition,
      },
    });
  };

  // Get visible components based on layers
  const visibleComponents = components.filter(component => {
    // Check if component's layer is visible
    // For now, show all components
    return component.style.visible;
  });

  // Edit mode handlers
  const handleToggleEdit = useCallback(() => {
    const selectedId = canvasState.selectedComponents?.[0];
    if (selectedId) {
      editService.toggleEditMode(selectedId);
      const component = components.find(c => c.id === selectedId);
      if (component && editMode.enabled) {
        const points = editService.generateEditPoints(component);
        editService.setEditPoints(points);
      }
    }
  }, [canvasState.selectedComponents, components, editMode.enabled, editService]);

  const handleEditPointMove = useCallback((componentId: string, pointId: string, newX: number, newY: number) => {
    const component = components.find(c => c.id === componentId);
    if (!component) return;

    const points = editMode.editPoints.map(p =>
      p.id === pointId ? { ...p, x: newX, y: newY } : p
    );

    const updates = editService.updateComponentFromPoints(component as EditableComponent, points);
    if (updates.geometry) {
      onComponentUpdate(componentId, updates);
      editService.setEditPoints(points);
    }
  }, [components, editMode.editPoints, editService, onComponentUpdate]);

  const handleUndo = useCallback(() => {
    const entry = editService.undo();
    if (entry) {
      onComponentUpdate(entry.componentId, entry.before);
    }
  }, [editService, onComponentUpdate]);

  const handleRedo = useCallback(() => {
    const entry = editService.redo();
    if (entry) {
      onComponentUpdate(entry.componentId, entry.after);
    }
  }, [editService, onComponentUpdate]);

  const handleDelete = useCallback(() => {
    // This should be handled by parent component
    const selectedIds = canvasState.selectedComponents || [];
    selectedIds.forEach(id => {
      // Trigger delete through parent
      onComponentUpdate(id, { deleted: true } as any);
    });
    onComponentSelect([]);
  }, [canvasState.selectedComponents, onComponentUpdate, onComponentSelect]);

  const handleSave = useCallback(() => {
    editService.toggleEditMode();
  }, [editService]);

  const handleCancel = useCallback(() => {
    // Revert changes if needed
    editService.toggleEditMode();
  }, [editService]);

  return (
    <div className="canvas-container">
      {/* Edit Toolbar */}
      {(editMode.enabled || canvasState.selectedComponents?.length > 0) && (
        <EditToolbar
          editMode={editMode}
          onToolChange={tool => editService.setTool(tool)}
          onToggleEdit={handleToggleEdit}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDelete={handleDelete}
          onSnapToGridToggle={enabled => editService.toggleSnapToGrid()}
          onSnapToPointsToggle={enabled => editService.toggleSnapToPoints()}
          onSnapDistanceChange={distance => editService.setSnapDistance(distance)}
          onShowDimensionsToggle={enabled => editService.toggleShowDimensions()}
          onShowAnglesToggle={enabled => editService.toggleShowAngles()}
          onSave={handleSave}
          onCancel={handleCancel}
          canUndo={editService.canUndo()}
          canRedo={editService.canRedo()}
          hasSelection={canvasState.selectedComponents?.length > 0}
        />
      )}
      
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        draggable={canvasState.tool === 'pan'}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        scaleX={canvasState.zoom}
        scaleY={canvasState.zoom}
        x={canvasState.pan.x}
        y={canvasState.pan.y}
      >
        <Layer>
            {/* Grid */}
            {canvasState.showGrid && (
              <div className="canvas-grid" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `
                  linear-gradient(to right, #ddd 1px, transparent 1px),
                  linear-gradient(to bottom, #ddd 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }} />
            )}

            {/* Components */}
            {visibleComponents.map(component => {
              const isSelected = canvasState.selectedComponents?.includes(component.id);
              const isEditing = editMode.enabled && editMode.selectedComponent === component.id;
              
              return (
                <React.Fragment key={component.id}>
                  <ComponentShape
                    component={component}
                    isSelected={isSelected && !isEditing}
                    isHovered={canvasState.hoveredComponent === component.id}
                    showLabel={canvasState.showLabels}
                    onClick={handleComponentClick}
                    onDragEnd={handleComponentDrag}
                    draggable={canvasState.tool === 'select' && !component.style.locked && !isEditing}
                  />
                  {isEditing && (
                    <EditableShape
                      component={component as EditableComponent}
                      isSelected={isSelected}
                      isEditing={isEditing}
                      onUpdate={(updates) => onComponentUpdate(component.id, updates)}
                      onEditPointMove={(pointId, newX, newY) => 
                        handleEditPointMove(component.id, pointId, newX, newY)
                      }
                      snapToGrid={editMode.snapToGrid}
                      gridSize={10}
                      showDimensions={editMode.showDimensions}
                      showAngles={editMode.showAngles}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Selection box */}
            {selectionRect && (
              <div
                className="canvas-selection-box"
                style={{
                  position: 'absolute',
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: selectionRect.width,
                  height: selectionRect.height,
                  border: '2px dashed #1890ff',
                  background: 'rgba(24, 144, 255, 0.1)',
                  pointerEvents: 'none'
                }}
              />
            )}
        </Layer>
      </Stage>
    </div>
  );
};

export default Canvas;
