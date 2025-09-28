const fs = require('fs').promises;
const path = require('path');

class PromptManager {
  constructor() {
    this.prompts = new Map();
    this.promptTemplates = new Map();
    this.contextualPrompts = new Map();
    this.industryPrompts = new Map();
    this.initializePrompts();
  }

  initializePrompts() {
    // Base System Prompts
    this.prompts.set('ignition-base', {
      name: 'Ignition Base System Prompt',
      category: 'system',
      prompt: `You are an expert Ignition HMI/SCADA system designer with deep knowledge of Inductive Automation Ignition 8.1+ platform. You specialize in creating industrial-grade Human Machine Interface (HMI) components that follow best practices for safety, usability, and performance.

Key Expertise:
- Ignition Perspective (modern web-based HMI)
- Ignition Vision (legacy desktop HMI)
- Industrial automation protocols (OPC-UA, Modbus, etc.)
- Tag database design and optimization
- Alarm management (ISA 18.2 standards)
- Security and user management
- Performance optimization
- Industrial safety standards (IEC 61511, ISA 84)

Component Guidelines:
- Use proper component naming: perspective.* for modern, vision.* for legacy
- Include proper tag bindings with format: {[provider]TagPath}
- Follow Ignition property structures and data types
- Implement proper error handling and validation
- Consider operator workflow and ergonomics
- Include appropriate styling and themes

Safety Requirements:
- All safety-critical operations must have confirmation dialogs
- Emergency stops must be clearly visible and accessible
- Implement proper alarm acknowledgment workflows
- Consider fail-safe states and redundancy
- Follow industrial color coding standards

Always provide complete, production-ready components with proper documentation.`
    });

    // OCR-specific prompts
    this.prompts.set('ocr-interpretation', {
      name: 'OCR Interpretation Prompt',
      category: 'ocr',
      prompt: `You are an expert in interpreting industrial drawings, P&ID diagrams, and technical documentation. You excel at understanding OCR results from industrial equipment drawings and converting them into appropriate Ignition HMI components.

OCR Analysis Guidelines:
- Analyze text confidence levels and prioritize high-confidence results
- Identify industrial equipment patterns (pumps, valves, tanks, sensors, etc.)
- Recognize equipment tags and naming conventions
- Understand piping and instrumentation symbols
- Interpret measurement units and specifications

Component Generation:
- Create appropriate Ignition components based on identified equipment
- Generate proper tag bindings for each component
- Include relevant properties (status, measurements, controls)
- Consider equipment relationships and process flow
- Add appropriate alarms and safety interlocks

Equipment Recognition Patterns:
- Pumps: P-, pump, centrifugal, positive displacement
- Valves: V-, valve, gate, ball, butterfly, control
- Tanks: T-, tank, vessel, storage, reactor
- Sensors: transmitter, indicator, switch, detector
- Motors: M-, motor, drive, actuator
- Instruments: gauge, meter, controller, recorder

Always provide detailed explanations of your interpretation process and component recommendations.`
    });

    // Industry-specific prompts
    this.industryPrompts.set('oil-gas', {
      name: 'Oil & Gas Industry Prompt',
      category: 'industry',
      prompt: `You are an expert in oil and gas industry automation with specialized knowledge of upstream, midstream, and downstream operations.

Industry-Specific Knowledge:
- Upstream: Drilling, production, wellhead control
- Midstream: Pipeline transportation, compression stations
- Downstream: Refining, petrochemical processing
- Safety systems: SIS, F&G, ESD systems
- Regulations: API, NORSOK, IEC 61508/61511

Equipment Expertise:
- Wellhead control systems and Christmas trees
- Separator vessels and process equipment
- Compressor stations and pipeline systems
- Distillation columns and heat exchangers
- Safety instrumented systems (SIS)
- Fire and gas detection systems

Component Considerations:
- Explosion-proof equipment classifications
- Hazardous area compliance (Zone/Division)
- Process safety management (PSM)
- Environmental monitoring and reporting
- Emergency shutdown sequences
- Leak detection and response systems

Generate components that comply with oil & gas industry standards and safety requirements.`
    });

    this.industryPrompts.set('manufacturing', {
      name: 'Manufacturing Industry Prompt',
      category: 'industry',
      prompt: `You are an expert in manufacturing automation with deep knowledge of discrete and continuous manufacturing processes.

Manufacturing Expertise:
- Discrete manufacturing: Assembly lines, robotics, quality control
- Continuous manufacturing: Batch processing, flow control
- Lean manufacturing principles and waste reduction
- Quality management systems (ISO 9001, Six Sigma)
- Predictive maintenance and condition monitoring
- Supply chain integration and MES connectivity

Equipment Knowledge:
- Conveyor systems and material handling
- Robotic work cells and automation
- CNC machines and machining centers
- Packaging and labeling equipment
- Environmental control systems
- Quality inspection and testing equipment

Component Focus:
- Production monitoring and KPI dashboards
- Equipment efficiency (OEE) tracking
- Quality control and SPC charts
- Maintenance scheduling and work orders
- Inventory management and tracking
- Operator guidance and work instructions

Create components that support lean manufacturing principles and continuous improvement.`
    });

    this.industryPrompts.set('water-treatment', {
      name: 'Water Treatment Industry Prompt',
      category: 'industry',
      prompt: `You are an expert in water and wastewater treatment systems with knowledge of municipal and industrial water treatment processes.

Treatment Process Knowledge:
- Water treatment: Coagulation, sedimentation, filtration, disinfection
- Wastewater treatment: Primary, secondary, tertiary treatment
- Advanced treatment: RO, UV, ozonation, membrane bioreactors
- Sludge handling and biogas recovery
- Chemical feed systems and dosing control
- Regulatory compliance (EPA, local regulations)

Equipment Expertise:
- Clarifiers and sedimentation tanks
- Filtration systems and backwash control
- Pump stations and lift stations
- Aeration systems and blowers
- Chemical feed pumps and mixers
- Monitoring and analytical equipment

Component Requirements:
- Process control loops and PID controllers
- Alarm management for process upsets
- Regulatory reporting and data logging
- Chemical inventory and safety systems
- Energy optimization and efficiency tracking
- Environmental monitoring and compliance

Generate components that ensure regulatory compliance and operational efficiency.`
    });

    // Component-specific prompt templates
    this.promptTemplates.set('component-generation', {
      name: 'Component Generation Template',
      template: `Generate an Ignition {componentType} component with the following specifications:

Component Requirements:
- Type: {componentType}
- Purpose: {purpose}
- Industry: {industry}
- Safety Level: {safetyLevel}

Technical Specifications:
- Size: {width}x{height} pixels
- Position: {x}, {y}
- Tag Bindings: {tagBindings}
- Properties: {properties}

Additional Context:
{additionalContext}

Provide a complete component definition with:
1. Component structure (type, position, size, props)
2. Tag binding recommendations
3. Safety considerations
4. Styling and visual design
5. Operational procedures and user interaction
6. Maintenance and troubleshooting notes

Component should follow Ignition 8.1+ standards and industry best practices.`
    });

    this.promptTemplates.set('component-analysis', {
      name: 'Component Analysis Template',
      template: `Analyze the following Ignition component for {analysisType} analysis:

Component Details:
{componentDetails}

Analysis Focus:
- {analysisType} evaluation
- Industry: {industry}
- Safety requirements: {safetyRequirements}
- Performance criteria: {performanceCriteria}

Provide detailed analysis including:
1. Current component assessment
2. Strengths and weaknesses
3. Improvement recommendations
4. Safety considerations
5. Performance optimization suggestions
6. Compliance with industry standards
7. Best practice recommendations

Include specific code examples and implementation guidance.`
    });

    // Contextual prompts for different scenarios
    this.contextualPrompts.set('emergency-response', {
      name: 'Emergency Response Context',
      context: `Emergency Response Context:
- Prioritize safety and emergency shutdown capabilities
- Ensure clear visual indicators for emergency states
- Implement redundant safety systems
- Provide clear operator guidance during emergencies
- Include automatic notification and logging systems
- Consider fail-safe operation modes
- Implement proper alarm escalation procedures`
    });

    this.contextualPrompts.set('maintenance-mode', {
      name: 'Maintenance Mode Context',
      context: `Maintenance Mode Context:
- Enable maintenance overrides and bypasses
- Provide detailed equipment status information
- Include maintenance scheduling and work orders
- Implement lockout/tagout (LOTO) procedures
- Show equipment history and maintenance logs
- Enable diagnostic and testing functions
- Provide spare parts and documentation access`
    });

    this.contextualPrompts.set('operator-training', {
      name: 'Operator Training Context',
      context: `Operator Training Context:
- Provide clear, intuitive user interfaces
- Include help text and operational guidance
- Implement progressive disclosure of information
- Use consistent visual design and interaction patterns
- Provide simulation and training modes
- Include procedure checklists and workflows
- Enable guided troubleshooting and diagnostics`
    });
  }

