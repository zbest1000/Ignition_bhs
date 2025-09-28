const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const Project = require('../models/Project');
const Component = require('../models/Component');
const { v4: uuidv4 } = require('uuid');

// Generate component from text description
router.post('/generate-component/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { description, provider } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Generate component using AI
    const aiComponent = await aiService.generateComponentFromText(description, provider);

    // Create component in project
    const project = await Project.load(projectId);
    const newComponent = new Component({
      ...aiComponent,
      id: uuidv4()
    });

    project.addComponent(newComponent.toJSON());
    await project.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.to(projectId).emit('component-created', newComponent.toJSON());

    res.json({
      success: true,
      component: newComponent.toJSON(),
      aiGenerated: true
    });
  } catch (error) {
    console.error('AI component generation error:', error);
    res.status(500).json({
      error: 'Failed to generate component',
      message: error.message
    });
  }
});

// Classify existing component
router.post('/classify-component/:projectId/:componentId', async (req, res) => {
  try {
    const { projectId, componentId } = req.params;
    const { provider } = req.body;

    const project = await Project.load(projectId);
    const component = project.components.find(c => c.id === componentId);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const classification = await aiService.classifyComponent(component, provider);

    // Update component with classification
    component.metadata = {
      ...component.metadata,
      aiClassification: classification
    };

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('component-updated', component);

    res.json({
      success: true,
      classification,
      componentId
    });
  } catch (error) {
    console.error('AI classification error:', error);
    res.status(500).json({
      error: 'Failed to classify component',
      message: error.message
    });
  }
});

// Get smart suggestions for project
router.post('/suggestions/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { provider } = req.body;

    const project = await Project.load(projectId);

    const context = {
      projectName: project.name,
      componentCount: project.components.length,
      templateCount: project.templates.length,
      fileCount: project.files.length,
      componentTypes: [...new Set(project.components.map(c => c.type))],
      recentActivity: project.updatedAt
    };

    const suggestions = await aiService.generateSmartSuggestions(context, provider);

    res.json({
      success: true,
      suggestions,
      context
    });
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      message: error.message
    });
  }
});

// Batch classify components
router.post('/batch-classify/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { componentIds, provider } = req.body;

    if (!componentIds || !Array.isArray(componentIds)) {
      return res.status(400).json({ error: 'componentIds array is required' });
    }

    const project = await Project.load(projectId);
    const results = [];

    for (const componentId of componentIds) {
      const component = project.components.find(c => c.id === componentId);
      if (!component) {
        results.push({
          componentId,
          success: false,
          error: 'Component not found'
        });
        continue;
      }

      try {
        const classification = await aiService.classifyComponent(component, provider);

        component.metadata = {
          ...component.metadata,
          aiClassification: classification
        };

        results.push({
          componentId,
          success: true,
          classification
        });
      } catch (error) {
        results.push({
          componentId,
          success: false,
          error: error.message
        });
      }
    }

    await project.save();

    // Emit socket event for bulk update
    const io = req.app.get('io');
    io.to(projectId).emit(
      'components-bulk-updated',
      results.filter(r => r.success).map(r => project.components.find(c => c.id === r.componentId))
    );

    res.json({
      success: true,
      results,
      processed: results.length
    });
  } catch (error) {
    console.error('Batch classification error:', error);
    res.status(500).json({
      error: 'Failed to batch classify components',
      message: error.message
    });
  }
});

// Generate mock/example components for testing
router.post('/generate-examples/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { count = 5, category = 'mixed' } = req.body;

    const project = await Project.load(projectId);
    const examples = [];

    // Enhanced professional layouts based on industry standards
    if (category === 'mixed' || category === 'complete_system') {
      // Generate a complete industrial system layout like the SCADA examples
      const completeSystemLayout = await generateCompleteIndustrialSystem(projectId, aiService);
      examples.push(...completeSystemLayout);
    } else {
      // Original category-based generation for specific types
      const exampleDescriptions = {
        conveyor: [
          'A main conveyor belt 300x40 for baggage handling',
          'A sorting conveyor system 250x35 called Sort Line',
          'A curved conveyor belt 150x30 for direction change'
        ],
        motor: [
          'A drive motor 80x80 for main belt system',
          'A pump motor 60x60 for hydraulic system',
          'A fan motor 70x70 for cooling system'
        ],
        sensor: [
          'A baggage detector sensor 30x30 for presence detection',
          'A weight sensor 40x40 for load monitoring',
          'A barcode scanner 50x25 for identification'
        ]
      };

      const descriptions = exampleDescriptions[category] || [];
      const selectedDescriptions = descriptions.slice(0, Math.min(count, descriptions.length));

      for (const description of selectedDescriptions) {
        const aiComponent = await aiService.generateComponentFromText(description);
        const newComponent = new Component({
          ...aiComponent,
          id: uuidv4(),
          geometry: {
            ...aiComponent.geometry,
            x: Math.random() * 400 + 50,
            y: Math.random() * 300 + 50
          }
        });

        examples.push(newComponent.toJSON());
      }
    }

    // Add all components to project
    for (const example of examples) {
      project.addComponent(example);
    }

    await project.save();

    // Emit socket event
    const io = req.app.get('io');
    io.to(projectId).emit('components-bulk-updated', examples);

    res.json({
      success: true,
      examples,
      generated: examples.length
    });
  } catch (error) {
    console.error('Example generation error:', error);
    res.status(500).json({
      error: 'Failed to generate examples',
      message: error.message
    });
  }
});

