const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

// Get all projects
router.get('/', async (req, res) => {
  try {
    const projects = await Project.list();
    res.json(projects);
  } catch (error) {
    console.error('Error listing projects:', error);
    res.status(500).json({
      error: 'Failed to list projects',
      message: error.message
    });
  }
});

// Create new project
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const project = new Project({
      name: name || 'New Project',
      description: description || ''
    });
    
    await project.save();
    
    // Create project directories
    const projectDir = path.join(__dirname, '../../projects', project.id);
    const uploadDir = path.join(__dirname, '../../uploads', project.id);
    const exportDir = path.join(__dirname, '../../exports', project.id);
    
    await Promise.all([
      fs.mkdir(projectDir, { recursive: true }),
      fs.mkdir(uploadDir, { recursive: true }),
      fs.mkdir(exportDir, { recursive: true })
    ]);
    
    res.status(201).json(project.toJSON());
    
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      error: 'Failed to create project',
      message: error.message
    });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.load(req.params.id);
    res.json(project.toJSON());
  } catch (error) {
    console.error('Error loading project:', error);
    res.status(404).json({
      error: 'Project not found',
      message: error.message
    });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const project = await Project.load(req.params.id);
    const { name, description, settings, metadata, tagMappings } = req.body;
    
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (settings) project.updateSettings(settings);
    if (metadata) project.metadata = { ...project.metadata, ...metadata };
    if (tagMappings) project.tagMappings = { ...project.tagMappings, ...tagMappings };
    
    await project.save();
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(req.params.id).emit('project-updated', project.toJSON());
    
    res.json(project.toJSON());
    
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({
      error: 'Failed to update project',
      message: error.message
    });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Delete project directories
    const projectDir = path.join(__dirname, '../../projects', projectId);
    const uploadDir = path.join(__dirname, '../../uploads', projectId);
    const exportDir = path.join(__dirname, '../../exports', projectId);
    
    await Promise.all([
      fs.rm(projectDir, { recursive: true, force: true }),
      fs.rm(uploadDir, { recursive: true, force: true }),
      fs.rm(exportDir, { recursive: true, force: true })
    ]);
    
    res.json({ success: true, projectId });
    
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      error: 'Failed to delete project',
      message: error.message
    });
  }
});

// Clone project
router.post('/:id/clone', async (req, res) => {
  try {
    const sourceProject = await Project.load(req.params.id);
    const { name } = req.body;
    
    // Create new project with cloned data
    const clonedData = sourceProject.toJSON();
    delete clonedData.id;
    clonedData.name = name || `${sourceProject.name} (Copy)`;
    clonedData.createdAt = new Date().toISOString();
    clonedData.updatedAt = new Date().toISOString();
    clonedData.exportHistory = []; // Reset export history
    
    const newProject = new Project(clonedData);
    await newProject.save();
    
    // Create directories for new project
    const newProjectDir = path.join(__dirname, '../../projects', newProject.id);
    const newUploadDir = path.join(__dirname, '../../uploads', newProject.id);
    const newExportDir = path.join(__dirname, '../../exports', newProject.id);
    
    await Promise.all([
      fs.mkdir(newProjectDir, { recursive: true }),
      fs.mkdir(newUploadDir, { recursive: true }),
      fs.mkdir(newExportDir, { recursive: true })
    ]);
    
    // Copy uploaded files if any
    if (sourceProject.files.length > 0) {
      const sourceUploadDir = path.join(__dirname, '../../uploads', req.params.id);
      
      for (const file of sourceProject.files) {
        try {
          const sourcePath = path.join(sourceUploadDir, file.filename);
          const destPath = path.join(newUploadDir, file.filename);
          await fs.copyFile(sourcePath, destPath);
          
          // Update file path in cloned project
          file.path = destPath;
        } catch (err) {
          console.error('Error copying file:', err);
        }
      }
      
      await newProject.save();
    }
    
    res.status(201).json(newProject.toJSON());
    
  } catch (error) {
    console.error('Error cloning project:', error);
    res.status(500).json({
      error: 'Failed to clone project',
      message: error.message
    });
  }
});

// Get project statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const project = await Project.load(req.params.id);
    
    const stats = {
      totalFiles: project.files.length,
      totalComponents: project.components.length,
      totalTemplates: project.templates.length,
      filesByType: {},
      componentsByType: {},
      lastUpdated: project.updatedAt,
      exportCount: project.exportHistory.length
    };
    
    // Count files by type
    project.files.forEach(file => {
      stats.filesByType[file.category] = (stats.filesByType[file.category] || 0) + 1;
    });
    
    // Count components by type
    project.components.forEach(component => {
      stats.componentsByType[component.type] = (stats.componentsByType[component.type] || 0) + 1;
    });
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error getting project stats:', error);
    res.status(500).json({
      error: 'Failed to get project statistics',
      message: error.message
    });
  }
});

module.exports = router;