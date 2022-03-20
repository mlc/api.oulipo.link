import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import sizes from 'rollup-plugin-sizes';

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

const plugins = [
  nodeResolve({ extensions, preferBuiltins: true }),
  commonjs(),
  typescript(),
  json(),
  sizes(),
];

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'commonjs',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  plugins,
};
