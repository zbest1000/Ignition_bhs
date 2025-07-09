const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const Project = require('../models/Project');
const Component = require('../models/Component');
const Template = require('../models/Template');

// Export project as SVG
router.get('/:projectId/svg', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const { includeLabels = true, includeGrid = false } = req.query;
    
    // Calculate canvas bounds
    const bounds = calculateBounds(project.components);
    const padding = 50;
    const width = bounds.maxX - bounds.minX + (padding * 2);
    const height = bounds.maxY - bounds.minY + (padding * 2);
    
    // Generate SVG
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}">
  <defs>
    <style>
      .component { cursor: pointer; }
      .straight_conveyor { fill: #cccccc; stroke: #333333; }
      .curve_90 { fill: none; stroke: #333333; stroke-width: 2; }
      .diverter { fill: #aaaaaa; stroke: #333333; }
      .motor { fill: #ff9999; stroke: #cc0000; }
      .eds_machine { fill: #99ccff; stroke: #0066cc; }
    </style>
  </defs>`;
    
    // Add grid if requested
    if (includeGrid === 'true') {
      svgContent += generateGridPattern(bounds, project.settings.gridSize);
    }
    
    // Group components by layer
    const layers = {};
    project.components.forEach(comp => {
      const layer = comp.metadata?.layer || 'default';
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(comp);
    });
    
    // Add components by layer
    Object.entries(layers).forEach(([layerName, components]) => {
      svgContent += `\n  <g id="layer-${layerName}" class="layer">\n`;
      
      components.forEach(comp => {
        const component = new Component(comp);
        svgContent += '    ' + component.toSVG() + '\n';
      });
      
      svgContent += '  </g>\n';
    });
    
    svgContent += '</svg>';
    
    // Set response headers
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}-layout.svg"`);
    
    res.send(svgContent);
    
  } catch (error) {
    console.error('Error exporting SVG:', error);
    res.status(500).json({
      error: 'Failed to export SVG',
      message: error.message
    });
  }
});

// Export project as Perspective JSON
router.post('/:projectId/perspective', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const { viewName = 'Main', includeTemplates = true } = req.body;
    
    const exportId = uuidv4();
    const exportDir = path.join(__dirname, '../../exports', project.id, exportId);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Create Perspective view structure
    const view = {
      meta: {
        name: viewName,
        description: `Generated from ${project.name}`,
        version: '1.0.0'
      },
      root: {
        type: 'container',
        props: {
          style: {
            classes: 'ignition-layout-studio-view'
          }
        },
        children: []
      }
    };
    
    // Process components
    project.components.forEach(comp => {
      let componentJson;
      
      if (comp.templateId && includeTemplates) {
        const template = project.templates.find(t => t.id === comp.templateId);
        if (template) {
          const templateObj = new Template(template);
          componentJson = templateObj.toPerspectiveJSON(comp);
        }
      }
      
      if (!componentJson) {
        // Default component structure
        componentJson = {
          type: 'drawing',
          props: {
            elements: [{
              type: 'rect',
              rect: {
                x: comp.geometry.x,
                y: comp.geometry.y,
                width: comp.geometry.width,
                height: comp.geometry.height
              },
              style: {
                fill: comp.style.fill,
                stroke: comp.style.stroke,
                strokeWidth: comp.style.strokeWidth
              }
            }]
          },
          meta: {
            name: comp.equipmentId
          },
          custom: {
            equipmentId: comp.equipmentId,
            componentType: comp.type
          }
        };
      }
      
      view.root.children.push(componentJson);
    });
    
    // Save view file
    const viewFile = path.join(exportDir, `${viewName}.json`);
    await fs.writeFile(viewFile, JSON.stringify(view, null, 2));
    
    // Generate template files if needed
    if (includeTemplates) {
      const templatesDir = path.join(exportDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });
      
      for (const template of project.templates) {
        const templateFile = path.join(templatesDir, `${template.name}.json`);
        await fs.writeFile(templateFile, JSON.stringify(template, null, 2));
      }
    }
    
    // Update export history
    project.addExportRecord({
      type: 'perspective',
      exportId,
      viewName,
      componentsCount: project.components.length,
      templatesIncluded: includeTemplates
    });
    await project.save();
    
    res.json({
      success: true,
      exportId,
      path: `/api/export/${project.id}/download/${exportId}`,
      details: {
        viewName,
        components: project.components.length,
        templates: includeTemplates ? project.templates.length : 0
      }
    });
    
  } catch (error) {
    console.error('Error exporting Perspective:', error);
    res.status(500).json({
      error: 'Failed to export Perspective view',
      message: error.message
    });
  }
});

