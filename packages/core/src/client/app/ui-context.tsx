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

  // Close sidebar on navigation
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname])

  return (
    <UIContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  const context = useContext(UIContext)
  if (context === undefined) {
    // Safe fallback for split bundles, independent component renders, or during SSR
    return {
      isSidebarOpen: false,
      toggleSidebar: () => {},
      closeSidebar: () => {},
    }
  }
  return context
}
