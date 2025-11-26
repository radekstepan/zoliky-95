import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only include unit tests in the tests directory
    include: ['tests/**/*.test.ts'],
    // Explicitly exclude the e2e directory to prevent conflicts with Playwright
    exclude: ['playwright/**/*', 'node_modules/**/*'],
  },
});
