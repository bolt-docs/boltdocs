import { useCallback, useMemo } from 'react'
import { parseUrlReference, useLocation } from '../router'
import { useConfig } from '../app/config-context'
import { useRoutesContext } from '../app/routes-context'
import type { ComponentRoute } from '../types'
import { normalizePath } from '../utils/path'

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')

/**
 * Builds a lookup map from meta.json relative-directory keys.
 * Keys keep the locale (`es/...`) and tab (`(guides)/...`) segments so meta
 * resolution can be scoped per tab and per locale; numeric prefixes are
 * stripped and keys are lowercased for stable matching.
 */
const getDirectoryMetaLookup = (
  directoryMeta?: Record<string, any>,
): Record<string, any> => {
  const lookup: Record<string, any> = {}
  if (!directoryMeta) return lookup

  for (const [key, value] of Object.entries(directoryMeta)) {
    const normalizedKey = key
      .split('/')
      .map((part) => part.replace(/^\d+-/, ''))
      .join('/')
      .toLowerCase()
    lookup[normalizedKey] = value
  }
  return lookup
}

/**
 * Resolves the meta.json entry for a sidebar group by trying increasingly
 * specific directory keys: locale + tab, tab, locale, then the bare path.
 * This keeps groups that share a directory name across tabs or locales
 * (e.g. `(guides)/content` vs `(plugins)/content`) from clobbering each
 * other and lets localized sites resolve their own translated meta.
 */
const findDirectoryMeta = (
  lookup: Record<string, any>,
  route: ComponentRoute | undefined,
  relPath: string,
): Record<string, any> | undefined => {
  const locale = route?.locale
  const tab = route?.tab
  const candidates: string[] = []
  if (locale && tab) candidates.push(`${locale}/(${tab})/${relPath}`)
  if (tab) candidates.push(`(${tab})/${relPath}`)
  if (locale) candidates.push(`${locale}/${relPath}`)
  candidates.push(relPath)

  for (const candidate of candidates) {
    const meta = lookup[candidate.toLowerCase()]
    if (meta) return meta
  }
  return undefined
}

interface TreeNode extends ComponentRoute {
  childrenMap?: Map<string, TreeNode>
  collapsible?: boolean
  collapsed?: boolean
  hasCustomTitle?: boolean
}

const getOrCreateNode = (
  parts: string[],
  rootMap: Map<string, TreeNode>,
  directoryMetaLookup: Record<string, any>,
  route: ComponentRoute,
): TreeNode => {
  let currentMap = rootMap
  let parentPath = ''
  let lastNode!: TreeNode

  for (const segment of parts) {
    const currentRelPath = parentPath ? `${parentPath}/${segment}` : segment

    if (!currentMap.has(segment)) {
      const meta =
        findDirectoryMeta(directoryMetaLookup, route, currentRelPath) || {}
      const newNode: TreeNode = {
        path: '#',
        title: meta.title || capitalize(segment),
        componentPath: '',
        filePath: '',
        icon: meta.icon,
        groupPosition: typeof meta.order === 'number' ? meta.order : undefined,
        collapsible: meta.collapsible,
        collapsed: meta.collapsed,
        hasCustomTitle: meta.title !== undefined,
        subRoutes: [],
        childrenMap: new Map(),
      }
      currentMap.set(segment, newNode)
    }

    lastNode = currentMap.get(segment)!
    currentMap = lastNode.childrenMap!
    parentPath = currentRelPath
  }

  return lastNode
}

export interface SidebarGroupData {
  slug: string
  title: string
  icon?: string
  path: string
  filePath: string
  routes: ComponentRoute[]
  sidebarPosition?: number
  collapsible?: boolean
  collapsed?: boolean
}

export type MergedSidebarItem =
  | { type: 'link'; position: number; title: string; route: ComponentRoute }
  | { type: 'group'; position: number; title: string; group: SidebarGroupData }

export interface SidebarNode {
  route: ComponentRoute
  depth: number
  isGroup: boolean
  isActive: boolean
  hasChildren: boolean
  children: SidebarNode[]
}

