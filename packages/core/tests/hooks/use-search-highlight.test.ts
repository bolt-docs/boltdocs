import { afterEach, describe, expect, it } from 'vitest'
import {
  clearHighlights,
  highlightTerms,
} from '../../src/client/hooks/use-search-highlight'

const containers: HTMLElement[] = []

function container(html: string): HTMLElement {
  const element = document.createElement('article')
  element.className = 'boltdocs-page'
  element.innerHTML = html
  document.body.appendChild(element)
  containers.push(element)
  return element
}

afterEach(() => {
  clearHighlights('.boltdocs-page')
  for (const element of containers) element.remove()
  containers.length = 0
})

describe('search page highlighting', () => {
  it('treats regex metacharacters as literal search text', () => {
    const root = container('<p>Use config.* and [brackets] safely.</p>')

    highlightTerms(root, ['config.*'])

    const marks = root.querySelectorAll('mark[data-search-highlight]')
    expect([...marks].map((mark) => mark.textContent)).toEqual(['config.*'])
  })

  it('highlights accent variants and handles every term without regex state', () => {
    const root = container(
      '<p>Introducción, Configuration, and a naïve résumé.</p>',
    )

    highlightTerms(root, ['introduccion', 'configuration', 'naive', 'résumé'])

    expect(
      [...root.querySelectorAll('mark[data-search-highlight]')].map(
        (mark) => mark.textContent,
      ),
    ).toEqual(['Introducción', 'Configuration', 'naïve', 'résumé'])
  })

  it('does not highlight code, script, style, or existing marks', () => {
    const root = container(
      '<p>Find token here.</p><pre>token</pre><code>token</code><script>token</script><style>token</style><mark>token</mark>',
    )

    highlightTerms(root, ['token'])

    expect(root.querySelectorAll('p mark')).toHaveLength(1)
    expect(root.querySelector('pre')?.textContent).toBe('token')
    expect(root.querySelector('code')?.textContent).toBe('token')
  })
})
