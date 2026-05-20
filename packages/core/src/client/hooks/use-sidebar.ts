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
    const activeRoute = routes.find((r) => normalizePath(r.path) === currentPath)
    const activeTabId = activeRoute?.tab?.toLowerCase()

    const filteredRoutes = activeTabId
      ? routes.filter((r) => !r.tab || r.tab.toLowerCase() === activeTabId)
      : routes

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


    // 1. Helper to format labels
    const capitalize = (str: string) =>
      str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ')

    // 2. Define recursive tree builder
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
        if (!(lastNode as any)._subMap) {
          ;(lastNode as any)._subMap = new Map<string, ComponentRoute>()
        }
        currentMap = (lastNode as any)._subMap as Map<string, ComponentRoute>
        parentPath = currentRelPath
      }
      return lastNode
    }

    // 3. Sort input routes initially by their internal position/ordering
    const sortedRoutes = [...filteredRoutes].sort((a, b) => {
      const posA = a.sidebarPosition ?? a.order ?? 999
      const posB = b.sidebarPosition ?? b.order ?? 999
      return posA - posB
    })

    // 4. Distribute routes into tree
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

    // 5. Recursive sorting and cleanup helper
    const finalizeTree = (
      nodes: ComponentRoute[],
      currentPathPrefix: string = '',
    ): ComponentRoute[] => {
      nodes.forEach((node) => {
        // 1. Pull child nodes from internal Map store into subRoutes
        if ((node as any)._subMap) {
          const childDirs = Array.from(
            ((node as any)._subMap as Map<string, ComponentRoute>).values(),
          )
          node.subRoutes = [...(node.subRoutes || []), ...childDirs]
          delete (node as any)._subMap
        }

        // 2. Recursively process grandchildren
        if (node.subRoutes && node.subRoutes.length > 0) {
          node.subRoutes = finalizeTree(node.subRoutes)
        }
      })

      // 3. Sort this specific depth layer
      return nodes.sort((a, b) => {
        // Position ordering
        const posA = a.sidebarPosition ?? a.groupPosition ?? 999
        const posB = b.sidebarPosition ?? b.groupPosition ?? 999

        if (posA !== posB) return posA - posB

        // Fallback alphabetical
        return a.title.localeCompare(b.title)
      })
    }

    // Finalize top-level groups
    const rawGroups = Array.from(rootNodesMap.values())
    const finalizedTopNodes = finalizeTree(rawGroups)

    // Map finalized top nodes to expected format [{ title, routes }]
    const groups = finalizedTopNodes.map((node) => {
      // To match current primitives expectations, a 'group' is the top-level container.
      // If the top node is already structured as a ComponentRoute, we wrap it.
      return {
        slug: node.title.toLowerCase().replace(/\s+/g, '-'),
        title: node.title,
        icon: node.icon,
        routes: [node], // The primitives sidebar renderer iterates topGroup.routes and recurses inside.
      }
    })

    // Wait, actually the legacy Sidebar.tsx treats "groups" as visual wrappers with headers,
    // and "routes" inside as the start of items. If we want top-level direct items, they map to 'ungrouped'.
    // Let's return grouped items natively.

    // RE-DESIGN LEGACY COMPATIBILITY:
    // If user wants strict backwards layout, we unwrap the very top layer!
    const legacyCompatibleGroups = finalizedTopNodes
      .map((node) => {
        // Check if it's a container with subitems. If it is, make IT the group header!
        if (node.subRoutes && node.subRoutes.length > 0) {
          return {
            slug: node.title.toLowerCase().replace(/\s+/g, '-'),
            title: node.title,
            icon: node.icon,
            routes: node.subRoutes, // Unwrap children as top-level list underneath the visual group title!
          }
        }
        // If it's standalone, send it to ungrouped
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
