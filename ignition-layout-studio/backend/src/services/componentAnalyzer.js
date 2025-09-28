const ComponentGroupingService = require('./componentGroupingService');

class ComponentAnalyzer {
  constructor() {
    this.groupingService = new ComponentGroupingService();
    this.analysisMetrics = {
      spatialClustering: true,
      typeDistribution: true,
      propertyCorrelation: true,
      performanceOptimization: true,
      templateOpportunities: true
    };
  }

  // Perform comprehensive component analysis
  async analyzeProject(project) {
    const components = project.components;
    const analysis = {
      overview: this.generateOverview(components),
      spatial: this.analyzeSpatialDistribution(components),
      types: this.analyzeTypeDistribution(components),
      patterns: this.findPatterns(components),
      optimization: this.analyzeOptimizationOpportunities(components),
      templates: this.analyzeTemplateOpportunities(components),
      grouping: this.groupingService.analyzeComponentsForGrouping(components),
      recommendations: []
    };

    // Generate recommendations based on analysis
    analysis.recommendations = this.generateRecommendations(analysis);

    return analysis;
  }

  // Generate project overview
  generateOverview(components) {
    const overview = {
      totalComponents: components.length,
      averageSize: { width: 0, height: 0 },
      bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
      density: 0,
      complexity: 'simple'
    };

    if (components.length === 0) return overview;

    // Calculate averages and bounds
    let totalWidth = 0, totalHeight = 0;
    components.forEach(comp => {
      totalWidth += comp.geometry.width;
      totalHeight += comp.geometry.height;
      overview.bounds.minX = Math.min(overview.bounds.minX, comp.geometry.x);
      overview.bounds.maxX = Math.max(overview.bounds.maxX, comp.geometry.x + comp.geometry.width);
      overview.bounds.minY = Math.min(overview.bounds.minY, comp.geometry.y);
      overview.bounds.maxY = Math.max(overview.bounds.maxY, comp.geometry.y + comp.geometry.height);
    });

    overview.averageSize.width = totalWidth / components.length;
    overview.averageSize.height = totalHeight / components.length;

    // Calculate density
    const canvasArea = (overview.bounds.maxX - overview.bounds.minX) * (overview.bounds.maxY - overview.bounds.minY);
    overview.density = canvasArea > 0 ? components.length / canvasArea : 0;

    // Determine complexity
    const uniqueTypes = new Set(components.map(c => c.type)).size;
    if (components.length <= 10 && uniqueTypes <= 3) overview.complexity = 'simple';
    else if (components.length <= 50 && uniqueTypes <= 10) overview.complexity = 'moderate';
    else if (components.length <= 100 && uniqueTypes <= 20) overview.complexity = 'complex';
    else overview.complexity = 'enterprise';

    return overview;
  }

  // Analyze spatial distribution
  analyzeSpatialDistribution(components) {
    const spatial = {
      clusters: [],
      hotspots: [],
      outliers: [],
      alignment: {
        horizontal: [],
        vertical: [],
        diagonal: []
      },
      symmetry: {
        horizontal: false,
        vertical: false,
        score: 0
      }
    };

    // Find clusters using simple distance-based clustering
    spatial.clusters = this.findSpatialClusters(components);

    // Find hotspots (areas with high component density)
    spatial.hotspots = this.findHotspots(components);

    // Find outliers (components far from others)
    spatial.outliers = this.findOutliers(components);

    // Analyze alignment
    spatial.alignment = this.analyzeAlignment(components);

    // Analyze symmetry
    spatial.symmetry = this.analyzeSymmetry(components);

    return spatial;
  }

  // Find spatial clusters
  findSpatialClusters(components, threshold = 100) {
    const clusters = [];
    const visited = new Set();

    components.forEach((component, index) => {
      if (visited.has(index)) return;

      const cluster = [component];
      const queue = [index];
      visited.add(index);

      while (queue.length > 0) {
        const currentIndex = queue.shift();
        const current = components[currentIndex];

        components.forEach((other, otherIndex) => {
          if (visited.has(otherIndex)) return;

          const distance = this.calculateDistance(current.geometry, other.geometry);
          if (distance <= threshold) {
            cluster.push(other);
            queue.push(otherIndex);
            visited.add(otherIndex);
          }
        });
      }

      if (cluster.length >= 2) {
        clusters.push({
          components: cluster,
          center: this.calculateClusterCenter(cluster),
          size: cluster.length,
          density: this.calculateClusterDensity(cluster)
        });
      }
    });

    return clusters.sort((a, b) => b.size - a.size);
  }

