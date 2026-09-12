module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // react-native-worklets resolves to a .native implementation that needs the
  // real native module. Its own resolver strips those extensions so reanimated
  // is importable under jest.
  resolver: 'react-native-worklets/jest/resolver.js',
  // The generated client is orval's output, not ours -- it is covered by the
  // api-contract check instead.
  // `support/` holds helpers for the live suites, not suites of their own.
  testPathIgnorePatterns: ['/node_modules/', '/src/api/generated/', '/__tests__/support/'],
};
