import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'

export interface LocationState {
  pathname: string
  search: string
  hash: string
}

export type NavigateFunction = (
  to: string,
  options?: { replace?: boolean; state?: any },
) => void

const defaultLocation: LocationState = {
  pathname: '/',
  search: '',
  hash: '',
}

export const LocationContext = createContext<LocationState>(defaultLocation)
export const NavigateContext = createContext<NavigateFunction>(() => {})
export const RouteDataContext = createContext<any>(null)
export const MatchesContext = createContext<any[]>([])

export interface LocationProviderProps {
  pathname?: string
  children: React.ReactNode
  loaderData?: any
  matches?: any[]
}

function getLocationFromWindow(): LocationState {
  if (typeof window === 'undefined') return defaultLocation
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  }
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  pathname: propPathname,
  children,
  loaderData = null,
  matches = [],
}) => {
  const [location, setLocation] = useState<LocationState>(() => {
    if (propPathname) {
      return { pathname: propPathname, search: '', hash: '' }
    }
    return getLocationFromWindow()
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setLocation(getLocationFromWindow())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate: NavigateFunction = useCallback((to, options) => {
    if (typeof window === 'undefined') return
    if (!to) return

    const isExternal = /^https?:\/\//i.test(to) || to.startsWith('//')
    if (isExternal) {
      window.location.href = to
      return
    }

    if (options?.replace) {
      window.history.replaceState(options.state ?? null, '', to)
    } else {
      window.history.pushState(options?.state ?? null, '', to)
    }

    const url = new URL(to, window.location.origin)
    setLocation({
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    })
  }, [])

  return (
    <LocationContext.Provider value={location}>
      <NavigateContext.Provider value={navigate}>
        <RouteDataContext.Provider value={loaderData}>
          <MatchesContext.Provider value={matches}>
            {children}
          </MatchesContext.Provider>
        </RouteDataContext.Provider>
      </NavigateContext.Provider>
    </LocationContext.Provider>
  )
}