  // Calculate distance between two components
  calculateDistance(geom1, geom2) {
    const centerX1 = geom1.x + geom1.width / 2;
    const centerY1 = geom1.y + geom1.height / 2;
    const centerX2 = geom2.x + geom2.width / 2;
    const centerY2 = geom2.y + geom2.height / 2;

    return Math.sqrt(Math.pow(centerX2 - centerX1, 2) + Math.pow(centerY2 - centerY1, 2));
  }

  // Calculate cluster center
  calculateClusterCenter(cluster) {
    const totalX = cluster.reduce((sum, comp) => sum + comp.geometry.x + comp.geometry.width / 2, 0);
    const totalY = cluster.reduce((sum, comp) => sum + comp.geometry.y + comp.geometry.height / 2, 0);
    return {
      x: totalX / cluster.length,
      y: totalY / cluster.length
    };
  }

  // Calculate cluster density
  calculateClusterDensity(cluster) {
    if (cluster.length <= 1) return 0;

    const bounds = {
      minX: Math.min(...cluster.map(c => c.geometry.x)),
      maxX: Math.max(...cluster.map(c => c.geometry.x + c.geometry.width)),
      minY: Math.min(...cluster.map(c => c.geometry.y)),
      maxY: Math.max(...cluster.map(c => c.geometry.y + c.geometry.height))
    };

    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    return area > 0 ? cluster.length / area : 0;
  }

  // Find hotspots
  findHotspots(components, gridSize = 200) {
    const hotspots = [];
    const grid = {};

    // Map components to grid cells
    components.forEach(comp => {
      const gridX = Math.floor(comp.geometry.x / gridSize);
      const gridY = Math.floor(comp.geometry.y / gridSize);
      const key = `${gridX},${gridY}`;

      if (!grid[key]) {
        grid[key] = { x: gridX, y: gridY, components: [], count: 0 };
      }
      grid[key].components.push(comp);
      grid[key].count++;
    });

    // Find cells with high component count
    Object.values(grid).forEach(cell => {
      if (cell.count >= 3) { // Hotspot threshold
        hotspots.push({
          gridX: cell.x,
          gridY: cell.y,
          centerX: cell.x * gridSize + gridSize / 2,
          centerY: cell.y * gridSize + gridSize / 2,
          components: cell.components,
          count: cell.count,
          density: cell.count / (gridSize * gridSize)
        });
      }
    });

    return hotspots.sort((a, b) => b.count - a.count);
  }

  // Find outliers
  findOutliers(components) {
    const outliers = [];
    const threshold = 300; // Distance threshold for outliers

    components.forEach(component => {
      const distances = components
        .filter(c => c.id !== component.id)
        .map(c => this.calculateDistance(component.geometry, c.geometry));

      const minDistance = Math.min(...distances);
      if (minDistance > threshold) {
        outliers.push({
          component,
          minDistance,
          isolation: minDistance / threshold
        });
      }
    });

    return outliers.sort((a, b) => b.minDistance - a.minDistance);
  }

  // Analyze alignment
  analyzeAlignment(components) {
    const alignment = {
      horizontal: [],
      vertical: [],
      diagonal: []
    };

    const threshold = 20; // Alignment threshold

    // Check horizontal alignment
    for (let i = 0; i < components.length; i++) {
      const alignedComponents = [components[i]];
      const referenceY = components[i].geometry.y;

      for (let j = i + 1; j < components.length; j++) {
        if (Math.abs(components[j].geometry.y - referenceY) <= threshold) {
          alignedComponents.push(components[j]);
        }
      }

      if (alignedComponents.length >= 3) {
        alignment.horizontal.push({
          components: alignedComponents,
          y: referenceY,
          count: alignedComponents.length
        });
      }
    }

    // Check vertical alignment
    for (let i = 0; i < components.length; i++) {
      const alignedComponents = [components[i]];
      const referenceX = components[i].geometry.x;

      for (let j = i + 1; j < components.length; j++) {
        if (Math.abs(components[j].geometry.x - referenceX) <= threshold) {
          alignedComponents.push(components[j]);
        }
      }

      if (alignedComponents.length >= 3) {
        alignment.vertical.push({
          components: alignedComponents,
          x: referenceX,
          count: alignedComponents.length
        });
      }
    }

    return alignment;
  }

