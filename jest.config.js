module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // The generated client is orval's output, not ours -- it is covered by the
  // api-contract check instead.
  testPathIgnorePatterns: ['/node_modules/', '/src/api/generated/'],
};
