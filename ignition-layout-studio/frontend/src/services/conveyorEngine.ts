import { Component, Point, ConveyorProperties, ConveyorSegment, ConveyorSupport, ConveyorAccessory, ConveyorDirection } from '../types';

/**
 * Advanced Conveyor Engine - Handles arbitrary angles, curves, and complex conveyor layouts
 */
export class ConveyorEngine {

  /**
   * Generate conveyor rendering data with proper mathematical calculations
   */
  static generateConveyorRendering(
    geometry: { x: number; y: number; width: number; height: number; rotation: number },
    properties: ConveyorProperties = {},
    style: { fill: string; stroke: string; strokeWidth: number }
  ): { segments: ConveyorSegment[]; supports: ConveyorSupport[]; accessories: ConveyorAccessory[] } {

    const segments: ConveyorSegment[] = [];
    const supports: ConveyorSupport[] = [];
    const accessories: ConveyorAccessory[] = [];

    // Extract conveyor properties with defaults
    const {
      length = geometry.width,
      beltWidth = geometry.height * 0.8,
      angle = geometry.rotation,
      curveRadius = 0,
      curveAngle = 0,
      direction = 'forward',
      beltType = 'flat',
      supportType = 'floor',
      legHeight = 50,
      zones = []
    } = properties;

    // If no zones defined, check if it's a curve or straight segment
    if (zones.length === 0) {
      if (curveRadius && curveAngle && curveAngle > 0) {
        // Create a curved segment
        const segment: ConveyorSegment = {
          type: 'curved',
          start: { x: geometry.x, y: geometry.y },
          end: this.calculateCurveEndPoint(
            { x: geometry.x, y: geometry.y },
            this.calculateCurveCenter({ x: geometry.x, y: geometry.y }, angle, curveRadius),
            curveAngle,
            curveRadius
          ),
          angle: angle,
          length: (curveAngle * Math.PI * curveRadius) / 180, // Arc length
          width: geometry.width,
          height: geometry.height,
          beltWidth: beltWidth,
          curveCenter: this.calculateCurveCenter({ x: geometry.x, y: geometry.y }, angle, curveRadius),
          curveRadius: curveRadius,
          curveAngle: curveAngle,
          supports: Math.ceil(((curveAngle * Math.PI * curveRadius) / 180) / 200)
        };
        segments.push(segment);
      } else {
        // Create a straight segment
        const segment = this.createStraightSegment(geometry, properties, style);
        segments.push(segment);
      }
    } else {
      // Create segments from zones
      zones.forEach((zone, index) => {
        const startPos = this.getZoneStartPosition(zone, zones, index);
        const segment = this.createSegmentFromZone(zone, startPos, properties);
        segments.push(segment);
      });
    }

    // Generate supports based on conveyor type and length
    supports.push(...this.generateSupports(geometry, properties, segments));

    // Generate accessories (motors, sensors, etc.)
    accessories.push(...this.generateAccessories(geometry, properties, segments));

    return { segments, supports, accessories };
  }

  /**
   * Create a straight conveyor segment with proper angle handling
   */
  private static createStraightSegment(
    geometry: { x: number; y: number; width: number; height: number; rotation: number },
    properties: ConveyorProperties,
    style: { fill: string; stroke: string; strokeWidth: number }
  ): ConveyorSegment {
    const { length = geometry.width, beltWidth = geometry.height * 0.8, angle = geometry.rotation } = properties;

    // Convert angle to radians for calculations
    const angleRad = (angle * Math.PI) / 180;

    // Calculate start and end points considering rotation
    const start: Point = { x: geometry.x, y: geometry.y };
    const end: Point = {
      x: geometry.x + length * Math.cos(angleRad),
      y: geometry.y + length * Math.sin(angleRad)
    };

    // Calculate number of supports (every 2-3 meters)
    const supportSpacing = Math.max(100, length / 4);
    const numSupports = Math.ceil(length / supportSpacing);

    return {
      type: 'straight',
      start,
      end,
      angle,
      length,
      width: geometry.width,
      height: geometry.height,
      beltWidth,
      supports: numSupports
    };
  }

