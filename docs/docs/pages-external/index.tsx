import { Banner, Navbar } from 'boltdocs/client'
import { Footer } from '../../src/footer'
import HomePage from './home-page'
import AboutPage from './about-page'
import ShowcasePage from './showcase-page'
import BenchmarkPage from './benchmark-page'
import { useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '../../src/use-translations'

/**
 * Custom external routes.
 * Maps paths to React components.
 */
export const pages = {
  '/': HomePage,
  '/about': AboutPage,
  '/showcase': ShowcasePage,
  '/benchmark': BenchmarkPage,
}

export const layout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation()
  const t = useTranslations()
  return (
    <div className="pb-0">
      <Banner
        id="banner-1"
        dismissible
        className="group dark:bg-white dark:text-black h-10 bg-neutral-800 text-white transition-colors duration-200"
      >
        {t.bannerNewVersion}{' '}
        <a href="/blog/boltdocs-3.1.0" className="underline underline-offset-4">
          {t.bannerReadPost}
        </a>
        <span className="group-hover:translate-x-1 transition-transform duration-300">
          <ArrowRight className="size-4" />
        </span>
      </Banner>
      <Navbar />
      {children}
      <Footer key={pathname} />
    </div>
  )
}
