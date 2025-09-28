const express = require('express');
const router = express.Router();
const codeInterpreterService = require('../services/codeInterpreterService');
const pipelineService = require('../services/pipelineService');

// Execute code directly
router.post('/execute', async (req, res) => {
  try {
    const { code, context = {} } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Code is required'
      });
    }

    const result = await codeInterpreterService.executeCode(code, context);

    res.json({
      success: result.success,
      result: result.result,
      executionId: result.executionId,
      executionTime: result.executionTime,
      error: result.error
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze component with code interpreter
router.post('/analyze-component', async (req, res) => {
  try {
    const { component, analysisType = 'general' } = req.body;

    if (!component) {
      return res.status(400).json({
        success: false,
        error: 'Component data is required'
      });
    }

    const result = await codeInterpreterService.analyzeComponentWithCode(component, analysisType);

    res.json({
      success: result.success,
      analysis: result.result,
      executionId: result.executionId,
      executionTime: result.executionTime,
      error: result.error
    });
  } catch (error) {
    console.error('Error analyzing component:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate components from OCR using code interpreter
router.post('/generate-from-ocr', async (req, res) => {
  try {
    const { ocrResults, imageContext = {} } = req.body;

    if (!ocrResults) {
      return res.status(400).json({
        success: false,
        error: 'OCR results are required'
      });
    }

    const result = await codeInterpreterService.generateComponentFromOCR(ocrResults, imageContext);

    res.json({
      success: result.success,
      components: result.result,
      executionId: result.executionId,
      executionTime: result.executionTime,
      error: result.error
    });
  } catch (error) {
    console.error('Error generating components from OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process file data with code interpreter
router.post('/process-file', async (req, res) => {
  try {
    const { fileData, analysisType = 'general' } = req.body;

    if (!fileData) {
      return res.status(400).json({
        success: false,
        error: 'File data is required'
      });
    }

    const result = await codeInterpreterService.processFileData(fileData, analysisType);

    res.json({
      success: result.success,
      analysis: result.result,
      executionId: result.executionId,
      executionTime: result.executionTime,
      error: result.error
    });
  } catch (error) {
    console.error('Error processing file data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enhanced pipeline execution with code interpreter
router.post('/pipeline-with-code', async (req, res) => {
  try {
    const { pipelineId, messages, codeContext = {}, options = {} } = req.body;

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

    // First, execute the pipeline
    const pipelineResult = await pipelineService.executePipeline(pipelineId, messages, options);

    // Check if the response contains code to execute
    const codeMatch = pipelineResult.response.content.match(/```python\n([\s\S]*?)\n```/);

    let codeResult = null;
    if (codeMatch) {
      const code = codeMatch[1];
      console.log('Executing code from pipeline response');

      // Execute the code with context
      const context = {
        ...codeContext,
        pipelineResponse: pipelineResult.response.content,
        extractedComponents: pipelineResult.context.extractedComponents
      };

      codeResult = await codeInterpreterService.executeCode(code, context);
    }

    res.json({
      success: true,
      pipeline: {
        content: pipelineResult.response.content,
        provider: pipelineResult.provider,
        model: pipelineResult.model,
        usage: pipelineResult.response.usage,
        extractedComponents: pipelineResult.context.extractedComponents
      },
      codeExecution: codeResult,
      hasCode: !!codeMatch
    });
  } catch (error) {
    console.error('Error executing pipeline with code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Advanced OCR enhancement with both pipeline and code interpreter
router.post('/enhance-ocr-advanced', async (req, res) => {
  try {
    const { ocrResults, imageContext = {}, useCodeInterpreter = true } = req.body;

    if (!ocrResults) {
      return res.status(400).json({
        success: false,
        error: 'OCR results are required'
      });
    }

    // First, use the pipeline to interpret OCR results
    const messages = [
      {
        role: 'user',
        content: `Analyze these OCR results from an industrial drawing and suggest appropriate Ignition components. Also provide Python code to generate these components if possible:\n\nOCR Results: ${JSON.stringify(ocrResults, null, 2)}`
      }
    ];

    const pipelineResult = await pipelineService.executePipeline('ocr-enhancement', messages);

    let codeResult = null;
    if (useCodeInterpreter) {
      // Also run code interpreter analysis
      codeResult = await codeInterpreterService.generateComponentFromOCR(ocrResults, imageContext);
    }

    res.json({
      success: true,
      pipelineAnalysis: {
        content: pipelineResult.response.content,
        interpretedComponents: pipelineResult.context.extractedComponents,
        provider: pipelineResult.provider,
        model: pipelineResult.model
      },
      codeAnalysis: codeResult
        ? {
            success: codeResult.success,
            components: codeResult.result,
            executionTime: codeResult.executionTime
          }
        : null
    });
  } catch (error) {
    console.error('Error enhancing OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get execution history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = codeInterpreterService.getExecutionHistory(limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error getting execution history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active executions
router.get('/active', (req, res) => {
  try {
    const activeExecutions = codeInterpreterService.getActiveExecutions();

    res.json({
      success: true,
      activeExecutions
    });
  } catch (error) {
    console.error('Error getting active executions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Terminate execution
router.post('/terminate/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const terminated = await codeInterpreterService.terminateExecution(executionId);

    res.json({
      success: true,
      terminated
    });
  } catch (error) {
    console.error('Error terminating execution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clean up sandbox
router.post('/cleanup', async (req, res) => {
  try {
    await codeInterpreterService.cleanupSandbox();

    res.json({
      success: true,
      message: 'Sandbox cleaned up successfully'
    });
  } catch (error) {
    console.error('Error cleaning up sandbox:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get code interpreter status
router.get('/status', (req, res) => {
  try {
    const activeExecutions = codeInterpreterService.getActiveExecutions();
    const history = codeInterpreterService.getExecutionHistory(5);

    res.json({
      success: true,
      status: {
        activeExecutions: activeExecutions.length,
        historyCount: history.length,
        sandboxInitialized: true,
        pythonAvailable: true // This could be checked dynamically
      }
    });
  } catch (error) {
    console.error('Error getting code interpreter status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
