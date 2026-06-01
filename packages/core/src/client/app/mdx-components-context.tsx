import { createContext, use, useMemo } from 'react'
import type { BoltdocsMdxComponents } from '../../shared/types'

export type MdxComponentsType = {
  [key: string]: React.ComponentType<HTMLElement>
} & {
  Frontmatter?: Record<string, React.ComponentType<{ value: unknown }>>
}

const MDX_COMPONENTS_CONTEXT_SYMBOL = Symbol.for(
  '__BDOCS_MDX_COMPONENTS_CONTEXT__',
)

const registry = globalThis as any
if (!registry[MDX_COMPONENTS_CONTEXT_SYMBOL]) {
  registry[MDX_COMPONENTS_CONTEXT_SYMBOL] = createContext<MdxComponentsType>({})
}

const MdxComponentsContext = registry[MDX_COMPONENTS_CONTEXT_SYMBOL]

export function useMdxComponents(): BoltdocsMdxComponents {
  return use(MdxComponentsContext) as unknown as BoltdocsMdxComponents
}

export function MdxComponentsProvider({
  components,
  children,
}: {
  components: Record<string, React.ComponentType<HTMLElement>>
  children: React.ReactNode
}) {
  const processedComponents = useMemo(() => {
    const processed: Record<string, React.ComponentType<HTMLElement>> = {}
    const frontmatter: Record<
      string,
      React.ComponentType<{ value: unknown }>
    > = {}
    let hasFrontmatter = false

    Object.entries(components).forEach(([key, value]) => {
      if (key.startsWith('Frontmatter_')) {
        const cleanKey = key.slice('Frontmatter_'.length)
        frontmatter[cleanKey] = value
        hasFrontmatter = true
      } else {
        processed[key] = value
      }
    })
    if (hasFrontmatter) {
      processed.Frontmatter = frontmatter
    }

    return processed as MdxComponentsType
  }, [components])

  return (
    <MdxComponentsContext.Provider value={processedComponents}>
      {children}
    </MdxComponentsContext.Provider>
  )
}
