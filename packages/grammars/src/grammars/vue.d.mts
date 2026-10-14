import type { LanguageRegistration } from '@shikijs/types'

/**
 * Types for the vendored grammar `vue.mjs`.
 *
 * Vendored Shiki assets are plain `.mjs` with no declarations of their own, so
 * without this file the import is an implicit `any`. A sibling `.d.mts` is
 * what TypeScript actually resolves for `./vue.mjs`; an ambient
 * `declare module` with a relative name does not take effect.
 */
declare const grammar: LanguageRegistration

export default grammar
