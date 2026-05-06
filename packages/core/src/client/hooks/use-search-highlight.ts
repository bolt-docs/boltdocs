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
        const terms = query!
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 2)

        if (terms.length > 0) {
          highlightTerms(container!, terms)
        }

        // Re-observe
        observer.observe(container!, { childList: true, subtree: true })
      })
    }

    // Initial run
    run()

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      clearHighlights(containerSelector)
    }
  }, [query, search, containerSelector])
}

function clearHighlights(selector: string) {
  const marks = document.querySelectorAll(
    `${selector} mark[data-search-highlight]`,
  )
  marks.forEach((mark) => {
    try {
      const parent = mark.parentNode
      if (parent && parent.contains(mark)) {
        const text = mark.textContent || ''
        parent.replaceChild(document.createTextNode(text), mark)
      }
    } catch (e) {
      // Ignore DOM errors during cleanup
    }
  })
}

function highlightTerms(container: Element, terms: string[]) {
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
  let node: Node | null
  while ((node = walker.nextNode())) {
    nodes.push(node as Text)
  }

  // Create a combined regex for all terms
  // Accent-insensitive helper: replaces 'a' with '[aáàä...]'
  const accentMap: Record<string, string> = {
    a: '[aáàäâã]',
    e: '[eéèëê]',
    i: '[iíìïî]',
    o: '[oóòöôõ]',
    u: '[uúùüû]',
    n: '[nñ]',
    c: '[cç]',
  }

  const prepareRegex = (term: string) => {
    let pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Make it accent insensitive
    pattern = pattern
      .split('')
      .map((char) => {
        const lower = char.toLowerCase()
        return accentMap[lower] || char
      })
      .join('')
    return pattern
  }

  const combinedPattern = terms.map(prepareRegex).join('|')
  const regex = new RegExp(`(${combinedPattern})`, 'gi')

  nodes.forEach((textNode) => {
    const text = textNode.textContent
    if (text && regex.test(text)) {
      const fragment = document.createDocumentFragment()
      const parts = text.split(regex)

      parts.forEach((part) => {
        const isMatch = terms.some((term) => {
          const p = prepareRegex(term)
          return new RegExp(`^${p}$`, 'i').test(part)
        })

        if (isMatch) {
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
