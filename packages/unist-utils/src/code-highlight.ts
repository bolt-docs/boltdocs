import type {
  CodeHighlightConfig as PublicCodeHighlightConfig,
  CodeTheme as PublicCodeTheme,
} from '@bdocs/contracts'

/**
 * Engine-agnostic code highlighting configuration helpers.
 *
 * Shared by `boltdocs` core (config schema, prewarm sites, Shiki adapter) and
 * `@bdocs/processor-satteri` (MDX compile pipeline) so both read
 * `theme.codeHighlighting` through one normalization rule. This lives in the
 * leaf utils package on purpose: core and the processor must not depend on
 * each other at runtime.
 *
 * The public configuration type belongs to `@bdocs/contracts`, and this
 * package reads it rather than declaring a second one. Two definitions of
 * "the highlighting configuration" is how a value produced by the config
 * schema stops being assignable to the function that normalizes it — which
 * is what happened, and what the type checker reported for months.
 */

/**
 * A theme the pipeline can use: a single theme name or a light/dark pair.
 *
 * Narrower than the public theme type on purpose. The public type is open —
 * an engine with its own colour model cannot be enumerated — and the pipeline
 * is not that engine: it passes the theme to engines that take named themes.
 * A theme the pipeline cannot use is dropped rather than passed on as
 * `undefined`s.
 */
export type CodeTheme = string | { light: string; dark: string }

/**
 * The public configuration, with the theme narrowed to what the pipeline uses.
 *
 * The engine keeps its open type: it is a registry that may hand the config
 * to any adapter, including one that understands a theme shape this pipeline
 * does not.
 */
export type NormalizedCodeHighlightConfig = Omit<
  PublicCodeHighlightConfig,
  'theme'
> & {
  theme?: CodeTheme
}

/**
 * Narrows a theme to the shapes the pipeline can use.
 *
 * A string is a theme name. An object with a `light` and a `dark` string is a
 * pair. Anything else — a token map, a class map, a custom engine's own
 * colour model — belongs to an adapter that knows what it means, so it is
 * dropped here and the caller falls back to its own default.
 */
export function normalizeCodeTheme(
  theme: PublicCodeTheme | undefined,
): CodeTheme | undefined {
  if (theme === undefined) return undefined
  if (typeof theme === 'string') return theme
  if (theme && typeof theme === 'object') {
    const candidate = theme as { light?: unknown; dark?: unknown }
    if (
      typeof candidate.light === 'string' &&
      typeof candidate.dark === 'string'
    ) {
      return { light: candidate.light, dark: candidate.dark }
    }
  }
  return undefined
}

/**
 * Normalizes the user-facing `theme.codeHighlighting` value into the shape the
 * pipeline works with.
 *
 * A string shorthand is treated as a highlighter registry id — `'shiki'` is
 * equivalent to `{ engine: 'shiki' }`. `undefined` passes through so
 * `?? codeTheme` fallback chains keep working. Every consumer of
 * `theme.codeHighlighting` must go through this helper instead of reading
 * properties off the raw value, because the raw value may be a string.
 */
export function normalizeCodeHighlightConfig(
  value: PublicCodeHighlightConfig | string | undefined,
): NormalizedCodeHighlightConfig | undefined {
  if (typeof value === 'string') return { engine: value }
  if (!value) return undefined
  return {
    engine: value.engine,
    theme: normalizeCodeTheme(value.theme),
    options: value.options,
  }
}
