import { useEffect } from 'react'
import { useTabs as useTabsHook } from '../../hooks/use-tabs'
import { Tabs as T } from '../composition/tabs'
import { Link } from '../composition/link'
import type { BoltdocsTab, ComponentRoute } from '@bdocs/runtime'
import { IconRenderer, resolveIcon } from './icon-renderer'
import { getTranslated } from '../../utils/i18n'
import { useRoutes } from '../../hooks/use-routes'
import { cn } from '../../utils/cn'

/**
 * The section tabs, rendered as navigation links.
 *
 * Not an ARIA tabs widget: these move the reader to a different page, and a
 * `tablist` requires `tab` children and fails axe's `aria-required-children`.
 * See the `role="none"` on the list, which is the other half of that decision.
 *
 * Every visible property — the row's centring, the tab metrics, the brand colour
 * of the current section, the underline that tracks it — is in
 * `styles/components/tabs.css`. The two state hooks the stylesheet reads are
 * `data-active` on each link and the measured inline `--bdocs-tab-*` position on
 * the indicator.
 */
export function Tabs({
  tabs,
  routes,
  allRoutes,
  className,
}: {
  tabs: BoltdocsTab[]
  routes: ComponentRoute[]
  allRoutes?: ComponentRoute[]
  className?: string
}) {
  const { currentLocale } = useRoutes()
  const { indicatorStyle, tabRefs, activeIndex } = useTabsHook(tabs, routes)
  const routeCandidates = routes
  const fallbackRouteCandidates = allRoutes || []

  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex]
    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeIndex, tabRefs])

  const renderTabIcon = (iconName?: string) => (
    <IconRenderer icon={resolveIcon(iconName)} size={16} />
  )

  return (
    <div className={cn('bdocs-tabs__row', className)}>
      <T.List role="none" className="bdocs-tabs__list">
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex
          const firstRoute =
            routeCandidates.find(
              (r) => r.tab && r.tab.toLowerCase() === tab.id.toLowerCase(),
            ) ||
            fallbackRouteCandidates.find(
              (r) => r.tab && r.tab.toLowerCase() === tab.id.toLowerCase(),
            )
          const linkTo = firstRoute ? firstRoute.path : '#'

          return (
            <Link
              key={tab.id}
              href={linkTo}
              {...({
                ref: (el: HTMLAnchorElement | null) => {
                  tabRefs.current[index] = el
                },
              } as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
              className="bdocs-tabs__nav-link"
              data-active={isActive || undefined}
            >
              {renderTabIcon(tab.icon)}
              <span>{getTranslated(tab.text, currentLocale)}</span>
            </Link>
          )
        })}
        <T.Indicator style={indicatorStyle} className="bdocs-tabs__indicator" />
      </T.List>
    </div>
  )
}
