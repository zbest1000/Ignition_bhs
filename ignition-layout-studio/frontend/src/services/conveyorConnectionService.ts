import React, { useState, useCallback, useMemo } from 'react';
import { Component, ConveyorProperties } from '../../types';
import { ConveyorEngine } from '../../services/conveyorEngine';

export interface ConveyorConnection {
  id: string;
  from: string;
  to: string;
  connectionType: 'direct' | 'merge' | 'divert' | 'transfer';
  angle: number;
  flowDirection: 'forward' | 'reverse' | 'bidirectional';
  priority: 'main' | 'secondary';
  distance: number;
}

export interface ConveyorFlow {
  id: string;
  conveyorId: string;
  direction: 'forward' | 'reverse' | 'bidirectional';
  speed: number;
  color: string;
  animated: boolean;
}

export class ConveyorConnectionService {
  private static instance: ConveyorConnectionService;
  private connections: Map<string, ConveyorConnection> = new Map();
  private flows: Map<string, ConveyorFlow> = new Map();

  static getInstance(): ConveyorConnectionService {
    if (!ConveyorConnectionService.instance) {
      ConveyorConnectionService.instance = new ConveyorConnectionService();
    }
    return ConveyorConnectionService.instance;
  }

  // Detect connections between conveyors
  detectConnections(conveyors: Component[]): ConveyorConnection[] {
    const newConnections: ConveyorConnection[] = [];
    const conveyorMap = new Map(conveyors.map(c => [c.id, c]));

    for (let i = 0; i < conveyors.length; i++) {
      for (let j = i + 1; j < conveyors.length; j++) {
        const conveyor1 = conveyors[i];
        const conveyor2 = conveyors[j];
        
        const connection = this.findConnection(conveyor1, conveyor2);
        if (connection) {
          newConnections.push(connection);
        }
      }
    }

    // Update connections map
    this.connections.clear();
    newConnections.forEach(conn => {
      this.connections.set(conn.id, conn);
    });

    return newConnections;
  }

  // Find connection between two conveyors
  private findConnection(conveyor1: Component, conveyor2: Component): ConveyorConnection | null {
    const end1 = this.getConveyorEndPoint(conveyor1);
    const start2 = this.getConveyorStartPoint(conveyor2);
    const start1 = this.getConveyorStartPoint(conveyor1);
    const end2 = this.getConveyorEndPoint(conveyor2);

    const maxGap = 50; // Maximum gap for connection (pixels)

    // Check end-to-start connection
    const distance1 = this.calculateDistance(end1, start2);
    if (distance1 <= maxGap) {
      return {
        id: `${conveyor1.id}-${conveyor2.id}`,
        from: conveyor1.id,
        to: conveyor2.id,
        connectionType: 'direct',
        angle: this.calculateAngle(end1, start2),
        flowDirection: 'forward',
        priority: 'main',
        distance: distance1,
      };
    }

    // Check start-to-end connection (reverse flow)
    const distance2 = this.calculateDistance(start1, end2);
    if (distance2 <= maxGap) {
      return {
        id: `${conveyor1.id}-${conveyor2.id}`,
        from: conveyor1.id,
        to: conveyor2.id,
        connectionType: 'direct',
        angle: this.calculateAngle(start1, end2),
        flowDirection: 'reverse',
        priority: 'main',
        distance: distance2,
      };
    }

    return null;
  }

  // Get conveyor start point
  private getConveyorStartPoint(conveyor: Component): { x: number; y: number } {
    const { x, y, width, height } = conveyor.geometry;
    const angle = conveyor.conveyorProperties?.angle || 0;
    
    // For angled conveyors, calculate actual start point
    if (angle !== 0) {
      const radians = (angle * Math.PI) / 180;
      return {
        x: x + Math.cos(radians) * 0,
        y: y + Math.sin(radians) * 0,
      };
    }
    
    return { x, y };
  }

