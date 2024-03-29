import * as esbuild from 'esbuild';

await esbuild.build({
  outdir: 'dist',
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: false,
  sourcemap: true,
  write: true,
  platform: 'node',
  external: ['@aws-sdk'],
  metafile: true,
  target: 'node20',
  format: 'esm',
  outExtension: {
    '.js': '.mjs',
  },
});