/**
 * Whether a route (or any of its nested children) matches the active path or
 * the active route's file. Used for group-level active detection and for the
 * `isActive` helper exposed by `useSidebar`.
 */
export function isRouteActive(
  route: ComponentRoute | undefined,
  activePath: string,
  activeRoute?: ComponentRoute,
): boolean {
  if (!route?.path) return false
  const normalizedPath = route.path.endsWith('/')
    ? route.path.slice(0, -1)
    : route.path
  const normalizedActive = activePath.endsWith('/')
    ? activePath.slice(0, -1)
    : activePath

  if (normalizedActive === normalizedPath) return true
  if (
    activeRoute?.filePath &&
    route.filePath &&
    activeRoute.filePath === route.filePath
  )
    return true
  if (route.routes?.some((r) => isRouteActive(r, activePath, activeRoute)))
    return true
  if (route.subRoutes?.some((r) => isRouteActive(r, activePath, activeRoute)))
    return true

  return false
}

/** Whether a route renders as a subgroup (has nested children). */
export function hasChildren(route: ComponentRoute): boolean {
  return !!(route.routes?.length || route.subRoutes?.length)
}

const getRoutePosition = (r: ComponentRoute) =>
  r.sidebarPosition ?? r.order ?? 999
const getNodePosition = (n: ComponentRoute) =>
  n.sidebarPosition ?? n.groupPosition ?? 999

const finalizeTree = (nodes: TreeNode[]): ComponentRoute[] => {
  return nodes
    .map((node) => {
      if (node.childrenMap && node.childrenMap.size > 0) {
        const childDirs = Array.from(node.childrenMap.values())
        node.subRoutes = [...(node.subRoutes || []), ...childDirs]
      }

      const { childrenMap, ...restNode } = node

      if (restNode.subRoutes && restNode.subRoutes.length > 0) {
        restNode.subRoutes = finalizeTree(restNode.subRoutes as TreeNode[])
      }

      return restNode as ComponentRoute
    })
    .sort((a, b) => {
      const posA = getNodePosition(a)
      const posB = getNodePosition(b)
      return posA !== posB ? posA - posB : a.title.localeCompare(b.title)
    })
}

