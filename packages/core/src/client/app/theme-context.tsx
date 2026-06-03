import { createContext, use, useState, useEffect } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const THEME_CONTEXT_SYMBOL = Symbol.for('__BDOCS_THEME_CONTEXT__')
const THEME_INSTANCE_SYMBOL = Symbol.for('__BDOCS_THEME_INSTANCE__')
const THEME_EVENT = 'boltdocs-theme-change'

const ThemeContext =
  (globalThis as any)[THEME_CONTEXT_SYMBOL] ||
  ((globalThis as any)[THEME_CONTEXT_SYMBOL] = createContext<
    ThemeContextType | undefined
  >(undefined))

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return (localStorage.getItem('boltdocs-theme') as Theme) || 'system'
    }
    return 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
    }
    return 'light'
  })

  const applyTheme = (targetTheme: Theme) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const isDark =
      targetTheme === 'dark' || (targetTheme === 'system' && mediaQuery.matches)

    const root = window.document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.theme = isDark ? 'dark' : 'light'
    setResolvedTheme(isDark ? 'dark' : 'light')
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('boltdocs-theme') as Theme | null
    if (savedTheme) {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      applyTheme('system')
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      const current =
        (localStorage.getItem('boltdocs-theme') as Theme) || 'system'
      if (current === 'system') applyTheme('system')
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('boltdocs-theme', newTheme)
    applyTheme(newTheme)

    // Notify external listeners (dual-package hazard)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: newTheme }))
    }
  }

  const value = { theme, resolvedTheme, setTheme }

  // Sync with global registry
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any)[THEME_INSTANCE_SYMBOL] = value
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = use(ThemeContext)
  const [, forceUpdate] = useState({})

  useEffect(() => {
    if (context) return

    const handler = () => forceUpdate({})
    window.addEventListener(THEME_EVENT, handler)
    return () => window.removeEventListener(THEME_EVENT, handler)
  }, [context])

  // Fallback to global registry for dual-package hazards
  if (
    !context &&
    typeof globalThis !== 'undefined' &&
    (globalThis as any)[THEME_INSTANCE_SYMBOL]
  ) {
    return (globalThis as any)[THEME_INSTANCE_SYMBOL] as ThemeContextType
  }

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context as ThemeContextType
}
