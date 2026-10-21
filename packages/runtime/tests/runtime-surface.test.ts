import { describe, expect, it } from 'vitest'

/**
 * The public surface of the runtime's own entry points.
 *
 * The runtime is the browser half of Boltdocs, and it publishes two: the
 * barrel and a `./router` subpath. The subpath exists so a consumer that
 * only needs the router does not pull the contexts in with it, and that only
 * holds if the two stay separate.
 *
 * These assertions are the reason that stays true. A barrel that grows a
 * wildcard re-export fails here instead of quietly publishing whatever the
 * package grows next.
 */
import * as router from '../src/router'
import * as configContext from '../src/config-context'
import * as routesContext from '../src/routes-context'
import * as themeContext from '../src/theme-context'
import * as uiContext from '../src/ui-context'
import * as viewTransitions from '../src/view-transitions'

/** Runtime exports that exist but are not types, so they show up at runtime. */
function runtimeExports(mod: Record<string, unknown>): string[] {
  return Object.keys(mod).sort()
}

describe('runtime entry points keep their surface', () => {
  it('config-context exports exactly its four names', () => {
    expect(runtimeExports(configContext)).toEqual([
      'ConfigContext',
      'ConfigProvider',
      'useConfig',
      'useOptionalConfig',
    ])
  })

  it('theme-context exports exactly its two names', () => {
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

  it('view-transitions exports exactly its four functions', () => {
    expect(runtimeExports(viewTransitions)).toEqual([
      'prefersReducedMotion',
      'resolveTransitionTypes',
      'startViewTransition',
      'useViewTransition',
    ])
  })

  it('the router subpath does not leak the rest of the runtime', () => {
    const names = runtimeExports(router)
    expect(names).not.toContain('ThemeProvider')
    expect(names).not.toContain('useConfig')
    expect(names).not.toContain('getTranslated')
    expect(names).not.toContain('resolvePublicAssetUrl')

    // And it must still export the router's own entry points.
    expect(names).toContain('Outlet')
    expect(names).toContain('NavigateContext')
  })

  it('the router subpath keeps every name the router exports', () => {
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
