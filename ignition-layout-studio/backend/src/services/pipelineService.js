const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const promptManager = require('./promptManager');

// Performance optimization configurations
const PERFORMANCE_SETTINGS = {
  // Reduced timeouts for faster response
  QUICK_TIMEOUT: 15000,    // 15 seconds for quick generation
  STANDARD_TIMEOUT: 30000,  // 30 seconds for complex generation
  EXTENDED_TIMEOUT: 45000,  // 45 seconds for advanced analysis
  
  // Parallel processing limits
  MAX_PARALLEL_REQUESTS: 3,
  MAX_RETRY_ATTEMPTS: 2,
  
  // Cache settings
  CACHE_DURATION: 300000,  // 5 minutes
  MAX_CACHE_SIZE: 1000
};

class PipelineService {
  constructor() {
    this.providers = new Map();
    this.pipelines = new Map();
    this.filters = new Map();
    this.cache = new Map();
    this.performanceMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      providerPerformance: new Map()
    };
    
    this.initializeProviders();
    this.initializeFilters();
    this.initializePipelines();
    
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  initializeProviders() {
    // OpenAI Provider
    this.providers.set('openai', {
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      headers: apiKey => ({
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }),
      transformRequest: (messages, model, options) => ({
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000,
        stream: options.stream || false
      }),
      transformResponse: response => {
        if (response.choices && response.choices[0]) {
          return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model
          };
        }
        return null;
      }
    });

    // Anthropic Provider
    this.providers.set('anthropic', {
      name: 'Anthropic',
      baseURL: 'https://api.anthropic.com/v1',
      models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
      headers: apiKey => ({
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }),
      transformRequest: (messages, model, options) => {
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');

        return {
          model,
          messages: userMessages,
          system: systemMessage?.content || '',
          max_tokens: options.max_tokens || 2000,
          temperature: options.temperature || 0.7
        };
      },
      transformResponse: response => {
        if (response.content && response.content[0]) {
          return {
            content: response.content[0].text,
            usage: response.usage,
            model: response.model
          };
        }
        return null;
      }
    });

    // Azure OpenAI Provider
    this.providers.set('azure', {
      name: 'Azure OpenAI',
      baseURL: null, // Set dynamically
      models: ['gpt-4', 'gpt-35-turbo'],
      headers: apiKey => ({
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }),
      transformRequest: (messages, model, options) => ({
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000
      }),
      transformResponse: response => {
        if (response.choices && response.choices[0]) {
          return {
            content: response.choices[0].message.content,
            usage: response.usage,
            model: response.model
          };
        }
        return null;
      }
    });

