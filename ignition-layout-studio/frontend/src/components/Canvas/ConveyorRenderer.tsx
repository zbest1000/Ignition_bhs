import React, { useRef, useEffect } from 'react';
import { Group, Rect, Path, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import { Component, ConveyorSegment, ConveyorSupport, ConveyorAccessory } from '../../types';

interface ConveyorRendererProps {
  segments: ConveyorSegment[];
  supports: ConveyorSupport[];
  accessories: ConveyorAccessory[];
  style: { fill: string; stroke: string; strokeWidth: number };
  x: number;
  y: number;
  scale?: number;
}

/**
 * Advanced Canvas-based conveyor renderer using mathematical calculations
 * Provides better performance and precision than SVG for complex conveyor layouts
 */
const ConveyorRenderer: React.FC<ConveyorRendererProps> = ({
  segments,
  supports,
  accessories,
  style,
  x,
  y,
  scale = 1
}) => {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    // Optional: Add physics-based rendering optimizations
    if (groupRef.current) {
      // Could add collision detection, animation, etc.
    }
  }, [segments]);

  return (
    <Group ref={groupRef} x={x} y={y}>
      {/* Render conveyor segments */}
      {segments.map((segment, index) => (
        <ConveyorSegmentRenderer
          key={index}
          segment={segment}
          style={style}
          scale={scale}
        />
      ))}

      {/* Render supports */}
      {supports.map((support, index) => (
        <ConveyorSupportRenderer
          key={`support-${index}`}
          support={support}
          style={style}
        />
      ))}

      {/* Render accessories */}
      {accessories.map((accessory, index) => (
        <ConveyorAccessoryRenderer
          key={`accessory-${index}`}
          accessory={accessory}
          style={style}
        />
      ))}
    </Group>
  );
};

/**
 * Render individual conveyor segment using Canvas API for better performance
 */
const ConveyorSegmentRenderer: React.FC<{
  segment: ConveyorSegment;
  style: { fill: string; stroke: string; strokeWidth: number };
  scale: number;
}> = ({ segment, style, scale }) => {
  const { type, start, end, beltWidth, curveCenter, curveRadius, curveAngle } = segment;

  switch (type) {
    case 'straight':
      return (
        <StraightConveyorSegment
          start={start}
          end={end}
          beltWidth={beltWidth}
          style={style}
          scale={scale}
        />
      );

    case 'curved':
      if (curveCenter && curveRadius && curveAngle) {
        return (
          <CurvedConveyorSegment
            start={start}
            center={curveCenter}
            radius={curveRadius}
            angle={curveAngle}
            beltWidth={beltWidth}
            style={style}
            scale={scale}
          />
        );
      }
      break;

    case 'inclined':
      return (
        <InclinedConveyorSegment
          start={start}
          end={end}
          beltWidth={beltWidth}
          style={style}
          scale={scale}
        />
      );

    default:
      return null;
  }

  return null;
};

/**
 * Render straight conveyor segment with proper mathematical calculations
 */
const StraightConveyorSegment: React.FC<{
  start: { x: number; y: number };
  end: { x: number; y: number };
  beltWidth: number;
  style: { fill: string; stroke: string; strokeWidth: number };
  scale: number;
}> = ({ start, end, beltWidth, style, scale }) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Calculate perpendicular vectors for belt edges
  const perpX = -dy / length * beltWidth / 2;
  const perpY = dx / length * beltWidth / 2;

  const leftStart = { x: start.x + perpX * scale, y: start.y + perpY * scale };
  const rightStart = { x: start.x - perpX * scale, y: start.y - perpY * scale };
  const leftEnd = { x: end.x + perpX * scale, y: end.y + perpY * scale };
  const rightEnd = { x: end.x - perpX * scale, y: end.y - perpY * scale };

  // Create path data for straight segment
  const pathData = [
    `M ${leftStart.x} ${leftStart.y}`,
    `L ${leftEnd.x} ${leftEnd.y}`,
    `L ${rightEnd.x} ${rightEnd.y}`,
    `L ${rightStart.x} ${rightStart.y}`,
    'Z'
  ].join(' ');

  return (
    <Path
      data={pathData}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      opacity={0.8}
    />
  );
};

