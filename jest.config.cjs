module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }],
    // quick-lru comes only as an es6 module that needs transformations as well
    '.*node_modules/quick-lru/.*$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  moduleNameMapper: {
    '@/(.*)$': '<rootDir>/src/$1',
    '^d3-(.+)$': '<rootDir>/node_modules/d3-$1/dist/d3-$1.js'
  },
  transformIgnorePatterns: [
    // we tell jest that quick-lru is not to be ignored, so the transformation above applies
    '<rootDir>/node_modules/(?!quick-lru)'
  ]
};
