import { describe, expect, it } from 'vitest'

/**
 * The seams between core and `@bdocs/runtime`.
 *
 * Every file that used to hold a runtime implementation is now a re-export from
 * `@bdocs/runtime`, and each one is written as an explicit list of names rather
 * than `export *`. That is deliberate: `client/index.ts` does
 * `export type * from './types'`, and `boltdocs/client/router` is a public
 * subpath, so a wildcard off the runtime barrel would quietly publish whatever
 * the runtime grows next through paths that promised something narrower.
 *
 * These assertions are the reason that stays true. A seam that picks up a new
 * name from the runtime fails here instead of reaching a published API.
 */
import * as configContext from '../src/client/app/config-context'
import * as docRouteContext from '../src/client/app/doc-route-context'
import * as mdxComponentsContext from '../src/client/app/mdx-components-context'
import * as routesContext from '../src/client/app/routes-context'
import * as themeContext from '../src/client/app/theme-context'
import * as uiContext from '../src/client/app/ui-context'
import * as i18n from '../src/client/utils/i18n'
import * as path from '../src/client/utils/path'
import * as router from '../src/client/router'
import * as viewTransitions from '../src/client/view-transitions'

/** Runtime exports that exist but are not types, so they show up at runtime. */
function runtimeExports(mod: Record<string, unknown>): string[] {
  return Object.keys(mod).sort()
}

describe('runtime seams keep their original surface', () => {
  it('config-context exports exactly what it exported before the move', () => {
    expect(runtimeExports(configContext)).toEqual([
      'ConfigContext',
      'ConfigProvider',
      'useConfig',
      'useOptionalConfig',
    ])
  })

  it('theme-context exports exactly its four names', () => {
    expect(runtimeExports(themeContext)).toEqual(['ThemeProvider', 'useTheme'])
  })

  it('ui-context exports exactly its two names', () => {
    expect(runtimeExports(uiContext)).toEqual(['UIProvider', 'useUI'])
  })

  it('routes-context exports exactly its runtime names', () => {
    expect(runtimeExports(routesContext)).toEqual([
      'RoutesProvider',
      'createRouteIndex',
      'useRoutesContext',
    ])
  })

  it('doc-route-context exports exactly its three names', () => {
    expect(runtimeExports(docRouteContext)).toEqual([
      'DocRouteContext',
      'DocRouteProvider',
      'useDocRoute',
    ])
  })

  it('mdx-components-context exports exactly its runtime names', () => {
    expect(runtimeExports(mdxComponentsContext)).toEqual([
      'MdxComponentsProvider',
      'useMdxComponents',
    ])
  })

  it('utils/path exports exactly its two functions', () => {
    expect(runtimeExports(path)).toEqual([
      'normalizePath',
      'resolvePublicAssetUrl',
    ])
  })

  it('utils/i18n exports exactly getTranslated', () => {
    expect(runtimeExports(i18n)).toEqual(['getTranslated'])
  })

  it('view-transitions exports exactly its four functions', () => {
    expect(runtimeExports(viewTransitions)).toEqual([
      'prefersReducedMotion',
      'resolveTransitionTypes',
      'startViewTransition',
      'useViewTransition',
    ])
  })

  it('the router seam does not leak the whole runtime', () => {
    // The specific regression this file exists for: the seam was written as
    // `export * from '@bdocs/runtime'`, which made `boltdocs/client/router`
    // also export themes, the config context and the i18n helpers.
    const names = runtimeExports(router)
    expect(names).not.toContain('ThemeProvider')
    expect(names).not.toContain('useConfig')
    expect(names).not.toContain('getTranslated')
    expect(names).not.toContain('resolvePublicAssetUrl')

    // And it must still export the router's own entry points.
    expect(names).toContain('Outlet')
    expect(names).toContain('NavigateContext')
  })

  it('the router seam keeps every name the router used to export', () => {
    // A cross-package `export *` is also what crashed `rolldown-plugin-dts`,
    // so this seam is an explicit list. That makes it possible to drop a name by
    // accident while editing; this is the check that it did not.
    const names = runtimeExports(router)
    for (const expected of [
      'Outlet',
      'OutletContext',
      'NavigateContext',
      'LocationContext',
      'LocationProvider',
      'PrefetchContext',
      'RouteDataContext',
      'MatchesContext',
      'RouteRenderer',
      'useLocation',
      'useNavigate',
      'usePrefetch',
      'useRouteData',
      'useLoaderData',
      'useMatches',
      'buildUrl',
      'resolveUrlReference',
      'parseUrlReference',
      'classifyUrlPath',
      'observeForPrefetch',
      'resetViewportPrefetchObserver',
    ]) {
      expect(names).toContain(expected)
    }
  })
})
