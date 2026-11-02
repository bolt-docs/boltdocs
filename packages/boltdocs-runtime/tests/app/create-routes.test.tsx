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
import type { ComponentRoute } from '@bdocs/runtime'
import type * as React from 'react'

/**
 * An element's props.
 *
 * The tests read the props the route elements carry — the metadata, the lazy
 * component, the loader — and a bare React element types them as `unknown`.
 * This is where the test says what it expects to find.
 */
type ElementProps = Record<string, any>

function propsOf(element: unknown): ElementProps {
  return (element as React.ReactElement<ElementProps>).props
}

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
  it('supports array-based locale configuration for external page fallback paths', () => {
    const result = createRoutes({
      routesData: [],
      config: {
        base: '/docs',
        i18n: {
          defaultLocale: 'en',
          locales: ['en', 'es'],
        },
      },
      externalPages: {
        '/about': () => <div>About</div>,
      },
      mdxModules: {},
    })

    const externalPaths = result.routes[0].children
      ?.filter((route) => route.element)
      .map((route) => route.path)

    expect(externalPaths).toContain('/about')
    expect(externalPaths).toContain('/es/about')
  })

  it('should not throw TypeError during SSR module evaluation when i18n is configured', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/en/intro',
        componentPath: '',
        filePath: 'docs/en/intro.md',
        title: 'Intro',
        locale: 'en',
      },
      {
        path: '/docs/es/intro',
        componentPath: '',
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
          en: 'English',
          es: 'Spanish',
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

  it('resolves the docs root fallback to the first configured tab', () => {
    const result = createRoutes({
      routesData: [
        {
          path: '/docs/guides',
          componentPath: '',
          filePath: 'guides/index.md',
          title: 'Guides',
          tab: 'guides',
          slugParts: ['guides'],
        },
        {
          path: '/docs/api',
          componentPath: '',
          filePath: 'api/index.md',
          title: 'API',
          tab: 'api',
          slugParts: ['api'],
        },
      ],
      config: {
        base: '/docs',
        theme: {
          tabs: [
            { id: 'guides', text: 'Guides' },
            { id: 'api', text: 'API' },
          ],
        },
      },
      mdxModules: {
        'guides/index.md': { default: () => <div>Guides</div> },
        'api/index.md': { default: () => <div>API</div> },
      },
    })

    const shellElement = result.routes[0].element as React.ReactElement
    const metadata = propsOf(shellElement).routes as ComponentRoute[]
    const rootMetadata = metadata.find((route) => route.path === '/docs')
    const guidesMetadata = metadata.find(
      (route) => route.path === '/docs/guides',
    )

    expect(rootMetadata?.fallback).toBe(true)
    expect(rootMetadata?.filePath).toBe('guides/index.md')
    expect(rootMetadata?.title).toBe(guidesMetadata?.title)
  })

  it('should copy lazy property and set correct metadata fields on fallback routes', () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/intro',
        componentPath: '',
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
          en: 'English',
          es: 'Spanish',
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

    // createRoutes returns CreateRoutesResult: { routes, RouteRenderer, ... }
    // routes[0] is the root shell route with BoltdocsShell
    const shellElement = result.routes[0].element as
      | React.ReactElement<any>
      | undefined
    const allMetadata = (shellElement?.props?.routes ?? []) as ComponentRoute[]

    // The children list has the parent docs layout route
    const docsLayoutRoute = result.routes[0].children?.find(
      (c) => c.path === '/docs',
    )
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

  it('resolves a locale fallback to the translated MDX module', async () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/intro',
        componentPath: '',
        filePath: 'docs/intro.md',
        title: 'Intro',
        locale: 'en',
      },
      {
        path: '/docs/es/intro',
        componentPath: '',
        filePath: 'es/intro.md',
        title: 'Introducción',
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
    const englishModule = { default: () => <div>English</div> }
    const spanishModule = { default: () => <div>Spanish</div> }

    const result = createRoutes({
      routesData,
      config,
      mdxModules: {
        'docs/intro.md': englishModule,
        'docs/es/intro.md': spanishModule,
      },
    })

    const docsLayoutRoute = result.routes[0].children?.find(
      (route) => route.path === '/docs',
    )
    const esFallback = docsLayoutRoute?.children?.find(
      (route) => route.path === 'es',
    )
    expect(esFallback?.lazy).toBeDefined()

    const lazyResult = (await esFallback?.lazy?.()) as Record<string, any>
    const Component = lazyResult.Component as unknown as (
      props: Record<string, unknown>,
    ) => React.ReactElement
    const element = Component({}) as React.ReactElement
    const eagerElement = propsOf(element).children as React.ReactElement

    const localizedContent = propsOf(eagerElement).moduleLoader.default({})
    expect(propsOf(localizedContent).children).toBe('Spanish')
    expect(propsOf(eagerElement).route.filePath).toBe('es/intro.md')
    expect(propsOf(eagerElement).route.locale).toBe('es')

    const loaderData = (await esFallback?.loader?.({
      request: new Request('http://localhost/docs/es'),
      params: {},
    })) as Record<string, any>
    expect(loaderData.filePath).toBe('es/intro.md')
    expect(loaderData.locale).toBe('es')
    expect(loaderData.frontmatter.title).toBe('Introducción')
  })

  it('keeps the version and locale when resolving a versioned fallback module', async () => {
    const routesData: ComponentRoute[] = [
      {
        path: '/docs/v2/intro',
        componentPath: '',
        filePath: 'v2/intro.md',
        title: 'Intro',
        locale: 'en',
        version: 'v2',
      },
      {
        path: '/docs/v2/es/intro',
        componentPath: '',
        filePath: 'v2/es/intro.md',
        title: 'Introducción',
        locale: 'es',
        version: 'v2',
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
      versions: {
        defaultVersion: 'v2',
        versions: [{ path: 'v2', label: 'Version 2' }],
      },
    }
    const result = createRoutes({
      routesData,
      config,
      mdxModules: {
        'docs/v2/intro.md': { default: () => <div>English v2</div> },
        'docs/v2/es/intro.md': { default: () => <div>Spanish v2</div> },
      },
    })

    const docsLayoutRoute = result.routes[0].children?.find(
      (route) => route.path === '/docs',
    )
    const versionedFallback = docsLayoutRoute?.children?.find(
      (route) => route.path === 'v2/es',
    )
    expect(versionedFallback?.lazy).toBeDefined()

    const lazyResult = (await versionedFallback?.lazy?.()) as Record<
      string,
      any
    >
    const element = (
      lazyResult.Component as (
        props: Record<string, unknown>,
      ) => React.ReactElement
    )({})
    const eagerElement = propsOf(element).children as React.ReactElement
    const localizedContent = propsOf(eagerElement).moduleLoader.default({})

    expect(propsOf(localizedContent).children).toBe('Spanish v2')
    expect(propsOf(eagerElement).route.filePath).toBe('v2/es/intro.md')
    expect(propsOf(eagerElement).route.locale).toBe('es')
    expect(propsOf(eagerElement).route.version).toBe('v2')
  })
})