// Generate complete industrial system layout (like airport baggage or manufacturing)
async function generateCompleteIndustrialSystem(projectId, aiService) {
  const examples = [];
  
  // Professional layout patterns based on SCADA examples
  const systemLayouts = [
    {
      name: 'Airport Baggage System',
      components: [
        // Main infeed line
        { desc: 'straight conveyor called TC1', x: 100, y: 200 },
        { desc: '90 degree curve conveyor', x: 300, y: 200 },
        { desc: 'straight conveyor', x: 400, y: 200 },
        
        // Sort lines with curves  
        { desc: '90 degree curve conveyor', x: 500, y: 200 },
        { desc: 'straight conveyor called SF1', x: 500, y: 100 },
        { desc: 'merge junction conveyor called OSR1', x: 600, y: 150 },
        
        // Secondary processing
        { desc: 'divert conveyor for sorting', x: 350, y: 300 },
        { desc: '45 degree curve conveyor', x: 450, y: 350 },
        { desc: 'straight conveyor called CL1', x: 550, y: 400 },
        { desc: '180 degree curve conveyor', x: 650, y: 400 },
        { desc: 'straight conveyor called CL2', x: 650, y: 300 },
        
        // Support equipment
        { desc: 'motor drive for main system', x: 150, y: 120 },
        { desc: 'sensor detector for baggage presence', x: 250, y: 180 },
        { desc: 'diverter gate for routing', x: 400, y: 280 },
        { desc: 'sortation system for packages', x: 500, y: 450 }
      ]
    },
    {
      name: 'Manufacturing Loop System', 
      components: [
        // Oval manufacturing line
        { desc: 'straight conveyor called Main Line', x: 200, y: 200 },
        { desc: '90 degree curve conveyor', x: 600, y: 200 },
        { desc: 'straight conveyor', x: 700, y: 300 },
        { desc: '90 degree curve conveyor', x: 700, y: 500 },
        { desc: 'straight conveyor', x: 600, y: 600 },
        { desc: '90 degree curve conveyor', x: 200, y: 600 },
        { desc: 'straight conveyor', x: 100, y: 500 },
        { desc: '90 degree curve conveyor', x: 100, y: 300 },
        
        // Operation stations
        { desc: 'motor station called Op1', x: 300, y: 180 },
        { desc: 'motor station called Op2', x: 500, y: 180 },
        { desc: 'motor station called Op3', x: 680, y: 400 },
        { desc: 'motor station called Op4', x: 400, y: 580 },
        
        // Sensors and controls
        { desc: 'sensor detector at station 1', x: 280, y: 160 },
        { desc: 'sensor detector at station 2', x: 480, y: 160 },
        { desc: 'sensor detector at station 3', x: 660, y: 380 },
        { desc: 'sensor detector at station 4', x: 380, y: 560 }
      ]
    }
  ];
  
  // Randomly select a layout or combine elements from both
  const selectedLayout = systemLayouts[Math.floor(Math.random() * systemLayouts.length)];
  
  console.log(`Generating ${selectedLayout.name} layout with ${selectedLayout.components.length} components`);
  
  for (const componentSpec of selectedLayout.components) {
    try {
      const aiComponent = await aiService.generateComponentFromText(componentSpec.desc);
      const newComponent = new Component({
        ...aiComponent,
        id: uuidv4(),
        geometry: {
          ...aiComponent.geometry,
          x: componentSpec.x,
          y: componentSpec.y,
          // Ensure proper alignment
          width: aiComponent.geometry.width,
          height: aiComponent.geometry.height
        },
        metadata: {
          ...aiComponent.metadata,
          systemLayout: selectedLayout.name,
          layoutGenerated: true
        }
      });
      
      examples.push(newComponent.toJSON());
    } catch (error) {
      console.error(`Failed to generate component: ${componentSpec.desc}`, error);
    }
  }
  
  return examples;
}

// Get AI service status and available providers
router.get('/status', async (req, res) => {
  try {
    const availableProviders = aiService.getAvailableProviders();
    const status = {
      mockMode: process.env.AI_MOCK_MODE === 'true',
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      availableProviders,
      providerStatus: {}
    };

    // Check each provider configuration
    for (const provider of ['openai', 'huggingface', 'claude']) {
      status.providerStatus[provider] = {
        configured: aiService.isProviderConfigured(provider),
        available: availableProviders.includes(provider)
      };
    }

    res.json(status);
  } catch (error) {
    console.error('AI status error:', error);
    res.status(500).json({
      error: 'Failed to get AI status',
      message: error.message
    });
  }
});

module.exports = router;
