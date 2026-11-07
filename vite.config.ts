import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the built site works on any static host or sub-path.
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