  /**
   * Create segment from zone definition
   */
  private static createSegmentFromZone(zone: any, startPosition: Point, properties: ConveyorProperties): ConveyorSegment {
    const { type, length, angle = 0, elevation = 0 } = zone;
    const { beltWidth = 30, curveRadius = 100 } = properties;

    let endPosition: Point;

    switch (type) {
      case 'straight':
        endPosition = {
          x: startPosition.x + length * Math.cos((angle * Math.PI) / 180),
          y: startPosition.y + length * Math.sin((angle * Math.PI) / 180) + elevation
        };
        break;

      case 'curve':
        const curveCenter = this.calculateCurveCenter(startPosition, angle, curveRadius);
        endPosition = this.calculateCurveEndPoint(startPosition, curveCenter, angle, curveRadius);
        break;

      case 'incline':
      case 'decline':
        endPosition = {
          x: startPosition.x + length * Math.cos((angle * Math.PI) / 180),
          y: startPosition.y + length * Math.sin((angle * Math.PI) / 180) + elevation
        };
        break;

      default:
        endPosition = startPosition;
    }

    return {
      type: type as any,
      start: startPosition,
      end: endPosition,
      angle,
      length,
      width: beltWidth,
      height: 30,
      beltWidth,
      curveCenter: type === 'curve' ? this.calculateCurveCenter(startPosition, angle, curveRadius) : undefined,
      curveRadius: type === 'curve' ? curveRadius : undefined,
      curveAngle: type === 'curve' ? angle : undefined,
      elevation,
      supports: Math.ceil(length / 200) // Support every 200 units
    };
  }

  /**
   * Calculate curve center point for proper arc generation
   */
  private static calculateCurveCenter(startPoint: Point, angle: number, radius: number): Point {
    const angleRad = (angle * Math.PI) / 180;
    return {
      x: startPoint.x + radius * Math.cos(angleRad + Math.PI / 2),
      y: startPoint.y + radius * Math.sin(angleRad + Math.PI / 2)
    };
  }

  /**
   * Calculate curve end point using proper trigonometry
   */
  private static calculateCurveEndPoint(startPoint: Point, center: Point, angle: number, radius: number): Point {
    const angleRad = (angle * Math.PI) / 180;
    return {
      x: center.x + radius * Math.cos(angleRad),
      y: center.y + radius * Math.sin(angleRad)
    };
  }

  /**
   * Generate support legs for conveyor
   */
  private static generateSupports(
    geometry: { x: number; y: number; width: number; height: number },
    properties: ConveyorProperties,
    segments: ConveyorSegment[]
  ): ConveyorSupport[] {
    const supports: ConveyorSupport[] = [];
    const { supportType = 'floor', legHeight = 50 } = properties;

    segments.forEach(segment => {
      const supportSpacing = Math.max(100, segment.length / (segment.supports + 1));

      for (let i = 1; i <= segment.supports; i++) {
        const position = this.interpolatePoint(segment.start, segment.end, i / (segment.supports + 1));

        supports.push({
          position,
          type: supportType,
          height: legHeight,
          width: 10
        });
      }
    });

    return supports;
  }

  /**
   * Generate conveyor accessories (motors, sensors, etc.)
   */
  private static generateAccessories(
    geometry: { x: number; y: number; width: number; height: number },
    properties: ConveyorProperties,
    segments: ConveyorSegment[]
  ): ConveyorAccessory[] {
    const accessories: ConveyorAccessory[] = [];
    const { direction = 'forward' } = properties;

    // Add drive motor at start/end based on direction
    const motorSegment = segments[0];
    if (motorSegment) {
      const motorPosition = direction === 'forward' ? motorSegment.start : motorSegment.end;

      accessories.push({
        type: 'motor',
        position: motorPosition,
        orientation: motorSegment.angle
      });
    }

    // Add emergency stop buttons at intervals
    segments.forEach((segment, index) => {
      if (index % 3 === 0) { // Every 3rd segment
        accessories.push({
          type: 'emergency_stop',
          position: this.interpolatePoint(segment.start, segment.end, 0.5),
          orientation: segment.angle
        });
      }
    });

    return accessories;
  }

  /**
   * Interpolate point between start and end
   */
  private static interpolatePoint(start: Point, end: Point, fraction: number): Point {
    return {
      x: start.x + (end.x - start.x) * fraction,
      y: start.y + (end.y - start.y) * fraction
    };
  }

  /**
   * Get starting position for a zone
   */
  private static getZoneStartPosition(zone: any, zones: any[], currentIndex: number): Point {
    if (currentIndex === 0) {
      return { x: 0, y: 0 }; // Start at origin
    }

    const previousZone = zones[currentIndex - 1];
    const previousEnd = this.getZoneEndPosition(previousZone, zones, currentIndex - 1);

    return previousEnd;
  }

  /**
   * Get end position for a zone
   */
  private static getZoneEndPosition(zone: any, zones: any[], currentIndex: number): Point {
    const { type, startPosition, length, angle = 0, elevation = 0 } = zone;

    let endPosition: Point = { x: 0, y: 0 };

    switch (type) {
      case 'straight':
        endPosition = {
          x: startPosition + length * Math.cos((angle * Math.PI) / 180),
          y: startPosition + length * Math.sin((angle * Math.PI) / 180) + elevation
        };
        break;

      case 'curve':
        // Simplified curve calculation
        endPosition = {
          x: startPosition + length,
          y: startPosition + elevation
        };
        break;

      default:
        endPosition = {
          x: startPosition + length,
          y: startPosition + elevation
        };
    }

    return endPosition;
  }

