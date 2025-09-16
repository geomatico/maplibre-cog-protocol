module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
    // Force transform quick-lru and any nested dependencies
    '^.+/node_modules/(quick-lru|geotiff)/.+\\.(js|mjs)$': ['ts-jest']
  },
  moduleNameMapper: {
    '@/(.*)$': '<rootDir>/src/$1',
    '^d3-(.+)$': '<rootDir>/node_modules/d3-$1/dist/d3-$1.js'
  },
  transformIgnorePatterns: [
    // Allow transformation of quick-lru and geotiff
    'node_modules/(?!(quick-lru|geotiff)/)'
  ]
};
