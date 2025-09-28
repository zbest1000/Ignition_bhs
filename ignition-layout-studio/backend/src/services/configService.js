const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ConfigService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;

    // Initialize encryption key
    this.encryptionKey = this.getOrCreateEncryptionKey();

    // Cache for decrypted values
    this.cache = new Map();
  }

  /**
   * Get or create encryption key for API keys
   */
  getOrCreateEncryptionKey() {
    const keyPath = path.join(__dirname, '../../../.encryption-key');

    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath);
      }
    } catch (error) {
      // Don't log sensitive path information
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not read encryption key file');
      }
    }

    // Generate new key
    const key = crypto.randomBytes(this.keyLength);

    try {
      fs.writeFileSync(keyPath, key);
      if (process.env.NODE_ENV === 'development') {
        console.log('Generated new encryption key');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not save encryption key file');
      }
    }

    return key;
  }

  /**
   * Encrypt a value (like API key)
   */
  encrypt(text) {
    if (!text) return null;

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipherGCM(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encrypted: encrypted
    };
  }

  /**
   * Decrypt a value
   */
  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return null;
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const decipher = crypto.createDecipherGCM(this.algorithm, this.encryptionKey, iv);

      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Don't log sensitive decryption errors in production
      if (process.env.NODE_ENV === 'development') {
        console.error('Decryption failed:', error.message);
      }
      return null;
    }
  }

  /**
   * Get configuration value with optional decryption
   */
  get(key, defaultValue = null, decrypt = false) {
    const cacheKey = `${key}_${decrypt}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let value = process.env[key] || defaultValue;

    if (decrypt && value) {
      try {
        const encryptedData = JSON.parse(value);
        value = this.decrypt(encryptedData);
      } catch (error) {
        // Don't log sensitive decryption errors in production
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Could not decrypt ${key}:`, error.message);
        }
        value = defaultValue;
      }
    }

    // Cache the result
    this.cache.set(cacheKey, value);

    return value;
  }

  /**
   * Set configuration value with optional encryption
   */
  set(key, value, encrypt = false) {
    if (encrypt && value) {
      const encryptedData = this.encrypt(value);
      process.env[key] = JSON.stringify(encryptedData);
    } else {
      process.env[key] = value;
    }

    // Clear cache
    this.cache.delete(`${key}_true`);
    this.cache.delete(`${key}_false`);
  }

  /**
   * Get all AI provider configurations
   */
  getAIProviders() {
    return {
      openai: {
        apiKey: this.get('OPENAI_API_KEY', null, true),
        baseURL: this.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        model: this.get('OPENAI_MODEL', 'gpt-3.5-turbo'),
        enabled: this.get('OPENAI_ENABLED', 'false') === 'true'
      },
      anthropic: {
        apiKey: this.get('ANTHROPIC_API_KEY', null, true),
        baseURL: this.get('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
        model: this.get('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229'),
        enabled: this.get('ANTHROPIC_ENABLED', 'false') === 'true'
      },
      azure: {
        apiKey: this.get('AZURE_OPENAI_API_KEY', null, true),
        endpoint: this.get('AZURE_OPENAI_ENDPOINT'),
        deploymentName: this.get('AZURE_OPENAI_DEPLOYMENT_NAME'),
        apiVersion: this.get('AZURE_OPENAI_API_VERSION', '2023-05-15'),
        enabled: this.get('AZURE_OPENAI_ENABLED', 'false') === 'true'
      },
      gemini: {
        apiKey: this.get('GEMINI_API_KEY', null, true),
        model: this.get('GEMINI_MODEL', 'gemini-pro'),
        enabled: this.get('GEMINI_ENABLED', 'false') === 'true'
      }
    };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    return {
      host: this.get('DB_HOST', 'localhost'),
      port: this.get('DB_PORT', '5432'),
      database: this.get('DB_NAME', 'ignition_studio'),
      username: this.get('DB_USER', 'postgres'),
      password: this.get('DB_PASSWORD', null, true),
      ssl: this.get('DB_SSL', 'false') === 'true',
      maxConnections: parseInt(this.get('DB_MAX_CONNECTIONS', '10')),
      idleTimeoutMillis: parseInt(this.get('DB_IDLE_TIMEOUT', '30000'))
    };
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return {
      port: parseInt(this.get('PORT', '5000')),
      host: this.get('HOST', '0.0.0.0'),
      nodeEnv: this.get('NODE_ENV', 'development'),
      frontendUrl: this.get('FRONTEND_URL', 'http://localhost:3000'),
      maxFileSize: parseInt(this.get('MAX_FILE_SIZE', '52428800')), // 50MB
      maxFiles: parseInt(this.get('MAX_FILES', '10')),
      uploadPath: this.get('UPLOAD_PATH', '../uploads'),
      exportPath: this.get('EXPORT_PATH', '../exports'),
      logLevel: this.get('LOG_LEVEL', 'info'),
      corsOrigins: this.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(
        ','
      )
    };
  }

  /**
   * Get OCR configuration
   */
  getOCRConfig() {
    return {
      provider: this.get('OCR_PROVIDER', 'mock'),
      nativeOCR: {
        language: this.get('OCR_LANGUAGE', 'eng'),
        confidence: parseFloat(this.get('OCR_CONFIDENCE', '0.7')),
        preprocessing: this.get('OCR_PREPROCESSING', 'true') === 'true'
      },
      tesseract: {
        executablePath: this.get('TESSERACT_EXECUTABLE_PATH'),
        dataPath: this.get('TESSERACT_DATA_PATH'),
        languages: this.get('TESSERACT_LANGUAGES', 'eng,spa,fra,deu').split(',')
      },
      timeout: parseInt(this.get('OCR_TIMEOUT', '30000')),
      maxConcurrent: parseInt(this.get('OCR_MAX_CONCURRENT', '3'))
    };
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check required environment variables
    const required = ['NODE_ENV'];
    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required environment variable: ${key}`);
      }
    }

    // Check AI provider configuration
    const aiProviders = this.getAIProviders();
    const enabledProviders = Object.entries(aiProviders).filter(([_, config]) => config.enabled);

    if (enabledProviders.length === 0) {
      warnings.push('No AI providers are enabled. AI features will not be available.');
    }

    for (const [provider, config] of enabledProviders) {
      if (!config.apiKey) {
        warnings.push(`AI provider ${provider} is enabled but no API key is configured.`);
      }
    }

    // Check server configuration
    const serverConfig = this.getServerConfig();
    if (serverConfig.port < 1 || serverConfig.port > 65535) {
      errors.push(`Invalid port number: ${serverConfig.port}`);
    }

    // Check file size limits
    if (serverConfig.maxFileSize > 100 * 1024 * 1024) {
      // 100MB
      warnings.push(`Large max file size configured: ${serverConfig.maxFileSize / 1024 / 1024}MB`);
    }

    return { errors, warnings };
  }

  /**
   * Get configuration summary for logging
   */
  getSummary() {
    const serverConfig = this.getServerConfig();
    const aiProviders = this.getAIProviders();
    const enabledProviders = Object.entries(aiProviders)
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name);

    return {
      environment: serverConfig.nodeEnv,
      port: serverConfig.port,
      enabledAIProviders: enabledProviders,
      ocrProvider: this.getOCRConfig().provider,
      maxFileSize: `${serverConfig.maxFileSize / 1024 / 1024}MB`,
      maxFiles: serverConfig.maxFiles
    };
  }
}

// Export singleton instance
module.exports = new ConfigService();
