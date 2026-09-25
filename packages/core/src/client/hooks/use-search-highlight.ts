import { useEffect } from 'react'
import { useLocation } from './use-location'

/**
 * Hook to highlight search terms based on the 'hl' query parameter.
 */
export function useSearchHighlight(
  containerSelector: string = '.boltdocs-page',
) {
  const { search } = useLocation()
  const query = new URLSearchParams(search).get('hl')

  useEffect(() => {
    if (!query) {
      clearHighlights(containerSelector)
      return
    }

    const container = document.querySelector(containerSelector)
    if (!container) return
    const target: Element = container

    let rafId: number

    // Observe changes to the content (e.g. navigation or lazy loading)
    const observer = new MutationObserver((mutations) => {
      const hasExternalChanges = mutations.some((m) => {
        const addedNodes = Array.from(m.addedNodes)
        const removedNodes = Array.from(m.removedNodes)

        return (
          addedNodes.some(
            (n) =>
              !(
                n instanceof HTMLElement &&
                n.hasAttribute('data-search-highlight')
              ),
          ) ||
          removedNodes.some(
            (n) =>
              !(
                n instanceof HTMLElement &&
                n.hasAttribute('data-search-highlight')
              ),
          )
        )
      })

      if (hasExternalChanges) {
        run()
      }
    })

    // Function to run highlighting
    function run() {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        // Disconnect to avoid observing our own cleanup/highlight cycle
        observer.disconnect()
        clearHighlights(containerSelector)

        // Split query into individual words (minimum 2 chars)
        const terms = (query ?? '')
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2)

        if (terms.length > 0) {
          highlightTerms(target, terms)
        }

        // Re-observe
        observer.observe(target, { childList: true, subtree: true })
      })
    }

    // Initial run
    run()

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      clearHighlights(containerSelector)
    }
  }, [query, containerSelector])
}

export function clearHighlights(selector: string) {
  const marks = document.querySelectorAll(
    `${selector} mark[data-search-highlight]`,
  )
  marks.forEach((mark) => {
    try {
      const parent = mark.parentNode
      if (parent?.contains(mark)) {
        const text = mark.textContent || ''
        parent.replaceChild(document.createTextNode(text), mark)
      }
    } catch {
      // Ignore DOM errors during cleanup
    }
  })
}

export function createSearchHighlightRegex(terms: string[]): RegExp | null {
  const accentMap: Record<string, string> = {
    a: '[aáàäâãåāăą]',
    c: '[cçćč]',
    d: '[dďđ]',
    e: '[eéèëêėęě]',
    g: '[gğģ]',
    i: '[iíìïîīįı]',
    l: '[lĺļł]',
    n: '[nñńň]',
    o: '[oóòöôõøōő]',
    r: '[rřŕ]',
    s: '[sśšş]',
    t: '[tťţ]',
    u: '[uúùüûūůűų]',
    y: '[yýÿ]',
    z: '[zžźż]',
  }

  const escapeTerm = (term: string) =>
    [...term]
      .map((char) => {
        const lower = char.toLocaleLowerCase()
        return accentMap[lower] ?? char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('')

  const uniqueTerms = [
    ...new Set(terms.map((term) => term.trim()).filter(Boolean)),
  ].sort((left, right) => right.length - left.length)
  if (uniqueTerms.length === 0) return null
  return new RegExp(`(${uniqueTerms.map(escapeTerm).join('|')})`, 'gi')
}

export function highlightTerms(container: Element, terms: string[]) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement
      if (
        parent &&
        (parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE' ||
          parent.tagName === 'MARK' ||
          parent.closest('pre') ||
          parent.closest('code'))
      ) {
        return NodeFilter.FILTER_REJECT
      }
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes: Text[] = []
  let node: Node | null = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  // Escape every metacharacter, then expand individual letters into explicit
  // accent classes. A global RegExp retains lastIndex between calls, so it must
  // be reset before each test (and must never be used to classify split parts).
  const regex = createSearchHighlightRegex(terms)
  if (!regex) return

  nodes.forEach((textNode) => {
    const text = textNode.textContent
    regex.lastIndex = 0
    if (text && regex.test(text)) {
      const fragment = document.createDocumentFragment()
      const parts = text.split(regex)

      parts.forEach((part, index) => {
        if (index % 2 === 1) {
          const mark = document.createElement('mark')
          mark.textContent = part
          mark.setAttribute('data-search-highlight', 'true')
          fragment.appendChild(mark)
        } else if (part) {
          fragment.appendChild(document.createTextNode(part))
        }
      })

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode)
      }
    }
  })
}
