import { describe, it, expect, vi } from 'vitest'
import { createRoutes } from '../../src/client/ssg/create-routes'
import type { ComponentRoute } from '../../src/client/types'
import * as React from 'react'

vi.mock('virtual:boltdocs-search', () => ({
  default: [],
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
      'docs/en/intro.md': () => Promise.resolve({ default: () => <div>Intro</div> }),
      'docs/es/intro.md': () => Promise.resolve({ default: () => <div>Intro ES</div> }),
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
})
