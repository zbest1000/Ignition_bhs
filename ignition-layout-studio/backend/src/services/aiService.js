const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class AIService {
  constructor() {
    this.providers = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      },
      huggingface: {
        apiKey: process.env.HUGGINGFACE_API_KEY,
        baseURL: 'https://api-inference.huggingface.co/models',
        model: process.env.HUGGINGFACE_MODEL || 'microsoft/DialoGPT-medium'
      },
      claude: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
        model: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229'
      }
    };

    this.defaultProvider = process.env.AI_DEFAULT_PROVIDER || 'openai';
    this.enableMockMode = process.env.AI_MOCK_MODE === 'true';

    if (this.enableMockMode) {
      console.log('AI Service running in mock mode');
    }
  }

  async generateComponentFromText(description, provider = this.defaultProvider) {
    const startTime = Date.now();
    
    if (this.enableMockMode) {
      // Simulate realistic but fast response time for mock mode
      const mockDelay = Math.random() * 500 + 200; // 200-700ms delay
      await new Promise(resolve => setTimeout(resolve, mockDelay));
      
      const result = this.mockGenerateComponent(description);
      console.log(`Mock component generated in ${Date.now() - startTime}ms`);
      return result;
    }

    try {
      const prompt = this.buildComponentPrompt(description);
      const response = await this.callAI(prompt, provider);
      const result = this.parseComponentResponse(response, description);
      
      console.log(`AI component generated in ${Date.now() - startTime}ms using ${provider}`);
      return result;
    } catch (error) {
      console.error(`AI component generation failed after ${Date.now() - startTime}ms:`, error);
      
      // Fast fallback to mock generation
      const mockResult = this.mockGenerateComponent(description);
      console.log(`Fallback to mock component generated in ${Date.now() - startTime}ms`);
      return mockResult;
    }
  }

  async classifyComponent(componentData, provider = this.defaultProvider) {
    if (this.enableMockMode) {
      return this.mockClassifyComponent(componentData);
    }

    try {
      const prompt = this.buildClassificationPrompt(componentData);
      const response = await this.callAI(prompt, provider);
      return this.parseClassificationResponse(response);
    } catch (error) {
      console.error('AI classification failed:', error);
      return this.mockClassifyComponent(componentData);
    }
  }

  async generateSmartSuggestions(context, provider = this.defaultProvider) {
    if (this.enableMockMode) {
      return this.mockGenerateSuggestions(context);
    }

    try {
      const prompt = this.buildSuggestionsPrompt(context);
      const response = await this.callAI(prompt, provider);
      return this.parseSuggestionsResponse(response);
    } catch (error) {
      console.error('AI suggestions failed:', error);
      return this.mockGenerateSuggestions(context);
    }
  }

  async callAI(prompt, provider = this.defaultProvider) {
    const startTime = Date.now();
    
    try {
      const config = this.providers[provider];
      if (!config || !config.apiKey) {
        throw new Error(`Provider ${provider} not configured`);
      }

      let response;
      const timeout = 20000; // Reduced from 30000 to 20000ms for faster failures

      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(prompt, config, timeout);
          break;
        case 'claude':
          response = await this.callClaude(prompt, config, timeout);
          break;
        case 'huggingface':
          response = await this.callHuggingFace(prompt, config, timeout);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      console.log(`AI call to ${provider} completed in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      console.error(`AI call to ${provider} failed after ${Date.now() - startTime}ms:`, error.message);
      throw error;
    }
  }

  async callOpenAI(prompt, config, timeout = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(
        `${config.baseURL}/chat/completions`,
        {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500, // Reduced from 1000 for better responses but still fast
          temperature: 0.7,
          stream: false
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return response.data.choices[0].message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
        throw new Error(`OpenAI request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  async callClaude(prompt, config, timeout = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(
        `${config.baseURL}/messages`,
        {
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.7
        },
        {
          headers: {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: timeout,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return response.data.content[0].text;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
        throw new Error(`Claude request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  async callHuggingFace(prompt, config, timeout = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(
        `${config.baseURL}/${config.model}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 1500,
            temperature: 0.7,
            return_full_text: false
          }
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: timeout,
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return response.data[0].generated_text;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.code === 'ECONNABORTED' || error.name === 'AbortError') {
        throw new Error(`HuggingFace request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  buildComponentPrompt(description) {
    return `You are an expert in Ignition 8.1+ SCADA systems by Inductive Automation. Based on the following description, generate a JSON object for an Ignition 8.1+ compatible component.

Description: "${description}"

Please respond with a JSON object containing:
- type: component type using Ignition 8.1+ naming (perspective.*, vision.*, or industrial.*)
- label: descriptive label
- equipmentId: unique equipment identifier following Ignition naming conventions
- geometry: {x, y, width, height, rotation, scale}
- style: {fill, stroke, strokeWidth, opacity, visible, locked}
- properties: relevant properties for the component
- ignitionProperties: {
    name: string (component name for Ignition),
    enabled: boolean,
    visible: boolean,
    quality: "Good" | "Bad" | "Uncertain",
    perspective: {
      position: {x, y, width, height},
      style: {backgroundColor, borderColor, borderWidth, etc.},
      props: {component-specific properties},
      events: {onActionPerformed, onMouseClick, etc.}
    },
    tagBindings: {
      [propertyName]: {
        tagPath: string (format: [default]Equipment/ComponentName/Property),
        bidirectional: boolean,
        writeMode: "direct" | "indirect"
      }
    },
    security: {
      roles: string[] (optional security roles),
      zones: string[] (optional security zones)
    }
  }

Component Type Guidelines:
- Use "perspective.*" for modern Ignition 8.1+ Perspective components
- Use "vision.*" for legacy Vision components (if specifically requested)
- Use "industrial.*" for custom industrial equipment components
- Common Perspective types: label, button, led-display, gauge, chart, table, container, etc.
- Industrial types: conveyor, motor, pump, valve, sensor, etc.

Tag Path Format:
- Use standard Ignition tag path format: [default]Equipment/AreaName/ComponentName/PropertyName
- Example: [default]Equipment/Conveyor/MainBelt/Running

Make sure the component follows Ignition 8.1+ standards and is suitable for industrial automation.

Respond with only the JSON object, no additional text.`;
  }

  buildClassificationPrompt(componentData) {
    return `Classify this industrial component for Ignition SCADA system:

Component Data: ${JSON.stringify(componentData, null, 2)}

Classify into one of these categories:
- Conveyor Systems
- Motors & Drives
- Sensors & Detectors
- Valves & Actuators
- Tanks & Vessels
- Control Panels
- Safety Systems
- Other

Respond with only the category name.`;
  }

  buildSuggestionsPrompt(context) {
    return `Based on this Ignition project context, provide smart suggestions:

Context: ${JSON.stringify(context, null, 2)}

Provide 3-5 suggestions for:
1. Component improvements
2. Tag binding optimizations
3. Template opportunities
4. Ignition 8.1+ best practices

Respond with a JSON array of suggestion objects with 'type', 'title', and 'description' fields.`;
  }

  parseComponentResponse(response, originalDescription) {
    try {
      const parsed = JSON.parse(response);
      return {
        ...parsed,
        metadata: {
          ...parsed.metadata,
          source: 'ai-generated',
          originalDescription,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.mockGenerateComponent(originalDescription);
    }
  }

  parseClassificationResponse(response) {
    return {
      category: response.trim(),
      confidence: 0.8,
      generatedAt: new Date().toISOString()
    };
  }

  parseSuggestionsResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI suggestions:', error);
      return this.mockGenerateSuggestions({});
    }
  }

  mockGenerateComponent(description) {
    // Optimized mock generation with pre-computed templates
    const mockTemplates = this.getMockTemplates();
    
    // Quick keyword matching for component type
    const descLower = description.toLowerCase();
    let componentType = 'generic';
    let template = mockTemplates.generic;
    
    // Fast lookup using regex patterns
    for (const [type, pattern] of Object.entries(this.componentPatterns)) {
      if (pattern.test(descLower)) {
        componentType = type;
        template = mockTemplates[type] || mockTemplates.generic;
        break;
      }
    }

    const equipmentId = this.generateEquipmentId(description, componentType);
    const label = this.extractLabel(description) || template.defaultLabel;
    const color = template.color;
    const width = template.width;
    const height = template.height;
    const rotation = template.rotation || 0;
    const animation = template.animation || false;
    const tagPath = `[default]Equipment/${equipmentId}`;
    const ignitionName = `${componentType}_${equipmentId}`;

    return {
      type: componentType,
      label,
      equipmentId,
      geometry: {
        x: Math.random() * 200 + 50,
        y: Math.random() * 200 + 50,
        width,
        height,
        rotation,
        scale: 1
      },
      style: {
        fill: color,
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
        visible: true,
        locked: false,
        animation: animation
      },
      properties: {
        description,
        createdBy: 'ai-mock',
        generatedAt: Date.now()
      },
      ignitionProperties: {
        name: ignitionName,
        enabled: true,
        visible: true,
        quality: 'Good',
        perspective: {
          position: {
            x: Math.random() * 200 + 50,
            y: Math.random() * 200 + 50,
            width,
            height,
            rotation
          },
          style: {
            backgroundColor: color,
            borderColor: '#000000',
            borderWidth: 2,
            borderRadius: componentType.includes('button') ? 4 : 0,
            opacity: 1,
            animation: {
              enabled: animation,
              type: componentType.includes('conveyor') ? 'flow' : 'blink',
              speed: 1.0,
              direction: componentType.includes('conveyor') ? 'forward' : 'none'
            }
          },
          props: {
            text: componentType.includes('button') || componentType.includes('label') ? label : undefined,
            enabled: true,
            visible: true,
            rotation,
            animation: animation
          },
          events: {
            onActionPerformed: componentType.includes('button') ? 'system.perspective.print("Button clicked")' : undefined,
            onMouseClick: 'system.perspective.print("Component clicked")',
            onPropertyChange: {
              running: componentType.includes('conveyor') ? 'if value then self.style.animation.enabled = true else self.style.animation.enabled = false' : undefined
            }
          }
        },
        vision: {
          component: componentType.includes('conveyor') ? 'Conveyor' : 
                    componentType.includes('motor') ? 'Motor' :
                    componentType.includes('sensor') ? 'Indicator Light' : 'Rectangle',
          properties: {
            background: color,
            border: '#000000',
            width,
            height,
            rotation,
            animationEnabled: animation,
            blinkRate: animation ? 500 : 0
          }
        },
        tagBindings: template.tagBindings(tagPath),
        security: {
          roles: ['Operator', 'Engineer'],
          zones: ['Production']
        }
      },
      metadata: {
        source: 'ai-mock',
        originalDescription: description,
        generatedAt: new Date().toISOString(),
        ignitionVersion: '8.1+',
        componentCategory: componentType.split('.')[0],
        generationType: 'fast-mock'
      }
    };
  }

  mockClassifyComponent(componentData) {
    const type = componentData.type || 'unknown';
    const categories = {
      conveyor: 'Conveyor Systems',
      motor: 'Motors & Drives',
      sensor: 'Sensors & Detectors',
      valve: 'Valves & Actuators',
      tank: 'Tanks & Vessels'
    };

    return {
      category: categories[type] || 'Other',
      confidence: 0.9,
      generatedAt: new Date().toISOString()
    };
  }

  mockGenerateSuggestions(context) {
    return [
      {
        type: 'component',
        title: 'Add Status Indicators',
        description: 'Consider adding status indicator components for better monitoring'
      },
      {
        type: 'tags',
        title: 'Optimize Tag Structure',
        description: 'Group related tags under equipment folders for better organization'
      },
      {
        type: 'template',
        title: 'Create Reusable Templates',
        description: 'Convert common component groups into templates for consistency'
      },
      {
        type: 'ignition',
        title: 'Use Perspective Components',
        description: 'Leverage Ignition 8.1+ Perspective components for modern UI'
      }
    ];
  }

  isProviderConfigured(provider) {
    const config = this.providers[provider];
    return config && config.apiKey;
  }

  getAvailableProviders() {
    return Object.keys(this.providers).filter(provider => this.isProviderConfigured(provider));
  }

  // Pre-computed component patterns for faster lookup
  get componentPatterns() {
    return {
      'straight_conveyor': /(?:straight|linear)\s*conveyor|belt|line(?!\s*(?:45|90|180|curve))/,
      'curve_45_conveyor': /45\s*(?:degree|deg|°)?\s*(?:curve|turn|corner|conveyor)/,
      'curve_90_conveyor': /90\s*(?:degree|deg|°)?\s*(?:curve|turn|corner|conveyor)|right\s*angle\s*conveyor/,
      'curve_180_conveyor': /180\s*(?:degree|deg|°)?\s*(?:curve|turn|corner|conveyor)|u\s*turn\s*conveyor/,
      'angled_conveyor': /angled?\s*conveyor|inclined?\s*conveyor|sloped?\s*conveyor/,
      'merge_conveyor': /merge|junction|confluence|combining\s*conveyor/,
      'divert_conveyor': /divert|split|branch|sorting\s*conveyor/,
      'motor': /motor|drive|pump/,
      'sensor': /sensor|detector|scanner|eye|photo/,
      'diverter': /diverter|gate|switch|blade/,
      'scale': /scale|weight|weigh/,
      'label': /label|display|indicator|text/,
      'button': /button|control|switch|push/,
      'tank': /tank|vessel|container|hopper/,
      'valve': /valve|actuator/,
      'sortation': /sort|sorting|tilt\s*tray|cross\s*belt/,
      'accumulation': /accumulation|accumulating|zero\s*pressure/
    };
  }

  // Mock templates for fast generation
  getMockTemplates() {
    return {
      generic: {
        color: '#cccccc',
        width: 100,
        height: 50,
        defaultLabel: 'Component',
        rotation: 0,
        animation: false,
        tagBindings: (tagPath) => ({
          value: { tagPath: `${tagPath}/Value`, bidirectional: false, writeMode: 'direct' }
        })
      },
      straight_conveyor: {
        color: '#90EE90',
        width: 200,
        height: 30,
        defaultLabel: 'Straight Conveyor',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          direction: { tagPath: `${tagPath}/Direction`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      curve_45_conveyor: {
        color: '#7FFF7F',
        width: 150,
        height: 150,
        defaultLabel: '45° Curve',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          direction: { tagPath: `${tagPath}/Direction`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      curve_90_conveyor: {
        color: '#6FEE6F',
        width: 120,
        height: 120,
        defaultLabel: '90° Curve',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          direction: { tagPath: `${tagPath}/Direction`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      curve_180_conveyor: {
        color: '#5FDD5F',
        width: 180,
        height: 90,
        defaultLabel: '180° Curve',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          direction: { tagPath: `${tagPath}/Direction`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      angled_conveyor: {
        color: '#9ACD32',
        width: 200,
        height: 40,
        defaultLabel: 'Angled Conveyor',
        rotation: 15,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          elevation: { tagPath: `${tagPath}/Elevation`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      merge_conveyor: {
        color: '#FFD700',
        width: 150,
        height: 100,
        defaultLabel: 'Merge Conveyor',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          inflow1: { tagPath: `${tagPath}/Inflow1`, bidirectional: false, writeMode: 'direct' },
          inflow2: { tagPath: `${tagPath}/Inflow2`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      divert_conveyor: {
        color: '#FFA500',
        width: 150,
        height: 100,
        defaultLabel: 'Divert Conveyor',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          divert_position: { tagPath: `${tagPath}/DivertPosition`, bidirectional: true, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      sortation: {
        color: '#FF6347',
        width: 180,
        height: 60,
        defaultLabel: 'Sortation',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          sort_code: { tagPath: `${tagPath}/SortCode`, bidirectional: false, writeMode: 'direct' },
          tilt_position: { tagPath: `${tagPath}/TiltPosition`, bidirectional: true, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      accumulation: {
        color: '#98FB98',
        width: 200,
        height: 35,
        defaultLabel: 'Accumulation',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          accumulating: { tagPath: `${tagPath}/Accumulating`, bidirectional: false, writeMode: 'direct' },
          pressure: { tagPath: `${tagPath}/Pressure`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      motor: {
        color: '#FFB6C1',
        width: 60,
        height: 60,
        defaultLabel: 'Motor',
        rotation: 0,
        animation: false,
        tagBindings: (tagPath) => ({
          running: { tagPath: `${tagPath}/Running`, bidirectional: false, writeMode: 'direct' },
          speed: { tagPath: `${tagPath}/Speed`, bidirectional: false, writeMode: 'direct' },
          current: { tagPath: `${tagPath}/Current`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      },
      sensor: {
        color: '#87CEEB',
        width: 30,
        height: 30,
        defaultLabel: 'Sensor',
        rotation: 0,
        animation: true,
        tagBindings: (tagPath) => ({
          value: { tagPath: `${tagPath}/Value`, bidirectional: false, writeMode: 'direct' },
          blocked: { tagPath: `${tagPath}/Blocked`, bidirectional: false, writeMode: 'direct' },
          alarm: { tagPath: `${tagPath}/Alarm`, bidirectional: false, writeMode: 'direct' }
        })
      }
    };
  }

  // Fast equipment ID generation
  generateEquipmentId(description, componentType) {
    const words = description.split(' ').filter(w => w.length > 2);
    const prefix = componentType.substring(0, 3).toUpperCase();
    const suffix = words.length > 0 ? words[0].substring(0, 3).toUpperCase() : 'GEN';
    const id = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}_${suffix}_${id}`;
  }

  // Extract label from description
  extractLabel(description) {
    const labelPatterns = [
      /called\s+["\']([^"']+)["\']/, // "called 'Main Belt'"
      /named\s+["\']([^"']+)["\']/, // "named 'Sort Line'"
      /["\']([^"']+)["\']/, // Any quoted text
    ];
    
    for (const pattern of labelPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
}

module.exports = new AIService();
