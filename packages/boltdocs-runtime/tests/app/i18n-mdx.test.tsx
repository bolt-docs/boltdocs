import type * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { createRoutes as build } from '../../src/app/create-routes'
import { testTheme } from '../test-theme'

/**
 * The builder, bound to the test theme.
 *
 * The engine takes the theme as an argument now, and every case here is about
 * the route table rather than the look, so binding it once keeps the call
 * sites reading the same way they did when the theme was an import.
 */
const createRoutes = (options: Parameters<typeof build>[0]) =>
  build(options, testTheme)
import { matchRouteBranch, resolveRouteBranch } from '@bdocs/runtime'
import { EagerMdxElement } from '../../src/app/mdx-elements'
import type { ComponentRoute } from '@bdocs/runtime'

/**
 * An element's props.
 *
 * The test reads the props the route elements carry, and a bare React
 * element types them as `unknown`.
 */
type ElementProps = Record<string, any>

function propsOf(element: unknown): ElementProps {
  return (element as React.ReactElement<ElementProps>).props
}

vi.mock('virtual:boltdocs-search', () => ({ default: async () => [] }))
vi.mock('virtual:boltdocs-icons', () => ({ default: {} }))
vi.mock('virtual:boltdocs-mdx-components', () => ({ default: {} }))
vi.mock('virtual:boltdocs-layout', () => ({ default: {} }))

describe('i18n MDX module loading', () => {
  it('loads the correct module for each locale', async () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/guides',
        componentPath: '',
        filePath: '(guides)/index.mdx',
        title: 'Guides',
        locale: 'en',
      },
      {
        path: '/docs/es/guides',
        componentPath: '',
        filePath: 'es/(guides)/index.mdx',
        title: 'Guías',
        locale: 'es',
      },
    ]

    const config = {
      base: '/docs',
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'English',
          es: 'Spanish',
        },
      },
    }

    const mdxModules = {
      '/docs/(guides)/index.mdx': { default: () => 'english content' },
      '/docs/es/(guides)/index.mdx': { default: () => 'spanish content' },
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules,
    })

    const esBranch = matchRouteBranch(result.routes, '/docs/es/guides')
    expect(esBranch.length).toBeGreaterThan(0)
    const resolvedEs = await resolveRouteBranch(esBranch)
    const esRoute = resolvedEs.find((route) => route.path === 'es/guides')
    expect(esRoute?.locale).toBe('es')
    expect(esRoute?.Component).toBeDefined()
    const SpanishPage = esRoute!.Component as unknown as (
      props: Record<string, unknown>,
    ) => React.ReactElement
    const spanishElement = SpanishPage({}) as React.ReactElement
    expect(propsOf(spanishElement).route.filePath).toBe('es/(guides)/index.mdx')
    const spanishContent = propsOf(spanishElement).moduleLoader.default({})
    expect(spanishContent).toBe('spanish content')
    expect(spanishElement.type).toBe(EagerMdxElement)

    const enBranch = matchRouteBranch(result.routes, '/docs/guides')
    const resolvedEn = await resolveRouteBranch(enBranch)
    const enRoute = resolvedEn.find((route) => route.path === 'guides')
    expect(enRoute?.locale).toBe('en')
    expect(enRoute?.Component).toBeDefined()
    const EnglishPage = enRoute!.Component as unknown as (
      props: Record<string, unknown>,
    ) => React.ReactElement
    const englishElement = EnglishPage({}) as React.ReactElement
    expect(propsOf(englishElement).route.filePath).toBe('(guides)/index.mdx')
    const englishContent = propsOf(englishElement).moduleLoader.default({})
    expect(englishContent).toBe('english content')
    expect(englishContent).not.toBe(spanishContent)
  })
})
