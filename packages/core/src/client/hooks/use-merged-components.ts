import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { useMdxComponents } from '../app/mdx-components-context'
import type { MdxComponentsType } from '../app/mdx-components-context' // Asegúrate de importar el tipo

export function useMergedComponents(
  propComponents?: Record<string, ComponentType<any>>,
): MdxComponentsType {
  const contextComponents = useMdxComponents() as unknown as MdxComponentsType

  return useMemo(() => {
    if (!propComponents) return contextComponents

    const merged: Record<string, any> = { ...contextComponents }

    const mergedFrontmatter = { ...(contextComponents.Frontmatter || {}) }
    let hasPropFrontmatter = false

    Object.entries(propComponents).forEach(([key, value]) => {
      if (key.startsWith('Frontmatter_')) {
        const cleanKey = key.slice('Frontmatter_'.length)
        mergedFrontmatter[cleanKey] = value
        hasPropFrontmatter = true
      } else if (key === 'Frontmatter' && value && typeof value === 'object') {
        Object.assign(mergedFrontmatter, value)
        hasPropFrontmatter = true
      } else {
        merged[key] = value
      }
    })

    if (hasPropFrontmatter || contextComponents.Frontmatter) {
      merged.Frontmatter = mergedFrontmatter
    }

    return merged as MdxComponentsType
  }, [contextComponents, propComponents])
}
