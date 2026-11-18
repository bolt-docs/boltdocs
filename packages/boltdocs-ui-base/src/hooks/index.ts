/**
 * The hooks that belong to the look.
 *
 * Navigation, locale and version state live in `@bdocs/runtime`: a second theme
 * asks the same questions and gets the same answers. What stays here is the
 * behaviour a theme owns — tab selection, in-page search highlighting and the
 * feedback widget.
 */
export { useTabs } from './use-tabs'
export { useSearchHighlight } from './use-search-highlight'
export { useFeedback } from './use-feedback'
