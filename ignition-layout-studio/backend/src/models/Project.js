const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class Project {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name || 'Untitled Project';
    this.description = data.description || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.files = data.files || [];
    this.components = data.components || [];
    this.templates = data.templates || [];
    this.layers = data.layers || [];
    this.settings = data.settings || {
      gridSize: 10,
      snapToGrid: true,
      showLabels: true,
      units: 'meters'
    };
    this.metadata = data.metadata || {};
    this.tagMappings = data.tagMappings || {};
    this.exportHistory = data.exportHistory || [];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      files: this.files,
      components: this.components,
      templates: this.templates,
      layers: this.layers,
      settings: this.settings,
      metadata: this.metadata,
      tagMappings: this.tagMappings,
      exportHistory: this.exportHistory
    };
  }

  async save() {
    const projectDir = path.join(__dirname, '../../projects', this.id);
    await fs.mkdir(projectDir, { recursive: true });

    const projectFile = path.join(projectDir, 'project.json');
    await fs.writeFile(projectFile, JSON.stringify(this.toJSON(), null, 2));

    this.updatedAt = new Date().toISOString();
    return this;
  }

  static async load(projectId) {
    const projectFile = path.join(__dirname, '../../projects', projectId, 'project.json');
    try {
      const data = await fs.readFile(projectFile, 'utf8');
      return new Project(JSON.parse(data));
    } catch (error) {
      throw new Error(`Project ${projectId} not found`);
    }
  }

  static async list() {
    const projectsDir = path.join(__dirname, '../../projects');
    try {
      await fs.mkdir(projectsDir, { recursive: true });
      const dirs = await fs.readdir(projectsDir);
      const projects = [];

      for (const dir of dirs) {
        try {
          const project = await Project.load(dir);
          projects.push({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt
          });
        } catch (error) {
          // Skip invalid project directories
        }
      }

      return projects;
    } catch (error) {
      return [];
    }
  }

  addFile(fileInfo) {
    this.files.push({
      id: uuidv4(),
      ...fileInfo,
      uploadedAt: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  addComponent(component) {
    const existingIndex = this.components.findIndex(c => c.id === component.id);
    if (existingIndex >= 0) {
      this.components[existingIndex] = component;
    } else {
      this.components.push(component);
    }
    this.updatedAt = new Date().toISOString();
  }

  addTemplate(template) {
    const existingIndex = this.templates.findIndex(t => t.id === template.id);
    if (existingIndex >= 0) {
      this.templates[existingIndex] = template;
    } else {
      this.templates.push(template);
    }
    this.updatedAt = new Date().toISOString();
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.updatedAt = new Date().toISOString();
  }

  addExportRecord(exportInfo) {
    this.exportHistory.push({
      id: uuidv4(),
      ...exportInfo,
      exportedAt: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = Project;
