import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const config = {
  input: 'src/index.ts',
  output: {
    sourcemap: true,
    dir: 'dist',
    format: 'umd',
    name: 'MaplibreCOGProtocol',
    inlineDynamicImports: true,
  },
  /*external: [
    'geotiff'
  ],*/
  plugins: [
    resolve({
      browser: true
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json'
    }),
    ...process.env.DEV ? [

    ] : [
      terser()
    ],
  ]
};

export default config;
