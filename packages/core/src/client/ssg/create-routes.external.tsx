import type { RouteRecord } from '@bdocs/ssg'
import type { ComponentRoute, BoltdocsConfig } from '../types'
import { ExternalPageWrapper } from './external-page-wrapper'

function buildExternalRoutes(options: {
  externalPages?: Record<string, React.ComponentType>
  externalLayout?: React.ComponentType<{ children: React.ReactNode }>
  config: BoltdocsConfig
}): { children: RouteRecord[]; metadata: ComponentRoute[] } {
  const { externalPages, externalLayout, config } = options

  const children: RouteRecord[] = []
  const metadata: ComponentRoute[] = []

  if (!externalPages) return { children, metadata }

  const EffectiveExternalLayout =
    externalLayout ||
    (({ children }: { children: React.ReactNode }) => <>{children}</>)

  Object.entries(externalPages).forEach(
    ([rawPath, ExtComponent]: [string, React.ComponentType]) => {
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`

      metadata.push({
        path,
        locale: config.i18n?.defaultLocale,
        title:
          rawPath === '/'
            ? 'Home'
            : rawPath.replace(/^\//, '').split('/').pop() || 'Page',
        filePath: '',
        componentPath: '',
        headings: [],
      } as unknown as ComponentRoute)

      children.push({
        path,
        element: (
          <ExternalPageWrapper>
            <EffectiveExternalLayout>
              <ExtComponent />
            </EffectiveExternalLayout>
          </ExternalPageWrapper>
        ),
        loader: async () => ({
          path,
          locale: config.i18n?.defaultLocale,
        }),
        getStaticPaths: () => [path],
      })

      if (config.i18n) {
        Object.keys(config.i18n.locales).forEach((locale) => {
          const localePath = `/${locale}${rawPath === '/' ? '' : rawPath}`
          metadata.push({
            path: localePath,
            locale,
            title: rawPath,
            filePath: '',
            componentPath: '',
            headings: [],
          } as unknown as ComponentRoute)

          children.push({
            path: localePath,
            element: (
              <ExternalPageWrapper>
                <EffectiveExternalLayout>
                  <ExtComponent />
                </EffectiveExternalLayout>
              </ExternalPageWrapper>
            ),
            loader: async () => ({
              path: localePath,
              locale,
            }),
            getStaticPaths: () => [localePath],
          })
        })
      }
    },
  )

  return { children, metadata }
}

export { buildExternalRoutes }
