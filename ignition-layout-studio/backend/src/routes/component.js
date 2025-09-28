const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Component = require('../models/Component');
const ComponentGroupingService = require('../services/componentGroupingService');
const { v4: uuidv4 } = require('uuid');

// Initialize the grouping service
const groupingService = new ComponentGroupingService();

// Get all components for a project
router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    res.json(project.components);
  } catch (error) {
    console.error('Error getting components:', error);
    res.status(500).json({
      error: 'Failed to get components',
      message: error.message
    });
  }
});

// Create new component
router.post('/:projectId', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const componentData = req.body;

    const component = new Component(componentData);
    const validation = component.validate();

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid component data',
        errors: validation.errors
      });
    }

    project.addComponent(component);
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.projectId).emit('component-created', component.toJSON());

    res.status(201).json(component.toJSON());
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({
      error: 'Failed to create component',
      message: error.message
    });
  }
});

// Update component
router.put('/:projectId/:componentId', async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    const updates = req.body;

    const project = await Project.load(projectId);
    const componentIndex = project.components.findIndex(c => c.id === componentId);

    if (componentIndex === -1) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Create updated component
    const existingData = project.components[componentIndex];
    const updatedComponent = new Component({
      ...existingData,
      ...updates,
      id: componentId,
      updatedAt: new Date().toISOString()
    });

    const validation = updatedComponent.validate();
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid component data',
        errors: validation.errors
      });
    }

    project.components[componentIndex] = updatedComponent.toJSON();
    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('component-updated', updatedComponent.toJSON());

    res.json(updatedComponent.toJSON());
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({
      error: 'Failed to update component',
      message: error.message
    });
  }
});

// Delete component
router.delete('/:projectId/:componentId', async (req, res) => {
  try {
    const { projectId, componentId } = req.params;

    const project = await Project.load(projectId);
    const componentExists = project.components.some(c => c.id === componentId);

    if (!componentExists) {
      return res.status(404).json({ error: 'Component not found' });
    }

    project.components = project.components.filter(c => c.id !== componentId);
    await project.save();

    // Emit socket event (for single component deletions)
    const io = req.app.get('io');
    io.to(projectId).emit('component-deleted', componentId);

    res.json({ success: true, componentId });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({
      error: 'Failed to delete component',
      message: error.message
    });
  }
});

// Bulk update components
router.put('/:projectId/bulk', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, updates } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const updatedComponents = [];

    componentIds.forEach(componentId => {
      const componentIndex = project.components.findIndex(c => c.id === componentId);
      if (componentIndex !== -1) {
        const existingData = project.components[componentIndex];
        const updatedComponent = new Component({
          ...existingData,
          ...updates,
          id: componentId,
          updatedAt: new Date().toISOString()
        });

        project.components[componentIndex] = updatedComponent.toJSON();
        updatedComponents.push(updatedComponent.toJSON());
      }
    });

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-bulk-updated', updatedComponents);

    res.json({
      success: true,
      updated: updatedComponents.length,
      components: updatedComponents
    });
  } catch (error) {
    console.error('Error bulk updating components:', error);
    res.status(500).json({
      error: 'Failed to bulk update components',
      message: error.message
    });
  }
});

// Group components
router.post('/:projectId/group', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, groupName, templateId } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const groupId = uuidv4();
    const groupedComponents = [];

    componentIds.forEach(componentId => {
      const componentIndex = project.components.findIndex(c => c.id === componentId);
      if (componentIndex !== -1) {
        project.components[componentIndex].group = groupId;
        project.components[componentIndex].templateId = templateId || null;
        project.components[componentIndex].updatedAt = new Date().toISOString();
        groupedComponents.push(project.components[componentIndex]);
      }
    });

    // Add group metadata to project
    project.metadata.groups = project.metadata.groups || {};
    project.metadata.groups[groupId] = {
      id: groupId,
      name: groupName || `Group ${groupId.slice(0, 8)}`,
      componentIds,
      templateId,
      createdAt: new Date().toISOString()
    };

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-grouped', {
      groupId,
      components: groupedComponents
    });

    res.json({
      success: true,
      groupId,
      groupName: project.metadata.groups[groupId].name,
      components: groupedComponents
    });
  } catch (error) {
    console.error('Error grouping components:', error);
    res.status(500).json({
      error: 'Failed to group components',
      message: error.message
    });
  }
});

