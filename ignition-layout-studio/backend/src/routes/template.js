const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Template = require('../models/Template');
const { v4: uuidv4 } = require('uuid');

// Get all templates for a project
router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    res.json(project.templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: error.message
    });
  }
});

// Create new template
router.post('/:projectId', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const templateData = req.body;

    const template = new Template(templateData);
    const validation = template.validate();

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid template data',
        errors: validation.errors
      });
    }

    project.addTemplate(template.toJSON());
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.projectId).emit('template-created', template.toJSON());

    res.status(201).json(template.toJSON());
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message
    });
  }
});

// Create template from components
router.post('/:projectId/from-components', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, templateName, category, description } = req.body;

    if (!componentIds || !Array.isArray(componentIds) || componentIds.length === 0) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);

    // Get components
    const components = componentIds
      .map(id => project.components.find(c => c.id === id))
      .filter(Boolean);

    if (components.length === 0) {
      return res.status(404).json({ error: 'No valid components found' });
    }

    // Calculate bounding box
    const bounds = {
      minX: Math.min(...components.map(c => c.geometry.x)),
      minY: Math.min(...components.map(c => c.geometry.y)),
      maxX: Math.max(...components.map(c => c.geometry.x + c.geometry.width)),
      maxY: Math.max(...components.map(c => c.geometry.y + c.geometry.height))
    };

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Generate SVG template
    const svgTemplate = `<g class="{{componentClass}}">
${components
  .map(comp => {
    const relX = comp.geometry.x - bounds.minX;
    const relY = comp.geometry.y - bounds.minY;
    return `  <rect x="${relX}" y="${relY}" width="${comp.geometry.width}" height="${comp.geometry.height}" 
        fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}" />`;
  })
  .join('\n')}
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" 
        dominant-baseline="middle" font-size="12" fill="#000000">{{label}}</text>
