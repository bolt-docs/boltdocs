import { useBreadcrumbs } from '../../hooks/use-breadcrumbs'
import { Home } from './icons'
import { Breadcrumbs as BreadcrumbsRoot } from '../primitives/breadcrumbs'
import { cn } from '../../utils/cn'

export function Breadcrumbs() {
  const { crumbs, activeRoute } = useBreadcrumbs()
  if (crumbs.length === 0) return null

  return (
    <BreadcrumbsRoot.Root className="gap-2 text-xs sm:text-sm font-medium">
      <BreadcrumbsRoot.Item>
        <BreadcrumbsRoot.Link
          href="/"
          className="text-muted hover:text-body transition-colors flex items-center"
        >
          <Home size={14} />
        </BreadcrumbsRoot.Link>
      </BreadcrumbsRoot.Item>
      {crumbs.map((crumb, i) => {
        const isActive = crumb.href === activeRoute?.path
        return (
          <BreadcrumbsRoot.Item
            key={`crumb-${crumb.href}-${crumb.label}-${i}`}
            className="gap-2"
          >
            <BreadcrumbsRoot.Separator className="text-muted/40" />
            <BreadcrumbsRoot.Link
              href={crumb.href}
              className={cn(
                'transition-colors',
                isActive
                  ? 'text-body font-semibold cursor-default pointer-events-none'
                  : 'text-muted hover:text-body',
              )}
            >
              {crumb.label}
            </BreadcrumbsRoot.Link>
          </BreadcrumbsRoot.Item>
        )
      })}
    </BreadcrumbsRoot.Root>
  )
}
