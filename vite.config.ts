import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The logic suite runs on the bare node test runner with nothing installed.
    // Vitest only takes the component tests.
    include: ['src/**/*.test.tsx'],
  },
});
