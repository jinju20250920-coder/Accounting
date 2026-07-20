import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/lib/**/*.test.tsx', 'src/stores/**/*.test.ts'],
  },
});
