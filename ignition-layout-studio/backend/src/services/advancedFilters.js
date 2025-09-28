const pipelineService = require('./pipelineService');

class AdvancedFilters {
  constructor() {
    this.filters = new Map();
    this.initializeFilters();
  }

  initializeFilters() {
    // OCR Enhancement Filter
    this.filters.set('ocr-enhancement', {
      name: 'OCR Enhancement Filter',
      description: 'Enhance OCR results with AI interpretation',
      type: 'post-process',
      process: async (ocrResults, context) => {
        try {
          // Clean and validate OCR results
          const cleanedResults = this.cleanOCRResults(ocrResults);

          // Group related text elements
          const groupedElements = this.groupTextElements(cleanedResults);

          // Identify industrial equipment patterns
          const equipmentPatterns = this.identifyEquipmentPatterns(groupedElements);

          // Generate component suggestions
          const componentSuggestions = this.generateComponentSuggestions(equipmentPatterns);

          return {
            original: ocrResults,
            cleaned: cleanedResults,
            grouped: groupedElements,
            equipment: equipmentPatterns,
            suggestions: componentSuggestions,
            confidence: this.calculateOverallConfidence(cleanedResults)
          };
        } catch (error) {
          console.error('OCR enhancement error:', error);
          return {
            original: ocrResults,
            error: error.message
          };
        }
      }
    });

    // Component Validation Filter
    this.filters.set('component-validation', {
      name: 'Component Validation Filter',
      description: 'Validate generated components against Ignition standards',
      type: 'post-process',
      process: async (components, context) => {
        const validatedComponents = [];
        const validationErrors = [];

        for (const component of components) {
          const validation = this.validateIgnitionComponent(component);
          if (validation.isValid) {
            validatedComponents.push({
              ...component,
              validation: validation
            });
          } else {
            validationErrors.push({
              component,
              errors: validation.errors
            });
          }
        }

        return {
          valid: validatedComponents,
          invalid: validationErrors,
          totalComponents: components.length,
          validComponents: validatedComponents.length,
          validationRate: validatedComponents.length / components.length
        };
      }
    });

    // Industrial Context Filter
    this.filters.set('industrial-context', {
      name: 'Industrial Context Filter',
      description: 'Add industrial context and safety considerations',
      type: 'pre-process',
      process: async (input, context) => {
        const industrialContext = this.buildIndustrialContext(context);

        if (typeof input === 'string') {
          return `${industrialContext}\n\nUser Request: ${input}`;
        } else if (Array.isArray(input) && input.length > 0 && input[0].content) {
          // Messages array
          const lastMessage = input[input.length - 1];
          lastMessage.content = `${industrialContext}\n\n${lastMessage.content}`;
          return input;
        }

        return input;
      }
    });

    // Safety Analysis Filter
    this.filters.set('safety-analysis', {
      name: 'Safety Analysis Filter',
      description: 'Analyze components for safety compliance',
      type: 'post-process',
      process: async (components, context) => {
        const safetyAnalysis = {
          components: [],
          overallSafetyScore: 0,
          criticalIssues: [],
          recommendations: []
        };

        for (const component of components) {
          const analysis = this.analyzeSafety(component);
          safetyAnalysis.components.push({
            ...component,
            safety: analysis
          });

          if (analysis.criticalIssues.length > 0) {
            safetyAnalysis.criticalIssues.push(...analysis.criticalIssues);
          }
        }

        safetyAnalysis.overallSafetyScore = this.calculateSafetyScore(safetyAnalysis.components);
        safetyAnalysis.recommendations = this.generateSafetyRecommendations(safetyAnalysis);

        return safetyAnalysis;
      }
    });

    // Performance Optimization Filter
    this.filters.set('performance-optimization', {
      name: 'Performance Optimization Filter',
      description: 'Optimize components for performance',
      type: 'post-process',
      process: async (components, context) => {
        const optimizedComponents = [];
        const performanceMetrics = {
          totalComponents: components.length,
          optimizations: [],
          estimatedPerformanceGain: 0
        };

        for (const component of components) {
          const optimized = this.optimizeComponent(component);
          optimizedComponents.push(optimized.component);

          if (optimized.optimizations.length > 0) {
            performanceMetrics.optimizations.push({
              componentId: component.id || component.name,
              optimizations: optimized.optimizations
            });
          }
        }

        performanceMetrics.estimatedPerformanceGain = this.calculatePerformanceGain(
          performanceMetrics.optimizations
        );

        return {
          components: optimizedComponents,
          metrics: performanceMetrics
        };
      }
    });

    // Tag Binding Enhancement Filter
    this.filters.set('tag-binding-enhancement', {
      name: 'Tag Binding Enhancement Filter',
      description: 'Enhance and validate tag bindings',
      type: 'post-process',
      process: async (components, context) => {
        const enhancedComponents = [];
        const tagBindings = new Set();

        for (const component of components) {
          const enhanced = this.enhanceTagBindings(component, context);
          enhancedComponents.push(enhanced.component);

          enhanced.tags.forEach(tag => tagBindings.add(tag));
        }

        return {
          components: enhancedComponents,
          tagBindings: Array.from(tagBindings),
          tagCount: tagBindings.size
        };
      }
    });
  }

