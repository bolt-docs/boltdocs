import { Banner } from 'boltdocs/client'
import { Footer } from '@/components/sections/footer'
import HomePage from './_sections/home-page'
import AboutPage from './_sections/about-page'
import ShowcasePage from './_sections/showcase-page'
import RoadmapPage from './_sections/roadmap-page'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { Link } from 'boltdocs/primitives'
import { Navbar } from '@/theme/navbar'

export const pages = {
  '/': HomePage,
  '/about': AboutPage,
  '/showcase': ShowcasePage,
  '/roadmap': RoadmapPage,
}

export const layout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations()
  return (
    <div className="pb-0">
      <Banner
        id="banner-1"
        dismissible
        className="bg-white dark:bg-white text-black dark:text-black group"
      >
        {t.bannerNewVersion}{' '}
        <Link
          href="site:/blog/boltdocs-3.3.0"
          className="underline underline-offset-4 font-semibold"
        >
          {t.bannerReadPost}
        </Link>
        <span>
          <ArrowRight className="size-16 group-hover:translate-x-2 transition-transform " />
        </span>
      </Banner>
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
