import React from 'react';
import { Group, Rect, Path, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import { Component, Point } from '../../types';

interface ComponentShapeProps {
  component: Component;
  isSelected: boolean;
  isHovered: boolean;
  showLabel: boolean;
  onClick: (componentId: string, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd: (componentId: string, position: Point) => void;
  draggable: boolean;
}

const ComponentShape: React.FC<ComponentShapeProps> = ({
  component,
  isSelected,
  isHovered,
  showLabel,
  onClick,
  onDragEnd,
  draggable,
}) => {
  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    onClick(component.id, e);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(component.id, {
      x: node.x(),
      y: node.y(),
    });
  };

  const renderShape = () => {
    const { geometry, style, type } = component;

    switch (type) {
      case 'straight_conveyor':
      case 'belt_conveyor':
      case 'roller_conveyor':
      case 'chain_conveyor':
      case 'accumulation_conveyor':
        return (
          <Rect
            width={geometry.width}
            height={geometry.height}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );

      case 'curve_90':
      case 'curve_45':
      case 'curve_180':
        const angle = parseInt(type.split('_')[1]);
        const radius = geometry.radius || Math.min(geometry.width, geometry.height) / 2;
        return (
          <Path
            data={generateCurvePath(angle, radius)}
            fill="none"
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );

      case 'diverter':
      case 'merge':
      case 'sorter':
        return (
          <>
            <Line
              points={[0, geometry.height / 2, geometry.width / 2, geometry.height / 2, geometry.width, 0]}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
            />
            <Line
              points={[geometry.width / 2, geometry.height / 2, geometry.width, geometry.height]}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
            />
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={5}
              fill={style.fill}
              stroke={style.stroke}
            />
          </>
        );

      case 'motor':
      case 'pusher':
      case 'lifter':
        return (
          <Circle
            x={geometry.width / 2}
            y={geometry.height / 2}
            radius={Math.min(geometry.width, geometry.height) / 2}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );

      case 'eds_machine':
      case 'scanner':
      case 'scale':
      case 'wrapper':
      case 'barcode_scanner':
      case 'rfid_reader':
        return (
          <Rect
            width={geometry.width}
            height={geometry.height}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
            cornerRadius={10}
          />
        );

      case 'turntable':
      case 'spiral_conveyor':
        return (
          <>
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={Math.min(geometry.width, geometry.height) / 2}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {type === 'spiral_conveyor' && (
              <Path
                data={`M ${geometry.width * 0.3} ${geometry.height * 0.3} Q ${geometry.width * 0.5} ${geometry.height * 0.5} ${geometry.width * 0.7} ${geometry.height * 0.7}`}
                stroke={style.stroke}
                strokeWidth={2}
                fill="none"
              />
            )}
          </>
        );

      case 'palletizer':
      case 'depalletizer':
      case 'robot_arm':
        return (
          <>
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {type === 'robot_arm' && (
              <Line
                points={[
                  geometry.width / 2, geometry.height / 2,
                  geometry.width * 0.8, geometry.height * 0.3
                ]}
                stroke={style.stroke}
                strokeWidth={3}
              />
            )}
          </>
        );

      case 'agv_station':
        return (
          <Path
            data={generateHexagonPath(geometry.width, geometry.height)}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );

      case 'safety_gate':
        return (
          <>
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            <Line
              points={[
                geometry.width * 0.2, geometry.height * 0.3,
                geometry.width * 0.8, geometry.height * 0.3,
                geometry.width * 0.8, geometry.height * 0.7,
                geometry.width * 0.2, geometry.height * 0.7
              ]}
              stroke={style.stroke}
              strokeWidth={2}
              dash={[5, 5]}
            />
          </>
        );

      case 'emergency_stop':
        return (
          <>
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={Math.min(geometry.width, geometry.height) / 2}
              fill="#E74C3C"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            <Text
              x={geometry.width / 2}
              y={geometry.height / 2}
              text="E"
              fontSize={16}
              fontStyle="bold"
              fill="white"
              align="center"
              verticalAlign="middle"
              offsetX={5}
              offsetY={8}
            />
          </>
        );

      case 'sensor':
      case 'photo_eye':
      case 'proximity_sensor':
        return (
          <>
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={Math.min(geometry.width, geometry.height) / 3}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {type === 'photo_eye' && (
              <Line
                points={[
                  geometry.width / 2, geometry.height / 2,
                  geometry.width, geometry.height / 2
                ]}
                stroke={style.stroke}
                strokeWidth={2}
                dash={[3, 3]}
              />
            )}
          </>
        );

      case 'label_printer':
        return (
          <>
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            <Rect
              x={geometry.width * 0.1}
              y={geometry.height * 0.6}
              width={geometry.width * 0.8}
              height={geometry.height * 0.2}
              fill="white"
              stroke={style.stroke}
            />
          </>
        );

      default:
        // Default rectangle shape
        return (
          <Rect
            width={geometry.width}
            height={geometry.height}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );
    }
  };

  const generateCurvePath = (angle: number, radius: number): string => {
    const sweepAngle = (angle * Math.PI) / 180;
    const startX = 0;
    const startY = radius;
    const endX = radius * Math.sin(sweepAngle);
    const endY = radius * (1 - Math.cos(sweepAngle));
    const largeArcFlag = angle > 180 ? 1 : 0;

    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  };

  const generateHexagonPath = (width: number, height: number): string => {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) / 2;
    const points = [];
    
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return points.join(' ') + ' Z';
  };

  const selectionColor = isSelected ? '#0066ff' : isHovered ? '#66aaff' : 'transparent';
  const selectionStrokeWidth = isSelected ? 2 : 1;

  return (
    <Group
      id={component.id}
      x={component.geometry.x}
      y={component.geometry.y}
      rotation={component.geometry.rotation}
      scaleX={component.geometry.scale}
      scaleY={component.geometry.scale}
      draggable={draggable}
      onClick={handleClick}
      onDragEnd={handleDragEnd}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = draggable ? 'move' : 'pointer';
        }
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = 'default';
        }
      }}
    >
      {/* Component shape */}
      {renderShape()}

      {/* Selection outline */}
      <Rect
        width={component.geometry.width}
        height={component.geometry.height}
        stroke={selectionColor}
        strokeWidth={selectionStrokeWidth}
        fill="transparent"
        listening={false}
      />

      {/* Label */}
      {showLabel && component.label && (
        <Text
          x={0}
          y={component.geometry.height + 5}
          text={component.label}
          fontSize={12}
          fill="#333333"
          listening={false}
        />
      )}
    </Group>
  );
};

export default ComponentShape;