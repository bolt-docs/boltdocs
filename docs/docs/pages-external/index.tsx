import { Banner, Navbar } from 'boltdocs/client'
import { Footer } from '../../src/footer'
import HomePage from './home-page'
import AboutPage from './about-page'
import ShowcasePage from './showcase-page'
import BenchmarkPage from './benchmark-page'
import { useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '../../src/use-translations'
import { Grainient } from '../../src/grainient'
import { color_active_version } from '../../src/color'
import { Link } from 'boltdocs/primitives'

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
        className="group text-white dark:text-white transition-colors duration-200"
      >
        <Grainient
          className="absolute top-0 left-0 -z-[1]"
          {...color_active_version}
        />
        {t.bannerNewVersion}{' '}
        <Link
          href="site:/blog/boltdocs-3.1.0"
          className="underline underline-offset-4 text-white dark:text-white"
        >
          {t.bannerReadPost}
        </Link>
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
