import { useEffect } from 'react'
import { useTabs as useTabsHook } from 'boltdocs/client'
import { Tabs as T } from 'boltdocs/primitives'
import { Link } from 'boltdocs/primitives'
import type { BoltdocsTab, ComponentRoute } from 'boltdocs/client'
import { getTranslated } from 'boltdocs/client'
import { useRoutes } from 'boltdocs/client'

export function DocsTabs({
  tabs,
  routes,
  allRoutes,
}: {
  tabs: BoltdocsTab[]
  routes: ComponentRoute[]
  allRoutes?: ComponentRoute[]
}) {
  const { currentLocale } = useRoutes()
  const { indicatorStyle, tabRefs, activeIndex } = useTabsHook(tabs, routes)
  const routeCandidates = routes
  const fallbackRouteCandidates = allRoutes || []

  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex]
    if (activeTab) {
      activeTab.scrollIntoView({
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeIndex, tabRefs])

  return (
    <div className="mx-auto max-w-(--breakpoint-3xl) px-4 md:px-6 max-sm:px-10 select-none">
      <T.List className="border-none py-0 scrollbar-hide relative flex flex-row gap-5 items-center overflow-x-auto">
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
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium outline-none whitespace-nowrap transition-colors ${
                isActive ? 'text-body' : 'text-muted hover:text-body'
              }`}
            >
              <span>{getTranslated(tab.text, currentLocale)}</span>
            </Link>
          )
        })}
        <T.Indicator
          style={indicatorStyle}
          className="h-0.5 bg-body rounded-full transition-[width,transform,opacity] duration-200"
        />
      </T.List>
    </div>
  )
}
