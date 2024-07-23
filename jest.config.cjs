module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.ts?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }]
  },
  moduleNameMapper: {
    '^d3-(.+)$': '<rootDir>/node_modules/d3-$1/dist/d3-$1.js',
  }
};