// Ungroup components
router.delete('/:projectId/group/:groupId', async (req, res) => {
  try {
    const { projectId, groupId } = req.params;

    const project = await Project.load(projectId);
    const ungroupedComponents = [];

    project.components.forEach((component, index) => {
      if (component.group === groupId) {
        project.components[index].group = null;
        project.components[index].updatedAt = new Date().toISOString();
        ungroupedComponents.push(project.components[index]);
      }
    });

    // Remove group metadata
    if (project.metadata.groups && project.metadata.groups[groupId]) {
      delete project.metadata.groups[groupId];
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-ungrouped', {
      groupId,
      components: ungroupedComponents
    });

    res.json({
      success: true,
      ungrouped: ungroupedComponents.length,
      components: ungroupedComponents
    });
  } catch (error) {
    console.error('Error ungrouping components:', error);
    res.status(500).json({
      error: 'Failed to ungroup components',
      message: error.message
    });
  }
});

// Clone components
router.post('/:projectId/clone', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, offset = { x: 50, y: 50 } } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const clonedComponents = [];

    componentIds.forEach(componentId => {
      const original = project.components.find(c => c.id === componentId);
      if (original) {
        const cloned = new Component(original).clone();
        cloned.geometry.x += offset.x;
        cloned.geometry.y += offset.y;

        project.addComponent(cloned);
        clonedComponents.push(cloned.toJSON());
      }
    });

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-cloned', clonedComponents);

    res.json({
      success: true,
      cloned: clonedComponents.length,
      components: clonedComponents
    });
  } catch (error) {
    console.error('Error cloning components:', error);
    res.status(500).json({
      error: 'Failed to clone components',
      message: error.message
    });
  }
});

// Get components by layer
router.get('/:projectId/layer/:layerName', async (req, res) => {
  try {
    const { projectId, layerName } = req.params;

    const project = await Project.load(projectId);
    const layerComponents = project.components.filter(
      c => c.metadata && c.metadata.layer === layerName
    );

    res.json({
      layer: layerName,
      components: layerComponents,
      count: layerComponents.length
    });
  } catch (error) {
    console.error('Error getting layer components:', error);
    res.status(500).json({
      error: 'Failed to get layer components',
      message: error.message
    });
  }
});

// Auto-align components
router.post('/:projectId/align', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, alignment = 'horizontal', spacing = 10 } = req.body;

    if (!componentIds || !Array.isArray(componentIds) || componentIds.length < 2) {
      return res.status(400).json({
        error: 'At least 2 componentIds are required for alignment'
      });
    }

    const project = await Project.load(projectId);
    const components = componentIds
      .map(id => project.components.find(c => c.id === id))
      .filter(Boolean);

    if (components.length < 2) {
      return res.status(404).json({ error: 'Not enough valid components found' });
    }

    // Sort components by position
    if (alignment === 'horizontal') {
      components.sort((a, b) => a.geometry.x - b.geometry.x);
    } else {
      components.sort((a, b) => a.geometry.y - b.geometry.y);
    }

    // Align components
    let currentPosition =
      alignment === 'horizontal' ? components[0].geometry.x : components[0].geometry.y;

    const alignedComponents = [];

    components.forEach((comp, index) => {
      const componentIndex = project.components.findIndex(c => c.id === comp.id);
      if (componentIndex !== -1) {
        if (alignment === 'horizontal') {
          if (index > 0) {
            currentPosition += components[index - 1].geometry.width + spacing;
          }
          project.components[componentIndex].geometry.x = currentPosition;
        } else {
          if (index > 0) {
            currentPosition += components[index - 1].geometry.height + spacing;
          }
          project.components[componentIndex].geometry.y = currentPosition;
        }

        project.components[componentIndex].updatedAt = new Date().toISOString();
        alignedComponents.push(project.components[componentIndex]);
      }
    });

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-aligned', alignedComponents);

    res.json({
      success: true,
      alignment,
      aligned: alignedComponents.length,
      components: alignedComponents
    });
  } catch (error) {
    console.error('Error aligning components:', error);
    res.status(500).json({
      error: 'Failed to align components',
      message: error.message
    });
  }
});

