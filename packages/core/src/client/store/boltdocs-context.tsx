import { createContext, use, useMemo, useState, useEffect } from 'react'

const PREFERENCES_KEY = 'boltdocs-user-preferences'

interface PersistedState {
  locale?: string
  version?: string
}

export interface BoltdocsState {
  currentLocale: string
  currentVersion: string
  setLocale: (locale: string) => void
  setVersion: (version: string) => void
  hasHydrated: boolean
  setHasHydrated: (hasHydrated: boolean) => void
}

const BOLTDOCS_CONTEXT_SYMBOL = Symbol.for('__BDOCS_BOLTDOCS_CONTEXT__')
const BOLTDOCS_INSTANCE_SYMBOL = Symbol.for('__BDOCS_BOLTDOCS_INSTANCE__')

const BoltdocsContext =
  (globalThis as any)[BOLTDOCS_CONTEXT_SYMBOL] ||
  ((globalThis as any)[BOLTDOCS_CONTEXT_SYMBOL] = createContext<
    BoltdocsState | undefined
  >(undefined))

export function BoltdocsProvider({
  children,
  initialLocale = '',
  initialVersion = '',
}: {
  children: React.ReactNode
  initialLocale?: string
  initialVersion?: string
}) {
  // Helper to read from storage safely
  const getSavedPrefs = (): PersistedState => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(PREFERENCES_KEY)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  // 1. Lazy state initializers prioritize passed URL state, falling back to LocalStorage preference immediately
  const [locale, setLocaleState] = useState(() => {
    if (initialLocale) return initialLocale
    const prefs = getSavedPrefs()
    return prefs.locale || ''
  })

  const [version, setVersionState] = useState(() => {
    if (initialVersion) return initialVersion
    const prefs = getSavedPrefs()
    return prefs.version || ''
  })

  const [hasHydrated, setHasHydrated] = useState(() => {
    return typeof window !== 'undefined'
  })

  // Ensure the hydrator runs once client is definitely booted
  useEffect(() => {
    setHasHydrated(true)
  }, [])

  const value = useMemo(() => {
    const updateLocale = (l: string) => {
      const newL = l || ''
      setLocaleState(newL)
      if (typeof window !== 'undefined') {
        try {
          const prefs = getSavedPrefs()
          localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({ ...prefs, locale: newL }),
          )
        } catch (e) {
          // Safe fallback: ignore localStorage write failures (e.g., if storage is blocked/disabled)
        }
      }
    }

    const updateVersion = (v: string) => {
      const newV = v || ''
      setVersionState(newV)
      if (typeof window !== 'undefined') {
        try {
          const prefs = getSavedPrefs()
          localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({ ...prefs, version: newV }),
          )
        } catch (e) {
          // Safe fallback: ignore localStorage write failures (e.g., if storage is blocked/disabled)
        }
      }
    }

    return {
      currentLocale: locale,
      currentVersion: version,
      setLocale: updateLocale,
      setVersion: updateVersion,
      hasHydrated,
      setHasHydrated,
    }
  }, [locale, version, hasHydrated])

  // Sync with global registry for dual-package fallback
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any)[BOLTDOCS_INSTANCE_SYMBOL] = value
  }

  return (
    <BoltdocsContext.Provider value={value}>
      {children}
    </BoltdocsContext.Provider>
  )
}

export function useBoltdocsContext() {
  const context = use(BoltdocsContext)

  // Fallback to global registry if context is missing (dual-package hazard safety net)
  if (
    !context &&
    typeof globalThis !== 'undefined' &&
    (globalThis as any)[BOLTDOCS_INSTANCE_SYMBOL]
  ) {
    return (globalThis as any)[BOLTDOCS_INSTANCE_SYMBOL] as BoltdocsState
  }

  if (!context) {
    throw new Error('useBoltdocsContext must be used within a BoltdocsProvider')
  }
  return context as BoltdocsState
}
