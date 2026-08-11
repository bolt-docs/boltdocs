import { useMemo } from 'react'
import { parseUrlReference, useLocation } from '../router'
import { useConfig } from '../app/config-context'
import { useRoutesContext } from '../app/routes-context'
import type { ComponentRoute } from '../types'
import { normalizePath } from '../utils/path'

const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')

const getCleanDirectoryMeta = (directoryMeta?: Record<string, any>) => {
  const meta: Record<string, any> = {}
  if (!directoryMeta) return meta

  for (const [key, value] of Object.entries(directoryMeta)) {
    const cleanKey = key
      .split('/')
      .filter((part) => !part.startsWith('(') || !part.endsWith(')'))
      .map((part) => part.replace(/^\d+-/, ''))
      .join('/')
    meta[cleanKey === '' ? '.' : cleanKey] = value
  }
  return meta
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
  directoryMeta: Record<string, any>,
): TreeNode => {
  let currentMap = rootMap
  let parentPath = ''
  let lastNode!: TreeNode

  for (const segment of parts) {
    const currentRelPath = parentPath ? `${parentPath}/${segment}` : segment

    if (!currentMap.has(segment)) {
      const meta = directoryMeta[currentRelPath] || {}
      const newNode: TreeNode = {
        path: '#',
        title: meta.title || capitalize(segment),
        componentPath: '',
        filePath: '',
        icon: meta.icon,
        groupPosition: typeof meta.order === 'number' ? meta.order : 999,
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

interface SidebarGroupData {
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

    const directoryMeta = getCleanDirectoryMeta(config.directoryMeta)

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

      const containerNode = getOrCreateNode(parts, rootNodesMap, directoryMeta)

      if (isIndex) {
        Object.assign(containerNode, {
          path: route.path,
          title: containerNode.hasCustomTitle
            ? containerNode.title
            : route.title || containerNode.title,
          icon: route.icon || containerNode.icon,
          badge: route.badge,
          sidebarPosition: route.sidebarPosition,
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

    return {
      groups,
      ungrouped: finalizeTree(ungrouped as TreeNode[]),
    }
  }, [routes, config, activeTabId, configuredTabs.length, currentPath])

  return {
    ...sidebar,
    activeRoute,
    activePath: currentPath,
    config,
  }
}
