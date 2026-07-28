import { DocsLayout, Banner } from 'boltdocs/client'
import { NoiseOverlay } from '../src/components/ui/noise-overlay'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <NoiseOverlay />
      <Banner dismissible id="boltdocs-3.3.0">
        🎉{' '}
        <a
          href="/blog/boltdocs-3.3.0"
          className="underline decoration-primary-500/40 hover:decoration-primary-500 transition-all duration-200"
        >
          Boltdocs 3.3.0 is out — New Plugin API, performance boost, and more!
        </a>
      </Banner>
      <DocsLayout>{children}</DocsLayout>
    </div>
  )
}
