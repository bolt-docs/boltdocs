/**
 * Engine-agnostic code highlighting configuration helpers.
 *
 * Shared by `boltdocs` core (config schema, prewarm sites, Shiki adapter) and
 * `@bdocs/processor-satteri` (MDX compile pipeline) so both read
 * `theme.codeHighlighting` through one normalization rule. This lives in the
 * leaf utils package on purpose: core and the processor must not depend on
 * each other at runtime.
 */

/**
 * An engine-agnostic code theme: a single theme name or a light/dark pair.
 */
export type CodeTheme = string | { light: string; dark: string }

/**
 * Structural shape of the highlighting config as it flows through the
 * pipeline. Deliberately loose: `engine` may be a registry id string, an
 * adapter-like object, or an adapter factory. Packages refine this type
 * internally (e.g. boltdocs' `CodeHighlighterEngine`).
 */
export interface CodeHighlightConfig {
  engine?: string | object | ((api: CodeHighlightConfig) => unknown)
  theme?: CodeTheme
  options?: Record<string, unknown>
}

/**
 * Normalizes the user-facing `theme.codeHighlighting` value into the internal
 * {@link CodeHighlightConfig} shape.
 *
 * A string shorthand is treated as a highlighter registry id — `'shiki'` is
 * equivalent to `{ engine: 'shiki' }`. `undefined` passes through so
 * `?? codeTheme` fallback chains keep working. Every consumer of
 * `theme.codeHighlighting` must go through this helper instead of reading
 * properties off the raw value, because the raw value may be a string.
 */
export function normalizeCodeHighlightConfig(
  value: CodeHighlightConfig | string | undefined,
): CodeHighlightConfig | undefined {
  if (typeof value === 'string') return { engine: value }
  return value
}