/**
 * Render curved conveyor segment using proper arc mathematics
 */
const CurvedConveyorSegment: React.FC<{
  start: { x: number; y: number };
  center: { x: number; y: number };
  radius: number;
  angle: number;
  beltWidth: number;
  style: { fill: string; stroke: string; strokeWidth: number };
  scale: number;
}> = ({ start, center, radius, angle, beltWidth, style, scale }) => {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = startAngle + (angle * Math.PI / 180);

  const innerRadius = radius - beltWidth / 2;
  const outerRadius = radius + beltWidth / 2;

  // Generate arc paths
  const outerArc = generateArcPath(center, outerRadius, startAngle, endAngle, scale);
  const innerArc = generateArcPath(center, innerRadius, endAngle, startAngle, scale); // Reverse for inner

  // Connect the arcs
  const startOuter = pointOnCircle(center, outerRadius, startAngle, scale);
  const startInner = pointOnCircle(center, innerRadius, startAngle, scale);
  const endOuter = pointOnCircle(center, outerRadius, endAngle, scale);
  const endInner = pointOnCircle(center, innerRadius, endAngle, scale);

  const pathData = [
    `M ${startOuter.x} ${startOuter.y}`,
    outerArc,
    `L ${endInner.x} ${endInner.y}`,
    innerArc,
    `L ${startOuter.x} ${startOuter.y}`,
    'Z'
  ].join(' ');

  return (
    <Path
      data={pathData}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      opacity={0.8}
    />
  );
};

/**
 * Render inclined conveyor segment
 */
const InclinedConveyorSegment: React.FC<{
  start: { x: number; y: number };
  end: { x: number; y: number };
  beltWidth: number;
  style: { fill: string; stroke: string; strokeWidth: number };
  scale: number;
}> = ({ start, end, beltWidth, style, scale }) => {
  return (
    <StraightConveyorSegment
      start={start}
      end={end}
      beltWidth={beltWidth}
      style={style}
      scale={scale}
    />
  );
};

/**
 * Render conveyor support legs
 */
const ConveyorSupportRenderer: React.FC<{
  support: ConveyorSupport;
  style: { fill: string; stroke: string; strokeWidth: number };
}> = ({ support, style }) => {
  return (
    <Line
      points={[
        support.position.x,
        support.position.y,
        support.position.x,
        support.position.y + support.height
      ]}
      stroke={style.stroke}
      strokeWidth={support.width}
    />
  );
};

/**
 * Render conveyor accessories
 */
const ConveyorAccessoryRenderer: React.FC<{
  accessory: ConveyorAccessory;
  style: { fill: string; stroke: string; strokeWidth: number };
}> = ({ accessory, style }) => {
  switch (accessory.type) {
    case 'motor':
      return (
        <Circle
          x={accessory.position.x}
          y={accessory.position.y}
          radius={15}
          fill="#666666"
          stroke={style.stroke}
          strokeWidth={2}
        />
      );
    case 'emergency_stop':
      return (
        <Circle
          x={accessory.position.x}
          y={accessory.position.y}
          radius={8}
          fill="#FF0000"
          stroke={style.stroke}
          strokeWidth={2}
        />
      );
    case 'sensor':
      return (
        <Rect
          x={accessory.position.x - 5}
          y={accessory.position.y - 5}
          width={10}
          height={10}
          fill="#722ed1"
          stroke={style.stroke}
          strokeWidth={1}
        />
      );
    default:
      return null;
  }
};

/**
 * Generate SVG arc path for curved segments
 */
function generateArcPath(
  center: { x: number; y: number },
  radius: number,
  startAngle: number,
  endAngle: number,
  scale: number
): string {
  const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;

  const startPoint = pointOnCircle(center, radius, startAngle, scale);
  const endPoint = pointOnCircle(center, radius, endAngle, scale);

  return `A ${radius * scale} ${radius * scale} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
}

/**
 * Calculate point on circle
 */
function pointOnCircle(
  center: { x: number; y: number },
  radius: number,
  angle: number,
  scale: number
): { x: number; y: number } {
  return {
    x: center.x + radius * Math.cos(angle) * scale,
    y: center.y + radius * Math.sin(angle) * scale
  };
}

export default ConveyorRenderer;


