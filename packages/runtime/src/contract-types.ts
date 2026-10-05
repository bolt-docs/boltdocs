/**
 * The contract types the browser runtime is allowed to know about.
 *
 * These live in `@bdocs/contracts` rather than being re-declared here, and the
 * split is the point: the runtime reads `base`, `i18n`, `versions` and
 * `collections` off the config and nothing else. `vite`, `aliases` and the
 * plugin interfaces describe the build, not the browser, so the core's own
 * `BoltdocsConfig` extends this one rather than the other way round.
 *
 * The `Boltdocs` global namespace is declared here and only here. It is
 * augmented by generated route types that a site's `boltdocs-env.d.ts` picks up
 * through `boltdocs/client`, and TypeScript rejects two `declare global` blocks
 * with the same namespace — so it has to have exactly one home, and the package
 * a consumer imports the augmented types through is the natural place for it.
 */
import type { ComponentType } from 'react'
import type {
  BoltdocsConfigContract,
  BoltdocsViewTransitionsConfig,
} from '@bdocs/contracts'

export type {
  BadgeValue,
  BoltdocsCollectionsConfig,
  BoltdocsSocialLink,
  BoltdocsThemeConfig,
  BoltdocsI18nConfig,
  BoltdocsVersionsConfig,
  BoltdocsViewTransitionsConfig,
  RedirectConfig,
  RedirectStatus,
} from '@bdocs/contracts'

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

export type BoltdocsMdxComponents = Boltdocs.Types extends {
  MdxComponents: infer M
}
  ? TransformMdxComponents<UnpackMdxComponents<M>>
  : Omit<Record<string, ComponentType<unknown>>, 'Frontmatter'> & {
      Frontmatter: Record<string, ComponentType<unknown>>
    }

/**
 * The configuration as the browser sees it.
 *
 * The core's own config extends this with `theme`, `aliases` and `vite`, so a
 * value produced by the build is assignable here without a cast. Nothing in this
 * package reads those three, and typing them in would let runtime code start
 * reaching for build-time state that does not exist in the browser.
 */
export type BoltdocsConfig = BoltdocsConfigContract<unknown>
