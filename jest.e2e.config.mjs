import baseConfig from './jest.config.mjs';

export default {
  ...baseConfig,
  testMatch: ['<rootDir>/tests/**/*.e2e.ts'],
};