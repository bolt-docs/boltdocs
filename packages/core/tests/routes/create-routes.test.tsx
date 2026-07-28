import { describe, it, expect, vi } from 'vitest'
import { createRoutes } from '../../src/client/ssg/create-routes'
import type { ComponentRoute } from '../../src/client/types'
import type * as React from 'react'

vi.mock('virtual:boltdocs-search', () => ({
  default: async () => [],
}))

vi.mock('virtual:boltdocs-icons', () => ({
  default: {},
}))

vi.mock('virtual:boltdocs-mdx-components', () => ({
  default: {},
}))

vi.mock('virtual:boltdocs-layout', () => ({
  default: {},
}))

describe('createRoutes', () => {
  it('should not throw TypeError during SSR module evaluation when i18n is configured', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/en/intro',
        filePath: 'docs/en/intro.md',
        title: 'Intro',
        locale: 'en',
      },
      {
        path: '/docs/es/intro',
        filePath: 'docs/es/intro.md',
        title: 'Intro (ES)',
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
      'docs/en/intro.md': () =>
        Promise.resolve({ default: () => <div>Intro</div> }),
      'docs/es/intro.md': () =>
        Promise.resolve({ default: () => <div>Intro ES</div> }),
    }

    // This should run without throwing a TypeError
    expect(() => {
      createRoutes({
        routesData,
        config,
        mdxModules,
      })
    }).not.toThrow()
  })

  it('should copy lazy property and set correct metadata fields on fallback routes', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/intro',
        filePath: 'docs/intro.md',
        title: 'Intro',
        locale: 'en',
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
      'docs/intro.md': () =>
        Promise.resolve({ default: () => <div>Intro</div> }),
    }

    const result = createRoutes({
      routesData,
      config,
      mdxModules,
    })

    // The root route element has props containing the flat metadata list (routes)
    const shellElement = result[0].element as React.ReactElement<any>
    const allMetadata = shellElement.props.routes as ComponentRoute[]

    // The children list has the parent docs layout route
    const docsLayoutRoute = result[0].children?.find((c) => c.path === '/docs')
    const docRoutes = docsLayoutRoute?.children || []

    // 1. Check metadata: should contain the fallback route metadata for 'es'
    const esMetadata = allMetadata.find((m) => m.path === '/docs/es')
    expect(esMetadata).toBeDefined()
    expect(esMetadata?.filePath).toBe('docs/intro.md')
    expect(esMetadata?.locale).toBe('es')

    // 2. Check docRoutes: should contain the fallback route path: 'es'
    const esRoute = docRoutes.find((r) => r.path === 'es')
    expect(esRoute).toBeDefined()
    expect(esRoute?.lazy).toBeDefined() // lazy should be copied!
    expect(typeof esRoute?.lazy).toBe('function')
  })
})
