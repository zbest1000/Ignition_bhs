const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.body.projectId || req.params.projectId;
    const uploadDir = path.join(__dirname, '../../uploads', projectId);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      '.dwg', '.dxf', '.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif',
      '.xlsx', '.xls', '.csv'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: ' + allowedTypes.join(', ')));
    }
  }
});

// File upload endpoint
router.post('/:projectId', upload.array('files', 10), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Process uploaded files
    const processedFiles = await Promise.all(files.map(async file => {
      const fileInfo = {
        id: uuidv4(),
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimeType: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase(),
        uploadedAt: new Date().toISOString()
      };
      
      // Determine file type category
      const ext = fileInfo.extension;
      if (['.dwg', '.dxf'].includes(ext)) {
        fileInfo.category = 'cad';
      } else if (ext === '.pdf') {
        fileInfo.category = 'pdf';
      } else if (['.png', '.jpg', '.jpeg', '.tiff', '.tif'].includes(ext)) {
        fileInfo.category = 'image';
      } else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        fileInfo.category = 'data';
      }
      
      // Extract metadata based on file type
      if (fileInfo.category === 'image') {
        fileInfo.metadata = await extractImageMetadata(file.path);
      }
      
      return fileInfo;
    }));
    
    // Update project with new files
    const Project = require('../models/Project');
    const project = await Project.load(projectId);
    
    processedFiles.forEach(file => {
      project.addFile(file);
    });
    
    await project.save();
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(projectId).emit('files-uploaded', processedFiles);
    
    res.json({
      success: true,
      files: processedFiles,
      projectId
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'File upload failed',
      message: error.message
    });
  }
});

// Delete file endpoint
router.delete('/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    const Project = require('../models/Project');
    const project = await Project.load(projectId);
    
    const file = project.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete physical file
    try {
      await fs.unlink(file.path);
    } catch (err) {
      console.error('Error deleting physical file:', err);
    }
    
    // Remove from project
    project.files = project.files.filter(f => f.id !== fileId);
    await project.save();
    
    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('file-deleted', fileId);
    
    res.json({ success: true, fileId });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'File deletion failed',
      message: error.message
    });
  }
});

// Get file info endpoint
router.get('/:projectId/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    const Project = require('../models/Project');
    const project = await Project.load(projectId);
    
    const file = project.files.find(f => f.id === fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json(file);
    
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      error: 'Failed to get file info',
      message: error.message
    });
  }
});

// Helper function to extract image metadata
async function extractImageMetadata(filePath) {
  const sharp = require('sharp');
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    console.error('Error extracting image metadata:', error);
    return {};
  }
}

module.exports = router;