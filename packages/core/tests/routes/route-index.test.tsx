import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  createRouteIndex,
  RoutesProvider,
  useRoutesContext,
} from '../../src/client/app/routes-context'
import type { ComponentRoute } from '../../src/client/types'
import type { ReactNode } from 'react'

type WrapperProps = { children: ReactNode }

function route(
  path: string,
  filePath: string,
  overrides: Partial<ComponentRoute> = {},
): ComponentRoute {
  return {
    path,
    componentPath: `/project/docs/${filePath}`,
    filePath,
    title: path,
    ...overrides,
  }
}

describe('route index', () => {
  it('indexes collection variants by their exact structural path', () => {
    const english = route('/blog/post', 'post.md', {
      collection: 'blog',
    })
    const spanish = route('/es/blog/post', 'post.md', {
      collection: 'blog',
      locale: 'es',
    })
    const prefixed = route('/docs/releases/v2/es/blog/post/', 'post.md', {
      collection: 'blog',
      locale: 'es',
      version: 'v2',
    })
    const index = createRouteIndex([english, spanish, prefixed])

    expect(index.byCollectionPath?.get('/blog/post')).toEqual([
      english,
      spanish,
      prefixed,
    ])
    expect(index.byPath.get('/docs/releases/v2/es/blog/post')).toBe(prefixed)
    expect(index.hintsByPath.get('/blog/post')).toMatchObject({
      kind: 'collection',
      collection: 'blog',
    })
    expect(index.collectionNames).toEqual(['blog'])
    expect(index.countsByFilePath?.get('post.md')).toBe(3)
  })

  it('reuses indexes while the route array identity is stable', () => {
    const routes = [
      route('/docs/intro', 'intro.md'),
      route('/blog/hello', 'hello.md', { collection: 'blog' }),
    ]
    const wrapper = ({ children }: WrapperProps) => (
      <RoutesProvider routes={routes}>{children}</RoutesProvider>
    )
    const { result, rerender } = renderHook(() => useRoutesContext(), {
      wrapper,
    })
    const firstIndex = result.current.index
    const firstRoutes = result.current.routes

    rerender()

    expect(result.current.routes).toBe(firstRoutes)
    expect(result.current.index).toBe(firstIndex)
    expect(result.current.index.byPath).toBe(firstIndex.byPath)
    expect(result.current.index.byCollectionPath).toBe(
      firstIndex.byCollectionPath,
    )
  })
})