// Export project as Vision XML
router.post('/:projectId/vision', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const { windowName = 'Main', includeTemplates = true } = req.body;
    
    const exportId = uuidv4();
    const exportDir = path.join(__dirname, '../../exports', project.id, exportId);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Generate Vision window XML
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Window name="${windowName}" width="1920" height="1080">
  <Description>${project.name} - Generated by Ignition Layout Studio</Description>
  <Components>\n`;
    
    // Process components
    project.components.forEach(comp => {
      if (comp.templateId && includeTemplates) {
        const template = project.templates.find(t => t.id === comp.templateId);
        if (template) {
          const templateObj = new Template(template);
          xmlContent += templateObj.toVisionXML(comp);
        }
      } else {
        // Default component XML
        xmlContent += `    <Group name="${comp.equipmentId}">
      <Rectangle x="${comp.geometry.x}" y="${comp.geometry.y}" width="${comp.geometry.width}" height="${comp.geometry.height}">
        <fill>
          <Color>${comp.style.fill}</Color>
        </fill>
        <stroke>
          <Color>${comp.style.stroke}</Color>
          <Width>${comp.style.strokeWidth}</Width>
        </stroke>
      </Rectangle>
      ${comp.label ? `<Label x="${comp.geometry.x + comp.geometry.width/2}" y="${comp.geometry.y + comp.geometry.height/2}" 
             text="${comp.label}" halign="center" valign="middle" />` : ''}
    </Group>\n`;
      }
    });
    
    xmlContent += `  </Components>
</Window>`;
    
    // Save window file
    const windowFile = path.join(exportDir, `${windowName}.xml`);
    await fs.writeFile(windowFile, xmlContent);
    
    // Generate template files if needed
    if (includeTemplates) {
      const templatesDir = path.join(exportDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });
      
      for (const template of project.templates) {
        const templateObj = new Template(template);
        const templateXml = templateObj.toVisionXML({});
        const templateFile = path.join(templatesDir, `${template.name}.xml`);
        await fs.writeFile(templateFile, templateXml);
      }
    }
    
    // Update export history
    project.addExportRecord({
      type: 'vision',
      exportId,
      windowName,
      componentsCount: project.components.length,
      templatesIncluded: includeTemplates
    });
    await project.save();
    
    res.json({
      success: true,
      exportId,
      path: `/api/export/${project.id}/download/${exportId}`,
      details: {
        windowName,
        components: project.components.length,
        templates: includeTemplates ? project.templates.length : 0
      }
    });
    
  } catch (error) {
    console.error('Error exporting Vision:', error);
    res.status(500).json({
      error: 'Failed to export Vision window',
      message: error.message
    });
  }
});

// Export complete project package
router.post('/:projectId/package', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const { 
      includeSVG = true, 
      includePerspective = true, 
      includeVision = true,
      includeTemplates = true,
      includeMetadata = true 
    } = req.body;
    
    const exportId = uuidv4();
    const exportDir = path.join(__dirname, '../../exports', project.id, exportId);
    await fs.mkdir(exportDir, { recursive: true });
    
    // Create package structure
    const packageDir = path.join(exportDir, 'package');
    await fs.mkdir(packageDir, { recursive: true });
    
    // Export SVG
    if (includeSVG) {
      const svgDir = path.join(packageDir, 'svg');
      await fs.mkdir(svgDir, { recursive: true });
      
      const bounds = calculateBounds(project.components);
      const svgContent = await generateProjectSVG(project, bounds);
      await fs.writeFile(path.join(svgDir, 'layout.svg'), svgContent);
    }
    
    // Export Perspective
    if (includePerspective) {
      const perspectiveDir = path.join(packageDir, 'perspective');
      await fs.mkdir(perspectiveDir, { recursive: true });
      
      const view = await generatePerspectiveView(project, includeTemplates);
      await fs.writeFile(
        path.join(perspectiveDir, 'Main.json'), 
        JSON.stringify(view, null, 2)
      );
    }
    
    // Export Vision
    if (includeVision) {
      const visionDir = path.join(packageDir, 'vision');
      await fs.mkdir(visionDir, { recursive: true });
      
      const windowXml = await generateVisionWindow(project, includeTemplates);
      await fs.writeFile(path.join(visionDir, 'Main.xml'), windowXml);
    }
    
    // Export templates
    if (includeTemplates && project.templates.length > 0) {
      const templatesDir = path.join(packageDir, 'templates');
      await fs.mkdir(templatesDir, { recursive: true });
      
      await fs.writeFile(
        path.join(templatesDir, 'templates.json'),
        JSON.stringify(project.templates, null, 2)
      );
    }
    
    // Export metadata
    if (includeMetadata) {
      const metadata = {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          createdAt: project.createdAt,
          exportedAt: new Date().toISOString()
        },
        statistics: {
          components: project.components.length,
          templates: project.templates.length,
          files: project.files.length,
          layers: [...new Set(project.components.map(c => c.metadata?.layer || 'default'))]
        },
        tagMappings: project.tagMappings,
        settings: project.settings
      };
      
      await fs.writeFile(
        path.join(packageDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Export equipment list
      const equipmentList = project.components.map(c => ({
        equipmentId: c.equipmentId,
        type: c.type,
        label: c.label,
        tags: c.tags,
        templateId: c.templateId
      }));
      
      await fs.writeFile(
        path.join(packageDir, 'equipment.json'),
        JSON.stringify(equipmentList, null, 2)
      );
    }
    
    // Create README
    const readme = `# ${project.name}

Generated by Ignition Layout Studio
Export Date: ${new Date().toISOString()}

## Contents

${includeSVG ? '- `/svg/` - SVG layout files\n' : ''}${includePerspective ? '- `/perspective/` - Ignition Perspective views\n' : ''}${includeVision ? '- `/vision/` - Ignition Vision windows\n' : ''}${includeTemplates ? '- `/templates/` - Reusable component templates\n' : ''}${includeMetadata ? '- `/metadata.json` - Project metadata\n- `/equipment.json` - Equipment list with tag mappings\n' : ''}

## Statistics

- Components: ${project.components.length}
- Templates: ${project.templates.length}
- Layers: ${[...new Set(project.components.map(c => c.metadata?.layer || 'default'))].join(', ')}

## Import Instructions

### Perspective
1. Copy JSON files from `/perspective/` to your Perspective project views folder
2. Import templates if included

### Vision
1. Import XML files from `/vision/` using Vision Designer
2. Import template XML files if included
`;
    
    await fs.writeFile(path.join(packageDir, 'README.md'), readme);
    
    // Create ZIP archive
    const zipPath = path.join(exportDir, `${project.name}-export.zip`);
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    archive.directory(packageDir, false);
    await archive.finalize();
    
    // Update export history
    project.addExportRecord({
      type: 'package',
      exportId,
      options: { includeSVG, includePerspective, includeVision, includeTemplates, includeMetadata }
    });
    await project.save();
    
    res.json({
      success: true,
      exportId,
      downloadPath: `/api/export/${project.id}/download/${exportId}`,
      details: {
        components: project.components.length,
        templates: project.templates.length,
        size: (await fs.stat(zipPath)).size
      }
    });
    
  } catch (error) {
    console.error('Error creating export package:', error);
    res.status(500).json({
      error: 'Failed to create export package',
      message: error.message
    });
  }
});

// Download export
router.get('/:projectId/download/:exportId', async (req, res) => {
  try {
    const { projectId, exportId } = req.params;
    const project = await Project.load(projectId);
    
    const exportDir = path.join(__dirname, '../../exports', projectId, exportId);
    const zipPath = path.join(exportDir, `${project.name}-export.zip`);
    
    // Check if zip exists, if not create it
    try {
      await fs.access(zipPath);
    } catch {
      // Create zip from export directory
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.pipe(output);
      archive.directory(exportDir, false);
      await archive.finalize();
    }
    
    res.download(zipPath, `${project.name}-export-${exportId.slice(0, 8)}.zip`);
    
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({
      error: 'Failed to download export',
      message: error.message
    });
  }
});

// Get export history
router.get('/:projectId/history', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    res.json(project.exportHistory);
  } catch (error) {
    console.error('Error getting export history:', error);
    res.status(500).json({
      error: 'Failed to get export history',
      message: error.message
    });
  }
});

// Helper functions
function calculateBounds(components) {
  if (components.length === 0) {
    return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  }
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  components.forEach(comp => {
    minX = Math.min(minX, comp.geometry.x);
    minY = Math.min(minY, comp.geometry.y);
    maxX = Math.max(maxX, comp.geometry.x + comp.geometry.width);
    maxY = Math.max(maxY, comp.geometry.y + comp.geometry.height);
  });
  
  return { minX, minY, maxX, maxY };
}

function generateGridPattern(bounds, gridSize = 10) {
  return `
  <defs>
    <pattern id="grid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
      <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.maxX - bounds.minX}" height="${bounds.maxY - bounds.minY}" fill="url(#grid)" />`;
}

