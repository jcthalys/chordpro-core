import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dir, '../package.json'), 'utf-8')) as { version: string };

export default defineConfig({
  root: '.',
  base: './',
  resolve: {
    alias: {
      'chordpro-core': path.resolve(__dir, '../dist/index.js'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  define: {
    __LIBRARY_VERSION__: JSON.stringify(pkg.version),
  },
});
