const { v4: uuidv4 } = require('uuid');
const Template = require('../models/Template');

class ComponentGroupingService {
  constructor() {
    this.componentTypeCategories = {
      'conveyor': [
        'straight_conveyor', 'industrial.straight-conveyor', 'perspective.conveyor',
        'belt_conveyor', 'industrial.belt-conveyor', 'roller_conveyor', 'industrial.roller-conveyor',
        'chain_conveyor', 'industrial.chain-conveyor', 'accumulation_conveyor', 'industrial.accumulation-conveyor',
        'spiral_conveyor', 'industrial.spiral-conveyor'
      ],
      'curves': [
        'curve_90', 'industrial.curve-90', 'curve_45', 'industrial.curve-45',
        'curve_180', 'industrial.curve-180'
      ],
      'equipment': [
        'motor', 'industrial.motor', 'perspective.motor', 'diverter', 'industrial.diverter',
        'merge', 'industrial.merge', 'sorter', 'industrial.sorter', 'pusher', 'industrial.pusher',
        'lifter', 'industrial.lifter', 'turntable', 'industrial.turntable'
      ],
      'sensors': [
        'sensor', 'industrial.sensor', 'photo_eye', 'industrial.photo-eye',
        'proximity_sensor', 'industrial.proximity-sensor', 'scanner', 'industrial.scanner',
        'barcode_scanner', 'industrial.barcode-scanner', 'rfid_reader', 'industrial.rfid-reader'
      ],
      'safety': [
        'emergency_stop', 'industrial.emergency-stop', 'safety_gate', 'industrial.safety-gate'
      ],
      'packaging': [
        'scale', 'industrial.scale', 'wrapper', 'industrial.wrapper',
        'palletizer', 'industrial.palletizer', 'depalletizer', 'industrial.depalletizer',
        'label_printer', 'industrial.label-printer'
      ],
      'robotics': [
        'robot_arm', 'industrial.robot-arm', 'agv_station', 'industrial.agv-station'
      ]
    };
  }

  // Analyze components and suggest groupings by type
  analyzeComponentsForGrouping(components) {
    const analysis = {
      typeGroups: {},
      patterns: [],
      suggestions: []
    };

    // Group components by type
    components.forEach(component => {
      const category = this.getComponentCategory(component.type);
      const typeKey = `${category}_${component.type}`;
      
      if (!analysis.typeGroups[typeKey]) {
        analysis.typeGroups[typeKey] = {
          category,
          type: component.type,
          components: [],
          count: 0,
          averageSize: { width: 0, height: 0 },
          commonProperties: {},
          spatialDistribution: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
        };
      }

      analysis.typeGroups[typeKey].components.push(component);
      analysis.typeGroups[typeKey].count++;
      this.updateGroupStatistics(analysis.typeGroups[typeKey], component);
    });

    // Generate patterns and suggestions
    Object.values(analysis.typeGroups).forEach(group => {
      this.finalizeGroupStatistics(group);
      
      if (group.count >= 2) {
        // Suggest grouping for multiple components of same type
        analysis.suggestions.push({
          type: 'type_grouping',
          category: group.category,
          componentType: group.type,
          componentIds: group.components.map(c => c.id),
          count: group.count,
          reason: `${group.count} ${group.type} components can be grouped and templated`,
          priority: this.calculateGroupingPriority(group),
          templateSuggestion: this.generateTemplateSuggestion(group)
        });
      }

      // Look for spatial patterns
      const spatialPatterns = this.analyzeSpatialPatterns(group);
      if (spatialPatterns.length > 0) {
        analysis.patterns.push(...spatialPatterns);
      }
    });

    return analysis;
  }

  // Get component category for a given type
  getComponentCategory(componentType) {
    for (const [category, types] of Object.entries(this.componentTypeCategories)) {
      if (types.includes(componentType)) {
        return category;
      }
    }
    return 'custom';
  }

  // Update group statistics with a new component
  updateGroupStatistics(group, component) {
    // Update spatial distribution
    group.spatialDistribution.minX = Math.min(group.spatialDistribution.minX, component.geometry.x);
    group.spatialDistribution.maxX = Math.max(group.spatialDistribution.maxX, component.geometry.x + component.geometry.width);
    group.spatialDistribution.minY = Math.min(group.spatialDistribution.minY, component.geometry.y);
    group.spatialDistribution.maxY = Math.max(group.spatialDistribution.maxY, component.geometry.y + component.geometry.height);

    // Update average size
    group.averageSize.width = ((group.averageSize.width * (group.count - 1)) + component.geometry.width) / group.count;
    group.averageSize.height = ((group.averageSize.height * (group.count - 1)) + component.geometry.height) / group.count;

    // Update common properties
    this.updateCommonProperties(group, component);
  }