  /**
   * Parse complex conveyor description with advanced pattern matching
   */
  static parseConveyorDescription(description: string): ConveyorProperties {
    const lowerDesc = description.toLowerCase();
    const properties: ConveyorProperties = {};

    // Extract basic dimensions
    const dimensionMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters|ft|feet|foot)\s*(?:long|length)?/i);
    if (dimensionMatch) {
      properties.length = parseFloat(dimensionMatch[1]) * 100; // Convert to pixels (assuming 100px = 1m)
    }

    // Extract width
    const widthMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters|cm|centimeter|centimeters|in|inch|inches)\s*(?:wide|width)/i);
    if (widthMatch) {
      properties.beltWidth = parseFloat(widthMatch[1]) * 100;
    }

    // Extract angle
    const angleMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:degree|deg|°)\s*(?:angle|angled|inclined|slanted)/i);
    if (angleMatch) {
      properties.angle = parseFloat(angleMatch[1]);
    } else if (lowerDesc.includes('45 degree') || lowerDesc.includes('45°')) {
      properties.angle = 45;
    } else if (lowerDesc.includes('30 degree') || lowerDesc.includes('30°')) {
      properties.angle = 30;
    } else if (lowerDesc.includes('60 degree') || lowerDesc.includes('60°')) {
      properties.angle = 60;
    }

    // Extract curve information
    if (lowerDesc.includes('curve') || lowerDesc.includes('curved')) {
      const curveRadiusMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:m|meter|meters|ft|feet|foot)\s*(?:radius|curve)/i);
      if (curveRadiusMatch) {
        properties.curveRadius = parseFloat(curveRadiusMatch[1]) * 100;
      }

      if (lowerDesc.includes('90 degree curve') || lowerDesc.includes('90° curve')) {
        properties.curveAngle = 90;
      } else if (lowerDesc.includes('45 degree curve') || lowerDesc.includes('45° curve')) {
        properties.curveAngle = 45;
      } else if (lowerDesc.includes('180 degree curve') || lowerDesc.includes('180° curve')) {
        properties.curveAngle = 180;
      }
    }

    // Extract belt type
    if (lowerDesc.includes('roller')) {
      properties.beltType = 'roller';
    } else if (lowerDesc.includes('chain')) {
      properties.beltType = 'chain';
    } else if (lowerDesc.includes('troughed') || lowerDesc.includes('trough')) {
      properties.beltType = 'troughed';
    } else {
      properties.beltType = 'flat';
    }

    // Extract direction
    if (lowerDesc.includes('bidirectional') || lowerDesc.includes('reversible')) {
      properties.direction = 'bidirectional';
    } else if (lowerDesc.includes('reverse')) {
      properties.direction = 'reverse';
    } else {
      properties.direction = 'forward';
    }

    // Extract support type
    if (lowerDesc.includes('ceiling') || lowerDesc.includes('overhead')) {
      properties.supportType = 'ceiling';
    } else if (lowerDesc.includes('wall')) {
      properties.supportType = 'wall';
    } else {
      properties.supportType = 'floor';
    }

    return properties;
  }

  /**
   * Generate SVG path for conveyor segments with proper mathematical calculations
   */
  static generateConveyorSVG(
    segments: ConveyorSegment[],
    style: { fill: string; stroke: string; strokeWidth: number },
    scale: number = 1
  ): string {
    const paths: string[] = [];

    segments.forEach(segment => {
      const path = this.generateSegmentSVG(segment, style, scale);
      if (path) paths.push(path);
    });

    return paths.join(' ');
  }

  /**
   * Generate SVG path for individual segment
   */
  private static generateSegmentSVG(
    segment: ConveyorSegment,
    style: { fill: string; stroke: string; strokeWidth: number },
    scale: number
  ): string {
    const { type, start, end, beltWidth, curveCenter, curveRadius, curveAngle } = segment;

    switch (type) {
      case 'straight':
        return this.generateStraightSegmentSVG(start, end, beltWidth, style, scale);

      case 'curved':
        if (curveCenter && curveRadius && curveAngle) {
          return this.generateCurvedSegmentSVG(start, curveCenter, curveRadius, curveAngle, beltWidth, style, scale);
        }
        break;

      case 'inclined':
        return this.generateStraightSegmentSVG(start, end, beltWidth, style, scale);

      default:
        return '';
    }

    return '';
  }

  /**
   * Generate SVG path for straight segment
   */
  private static generateStraightSegmentSVG(
    start: Point,
    end: Point,
    beltWidth: number,
    style: { fill: string; stroke: string; strokeWidth: number },
    scale: number
  ): string {
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

    // Create path: start -> left end -> right end -> right start -> close
    return [
      `M ${leftStart.x} ${leftStart.y}`,
      `L ${leftEnd.x} ${leftEnd.y}`,
      `L ${rightEnd.x} ${rightEnd.y}`,
      `L ${rightStart.x} ${rightStart.y}`,
      'Z'
    ].join(' ');
  }

  /**
   * Generate SVG path for curved segment using proper arc mathematics
   */
  private static generateCurvedSegmentSVG(
    start: Point,
    center: Point,
    radius: number,
    angle: number,
    beltWidth: number,
    style: { fill: string; stroke: string; strokeWidth: number },
    scale: number
  ): string {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = startAngle + (angle * Math.PI / 180);

    const innerRadius = radius - beltWidth / 2;
    const outerRadius = radius + beltWidth / 2;

    // Generate arc paths
    const outerArc = this.generateArcPath(center, outerRadius, startAngle, endAngle, scale);
    const innerArc = this.generateArcPath(center, innerRadius, endAngle, startAngle, scale); // Reverse for inner

    // Connect the arcs
    const startOuter = this.pointOnCircle(center, outerRadius, startAngle, scale);
    const startInner = this.pointOnCircle(center, innerRadius, startAngle, scale);
    const endOuter = this.pointOnCircle(center, outerRadius, endAngle, scale);
    const endInner = this.pointOnCircle(center, innerRadius, endAngle, scale);

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      outerArc,
      `L ${endInner.x} ${endInner.y}`,
      innerArc,
      `L ${startOuter.x} ${startOuter.y}`,
      'Z'
    ].join(' ');
  }

  /**
   * Generate SVG arc path
   */
  private static generateArcPath(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    scale: number
  ): string {
    const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;

    const startPoint = this.pointOnCircle(center, radius, startAngle, scale);
    const endPoint = this.pointOnCircle(center, radius, endAngle, scale);

    return `A ${radius * scale} ${radius * scale} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
  }

  /**
   * Calculate point on circle
   */
  private static pointOnCircle(center: Point, radius: number, angle: number, scale: number): Point {
    return {
      x: center.x + radius * Math.cos(angle) * scale,
      y: center.y + radius * Math.sin(angle) * scale
    };
  }

  /**
   * Enhanced component creation with advanced conveyor parsing
   */
  static createConveyorComponent(
    description: string,
    position: { x: number; y: number } = { x: 0, y: 0 }
  ): Partial<Component> {
    const properties = this.parseConveyorDescription(description);
    const { length = 200, beltWidth = 30, angle = 0, curveAngle, curveRadius } = properties;

    // Determine component type based on properties
    let componentType: string = 'straight_conveyor';
    if (curveAngle && curveAngle > 0) {
      componentType = `curve_${curveAngle}_conveyor`;
    }

    // Calculate geometry based on properties
    const geometry = {
      x: position.x,
      y: position.y,
      width: length,
      height: beltWidth,
      rotation: angle,
      scale: 1
    };

    // Generate conveyor rendering data
    const rendering = this.generateConveyorRendering(geometry, properties, {
      fill: '#52c41a',
      stroke: '#000000',
      strokeWidth: 2
    });

    return {
      type: componentType as any,
      label: this.generateConveyorLabel(description),
      equipmentId: `CONV_${Date.now()}`,
      geometry,
      style: {
        fill: '#52c41a',
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
        visible: true,
        locked: false,
      },
      properties: {
        description,
        createdBy: 'advanced-conveyor-engine',
        ...properties
      },
      conveyorProperties: properties,
      conveyorRendering: rendering,
      metadata: {
        layer: 'conveyors',
        source: 'text-description',
        originalDescription: description,
      },
    };
  }

  /**
   * Generate appropriate label for conveyor
   */
  private static generateConveyorLabel(description: string): string {
    const lowerDesc = description.toLowerCase();

    if (lowerDesc.includes('infeed') || lowerDesc.includes('input')) {
      return 'Infeed Conveyor';
    } else if (lowerDesc.includes('outfeed') || lowerDesc.includes('output')) {
      return 'Outfeed Conveyor';
    } else if (lowerDesc.includes('transfer')) {
      return 'Transfer Conveyor';
    } else if (lowerDesc.includes('accumulation')) {
      return 'Accumulation Conveyor';
    } else if (lowerDesc.includes('sortation')) {
      return 'Sortation Conveyor';
    } else {
      return 'Conveyor';
    }
  }
}

export default ConveyorEngine;
