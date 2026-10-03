import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['test/fixtures/**', 'node_modules/**'],
    // End-to-end tests start real Vitest runs in child processes.
    testTimeout: 120_000,
  },
})
