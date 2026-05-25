export interface DuiConfig {
  /** Prefix shown in every log line, e.g. `[boltdocs]`. Default: `'dui'`. */
  prefix: string
  /** Title text in the dev-server box. Default: `'dev server'`. */
  devServerTitle: string
  /** Title text in the preview-server box. Default: `'preview server'`. */
  previewServerTitle: string
  /** Command shown in the update-available notification. Default: `'npm install boltdocs@latest'`. */
  updateCommand: string
}

const _config: DuiConfig = {
  prefix: 'dui',
  devServerTitle: 'dev server',
  previewServerTitle: 'preview server',
  updateCommand: 'npm install boltdocs@latest',
}

/**
 * Override one or more dui configuration values.
 * Call this once at the entry point of your CLI before anything else runs.
 *
 * @example
 * ```ts
 * import { configure } from '@bdocs/dui'
 *
 * configure({
 *   prefix: 'boltdocs',
 *   devServerTitle: 'boltdocs dev server',
 *   previewServerTitle: 'boltdocs preview server',
 *   updateCommand: 'pnpm add boltdocs@latest',
 * })
 * ```
 */
export function configure(opts: Partial<DuiConfig>): void {
  Object.assign(_config, opts)
}

/** Returns a read-only snapshot of the current configuration. */
export function getConfig(): Readonly<DuiConfig> {
  return _config
}