  // Update common properties between components
  updateCommonProperties(group, component) {
    if (group.components.length === 1) {
      // First component, initialize common properties
      group.commonProperties = {
        style: { ...component.style },
        tags: { ...component.tags },
        properties: { ...component.properties }
      };
    } else {
      // Find common properties
      group.commonProperties.style = this.findCommonProperties(group.commonProperties.style, component.style);
      group.commonProperties.tags = this.findCommonProperties(group.commonProperties.tags, component.tags);
      group.commonProperties.properties = this.findCommonProperties(group.commonProperties.properties, component.properties);
    }
  }

  // Find common properties between two objects
  findCommonProperties(obj1, obj2) {
    const common = {};
    for (const key in obj1) {
      if (obj2.hasOwnProperty(key) && obj1[key] === obj2[key]) {
        common[key] = obj1[key];
      }
    }
    return common;
  }

  // Finalize group statistics
  finalizeGroupStatistics(group) {
    // Calculate spread and density
    const width = group.spatialDistribution.maxX - group.spatialDistribution.minX;
    const height = group.spatialDistribution.maxY - group.spatialDistribution.minY;
    group.spatialDistribution.spread = Math.sqrt(width * width + height * height);
    group.spatialDistribution.density = group.count / (width * height || 1);
  }

  // Analyze spatial patterns in a group
  analyzeSpatialPatterns(group) {
    const patterns = [];
    
    if (group.components.length < 2) return patterns;

    // Check for linear alignment
    const linearAlignment = this.checkLinearAlignment(group.components);
    if (linearAlignment.aligned) {
      patterns.push({
        type: 'linear',
        direction: linearAlignment.direction,
        components: group.components.map(c => c.id),
        strength: linearAlignment.strength,
        suggestion: `Components form a ${linearAlignment.direction} line - consider creating a linear template`
      });
    }

    // Check for grid pattern
    const gridPattern = this.checkGridPattern(group.components);
    if (gridPattern.isGrid) {
      patterns.push({
        type: 'grid',
        rows: gridPattern.rows,
        cols: gridPattern.cols,
        components: group.components.map(c => c.id),
        suggestion: `Components form a ${gridPattern.rows}x${gridPattern.cols} grid - consider creating a grid template`
      });
    }

    return patterns;
  }

  // Check if components are linearly aligned
  checkLinearAlignment(components) {
    if (components.length < 3) return { aligned: false };

    // Check horizontal alignment
    const horizontalVariance = this.calculateVariance(components.map(c => c.geometry.y));
    const horizontalSpacing = this.calculateSpacing(components.map(c => c.geometry.x));
    
    // Check vertical alignment
    const verticalVariance = this.calculateVariance(components.map(c => c.geometry.x));
    const verticalSpacing = this.calculateSpacing(components.map(c => c.geometry.y));

    const threshold = 20; // pixels
    
    if (horizontalVariance < threshold && horizontalSpacing.isUniform) {
      return { aligned: true, direction: 'horizontal', strength: 1 - (horizontalVariance / threshold) };
    }
    
    if (verticalVariance < threshold && verticalSpacing.isUniform) {
      return { aligned: true, direction: 'vertical', strength: 1 - (verticalVariance / threshold) };
    }

    return { aligned: false };
  }

  // Check if components form a grid pattern
  checkGridPattern(components) {
    if (components.length < 4) return { isGrid: false };

    // Sort components by position
    const sortedX = [...components].sort((a, b) => a.geometry.x - b.geometry.x);
    const sortedY = [...components].sort((a, b) => a.geometry.y - b.geometry.y);

    // Extract unique X and Y positions
    const uniqueX = [...new Set(sortedX.map(c => Math.round(c.geometry.x / 10) * 10))];
    const uniqueY = [...new Set(sortedY.map(c => Math.round(c.geometry.y / 10) * 10))];

    // Check if components form a grid
    const expectedCount = uniqueX.length * uniqueY.length;
    const actualCount = components.length;

    if (Math.abs(expectedCount - actualCount) <= 1) {
      return {
        isGrid: true,
        rows: uniqueY.length,
        cols: uniqueX.length,
        xPositions: uniqueX,
        yPositions: uniqueY
      };
    }

    return { isGrid: false };
  }

  // Calculate variance of an array
  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  // Calculate spacing uniformity
  calculateSpacing(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const spacings = [];
    
    for (let i = 1; i < sorted.length; i++) {
      spacings.push(sorted[i] - sorted[i-1]);
    }

    const averageSpacing = spacings.reduce((sum, spacing) => sum + spacing, 0) / spacings.length;
    const spacingVariance = this.calculateVariance(spacings);
    
    return {
      isUniform: spacingVariance < (averageSpacing * 0.1), // 10% tolerance
      averageSpacing,
      variance: spacingVariance
    };
  }

