import { describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'

import { getTranslated } from '../src/i18n'
import { ConfigContext, useConfig } from '../src/config-context'
import { ThemeProvider, useTheme } from '../src/theme-context'
import {
  RoutesProvider,
  createRouteIndex,
  useRoutesContext,
} from '../src/routes-context'
import type { ComponentRoute } from '../src/types'

/**
 * The contexts a theme or a custom layout render against.
 *
 * The property under test here is the one that decides whether a package can be
 * consumed at all: each context survives being mounted twice, in two different
 * module instances, without the two providers disagreeing. A page that renders a
 * preview inside itself mounts a second copy of the shell, and if the contexts
 * were ordinary React contexts the inner provider would hand its consumer a
 * different config than the shell intended.
 */

const config = {
  base: '/docs',
  i18n: { locales: ['en', 'es'], defaultLocale: 'en' },
} as never

describe('ConfigContext', () => {
  it('throws a named error when used without a provider', () => {
    // React logs a component stack for a throw during render, which is noise
    // next to the assertion the test is actually making.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useConfig())).toThrow(
      /useConfig must be used within a ConfigProvider/,
    )
    spy.mockRestore()
  })

  it('reads the config through the provider', () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <ConfigContext.Provider value={config}>
          {children}
        </ConfigContext.Provider>
      )
    }
    const { result } = renderHook(() => useConfig(), { wrapper: Wrapper })
    expect(result.current.base).toBe('/docs')
  })
})

describe('ConfigContext is a singleton across module instances', () => {
  it('is registered on the global registry under a stable symbol', () => {
    const symbol = Symbol.for('__BDOCS_CONFIG_CONTEXT__')
    expect((globalThis as Record<PropertyKey, unknown>)[symbol]).toBe(
      ConfigContext,
    )
  })
})

describe('getTranslated', () => {
  it('passes a plain string through and empties an absent one', () => {
    expect(getTranslated('Hello', 'es')).toBe('Hello')
    expect(getTranslated(undefined, 'es')).toBe('')
  })

  it('prefers the requested locale', () => {
    expect(getTranslated({ en: 'Docs', es: 'Documentación' }, 'es')).toBe(
      'Documentación',
    )
    expect(getTranslated({ en: 'Docs', es: 'Documentación' }, 'en')).toBe(
      'Docs',
    )
  })

  it('falls back to some available translation rather than blanking out', () => {
    // Not to the default locale specifically — to whatever exists. A missing
    // translation must not produce an empty label, which is how a translated
    // navbar ends up with invisible buttons.
    expect(getTranslated({ en: 'Docs' }, 'fr')).toBe('Docs')
    expect(getTranslated({}, 'fr')).toBe('')
  })
})

describe('ThemeProvider', () => {
  it('resolves the system preference to an explicit theme', () => {
    function Probe() {
      const { theme, resolvedTheme } = useTheme()
      return (
        <span data-testid="theme">
          {theme}:{resolvedTheme}
        </span>
      )
    }
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )
    expect(screen.getByTestId('theme').textContent).toMatch(
      /^(light|dark|system):(light|dark)$/,
    )
  })
})

describe('RoutesProvider', () => {
  it('indexes routes by path and prefix so lookups resolve', () => {
    const routes = [
      { path: '/docs/a', title: 'A' },
      { path: '/docs/b', title: 'B' },
    ] as ComponentRoute[]

    const index = createRouteIndex(routes)
    expect(index.byPath.get('/docs/a')?.title).toBe('A')
    // Every route gets a hint, even a plain doc route: the router reads
    // `hintsByPath` for every navigation, and a route missing from it is a route
    // that cannot be classified.
    expect(index.hintsByPath.get('/docs/b')?.path).toBe('/docs/b')
    expect(index.collectionNames).toEqual([])

    function Probe() {
      const { index: live } = useRoutesContext()
      return <span data-testid="count">{live.byPath.size}</span>
    }
    render(
      <RoutesProvider routes={routes}>
        <Probe />
      </RoutesProvider>,
    )
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
