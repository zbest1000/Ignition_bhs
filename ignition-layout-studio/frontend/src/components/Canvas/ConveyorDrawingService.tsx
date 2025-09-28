import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Group, Circle, Text } from 'react-konva';
import { Component, ConveyorProperties } from '../../types';
import { ConveyorEngine } from '../../services/conveyorEngine';
import { v4 as uuidv4 } from 'uuid';

export type ConveyorTool = 
  | 'select' 
  | 'straight' 
  | 'curve' 
  | 'merge' 
  | 'divert' 
  | 'transfer' 
  | 'accumulation'
  | 'spiral'
  | 'clone'
  | 'number'
  | 'flow';

interface ConveyorDrawingServiceProps {
  activeTool: ConveyorTool;
  onConveyorCreate: (component: Component) => void;
  onConveyorUpdate: (id: string, updates: Partial<Component>) => void;
  onConveyorSelect: (id: string) => void;
  conveyorTemplates: any[];
  snapToGrid: boolean;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface DrawingState {
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number } | null;
  previewConveyor: Component | null;
}

export const ConveyorDrawingService: React.FC<ConveyorDrawingServiceProps> = ({
  activeTool,
  onConveyorCreate,
  onConveyorUpdate,
  onConveyorSelect,
  conveyorTemplates,
  snapToGrid,
  gridSize,
  canvasWidth,
  canvasHeight,
}) => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    previewConveyor: null,
  });

  const stageRef = useRef<any>(null);

  // Snap point to grid if enabled
  const snapToGridPoint = useCallback((point: { x: number; y: number }) => {
    if (!snapToGrid) return point;
    
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Get current template based on active tool
  const getCurrentTemplate = useCallback(() => {
    const toolTemplates = {
      'straight': conveyorTemplates.find(t => t.type === 'straight') || conveyorTemplates[0],
      'curve': conveyorTemplates.find(t => t.type === 'curve') || conveyorTemplates[4], // curve-90
      'merge': conveyorTemplates.find(t => t.type === 'merge') || conveyorTemplates[0],
      'divert': conveyorTemplates.find(t => t.type === 'divert') || conveyorTemplates[0],
      'accumulation': conveyorTemplates.find(t => t.type === 'accumulation') || conveyorTemplates[1],
    };
    
    return toolTemplates[activeTool as keyof typeof toolTemplates] || conveyorTemplates[0];
  }, [activeTool, conveyorTemplates]);

  // Create conveyor component from drawing points
  const createConveyorFromPoints = useCallback((
    start: { x: number; y: number },
    end: { x: number; y: number },
    template: any
  ): Component => {
    const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
    
    const conveyorProperties: ConveyorProperties = {
      length: length,
      width: template.properties.width,
      angle: angle,
      speed: template.properties.speed,
      curveRadius: template.properties.curveRadius,
      curveAngle: activeTool === 'curve' ? 90 : undefined,
    };

    const conveyorRendering = ConveyorEngine.generateConveyorRendering(
      { x: start.x, y: start.y, width: length, height: template.properties.width },
      conveyorProperties,
      { fill: template.properties.color, stroke: '#333', strokeWidth: 2 }
    );

    return {
      id: uuidv4(),
      projectId: '', // Will be set by parent
      name: `${template.name} Conveyor`,
      type: activeTool === 'curve' ? 'curve_90_conveyor' : 'straight_conveyor',
      componentType: activeTool === 'curve' ? 'curved-conveyor' : 'straight-conveyor',
      geometry: {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      },
      style: {
        fill: template.properties.color,
        stroke: '#333',
        strokeWidth: 2,
        opacity: 1,
      },
      conveyorProperties,
      conveyorRendering,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [activeTool]);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback((e: any) => {
    if (activeTool === 'select') return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const snappedPoint = snapToGridPoint(point);

    setDrawingState({
      isDrawing: true,
      startPoint: snappedPoint,
      currentPoint: snappedPoint,
      previewConveyor: null,
    });
  }, [activeTool, snapToGridPoint]);

  // Handle mouse move - update preview
  const handleMouseMove = useCallback((e: any) => {
    if (!drawingState.isDrawing || !drawingState.startPoint) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const snappedPoint = snapToGridPoint(point);

    setDrawingState(prev => ({
      ...prev,
      currentPoint: snappedPoint,
      previewConveyor: createConveyorFromPoints(
        prev.startPoint!,
        snappedPoint,
        getCurrentTemplate()
      ),
    }));
  }, [drawingState.isDrawing, drawingState.startPoint, snapToGridPoint, createConveyorFromPoints, getCurrentTemplate]);

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback((e: any) => {
    if (!drawingState.isDrawing || !drawingState.startPoint || !drawingState.currentPoint) {
      setDrawingState({
        isDrawing: false,
        startPoint: null,
        currentPoint: null,
        previewConveyor: null,
      });
      return;
    }

    // Only create conveyor if there's meaningful distance
    const distance = Math.sqrt(
      Math.pow(drawingState.currentPoint.x - drawingState.startPoint.x, 2) +
      Math.pow(drawingState.currentPoint.y - drawingState.startPoint.y, 2)
    );

    if (distance > 10) { // Minimum 10px distance
      const conveyor = createConveyorFromPoints(
        drawingState.startPoint,
        drawingState.currentPoint,
        getCurrentTemplate()
      );
      
      onConveyorCreate(conveyor);
    }

    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      previewConveyor: null,
    });
  }, [drawingState, createConveyorFromPoints, getCurrentTemplate, onConveyorCreate]);

  // Render preview conveyor
  const renderPreviewConveyor = () => {
    if (!drawingState.previewConveyor) return null;

    const { geometry, style, conveyorRendering } = drawingState.previewConveyor;
    
    return (
      <Group>
        {/* Preview conveyor segments */}
        {conveyorRendering?.segments.map((segment, index) => (
          <Line
            key={`preview-segment-${index}`}
            points={[
              segment.start.x, segment.start.y,
              segment.end.x, segment.end.y
            ]}
            stroke={style.stroke}
            strokeWidth={segment.beltWidth || 20}
            opacity={0.6}
            dash={[5, 5]}
          />
        ))}
        
        {/* Preview length indicator */}
        {drawingState.startPoint && drawingState.currentPoint && (
          <Group>
            <Line
              points={[
                drawingState.startPoint.x, drawingState.startPoint.y - 10,
                drawingState.currentPoint.x, drawingState.currentPoint.y - 10
              ]}
              stroke="#1890ff"
              strokeWidth={1}
            />
            <Text
              x={(drawingState.startPoint.x + drawingState.currentPoint.x) / 2}
              y={drawingState.startPoint.y - 25}
              text={`${Math.round(Math.sqrt(
                Math.pow(drawingState.currentPoint.x - drawingState.startPoint.x, 2) +
                Math.pow(drawingState.currentPoint.y - drawingState.startPoint.y, 2)
              ))}mm`}
              fontSize={12}
              fill="#1890ff"
              align="center"
            />
          </Group>
        )}
      </Group>
    );
  };

  return (
    <div>
      {/* Drawing event handlers */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          pointerEvents: activeTool !== 'select' ? 'auto' : 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      
      {/* Preview layer */}
      {drawingState.isDrawing && (
        <Stage
          ref={stageRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 2 }}
        >
          <Layer>
            {renderPreviewConveyor()}
          </Layer>
        </Stage>
      )}
    </div>
  );
};

export default ConveyorDrawingService;
