import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig } from '../app/config-context'
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

const getRoutePosition = (r: ComponentRoute) =>
  r.sidebarPosition ?? r.order ?? 999
const getNodePosition = (n: any) => n.sidebarPosition ?? n.groupPosition ?? 999

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

  return useMemo(() => {
    const currentPath = normalizePath(pathname)

    const activeRoute = routes.find(
      (r) => normalizePath(r.path) === currentPath,
    )
    const activeTabId = activeRoute?.tab?.toLowerCase()

    const filteredRoutes = routes
      .filter((r) => !r.collection && !r.sidebarHidden && !r.fallback)
      .filter((r) => !activeTabId || r.tab?.toLowerCase() === activeTabId)
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
          title: route.title || containerNode.title,
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
    const groups: any[] = []

    for (const node of finalizedTopNodes) {
      if (node.subRoutes && node.subRoutes.length > 0) {
        groups.push({
          slug: node.title.toLowerCase().replace(/\s+/g, '-'),
          title: node.title,
          icon: node.icon,
          path: node.path,
          filePath: node.filePath,
          routes: node.subRoutes,
        })
      } else {
        ungrouped.push(node)
      }
    }

    return {
      groups,
      ungrouped: finalizeTree(ungrouped as TreeNode[]),
      activeRoute,
      activePath: currentPath,
      config,
    }
  }, [routes, config, pathname])
}