// Analyze components for grouping suggestions
router.get('/:projectId/analyze-grouping', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const analysis = groupingService.analyzeComponentsForGrouping(project.components);

    res.json({
      success: true,
      analysis,
      suggestedGroups: analysis.suggestions.length,
      patterns: analysis.patterns.length
    });
  } catch (error) {
    console.error('Error analyzing component grouping:', error);
    res.status(500).json({
      error: 'Failed to analyze component grouping',
      message: error.message
    });
  }
});

// Auto-group components by type
router.post('/:projectId/auto-group-by-type', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { generateTemplates = false } = req.body;

    const project = await Project.load(projectId);
    const result = await groupingService.autoGroupComponentsByType(project);

    // Generate templates if requested
    const templatesCreated = [];
    if (generateTemplates) {
      for (const group of result.groups) {
        try {
          const template = await groupingService.createTemplateFromGroup(project, group.id, {
            name: `${group.category}_${group.componentType}_template`,
            description: `Auto-generated template for ${group.componentType} components`
          });
          templatesCreated.push(template);
        } catch (templateError) {
          console.warn(`Failed to create template for group ${group.id}:`, templateError.message);
        }
      }
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-auto-grouped', {
      groups: result.groups,
      templatesCreated,
      analysis: result.analysis
    });

    res.json({
      success: true,
      groupsCreated: result.groupsCreated,
      groups: result.groups,
      templatesCreated: templatesCreated.length,
      templates: templatesCreated,
      analysis: result.analysis
    });
  } catch (error) {
    console.error('Error auto-grouping components:', error);
    res.status(500).json({
      error: 'Failed to auto-group components',
      message: error.message
    });
  }
});

// Group components by type (manual)
router.post('/:projectId/group-by-type', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentType, groupName, generateTemplate = false } = req.body;

    if (!componentType) {
      return res.status(400).json({ error: 'componentType is required' });
    }

    const project = await Project.load(projectId);
    
    // Find components of the specified type
    const matchingComponents = project.components.filter(c => c.type === componentType);
    
    if (matchingComponents.length === 0) {
      return res.status(404).json({ error: 'No components found of the specified type' });
    }

    const groupId = uuidv4();
    const finalGroupName = groupName || `${componentType} Group (${matchingComponents.length})`;

    // Update components with group ID
    matchingComponents.forEach(component => {
      component.group = groupId;
      component.updatedAt = new Date().toISOString();
    });

    // Create group metadata
    const groupMetadata = {
      id: groupId,
      name: finalGroupName,
      type: 'type_group',
      category: groupingService.getComponentCategory(componentType),
      componentType,
      componentIds: matchingComponents.map(c => c.id),
      createdAt: new Date().toISOString(),
      autoGenerated: false
    };

    // Add to project
    project.metadata.groups = project.metadata.groups || {};
    project.metadata.groups[groupId] = groupMetadata;

    // Generate template if requested
    let template = null;
    if (generateTemplate) {
      try {
        template = await groupingService.createTemplateFromGroup(project, groupId, {
          name: `${componentType}_template`,
          description: `Template for ${componentType} components`
        });
      } catch (templateError) {
        console.warn(`Failed to create template for group ${groupId}:`, templateError.message);
      }
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-grouped-by-type', {
      groupId,
      groupName: finalGroupName,
      components: matchingComponents,
      template
    });

    res.json({
      success: true,
      groupId,
      groupName: finalGroupName,
      componentsGrouped: matchingComponents.length,
      components: matchingComponents,
      template: template?.toJSON() || null
    });
  } catch (error) {
    console.error('Error grouping components by type:', error);
    res.status(500).json({
      error: 'Failed to group components by type',
      message: error.message
    });
  }
});

