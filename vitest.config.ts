import { defineConfig } from 'vitest/config'

/**
 * The tests that live outside a package.
 *
 * The benchmark and report helpers are scripts, not a package, and their tests
 * had no configuration to run under: they used the global `describe` and `it`
 * that `globals: true` provides, and there was no config that set it. They
 * were dead files — written, never run.
 *
 * The include is narrow on purpose. A broad one would collect every package's
 * tests as well, and run them a second time under a configuration that knows
 * none of their aliases.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
  },
})
