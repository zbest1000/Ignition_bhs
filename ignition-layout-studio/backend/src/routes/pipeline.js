const express = require('express');
const router = express.Router();
const pipelineService = require('../services/pipelineService');

// Get all available providers
router.get('/providers', (req, res) => {
  try {
    const providers = pipelineService.getProviders();
    res.json({
      success: true,
      providers
    });
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all available pipelines
router.get('/pipelines', (req, res) => {
  try {
    const pipelines = pipelineService.getPipelines();
    res.json({
      success: true,
      pipelines
    });
  } catch (error) {
    console.error('Error getting pipelines:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all available filters
router.get('/filters', (req, res) => {
  try {
    const filters = pipelineService.getFilters();
    res.json({
      success: true,
      filters
    });
  } catch (error) {
    console.error('Error getting filters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute a pipeline
router.post('/execute', async (req, res) => {
  try {
    const { pipelineId, messages, options = {} } = req.body;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    console.log(`Executing pipeline: ${pipelineId}`);

    const result = await pipelineService.executePipeline(pipelineId, messages, options);

    res.json({
      success: true,
      result: {
        content: result.response.content,
        provider: result.provider,
        model: result.model,
        usage: result.response.usage,
        extractedComponents: result.context.extractedComponents || [],
        metadata: result.context.metadata || {}
      }
    });
  } catch (error) {
    console.error('Error executing pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get pipeline performance metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = pipelineService.getPerformanceMetrics();
    
    res.json({
      success: true,
      metrics: {
        ...metrics,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    });
  } catch (error) {
    console.error('Error getting pipeline metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get pipeline status and health
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      pipelines: Array.from(pipelineService.pipelines.keys()),
      providers: Array.from(pipelineService.providers.keys()),
      activeConnections: pipelineService.cache.size,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Error getting pipeline health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear pipeline cache
router.post('/cache/clear', async (req, res) => {
  try {
    const cacheSize = pipelineService.cache.size;
    pipelineService.cache.clear();
    
    res.json({
      success: true,
      message: `Cleared ${cacheSize} cached entries`
    });
  } catch (error) {
    console.error('Error clearing pipeline cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate component using pipeline (enhanced version with performance monitoring)
router.post('/generate-component', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { description, context = {}, pipelineId = 'ignition-component-fast', options = {} } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Component description is required'
      });
    }

    // Validate description length for appropriate pipeline selection
    const descriptionLength = description.length;
    let selectedPipelineId = pipelineId;
    
    // Auto-select pipeline based on description complexity
    if (pipelineId === 'ignition-component-fast' && descriptionLength > 150) {
      selectedPipelineId = 'ignition-component';
      console.log(`Auto-upgraded to standard pipeline due to description length: ${descriptionLength}`);
    }

    const messages = [
      {
        role: 'user',
        content: `Generate an Ignition HMI component based on this description: ${description}`
      }
    ];

    // Add context if provided (optimized for performance)
    const contextItems = [];
    if (context.projectType) {
      contextItems.push(`Project Type: ${context.projectType}`);
    }
    if (context.industry) {
      contextItems.push(`Industry: ${context.industry}`);
    }
    if (context.safetyLevel) {
      contextItems.push(`Safety Level: ${context.safetyLevel}`);
    }
    
    // Only add complex context for non-fast pipelines
    if (selectedPipelineId !== 'ignition-component-fast') {
      if (context.existingComponents && context.existingComponents.length > 0) {
        contextItems.push(`Existing Components: ${context.existingComponents.slice(0, 5).map(c => c.type || c.name).join(', ')}`);
      }
      if (context.ocrResults) {
        contextItems.push(`OCR Results: ${context.ocrResults.substring(0, 200)}...`);
      }
    }
    
    if (contextItems.length > 0) {
      messages[0].content += `\n\n${contextItems.join('\n')}`;
    }

    console.log(`Generating component with pipeline: ${selectedPipelineId}, context items: ${contextItems.length}`);

    const result = await pipelineService.executePipeline(selectedPipelineId, messages, options);

    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      component: {
        content: result.response.content,
        extractedComponents: result.context.extractedComponents || [],
        provider: result.provider,
        model: result.model,
        usage: result.response.usage,
        performanceMetrics: {
          ...result.performanceMetrics,
          totalTime,
          pipeline: selectedPipelineId,
          descriptionLength,
          contextItems: contextItems.length
        }
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`Component generation failed after ${totalTime}ms:`, error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      performanceMetrics: {
        totalTime,
        failed: true
      }
    });
  }
});

// Analyze component using pipeline
router.post('/analyze-component', async (req, res) => {
  try {
    const {
      component,
      analysisType = 'general',
      pipelineId = 'advanced-analysis',
      options = {}
    } = req.body;

    if (!component) {
      return res.status(400).json({
        success: false,
        error: 'Component data is required'
      });
    }

    const messages = [
      {
        role: 'user',
        content: `Analyze this Ignition component and provide ${analysisType} analysis:\n\n${JSON.stringify(component, null, 2)}`
      }
    ];

    const result = await pipelineService.executePipeline(pipelineId, messages, options);

    res.json({
      success: true,
      analysis: {
        content: result.response.content,
        suggestions: result.context.extractedComponents || [],
        provider: result.provider,
        model: result.model,
        usage: result.response.usage
      }
    });
  } catch (error) {
    console.error('Error analyzing component:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enhance OCR results using pipeline
router.post('/enhance-ocr', async (req, res) => {
  try {
    const {
      ocrResults,
      imageContext = {},
      pipelineId = 'ocr-enhancement',
      options = {}
    } = req.body;

    if (!ocrResults) {
      return res.status(400).json({
        success: false,
        error: 'OCR results are required'
      });
    }

    const messages = [
      {
        role: 'user',
        content: `Interpret these OCR results from an industrial drawing and generate appropriate Ignition components:\n\nOCR Results: ${JSON.stringify(ocrResults, null, 2)}`
      }
    ];

    // Add image context if provided
    if (imageContext.drawingType) {
      messages[0].content += `\n\nDrawing Type: ${imageContext.drawingType}`;
    }
    if (imageContext.industry) {
      messages[0].content += `\n\nIndustry: ${imageContext.industry}`;
    }
    if (imageContext.equipment) {
      messages[0].content += `\n\nEquipment Context: ${imageContext.equipment}`;
    }

    const result = await pipelineService.executePipeline(pipelineId, messages, options);

    res.json({
      success: true,
      enhancement: {
        content: result.response.content,
        interpretedComponents: result.context.extractedComponents || [],
        provider: result.provider,
        model: result.model,
        usage: result.response.usage
      }
    });
  } catch (error) {
    console.error('Error enhancing OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add custom provider
router.post('/providers', async (req, res) => {
  try {
    const { providerId, config } = req.body;

    if (!providerId || !config) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID and configuration are required'
      });
    }

    pipelineService.addProvider(providerId, config);

    res.json({
      success: true,
      message: `Provider ${providerId} added successfully`
    });
  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add custom filter
router.post('/filters', async (req, res) => {
  try {
    const { filterId, config } = req.body;

    if (!filterId || !config) {
      return res.status(400).json({
        success: false,
        error: 'Filter ID and configuration are required'
      });
    }

    pipelineService.addFilter(filterId, config);

    res.json({
      success: true,
      message: `Filter ${filterId} added successfully`
    });
  } catch (error) {
    console.error('Error adding filter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add custom pipeline
router.post('/pipelines', async (req, res) => {
  try {
    const { pipelineId, config } = req.body;

    if (!pipelineId || !config) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID and configuration are required'
      });
    }

    pipelineService.addPipeline(pipelineId, config);

    res.json({
      success: true,
      message: `Pipeline ${pipelineId} added successfully`
    });
  } catch (error) {
    console.error('Error adding pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