  // Analyze symmetry
  analyzeSymmetry(components) {
    const symmetry = {
      horizontal: false,
      vertical: false,
      score: 0
    };

    if (components.length < 2) return symmetry;

    // Calculate bounds
    const bounds = {
      minX: Math.min(...components.map(c => c.geometry.x)),
      maxX: Math.max(...components.map(c => c.geometry.x + c.geometry.width)),
      minY: Math.min(...components.map(c => c.geometry.y)),
      maxY: Math.max(...components.map(c => c.geometry.y + c.geometry.height))
    };

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Check horizontal symmetry
    const horizontalSymmetryScore = this.calculateSymmetryScore(components, centerX, 'horizontal');
    symmetry.horizontal = horizontalSymmetryScore > 0.7;

    // Check vertical symmetry
    const verticalSymmetryScore = this.calculateSymmetryScore(components, centerY, 'vertical');
    symmetry.vertical = verticalSymmetryScore > 0.7;

    symmetry.score = Math.max(horizontalSymmetryScore, verticalSymmetryScore);

    return symmetry;
  }

  // Calculate symmetry score
  calculateSymmetryScore(components, centerAxis, type) {
    const threshold = 50; // Symmetry threshold
    let matchedComponents = 0;

    components.forEach(comp => {
      const compCenter = type === 'horizontal' 
        ? comp.geometry.x + comp.geometry.width / 2
        : comp.geometry.y + comp.geometry.height / 2;

      const mirrorPosition = 2 * centerAxis - compCenter;
      
      // Find matching component on the other side
      const hasMatch = components.some(other => {
        if (other.id === comp.id) return false;
        const otherCenter = type === 'horizontal'
          ? other.geometry.x + other.geometry.width / 2
          : other.geometry.y + other.geometry.height / 2;
        return Math.abs(otherCenter - mirrorPosition) <= threshold;
      });

      if (hasMatch) matchedComponents++;
    });

    return matchedComponents / components.length;
  }

  // Analyze type distribution
  analyzeTypeDistribution(components) {
    const distribution = {
      types: {},
      categories: {},
      diversity: 0,
      dominantType: null,
      rareTypes: []
    };

    // Count types and categories
    components.forEach(comp => {
      const type = comp.type;
      const category = this.groupingService.getComponentCategory(type);

      distribution.types[type] = (distribution.types[type] || 0) + 1;
      distribution.categories[category] = (distribution.categories[category] || 0) + 1;
    });

    // Calculate diversity (Shannon entropy)
    const total = components.length;
    const entropy = Object.values(distribution.types).reduce((sum, count) => {
      const p = count / total;
      return sum - p * Math.log2(p);
    }, 0);
    distribution.diversity = entropy;

    // Find dominant type
    const sortedTypes = Object.entries(distribution.types).sort((a, b) => b[1] - a[1]);
    if (sortedTypes.length > 0) {
      distribution.dominantType = {
        type: sortedTypes[0][0],
        count: sortedTypes[0][1],
        percentage: (sortedTypes[0][1] / total) * 100
      };
    }

    // Find rare types (single instances)
    distribution.rareTypes = Object.entries(distribution.types)
      .filter(([type, count]) => count === 1)
      .map(([type]) => type);

    return distribution;
  }

  // Find patterns
  findPatterns(components) {
    const patterns = {
      repetition: [],
      progression: [],
      grouping: [],
      flow: []
    };

    // Find repetition patterns
    patterns.repetition = this.findRepetitionPatterns(components);

    // Find progression patterns
    patterns.progression = this.findProgressionPatterns(components);

    // Find grouping patterns
    patterns.grouping = this.findGroupingPatterns(components);

    // Find flow patterns
    patterns.flow = this.findFlowPatterns(components);

    return patterns;
  }

  // Find repetition patterns
  findRepetitionPatterns(components) {
    const patterns = [];
    const typeGroups = {};

    // Group by type
    components.forEach(comp => {
      const type = comp.type;
      if (!typeGroups[type]) typeGroups[type] = [];
      typeGroups[type].push(comp);
    });

    // Find regular spacing patterns
    Object.entries(typeGroups).forEach(([type, comps]) => {
      if (comps.length >= 3) {
        const spacingPattern = this.analyzeSpacing(comps);
        if (spacingPattern.isRegular) {
          patterns.push({
            type: 'regular_spacing',
            componentType: type,
            components: comps,
            spacing: spacingPattern.averageSpacing,
            direction: spacingPattern.direction,
            regularity: spacingPattern.regularity
          });
        }
      }
    });

    return patterns;
  }

