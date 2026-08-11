import { createElement, lazy, Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { renderStaticApp } from '../src/node/serverRenderer'

const LazyContent = lazy(async () => ({
  default: () => createElement('span', null, 'resolved content'),
}))

describe('renderStaticApp', () => {
  it('waits for lazy Suspense content during static rendering', async () => {
    const html = await renderStaticApp(
      createElement(
        Suspense,
        { fallback: createElement('span', null, 'loading') },
        createElement(LazyContent),
      ),
    )

    expect(html).toContain('resolved content')
    expect(html).not.toContain('loading')
  })

  it('preserves Unicode content while decoding streamed output', async () => {
    const html = await renderStaticApp(
      createElement('p', null, 'Performance 🚀 — documentación 中文 العربية'),
    )

    expect(html).toContain('Performance 🚀 — documentación 中文 العربية')
  })
})
