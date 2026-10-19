import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts', 'tests/edge/**/*.test.ts'], environment: 'node' } })
