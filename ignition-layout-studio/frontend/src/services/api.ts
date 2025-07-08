import axios, { AxiosInstance } from 'axios';
import { 
  Project, 
  Component, 
  Template, 
  FileInfo,
  ExportOptions,
  OCRResult 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
        return Promise.reject(error);
      }
    );
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
  async uploadFiles(projectId: string, files: File[]): Promise<FileInfo[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.api.post(`/upload/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.files;
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

  async updateComponent(projectId: string, componentId: string, updates: Partial<Component>): Promise<Component> {
    const response = await this.api.put(`/components/${projectId}/${componentId}`, updates);
    return response.data;
  }

  async deleteComponent(projectId: string, componentId: string): Promise<void> {
    await this.api.delete(`/components/${projectId}/${componentId}`);
  }

  async bulkUpdateComponents(projectId: string, componentIds: string[], updates: Partial<Component>): Promise<any> {
    const response = await this.api.put(`/components/${projectId}/bulk`, { componentIds, updates });
    return response.data;
  }

  async groupComponents(projectId: string, componentIds: string[], groupName?: string, templateId?: string): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/group`, { 
      componentIds, 
      groupName, 
      templateId 
    });
    return response.data;
  }

  async ungroupComponents(projectId: string, groupId: string): Promise<any> {
    const response = await this.api.delete(`/components/${projectId}/group/${groupId}`);
    return response.data;
  }

  async cloneComponents(projectId: string, componentIds: string[], offset?: { x: number; y: number }): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/clone`, { componentIds, offset });
    return response.data;
  }

  async alignComponents(projectId: string, componentIds: string[], alignment: 'horizontal' | 'vertical', spacing?: number): Promise<any> {
    const response = await this.api.post(`/components/${projectId}/align`, { 
      componentIds, 
      alignment, 
      spacing 
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
      description
    });
    return response.data;
  }

  async updateTemplate(projectId: string, templateId: string, updates: Partial<Template>): Promise<Template> {
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
    const response = await this.api.post(`/templates/${projectId}/${templateId}/apply`, { componentIds });
    return response.data;
  }

  async getTemplatePreview(projectId: string, templateId: string, width?: number, height?: number): Promise<string> {
    const params = new URLSearchParams();
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    
    const url = `/templates/${projectId}/${templateId}/preview?${params.toString()}`;
    return `${API_BASE_URL}${url}`;
  }

  // Export endpoints
  async exportSVG(projectId: string, includeLabels?: boolean, includeGrid?: boolean): Promise<Blob> {
    const response = await this.api.get(`/export/${projectId}/svg`, {
      params: { includeLabels, includeGrid },
      responseType: 'blob'
    });
    return response.data;
  }

  async exportPerspective(projectId: string, viewName?: string, includeTemplates?: boolean): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/perspective`, {
      viewName,
      includeTemplates
    });
    return response.data;
  }

  async exportVision(projectId: string, windowName?: string, includeTemplates?: boolean): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/vision`, {
      windowName,
      includeTemplates
    });
    return response.data;
  }

  async exportPackage(projectId: string, options: ExportOptions): Promise<any> {
    const response = await this.api.post(`/export/${projectId}/package`, options);
    return response.data;
  }

  async downloadExport(projectId: string, exportId: string): Promise<void> {
    const response = await this.api.get(`/export/${projectId}/download/${exportId}`, {
      responseType: 'blob'
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
}

export default new ApiService();