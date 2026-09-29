import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MdxPage } from '../../src/client/ssg/mdx-page'

/**
 * The collection layout must not depend on data that arrives asynchronously.
 *
 * The generated client entry declares `hasLoaderData={false}`, so the first
 * client render runs with no loader data. Choosing the layout from the loader
 * therefore picked the documentation layout for a collection post while the
 * server had rendered the collection layout. React compared two different first
 * children and discarded the whole page with hydration error #418.
 *
 * Route metadata is known synchronously, so that is what the layout uses. These
 * tests pin the contract: a caller that passes `collection` gets the collection
 * layout with no loader data at all.
 */

vi.mock('../../src/client/router', () => ({
  useLoaderData: () => useLoaderDataImpl(),
}))

vi.mock('../../src/client/app/doc-page', () => ({
  DocPage: () => createElement('div', { 'data-layout': 'doc' }),
}))

vi.mock('../../src/client/collections/collections-context', () => ({
  CurrentPostProvider: ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-provider': 'post' }, children),
}))

vi.mock('../../src/client/app/mdx-components-context', () => ({
  useMdxComponents: () => ({}),
}))

let useLoaderDataImpl: () => unknown = () => ({})

const Content = () => createElement('p', null, 'post')
const CollectionLayout = () =>
  createElement('article', { 'data-layout': 'collection' })

describe('MdxPage layout selection', () => {
  it('uses the collection layout with no loader data when the route declares it', () => {
    useLoaderDataImpl = () => ({})
    const html = renderToStaticMarkup(
      createElement(MdxPage, {
        MDXComponent: Content,
        mdxComponents: {},
        collectionPostComponent: CollectionLayout,
        collection: 'blog',
        route: {
          path: '/blog/post',
          title: 'Post',
          collection: 'blog',
        } as never,
      }),
    )
    expect(html).toContain('data-layout="collection"')
  })

  it('falls back to the documentation layout for a route with no collection', () => {
    useLoaderDataImpl = () => ({})
    const html = renderToStaticMarkup(
      createElement(MdxPage, {
        MDXComponent: Content,
        mdxComponents: {},
        route: { path: '/docs/page', title: 'Page' } as never,
      }),
    )
    expect(html).toContain('data-layout="doc"')
  })

  it('still honours loader data when no route metadata is passed', () => {
    // Callers that render MdxPage directly have no route prop, so the loader
    // remains the fallback.
    useLoaderDataImpl = () => ({
      collection: 'blog',
      route: { path: '/blog/post', title: 'Post' },
      headings: [],
    })
    const html = renderToStaticMarkup(
      createElement(MdxPage, {
        MDXComponent: Content,
        mdxComponents: {},
        collectionPostComponent: CollectionLayout,
      }),
    )
    expect(html).toContain('data-layout="collection"')
  })

  it('prefers the loader route when both sources are present', () => {
    // The loader copy carries the resolved path, which the route table does not.
    useLoaderDataImpl = () => ({
      collection: 'blog',
      route: { path: '/blog/from-loader', title: 'Post' },
      headings: [{ id: 'a', text: 'A', depth: 2 }],
    })
    const html = renderToStaticMarkup(
      createElement(MdxPage, {
        MDXComponent: Content,
        mdxComponents: {},
        collectionPostComponent: CollectionLayout,
        collection: 'blog',
        route: { path: '/blog/from-route', title: 'Post' } as never,
      }),
    )
    expect(html).toContain('data-provider="post"')
  })
})
