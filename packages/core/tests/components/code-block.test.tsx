import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { CodeBlock } from '../../src/client/components/mdx/code-block'

// Mock dependencies that CodeBlock imports
vi.mock('../../src/client/components/mdx/use-copy-button', () => ({
  useCopyButton: () => ({
    copied: false,
    handleCopy: vi.fn(),
  }),
}))

vi.mock('../../src/client/components/mdx/use-expandable', () => ({
  useExpandable: () => ({
    isExpanded: false,
    isExpandable: false,
    shouldTruncate: false,
    toggle: vi.fn(),
    preRef: { current: null },
  }),
}))

vi.mock('../../src/client/components/mdx/use-code-block-feedback', () => ({
  useCodeBlockFeedback: () => ({
    rated: null,
    handleRate: vi.fn(),
    enabled: false,
  }),
}))

vi.mock('../../src/client/components/primitives/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

describe('CodeBlock — whitespace preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders highlightedHtml via dangerouslySetInnerHTML (bypasses JSX whitespace trimming)', () => {
    const shikiHtml =
      '<pre class="shiki"><code>' +
      '<span class="line"><span>import</span> {</span>\n' +
      '<span class="line">  <span>DocsLayout</span>,</span>\n' +
      '<span class="line">  <span>Sidebar</span>,</span>\n' +
      '<span class="line">} <span>from</span> <span>\'boltdocs\'</span></span>' +
      '</code></pre>'

    render(
      <CodeBlock
        data-highlighted="true"
        data-highlighted-html={shikiHtml}
        data-lang="tsx"
      >
        {null}
      </CodeBlock>,
    )

    // The shiki wrapper div should exist with dangerouslySetInnerHTML
    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).not.toBeNull()

    // The HTML should be injected as raw HTML, not as React children
    // Check that indentation whitespace is preserved in the rendered output
    const pre = wrapper!.querySelector('pre')
    expect(pre).not.toBeNull()

    // Verify the indented line is present with spaces
    const codeEl = pre!.querySelector('code')
    expect(codeEl).not.toBeNull()

    // The rendered HTML should contain the indented spans
    const lines = codeEl!.querySelectorAll('.line')
    expect(lines.length).toBe(4)
    // Second line should have leading whitespace preserved
    expect(lines[1].innerHTML).toContain('  <span>DocsLayout</span>')
    expect(lines[2].innerHTML).toContain('  <span>Sidebar</span>')
  })

  it('renders children as fallback when no highlightedHtml is provided', () => {
    render(
      <CodeBlock data-lang="text" plain>
        <pre>const x = 1</pre>
      </CodeBlock>,
    )

    // No shiki-wrapper when no highlightedHtml
    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).toBeNull()

    // Children should be rendered
    expect(screen.getByText('const x = 1')).toBeDefined()
  })

  it('prefers data-highlighted-html over children when both are present', () => {
    const shikiHtml =
      '<pre class="shiki"><code>' +
      '<span class="line"><span>indented code</span></span>' +
      '</code></pre>'

    render(
      <CodeBlock
        data-highlighted="true"
        data-highlighted-html={shikiHtml}
        data-lang="tsx"
      >
        <pre>fallback content</pre>
      </CodeBlock>,
    )

    // Should use the highlightedHtml path
    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.innerHTML).toContain('indented code')

    // Fallback content should NOT be rendered
    expect(screen.queryByText('fallback content')).toBeNull()
  })

  it('handles highlightedHtml prop directly (user component override)', () => {
    const shikiHtml =
      '<pre class="shiki"><code>' +
      '<span class="line"><span>  indented</span></span>' +
      '</code></pre>'

    render(
      <CodeBlock highlightedHtml={shikiHtml} data-lang="tsx">
        {null}
      </CodeBlock>,
    )

    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.innerHTML).toContain('indented')
  })

  it('strips trailing empty line spans from highlightedHtml', () => {
    const htmlWithEmptyLine =
      '<pre class="shiki"><code>' +
      '<span class="line"><span>actual code</span></span>\n' +
      '<span class="line">\n' +
      '</code></pre>'

    render(
      <CodeBlock
        data-highlighted="true"
        data-highlighted-html={htmlWithEmptyLine}
        data-lang="tsx"
      >
        {null}
      </CodeBlock>,
    )

    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).not.toBeNull()
    // The empty trailing line should be stripped
    expect(wrapper!.innerHTML).toContain('actual code')
  })

  it('preserves multi-level indentation in highlightedHtml', () => {
    const deeplyIndented =
      '<pre class="shiki"><code>' +
      '<span class="line"><span>if</span> (x) {</span>\n' +
      '<span class="line">  <span>if</span> (y) {</span>\n' +
      '<span class="line">    <span>return</span> {</span>\n' +
      '<span class="line">      deeply: <span>true</span>,</span>\n' +
      '<span class="line">    }</span>\n' +
      '<span class="line">  }</span>\n' +
      '<span class="line">}</span>' +
      '</code></pre>'

    render(
      <CodeBlock
        data-highlighted="true"
        data-highlighted-html={deeplyIndented}
        data-lang="tsx"
      >
        {null}
      </CodeBlock>,
    )

    const wrapper = document.querySelector('.shiki-wrapper')
    expect(wrapper).not.toBeNull()

    const codeEl = wrapper!.querySelector('code')
    const lines = codeEl!.querySelectorAll('.line')
    expect(lines.length).toBe(7)

    // Verify each level of indentation is preserved
    expect(lines[1].innerHTML).toContain('  <span>if</span>')
    expect(lines[2].innerHTML).toContain('    <span>return</span>')
    expect(lines[3].innerHTML).toContain('      deeply:')
    expect(lines[4].innerHTML).toContain('    }')
    expect(lines[5].innerHTML).toContain('  }')
  })
})
