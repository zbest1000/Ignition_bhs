import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Group, Circle, Line, Rect, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { EditPoint, EditHandle, EditableComponent } from '../../types';

interface EditableShapeProps {
  component: EditableComponent;
  isSelected: boolean;
  isEditing: boolean;
  onUpdate: (updates: Partial<EditableComponent>) => void;
  onEditPointMove: (pointId: string, newX: number, newY: number) => void;
  onEditPointAdd?: (x: number, y: number, afterPointId?: string) => void;
  onEditPointDelete?: (pointId: string) => void;
  snapToGrid?: boolean;
  gridSize?: number;
  showDimensions?: boolean;
  showAngles?: boolean;
}

export const EditableShape: React.FC<EditableShapeProps> = ({
  component,
  isSelected,
  isEditing,
  onUpdate,
  onEditPointMove,
  onEditPointAdd,
  onEditPointDelete,
  snapToGrid = false,
  gridSize = 10,
  showDimensions = false,
  showAngles = false,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [draggingPoint, setDraggingPoint] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: component.geometry.width,
    height: component.geometry.height,
  });
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRef = useRef<Konva.Node>(null);

  // Generate edit points based on component type
  const generateEditPoints = useCallback((): EditPoint[] => {
    const points: EditPoint[] = [];
    const { x, y, width, height } = component.geometry;

    switch (component.componentType) {
      case 'perspective.conveyor':
      case 'straight-conveyor':
      case 'curved-conveyor':
        // For conveyors, create points at start, end, and control points
        points.push(
          { id: 'start', x, y, type: 'vertex' },
          { id: 'end', x: x + width, y: y + height, type: 'vertex' }
        );
        
        // Add midpoint for curved conveyors
        if (component.componentType === 'curved-conveyor' && component.conveyorProperties?.curveRadius) {
          const midX = x + width / 2;
          const midY = y + height / 2;
          points.push({ id: 'control', x: midX, y: midY, type: 'control' });
        }
        break;

      case 'perspective.cylindrical-tank':
      case 'perspective.vessel':
        // For tanks/vessels, add corner points and center
        points.push(
          { id: 'tl', x, y, type: 'vertex' },
          { id: 'tr', x: x + width, y, type: 'vertex' },
          { id: 'br', x: x + width, y: y + height, type: 'vertex' },
          { id: 'bl', x, y: y + height, type: 'vertex' },
          { id: 'center', x: x + width / 2, y: y + height / 2, type: 'center' }
        );
        break;

      case 'perspective.pipe':
        // For pipes, create points along the path
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
        }
        break;

      default:
        // Default rectangle edit points
        points.push(
          { id: 'tl', x, y, type: 'vertex' },
          { id: 'tr', x: x + width, y, type: 'vertex' },
          { id: 'br', x: x + width, y: y + height, type: 'vertex' },
          { id: 'bl', x, y: y + height, type: 'vertex' },
          // Midpoints for edge manipulation
          { id: 'tm', x: x + width / 2, y, type: 'midpoint' },
          { id: 'rm', x: x + width, y: y + height / 2, type: 'midpoint' },
          { id: 'bm', x: x + width / 2, y: y + height, type: 'midpoint' },
          { id: 'lm', x, y: y + height / 2, type: 'midpoint' }
        );
    }

    return points;
  }, [component]);

  const [editPoints, setEditPoints] = useState<EditPoint[]>(
    component.editPoints || generateEditPoints()
  );

  useEffect(() => {
    if (!component.editPoints) {
      setEditPoints(generateEditPoints());
    }
  }, [component, generateEditPoints]);

  // Snap to grid helper
  const snapToGrid = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [snapToGrid, gridSize]
  );

  // Handle point dragging
  const handlePointDragMove = useCallback(
    (pointId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newX = snapToGrid ? snapToGrid(node.x()) : node.x();
      const newY = snapToGrid ? snapToGrid(node.y()) : node.y();

      // Apply constraints if any
      const point = editPoints.find(p => p.id === pointId);
      if (point?.constraints) {
        const { minX, maxX, minY, maxY } = point.constraints;
        if (minX !== undefined) node.x(Math.max(minX, newX));
        if (maxX !== undefined) node.x(Math.min(maxX, newX));
        if (minY !== undefined) node.y(Math.max(minY, newY));
        if (maxY !== undefined) node.y(Math.min(maxY, newY));
      }

      onEditPointMove(pointId, node.x(), node.y());
      updateComponentGeometry(pointId, node.x(), node.y());
    },
    [editPoints, snapToGrid, onEditPointMove]
  );

  // Update component geometry based on point movement
  const updateComponentGeometry = useCallback(
    (pointId: string, newX: number, newY: number) => {
      const updatedPoints = editPoints.map(p =>
        p.id === pointId ? { ...p, x: newX, y: newY } : p
      );

      // Calculate new bounding box
      const xs = updatedPoints.filter(p => p.type === 'vertex').map(p => p.x);
      const ys = updatedPoints.filter(p => p.type === 'vertex').map(p => p.y);
      
      if (xs.length > 0 && ys.length > 0) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const newGeometry = {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        };

        onUpdate({
          geometry: { ...component.geometry, ...newGeometry },
          editPoints: updatedPoints,
        });

        setEditPoints(updatedPoints);
        setDimensions({ width: newGeometry.width, height: newGeometry.height });
      }
    },
    [editPoints, component, onUpdate]
  );

  // Handle transformer events
  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Reset scale and update size
      node.scaleX(1);
      node.scaleY(1);

      const newGeometry = {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      };

      onUpdate({ geometry: { ...component.geometry, ...newGeometry } });
      setEditPoints(generateEditPoints());
    },
    [component, onUpdate, generateEditPoints]
  );

  // Render edit handles
  const renderEditHandles = () => {
    if (!isEditing) return null;

    return editPoints.map(point => {
      const handleSize = point.type === 'vertex' ? 8 : 6;
      const handleColor = point.type === 'vertex' ? '#0066ff' : '#00cc88';
      const hoverColor = '#ff6600';
      const shape = point.type === 'vertex' ? 'rect' : 'circle';

      if (shape === 'rect') {
        return (
          <Rect
            key={point.id}
            x={point.x - handleSize / 2}
            y={point.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            fill={hoveredPoint === point.id ? hoverColor : handleColor}
            stroke="#fff"
            strokeWidth={1}
            draggable
            onDragMove={(e) => handlePointDragMove(point.id, e)}
            onDragStart={() => setDraggingPoint(point.id)}
            onDragEnd={() => setDraggingPoint(null)}
            onMouseEnter={() => setHoveredPoint(point.id)}
            onMouseLeave={() => setHoveredPoint(null)}
            onDblClick={() => {
              if (point.type === 'midpoint' && onEditPointAdd) {
                // Convert midpoint to vertex on double-click
                onEditPointAdd(point.x, point.y, point.id);
              }
            }}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        );
      }

      return (
        <Circle
          key={point.id}
          x={point.x}
          y={point.y}
          radius={handleSize / 2}
          fill={hoveredPoint === point.id ? hoverColor : handleColor}
          stroke="#fff"
          strokeWidth={1}
          draggable
          onDragMove={(e) => handlePointDragMove(point.id, e)}
          onDragStart={() => setDraggingPoint(point.id)}
          onDragEnd={() => setDraggingPoint(null)}
          onMouseEnter={() => setHoveredPoint(point.id)}
          onMouseLeave={() => setHoveredPoint(null)}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    });
  };

  // Render dimension labels
  const renderDimensions = () => {
    if (!showDimensions || !isEditing) return null;

    const { x, y, width, height } = component.geometry;

    return (
      <>
        {/* Width dimension */}
        <Group>
          <Line
            points={[x, y - 15, x + width, y - 15]}
            stroke="#666"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Text
            x={x + width / 2 - 20}
            y={y - 25}
            text={`${Math.round(width)}px`}
            fontSize={10}
            fill="#666"
          />
        </Group>

        {/* Height dimension */}
        <Group>
          <Line
            points={[x - 15, y, x - 15, y + height]}
            stroke="#666"
            strokeWidth={1}
            dash={[2, 2]}
          />
          <Text
            x={x - 40}
            y={y + height / 2 - 5}
            text={`${Math.round(height)}px`}
            fontSize={10}
            fill="#666"
          />
        </Group>
      </>
    );
  };

  // Render angle indicators
  const renderAngles = () => {
    if (!showAngles || !isEditing || !component.geometry.rotation) return null;

    const { x, y, width, height, rotation } = component.geometry;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return (
      <Group>
        <Line
          points={[centerX, centerY, centerX + 50, centerY]}
          stroke="#ff6600"
          strokeWidth={1}
          dash={[4, 4]}
          rotation={rotation}
          rotationX={centerX}
          rotationY={centerY}
        />
        <Text
          x={centerX + 60}
          y={centerY - 10}
          text={`${Math.round(rotation)}°`}
          fontSize={10}
          fill="#ff6600"
        />
      </Group>
    );
  };

  // Render selection outline
  const renderSelectionOutline = () => {
    if (!isSelected || isEditing) return null;

    const { x, y, width, height } = component.geometry;

    return (
      <Rect
        x={x - 2}
        y={y - 2}
        width={width + 4}
        height={height + 4}
        stroke="#0066ff"
        strokeWidth={2}
        dash={[5, 5]}
        fill="transparent"
        listening={false}
      />
    );
  };

  // Render connection lines between edit points (for pipes, conveyors)
  const renderConnectionLines = () => {
    if (!isEditing) return null;

    const shouldShowConnections = [
      'perspective.pipe',
      'perspective.conveyor',
      'straight-conveyor',
      'curved-conveyor',
    ].includes(component.componentType);

    if (!shouldShowConnections) return null;

    const vertices = editPoints.filter(p => p.type === 'vertex' || p.type === 'control');
    if (vertices.length < 2) return null;

    const linePoints = vertices.flatMap(p => [p.x, p.y]);

    return (
      <Line
        points={linePoints}
        stroke="#0066ff"
        strokeWidth={1}
        dash={[3, 3]}
        opacity={0.5}
        listening={false}
      />
    );
  };

  return (
    <Group>
      {renderSelectionOutline()}
      {renderConnectionLines()}
      {renderEditHandles()}
      {renderDimensions()}
      {renderAngles()}
      
      {/* Transformer for non-edit mode transformations */}
      {isSelected && !isEditing && (
        <Transformer
          ref={transformerRef}
          nodes={shapeRef.current ? [shapeRef.current] : []}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          onTransformEnd={handleTransformEnd}
          enabledAnchors={component.editConstraints?.allowScale !== false ? undefined : []}
          rotateEnabled={component.editConstraints?.allowRotate !== false}
        />
      )}
    </Group>
  );
};
