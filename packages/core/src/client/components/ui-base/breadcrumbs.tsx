import { useBreadcrumbs } from '../../hooks/use-breadcrumbs'
import { Home } from 'lucide-react'
import { Breadcrumbs as BreadcrumbsRoot } from '../primitives/breadcrumbs'
import { cn } from '../../utils/cn'
import { useConfig } from '../../app/config-context'

export function Breadcrumbs() {
  const { crumbs, activeRoute } = useBreadcrumbs()
  const config = useConfig()
  const themeConfig = config.theme || {}

  if (crumbs.length === 0) return null

  if (!themeConfig?.breadcrumbs) return null

  return (
    <BreadcrumbsRoot.Root>
      <BreadcrumbsRoot.Item>
        <BreadcrumbsRoot.Link href="/">
          <Home size={14} />
        </BreadcrumbsRoot.Link>
      </BreadcrumbsRoot.Item>
      {crumbs.map((crumb, i) => (
        <BreadcrumbsRoot.Item key={`crumb-${crumb.href}-${crumb.label}-${i}`}>
          <BreadcrumbsRoot.Separator />
          <BreadcrumbsRoot.Link
            href={crumb.href}
            className={cn({
              'font-medium text-body': crumb.href === activeRoute?.path,
            })}
          >
            {crumb.label}
          </BreadcrumbsRoot.Link>
        </BreadcrumbsRoot.Item>
      ))}
    </BreadcrumbsRoot.Root>
  )
}
