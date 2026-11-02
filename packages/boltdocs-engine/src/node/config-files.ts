/**
 * Supported user configuration file names.
 *
 * Kept in a tiny dependency-free module so lightweight consumers (e.g. the
 * `audit` command, which only needs `plugins`) can resolve the config file
 * without pulling in the full config/schema/zod module graph.
 */
export const CONFIG_FILES = [
  'boltdocs.config.js',
  'boltdocs.config.mjs',
  'boltdocs.config.ts',
]
