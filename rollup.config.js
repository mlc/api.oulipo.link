import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import sizes from 'rollup-plugin-sizes';

const extensions = ['.js', '.jsx', '.ts', '.tsx'];

const plugins = [
  nodeResolve({ extensions, preferBuiltins: true }),
  commonjs(),
  babel({
    extensions,
    babelHelpers: 'runtime',
  }),
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