  // Analyze spacing between components
  analyzeSpacing(components) {
    const spacing = {
      isRegular: false,
      averageSpacing: 0,
      direction: null,
      regularity: 0
    };

    if (components.length < 3) return spacing;

    // Sort components by position
    const sortedX = [...components].sort((a, b) => a.geometry.x - b.geometry.x);
    const sortedY = [...components].sort((a, b) => a.geometry.y - b.geometry.y);

    // Analyze X spacing
    const xSpacings = [];
    for (let i = 1; i < sortedX.length; i++) {
      xSpacings.push(sortedX[i].geometry.x - sortedX[i-1].geometry.x);
    }

    // Analyze Y spacing
    const ySpacings = [];
    for (let i = 1; i < sortedY.length; i++) {
      ySpacings.push(sortedY[i].geometry.y - sortedY[i-1].geometry.y);
    }

    // Calculate regularity for both directions
    const xRegularity = this.calculateRegularity(xSpacings);
    const yRegularity = this.calculateRegularity(ySpacings);

    if (xRegularity > 0.8 || yRegularity > 0.8) {
      spacing.isRegular = true;
      if (xRegularity > yRegularity) {
        spacing.direction = 'horizontal';
        spacing.averageSpacing = xSpacings.reduce((sum, s) => sum + s, 0) / xSpacings.length;
        spacing.regularity = xRegularity;
      } else {
        spacing.direction = 'vertical';
        spacing.averageSpacing = ySpacings.reduce((sum, s) => sum + s, 0) / ySpacings.length;
        spacing.regularity = yRegularity;
      }
    }

    return spacing;
  }

  // Calculate regularity of spacings
  calculateRegularity(spacings) {
    if (spacings.length < 2) return 0;

    const average = spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
    const variance = spacings.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / spacings.length;
    const stdDev = Math.sqrt(variance);

    // Regularity is high when standard deviation is low relative to average
    return average > 0 ? Math.max(0, 1 - (stdDev / average)) : 0;
  }

  // Find progression patterns
  findProgressionPatterns(components) {
    const patterns = [];
    
    // Look for size progressions
    const sizeProgression = this.findSizeProgression(components);
    if (sizeProgression) patterns.push(sizeProgression);

    // Look for position progressions
    const positionProgression = this.findPositionProgression(components);
    if (positionProgression) patterns.push(positionProgression);

    return patterns;
  }

  // Find size progression
  findSizeProgression(components) {
    if (components.length < 3) return null;

    const sorted = [...components].sort((a, b) => a.geometry.x - b.geometry.x);
    const widths = sorted.map(c => c.geometry.width);
    const heights = sorted.map(c => c.geometry.height);

    const widthProgression = this.detectProgression(widths);
    const heightProgression = this.detectProgression(heights);

    if (widthProgression.isProgression || heightProgression.isProgression) {
      return {
        type: 'size_progression',
        components: sorted,
        width: widthProgression,
        height: heightProgression
      };
    }

    return null;
  }

  // Detect numerical progression
  detectProgression(values) {
    const progression = {
      isProgression: false,
      type: null, // 'arithmetic', 'geometric', 'custom'
      pattern: null
    };

    if (values.length < 3) return progression;

    // Check arithmetic progression
    const differences = [];
    for (let i = 1; i < values.length; i++) {
      differences.push(values[i] - values[i-1]);
    }

    const avgDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    const diffVariance = differences.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / differences.length;
    
    if (diffVariance < Math.pow(avgDiff * 0.1, 2)) { // 10% tolerance
      progression.isProgression = true;
      progression.type = 'arithmetic';
      progression.pattern = { difference: avgDiff };
    }

    return progression;
  }

  // Find position progression
  findPositionProgression(components) {
    // Similar to size progression but for positions
    // Implementation depends on specific requirements
    return null;
  }

  // Find grouping patterns
  findGroupingPatterns(components) {
    const patterns = [];
    
    // Use existing grouping service
    const groupingAnalysis = this.groupingService.analyzeComponentsForGrouping(components);
    
    // Convert to pattern format
    Object.values(groupingAnalysis.typeGroups).forEach(group => {
      if (group.count >= 2) {
        patterns.push({
          type: 'type_grouping',
          componentType: group.type,
          category: group.category,
          components: group.components,
          commonProperties: group.commonProperties
        });
      }
    });

    return patterns;
  }