  // Get prompt by ID
  getPrompt(promptId) {
    return this.prompts.get(promptId);
  }

  // Get industry-specific prompt
  getIndustryPrompt(industry) {
    return this.industryPrompts.get(industry);
  }

  // Get contextual prompt
  getContextualPrompt(context) {
    return this.contextualPrompts.get(context);
  }

  // Build complete system prompt
  buildSystemPrompt(options = {}) {
    let systemPrompt = this.prompts.get('ignition-base').prompt;

    // Add industry-specific context
    if (options.industry) {
      const industryPrompt = this.industryPrompts.get(options.industry);
      if (industryPrompt) {
        systemPrompt += '\n\n' + industryPrompt.prompt;
      }
    }

    // Add contextual information
    if (options.context) {
      const contextPrompt = this.contextualPrompts.get(options.context);
      if (contextPrompt) {
        systemPrompt += '\n\n' + contextPrompt.context;
      }
    }

    // Add specific requirements
    if (options.requirements) {
      systemPrompt += '\n\nSpecific Requirements:\n' + options.requirements;
    }

    // Add safety level
    if (options.safetyLevel) {
      systemPrompt += '\n\nSafety Level: ' + options.safetyLevel;
      if (options.safetyLevel === 'critical') {
        systemPrompt +=
          '\n- All operations require confirmation dialogs\n- Implement redundant safety systems\n- Follow SIL 2/3 requirements';
      }
    }

    return systemPrompt;
  }

