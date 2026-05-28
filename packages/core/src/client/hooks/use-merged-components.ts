import { useMemo } from 'react'
import type { ComponentType } from 'react'
import { useMdxComponents } from '../app/mdx-components-context'

/**
 * Returns a merged components map for use with MDX content renderers.
 *
 * Priority order (highest wins):
 * 1. `propComponents` — passed directly to the page (e.g. from the route loader)
 * 2. Context components — globally registered via `MdxComponentsProvider`
 *
 * @param propComponents - Optional page-level component overrides
 */
export function useMergedComponents(
  propComponents?: Record<string, ComponentType<any>>,
): Record<string, ComponentType<any>> {
  const contextComponents = useMdxComponents()
  return useMemo(
    () => ({
      ...(contextComponents as Record<string, ComponentType<any>>),
      ...(propComponents || {}),
    }),
    [contextComponents, propComponents],
  )
}
