const { v4: uuidv4 } = require('uuid');

class Template {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || 'New Template';
    this.type = data.type || 'component'; // 'component', 'symbol', 'view'
    this.category = data.category || 'conveyor'; // 'conveyor', 'equipment', 'sensor', 'custom'
    this.description = data.description || '';
    this.version = data.version || '1.0.0';

    // Base component properties
    this.baseComponent = data.baseComponent || {
      type: 'straight_conveyor',
      defaultWidth: 100,
      defaultHeight: 50,
      defaultProperties: {}
    };

    // Dynamic parameters that can be bound
    this.parameters = data.parameters || [
      {
        name: 'equipmentId',
        type: 'string',
        required: true,
        defaultValue: '',
        description: 'Unique equipment identifier'
      },
      {
        name: 'statusTag',
        type: 'tag',
        required: false,
        defaultValue: '',
        description: 'OPC tag for equipment status'
      },
      {
        name: 'faultTag',
        type: 'tag',
        required: false,
        defaultValue: '',
        description: 'OPC tag for equipment faults'
      }
    ];

    // SVG template with placeholders
    this.svgTemplate = data.svgTemplate || this.getDefaultSVGTemplate();

    // Perspective template structure
    this.perspectiveTemplate = data.perspectiveTemplate || {
      type: 'embedded-view',
      props: {},
      custom: {},
      position: {
        x: 0,
        y: 0,
        width: 100,
        height: 50
      }
    };

    // Vision template structure
    this.visionTemplate = data.visionTemplate || {
      type: 'template',
      components: [],
      parameters: [],
      customProperties: {}
    };

    // Animations and interactions
    this.animations = data.animations || [];
    this.events = data.events || {
      onClick: null,
      onHover: null,
      onValueChange: null
    };

    // Tag mappings and expressions
    this.tagMappings = data.tagMappings || {};
    this.expressions = data.expressions || {};

    // Scripts and transforms
    this.scripts = data.scripts || {
      transform: null,
      custom: []
    };

