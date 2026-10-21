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
 *
 * The two theme fields are `unknown` because the highlighting configuration
 * has three shapes in this repository — the contract's, the pipeline's and the
 * processor's own — and they disagree about how wide a theme may be. The
 * processor normalizes what it is given, which is what
 * `normalizeCodeHighlightConfig` is for; the type of the raw value is not the
 * processor's to decide.
 */
export interface ProcessorConfig {
  base?: string
  siteUrl?: string
  theme?: {
    codeTheme?: unknown
    codeHighlighting?: unknown
  }
  plugins?: ProcessorPlugin[]
}
