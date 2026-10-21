import type { CodeHighlightConfig, CodeTheme } from '@bdocs/contracts'

/**
 * The slice of a plugin the processor reads.
 *
 * A plugin's name, version, options and its remark and rehype hooks. The
 * processor does not run the hooks and does not read the plugin's context, so
 * it does not need the plugin's type — and asking for it would make the two
 * incompatible over a difference neither of them cares about: the engine's
 * plugin type is bound to the engine's configuration, and the processor's
 * configuration is the narrow one below.
 */
export interface ProcessorPlugin {
  name?: string
  version?: string
  options?: unknown
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
}

/**
 * The slice of the configuration the processor reads.
 *
 * Not the whole config contract, for the same reason as {@link ProcessorPlugin}:
 * the engine hands the processor its own configuration, and declaring the
 * entire contract here would make the two incompatible over a difference
 * neither of them cares about. A narrow, structural type says what the
 * processor actually reads.
 */
export interface ProcessorConfig {
  base?: string
  siteUrl?: string
  theme?: {
    codeTheme?: CodeTheme
    /** The string shorthand (`'shiki'`) is part of the configuration. */
    codeHighlighting?: CodeHighlightConfig | string
  }
  plugins?: ProcessorPlugin[]
}
