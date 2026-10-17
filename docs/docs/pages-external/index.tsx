import { Banner } from 'boltdocs/client'
import { Footer } from '@/components/sections/footer'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { Link } from 'boltdocs/primitives'
import { Navbar } from '@/theme/navbar'

// Lazy loaders keep each external page in its own client chunk. Static
// component references would pull every landing-page component into the
// entry bundle, making every docs visitor download and parse them.
export const pages = {
  '/': () => import('./_sections/home-page'),
  '/about': () => import('./_sections/about-page'),
  '/showcase': () => import('./_sections/showcase-page'),
  '/roadmap': () => import('./_sections/roadmap-page'),
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
        <span>{t.bannerNewVersion}</span>
        <Link
          href="site:/blog/boltdocs-3.4.0"
          className="underline underline-offset-4 font-semibold group-hover:translate-x-0.5 transition-transform"
        >
          {t.bannerReadPost}
        </Link>
        <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
      </Banner>
      <Navbar />
      {children}
      <Footer />
    </div>
  )
}