// Create template from group
router.post('/:projectId/group/:groupId/create-template', async (req, res) => {
  try {
    const { projectId, groupId } = req.params;
    const { templateName, description, ...templateOptions } = req.body;

    const project = await Project.load(projectId);
    const group = project.metadata.groups?.[groupId];

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Create template from group
    const template = await groupingService.createTemplateFromGroup(project, groupId, {
      name: templateName,
      description,
      ...templateOptions
    });

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('template-created-from-group', {
      groupId,
      template: template.toJSON()
    });

    res.json({
      success: true,
      template: template.toJSON(),
      groupId,
      sourceComponents: group.componentIds.length
    });
  } catch (error) {
    console.error('Error creating template from group:', error);
    res.status(500).json({
      error: 'Failed to create template from group',
      message: error.message
    });
  }
});

// Get component types and counts
router.get('/:projectId/types', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const typeCounts = {};
    const categoryGroups = {};

    project.components.forEach(component => {
      const type = component.type;
      const category = groupingService.getComponentCategory(type);
      
      // Count by type
      typeCounts[type] = (typeCounts[type] || 0) + 1;
      
      // Group by category
      if (!categoryGroups[category]) {
        categoryGroups[category] = {
          types: {},
          totalCount: 0
        };
      }
      categoryGroups[category].types[type] = (categoryGroups[category].types[type] || 0) + 1;
      categoryGroups[category].totalCount++;
    });

    res.json({
      success: true,
      typeCounts,
      categoryGroups,
      totalComponents: project.components.length,
      uniqueTypes: Object.keys(typeCounts).length
    });
  } catch (error) {
    console.error('Error getting component types:', error);
    res.status(500).json({
      error: 'Failed to get component types',
      message: error.message
    });
  }
});

// Get groups with enhanced information
router.get('/:projectId/groups', async (req, res) => {
  try {
    const project = await Project.load(req.params.projectId);
    const groups = project.metadata.groups || {};
    const enhancedGroups = {};

    for (const [groupId, group] of Object.entries(groups)) {
      const components = group.componentIds.map(id => 
        project.components.find(c => c.id === id)
      ).filter(Boolean);

      enhancedGroups[groupId] = {
        ...group,
        actualComponentCount: components.length,
        components: components.map(c => ({
          id: c.id,
          type: c.type,
          equipmentId: c.equipmentId,
          label: c.label,
          geometry: c.geometry
        })),
        hasTemplate: !!group.templateId,
        canCreateTemplate: components.length >= 2
      };
    }

    res.json({
      success: true,
      groups: enhancedGroups,
      totalGroups: Object.keys(enhancedGroups).length
    });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({
      error: 'Failed to get groups',
      message: error.message
    });
  }
});

// Bulk delete components
router.post('/:projectId/bulk-delete', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const beforeCount = project.components.length;

    // Filter out components whose id is in componentIds
    project.components = project.components.filter(c => !componentIds.includes(c.id));
    const removedCount = beforeCount - project.components.length;

    // Clean up group metadata lists
    if (project.metadata && project.metadata.groups) {
      Object.values(project.metadata.groups).forEach(groupMeta => {
        if (groupMeta.componentIds) {
          groupMeta.componentIds = groupMeta.componentIds.filter(id => !componentIds.includes(id));
        }
      });
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-deleted', componentIds);

    res.json({ success: true, deleted: removedCount, componentIds });
  } catch (error) {
    console.error('Error bulk deleting components:', error);
    res.status(500).json({ error: 'Failed to bulk delete components', message: error.message });
  }
});

module.exports = router;
