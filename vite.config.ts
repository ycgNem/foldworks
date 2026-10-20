import { defineConfig } from 'vite';

// Port 5210 so Foldworks' dev server never collides with the other games (5173-5200).
export default defineConfig({
  base: './',
  server: { port: 5210, host: '127.0.0.1' },
  preview: { port: 4210, host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
} as any);
