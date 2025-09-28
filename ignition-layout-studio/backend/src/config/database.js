const { Sequelize } = require('sequelize');
const logger = require('../services/loggerService');

const config = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ignition_layout_studio_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    storage: process.env.DB_STORAGE || './database.sqlite',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true // Soft deletes
    }
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'ignition_layout_studio_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true
    }
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true
    },
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  }
};

const env = process.env.NODE_ENV || 'development';
let sequelize;

// Initialize database with fallback logic
const initializeDatabase = () => {
  const dbConfig = config[env];
  
  // Try PostgreSQL first, then fallback to SQLite
  if (dbConfig.dialect === 'postgres') {
    sequelize = new Sequelize(dbConfig);
  } else {
    sequelize = new Sequelize(dbConfig);
  }
  
  return sequelize;
};

// Create fallback SQLite configuration
const createSQLiteFallback = () => {
  const sqliteConfig = {
    ...config[env],
    dialect: 'sqlite',
    storage: './database.sqlite'
  };
  return new Sequelize(sqliteConfig);
};

// Initialize sequelize
sequelize = initializeDatabase();

// Test database connection with fallback
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info(`Database connection established successfully (${sequelize.getDialect()})`);
    return true;
  } catch (error) {
    logger.warn('Primary database connection failed:', { error: error.message });
    
    // If PostgreSQL fails, try SQLite fallback
    if (sequelize.getDialect() === 'postgres') {
      try {
        logger.info('Attempting SQLite fallback...');
        sequelize = createSQLiteFallback();
        await sequelize.authenticate();
        logger.info('SQLite fallback connection established successfully');
        return true;
      } catch (sqliteError) {
        logger.error('SQLite fallback also failed:', { error: sqliteError.message });
        return false;
      }
    }
    
    logger.error('Unable to connect to database:', { error: error.message });
    return false;
  }
};

// Initialize database
const initDatabase = async () => {
  try {
    // Use force: true for development to recreate tables if there are schema issues
    const syncOptions = process.env.NODE_ENV === 'development' ? { force: true } : { alter: true };
    await sequelize.sync(syncOptions);
    logger.info('Database synchronized successfully');
  } catch (error) {
    logger.warn('Database synchronization failed, trying without sync:', { error: error.message });
    // Continue without sync for development to allow the app to start
    if (process.env.NODE_ENV === 'development') {
      logger.info('Continuing without database sync in development mode');
      return;
    }
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection,
  initDatabase,
  config
}; 