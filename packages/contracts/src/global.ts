/**
 * The `Boltdocs` global namespace and the aliases derived from it.
 *
 * The namespace is declared here and only here. It is augmented by the
 * generated route types a site's `.boltdocs/generated/types.d.ts` picks up, and
 * TypeScript rejects two `declare global` blocks for the same namespace — so
 * it has to have exactly one home.
 *
 * This is the contract layer, which is the only layer both the engine and the
 * browser can depend on. When the declaration lived in the runtime, the engine
 * had to depend on the browser half to re-export these types, and the
 * dependency was a type-only one — which compiles, ships nothing, and quietly
 * welds the engine to the browser anyway.
 *
 * The React-flavoured types stay out of here: the contract layer may not
 * import React, not even as a type. `@bdocs/runtime` refines the ones that
 * need a component type.
 */

/**
 * Global namespace for Boltdocs types that can be augmented by generated code.
 * This allows for strictly typed locales and versions based on the project
 * configuration.
 */
declare global {
  namespace Boltdocs {
    interface Types {}

    /**
     * Marker interface augmented by generated code to provide strict route path
     * typing. When no types have been generated (e.g. before the first dev
     * server start), `keyof` is `never` and the route-path aliases fall back to
     * `string`.
     */
    interface RoutePaths {}
  }
}

export type BoltdocsTypes = Boltdocs.Types

export type BoltdocsRoutePath = keyof Boltdocs.RoutePaths

export type ExternalRouteReference =
  | `/${string}`
  | `#${string}`
  | `?${string}`
  | `site:/${string}`
  | `site:${string}`
  | `http://${string}`
  | `https://${string}`
  | `//${string}`

export type BoltdocsRoutePathWithFallback =
  | BoltdocsRoutePath
  | ExternalRouteReference
  | string

export type BoltdocsLocale = Boltdocs.Types extends { Locale: infer L }
  ? L
  : string

export type BoltdocsVersion = Boltdocs.Types extends { Version: infer V }
  ? V
  : string

export type UnpackMdxComponents<T> = T extends { default: infer D } ? D : T

export type TransformMdxComponents<T> = {
  [K in keyof T as K extends `Frontmatter_${string}` ? never : K]: T[K]
} & {
  Frontmatter: {
    [K in keyof T as K extends `Frontmatter_${infer Name}` ? Name : never]: T[K]
  }
}

/**
 * The MDX component map a site's `mdx-components.tsx` contributes.
 *
 * The component type is a parameter because this layer may not name React: the
 * browser half instantiates it with `ComponentType`, and a consumer that does
 * not care about the component type reads it as `unknown`.
 */
export type BoltdocsMdxComponents<TFallback = unknown> =
  Boltdocs.Types extends {
    MdxComponents: infer M
  }
    ? TransformMdxComponents<UnpackMdxComponents<M>>
    : TFallback
