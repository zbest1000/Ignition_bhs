const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Create test app with actual middleware
const app = express();
app.use(express.json());

// Configure multer for tests
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/test');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `test-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Mock upload endpoint
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Process files
    const processedFiles = files.map(file => ({
      filename: file.originalname,
      size: file.size,
      type: file.mimetype,
      path: file.path,
      uploadedAt: new Date().toISOString()
    }));

    res.json({
      success: true,
      message: 'Files uploaded successfully',
      files: processedFiles,
      warnings: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('Upload Integration Tests', () => {
  afterEach(() => {
    // Clean up test files
    const testDir = path.join(__dirname, '../../uploads/test');
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
    }
  });

  describe('File Upload Workflow', () => {
    test('should handle complete file upload workflow', async () => {
      // Create test file
      const testFilePath = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(testFilePath, 'fake image content');

      try {
        const response = await request(app)
          .post('/api/upload')
          .attach('files', testFilePath)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.files).toHaveLength(1);
        expect(response.body.files[0].filename).toBe('test-image.jpg');
        expect(response.body.files[0].size).toBeGreaterThan(0);
        expect(response.body.files[0].type).toBe('image/jpeg');
        expect(response.body.files[0].path).toBeDefined();
        expect(response.body.files[0].uploadedAt).toBeDefined();

        // Verify file was actually saved
        expect(fs.existsSync(response.body.files[0].path)).toBe(true);
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle multiple file uploads', async () => {
      // Create test files
      const testFile1 = path.join(__dirname, 'test1.jpg');
      const testFile2 = path.join(__dirname, 'test2.png');
      fs.writeFileSync(testFile1, 'fake image 1');
      fs.writeFileSync(testFile2, 'fake image 2');

      try {
        const response = await request(app)
          .post('/api/upload')
          .attach('files', testFile1)
          .attach('files', testFile2)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.files).toHaveLength(2);
        expect(response.body.files[0].filename).toBe('test1.jpg');
        expect(response.body.files[1].filename).toBe('test2.png');

        // Verify both files were saved
        response.body.files.forEach(file => {
          expect(fs.existsSync(file.path)).toBe(true);
        });
      } finally {
        // Clean up test files
        [testFile1, testFile2].forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
      }
    });

    test('should handle large file uploads', async () => {
      // Create large test file (5MB)
      const largeFilePath = path.join(__dirname, 'large-test.jpg');
      const largeContent = Buffer.alloc(5 * 1024 * 1024, 'x'); // 5MB of 'x'
      fs.writeFileSync(largeFilePath, largeContent);

      try {
        const response = await request(app)
          .post('/api/upload')
          .attach('files', largeFilePath)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.files[0].size).toBe(5 * 1024 * 1024);
      } finally {
        // Clean up test file
        if (fs.existsSync(largeFilePath)) {
          fs.unlinkSync(largeFilePath);
        }
      }
    });

    test('should handle empty upload requests', async () => {
      const response = await request(app).post('/api/upload').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No files uploaded');
    });

    test('should handle file upload errors gracefully', async () => {
      // Test with non-existent file path
      const response = await request(app)
        .post('/api/upload')
        .attach('files', 'non-existent-file.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('API Health Check', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid endpoints', async () => {
      await request(app).get('/api/invalid-endpoint').expect(404);
    });

    test('should handle malformed requests', async () => {
      await request(app).post('/api/upload').send('invalid data').expect(400);
    });
  });

  describe('File System Operations', () => {
    test('should create upload directory if it does not exist', async () => {
      const testDir = path.join(__dirname, '../../uploads/test');

      // Remove directory if it exists
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }

      // Create test file
      const testFilePath = path.join(__dirname, 'test-dir.jpg');
      fs.writeFileSync(testFilePath, 'test content');

      try {
        await request(app).post('/api/upload').attach('files', testFilePath).expect(200);

        // Verify directory was created
        expect(fs.existsSync(testDir)).toBe(true);
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });

    test('should handle file cleanup after processing', async () => {
      const testFilePath = path.join(__dirname, 'cleanup-test.jpg');
      fs.writeFileSync(testFilePath, 'cleanup test content');

      try {
        const response = await request(app)
          .post('/api/upload')
          .attach('files', testFilePath)
          .expect(200);

        // File should exist after upload
        expect(fs.existsSync(response.body.files[0].path)).toBe(true);

        // Manual cleanup (simulating cleanup service)
        fs.unlinkSync(response.body.files[0].path);
        expect(fs.existsSync(response.body.files[0].path)).toBe(false);
      } finally {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      }
    });
  });
});
