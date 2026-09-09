import { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from '../router'

interface UIContextType {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev)
  const closeSidebar = () => setIsSidebarOpen(false)

  // Close sidebar on navigation. The effect re-reads the current path so it
  // re-runs on every URL change (including the initial mount).
  const { pathname } = location
  useEffect(() => {
    if (pathname) setIsSidebarOpen(false)
  }, [pathname])

  return (
    <UIContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (context === undefined) {
    // This happens when a Navbar or Sidebar is rendered outside of a
    // UIProvider (usually a module-instance split between boltdocs/client and
    // boltdocs/primitives). It used to fail silently, which made the mobile
    // sidebar appear completely dead (it never opens) with no error. Warn
    // loudly in the browser so the miswiring is obvious, while keeping the
    // SSR render path safe.
    if (typeof window !== 'undefined') {
      console.warn(
        '[boltdocs] useUI() was called outside of a <UIProvider>. ' +
          'Make sure Navbar/Sidebar are rendered within BoltdocsShell. ' +
          'The mobile sidebar will not open until the provider is shared.',
      )
    }
    return {
      isSidebarOpen: false,
      toggleSidebar: () => {},
      closeSidebar: () => {},
    }
  }
  return context
}
