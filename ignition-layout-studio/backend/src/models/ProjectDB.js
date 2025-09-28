const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProjectDB = sequelize.define('Project', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  managerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'in_progress', 'review', 'completed', 'archived'),
    defaultValue: 'draft'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      gridSize: 20,
      snapToGrid: true,
      showGrid: true,
      canvasWidth: 1920,
      canvasHeight: 1080,
      backgroundColor: '#ffffff',
      industry: 'manufacturing',
      safetyLevel: 'standard',
      aiIntegration: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-4'
      }
    }
  },
  components: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  templates: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  collaborators: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastModifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  exportedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  exportFormat: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {
      totalComponents: 0,
      complexity: 'simple',
      estimatedTime: 0,
      resources: []
    }
  },
  auditLog: {
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['managerId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['priority']
    },
    {
      fields: ['isPublic']
    },
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['collaborators'],
      using: 'gin'
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    }
  ]
});

// Instance methods
ProjectDB.prototype.addCollaborator = async function(userId) {
  if (!this.collaborators.includes(userId)) {
    this.collaborators.push(userId);
    await this.save();
    this.logAction('collaborator_added', { userId });
  }
};

ProjectDB.prototype.removeCollaborator = async function(userId) {
  const index = this.collaborators.indexOf(userId);
  if (index > -1) {
    this.collaborators.splice(index, 1);
    await this.save();
    this.logAction('collaborator_removed', { userId });
  }
};

ProjectDB.prototype.addComponent = async function(component) {
  this.components.push({
    ...component,
    id: component.id || require('crypto').randomUUID(),
    createdAt: new Date(),
    version: 1
  });
  
  this.metadata.totalComponents = this.components.length;
  await this.save();
  this.logAction('component_added', { componentId: component.id });
};

ProjectDB.prototype.updateComponent = async function(componentId, updates) {
  const componentIndex = this.components.findIndex(c => c.id === componentId);
  if (componentIndex > -1) {
    this.components[componentIndex] = {
      ...this.components[componentIndex],
      ...updates,
      updatedAt: new Date(),
      version: (this.components[componentIndex].version || 1) + 1
    };
    await this.save();
    this.logAction('component_updated', { componentId, updates });
  }
};

ProjectDB.prototype.removeComponent = async function(componentId) {
  const initialLength = this.components.length;
  this.components = this.components.filter(c => c.id !== componentId);
  
  if (this.components.length < initialLength) {
    this.metadata.totalComponents = this.components.length;
    await this.save();
    this.logAction('component_removed', { componentId });
  }
};

ProjectDB.prototype.logAction = function(action, details = {}) {
  const logEntry = {
    action,
    details,
    timestamp: new Date(),
    userId: this.lastModifiedBy
  };
  
  this.auditLog.push(logEntry);
  
  // Keep only last 100 entries
  if (this.auditLog.length > 100) {
    this.auditLog = this.auditLog.slice(-100);
  }
};

ProjectDB.prototype.calculateComplexity = function() {
  const componentCount = this.components.length;
  const uniqueTypes = new Set(this.components.map(c => c.type)).size;
  
  if (componentCount <= 5 && uniqueTypes <= 3) return 'simple';
  if (componentCount <= 20 && uniqueTypes <= 8) return 'medium';
  if (componentCount <= 50 && uniqueTypes <= 15) return 'complex';
  return 'enterprise';
};

ProjectDB.prototype.estimateTime = function() {
  const complexity = this.calculateComplexity();
  const baseTime = {
    simple: 2,
    medium: 8,
    complex: 24,
    enterprise: 72
  };
  
  return baseTime[complexity] || 2;
};

ProjectDB.prototype.generateThumbnail = async function() {
  // This would integrate with a thumbnail generation service
  // For now, return a placeholder
  return `/api/projects/${this.id}/thumbnail`;
};

ProjectDB.prototype.canUserAccess = function(user) {
  // Owner can always access
  if (this.userId === user.id) return true;
  
  // Manager can access if assigned
  if (this.managerId === user.id) return true;
  
  // Collaborators can access
  if (this.collaborators.includes(user.id)) return true;
  
  // Admin can access all
  if (user.role === 'admin') return true;
  
  // Public projects can be read by anyone
  if (this.isPublic && user.hasPermission('read')) return true;
  
  return false;
};

ProjectDB.prototype.canUserEdit = function(user) {
  // Owner can always edit
  if (this.userId === user.id) return true;
  
  // Manager can edit if assigned
  if (this.managerId === user.id) return true;
  
  // Admin can edit all
  if (user.role === 'admin') return true;
  
  // Collaborators can edit if they have permission
  if (this.collaborators.includes(user.id) && user.hasPermission('update')) return true;
  
  return false;
};

// Static methods
ProjectDB.findByUser = function(userId) {
  return this.findAll({ 
    where: { userId },
    order: [['updatedAt', 'DESC']]
  });
};

ProjectDB.findByCollaborator = function(userId) {
  return this.findAll({
    where: {
      collaborators: {
        [require('sequelize').Op.contains]: [userId]
      }
    },
    order: [['updatedAt', 'DESC']]
  });
};

ProjectDB.findPublic = function() {
  return this.findAll({
    where: { isPublic: true },
    order: [['updatedAt', 'DESC']]
  });
};

ProjectDB.findByStatus = function(status) {
  return this.findAll({
    where: { status },
    order: [['updatedAt', 'DESC']]
  });
};

ProjectDB.findByTags = function(tags) {
  return this.findAll({
    where: {
      tags: {
        [require('sequelize').Op.overlap]: tags
      }
    },
    order: [['updatedAt', 'DESC']]
  });
};

// Hooks
ProjectDB.addHook('beforeSave', async (project) => {
  if (project.changed('components') || project.changed('settings')) {
    project.version += 1;
    project.metadata.complexity = project.calculateComplexity();
    project.metadata.estimatedTime = project.estimateTime();
  }
});

ProjectDB.addHook('beforeUpdate', async (project) => {
  project.logAction('project_updated', {
    changed: project.changed()
  });
});

module.exports = ProjectDB; 