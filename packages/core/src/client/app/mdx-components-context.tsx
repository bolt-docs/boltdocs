import { createContext, use, useMemo } from 'react'
import type { BoltdocsMdxComponents } from '../../shared/types'

export type MdxComponentsType = {
  [key: string]: React.ComponentType<any>
} & {
  /**
   * A namespace for custom frontmatter field renderers.
   *
   * Register a component as `Frontmatter_<FieldName>` in your `mdx-components.tsx`
   * to override how that frontmatter field is displayed in the blog post sidebar.
   * It receives a single `{ value: unknown }` prop.
   *
   * @example
   * ```tsx
   * // mdx-components.tsx
   * export const Frontmatter_Author = ({ value }) => <MyAuthorCard author={value} />
   * export const Frontmatter_Tags   = ({ value }) => <MyTagList tags={value} />
   * ```
   */
  Frontmatter?: Record<string, React.ComponentType<{ value: unknown }>>
}

/**
 * A globally-deduplicated React Context for MDX components.
 *
 * Uses `Symbol.for` so the same Context object is shared even if the
 * `boltdocs` package is accidentally bundled twice (dual-package hazard).
 * This avoids the need to store the value on `globalThis`.
 */
const MDX_COMPONENTS_CONTEXT_SYMBOL = Symbol.for(
  '__BDOCS_MDX_COMPONENTS_CONTEXT__',
)

const MdxComponentsContext =
  (globalThis as any)[MDX_COMPONENTS_CONTEXT_SYMBOL] ||
  ((globalThis as any)[MDX_COMPONENTS_CONTEXT_SYMBOL] =
    createContext<MdxComponentsType>({}))

/**
 * Returns the merged MDX component map registered for this subtree.
 *
 * Use this inside custom layout components or MDX renderers to access
 * both built-in Boltdocs components and any user-registered overrides.
 */
export function useMdxComponents(): BoltdocsMdxComponents {
  const context = use(MdxComponentsContext)
  return context as unknown as BoltdocsMdxComponents
}

/**
 * Provides the MDX component map to all descendant consumers.
 *
 * Processes `Frontmatter_*` entries in the components map into the
 * nested `Frontmatter` namespace before storing them in context.
 *
 * @example
 * ```tsx
 * <MdxComponentsProvider components={allComponents}>
 *   <App />
 * </MdxComponentsProvider>
 * ```
 */
export function MdxComponentsProvider({
  components,
  children,
}: {
  components: Record<string, React.ComponentType<any>>
  children: React.ReactNode
}) {
  const processedComponents = useMemo(() => {
    const processed: Record<string, any> = {}
    const frontmatter: Record<string, React.ComponentType<{ value: unknown }>> = {}

    Object.entries(components).forEach(([key, value]) => {
      if (key.startsWith('Frontmatter_')) {
        // e.g. "Frontmatter_Author" → stored under Frontmatter.Author
        const cleanKey = key.slice('Frontmatter_'.length)
        frontmatter[cleanKey] = value
      } else {
        processed[key] = value
      }
    })

    processed.Frontmatter = frontmatter
    return processed as MdxComponentsType
  }, [components])

  return (
    <MdxComponentsContext.Provider value={processedComponents}>
      {children}
    </MdxComponentsContext.Provider>
  )
}
