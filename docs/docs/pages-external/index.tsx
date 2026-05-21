import { Navbar } from 'boltdocs/client'
import { Footer } from '../../src/footer'
import HomePage from '../../src/pages/home-page'
import AboutPage from '../../src/pages/about-page'
import { useLocation } from 'react-router-dom'

/**
 * Custom external routes.
 * Maps paths to React components.
 */
export const pages = {
  '/': HomePage,
  '/about': AboutPage,
}

export const layout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation()
  return (
    <div className="pb-0">
      <Navbar />
      {children}
      <Footer key={pathname} />
    </div>
  )
}
