import { useSearchHighlight } from '../../hooks/use-search-highlight'

/**
 * Component that enables search term highlighting on the page.
 * It doesn't render anything visible.
 */
export function SearchHighlight() {
  useSearchHighlight('.boltdocs-page')
  return null
}