export function useSidebar(routes: ComponentRoute[]) {
  const config = useConfig()
  const { pathname } = useLocation()
  const { index } = useRoutesContext()
  const currentPath = normalizePath(pathname)
  const activeRoute =
    index.byPath.size > 0
      ? index.byPath.get(currentPath)
      : routes.find((route) => normalizePath(route.path) === currentPath)
  const configuredTabs = config.theme?.tabs || []
  const configuredTabIds = new Set(
    configuredTabs.map((tab) => tab.id.toLowerCase()),
  )

  // The docs root is commonly rendered by a generated fallback route. Keep
  // the sidebar scoped to the first tab there instead of showing every tab.
  // For a concrete page, its route metadata remains the source of truth.
  const normalizedBase = normalizePath(config.base || '/docs')
  const routeTabId = activeRoute?.tab?.toLowerCase()
  const parsedCurrentRoute = parseUrlReference(currentPath, config, {
    kind: 'doc',
  })
  const isDocsRoot =
    currentPath === normalizedBase ||
    (Boolean(activeRoute?.fallback) && parsedCurrentRoute.routePath === '/') ||
    (currentPath.startsWith(`${normalizedBase}/`) &&
      parsedCurrentRoute.routePath === '/')
  const activeTabId =
    (isDocsRoot
      ? configuredTabs[0]?.id.toLowerCase()
      : routeTabId && configuredTabIds.has(routeTabId)
        ? routeTabId
        : undefined) || undefined

  const sidebar = useMemo(() => {
    const filteredRoutes = routes
      .filter((r) => !r.collection && !r.sidebarHidden && !r.fallback)
      .filter(
        (r) => !configuredTabs.length || r.tab?.toLowerCase() === activeTabId,
      )
      .sort((a, b) => getRoutePosition(a) - getRoutePosition(b))

    const directoryMeta = getDirectoryMetaLookup(config.directoryMeta)

    const rootNodesMap = new Map<string, TreeNode>()
    const ungrouped: ComponentRoute[] = []

    for (const route of filteredRoutes) {
      const parts = route.slugParts || []
      const isIndex = /^index\.mdx?$/.test(
        route.filePath.split('/').pop() || '',
      )

      if (parts.length === 0) {
        if (route.filePath) ungrouped.push(route)
        continue
      }

      const containerNode = getOrCreateNode(
        parts,
        rootNodesMap,
        directoryMeta,
        route,
      )

      if (isIndex) {
        Object.assign(containerNode, {
          path: route.path,
          title: containerNode.hasCustomTitle
            ? containerNode.title
            : route.title || containerNode.title,
          icon: route.icon || containerNode.icon,
          badge: route.badge,
          // An explicit meta.json order wins over the index page's own
          // sidebarPosition so directory-level ordering stays authoritative.
          sidebarPosition:
            containerNode.groupPosition === undefined
              ? route.sidebarPosition
              : undefined,
          frontmatter: route.frontmatter,
          filePath: route.filePath,
        })
      } else {
        containerNode.subRoutes!.push(route)
      }
    }

    const finalizedTopNodes = finalizeTree(Array.from(rootNodesMap.values()))
    const groups: SidebarGroupData[] = []

    for (const node of finalizedTopNodes) {
      if (node.subRoutes && node.subRoutes.length > 0) {
        const nodeWithMeta = node as TreeNode
        groups.push({
          slug: node.title.toLowerCase().replace(/\s+/g, '-'),
          title: node.title,
          icon: node.icon,
          path: node.path,
          filePath: node.filePath,
          routes: node.subRoutes,
          sidebarPosition: node.sidebarPosition ?? node.groupPosition ?? 999,
          collapsible: nodeWithMeta.collapsible,
          collapsed: nodeWithMeta.collapsed,
        })
      } else {
        ungrouped.push(node)
      }
    }

    const finalizedUngrouped = finalizeTree(ungrouped as TreeNode[])

    const merged: MergedSidebarItem[] = [
      ...finalizedUngrouped.map((route) => ({
        type: 'link' as const,
        position: route.sidebarPosition ?? 999,
        title: route.title,
        route,
      })),
      ...groups.map((group) => ({
        type: 'group' as const,
        position: group.sidebarPosition ?? 999,
        title: group.title,
        group,
      })),
    ].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      if (a.type !== b.type) return a.type === 'link' ? -1 : 1
      return a.title.localeCompare(b.title)
    })

    return {
      groups,
      ungrouped: finalizedUngrouped,
      merged,
    }
  }, [routes, config, activeTabId, configuredTabs.length])

  const isActive = useCallback(
    (route: ComponentRoute): boolean =>
      isRouteActive(route, currentPath, activeRoute),
    [currentPath, activeRoute],
  )

  const isGroupActive = useCallback(
    (group: SidebarGroupData): boolean =>
      group.routes.some((route) =>
        isRouteActive(route, currentPath, activeRoute),
      ),
    [currentPath, activeRoute],
  )

  const tree = useMemo(() => {
    const buildNode = (route: ComponentRoute, depth: number): SidebarNode => {
      const children = route.routes || route.subRoutes || []
      return {
        route,
        depth,
        isGroup: false,
        isActive: isRouteActive(route, currentPath, activeRoute),
        hasChildren: children.length > 0,
        children: children.map((child) => buildNode(child, depth + 1)),
      }
    }
    const buildGroupNode = (group: SidebarGroupData): SidebarNode => ({
      route: group as unknown as ComponentRoute,
      depth: 0,
      isGroup: true,
      isActive: isGroupActive(group),
      hasChildren: true,
      children: group.routes.map((route) => buildNode(route, 1)),
    })
    return sidebar.merged.map((item) =>
      item.type === 'group'
        ? buildGroupNode(item.group)
        : buildNode(item.route, 0),
    )
  }, [sidebar, activeRoute, currentPath, isGroupActive])

  return {
    ...sidebar,
    tree,
    isActive,
    isGroupActive,
    activeRoute,
    activePath: currentPath,
    config,
  }
}
