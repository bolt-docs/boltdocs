import { bench, describe } from 'vitest'
import { createRouteIndex } from '../src/client/app/routes-context'
import {
  findCurrentCollectionRoute,
  selectRoutesForContext,
} from '../src/client/hooks/use-routes'
import type { BoltdocsConfig, ComponentRoute } from '../src/client/types'

const config: BoltdocsConfig = {
  base: '/docs',
  i18n: {
    defaultLocale: 'en',
    locales: { en: 'English', es: 'Español' },
  },
  versions: {
    defaultVersion: 'v1',
    versions: [
      { label: 'v1', path: 'v1' },
      { label: 'v2', path: 'v2' },
    ],
  },
}

function createRoutes(count: number): ComponentRoute[] {
  const routes: ComponentRoute[] = []
  const logicalRoutes = Math.floor(count / 4)

  for (let index = 0; index < logicalRoutes; index++) {
    const filePath = `page-${index}.mdx`
    const isCollection = index % 10 === 0
    const collection = isCollection ? 'blog' : undefined
    const contentPath = isCollection
      ? `blog/page-${index}`
      : `guides/page-${index}`
    routes.push(
      {
        path: isCollection ? `/${contentPath}` : `/docs/${contentPath}`,
        componentPath: `/project/docs/${filePath}`,
        filePath,
        title: `Page ${index}`,
        collection,
      },
      {
        path: isCollection ? `/es/${contentPath}` : `/docs/es/${contentPath}`,
        componentPath: `/project/docs/es/${filePath}`,
        filePath,
        title: `Página ${index}`,
        collection,
        locale: 'es',
      },
      {
        path: isCollection
          ? `/v2/es/${contentPath}`
          : `/docs/v2/es/${contentPath}`,
        componentPath: `/project/docs/v2/${filePath}`,
        filePath,
        title: `Page ${index} v2`,
        collection,
        locale: 'es',
        version: 'v2',
      },
      {
        path: isCollection ? `/v2/${contentPath}` : `/docs/v2/${contentPath}`,
        componentPath: `/project/docs/v2/${filePath}`,
        filePath,
        title: `Page ${index} v2`,
        collection,
        version: 'v2',
      },
    )
  }

  while (routes.length < count) {
    const index = routes.length
    routes.push({
      path: `/docs/guides/filler-${index}`,
      componentPath: `/project/docs/filler-${index}.mdx`,
      filePath: `filler-${index}.mdx`,
      title: `Filler ${index}`,
    })
  }

  return routes
}

const fixtures = [1_000, 10_000].map((count) => {
  const routes = createRoutes(count)
  return {
    count,
    routes,
    index: createRouteIndex(routes),
    target: '/blog/page-0',
  }
})

describe('client routing indexes', () => {
  for (const fixture of fixtures) {
    describe(`${fixture.count.toLocaleString('en-US')} routes`, () => {
      bench('build exact route indexes', () => {
        const index = createRouteIndex(fixture.routes)
        if (index.byPath.size !== fixture.count) {
          throw new Error('Incomplete route index benchmark fixture')
        }
      })

      bench('resolve localized collection route', () => {
        const route = findCurrentCollectionRoute(
          fixture.index,
          fixture.target,
          config,
          'en',
          'v1',
        )
        if (!route) throw new Error('Collection route lookup missed')
      })

      bench('filter locale and version variants', () => {
        const countsByFilePath = fixture.index.countsByFilePath
        if (!countsByFilePath) {
          throw new Error('Missing file-path counts benchmark fixture')
        }
        const selected = selectRoutesForContext(fixture.routes, {
          config,
          currentLocale: 'en',
          currentVersion: 'v1',
          isCurrentLocalePrefixed: false,
          isCurrentVersionPrefixed: false,
          countsByFilePath,
        })
        if (selected.length === 0) {
          throw new Error('Route selection benchmark produced no routes')
        }
      })
    })
  }
})
