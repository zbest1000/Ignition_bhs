// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_min_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_long';
process.env.OPENAI_API_KEY = 'test_key';
process.env.ANTHROPIC_API_KEY = 'test_key';

// Mock database for tests
jest.mock('../config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true)
  }
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// Simple test to satisfy Jest
describe('Test Setup', () => {
  test('should configure test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
  });
});
