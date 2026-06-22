import { useEffect } from 'react'
import { useTabs as useTabsHook } from '../../hooks/use-tabs'
import { Tabs as T } from '../primitives/tabs'
import { Link } from '../primitives/link'
import type { BoltdocsTab, ComponentRoute } from '../../types'
import * as DefaultIcons from './icons'
import virtualIcons from 'virtual:boltdocs-icons'
import { getTranslated } from '../../utils/i18n'
import { useRoutes } from '../../hooks/use-routes'
import DOMPurify from 'isomorphic-dompurify'

export function Tabs({
  tabs,
  routes,
}: {
  tabs: BoltdocsTab[]
  routes: ComponentRoute[]
}) {
  const { currentLocale } = useRoutes()
  const { indicatorStyle, tabRefs, activeIndex } = useTabsHook(tabs, routes)

  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex]
    if (activeTab) {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeIndex])

  const renderTabIcon = (iconName?: string) => {
    if (!iconName) return null
    if (iconName.trim().startsWith('<svg')) {
      const clean = DOMPurify.sanitize(iconName, {
        USE_PROFILES: { svg: true },
      })
      return (
        <span className="h-4 w-4" dangerouslySetInnerHTML={{ __html: clean }} />
      )
    }
    const icons = { ...DefaultIcons, ...virtualIcons } as Record<string, any>
    const TabIcon = icons[iconName] || icons[iconName + 'Icon']
    if (TabIcon) {
      return <TabIcon size={16} />
    }
    return <img src={iconName} alt="" className="h-4 w-4 object-contain" />
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-3xl) px-4 md:px-6 select-none">
      <T.List className="border-none py-0 scrollbar-hide relative flex flex-row items-center overflow-x-auto">
        {tabs.map((tab, index) => {
          const isActive = index === activeIndex
          const firstRoute = routes.find(
            (r) => r.tab && r.tab.toLowerCase() === tab.id.toLowerCase(),
          )
          const linkTo = firstRoute ? firstRoute.path : '#'

          return (
            <Link
              key={tab.id}
              href={linkTo}
              ref={(el: HTMLAnchorElement | null) => {
                tabRefs.current[index] = el
              }}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors duration-300 outline-none whitespace-nowrap ${
                isActive ? 'text-primary-500' : 'text-muted hover:text-body'
              }`}
            >
              {renderTabIcon(tab.icon)}
              <span>{getTranslated(tab.text, currentLocale)}</span>
            </Link>
          )
        })}
        <T.Indicator
          style={indicatorStyle}
          className="h-0.5 bg-primary-500 rounded-full transition-all duration-300"
        />
      </T.List>
    </div>
  )
}