  // Calculate priority for grouping suggestion
  calculateGroupingPriority(group) {
    let priority = 0;
    
    // More components = higher priority
    priority += group.count * 10;
    
    // Dense clusters = higher priority
    priority += group.spatialDistribution.density * 5;
    
    // Common properties = higher priority
    const commonStyleProps = Object.keys(group.commonProperties.style).length;
    const commonTagProps = Object.keys(group.commonProperties.tags).length;
    priority += (commonStyleProps + commonTagProps) * 3;
    
    // Conveyor category gets bonus (as mentioned in user example)
    if (group.category === 'conveyor') {
      priority += 20;
    }
    
    return Math.min(priority, 100); // Cap at 100
  }

  // Generate template suggestion for a group
  generateTemplateSuggestion(group) {
    const templateName = `${group.category}_${group.type}_template`;
    const description = `Template for ${group.type} components (${group.count} instances)`;
    
    return {
      name: templateName,
      description,
      category: group.category,
      type: group.type,
      parameters: this.generateTemplateParameters(group),
      estimatedSize: group.averageSize,
      commonProperties: group.commonProperties,
      applicableCount: group.count
    };
  }

  // Generate template parameters based on group analysis
  generateTemplateParameters(group) {
    const parameters = [
      {
        name: 'equipmentId',
        type: 'string',
        required: true,
        defaultValue: '',
        description: 'Unique equipment identifier'
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        defaultValue: group.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: 'Component display label'
      }
    ];

    // Add style parameters if there are common styles
    if (group.commonProperties.style.fill) {
      parameters.push({
        name: 'fillColor',
        type: 'color',
        required: false,
        defaultValue: group.commonProperties.style.fill,
        description: 'Fill color'
      });
    }

    if (group.commonProperties.style.stroke) {
      parameters.push({
        name: 'strokeColor',
        type: 'color',
        required: false,
        defaultValue: group.commonProperties.style.stroke,
        description: 'Stroke color'
      });
    }

    // Add tag parameters if there are common tags
    Object.keys(group.commonProperties.tags).forEach(tagName => {
      if (group.commonProperties.tags[tagName]) {
        parameters.push({
          name: `${tagName}Tag`,
          type: 'tag',
          required: false,
          defaultValue: '',
          description: `Tag binding for ${tagName}`
        });
      }
    });

    // Add size parameters
    parameters.push({
      name: 'width',
      type: 'number',
      required: false,
      defaultValue: Math.round(group.averageSize.width),
      description: 'Component width'
    });

    parameters.push({
      name: 'height',
      type: 'number',
      required: false,
      defaultValue: Math.round(group.averageSize.height),
      description: 'Component height'
    });

    return parameters;
  }

  // Create template from component group
  async createTemplateFromGroup(project, groupId, templateOptions = {}) {
    const group = project.metadata.groups?.[groupId];
    if (!group) {
      throw new Error('Group not found');
    }

    const components = group.componentIds.map(id => 
      project.components.find(c => c.id === id)
    ).filter(Boolean);

    if (components.length === 0) {
      throw new Error('No valid components found in group');
    }

    // Analyze the group
    const analysis = this.analyzeComponentsForGrouping(components);
    const typeKey = Object.keys(analysis.typeGroups)[0];
    const groupAnalysis = analysis.typeGroups[typeKey];

    // Generate template
    const template = this.generateTemplateFromGroupAnalysis(groupAnalysis, templateOptions);
    
    // Add template to project
    project.addTemplate(template);
    
    // Update group with template reference
    group.templateId = template.id;
    group.updatedAt = new Date().toISOString();
    
    return template;
  }

  // Generate template from group analysis
  generateTemplateFromGroupAnalysis(groupAnalysis, options = {}) {
    const templateName = options.name || `${groupAnalysis.category}_${groupAnalysis.type}_template`;
    const description = options.description || `Template for ${groupAnalysis.type} components`;

    // Calculate template bounds
    const bounds = {
      minX: 0,
      minY: 0,
      maxX: Math.round(groupAnalysis.averageSize.width),
      maxY: Math.round(groupAnalysis.averageSize.height)
    };

    // Generate SVG template
    const svgTemplate = this.generateSVGTemplate(groupAnalysis, bounds);

    // Create template instance
    const template = new Template({
      name: templateName,
      type: 'component',
      category: groupAnalysis.category,
      description,
      baseComponent: {
        type: groupAnalysis.type,
        defaultWidth: Math.round(groupAnalysis.averageSize.width),
        defaultHeight: Math.round(groupAnalysis.averageSize.height),
        defaultProperties: groupAnalysis.commonProperties
      },
      parameters: this.generateTemplateParameters(groupAnalysis),
      svgTemplate,
      perspectiveTemplate: this.generatePerspectiveTemplate(groupAnalysis),
      visionTemplate: this.generateVisionTemplate(groupAnalysis),
      metadata: {
        ...options.metadata,
        sourceGroup: true,
        componentCount: groupAnalysis.count,
        generatedAt: new Date().toISOString()
      }
    });

    return template;
  }

