/**
 * Themes for the lightweight highlighter.
 *
 * A theme maps token names to CSS class names. The rendered HTML uses
 * `bd-token-{name}` classes; a site's stylesheet defines the colors.
 *
 * The light and dark themes below ship with sensible defaults but the real
 * styling lives in the theme package's CSS — this package only emits classes,
 * never inline styles.
 */

export interface ThemeMap {
  [tokenName: string]: string
}

export const DEFAULT_TOKEN_CLASS = 'bd-token'

export const LIGHT_THEME: ThemeMap = {
  keyword: 'bd-token-keyword',
  builtin: 'bd-token-builtin',
  type: 'bd-token-type',
  string: 'bd-token-string',
  number: 'bd-token-number',
  comment: 'bd-token-comment',
  function: 'bd-token-function',
  operator: 'bd-token-operator',
  punctuation: 'bd-token-punctuation',
  boolean: 'bd-token-boolean',
  null: 'bd-token-null',
  regex: 'bd-token-regex',
  attribute: 'bd-token-attribute',
  tag: 'bd-token-tag',
  doctype: 'bd-token-doctype',
  entity: 'bd-token-entity',
  directive: 'bd-token-directive',
  interpolation: 'bd-token-interpolation',
  label: 'bd-token-label',
  meta: 'bd-token-meta',
}

export const DARK_THEME: ThemeMap = {
  ...LIGHT_THEME,
}

/**
 * Resolves a CSS class for a token type under the given theme.
 */
export function tokenClass(theme: ThemeMap, type: string): string {
  return theme[type] ?? `${DEFAULT_TOKEN_CLASS}-${type}`
}

export interface CodeTheme {
  light?: string
  dark?: string
  [key: string]: unknown
}

/**
 * Normalizes a theme value into `{ light, dark }` theme names.
 * Accepts a string (single theme for both modes) or a `{ light, dark }` pair.
 */
export function normalizeTheme(
  theme: string | { light: string; dark: string } | undefined,
): {
  light: string
  dark: string
} {
  if (!theme) return { light: 'github-light', dark: 'github-dark' }
  if (typeof theme === 'string') return { light: theme, dark: theme }
  return {
    light: theme.light ?? 'github-light',
    dark: theme.dark ?? 'github-dark',
  }
}