  // Find flow patterns
  findFlowPatterns(components) {
    const patterns = [];
    
    // Look for conveyor flows
    const conveyorFlow = this.findConveyorFlow(components);
    if (conveyorFlow.length > 0) patterns.push(...conveyorFlow);

    return patterns;
  }

  // Find conveyor flow patterns
  findConveyorFlow(components) {
    const conveyorTypes = ['straight_conveyor', 'belt_conveyor', 'roller_conveyor'];
    const conveyors = components.filter(c => conveyorTypes.includes(c.type));
    
    if (conveyors.length < 2) return [];

    const flows = [];
    
    // Simple flow detection: connected conveyors
    conveyors.forEach(conveyor => {
      const connectedConveyors = this.findConnectedConveyors(conveyor, conveyors);
      if (connectedConveyors.length >= 2) {
        flows.push({
          type: 'conveyor_flow',
          startComponent: conveyor,
          connectedComponents: connectedConveyors,
          direction: this.determineFlowDirection(connectedConveyors)
        });
      }
    });

    return flows;
  }

  // Find connected conveyors
  findConnectedConveyors(startConveyor, allConveyors) {
    const connected = [];
    const connectionThreshold = 50; // pixels

    allConveyors.forEach(conveyor => {
      if (conveyor.id === startConveyor.id) return;

      const distance = this.calculateDistance(startConveyor.geometry, conveyor.geometry);
      if (distance <= connectionThreshold) {
        connected.push(conveyor);
      }
    });

    return connected;
  }

  // Determine flow direction
  determineFlowDirection(conveyors) {
    if (conveyors.length < 2) return 'unknown';

    const firstConveyor = conveyors[0];
    const lastConveyor = conveyors[conveyors.length - 1];

    const deltaX = lastConveyor.geometry.x - firstConveyor.geometry.x;
    const deltaY = lastConveyor.geometry.y - firstConveyor.geometry.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  // Analyze optimization opportunities
  analyzeOptimizationOpportunities(components) {
    const opportunities = {
      overlapping: [],
      unnecessary: [],
      consolidation: [],
      performance: []
    };

    // Find overlapping components
    opportunities.overlapping = this.findOverlappingComponents(components);

    // Find unnecessary components
    opportunities.unnecessary = this.findUnnecessaryComponents(components);

    // Find consolidation opportunities
    opportunities.consolidation = this.findConsolidationOpportunities(components);

    // Find performance opportunities
    opportunities.performance = this.findPerformanceOpportunities(components);

    return opportunities;
  }

  // Find overlapping components
  findOverlappingComponents(components) {
    const overlapping = [];

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const comp1 = components[i];
        const comp2 = components[j];

        if (this.isOverlapping(comp1.geometry, comp2.geometry)) {
          overlapping.push({
            component1: comp1,
            component2: comp2,
            overlapArea: this.calculateOverlapArea(comp1.geometry, comp2.geometry)
          });
        }
      }
    }