    // Metadata
    this.metadata = {
      author: data.metadata?.author || 'System',
      tags: data.metadata?.tags || [],
      ignitionVersion: data.metadata?.ignitionVersion || '8.1',
      ...data.metadata
    };

    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  getDefaultSVGTemplate() {
    return `<g class="{{componentClass}}">
      <rect x="0" y="0" width="{{width}}" height="{{height}}" 
            fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}" />
      <text x="{{width/2}}" y="{{height/2}}" text-anchor="middle" 
            dominant-baseline="middle" font-size="12" fill="#000000">{{label}}</text>
    </g>`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      category: this.category,
      description: this.description,
      version: this.version,
      baseComponent: this.baseComponent,
      parameters: this.parameters,
      svgTemplate: this.svgTemplate,
      perspectiveTemplate: this.perspectiveTemplate,
      visionTemplate: this.visionTemplate,
      animations: this.animations,
      events: this.events,
      tagMappings: this.tagMappings,
      expressions: this.expressions,
      scripts: this.scripts,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Generate Perspective JSON
  toPerspectiveJSON(instance = {}) {
    const template = JSON.parse(JSON.stringify(this.perspectiveTemplate));

    // Apply instance parameters
    if (instance.equipmentId) {
      template.meta = template.meta || {};
      template.meta.name = `${this.name}_${instance.equipmentId}`;
    }

    // Apply position and size
    if (instance.geometry) {
      template.position = {
        x: instance.geometry.x || 0,
        y: instance.geometry.y || 0,
        width: instance.geometry.width || this.baseComponent.defaultWidth,
        height: instance.geometry.height || this.baseComponent.defaultHeight,
        rotate: instance.geometry.rotation || 0
      };
    }

    // Apply tag bindings
    template.props = template.props || {};
    this.parameters.forEach(param => {
      if (param.type === 'tag' && instance.tags && instance.tags[param.name]) {
        template.props[param.name] = {
          binding: {
            type: 'tag',
            path: instance.tags[param.name]
          }
        };
      } else if (instance[param.name]) {
        template.props[param.name] = instance[param.name];
      }
    });

    // Apply custom properties
    if (instance.properties) {
      template.custom = { ...template.custom, ...instance.properties };
    }

    // Apply animations
    if (this.animations.length > 0) {
      template.props.style = template.props.style || {};
      this.animations.forEach(anim => {
        if (anim.type === 'color' && anim.binding) {
          template.props.style[anim.property] = {
            binding: {
              type: 'expression',
              expression:
                anim.expression ||
                `if({[default]${anim.binding}}, "${anim.activeColor}", "${anim.inactiveColor}")`
            }
          };
        }
      });
    }

    return template;
  }

  // Generate Vision XML
  toVisionXML(instance = {}) {
    const params = this.parameters.map(p => ({
      name: p.name,
      value: instance[p.name] || p.defaultValue,
      type: p.type === 'tag' ? 'String' : p.type
    }));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Template name="${this.name}_${instance.equipmentId || 'instance'}">
  <Parameters>
    ${params.map(p => `<Parameter name="${p.name}" type="${p.type}" value="${p.value}" />`).join('\n    ')}
  </Parameters>
  <Components>
    ${this.generateVisionComponents(instance)}
  </Components>
</Template>`;

    return xml;
  }

  generateVisionComponents(instance) {
    // Simplified Vision component generation
    const g = instance.geometry || {};
    const width = g.width || this.baseComponent.defaultWidth;
    const height = g.height || this.baseComponent.defaultHeight;

    return `<Rectangle name="background" x="${g.x || 0}" y="${g.y || 0}" width="${width}" height="${height}">
      <fill>
        <Color>${instance.style?.fill || '#cccccc'}</Color>
      </fill>
      <stroke>
        <Color>${instance.style?.stroke || '#000000'}</Color>
        <Width>${instance.style?.strokeWidth || 1}</Width>
      </stroke>
    </Rectangle>
    <Label name="label" x="${(g.x || 0) + width / 2}" y="${(g.y || 0) + height / 2}" 
           text="${instance.label || ''}" halign="center" valign="middle" />`;
  }

  // Generate SVG with template placeholders replaced
  generateSVG(instance = {}) {
    let svg = this.svgTemplate;

    // Replace template variables
    const replacements = {
      componentClass: `${this.category} ${instance.type || this.baseComponent.type}`,
      width: instance.geometry?.width || this.baseComponent.defaultWidth,
      height: instance.geometry?.height || this.baseComponent.defaultHeight,
      fillColor: instance.style?.fill || '#cccccc',
      strokeColor: instance.style?.stroke || '#000000',
      strokeWidth: instance.style?.strokeWidth || 1,
      label: instance.label || '',
      equipmentId: instance.equipmentId || ''
    };

    // Replace all template variables
    Object.entries(replacements).forEach(([key, value]) => {
      svg = svg.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Handle expressions in template
    svg = svg.replace(/{{(.*?)}}/g, (match, expr) => {
      try {
        // Simple expression evaluation (be careful with security here)
        return eval(expr);
      } catch (e) {
        return match;
      }
    });

    return svg;
  }

  // Add parameter
  addParameter(param) {
    this.parameters.push({
      name: param.name,
      type: param.type || 'string',
      required: param.required || false,
      defaultValue: param.defaultValue || '',
      description: param.description || ''
    });
    this.updatedAt = new Date().toISOString();
  }

  // Add animation
  addAnimation(animation) {
    this.animations.push({
      id: uuidv4(),
      type: animation.type || 'color',
      property: animation.property || 'fill',
      binding: animation.binding || '',
      expression: animation.expression || '',
      activeColor: animation.activeColor || '#00ff00',
      inactiveColor: animation.inactiveColor || '#ff0000',
      ...animation
    });
    this.updatedAt = new Date().toISOString();
  }

  // Update version
  incrementVersion(type = 'patch') {
    const parts = this.version.split('.');
    switch (type) {
      case 'major':
        parts[0] = String(parseInt(parts[0]) + 1);
        parts[1] = '0';
        parts[2] = '0';
        break;
      case 'minor':
        parts[1] = String(parseInt(parts[1]) + 1);
        parts[2] = '0';
        break;
      case 'patch':
      default:
        parts[2] = String(parseInt(parts[2]) + 1);
    }
    this.version = parts.join('.');
    this.updatedAt = new Date().toISOString();
  }

  // Validate template
  validate() {
    const errors = [];

    if (!this.name) {
      errors.push('Template name is required');
    }

    if (!this.type) {
      errors.push('Template type is required');
    }

    if (!this.svgTemplate) {
      errors.push('SVG template is required');
    }

    // Validate parameters
    const paramNames = new Set();
    this.parameters.forEach(param => {
      if (!param.name) {
        errors.push('Parameter name is required');
      }
      if (paramNames.has(param.name)) {
        errors.push(`Duplicate parameter name: ${param.name}`);
      }
      paramNames.add(param.name);
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Clone template
  clone() {
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()));
    clonedData.id = uuidv4();
    clonedData.name = `${this.name} (Copy)`;
    clonedData.createdAt = new Date().toISOString();
    clonedData.updatedAt = new Date().toISOString();
    return new Template(clonedData);
  }
}

module.exports = Template;
