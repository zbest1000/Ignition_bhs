import React from 'react';
import { Group, Rect, Path, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import { Component, Point } from '../../types';
import ConveyorEngine from '../../services/conveyorEngine';
import ConveyorRenderer from './ConveyorRenderer';

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
      case 'accumulation': {
        // Use enhanced conveyor engine for rendering
        const conveyorRendering = component.conveyorRendering || ConveyorEngine.generateConveyorRendering(
          geometry,
          component.conveyorProperties || {},
          style
        );

        return (
          <ConveyorRenderer
            segments={conveyorRendering.segments}
            supports={conveyorRendering.supports}
            accessories={conveyorRendering.accessories}
            style={style}
            x={0}
            y={0}
          />
        );
      }

      case 'curve_90_conveyor':
      case 'curve_90': {
        const beltLines = buildRadialLinesTR(90, geometry.width, geometry.height, 12, 15); // start after 15°
        return (
          <>
            <Path
              data={buildDonutPathTR_Offset(90, geometry.width, geometry.height)}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {beltLines.map((pts, idx) => (
              <Line key={idx} points={pts} stroke={style.stroke} strokeWidth={1} />
            ))}
          </>
        );
      }

      case 'curve_45_conveyor':
      case 'curve_45': {
        const beltLines = buildRadialLinesTR(45, geometry.width, geometry.height, 12, 10);
        return (
          <>
            <Path
              data={buildDonutPathTR(45, geometry.width, geometry.height)}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {beltLines.map((pts, idx) => (
              <Line key={idx} points={pts} stroke={style.stroke} strokeWidth={1} />
            ))}
          </>
        );
      }

      case 'curve_180_conveyor':
      case 'curve_180': {
        return (
          <Path
            data={buildDonutPathHalf(geometry.width, geometry.height)}
            fill={style.fill}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            opacity={style.opacity}
          />
        );
      }

      case 'angled_conveyor':
        return (
          <>
            {/* Angled conveyor body */}
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
              cornerRadius={2}
            />
            {/* Support legs for inclined conveyor */}
            <Line
              points={[10, geometry.height, 10, geometry.height + 15]}
              stroke={style.stroke}
              strokeWidth={3}
            />
            <Line
              points={[geometry.width - 10, geometry.height, geometry.width - 10, geometry.height + 25]}
              stroke={style.stroke}
              strokeWidth={3}
            />
          </>
        );

      case 'merge_conveyor':
      case 'merge':
        return (
          <>
            {/* Main horizontal line */}
            <Line
              points={[0, geometry.height / 2, geometry.width, geometry.height / 2]}
              stroke={style.stroke}
              strokeWidth={geometry.height * 0.6}
              lineCap="round"
            />
            {/* Merging line from top */}
            <Line
              points={[geometry.width * 0.3, 0, geometry.width * 0.7, geometry.height / 2]}
              stroke={style.stroke}
              strokeWidth={geometry.height * 0.4}
              lineCap="round"
            />
            {/* Junction indicator */}
            <Circle
              x={geometry.width * 0.7}
              y={geometry.height / 2}
              radius={8}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={2}
            />
          </>
        );

      case 'divert_conveyor':
      case 'diverter':
      case 'sorter':
        return (
          <>
            {/* Main horizontal line */}
            <Line
              points={[0, geometry.height / 2, geometry.width, geometry.height / 2]}
              stroke={style.stroke}
              strokeWidth={geometry.height * 0.6}
              lineCap="round"
            />
            {/* Diverting line to bottom */}
            <Line
              points={[geometry.width * 0.3, geometry.height / 2, geometry.width * 0.7, geometry.height]}
              stroke={style.stroke}
              strokeWidth={geometry.height * 0.4}
              lineCap="round"
            />
            {/* Diverter blade */}
            <Line
              points={[geometry.width * 0.25, geometry.height * 0.3, geometry.width * 0.45, geometry.height * 0.7]}
              stroke="#FF6B35"
              strokeWidth={4}
              lineCap="round"
            />
          </>
        );

      case 'sortation_conveyor':
      case 'sortation':
        return (
          <>
            {/* Main conveyor body */}
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
              cornerRadius={2}
            />
            {/* Sortation tilting mechanism */}
            <Rect
              x={geometry.width * 0.2}
              y={geometry.height * 0.1}
              width={geometry.width * 0.6}
              height={geometry.height * 0.2}
              fill="#FF6B35"
              stroke={style.stroke}
              strokeWidth={1}
              cornerRadius={2}
            />
            <Rect
              x={geometry.width * 0.2}
              y={geometry.height * 0.7}
              width={geometry.width * 0.6}
              height={geometry.height * 0.2}
              fill="#FF6B35"
              stroke={style.stroke}
              strokeWidth={1}
              cornerRadius={2}
            />
          </>
        );

      case 'valve':
      case 'pneumatic_valve':
        return (
          <>
            {/* Valve body */}
            <Path
              data={generateHexagonPath(geometry.width, geometry.height)}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {/* Valve stem */}
            <Rect
              x={geometry.width / 2 - 2}
              y={-10}
              width={4}
              height={15}
              fill={style.stroke}
            />
            {/* Pneumatic connections */}
            <Circle
              x={geometry.width / 4}
              y={geometry.height / 2}
              radius={3}
              fill="none"
              stroke={style.stroke}
              strokeWidth={2}
            />
            <Circle
              x={(geometry.width * 3) / 4}
              y={geometry.height / 2}
              radius={3}
              fill="none"
              stroke={style.stroke}
              strokeWidth={2}
            />
          </>
        );

      case 'tank':
      case 'storage_tank':
        return (
          <>
            {/* Tank body */}
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
              cornerRadius={8}
            />
            {/* Liquid level indicator */}
            <Rect
              x={5}
              y={geometry.height * 0.4}
              width={geometry.width - 10}
              height={geometry.height * 0.55}
              fill="#4A90E2"
              opacity={0.7}
              cornerRadius={4}
            />
            {/* Tank inlet/outlet */}
            <Rect
              x={geometry.width - 8}
              y={geometry.height * 0.2}
              width={12}
              height={8}
              fill={style.stroke}
            />
          </>
        );

      case 'motor':
      case 'drive_motor':
        return (
          <>
            {/* Motor body */}
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={Math.min(geometry.width, geometry.height) / 2 - 2}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
            />
            {/* Motor shaft */}
            <Rect
              x={geometry.width - 5}
              y={geometry.height / 2 - 3}
              width={15}
              height={6}
              fill={style.stroke}
            />
            {/* Motor terminals */}
            <Rect
              x={geometry.width / 2 - 8}
              y={2}
              width={16}
              height={6}
              fill={style.stroke}
              cornerRadius={2}
            />
            {/* Motor label */}
            <Text
              x={geometry.width / 2}
              y={geometry.height / 2}
              text='M'
              fontSize={16}
              fontStyle='bold'
              fill='white'
              align='center'
              verticalAlign='middle'
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
            {/* Sensor body */}
            <Rect
              width={geometry.width}
              height={geometry.height}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              opacity={style.opacity}
              cornerRadius={4}
            />
            {/* Sensor lens/eye */}
            <Circle
              x={geometry.width / 2}
              y={geometry.height / 2}
              radius={Math.min(geometry.width, geometry.height) / 4}
              fill="#FF4444"
              stroke={style.stroke}
            />
            {/* Light beam for photo eye */}
            {(type === 'photo_eye' || type === 'sensor') && (
              <Line
                points={[
                  geometry.width,
                  geometry.height / 2,
                  geometry.width + 30,
                  geometry.height / 2,
                ]}
                stroke="#FF4444"
                strokeWidth={2}
                dash={[3, 3]}
                opacity={0.8}
              />
            )}
            {/* Mounting bracket */}
            <Rect
              x={geometry.width / 2 - 3}
              y={geometry.height - 2}
              width={6}
              height={4}
              fill="#666666"
            />
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
              fill='white'
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

  // ----- Helpers for top-right oriented 90° (and generic) curves -----
  /**
   * Build a donut-segment path that lives in the top-right quadrant of the
   * bounding square. The flat faces are the top and right edges so that a
   * geometry.rotation of 0° already matches CAD convention.
   *
   * @param angleDeg   sweep angle (e.g. 90, 45, 180)
   * @param width      bounding box width (== outer diameter)
   * @param thickness  belt thickness (outerR − innerR)
   */
  const buildDonutPathTR = (angleDeg: number, width: number, thickness: number): string => {
    const R = width / 2;
    const r = Math.max(R - thickness, 1);

    // Helper for formatting numbers without rounding loss
    const f = (n: number) => n.toString();

    // Points
    const outerStart = { x: R, y: 0 };                // top centre
    const outerEnd   = { x: R + R, y: R };            // right centre
    const innerStart = { x: R, y: R - r };            // inner-top
    const innerEnd   = { x: R + r, y: R };            // inner-right

    const largeArc = angleDeg > 180 ? 1 : 0;

    return [
      `M ${f(innerStart.x)} ${f(innerStart.y)}`,      // flat top face (inner → outer)
      `L ${f(outerStart.x)} ${f(outerStart.y)}`,
      // CW outer arc
      `A ${f(R)} ${f(R)} 0 ${largeArc} 1 ${f(outerEnd.x)} ${f(outerEnd.y)}`,
      `L ${f(innerEnd.x)} ${f(innerEnd.y)}`,           // flat right face (outer → inner)
      // CCW inner arc back to start
      `A ${f(r)} ${f(r)} 0 ${largeArc} 0 ${f(innerStart.x)} ${f(innerStart.y)}`,
      'Z',
    ].join(' ');
  };

  /**
   * Build a quarter-circle belt where the inner arc is a concentric circle
   * offset by the belt thickness so that the top and right faces are flat and
   * parallel (constant real thickness). Centre of the inner circle is shifted
   * by +t in +x and +y relative to the outer circle.
   */
  const buildDonutPathTR_Offset = (
    angleDeg: number,
    width: number,
    thickness: number
  ): string => {
    if (angleDeg !== 90) {
      // Fallback to old path for non-right angles
      return buildDonutPathTR(angleDeg, width, thickness);
    }

    const R = width / 2; // outer radius
    const t = thickness;
    const r = Math.max(R - t, 1); // inner radius

    // Centres
    const co = { x: R, y: R };         // outer circle centre (top-left of square is 0,0)
    const ci = { x: R - t, y: R - t }; // inner circle centre (shifted inwards)

    // Key points (top then right)
    const outerTop = { x: co.x, y: co.y - R };
    const outerRight = { x: co.x + R, y: co.y };
    const innerTop = { x: ci.x, y: ci.y - r };
    const innerRight = { x: ci.x + r, y: ci.y };

    const f = (n: number) => n.toString();

    return [
      `M ${f(innerTop.x)} ${f(innerTop.y)}`,       // flat top face (inner → outer)
      `L ${f(outerTop.x)} ${f(outerTop.y)}`,
      // outer CW 90° arc
      `A ${f(R)} ${f(R)} 0 0 1 ${f(outerRight.x)} ${f(outerRight.y)}`,
      `L ${f(innerRight.x)} ${f(innerRight.y)}`,    // flat right face (outer → inner)
      // inner CCW 90° arc back to start
      `A ${f(r)} ${f(r)} 0 0 0 ${f(innerTop.x)} ${f(innerTop.y)}`,
      'Z',
    ].join(' ');
  };

  /**
   * Generate radial roller lines for top-right curves. Each line runs between
   * the inner and outer radii along a given angle.
   */
  const buildRadialLinesTR = (
    angleDeg: number,
    width: number,
    thickness: number,
    desiredSpacing = 12,
    minFirstAngle = 0 // now handled automatically – param kept for backward compatibility
  ): number[][] => {
    // Geometric radii
    const R = width / 2; // outer radius
    const r = Math.max(R - thickness, 1); // inner radius (sanity clamp)

    // Use the centre-line radius to achieve perceptually even roller spacing
    const rc = (R + r) / 2;
    const totalArcRad = (angleDeg * Math.PI) / 180;
    const totalArcLen = rc * totalArcRad;

    // How many rollers fit? Ensure at least 1 and spread them out nicely.
    const count = Math.max(1, Math.floor(totalArcLen / desiredSpacing));

    // Central angle between roller lines (radians)
    const stepRad = totalArcRad / (count + 1);

    const pts: number[][] = [];
    for (let i = 1; i <= count; i++) {
      const rad = stepRad * i;
      // Skip any line that would fall inside the user-specified exclusion zone (deg → rad)
      if (rad < (minFirstAngle * Math.PI) / 180) continue;

      // Polar → Cartesian for both radii (top-right quadrant orientation)
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      const xOuter = R + R * sin;
      const yOuter = R - R * cos;
      const xInner = R + r * sin;
      const yInner = R - r * cos;
      pts.push([xOuter, yOuter, xInner, yInner]);
    }
    return pts;
  };

  /**
   * Build a left-hand (concave-right) half-circle (180°) belt. Flat faces are
   * horizontal (top & bottom). Component rotation can orient as needed.
   */
  const buildDonutPathHalf = (width: number, thickness: number): string => {
    const R = width / 2;
    const r = Math.max(R - thickness, 1);

    const f = (n: number) => n.toString();

    const outerTop = { x: R, y: 0 };
    const outerBottom = { x: R, y: 2 * R };
    const innerTop = { x: R, y: R - r };
    const innerBottom = { x: R, y: R + r };

    // 180° sweep so large-arc flag can be 0 or 1; choose 1 for robustness
    return [
      `M ${f(innerTop.x)} ${f(innerTop.y)}`,
      `L ${f(outerTop.x)} ${f(outerTop.y)}`,
      `A ${f(R)} ${f(R)} 0 1 1 ${f(outerBottom.x)} ${f(outerBottom.y)}`,
      `L ${f(innerBottom.x)} ${f(innerBottom.y)}`,
      `A ${f(r)} ${f(r)} 0 1 0 ${f(innerTop.x)} ${f(innerTop.y)}`,
      'Z',
    ].join(' ');
  };

  // Helper to build a regular hexagon path (still needed by valve render)
  const generateHexagonPath = (width: number, height: number): string => {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2;
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = ((Math.PI / 3) * i) - Math.PI / 2; // start at top vertex
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(' ') + ' Z';
  };

  // (ellipse / rounded-rect helpers removed – not used)

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
      onMouseEnter={e => {
        const container = e.target.getStage()?.container();
        if (container) {
          container.style.cursor = draggable ? 'move' : 'pointer';
        }
      }}
      onMouseLeave={e => {
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
        fill='transparent'
        listening={false}
      />

      {/* Label */}
      {showLabel && component.label && (
        <Text
          x={0}
          y={component.geometry.height + 5}
          text={component.label}
          fontSize={12}
          fill='#333333'
          listening={false}
        />
      )}
    </Group>
  );
};

export default ComponentShape;
