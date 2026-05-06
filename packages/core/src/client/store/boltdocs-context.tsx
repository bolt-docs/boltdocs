import { createContext, use, useMemo, useState } from 'react'

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
  const getInitialState = () => {
    if (typeof window === 'undefined')
      return { locale: initialLocale, version: initialVersion }
    const parts = window.location.pathname.split('/').filter(Boolean)
    const locale = initialLocale
    const version = initialVersion
    // ...
    return { locale, version }
  }

  const initialState = getInitialState()
  const [locale, setLocale] = useState(initialState.locale)
  const [version, setVersion] = useState(initialState.version)
  const [hasHydrated, setHasHydrated] = useState(false)

  const value = useMemo(
    () => ({
      currentLocale: locale,
      currentVersion: version,
      setLocale: (l: string) => setLocale(l || ''),
      setVersion: (v: string) => setVersion(v || ''),
      hasHydrated,
      setHasHydrated,
    }),
    [locale, version, hasHydrated],
  )

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