    return overlapping;
  }

  // Check if two geometries overlap
  isOverlapping(geom1, geom2) {
    return !(geom1.x + geom1.width < geom2.x ||
             geom2.x + geom2.width < geom1.x ||
             geom1.y + geom1.height < geom2.y ||
             geom2.y + geom2.height < geom1.y);
  }

  // Calculate overlap area
  calculateOverlapArea(geom1, geom2) {
    const overlapX = Math.max(0, Math.min(geom1.x + geom1.width, geom2.x + geom2.width) - Math.max(geom1.x, geom2.x));
    const overlapY = Math.max(0, Math.min(geom1.y + geom1.height, geom2.y + geom2.height) - Math.max(geom1.y, geom2.y));
    return overlapX * overlapY;
  }

  // Find unnecessary components
  findUnnecessaryComponents(components) {
    const unnecessary = [];

    // Look for components that are too small to be useful
    components.forEach(comp => {
      const area = comp.geometry.width * comp.geometry.height;
      if (area < 100) { // 10x10 pixels
        unnecessary.push({
          component: comp,
          reason: 'Too small to be useful',
          area
        });
      }
    });

    return unnecessary;
  }

  // Find consolidation opportunities
  findConsolidationOpportunities(components) {
    const opportunities = [];

    // Look for components that could be merged
    const typeGroups = {};
    components.forEach(comp => {
      const type = comp.type;
      if (!typeGroups[type]) typeGroups[type] = [];
      typeGroups[type].push(comp);
    });

    Object.entries(typeGroups).forEach(([type, comps]) => {
      if (comps.length >= 2) {
        const clusters = this.findSpatialClusters(comps, 50); // Smaller threshold for consolidation
        clusters.forEach(cluster => {
          if (cluster.size >= 2) {
            opportunities.push({
              type: 'merge_components',
              componentType: type,
              components: cluster.components,
              reason: `${cluster.size} ${type} components could be merged`,
              potentialSaving: cluster.size - 1
            });
          }
        });
      }
    });

    return opportunities;
  }

  // Find performance opportunities
  findPerformanceOpportunities(components) {
    const opportunities = [];

    // High component count
    if (components.length > 100) {
      opportunities.push({
        type: 'high_component_count',
        count: components.length,
        recommendation: 'Consider using templates or component libraries to reduce complexity'
      });
    }

    // Complex component distribution
    const bounds = this.generateOverview(components).bounds;
    const canvasArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
    const density = canvasArea > 0 ? components.length / canvasArea : 0;

    if (density > 0.001) { // High density threshold
      opportunities.push({
        type: 'high_density',
        density,
        recommendation: 'Consider grouping or layering components for better performance'
      });
    }

    return opportunities;
  }

  // Analyze template opportunities
  analyzeTemplateOpportunities(components) {
    const opportunities = {
      existing: [],
      potential: [],
      recommendations: []
    };

    // Find existing template usage
    const templateUsage = {};
    components.forEach(comp => {
      if (comp.templateId) {
        templateUsage[comp.templateId] = (templateUsage[comp.templateId] || 0) + 1;
      }
    });

    opportunities.existing = Object.entries(templateUsage).map(([templateId, count]) => ({
      templateId,
      usageCount: count,
      efficiency: count > 1 ? 'good' : 'underutilized'
    }));

    // Find potential template opportunities
    const groupingAnalysis = this.groupingService.analyzeComponentsForGrouping(components);
    opportunities.potential = groupingAnalysis.suggestions
      .filter(suggestion => suggestion.type === 'type_grouping' && suggestion.count >= 2)
      .map(suggestion => ({
        componentType: suggestion.componentType,
        category: suggestion.category,
        componentCount: suggestion.count,
        templateSuggestion: suggestion.templateSuggestion,
        priority: suggestion.priority
      }));

    // Generate recommendations
    opportunities.recommendations = this.generateTemplateRecommendations(opportunities);

    return opportunities;
  }

  // Generate template recommendations
  generateTemplateRecommendations(opportunities) {
    const recommendations = [];

    // Recommendations for underutilized templates
    opportunities.existing.forEach(template => {
      if (template.efficiency === 'underutilized') {
        recommendations.push({
          type: 'underutilized_template',
          templateId: template.templateId,
          message: 'This template is only used once. Consider using it more or removing it.',
          priority: 'low'
        });
      }
    });

    // Recommendations for potential templates
    opportunities.potential.forEach(potential => {
      if (potential.priority > 50) {
        recommendations.push({
          type: 'create_template',
          componentType: potential.componentType,
          category: potential.category,
          componentCount: potential.componentCount,
          message: `Create a template for ${potential.componentType} components (${potential.componentCount} instances)`,
          priority: 'high'
        });
      }
    });

    return recommendations;
  }

  // Generate comprehensive recommendations
  generateRecommendations(analysis) {
    const recommendations = [];

    // Grouping recommendations
    if (analysis.grouping.suggestions.length > 0) {
      recommendations.push({
        type: 'grouping',
        priority: 'high',
        title: 'Component Grouping Opportunities',
        description: `Found ${analysis.grouping.suggestions.length} opportunities to group components by type`,
        actions: ['Auto-group components', 'Create templates from groups']
      });
    }

    // Performance recommendations
    if (analysis.optimization.performance.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Performance Optimization',
        description: 'Optimize component layout for better performance',
        actions: ['Reduce component count', 'Optimize component placement']
      });
    }

    // Template recommendations
    if (analysis.templates.potential.length > 0) {
      recommendations.push({
        type: 'templates',
        priority: 'high',
        title: 'Template Creation Opportunities',
        description: `Create ${analysis.templates.potential.length} new templates to improve efficiency`,
        actions: ['Create templates', 'Apply templates to existing components']
      });
    }

    // Spatial recommendations
    if (analysis.spatial.outliers.length > 0) {
      recommendations.push({
        type: 'spatial',
        priority: 'low',
        title: 'Layout Optimization',
        description: `Found ${analysis.spatial.outliers.length} isolated components`,
        actions: ['Reorganize layout', 'Group isolated components']
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

module.exports = ComponentAnalyzer; 