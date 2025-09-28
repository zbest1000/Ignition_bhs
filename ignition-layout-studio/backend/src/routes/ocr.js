const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const Project = require('../models/Project');
const Component = require('../models/Component');
const { v4: uuidv4 } = require('uuid');
const ocrService = require('../services/ocrService');

// Process file with OCR
router.post('/process/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const { options = {} } = req.body;

    const project = await Project.load(projectId);
    const file = project.files.find(f => f.id === fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if file type is supported for OCR
    const supportedTypes = ['image', 'pdf'];
    if (!supportedTypes.includes(file.category)) {
      return res.status(400).json({
        error: 'File type not supported for OCR',
        supportedTypes
      });
    }

    // Emit processing started event
    const io = req.app.get('io');
    io.to(projectId).emit('ocr-started', { fileId, status: 'processing' });

    // Process with OCR
    const ocrResult = await processWithOCR(file.path, options);

    // Extract components from OCR results
    const extractedComponents = await extractComponentsFromOCR(ocrResult, file);

    // Add components to project
    extractedComponents.forEach(component => {
      project.addComponent(component);
    });

    await project.save();

    // Emit completion event
    io.to(projectId).emit('ocr-completed', {
      fileId,
      status: 'completed',
      componentsFound: extractedComponents.length,
      components: extractedComponents
    });

    res.json({
      success: true,
      fileId,
      ocrResult: {
        textBlocks: ocrResult.textBlocks.length,
        components: extractedComponents.length
      },
      components: extractedComponents
    });
  } catch (error) {
    console.error('OCR processing error:', error);

    const io = req.app.get('io');
    io.to(req.params.projectId).emit('ocr-error', {
      fileId: req.params.fileId,
      error: error.message
    });

    res.status(500).json({
      error: 'OCR processing failed',
      message: error.message
    });
  }
});

// Get OCR results for a file
router.get('/results/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const project = await Project.load(projectId);
    const components = project.components.filter(
      c => c.metadata.source === 'ocr' && c.metadata.sourceFileId === fileId
    );

    res.json({
      fileId,
      components,
      count: components.length
    });
  } catch (error) {
    console.error('Error fetching OCR results:', error);
    res.status(500).json({
      error: 'Failed to fetch OCR results',
      message: error.message
    });
  }
});

// Re-process OCR with different settings
router.post('/reprocess/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const { options = {} } = req.body;

    const project = await Project.load(projectId);

    // Remove existing OCR components from this file
    project.components = project.components.filter(
      c => !(c.metadata.source === 'ocr' && c.metadata.sourceFileId === fileId)
    );

    await project.save();

    // Reprocess with new options
    req.body.options = options;
    return router.handle(req, res);
  } catch (error) {
    console.error('Error reprocessing OCR:', error);
    res.status(500).json({
      error: 'Failed to reprocess OCR',
      message: error.message
    });
  }
});

// OCR processing function (placeholder for PaddleOCR MCP integration)
async function processWithOCR(filePath, options = {}) {
  // Use the OCR service for processing
  const result = await ocrService.processImage(filePath);

  // Transform to expected format
  return {
    textBlocks: result.texts.map(text => ({
      text: text.text,
      bbox: {
        x: text.bbox[0],
        y: text.bbox[1],
        width: text.bbox[2] - text.bbox[0],
        height: text.bbox[3] - text.bbox[1]
      },
      confidence: text.confidence
    })),
    metadata: {
      processingTime: Date.now(),
      imageSize: { width: 1920, height: 1080 },
      componentsDetected: result.components.length
    }
  };
}

// Extract components from OCR results
async function extractComponentsFromOCR(ocrResult, fileInfo) {
  const components = [];
  const componentPatterns = [
    { pattern: /CONV[_\-\s]?\d+/i, type: 'straight_conveyor', category: 'conveyor' },
    { pattern: /CV[_\-\s]?\d+/i, type: 'straight_conveyor', category: 'conveyor' },
    { pattern: /MOTOR[_\-\s]?[A-Z0-9]+/i, type: 'motor', category: 'equipment' },
    { pattern: /M\d+/i, type: 'motor', category: 'equipment' },
    { pattern: /EDS[_\-\s]?\d+/i, type: 'eds_machine', category: 'equipment' },
    { pattern: /DIVERT[ER]*[_\-\s]?[A-Z0-9]+/i, type: 'diverter', category: 'equipment' },
    { pattern: /D\d+/i, type: 'diverter', category: 'equipment' },
    { pattern: /MERGE[_\-\s]?\d+/i, type: 'merge', category: 'equipment' },
    { pattern: /CURVE[_\-\s]?\d+/i, type: 'curve_90', category: 'conveyor' }
  ];

  for (const block of ocrResult.textBlocks) {
    for (const { pattern, type, category } of componentPatterns) {
      if (pattern.test(block.text)) {
        const component = new Component({
          equipmentId: block.text.replace(/\s+/g, '_').toUpperCase(),
          type,
          label: block.text,
          geometry: {
            x: block.bbox.x,
            y: block.bbox.y,
            width: block.bbox.width || 100,
            height: block.bbox.height || 50,
            rotation: 0
          },
          metadata: {
            source: 'ocr',
            sourceFileId: fileInfo.id,
            ocrText: block.text,
            confidence: block.confidence,
            category,
            layer: 'ocr-extracted'
          }
        });

        components.push(component);
        break; // Only match first pattern
      }
    }
  }

  // Detect relationships and flow direction
  components.forEach((comp, index) => {
    // Simple proximity-based relationship detection
    const nearbyComponents = components.filter((other, otherIndex) => {
      if (index === otherIndex) return false;
      const distance = Math.sqrt(
        Math.pow(comp.geometry.x - other.geometry.x, 2) +
          Math.pow(comp.geometry.y - other.geometry.y, 2)
      );
      return distance < 200; // Within 200 pixels
    });

    if (nearbyComponents.length > 0) {
      comp.metadata.nearbyComponents = nearbyComponents.map(c => c.equipmentId);
    }
  });

  return components;
}

// Batch OCR processing
router.post('/batch/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { fileIds, options = {} } = req.body;

    if (!fileIds || !Array.isArray(fileIds)) {
      return res.status(400).json({ error: 'fileIds array is required' });
    }

    const project = await Project.load(projectId);
    const results = [];

    for (const fileId of fileIds) {
      const file = project.files.find(f => f.id === fileId);
      if (!file || !['image', 'pdf'].includes(file.category)) {
        results.push({
          fileId,
          success: false,
          error: 'File not found or not supported'
        });
        continue;
      }

      try {
        const ocrResult = await processWithOCR(file.path, options);
        const components = await extractComponentsFromOCR(ocrResult, file);

        components.forEach(component => {
          project.addComponent(component);
        });

        results.push({
          fileId,
          success: true,
          componentsFound: components.length
        });
      } catch (error) {
        results.push({
          fileId,
          success: false,
          error: error.message
        });
      }
    }

    await project.save();

    res.json({
      success: true,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('Batch OCR error:', error);
    res.status(500).json({
      error: 'Batch OCR processing failed',
      message: error.message
    });
  }
});

module.exports = router;