async function generateProjectSVG(project, bounds) {
  const padding = 50;
  const width = bounds.maxX - bounds.minX + (padding * 2);
  const height = bounds.maxY - bounds.minY + (padding * 2);
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}">
  <title>${project.name}</title>
  <desc>Generated by Ignition Layout Studio</desc>\n`;
  
  project.components.forEach(comp => {
    const component = new Component(comp);
    svg += '  ' + component.toSVG() + '\n';
  });
  
  svg += '</svg>';
  return svg;
}

async function generatePerspectiveView(project, includeTemplates) {
  const view = {
    meta: {
      name: 'Main',
      description: `Generated from ${project.name}`,
      version: '1.0.0'
    },
    root: {
      type: 'container',
      props: {},
      children: []
    }
  };
  
  project.components.forEach(comp => {
    if (comp.templateId && includeTemplates) {
      const template = project.templates.find(t => t.id === comp.templateId);
      if (template) {
        const templateObj = new Template(template);
        view.root.children.push(templateObj.toPerspectiveJSON(comp));
      }
    } else {
      view.root.children.push({
        type: 'drawing',
        meta: { name: comp.equipmentId },
        position: comp.geometry,
        custom: { equipmentId: comp.equipmentId }
      });
    }
  });
  
  return view;
}

async function generateVisionWindow(project, includeTemplates) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Window name="Main" width="1920" height="1080">
  <Components>\n`;
  
  project.components.forEach(comp => {
    if (comp.templateId && includeTemplates) {
      const template = project.templates.find(t => t.id === comp.templateId);
      if (template) {
        const templateObj = new Template(template);
        xml += templateObj.toVisionXML(comp);
      }
    } else {
      xml += `    <Rectangle name="${comp.equipmentId}" x="${comp.geometry.x}" y="${comp.geometry.y}" 
                   width="${comp.geometry.width}" height="${comp.geometry.height}" />\n`;
    }
  });
  
  xml += `  </Components>
</Window>`;
  return xml;
}

module.exports = router;