</g>`;

    // Create template
    const template = new Template({
      name: templateName || 'Custom Template',
      type: 'component',
      category: category || 'custom',
      description: description || '',
      baseComponent: {
        type: components[0].type || 'custom',
        defaultWidth: width,
        defaultHeight: height,
        defaultProperties: {}
      },
      svgTemplate,
      parameters: [
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
          defaultValue: templateName || 'Component',
          description: 'Display label'
        },
        {
          name: 'fillColor',
          type: 'color',
          required: false,
          defaultValue: '#cccccc',
          description: 'Fill color'
        },
        {
          name: 'strokeColor',
          type: 'color',
          required: false,
          defaultValue: '#000000',
          description: 'Stroke color'
        }
      ]
    });

    project.addTemplate(template.toJSON());
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-created', template.toJSON());

    res.status(201).json({
      success: true,
      template: template.toJSON(),
      sourceComponents: componentIds
    });
  } catch (error) {
    console.error('Error creating template from components:', error);
    res.status(500).json({
      error: 'Failed to create template from components',
      message: error.message
    });
  }
});

// Update template
router.put('/:projectId/:templateId', async (req, res) => {
  try {
    const { projectId, templateId } = req.params;
    const updates = req.body;

    const project = await Project.load(projectId);
    const templateIndex = project.templates.findIndex(t => t.id === templateId);

    if (templateIndex === -1) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Create updated template
    const existingData = project.templates[templateIndex];
    const updatedTemplate = new Template({
      ...existingData,
      ...updates,
      id: templateId,
      updatedAt: new Date().toISOString()
    });

    const validation = updatedTemplate.validate();
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid template data',
        errors: validation.errors
      });
    }

    // Increment version if significant changes
    if (updates.svgTemplate || updates.parameters || updates.baseComponent) {
      updatedTemplate.incrementVersion('minor');
    }

    project.templates[templateIndex] = updatedTemplate.toJSON();
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-updated', updatedTemplate.toJSON());

    res.json(updatedTemplate.toJSON());
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message
    });
  }
});

// Delete template
router.delete('/:projectId/:templateId', async (req, res) => {
  try {
    const { projectId, templateId } = req.params;

    const project = await Project.load(projectId);
    const templateExists = project.templates.some(t => t.id === templateId);

    if (!templateExists) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check if template is in use
    const componentsUsingTemplate = project.components.filter(c => c.templateId === templateId);
    if (componentsUsingTemplate.length > 0) {
      return res.status(400).json({
        error: 'Template is in use',
        componentsCount: componentsUsingTemplate.length,
        componentIds: componentsUsingTemplate.map(c => c.id)
      });
    }

    project.templates = project.templates.filter(t => t.id !== templateId);
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-deleted', templateId);

    res.json({ success: true, templateId });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message
    });
  }
});

// Clone template
router.post('/:projectId/:templateId/clone', async (req, res) => {
  try {
    const { projectId, templateId } = req.params;
    const { name } = req.body;

    const project = await Project.load(projectId);
    const originalTemplate = project.templates.find(t => t.id === templateId);

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const clonedTemplate = new Template(originalTemplate).clone();
    if (name) {
      clonedTemplate.name = name;
    }

    project.addTemplate(clonedTemplate.toJSON());
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-created', clonedTemplate.toJSON());

    res.status(201).json(clonedTemplate.toJSON());
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      error: 'Failed to clone template',
      message: error.message
    });
  }
});

// Apply template to components
router.post('/:projectId/:templateId/apply', async (req, res) => {
  try {
    const { projectId, templateId } = req.params;
    const { componentIds } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const template = project.templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updatedComponents = [];

    componentIds.forEach(componentId => {
      const componentIndex = project.components.findIndex(c => c.id === componentId);
      if (componentIndex !== -1) {
        project.components[componentIndex].templateId = templateId;
        project.components[componentIndex].type = template.baseComponent.type;
        project.components[componentIndex].updatedAt = new Date().toISOString();
        updatedComponents.push(project.components[componentIndex]);
      }
    });

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-applied', {
      templateId,
      components: updatedComponents
    });

    res.json({
      success: true,
      templateId,
      applied: updatedComponents.length,
      components: updatedComponents
    });
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({
      error: 'Failed to apply template',
      message: error.message
    });
  }
});

// Get template preview
router.get('/:projectId/:templateId/preview', async (req, res) => {
  try {
    const { projectId, templateId } = req.params;
    const { width = 200, height = 100 } = req.query;

    const project = await Project.load(projectId);
    const template = project.templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const templateObj = new Template(template);

    // Generate preview instance
    const previewInstance = {
      equipmentId: 'PREVIEW',
      label: template.name,
      geometry: {
        x: 0,
        y: 0,
        width: parseInt(width),
        height: parseInt(height)
      },
      style: {
        fill: '#cccccc',
        stroke: '#000000',
        strokeWidth: 2
      }
    };

    const svgContent = templateObj.generateSVG(previewInstance);
    const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${svgContent}
    </svg>`;

    res.type('image/svg+xml').send(svgWrapper);
  } catch (error) {
    console.error('Error generating template preview:', error);
    res.status(500).json({
      error: 'Failed to generate template preview',
      message: error.message
    });
  }
});

// Get templates by category
router.get('/:projectId/category/:category', async (req, res) => {
  try {
    const { projectId, category } = req.params;

    const project = await Project.load(projectId);
    const categoryTemplates = project.templates.filter(t => t.category === category);

    res.json({
      category,
      templates: categoryTemplates,
      count: categoryTemplates.length
    });
  } catch (error) {
    console.error('Error getting category templates:', error);
    res.status(500).json({
      error: 'Failed to get category templates',
      message: error.message
    });
  }
});

// Import template library
router.post('/:projectId/import', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { templates } = req.body;

    if (!templates || !Array.isArray(templates)) {
      return res.status(400).json({ error: 'templates array is required' });
    }

    const project = await Project.load(projectId);
    const importedTemplates = [];

    for (const templateData of templates) {
      const template = new Template(templateData);
      const validation = template.validate();

      if (validation.valid) {
        project.addTemplate(template.toJSON());
        importedTemplates.push(template.toJSON());
      }
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('templates-imported', importedTemplates);

    res.json({
      success: true,
      imported: importedTemplates.length,
      templates: importedTemplates
    });
  } catch (error) {
    console.error('Error importing templates:', error);
    res.status(500).json({
      error: 'Failed to import templates',
      message: error.message
    });
  }
});

module.exports = router;
