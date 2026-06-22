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

interface GlobalThemeStore {
  [THEME_CONTEXT_SYMBOL]?: React.Context<ThemeContextType | undefined>
  [THEME_INSTANCE_SYMBOL]?: ThemeContextType
}

function isValidTheme(value: string): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

const globalStore = globalThis as GlobalThemeStore
const ThemeContext =
  globalStore[THEME_CONTEXT_SYMBOL] ??
  createContext<ThemeContextType | undefined>(undefined)
globalStore[THEME_CONTEXT_SYMBOL] = ThemeContext

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('boltdocs-theme')
        return raw && isValidTheme(raw) ? raw : 'system'
      } catch {}
    }
    return 'system'
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light')

  const applyTheme = (targetTheme: Theme) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const isDark =
      targetTheme === 'dark' || (targetTheme === 'system' && mediaQuery.matches)

    const root = window.document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.theme = isDark ? 'dark' : 'light'
    setResolvedTheme(isDark ? 'dark' : 'light')
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: we only want to run this on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('boltdocs-theme')
      const savedTheme = raw && isValidTheme(raw) ? raw : null
      if (savedTheme) {
        setThemeState(savedTheme)
        applyTheme(savedTheme)
      } else {
        applyTheme('system')
      }
    } catch {}

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      try {
        const raw = window.localStorage.getItem('boltdocs-theme')
        const current = raw && isValidTheme(raw) ? raw : 'system'
        if (current === 'system') applyTheme('system')
      } catch {}
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      window.localStorage.setItem('boltdocs-theme', newTheme)
    } catch {}
    applyTheme(newTheme)

    // Notify external listeners (dual-package hazard)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: newTheme }))
    }
  }

  const value = { theme, resolvedTheme, setTheme }

  // Sync with global registry
  if (typeof globalThis !== 'undefined') {
    globalStore[THEME_INSTANCE_SYMBOL] = value
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
    globalStore[THEME_INSTANCE_SYMBOL]
  ) {
    return globalStore[THEME_INSTANCE_SYMBOL]
  }

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context as ThemeContextType
}