  // Generate SVG template for the group
  generateSVGTemplate(groupAnalysis, bounds) {
    const { width, height } = groupAnalysis.averageSize;
    const commonStyle = groupAnalysis.commonProperties.style;

    // Create SVG based on component type
    let svgContent = '';
    
    if (groupAnalysis.category === 'conveyor') {
      svgContent = `
  <rect x="0" y="0" width="${width}" height="${height}" 
        fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}"
        class="conveyor-belt"/>
  <rect x="5" y="5" width="${width-10}" height="${height-10}" 
        fill="none" stroke="{{strokeColor}}" stroke-width="1" stroke-dasharray="5,5"
        class="conveyor-direction"/>`;
    } else if (groupAnalysis.category === 'equipment') {
      svgContent = `
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/2 - 5}" 
          fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}"
          class="equipment-body"/>
  <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/4}" 
          fill="none" stroke="{{strokeColor}}" stroke-width="2"
          class="equipment-center"/>`;
    } else {
      svgContent = `
  <rect x="0" y="0" width="${width}" height="${height}" 
        fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}"
        class="component-body"/>`;
    }

    return `<g class="{{componentClass}} {{category}}-component">
${svgContent}
  <text x="${width/2}" y="${height/2}" text-anchor="middle" 
        dominant-baseline="middle" font-size="{{fontSize}}" fill="{{textColor}}">{{label}}</text>
</g>`;
  }

  // Generate Perspective template
  generatePerspectiveTemplate(groupAnalysis) {
    return {
      type: 'drawing',
      props: {
        elements: [
          {
            type: 'rect',
            rect: {
              x: 0,
              y: 0,
              width: groupAnalysis.averageSize.width,
              height: groupAnalysis.averageSize.height
            },
            style: {
              fill: '{{fillColor}}',
              stroke: '{{strokeColor}}',
              strokeWidth: '{{strokeWidth}}'
            }
          }
        ]
      },
      custom: {
        equipmentId: '{{equipmentId}}',
        componentType: groupAnalysis.type,
        category: groupAnalysis.category
      }
    };
  }

  // Generate Vision template
  generateVisionTemplate(groupAnalysis) {
    return {
      type: 'rectangle',
      bounds: {
        x: 0,
        y: 0,
        width: groupAnalysis.averageSize.width,
        height: groupAnalysis.averageSize.height
      },
      background: '{{fillColor}}',
      foreground: '{{strokeColor}}',
      lineWidth: '{{strokeWidth}}',
      text: '{{label}}',
      customProperties: {
        equipmentId: '{{equipmentId}}',
        componentType: groupAnalysis.type,
        category: groupAnalysis.category
      }
    };
  }

  // Auto-group components by type
  async autoGroupComponentsByType(project) {
    const components = project.components;
    const analysis = this.analyzeComponentsForGrouping(components);
    const createdGroups = [];

    for (const suggestion of analysis.suggestions) {
      if (suggestion.type === 'type_grouping' && suggestion.count >= 2) {
        const groupId = uuidv4();
        const groupName = `${suggestion.category} - ${suggestion.componentType} (${suggestion.count})`;
        
        // Update components with group ID
        suggestion.componentIds.forEach(componentId => {
          const component = project.components.find(c => c.id === componentId);
          if (component) {
            component.group = groupId;
            component.updatedAt = new Date().toISOString();
          }
        });

        // Create group metadata
        const groupMetadata = {
          id: groupId,
          name: groupName,
          type: 'auto_type_group',
          category: suggestion.category,
          componentType: suggestion.componentType,
          componentIds: suggestion.componentIds,
          templateSuggestion: suggestion.templateSuggestion,
          createdAt: new Date().toISOString(),
          autoGenerated: true,
          priority: suggestion.priority
        };

        // Add to project
        project.metadata.groups = project.metadata.groups || {};
        project.metadata.groups[groupId] = groupMetadata;
        
        createdGroups.push(groupMetadata);
      }
    }

    return {
      groupsCreated: createdGroups.length,
      groups: createdGroups,
      analysis
    };
  }
}

module.exports = ComponentGroupingService; 