import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig } from '../app/config-context'
import type { ComponentRoute } from '../types'
import { normalizePath } from '../utils/path'

export function useSidebar(routes: ComponentRoute[]) {
  const config = useConfig()
  const location = useLocation()

  const currentPath = normalizePath(location.pathname)

  return useMemo(() => {
    const activeRoute = routes.find(
      (r) => normalizePath(r.path) === currentPath,
    )
    const activeTabId = activeRoute?.tab?.toLowerCase()

    const noCollection = routes.filter((r) => !r.collection)
    const filteredRoutes = activeTabId
      ? noCollection.filter(
          (r) => !r.tab || r.tab.toLowerCase() === activeTabId,
        )
      : noCollection

    const directoryMeta: Record<string, any> = {}
    if (config.directoryMeta) {
      for (const [key, value] of Object.entries(config.directoryMeta)) {
        const cleanKey = key
          .split('/')
          .filter((part) => !part.startsWith('(') || !part.endsWith(')'))
          .map((part) => part.replace(/^\d+-/, ''))
          .join('/')
        directoryMeta[cleanKey === '' ? '.' : cleanKey] = value
      }
    }

    const capitalize = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')

    const rootNodesMap = new Map<string, ComponentRoute>()
    const ungrouped: ComponentRoute[] = []

    // Helper to find or create nested folders recursively
    const getOrCreateNode = (
      parts: string[],
      rootStore: Map<string, ComponentRoute>,
    ) => {
      let currentMap = rootStore
      let parentPath = ''
      let lastNode: ComponentRoute | null = null

      for (let i = 0; i < parts.length; i++) {
        const segment = parts[i]
        const currentRelPath = parentPath ? `${parentPath}/${segment}` : segment

        if (!currentMap.has(segment)) {
          const meta = directoryMeta[currentRelPath] || {}
          const newNode: ComponentRoute = {
            path: '#', // Placeholder
            title: meta.title || capitalize(segment),
            componentPath: '',
            filePath: '',
            icon: meta.icon,
            groupPosition: typeof meta.order === 'number' ? meta.order : 999,
            subRoutes: [],
          }
          currentMap.set(segment, newNode)
        }

        lastNode = currentMap.get(segment)!

        // Create inner subRoutes mapping helper
        if (!lastNode._subMap) {
          lastNode._subMap = new Map<string, ComponentRoute>()
        }
        currentMap = lastNode._subMap
        parentPath = currentRelPath
      }
      return lastNode
    }

    const sortedRoutes = [...filteredRoutes].sort((a, b) => {
      const posA = a.sidebarPosition ?? a.order ?? 999
      const posB = b.sidebarPosition ?? b.order ?? 999
      return posA - posB
    })

    for (const route of sortedRoutes) {
      if (route.sidebarHidden) continue

      const parts = route.slugParts || []
      const fileName = route.filePath.split('/').pop() || ''
      const isIndex = /^index\.mdx?$/.test(fileName)

      if (parts.length === 0) {
        // Top level route (not in subfolder)
        if (route.filePath) ungrouped.push(route)
        continue
      }

      if (isIndex) {
        // Index files populate the CONTAINER object itself
        const containerNode = getOrCreateNode(parts, rootNodesMap)
        if (containerNode) {
          // Merge properties onto the container so it becomes clickable
          containerNode.path = route.path
          containerNode.title = route.title || containerNode.title
          containerNode.icon = route.icon || containerNode.icon
          containerNode.badge = route.badge
          containerNode.sidebarPosition = route.sidebarPosition
          containerNode.frontmatter = route.frontmatter
        }
      } else {
        // Normal leaf file nested under path
        const parentNode = getOrCreateNode(parts, rootNodesMap)
        if (parentNode) {
          parentNode.subRoutes!.push(route)
        }
      }
    }

    const finalizeTree = (
      nodes: ComponentRoute[],
      currentPathPrefix: string = '',
    ): ComponentRoute[] => {
      nodes.forEach((node) => {
        if (node._subMap) {
          const childDirs = Array.from(node._subMap.values())
          node.subRoutes = [...(node.subRoutes || []), ...childDirs]
          delete node._subMap
        }

        if (node.subRoutes && node.subRoutes.length > 0) {
          node.subRoutes = finalizeTree(node.subRoutes)
        }
      })

      return nodes.sort((a, b) => {
        const posA = a.sidebarPosition ?? a.groupPosition ?? 999
        const posB = b.sidebarPosition ?? b.groupPosition ?? 999
        if (posA !== posB) return posA - posB
        return a.title.localeCompare(b.title)
      })
    }

    const rawGroups = Array.from(rootNodesMap.values())
    const finalizedTopNodes = finalizeTree(rawGroups)

    const groups = finalizedTopNodes.map((node) => {
      return {
        slug: node.title.toLowerCase().replace(/\s+/g, '-'),
        title: node.title,
        icon: node.icon,
        routes: [node],
      }
    })

    const legacyCompatibleGroups = finalizedTopNodes
      .map((node) => {
        if (node.subRoutes && node.subRoutes.length > 0) {
          return {
            slug: node.title.toLowerCase().replace(/\s+/g, '-'),
            title: node.title,
            icon: node.icon,
            routes: node.subRoutes,
          }
        }
        ungrouped.push(node)
        return null
      })
      .filter(Boolean) as any[]

    return {
      groups: legacyCompatibleGroups,
      ungrouped: finalizeTree(ungrouped),
      activeRoute,
      activePath: currentPath,
      config,
    }
  }, [routes, config, currentPath])
}
