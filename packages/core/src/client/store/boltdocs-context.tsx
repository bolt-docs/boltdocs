import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  useEffect,
} from 'react'

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

function getSavedPrefs(): PersistedState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const globalRegistry = globalThis as Record<PropertyKey, unknown>
const existingContext = globalRegistry[BOLTDOCS_CONTEXT_SYMBOL] as
  | React.Context<BoltdocsState | undefined>
  | undefined
const BoltdocsContext =
  existingContext || createContext<BoltdocsState | undefined>(undefined)
if (!existingContext) {
  Reflect.set(globalRegistry, BOLTDOCS_CONTEXT_SYMBOL, BoltdocsContext)
}

export function BoltdocsProvider({
  children,
  initialLocale = '',
  initialVersion = '',
}: {
  children: React.ReactNode
  initialLocale?: string
  initialVersion?: string
}) {
  // Lazy state initializers prioritize passed URL state, falling back to
  // localStorage preference immediately.
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

  const updateLocale = useCallback((l: string) => {
    const newL = l || ''
    setLocaleState((current) => {
      if (current === newL) return current
      return newL
    })
    if (typeof window !== 'undefined') {
      try {
        const prefs = getSavedPrefs()
        if (prefs.locale !== newL) {
          window.localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({ ...prefs, locale: newL }),
          )
        }
      } catch {
        // Safe fallback: ignore localStorage write failures.
      }
    }
  }, [])

  const updateVersion = useCallback((v: string) => {
    const newV = v || ''
    setVersionState((current) => {
      if (current === newV) return current
      return newV
    })
    if (typeof window !== 'undefined') {
      try {
        const prefs = getSavedPrefs()
        if (prefs.version !== newV) {
          window.localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({ ...prefs, version: newV }),
          )
        }
      } catch {
        // Safe fallback: ignore localStorage write failures.
      }
    }
  }, [])

  const value = useMemo(
    () => ({
      currentLocale: locale,
      currentVersion: version,
      setLocale: updateLocale,
      setVersion: updateVersion,
      hasHydrated,
      setHasHydrated,
    }),
    [locale, version, hasHydrated, updateLocale, updateVersion],
  )

  // Sync with global registry for dual-package fallback
  if (typeof globalThis !== 'undefined') {
    Reflect.set(globalThis, BOLTDOCS_INSTANCE_SYMBOL, value)
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
  const globalInstance =
    typeof globalThis !== 'undefined'
      ? (globalThis as Record<PropertyKey, unknown>)[BOLTDOCS_INSTANCE_SYMBOL]
      : undefined

  if (!context && globalInstance) {
    return globalInstance as BoltdocsState
  }

  if (!context) {
    throw new Error('useBoltdocsContext must be used within a BoltdocsProvider')
  }
  return context as BoltdocsState
}
