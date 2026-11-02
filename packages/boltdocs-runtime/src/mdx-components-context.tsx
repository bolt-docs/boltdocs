import { createContext, use, useMemo, type ComponentType } from 'react'
import type { BoltdocsMdxComponents } from './contract-types'

/**
 * A component that accepts anything.
 *
 * Written out rather than relying on `ComponentType`'s default, because that
 * default is `{}` in these `@types/react`, not `any`: an unparameterised
 * `ComponentType` means *a component that takes no props*, which is how
 * `<LastUpdated />` stopped accepting its `date` and why that showed up as an
 * `IntrinsicAttributes` error in `doc-page`.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above; there is no other way to say "takes any props"
export type AnyPropsComponent = ComponentType<any>

export type MdxComponentsType = {
  // Keyed by tag name, and each member accepts whatever the author wrote, so the
  // looseness here is inherent to the map rather than a shortcut.
  [key: string]: AnyPropsComponent
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
  components: Record<string, AnyPropsComponent>
  children: React.ReactNode
}) {
  const processedComponents = useMemo(() => {
    const processed: Record<string, AnyPropsComponent> = {}
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
