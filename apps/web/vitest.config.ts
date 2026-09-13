import { defineConfig } from 'vitest/config'

// Pure-TS unit tests only (schemas, formatters, mappings). Components are
// not rendered here — there's no DOM environment configured.
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
