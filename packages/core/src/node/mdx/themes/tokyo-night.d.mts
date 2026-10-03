import type { ThemeRegistration } from '@shikijs/types'

/**
 * Types for the vendored theme `tokyo-night.mjs`.
 *
 * Vendored Shiki assets are plain `.mjs` with no declarations of their own, so
 * without this file the import is an implicit `any`. A sibling `.d.mts` is
 * what TypeScript actually resolves for `./tokyo-night.mjs`; an ambient
 * `declare module` with a relative name does not take effect.
 */
declare const theme: ThemeRegistration

export default theme
