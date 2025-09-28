const { v4: uuidv4 } = require('uuid');

class Component {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.type = data.type || 'unknown'; // e.g., 'straight_conveyor', 'curve_90', 'diverter', etc.
    this.templateId = data.templateId || null;
    this.group = data.group || null;
    this.equipmentId = data.equipmentId || '';
    this.label = data.label || '';

    // Geometry properties
    this.geometry = {
      x: data.geometry?.x || 0,
      y: data.geometry?.y || 0,
      width: data.geometry?.width || 100,
      height: data.geometry?.height || 50,
      rotation: data.geometry?.rotation || 0,
      scale: data.geometry?.scale || 1,
      length: data.geometry?.length || null,
      radius: data.geometry?.radius || null,
      angle: data.geometry?.angle || null,
      points: data.geometry?.points || [],
      path: data.geometry?.path || null
    };

    // Visual properties
    this.style = {
      fill: data.style?.fill || '#cccccc',
      stroke: data.style?.stroke || '#000000',
      strokeWidth: data.style?.strokeWidth || 1,
      opacity: data.style?.opacity || 1,
      visible: data.style?.visible !== false,
      locked: data.style?.locked || false
    };

    // Tag bindings
    this.tags = {
      status: data.tags?.status || null,
      fault: data.tags?.fault || null,
      speed: data.tags?.speed || null,
      direction: data.tags?.direction || null,
      ...data.tags
    };

    // Metadata
    this.metadata = {
      layer: data.metadata?.layer || 'default',
      source: data.metadata?.source || 'manual',
      ocrText: data.metadata?.ocrText || null,
      confidence: data.metadata?.confidence || null,
      ...data.metadata
    };

    // Animation and scripting
    this.animations = data.animations || [];
    this.scripts = {
      onClick: data.scripts?.onClick || null,
      onHover: data.scripts?.onHover || null,
      onValueChange: data.scripts?.onValueChange || null,
      ...data.scripts
    };

    // Additional properties
    this.properties = data.properties || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      templateId: this.templateId,
      group: this.group,
      equipmentId: this.equipmentId,
      label: this.label,
      geometry: this.geometry,
      style: this.style,
      tags: this.tags,
      metadata: this.metadata,
      animations: this.animations,
      scripts: this.scripts,
      properties: this.properties,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // SVG generation
  toSVG() {
    const g = this.geometry;
    const s = this.style;
    let svgElement = '';

    const transform = `translate(${g.x},${g.y}) rotate(${g.rotation}) scale(${g.scale})`;
    const baseAttrs = `fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"`;
    const dataAttrs = `data-component-id="${this.id}" data-equipment="${this.equipmentId}" data-template="${this.templateId || ''}" data-layer="${this.metadata.layer}"`;

    switch (this.type) {
      case 'straight_conveyor':
        svgElement = `<rect x="0" y="0" width="${g.width}" height="${g.height}" ${baseAttrs} />`;
        break;

      case 'curve_90':
      case 'curve_45':
      case 'curve_180':
        const angle = parseInt(this.type.split('_')[1]);
        const path = this.generateCurvePath(angle);
        svgElement = `<path d="${path}" ${baseAttrs} fill="none" />`;
        break;

      case 'diverter':
        svgElement = this.generateDiverterSVG();
        break;

      default:
        if (g.path) {
          svgElement = `<path d="${g.path}" ${baseAttrs} />`;
        } else if (g.points && g.points.length > 0) {
          const pointsStr = g.points.map(p => `${p.x},${p.y}`).join(' ');
          svgElement = `<polygon points="${pointsStr}" ${baseAttrs} />`;
        } else {
          svgElement = `<rect x="0" y="0" width="${g.width}" height="${g.height}" ${baseAttrs} />`;
        }
    }

    // Add label if present
    let labelElement = '';
    if (this.label) {
      labelElement = `<text x="${g.width / 2}" y="${g.height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#000000">${this.label}</text>`;
    }

    return `<g transform="${transform}" ${dataAttrs} class="component ${this.type}">
      ${svgElement}
      ${labelElement}
    </g>`;
  }

  generateCurvePath(angle) {
    const g = this.geometry;
    const radius = g.radius || Math.min(g.width, g.height) / 2;
    const sweepAngle = (angle * Math.PI) / 180;

    const startX = 0;
    const startY = radius;
    const endX = radius * Math.sin(sweepAngle);
    const endY = radius * (1 - Math.cos(sweepAngle));

    const largeArcFlag = angle > 180 ? 1 : 0;

    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
  }

  generateDiverterSVG() {
    const g = this.geometry;
    const s = this.style;

    // Simple diverter representation
    return `
      <path d="M 0 ${g.height / 2} L ${g.width / 2} ${g.height / 2} L ${g.width} 0" 
            fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" />
      <path d="M ${g.width / 2} ${g.height / 2} L ${g.width} ${g.height}" 
            fill="none" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" />
      <circle cx="${g.width / 2}" cy="${g.height / 2}" r="5" fill="${s.fill}" stroke="${s.stroke}" />
    `;
  }

  // Update methods
  updateGeometry(updates) {
    this.geometry = { ...this.geometry, ...updates };
    this.updatedAt = new Date().toISOString();
  }

  updateStyle(updates) {
    this.style = { ...this.style, ...updates };
    this.updatedAt = new Date().toISOString();
  }

  updateTags(updates) {
    this.tags = { ...this.tags, ...updates };
    this.updatedAt = new Date().toISOString();
  }

  addAnimation(animation) {
    this.animations.push({
      id: uuidv4(),
      ...animation
    });
    this.updatedAt = new Date().toISOString();
  }

  // Validation
  validate() {
    const errors = [];

    if (!this.type) {
      errors.push('Component type is required');
    }

    if (!this.equipmentId) {
      errors.push('Equipment ID is required');
    }

    if (this.geometry.x == null || this.geometry.y == null) {
      errors.push('Component position (x, y) is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Clone component
  clone() {
    const clonedData = JSON.parse(JSON.stringify(this.toJSON()));
    clonedData.id = uuidv4();
    clonedData.createdAt = new Date().toISOString();
    clonedData.updatedAt = new Date().toISOString();
    return new Component(clonedData);
  }
}

module.exports = Component;
