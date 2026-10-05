import { createContext, use, useMemo, type ComponentType } from 'react'
import type { BoltdocsMdxComponents } from './contract-types'

export type MdxComponentsType = {
  // `ComponentType` unparameterised resolves to `ComponentType<any>`, React's
  // default. An MDX component map is keyed by tag name and its members accept
  // whatever the author wrote, so the looseness is inherent rather than lazy.
  [key: string]: ComponentType
} & {
  Frontmatter?: Record<string, ComponentType<{ value: unknown }>>
}

const MDX_COMPONENTS_CONTEXT_SYMBOL = Symbol.for(
  '__BDOCS_MDX_COMPONENTS_CONTEXT__',
)

const registry = globalThis as Record<PropertyKey, unknown>
const existing = registry[MDX_COMPONENTS_CONTEXT_SYMBOL]

if (!existing) {
  registry[MDX_COMPONENTS_CONTEXT_SYMBOL] = createContext<MdxComponentsType>({})
}

const MdxComponentsContext = (existing ??
  registry[MDX_COMPONENTS_CONTEXT_SYMBOL]) as React.Context<MdxComponentsType>

export function useMdxComponents(): BoltdocsMdxComponents {
  return use(MdxComponentsContext) as unknown as BoltdocsMdxComponents
}

export function MdxComponentsProvider({
  components,
  children,
}: {
  components: Record<string, ComponentType>
  children: React.ReactNode
}) {
  const processedComponents = useMemo(() => {
    const processed: Record<string, ComponentType> = {}
    const frontmatter: Record<
      string,
      React.ComponentType<{ value: unknown }>
    > = {}
    let hasFrontmatter = false

    Object.entries(components).forEach(([key, value]) => {
      if (key.startsWith('Frontmatter_')) {
        const cleanKey = key.slice('Frontmatter_'.length)
        frontmatter[cleanKey] = value as ComponentType<{ value: unknown }>
        hasFrontmatter = true
      } else {
        processed[key] = value
      }
    })
    if (hasFrontmatter) {
      ;(processed as MdxComponentsType).Frontmatter = frontmatter
    }

    return processed as MdxComponentsType
  }, [components])

  return (
    <MdxComponentsContext.Provider value={processedComponents}>
      {children}
    </MdxComponentsContext.Provider>
  )
}