  // Generate prompt from template
  generateFromTemplate(templateId, variables = {}) {
    const template = this.promptTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let prompt = template.template;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      prompt = prompt.replace(regex, value || '');
    }

    return prompt;
  }

  // Enhanced OCR prompt generation
  buildOCRPrompt(ocrResults, imageContext = {}) {
    let prompt = this.prompts.get('ocr-interpretation').prompt;

    // Add OCR results context
    prompt += '\n\nOCR Results to Analyze:\n';
    prompt += JSON.stringify(ocrResults, null, 2);

    // Add image context
    if (imageContext.drawingType) {
      prompt += `\n\nDrawing Type: ${imageContext.drawingType}`;
    }
    if (imageContext.industry) {
      prompt += `\n\nIndustry Context: ${imageContext.industry}`;
    }
    if (imageContext.equipment) {
      prompt += `\n\nEquipment Context: ${imageContext.equipment}`;
    }
    if (imageContext.processArea) {
      prompt += `\n\nProcess Area: ${imageContext.processArea}`;
    }

    // Add specific instructions
    prompt += '\n\nPlease provide:\n';
    prompt += '1. Interpretation of OCR results\n';
    prompt += '2. Identified equipment and components\n';
    prompt += '3. Recommended Ignition components\n';
    prompt += '4. Tag binding suggestions\n';
    prompt += '5. Safety considerations\n';
    prompt += '6. Implementation notes\n';

    return prompt;
  }

  // Build component analysis prompt
  buildAnalysisPrompt(component, analysisType = 'general', context = {}) {
    const variables = {
      componentDetails: JSON.stringify(component, null, 2),
      analysisType: analysisType,
      industry: context.industry || 'General Industrial',
      safetyRequirements: context.safetyRequirements || 'Standard industrial safety',
      performanceCriteria: context.performanceCriteria || 'Standard performance requirements'
    };

    return this.generateFromTemplate('component-analysis', variables);
  }

  // Build component generation prompt
  buildGenerationPrompt(componentType, specifications = {}) {
    const variables = {
      componentType: componentType,
      purpose: specifications.purpose || 'General purpose component',
      industry: specifications.industry || 'General Industrial',
      safetyLevel: specifications.safetyLevel || 'standard',
      width: specifications.width || 200,
      height: specifications.height || 100,
      x: specifications.x || 0,
      y: specifications.y || 0,
      tagBindings: specifications.tagBindings || 'To be determined',
      properties: JSON.stringify(specifications.properties || {}, null, 2),
      additionalContext: specifications.additionalContext || 'No additional context provided'
    };

    return this.generateFromTemplate('component-generation', variables);
  }

  // Get all available prompts
  getAvailablePrompts() {
    return {
      system: Array.from(this.prompts.entries()).map(([id, prompt]) => ({
        id,
        name: prompt.name,
        category: prompt.category
      })),
      industry: Array.from(this.industryPrompts.entries()).map(([id, prompt]) => ({
        id,
        name: prompt.name,
        category: prompt.category
      })),
      contextual: Array.from(this.contextualPrompts.entries()).map(([id, prompt]) => ({
        id,
        name: prompt.name
      })),
      templates: Array.from(this.promptTemplates.entries()).map(([id, template]) => ({
        id,
        name: template.name
      }))
    };
  }

  // Add custom prompt
  addCustomPrompt(promptId, promptConfig) {
    this.prompts.set(promptId, promptConfig);
  }

  // Add custom industry prompt
  addIndustryPrompt(industryId, promptConfig) {
    this.industryPrompts.set(industryId, promptConfig);
  }

  // Add custom template
  addTemplate(templateId, templateConfig) {
    this.promptTemplates.set(templateId, templateConfig);
  }

  // Save prompts to file
  async savePromptsToFile(filePath) {
    const promptsData = {
      prompts: Object.fromEntries(this.prompts),
      industryPrompts: Object.fromEntries(this.industryPrompts),
      contextualPrompts: Object.fromEntries(this.contextualPrompts),
      promptTemplates: Object.fromEntries(this.promptTemplates)
    };

    await fs.writeFile(filePath, JSON.stringify(promptsData, null, 2));
  }

  // Load prompts from file
  async loadPromptsFromFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const promptsData = JSON.parse(data);

      if (promptsData.prompts) {
        this.prompts = new Map(Object.entries(promptsData.prompts));
      }
      if (promptsData.industryPrompts) {
        this.industryPrompts = new Map(Object.entries(promptsData.industryPrompts));
      }
      if (promptsData.contextualPrompts) {
        this.contextualPrompts = new Map(Object.entries(promptsData.contextualPrompts));
      }
      if (promptsData.promptTemplates) {
        this.promptTemplates = new Map(Object.entries(promptsData.promptTemplates));
      }
    } catch (error) {
      console.error('Error loading prompts from file:', error);
    }
  }

  // Get prompt statistics
  getPromptStats() {
    return {
      totalPrompts: this.prompts.size,
      industryPrompts: this.industryPrompts.size,
      contextualPrompts: this.contextualPrompts.size,
      templates: this.promptTemplates.size
    };
  }
}

module.exports = new PromptManager();
