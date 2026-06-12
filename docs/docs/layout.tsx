import { DocsLayout } from 'boltdocs/client'
import { NoiseOverlay } from '../src/noise-overlay'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <NoiseOverlay />
      <DocsLayout>{children}</DocsLayout>
    </div>
  )
}
