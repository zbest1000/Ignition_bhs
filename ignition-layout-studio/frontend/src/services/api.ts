import axios, { AxiosInstance } from 'axios';
import { Project, Component, Template, FileInfo, ExportOptions, OCRResult } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors if needed
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error);
        
        // Enhance error with detailed backend information
        if (error.response?.data) {
          const errorData = error.response.data;
          
          // Create a more descriptive error message
          let enhancedMessage = error.message;
          
          if (errorData.error) {
            enhancedMessage = errorData.error;
          } else if (errorData.message) {
            enhancedMessage = errorData.message;
          }
          
          // Add specific error details if available
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            enhancedMessage = errorData.errors.join('; ');
          }
          
          // Create enhanced error object with original data preserved
          const enhancedError = {
            ...error,
            message: enhancedMessage,
            response: {
              ...error.response,
              data: errorData
            }
          };
          
          return Promise.reject(enhancedError);
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Performance monitoring
  private performanceMetrics = {
    totalRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
    endpointMetrics: new Map<string, { calls: number; totalTime: number; errors: number }>()
  };

  // Track API performance
  private trackPerformance(endpoint: string, startTime: number, success: boolean) {
    const responseTime = Date.now() - startTime;
    
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.averageResponseTime = 
      ((this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalRequests - 1)) + responseTime) / 
      this.performanceMetrics.totalRequests;
    
    if (!success) {
      this.performanceMetrics.errorRate = 
        (this.performanceMetrics.errorRate * (this.performanceMetrics.totalRequests - 1) + 1) / 
        this.performanceMetrics.totalRequests;
    }
    
    const endpointMetric = this.performanceMetrics.endpointMetrics.get(endpoint) || { calls: 0, totalTime: 0, errors: 0 };
    endpointMetric.calls++;
    endpointMetric.totalTime += responseTime;
    if (!success) endpointMetric.errors++;
    
    this.performanceMetrics.endpointMetrics.set(endpoint, endpointMetric);
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      endpointMetrics: Array.from(this.performanceMetrics.endpointMetrics.entries()).map(([endpoint, metrics]) => ({
        endpoint,
        ...metrics,
        averageResponseTime: metrics.totalTime / metrics.calls,
        errorRate: metrics.errors / metrics.calls
      }))
    };
  }

  // Project endpoints
  async getProjects(): Promise<Project[]> {
    const response = await this.api.get('/projects');
    return response.data;
  }

  async getProject(id: string): Promise<Project> {
    const response = await this.api.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: { name: string; description?: string }): Promise<Project> {
    const response = await this.api.post('/projects', data);
    return response.data;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const response = await this.api.put(`/projects/${id}`, updates);
    return response.data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.api.delete(`/projects/${id}`);
  }

  async cloneProject(id: string, name?: string): Promise<Project> {
    const response = await this.api.post(`/projects/${id}/clone`, { name });
    return response.data;
  }

  async getProjectStats(id: string): Promise<any> {
    const response = await this.api.get(`/projects/${id}/stats`);
    return response.data;
  }

  // File upload endpoints
  async getSupportedFormats(): Promise<any> {
    const response = await this.api.get('/upload/formats');
    return response.data;
  }

  async validateFiles(files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.api.post('/upload/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadFiles(
    projectId: string,
    files: File[]
  ): Promise<{ files: FileInfo[]; warnings?: string[] }> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.api.post(`/upload/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.api.delete(`/upload/${projectId}/${fileId}`);
  }

  async getFileInfo(projectId: string, fileId: string): Promise<FileInfo> {
    const response = await this.api.get(`/upload/${projectId}/${fileId}`);
    return response.data;
  }

  // OCR endpoints
  async processOCR(projectId: string, fileId: string, options?: any): Promise<OCRResult> {
    const response = await this.api.post(`/ocr/process/${projectId}/${fileId}`, { options });
    return response.data;
  }

  async getOCRResults(projectId: string, fileId: string): Promise<any> {
    const response = await this.api.get(`/ocr/results/${projectId}/${fileId}`);
    return response.data;
  }

  async batchOCR(projectId: string, fileIds: string[], options?: any): Promise<any> {
    const response = await this.api.post(`/ocr/batch/${projectId}`, { fileIds, options });
    return response.data;
  }

  // Component endpoints
  async getComponents(projectId: string): Promise<Component[]> {
    const response = await this.api.get(`/components/${projectId}`);
    return response.data;
  }

  async createComponent(projectId: string, component: Partial<Component>): Promise<Component> {
    const response = await this.api.post(`/components/${projectId}`, component);
    return response.data;
  }

  async updateComponent(
    projectId: string,
    componentId: string,
    updates: Partial<Component>
  ): Promise<Component> {
    const response = await this.api.put(`/components/${projectId}/${componentId}`, updates);
    return response.data;
  }

  async deleteComponent(projectId: string, componentId: string): Promise<void> {
    await this.api.delete(`/components/${projectId}/${componentId}`);
  }

  async bulkUpdateComponents(
    projectId: string,
    componentIds: string[],
    updates: Partial<Component>
  ): Promise<any> {
    const response = await this.api.put(`/components/${projectId}/bulk`, { componentIds, updates });
    return response.data;
  }

  async groupComponents(
    projectId: string,
    componentIds: string[],
    groupName?: string,
    templateId?: string
  ): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/group`, {
      componentIds,
      groupName,
      templateId,
    });
    return response.data;
  }

  async ungroupComponents(projectId: string, groupId: string): Promise<any> {
    const response = await this.api.delete(`/components/${projectId}/group/${groupId}`);
    return response.data;
  }

  async cloneComponents(
    projectId: string,
    componentIds: string[],
    offset?: { x: number; y: number }
  ): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/clone`, {
      componentIds,
      offset,
    });
    return response.data;
  }

  async alignComponents(
    projectId: string,
    componentIds: string[],
    alignment: 'horizontal' | 'vertical',
    spacing?: number
  ): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/align`, {
      componentIds,
      alignment,
      spacing,
    });
    return response.data;
  }

  // Template endpoints
  async getTemplates(projectId: string): Promise<Template[]> {
    const response = await this.api.get(`/templates/${projectId}`);
    return response.data;
  }

  async createTemplate(projectId: string, template: Partial<Template>): Promise<Template> {
    const response = await this.api.post(`/templates/${projectId}`, template);
    return response.data;
  }

  async createTemplateFromComponents(
    projectId: string,
    componentIds: string[],
    templateName?: string,
    category?: string,
    description?: string
  ): Promise<any> {
    const response = await this.api.post(`/templates/${projectId}/from-components`, {
      componentIds,
      templateName,
      category,
      description,
    });
    return response.data;
  }

  async updateTemplate(
    projectId: string,
    templateId: string,
    updates: Partial<Template>
  ): Promise<Template> {
    const response = await this.api.put(`/templates/${projectId}/${templateId}`, updates);
    return response.data;
  }

  async deleteTemplate(projectId: string, templateId: string): Promise<void> {
    await this.api.delete(`/templates/${projectId}/${templateId}`);
  }

  async cloneTemplate(projectId: string, templateId: string, name?: string): Promise<Template> {
    const response = await this.api.post(`/templates/${projectId}/${templateId}/clone`, { name });
    return response.data;
  }

  async applyTemplate(projectId: string, templateId: string, componentIds: string[]): Promise<any> {
    const response = await this.api.post(`/templates/${projectId}/${templateId}/apply`, {
      componentIds,
    });
    return response.data;
  }

  async getTemplatePreview(
    projectId: string,
    templateId: string,
    width?: number,
    height?: number
  ): Promise<string> {
    const params = new URLSearchParams();
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());

    const url = `/templates/${projectId}/${templateId}/preview?${params.toString()}`;
    return `${API_BASE_URL}${url}`;
  }

  // Export endpoints
  async exportSVG(
    projectId: string,
    includeLabels?: boolean,
    includeGrid?: boolean
  ): Promise<Blob> {
    const response = await this.api.get(`/export/${projectId}/svg`, {
      params: { includeLabels, includeGrid },
      responseType: 'blob',
    });
    return response.data;
  }

  async exportPerspective(
    projectId: string,
    viewName?: string,
    includeTemplates?: boolean
  ): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/perspective`, {
      viewName,
      includeTemplates,
    });
    return response.data;
  }

  async exportVision(
    projectId: string,
    windowName?: string,
    includeTemplates?: boolean
  ): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/vision`, {
      windowName,
      includeTemplates,
    });
    return response.data;
  }

  async exportPackage(projectId: string, options: ExportOptions): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/package`, options);
    return response.data;
  }

  async downloadExport(projectId: string, exportId: string): Promise<void> {
    const response = await this.api.get(`/export/${projectId}/download/${exportId}`, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export-${exportId}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async getExportHistory(projectId: string): Promise<any[]> {
    const response = await this.api.get(`/export/${projectId}/history`);
    return response.data;
  }

  // AI endpoints (optimized for performance)
  async generateComponentFromText(
    projectId: string,
    description: string,
    provider?: string
  ): Promise<Component> {
    const startTime = Date.now();
    const endpoint = 'generateComponentFromText';
    
    try {
      // Validate inputs
      if (!description.trim()) {
        throw new Error('Description cannot be empty');
      }
      
      const response = await this.api.post(`/ai/generate-component/${projectId}`, {
        description: description.trim(),
        provider,
      });
      
      this.trackPerformance(endpoint, startTime, true);
      console.log(`Basic AI generation completed in ${Date.now() - startTime}ms`);
      
      return response.data.component;
    } catch (error) {
      this.trackPerformance(endpoint, startTime, false);
      throw error;
    }
  }

  async classifyComponent(projectId: string, componentId: string, provider?: string): Promise<any> {
    const response = await this.api.post(`/ai/classify-component/${projectId}/${componentId}`, {
      provider,
    });
    return response.data.classification;
  }

  async getSmartSuggestions(projectId: string, provider?: string): Promise<any[]> {
    const response = await this.api.post(`/ai/suggestions/${projectId}`, {
      provider,
    });
    return response.data.suggestions;
  }

  async batchClassifyComponents(
    projectId: string,
    componentIds: string[],
    provider?: string
  ): Promise<any> {
    const response = await this.api.post(`/ai/batch-classify/${projectId}`, {
      componentIds,
      provider,
    });
    return response.data.results;
  }

  async generateExampleComponents(
    projectId: string,
    count?: number,
    category?: string
  ): Promise<Component[]> {
    const response = await this.api.post(`/ai/generate-examples/${projectId}`, {
      count,
      category,
    });
    return response.data.examples;
  }

  async getAIStatus(): Promise<any> {
    const response = await this.api.get('/ai/status');
    return response.data;
  }

  // Pipeline Integration Methods
  async getAvailablePipelines(): Promise<any> {
    const response = await this.api.get('/pipeline/pipelines');
    return response.data;
  }

  async getAvailableProviders(): Promise<any> {
    const response = await this.api.get('/pipeline/providers');
    return response.data;
  }

  async executePipeline(pipelineId: string, messages: any[], options: any = {}): Promise<any> {
    const response = await this.api.post('/pipeline/execute', { pipelineId, messages, options });
    return response.data;
  }

  async generateComponentWithPipeline(
    description: string,
    pipelineId: string = 'ignition-component-fast',
    context: any = {},
    options: any = {}
  ): Promise<any> {
    const startTime = Date.now();
    const endpoint = 'generateComponentWithPipeline';
    
    try {
      // Validate inputs
      if (!description.trim()) {
        throw new Error('Description cannot be empty');
      }
      
      // Optimize context for performance
      const optimizedContext = {
        ...context,
        // Limit existing components to avoid large payloads
        existingComponents: context.existingComponents ? 
          context.existingComponents.slice(0, 10) : undefined,
        // Truncate OCR results to prevent timeout
        ocrResults: context.ocrResults ? 
          context.ocrResults.substring(0, 1000) : undefined
      };
      
      // Set appropriate timeout based on pipeline
      const timeoutMs = pipelineId === 'ignition-component-fast' ? 20000 : 35000;
      
      const response = await this.api.post('/pipeline/generate-component', {
        description: description.trim(),
        pipelineId,
        context: optimizedContext,
        options: {
          ...options,
          timeout: timeoutMs
        }
      }, {
        timeout: timeoutMs
      });
      
      this.trackPerformance(endpoint, startTime, true);
      
      const totalTime = Date.now() - startTime;
      console.log(`Pipeline generation completed in ${totalTime}ms using ${pipelineId}`);
      
      return response.data;
    } catch (error) {
      this.trackPerformance(endpoint, startTime, false);
      const totalTime = Date.now() - startTime;
      console.error(`Pipeline generation failed after ${totalTime}ms:`, error);
      throw error;
    }
  }

  async analyzeComponentWithPipeline(
    component: any,
    analysisType: string = 'general',
    pipelineId: string = 'advanced-analysis',
    options: any = {}
  ): Promise<any> {
    const response = await this.api.post('/pipeline/analyze-component', {
      component,
      analysisType,
      pipelineId,
      options,
    });
    return response.data;
  }

  async enhanceOCRWithPipeline(
    ocrResults: any[],
    imageContext: any = {},
    pipelineId: string = 'ocr-enhancement',
    options: any = {}
  ): Promise<any> {
    const response = await this.api.post('/pipeline/enhance-ocr', {
      ocrResults,
      imageContext,
      pipelineId,
      options,
    });
    return response.data;
  }

  async getPipelineStatus(): Promise<any> {
    const response = await this.api.get('/pipeline/status');
    return response.data;
  }

  // Get pipeline performance metrics
  async getPipelineMetrics(): Promise<any> {
    const startTime = Date.now();
    const endpoint = 'getPipelineMetrics';
    
    try {
      const response = await this.api.get('/pipeline/metrics');
      this.trackPerformance(endpoint, startTime, true);
      return response.data;
    } catch (error) {
      this.trackPerformance(endpoint, startTime, false);
      throw error;
    }
  }

  // Get pipeline health status
  async getPipelineHealth(): Promise<any> {
    const startTime = Date.now();
    const endpoint = 'getPipelineHealth';
    
    try {
      const response = await this.api.get('/pipeline/health');
      this.trackPerformance(endpoint, startTime, true);
      return response.data;
    } catch (error) {
      this.trackPerformance(endpoint, startTime, false);
      throw error;
    }
  }

  // Clear pipeline cache
  async clearPipelineCache(): Promise<any> {
    const startTime = Date.now();
    const endpoint = 'clearPipelineCache';
    
    try {
      const response = await this.api.post('/pipeline/cache/clear');
      this.trackPerformance(endpoint, startTime, true);
      return response.data;
    } catch (error) {
      this.trackPerformance(endpoint, startTime, false);
      throw error;
    }
  }

  // Code Interpreter Integration Methods
  async executeCode(code: string, context: any = {}): Promise<any> {
    const response = await this.api.post('/code-interpreter/execute', { code, context });
    return response.data;
  }

  async analyzeComponentWithCode(component: any, analysisType: string = 'general'): Promise<any> {
    const response = await this.api.post('/code-interpreter/analyze-component', {
      component,
      analysisType,
    });
    return response.data;
  }

  async generateComponentsFromOCR(ocrResults: any[], imageContext: any = {}): Promise<any> {
    const response = await this.api.post('/code-interpreter/generate-from-ocr', {
      ocrResults,
      imageContext,
    });
    return response.data;
  }

  async enhanceOCRAdvanced(
    ocrResults: any[],
    imageContext: any = {},
    useCodeInterpreter: boolean = true
  ): Promise<any> {
    const response = await this.api.post('/code-interpreter/enhance-ocr-advanced', {
      ocrResults,
      imageContext,
      useCodeInterpreter,
    });
    return response.data;
  }

  async getCodeInterpreterStatus(): Promise<any> {
    const response = await this.api.get('/code-interpreter/status');
    return response.data;
  }

  async getExecutionHistory(limit: number = 10): Promise<any> {
    const response = await this.api.get(`/code-interpreter/history?limit=${limit}`);
    return response.data;
  }

  async executePipelineWithCode(
    pipelineId: string,
    messages: any[],
    codeContext: any = {},
    options: any = {}
  ): Promise<any> {
    const response = await this.api.post('/code-interpreter/pipeline-with-code', {
      pipelineId,
      messages,
      codeContext,
      options,
    });
    return response.data;
  }

  // Component grouping and template generation
  async analyzeComponentGrouping(projectId: string): Promise<any> {
    const response = await this.api.get(`/components/${projectId}/analyze-grouping`);
    return response.data;
  }

  async autoGroupComponentsByType(projectId: string, generateTemplates: boolean = false): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/auto-group-by-type`, {
      generateTemplates
    });
    return response.data;
  }

  async groupComponentsByType(
    projectId: string,
    componentType: string,
    options: {
      groupName?: string;
      generateTemplate?: boolean;
    } = {}
  ): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/group-by-type`, {
      componentType,
      ...options
    });
    return response.data;
  }

  async createTemplateFromGroup(
    projectId: string,
    groupId: string,
    templateOptions: {
      templateName: string;
      description?: string;
      [key: string]: any;
    }
  ): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/group/${groupId}/create-template`, 
      templateOptions
    );
    return response.data;
  }

  async getComponentTypes(projectId: string): Promise<any> {
    const response = await this.api.get(`/components/${projectId}/types`);
    return response.data;
  }

  async getComponentGroups(projectId: string): Promise<any> {
    const response = await this.api.get(`/components/${projectId}/groups`);
    return response.data;
  }

  async bulkDeleteComponents(projectId: string, componentIds: string[]): Promise<void> {
    await this.api.post(`/components/${projectId}/bulk-delete`, { componentIds });
  }

  // Admin - rate limit
  async getRateLimitConfig(): Promise<any> {
    const response = await this.api.get('/admin/rate-limit');
    return response.data;
  }

  async updateRateLimitConfig(config: any): Promise<any> {
    const response = await this.api.post('/admin/rate-limit', config);
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
