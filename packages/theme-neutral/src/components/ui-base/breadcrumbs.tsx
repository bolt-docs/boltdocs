import { useBreadcrumbs } from '../../hooks/use-breadcrumbs'
import { Home } from './icons'
import { Breadcrumbs as BreadcrumbsRoot } from '../composition/breadcrumbs'

/**
 * Breadcrumb trail.
 *
 * The active crumb is expressed as `data-active` on the link rather than as a
 * class, so the muted-until-hover behaviour is a stylesheet decision. A site
 * that wants the current page to still be clickable drops one rule.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const { crumbs, activeRoute } = useBreadcrumbs()
  if (crumbs.length === 0) return null

  return (
    <BreadcrumbsRoot.Root className={className}>
      <BreadcrumbsRoot.Item>
        <BreadcrumbsRoot.Link href="/" data-home="">
          <Home size={14} className="bdocs-breadcrumbs__home-icon" />
        </BreadcrumbsRoot.Link>
      </BreadcrumbsRoot.Item>
      {crumbs.map((crumb, i) => {
        const isActive = crumb.href === activeRoute?.path
        return (
          <BreadcrumbsRoot.Item key={`crumb-${crumb.href}-${crumb.label}-${i}`}>
            <BreadcrumbsRoot.Separator />
            <BreadcrumbsRoot.Link
              href={crumb.href ?? ''}
              data-active={isActive || undefined}
            >
              {crumb.label}
            </BreadcrumbsRoot.Link>
          </BreadcrumbsRoot.Item>
        )
      })}
    </BreadcrumbsRoot.Root>
  )
}
