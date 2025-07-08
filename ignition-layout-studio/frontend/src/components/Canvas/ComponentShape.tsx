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