  // OCR Enhancement Methods
  cleanOCRResults(ocrResults) {
    return ocrResults
      .map(result => ({
        ...result,
        text: result.text
          .replace(/[^\w\s\-\.\/]/g, '') // Remove special characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim(),
        confidence: parseFloat(result.confidence) || 0
      }))
      .filter(result => result.text.length > 0 && result.confidence > 0.3);
  }

  groupTextElements(ocrResults) {
    const groups = [];
    const processed = new Set();

    for (let i = 0; i < ocrResults.length; i++) {
      if (processed.has(i)) continue;

      const current = ocrResults[i];
      const group = {
        elements: [current],
        boundingBox: current.position,
        combinedText: current.text,
        avgConfidence: current.confidence
      };

      // Find nearby elements
      for (let j = i + 1; j < ocrResults.length; j++) {
        if (processed.has(j)) continue;

        const other = ocrResults[j];
        if (this.areElementsRelated(current, other)) {
          group.elements.push(other);
          group.combinedText += ' ' + other.text;
          processed.add(j);
        }
      }

      group.avgConfidence =
        group.elements.reduce((sum, el) => sum + el.confidence, 0) / group.elements.length;
      groups.push(group);
      processed.add(i);
    }

    return groups;
  }

  areElementsRelated(element1, element2) {
    // Simple proximity check - can be enhanced
    const pos1 = element1.position;
    const pos2 = element2.position;

    const distance = Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));

    return distance < 50; // Adjust threshold as needed
  }

  identifyEquipmentPatterns(groupedElements) {
    const patterns = {
      pumps: [],
      valves: [],
      tanks: [],
      sensors: [],
      motors: [],
      pipes: [],
      instruments: []
    };

    const equipmentKeywords = {
      pumps: ['pump', 'p-', 'centrifugal', 'positive displacement'],
      valves: ['valve', 'v-', 'gate', 'ball', 'butterfly', 'check'],
      tanks: ['tank', 't-', 'vessel', 'storage', 'reactor'],
      sensors: ['sensor', 'transmitter', 'indicator', 'switch', 'detector'],
      motors: ['motor', 'm-', 'drive', 'actuator'],
      pipes: ['pipe', 'line', 'duct', 'conduit'],
      instruments: ['gauge', 'meter', 'controller', 'recorder']
    };

    for (const group of groupedElements) {
      const text = group.combinedText.toLowerCase();

      for (const [category, keywords] of Object.entries(equipmentKeywords)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          patterns[category].push({
            text: group.combinedText,
            confidence: group.avgConfidence,
            position: group.boundingBox,
            elements: group.elements
          });
        }
      }
    }

    return patterns;
  }

  generateComponentSuggestions(equipmentPatterns) {
    const suggestions = [];

    for (const [category, items] of Object.entries(equipmentPatterns)) {
      for (const item of items) {
        const suggestion = this.createComponentSuggestion(category, item);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    return suggestions;
  }

  createComponentSuggestion(category, item) {
    const baseProps = {
      position: item.position,
      confidence: item.confidence,
      sourceText: item.text
    };

    switch (category) {
      case 'pumps':
        return {
          type: 'perspective.pump',
          name: `pump_${Date.now()}`,
          props: {
            ...baseProps,
            status: '{[default]Equipment/Pumps/Status}',
            speed: '{[default]Equipment/Pumps/Speed}',
            flow: '{[default]Equipment/Pumps/Flow}'
          }
        };
      case 'valves':
        return {
          type: 'perspective.valve',
          name: `valve_${Date.now()}`,
          props: {
            ...baseProps,
            position: '{[default]Equipment/Valves/Position}',
            command: '{[default]Equipment/Valves/Command}',
            feedback: '{[default]Equipment/Valves/Feedback}'
          }
        };
      case 'tanks':
        return {
          type: 'perspective.tank',
          name: `tank_${Date.now()}`,
          props: {
            ...baseProps,
            level: '{[default]Equipment/Tanks/Level}',
            capacity: '{[default]Equipment/Tanks/Capacity}',
            temperature: '{[default]Equipment/Tanks/Temperature}'
          }
        };
      default:
        return null;
    }
  }

  calculateOverallConfidence(ocrResults) {
    if (ocrResults.length === 0) return 0;
    return ocrResults.reduce((sum, result) => sum + result.confidence, 0) / ocrResults.length;
  }

  // Component Validation Methods
  validateIgnitionComponent(component) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check component type
    if (
      !component.type ||
      (!component.type.includes('perspective.') && !component.type.includes('vision.'))
    ) {
      validation.isValid = false;
      validation.errors.push('Invalid component type. Must be perspective.* or vision.*');
    }

    // Check required properties
    if (!component.position) {
      validation.errors.push('Component position is required');
    }

    if (!component.size) {
      validation.errors.push('Component size is required');
    }

    // Check tag bindings
    if (component.props) {
      for (const [key, value] of Object.entries(component.props)) {
        if (typeof value === 'string' && value.includes('{[') && value.includes(']}')) {
          if (!this.validateTagBinding(value)) {
            validation.warnings.push(`Invalid tag binding format: ${value}`);
          }
        }
      }
    }

    return validation;
  }

  validateTagBinding(tagBinding) {
    // Basic tag binding validation
    const tagPattern = /^\{(\[[\w\s]+\])?[\w\/]+\}$/;
    return tagPattern.test(tagBinding);
  }

  // Industrial Context Methods
  buildIndustrialContext(context) {
    let industrialContext = `
Industrial Context:
- Industry: ${context.industry || 'General Manufacturing'}
- Safety Standards: ${context.safetyStandards || 'IEC 61511, ISA 84'}
- Control System: Ignition 8.1+ SCADA/HMI
- Operator Level: ${context.operatorLevel || 'Trained Industrial Operators'}
- Environment: ${context.environment || 'Industrial Plant Floor'}

Safety Requirements:
- All critical controls must have confirmation dialogs
- Emergency stops must be clearly visible and accessible
- Alarms must follow ISA 18.2 standards
- All components must support fail-safe operation
        `.trim();

    if (context.specificRequirements) {
      industrialContext += `\n\nSpecific Requirements:\n${context.specificRequirements}`;
    }

    return industrialContext;
  }

  // Safety Analysis Methods
  analyzeSafety(component) {
    const analysis = {
      safetyScore: 100,
      criticalIssues: [],
      warnings: [],
      recommendations: []
    };

    // Check for safety-critical components
    if (this.isSafetyCritical(component)) {
      if (!component.props.confirmationDialog) {
        analysis.criticalIssues.push('Safety-critical component lacks confirmation dialog');
        analysis.safetyScore -= 30;
      }

      if (!component.props.permissionCheck) {
        analysis.warnings.push('Consider adding permission checks for safety-critical operations');
        analysis.safetyScore -= 10;
      }
    }

    // Check for emergency stop capability
    if (component.type.includes('button') && !component.props.emergencyStop) {
      analysis.recommendations.push('Consider adding emergency stop functionality');
    }

    return analysis;
  }

  isSafetyCritical(component) {
    const criticalTypes = ['pump', 'valve', 'motor', 'heater', 'reactor'];
    return criticalTypes.some(type => component.type.includes(type));
  }

  calculateSafetyScore(components) {
    if (components.length === 0) return 0;
    return components.reduce((sum, comp) => sum + comp.safety.safetyScore, 0) / components.length;
  }

  generateSafetyRecommendations(safetyAnalysis) {
    const recommendations = [];

    if (safetyAnalysis.overallSafetyScore < 80) {
      recommendations.push(
        'Overall safety score is below recommended threshold. Review critical issues.'
      );
    }

    if (safetyAnalysis.criticalIssues.length > 0) {
      recommendations.push('Address all critical safety issues before deployment.');
    }

    return recommendations;
  }

  // Performance Optimization Methods
  optimizeComponent(component) {
    const optimized = { ...component };
    const optimizations = [];

    // Optimize tag binding frequency
    if (optimized.props) {
      for (const [key, value] of Object.entries(optimized.props)) {
        if (typeof value === 'string' && value.includes('{[') && !value.includes('rate=')) {
          // Add default update rate for performance
          optimized.props[key] = value.replace('}', ', rate=1000}');
          optimizations.push(`Added update rate to ${key} binding`);
        }
      }
    }

    // Optimize component size if too large
    if (optimized.size && optimized.size.width > 500) {
      optimized.size.width = 500;
      optimizations.push('Reduced component width for better performance');
    }

    return {
      component: optimized,
      optimizations
    };
  }

  calculatePerformanceGain(optimizations) {
    // Simple performance gain calculation
    return optimizations.length * 5; // 5% gain per optimization
  }

  // Tag Binding Enhancement Methods
  enhanceTagBindings(component, context) {
    const enhanced = { ...component };
    const tags = new Set();

    if (enhanced.props) {
      for (const [key, value] of Object.entries(enhanced.props)) {
        if (typeof value === 'string' && value.includes('{[')) {
          // Extract and enhance tag binding
          const enhancedBinding = this.enhanceTagBinding(value, context);
          enhanced.props[key] = enhancedBinding.binding;
          tags.add(enhancedBinding.tag);
        }
      }
    }

    return {
      component: enhanced,
      tags: Array.from(tags)
    };
  }

  enhanceTagBinding(binding, context) {
    // Extract tag from binding
    const tagMatch = binding.match(/\{(\[[\w\s]+\])?([\w\/]+)\}/);
    if (!tagMatch) return { binding, tag: null };

    const provider = tagMatch[1] || '[default]';
    const tagPath = tagMatch[2];

    // Enhance with context
    const enhancedPath = context.equipment
      ? `${provider}${context.equipment}/${tagPath}`
      : `${provider}Equipment/${tagPath}`;

    return {
      binding: `{${enhancedPath}}`,
      tag: enhancedPath
    };
  }

  // Public Methods
  async applyFilter(filterId, input, context = {}) {
    const filter = this.filters.get(filterId);
    if (!filter) {
      throw new Error(`Filter ${filterId} not found`);
    }

    return await filter.process(input, context);
  }

  getAvailableFilters() {
    return Array.from(this.filters.entries()).map(([id, filter]) => ({
      id,
      name: filter.name,
      description: filter.description,
      type: filter.type
    }));
  }

  addCustomFilter(filterId, filterConfig) {
    this.filters.set(filterId, filterConfig);
  }

  // Integration with Pipeline Service
  registerWithPipelineService() {
    // Register all filters with the pipeline service
    for (const [filterId, filter] of this.filters.entries()) {
      pipelineService.addFilter(filterId, filter);
    }
  }
}

module.exports = new AdvancedFilters();
