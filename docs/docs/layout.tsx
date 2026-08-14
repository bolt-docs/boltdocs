import { DocsLayout } from 'boltdocs/client'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <DocsLayout>{children}</DocsLayout>
    </div>
  )
}
