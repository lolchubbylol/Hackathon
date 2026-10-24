import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Hackathon/',
  envPrefix: ['VITE_', 'REACT_APP_'],
  build: { outDir: 'build' },
  test: { globals: true, environment: 'jsdom', setupFiles: './src/setupTests.ts' },
});