  // Get conveyor end point
  private getConveyorEndPoint(conveyor: Component): { x: number; y: number } {
    const { x, y, width, height } = conveyor.geometry;
    const angle = conveyor.conveyorProperties?.angle || 0;
    const length = conveyor.conveyorProperties?.length || width;
    
    // For angled conveyors, calculate actual end point
    if (angle !== 0) {
      const radians = (angle * Math.PI) / 180;
      return {
        x: x + Math.cos(radians) * length,
        y: y + Math.sin(radians) * length,
      };
    }
    
    return { x: x + width, y };
  }

  // Calculate distance between two points
  private calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2)
    );
  }

  // Calculate angle between two points
  private calculateAngle(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
    return Math.atan2(point2.y - point1.y, point2.x - point1.x) * (180 / Math.PI);
  }

  // Auto-number conveyors based on flow
  autoNumberConveyors(conveyors: Component[], connections: ConveyorConnection[]): Component[] {
    const numberedConveyors = [...conveyors];
    const conveyorMap = new Map(conveyors.map(c => [c.id, c]));
    
    // Find main flow paths
    const mainFlows = this.findMainFlows(connections);
    
    let sequenceNumber = 1;
    const processed = new Set<string>();

    // Number conveyors along main flows
    mainFlows.forEach(flow => {
      flow.forEach(conveyorId => {
        if (!processed.has(conveyorId)) {
          const conveyor = conveyorMap.get(conveyorId);
          if (conveyor) {
            const updatedConveyor = {
              ...conveyor,
              name: `CV-${sequenceNumber.toString().padStart(3, '0')}`,
              updatedAt: new Date().toISOString(),
            };
            
            const index = numberedConveyors.findIndex(c => c.id === conveyorId);
            if (index !== -1) {
              numberedConveyors[index] = updatedConveyor;
            }
            
            processed.add(conveyorId);
            sequenceNumber++;
          }
        }
      });
    });

    // Number remaining conveyors
    numberedConveyors.forEach(conveyor => {
      if (!processed.has(conveyor.id)) {
        conveyor.name = `CV-${sequenceNumber.toString().padStart(3, '0')}`;
        conveyor.updatedAt = new Date().toISOString();
        sequenceNumber++;
      }
    });

    return numberedConveyors;
  }

  // Find main flow paths through the conveyor system
  private findMainFlows(connections: ConveyorConnection[]): string[][] {
    const flows: string[][] = [];
    const visited = new Set<string>();
    
    // Create adjacency map
    const adjacencyMap = new Map<string, string[]>();
    connections.forEach(conn => {
      if (!adjacencyMap.has(conn.from)) {
        adjacencyMap.set(conn.from, []);
      }
      adjacencyMap.get(conn.from)!.push(conn.to);
    });

    // Find longest paths
    const findLongestPath = (startId: string, path: string[] = []): string[] => {
      if (visited.has(startId)) return path;
      
      visited.add(startId);
      const newPath = [...path, startId];
      const neighbors = adjacencyMap.get(startId) || [];
      
      if (neighbors.length === 0) {
        return newPath;
      }
      
      let longestPath = newPath;
      neighbors.forEach(neighborId => {
        const extendedPath = findLongestPath(neighborId, newPath);
        if (extendedPath.length > longestPath.length) {
          longestPath = extendedPath;
        }
      });
      
      return longestPath;
    };

    // Find all starting points (conveyors with no incoming connections)
    const incomingConnections = new Set<string>();
    connections.forEach(conn => {
      incomingConnections.add(conn.to);
    });

    const startingPoints = Array.from(adjacencyMap.keys()).filter(
      id => !incomingConnections.has(id)
    );

    // Find flows from each starting point
    startingPoints.forEach(startId => {
      const flow = findLongestPath(startId);
      if (flow.length > 1) {
        flows.push(flow);
      }
    });

    return flows;
  }

  // Generate flow visualization data
  generateFlowVisualization(conveyors: Component[], connections: ConveyorConnection[]): ConveyorFlow[] {
    const flows: ConveyorFlow[] = [];
    
    conveyors.forEach(conveyor => {
      const connection = Array.from(connections.values()).find(
        conn => conn.from === conveyor.id || conn.to === conveyor.id
      );
      
      const flow: ConveyorFlow = {
        id: `flow-${conveyor.id}`,
        conveyorId: conveyor.id,
        direction: connection?.flowDirection || 'forward',
        speed: conveyor.conveyorProperties?.speed || 1.0,
        color: this.getFlowColor(conveyor.conveyorProperties?.speed || 1.0),
        animated: true,
      };
      
      flows.push(flow);
    });

    return flows;
  }

  // Get flow color based on speed
  private getFlowColor(speed: number): string {
    if (speed >= 2.0) return '#ff0000'; // Red for high speed
    if (speed >= 1.0) return '#ffaa00'; // Orange for medium speed
    if (speed >= 0.5) return '#00aa00'; // Green for low speed
    return '#666666'; // Gray for very slow
  }

  // Validate conveyor system
  validateConveyorSystem(conveyors: Component[], connections: ConveyorConnection[]): {
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for disconnected conveyors
    const connectedConveyors = new Set<string>();
    connections.forEach(conn => {
      connectedConveyors.add(conn.from);
      connectedConveyors.add(conn.to);
    });

    conveyors.forEach(conveyor => {
      if (!connectedConveyors.has(conveyor.id)) {
        warnings.push(`Conveyor ${conveyor.name} is not connected to any other conveyor`);
      }
    });

    // Check for flow direction conflicts
    const flowConflicts = this.detectFlowConflicts(connections);
    flowConflicts.forEach(conflict => {
      errors.push(`Flow direction conflict: ${conflict}`);
    });

    // Check for speed transitions
    const speedIssues = this.checkSpeedTransitions(conveyors, connections);
    speedIssues.forEach(issue => {
      warnings.push(`Speed transition issue: ${issue}`);
    });

    return { warnings, errors };
  }

  // Detect flow direction conflicts
  private detectFlowConflicts(connections: ConveyorConnection[]): string[] {
    const conflicts: string[] = [];
    
    // Group connections by conveyor pair
    const connectionGroups = new Map<string, ConveyorConnection[]>();
    connections.forEach(conn => {
      const key = [conn.from, conn.to].sort().join('-');
      if (!connectionGroups.has(key)) {
        connectionGroups.set(key, []);
      }
      connectionGroups.get(key)!.push(conn);
    });

    // Check for bidirectional conflicts
    connectionGroups.forEach(group => {
      const directions = group.map(conn => conn.flowDirection);
      if (directions.includes('forward') && directions.includes('reverse')) {
        conflicts.push(`Bidirectional flow detected between ${group[0].from} and ${group[0].to}`);
      }
    });

    return conflicts;
  }

  // Check for abrupt speed transitions
  private checkSpeedTransitions(conveyors: Component[], connections: ConveyorConnection[]): string[] {
    const issues: string[] = [];
    
    connections.forEach(conn => {
      const fromConveyor = conveyors.find(c => c.id === conn.from);
      const toConveyor = conveyors.find(c => c.id === conn.to);
      
      if (fromConveyor && toConveyor) {
        const fromSpeed = fromConveyor.conveyorProperties?.speed || 1.0;
        const toSpeed = toConveyor.conveyorProperties?.speed || 1.0;
        const speedRatio = Math.max(fromSpeed, toSpeed) / Math.min(fromSpeed, toSpeed);
        
        if (speedRatio > 3.0) {
          issues.push(`Abrupt speed change from ${fromSpeed}m/s to ${toSpeed}m/s`);
        }
      }
    });

    return issues;
  }

  // Get connections for a specific conveyor
  getConveyorConnections(conveyorId: string): ConveyorConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.from === conveyorId || conn.to === conveyorId
    );
  }

  // Get all connections
  getAllConnections(): ConveyorConnection[] {
    return Array.from(this.connections.values());
  }

  // Clear all connections
  clearConnections(): void {
    this.connections.clear();
    this.flows.clear();
  }
}

export default ConveyorConnectionService;