    // Google Gemini Provider
    this.providers.set('gemini', {
      name: 'Google Gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      headers: apiKey => ({
        'Content-Type': 'application/json'
      }),
      transformRequest: (messages, model, options) => {
        const contents = messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));

        return {
          contents,
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.max_tokens || 2000
          }
        };
      },
      transformResponse: response => {
        if (response.candidates && response.candidates[0]) {
          return {
            content: response.candidates[0].content.parts[0].text,
            usage: response.usageMetadata,
            model: 'gemini'
          };
        }
        return null;
      }
    });
  }

  initializeFilters() {
    // Ignition Validator Filter
    this.filters.set('ignition-validator', {
      name: 'Ignition Validator',
      type: 'pre-process',
      process: async (messages, context) => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          // Add Ignition-specific validation context
          const ignitionContext = `
                        Context: You are generating components for Inductive Automation Ignition 8.1+.
                        Requirements:
                        - Use proper Ignition component naming (perspective.* for modern, vision.* for legacy)
                        - Include proper tag bindings with format [default]Equipment/ComponentName/Property
                        - Ensure all properties are Ignition-compatible
                        - Follow industrial HMI best practices
                    `;

          lastMessage.content = ignitionContext + '\n\n' + lastMessage.content;
        }
        return messages;
      }
    });

    // Component Enhancer Filter
    this.filters.set('component-enhancer', {
      name: 'Component Enhancer',
      type: 'pre-process',
      process: async (messages, context) => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          // Add component enhancement context
          const enhancementContext = `
                        Enhancement Guidelines:
                        - Add appropriate alarms and safety interlocks
                        - Include status indicators and feedback
                        - Add tooltips and help text
                        - Consider operator workflow and ergonomics
                        - Include data logging and trending capabilities
                    `;

          lastMessage.content += '\n\n' + enhancementContext;
        }
        return messages;
      }
    });

    // Response Processor Filter
    this.filters.set('response-processor', {
      name: 'Response Processor',
      type: 'post-process',
      process: async (response, context) => {
        // Process and validate AI response
        if (response.content) {
          // Extract component definitions
          const componentMatches = response.content.match(/<component[^>]*>[\s\S]*?<\/component>/g);
          if (componentMatches) {
            context.extractedComponents = componentMatches
              .map(match => {
                try {
                  // Parse component XML/JSON
                  return this.parseComponentDefinition(match);
                } catch (error) {
                  console.error('Error parsing component:', error);
                  return null;
                }
              })
              .filter(Boolean);
          }
        }
        return response;
      }
    });

    // Error Handler Filter
    this.filters.set('error-handler', {
      name: 'Error Handler',
      type: 'error',
      process: async (error, context) => {
        console.error('Pipeline error:', error);

        // Attempt fallback to next provider
        if (context.providers && context.providers.length > 1) {
          const currentProvider = context.providers.shift();
          console.log(`Falling back from ${currentProvider} to ${context.providers[0]}`);
          return { fallback: true, nextProvider: context.providers[0] };
        }

        return {
          error: 'All providers failed',
          message: 'Unable to process request with any available AI provider'
        };
      }
    });
  }

  initializePipelines() {
    // Fast Component Generation Pipeline (optimized for speed)
    this.pipelines.set('ignition-component-fast', {
      name: 'Fast Ignition Component Generator',
      description: 'Generate components quickly with minimal processing',
      providers: ['openai', 'gemini'], // Fastest providers first
      filters: {
        'pre-process': ['component-enhancer'], // Minimal pre-processing
        'post-process': ['response-processor'], // Minimal post-processing
        error: ['error-handler']
      },
      systemPrompt: `You are an expert Ignition HMI component generator. Create components quickly and efficiently following Ignition 8.1+ standards.`,
      options: {
        temperature: 0.7,
        max_tokens: 1500, // Reduced for faster generation
        timeout: PERFORMANCE_SETTINGS.QUICK_TIMEOUT
      }
    });

    // Standard Component Generation Pipeline (balanced)
    this.pipelines.set('ignition-component', {
      name: 'Ignition Component Generator',
      description: 'Generate Ignition-compatible HMI components',
      providers: ['openai', 'anthropic', 'azure'],
      filters: {
        'pre-process': ['ignition-validator', 'component-enhancer'],
        'post-process': ['response-processor', 'component-validation'],
        error: ['error-handler']
      },
      systemPrompt: `You are an expert Ignition HMI component generator. Create industrial-grade components that follow Inductive Automation Ignition 8.1+ standards. Focus on safety, usability, and industrial best practices.`,
      options: {
        temperature: 0.7,
        max_tokens: 2000,
        timeout: PERFORMANCE_SETTINGS.STANDARD_TIMEOUT
      }
    });

    // Advanced Analysis Pipeline (comprehensive but slower)
    this.pipelines.set('advanced-analysis', {
      name: 'Advanced Component Analysis',
      description: 'Analyze and enhance existing components',
      providers: ['anthropic', 'openai'],
      filters: {
        'pre-process': ['ignition-validator'],
        'post-process': ['response-processor'],
        error: ['error-handler']
      },
      systemPrompt: `You are an expert in industrial automation and Ignition HMI design. Analyze the provided components and suggest improvements for safety, efficiency, and user experience.`,
      options: {
        temperature: 0.5,
        max_tokens: 3000,
        timeout: PERFORMANCE_SETTINGS.EXTENDED_TIMEOUT
      }
    });

    // OCR Enhancement Pipeline (optimized for OCR processing)
    this.pipelines.set('ocr-enhancement', {
      name: 'OCR Enhancement Pipeline',
      description: 'Enhance PaddleOCR results with AI interpretation',
      providers: ['gemini', 'openai'], // Gemini first for cost-effectiveness
      filters: {
        'pre-process': ['industrial-context'],
        'post-process': ['response-processor', 'component-validation'],
        error: ['error-handler']
      },
      systemPrompt: `You are an expert in interpreting industrial drawings and P&ID diagrams. Use the OCR text results to understand the industrial equipment and generate appropriate Ignition components.`,
      options: {
        temperature: 0.6,
        max_tokens: 2500,
        timeout: PERFORMANCE_SETTINGS.STANDARD_TIMEOUT
      }
    });
  }

  async executeRequest(providerId, messages, model, options = {}) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const apiKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      throw new Error(`API key not configured for provider ${providerId}`);
    }

    let baseURL = provider.baseURL;

    // Special handling for Azure
    if (providerId === 'azure') {
      const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
      if (!azureEndpoint || !deploymentName) {
        throw new Error('Azure endpoint or deployment name not configured');
      }
      baseURL = `${azureEndpoint}/openai/deployments/${deploymentName}`;
    }

    const requestData = provider.transformRequest(messages, model, options);
    const headers = provider.headers(apiKey);

    let endpoint = '/chat/completions';
    if (providerId === 'gemini') {
      endpoint = `/models/${model}:generateContent?key=${apiKey}`;
    }

    try {
      const response = await axios.post(`${baseURL}${endpoint}`, requestData, {
        headers,
        timeout: options.timeout || 30000
      });

      return provider.transformResponse(response.data);
    } catch (error) {
      console.error(`Error with provider ${providerId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async executePipeline(pipelineId, messages, options = {}) {
    const startTime = Date.now();
    const requestId = `${pipelineId}-${Date.now()}`;
    
    // Check cache first
    const cacheKey = this.generateCacheKey(pipelineId, messages, options);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PERFORMANCE_SETTINGS.CACHE_DURATION) {
      console.log(`Cache hit for ${pipelineId}`);
      return cached.result;
    }

    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const context = {
      pipelineId,
      requestId,
      providers: [...pipeline.providers],
      extractedComponents: [],
      metadata: { startTime }
    };

    let processedMessages = [...messages];

    // Add system prompt if not present
    if (!processedMessages.find(m => m.role === 'system')) {
      processedMessages.unshift({
        role: 'system',
        content: pipeline.systemPrompt
      });
    }

    // Apply pre-process filters (with performance monitoring)
    if (pipeline.filters['pre-process']) {
      for (const filterId of pipeline.filters['pre-process']) {
        const filter = this.filters.get(filterId);
        if (filter && filter.type === 'pre-process') {
          const filterStart = Date.now();
          processedMessages = await filter.process(processedMessages, context);
          console.log(`Filter ${filterId} took ${Date.now() - filterStart}ms`);
        }
      }
    }

    // Execute with optimized provider selection
    const selectedProviders = this.selectOptimalProviders(pipeline.providers, options);
    let lastError = null;
    
    for (const providerId of selectedProviders) {
      try {
        const provider = this.providers.get(providerId);
        const model = options.model || provider.models[0];
        const providerStart = Date.now();

        console.log(`Attempting ${providerId} for ${pipelineId}`);

        const response = await this.executeRequest(providerId, processedMessages, model, {
          ...pipeline.options,
          ...options,
          timeout: Math.min(pipeline.options.timeout, options.timeout || PERFORMANCE_SETTINGS.STANDARD_TIMEOUT)
        });

        // Track provider performance
        const providerTime = Date.now() - providerStart;
        this.updateProviderMetrics(providerId, providerTime, true);

        // Apply post-process filters
        let processedResponse = response;
        if (pipeline.filters['post-process']) {
          for (const filterId of pipeline.filters['post-process']) {
            const filter = this.filters.get(filterId);
            if (filter && filter.type === 'post-process') {
              processedResponse = await filter.process(processedResponse, context);
            }
          }
        }

        const result = {
          response: processedResponse,
          context,
          provider: providerId,
          model,
          performanceMetrics: {
            totalTime: Date.now() - startTime,
            providerTime,
            cacheHit: false
          }
        };

        // Cache the result
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });

        this.updateOverallMetrics(Date.now() - startTime, true);
        return result;
        
      } catch (error) {
        lastError = error;
        const providerTime = Date.now() - startTime;
        this.updateProviderMetrics(providerId, providerTime, false);
        
        console.error(`Provider ${providerId} failed (${providerTime}ms):`, error.message);

        // Apply error filters
        if (pipeline.filters['error']) {
          for (const filterId of pipeline.filters['error']) {
            const filter = this.filters.get(filterId);
            if (filter && filter.type === 'error') {
              const errorResult = await filter.process(error, context);
              if (errorResult.fallback) {
                continue; // Try next provider
              }
            }
          }
        }
      }
    }

    this.updateOverallMetrics(Date.now() - startTime, false);
    throw new Error(`All providers failed for ${pipelineId}. Last error: ${lastError?.message}`);
  }

  parseComponentDefinition(componentText) {
    // Parse component definition from AI response
    // This is a simplified parser - can be enhanced based on actual format
    try {
      // Look for JSON within the component text
      const jsonMatch = componentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON, create a basic structure
      return {
        type: 'unknown',
        content: componentText,
        parsed: false
      };
    } catch (error) {
      return {
        type: 'error',
        content: componentText,
        error: error.message
      };
    }
  }

  // Configuration methods
  addProvider(providerId, config) {
    this.providers.set(providerId, config);
  }

  addFilter(filterId, config) {
    this.filters.set(filterId, config);
  }

  addPipeline(pipelineId, config) {
    this.pipelines.set(pipelineId, config);
  }

  // Status methods
  getProviders() {
    return Array.from(this.providers.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      models: config.models,
      available: !!process.env[`${id.toUpperCase()}_API_KEY`]
    }));
  }

  getPipelines() {
    return Array.from(this.pipelines.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      description: config.description,
      providers: config.providers,
      filters: config.filters
    }));
  }

  getFilters() {
    return Array.from(this.filters.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.type
    }));
  }

  registerAdvancedFilters() {
    // This will be called after advancedFilters is initialized
    setTimeout(() => {
      try {
        const advancedFilters = require('./advancedFilters');
        advancedFilters.registerWithPipelineService();
      } catch (error) {
        console.error('Error registering advanced filters:', error);
      }
    }, 1000);
  }

  // Enhanced pipeline execution with prompt management
  async executePipelineWithPrompts(pipelineId, messages, options = {}) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    // Build enhanced system prompt
    const promptOptions = {
      industry: options.industry,
      context: options.context,
      safetyLevel: options.safetyLevel,
      requirements: options.requirements
    };

    const enhancedSystemPrompt = promptManager.buildSystemPrompt(promptOptions);

    // Update pipeline system prompt
    const enhancedPipeline = {
      ...pipeline,
      systemPrompt: enhancedSystemPrompt
    };

    // Execute with enhanced prompt
    return await this.executePipeline(pipelineId, messages, options);
  }

  // Select optimal providers based on performance history
  selectOptimalProviders(providers, options) {
    if (options.forceProvider) {
      return [options.forceProvider];
    }

    // Sort providers by performance metrics
    const sortedProviders = [...providers].sort((a, b) => {
      const metricsA = this.performanceMetrics.providerPerformance.get(a);
      const metricsB = this.performanceMetrics.providerPerformance.get(b);
      
      if (!metricsA) return 1;
      if (!metricsB) return -1;
      
      // Prefer providers with better success rate and faster response times
      const scoreA = (metricsA.successRate * 100) - (metricsA.averageResponseTime / 1000);
      const scoreB = (metricsB.successRate * 100) - (metricsB.averageResponseTime / 1000);
      
      return scoreB - scoreA;
    });

    return sortedProviders;
  }

  // Generate cache key for request
  generateCacheKey(pipelineId, messages, options) {
    const content = messages.map(m => m.content).join('|');
    const optionsStr = JSON.stringify(options);
    return `${pipelineId}:${this.hashString(content + optionsStr)}`;
  }

  // Simple hash function for cache keys
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Update provider performance metrics
  updateProviderMetrics(providerId, responseTime, success) {
    const metrics = this.performanceMetrics.providerPerformance.get(providerId) || {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      successRate: 0
    };

    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    }
    
    metrics.averageResponseTime = ((metrics.averageResponseTime * (metrics.totalRequests - 1)) + responseTime) / metrics.totalRequests;
    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;

    this.performanceMetrics.providerPerformance.set(providerId, metrics);
  }

  // Update overall performance metrics
  updateOverallMetrics(responseTime, success) {
    this.performanceMetrics.totalRequests++;
    if (success) {
      this.performanceMetrics.successfulRequests++;
    }
    
    this.performanceMetrics.averageResponseTime = 
      ((this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1)) + responseTime) / 
      this.performanceMetrics.totalRequests;
  }

  // Clean up expired cache entries
  cleanupCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > PERFORMANCE_SETTINGS.CACHE_DURATION) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    // Limit cache size
    if (this.cache.size > PERFORMANCE_SETTINGS.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      const toRemove = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, this.cache.size - PERFORMANCE_SETTINGS.MAX_CACHE_SIZE);
      
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      cacheStats: {
        size: this.cache.size,
        maxSize: PERFORMANCE_SETTINGS.MAX_CACHE_SIZE,
        hitRate: this.cacheHitRate || 0
      }
    };
  }
}

module.exports = new PipelineService();
