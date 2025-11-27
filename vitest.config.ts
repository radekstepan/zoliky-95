import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only include unit tests in the tests directory
    include: ['tests/**/*.test.ts'],
    // Explicitly exclude the e2e directory to prevent conflicts with Playwright
    exclude: ['playwright/**/*', 'node_modules/**/*'],
    // Configure Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      // Exclude entry points, types, and UI glue code that is hard to unit test
      exclude: ['src/main.ts', 'src/types.ts', 'src/vite-env.d.ts', 'src/style.css']
    },
  },
});
