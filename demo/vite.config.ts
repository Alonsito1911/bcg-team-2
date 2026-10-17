import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 genera dist-single/index.html autocontenido (abre con doble clic, sin servidor).
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: single ? [react(), viteSingleFile()] : [react()],
  build: single ? { outDir: 'dist-single' } : undefined,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
