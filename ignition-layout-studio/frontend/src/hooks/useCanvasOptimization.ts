import { useCallback, useEffect, useRef, useState } from 'react';
import { Component } from '../types';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasOptimizationOptions {
  enableCulling?: boolean;
  enableLOD?: boolean;
  cullingMargin?: number;
  lodThresholds?: {
    high: number;
    medium: number;
    low: number;
  };
}

export const useCanvasOptimization = (
  components: Component[],
  viewport: ViewportBounds,
  zoom: number,
  options: CanvasOptimizationOptions = {}
) => {
  const {
    enableCulling = true,
    enableLOD = true,
    cullingMargin = 100,
    lodThresholds = {
      high: 1.0,
      medium: 0.5,
      low: 0.25,
    },
  } = options;

  const [visibleComponents, setVisibleComponents] = useState<Component[]>([]);
  const [lodLevel, setLodLevel] = useState<'high' | 'medium' | 'low'>('high');
  const frameRef = useRef<number | undefined>(undefined);

  // Determine LOD level based on zoom
  useEffect(() => {
    if (!enableLOD) {
      setLodLevel('high');
      return;
    }

    if (zoom >= lodThresholds.high) {
      setLodLevel('high');
    } else if (zoom >= lodThresholds.medium) {
      setLodLevel('medium');
    } else {
      setLodLevel('low');
    }
  }, [zoom, enableLOD, lodThresholds]);

  // Frustum culling - only render components in viewport
  const cullComponents = useCallback(() => {
    if (!enableCulling) {
      setVisibleComponents(components);
      return;
    }

    const expandedViewport = {
      x: viewport.x - cullingMargin,
      y: viewport.y - cullingMargin,
      width: viewport.width + cullingMargin * 2,
      height: viewport.height + cullingMargin * 2,
    };

    const visible = components.filter((component) => {
      const { x, y, width, height } = component.geometry;
      
      // Check if component bounds intersect with viewport
      return !(
        x + width < expandedViewport.x ||
        x > expandedViewport.x + expandedViewport.width ||
        y + height < expandedViewport.y ||
        y > expandedViewport.y + expandedViewport.height
      );
    });

    setVisibleComponents(visible);
  }, [components, viewport, enableCulling, cullingMargin]);

  // Debounced culling for performance
  useEffect(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      cullComponents();
    });

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [cullComponents]);

  // Component simplification based on LOD
  const simplifyComponent = useCallback(
    (component: Component): Component => {
      if (!enableLOD || lodLevel === 'high') {
        return component;
      }

      // Simplify component based on LOD level
      const simplified = { ...component };

      if (lodLevel === 'medium') {
        // Medium detail - remove some visual elements
        simplified.style = {
          ...simplified.style,
          strokeWidth: Math.max(1, simplified.style.strokeWidth || 1),
        };
      } else if (lodLevel === 'low') {
        // Low detail - basic shapes only
        simplified.style = {
          ...simplified.style,
          strokeWidth: 1,
          opacity: 0.8,
        };
        // Could also simplify complex shapes to rectangles
        if (['curve_90', 'curve_45', 'curve_180'].includes(component.type)) {
          simplified.type = 'straight_conveyor';
        }
      }

      return simplified;
    },
    [enableLOD, lodLevel]
  );

  // Get optimized components for rendering
  const getOptimizedComponents = useCallback(() => {
    return visibleComponents.map(simplifyComponent);
  }, [visibleComponents, simplifyComponent]);

  // Performance metrics
  const [metrics, setMetrics] = useState({
    totalComponents: components.length,
    visibleComponents: 0,
    culledComponents: 0,
    lodLevel: 'high',
  });

  useEffect(() => {
    setMetrics({
      totalComponents: components.length,
      visibleComponents: visibleComponents.length,
      culledComponents: components.length - visibleComponents.length,
      lodLevel,
    });
  }, [components.length, visibleComponents.length, lodLevel]);

  return {
    optimizedComponents: getOptimizedComponents(),
    lodLevel,
    metrics,
    // Utility functions
    isComponentVisible: (componentId: string) =>
      visibleComponents.some((c) => c.id === componentId),
    forceUpdate: cullComponents,
  };
};

// Batch update hook for performance
export const useBatchComponentUpdates = () => {
  const pendingUpdates = useRef<Map<string, Partial<Component>>>(new Map());
  const updateTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const batchUpdate = useCallback(
    (componentId: string, updates: Partial<Component>, onUpdate: (id: string, updates: Partial<Component>) => void) => {
      // Accumulate updates
      const existing = pendingUpdates.current.get(componentId) || {};
      pendingUpdates.current.set(componentId, { ...existing, ...updates });

      // Clear existing timer
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
      }

      // Set new timer for batch execution
      updateTimer.current = setTimeout(() => {
        pendingUpdates.current.forEach((updates, id) => {
          onUpdate(id, updates);
        });
        pendingUpdates.current.clear();
      }, 16); // ~60fps
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimer.current) {
        clearTimeout(updateTimer.current);
      }
    };
  }, []);

  return batchUpdate;
};