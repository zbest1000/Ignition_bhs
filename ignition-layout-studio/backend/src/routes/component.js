const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Component = require('../models/Component');
const { v4: uuidv4 } = require('uuid');

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
    
    // Emit socket event
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
    const layerComponents = project.components.filter(c => 
      c.metadata && c.metadata.layer === layerName
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
    let currentPosition = alignment === 'horizontal' 
      ? components[0].geometry.x 
      : components[0].geometry.y;
    
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

module.exports = router;