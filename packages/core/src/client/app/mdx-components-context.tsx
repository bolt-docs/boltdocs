import { createContext, use, useMemo } from 'react'
import type { BoltdocsMdxComponents } from '../../shared/types'

export type MdxComponentsType = {
  [key: string]: React.ComponentType<any>
} & {
  Frontmatter?: Record<string, React.ComponentType<any>>
}

const MDX_COMPONENTS_CONTEXT_SYMBOL = Symbol.for(
  '__BDOCS_MDX_COMPONENTS_CONTEXT__',
)
const MDX_COMPONENTS_INSTANCE_SYMBOL = Symbol.for(
  '__BDOCS_MDX_COMPONENTS_INSTANCE__',
)

const MdxComponentsContext =
  (globalThis as any)[MDX_COMPONENTS_CONTEXT_SYMBOL] ||
  ((globalThis as any)[MDX_COMPONENTS_CONTEXT_SYMBOL] =
    createContext<MdxComponentsType>({}))

export function useMdxComponents(): BoltdocsMdxComponents {
  const context = use(MdxComponentsContext)

  // Fallback to global registry for dual-package hazards
  if (
    (!context || Object.keys(context).length === 0) &&
    (globalThis as any)[MDX_COMPONENTS_INSTANCE_SYMBOL]
  ) {
    return (globalThis as any)[
      MDX_COMPONENTS_INSTANCE_SYMBOL
    ] as BoltdocsMdxComponents
  }

  return context as any as BoltdocsMdxComponents
}

export function MdxComponentsProvider({
  components,
  children,
}: {
  components: Record<string, React.ComponentType<any>>
  children: React.ReactNode
}) {
  const processedComponents = useMemo(() => {
    const processed: Record<string, any> = {}
    const frontmatter: Record<string, React.ComponentType<any>> = {}

    Object.entries(components).forEach(([key, value]) => {
      if (key.startsWith('Frontmatter_')) {
        const cleanKey = key.slice('Frontmatter_'.length)
        frontmatter[cleanKey] = value
      } else {
        processed[key] = value
      }
    })

    processed.Frontmatter = frontmatter
    return processed as MdxComponentsType
  }, [components])

  // Sync with global registry
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any)[MDX_COMPONENTS_INSTANCE_SYMBOL] = processedComponents
  }

  return (
    <MdxComponentsContext.Provider value={processedComponents}>
      {children}
    </MdxComponentsContext.Provider>
  )
}
