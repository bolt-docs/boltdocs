import type * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { createRoutes } from '../../src/client/ssg/create-routes'
import {
  matchRouteBranch,
  resolveRouteBranch,
} from '../../src/client/router/renderer'
import { EagerMdxElement } from '../../src/client/ssg/mdx-elements'
import type { ComponentRoute } from '../../src/client/types'

vi.mock('virtual:boltdocs-search', () => ({ default: async () => [] }))
vi.mock('virtual:boltdocs-icons', () => ({ default: {} }))
vi.mock('virtual:boltdocs-mdx-components', () => ({ default: {} }))
vi.mock('virtual:boltdocs-layout', () => ({ default: {} }))

describe('i18n MDX module loading', () => {
  it('loads the correct module for each locale', async () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/guides',
        filePath: '(guides)/index.mdx',
        title: 'Guides',
        locale: 'en',
      },
      {
        path: '/docs/es/guides',
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
          en: { label: 'English' },
          es: { label: 'Spanish' },
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
    const SpanishPage = esRoute!.Component!
    const spanishElement = SpanishPage({}) as React.ReactElement
    expect(spanishElement.props.route.filePath).toBe('es/(guides)/index.mdx')
    const spanishContent = spanishElement.props.moduleLoader.default({})
    expect(spanishContent).toBe('spanish content')
    expect(spanishElement.type).toBe(EagerMdxElement)

    const enBranch = matchRouteBranch(result.routes, '/docs/guides')
    const resolvedEn = await resolveRouteBranch(enBranch)
    const enRoute = resolvedEn.find((route) => route.path === 'guides')
    expect(enRoute?.locale).toBe('en')
    expect(enRoute?.Component).toBeDefined()
    const EnglishPage = enRoute!.Component!
    const englishElement = EnglishPage({}) as React.ReactElement
    expect(englishElement.props.route.filePath).toBe('(guides)/index.mdx')
    const englishContent = englishElement.props.moduleLoader.default({})
    expect(englishContent).toBe('english content')
    expect(englishContent).not.toBe(spanishContent)
  })
})
