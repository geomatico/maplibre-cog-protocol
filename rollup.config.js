const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'umd',
    name: 'MaplibreCogProtocol'
  },
  plugins: [typescript({tsconfig: './tsconfig.dist.json'})],
};
