import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  useTheme,
  ThemeProvider,
  Theme,
} from '../../src/client/app/theme-context'
import * as React from 'react'

const TestThemeComponent = () => {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button data-testid="set-light" onClick={() => setTheme('light')}>
        Light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>
        System
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    if (typeof localStorage === 'undefined') {
      const store: Record<string, string> = {}
      global.localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value
        },
        removeItem: (key: string) => {
          delete store[key]
        },
        clear: () => {
          for (const k in store) delete store[k]
        },
        length: 0,
        key: (index: number) => '',
      }
    }
    localStorage.clear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('should provide default theme as system', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(screen.getByTestId('theme').textContent).toBe('system')
  })

  it('should set theme to light', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    await act(async () => {
      screen.getByTestId('set-light').click()
    })
    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(localStorage.getItem('boltdocs-theme')).toBe('light')
  })

  it('should set theme to dark', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    await act(async () => {
      screen.getByTestId('set-dark').click()
    })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(localStorage.getItem('boltdocs-theme')).toBe('dark')
  })

  it('should set theme to system', async () => {
    localStorage.setItem('boltdocs-theme', 'dark')
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    await act(async () => {
      screen.getByTestId('set-system').click()
    })
    expect(screen.getByTestId('theme').textContent).toBe('system')
    expect(localStorage.getItem('boltdocs-theme')).toBe('system')
  })

  it('should persist theme to localStorage', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    await act(async () => {
      screen.getByTestId('set-dark').click()
    })
    expect(localStorage.getItem('boltdocs-theme')).toBe('dark')
  })

  it('should apply theme class to document', async () => {
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    await act(async () => {
      screen.getByTestId('set-dark').click()
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('should load saved theme from localStorage', async () => {
    localStorage.setItem('boltdocs-theme', 'light')
    render(
      <ThemeProvider>
        <TestThemeComponent />
      </ThemeProvider>,
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(screen.getByTestId('theme').textContent).toBe('light')
  })
})
