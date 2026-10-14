import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'tools/**/*.ts', '.claude/hooks/bypass.ts'],
      // The entry point only wires real I/O; the sampler needs a Windows desktop (smoke-tested there).
      exclude: ['src/cli.ts', 'src/infra/sampler.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        'src/{shared,domain,views,adapters}/**': {
          lines: 100,
          branches: 90,
          functions: 100,
          statements: 100,
        },
        lines: 90,
        branches: 85,
      },
    },
  },
})
