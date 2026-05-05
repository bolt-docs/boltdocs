import { Navbar } from 'boltdocs/client'
import HomePage from '../../pages/home-page'

/**
 * Custom home page for the site.
 * This overrides any homePage set in boltdocs.config.ts.
 */
export const homePage = HomePage

/**
 * Custom external routes.
 * Maps paths to React components.
 */
export const pages = {
  // Example of an external page:
  // '/roadmap': RoadmapPage,
}

/**
 * Custom layout for external pages.
 */
export const layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-main pb-10">
    <Navbar />
    {children}
    <footer className="py-12 border-t border-white/5 bg-main/50 backdrop-blur-xl">
      <div className="container mx-auto px-6 text-center text-muted">
        <p>© 2026 Boltdocs Glassmorphism Demo</p>
      </div>
    </footer>
  </div>
)
