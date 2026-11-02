/**
 * The contract types the browser runtime is allowed to know about.
 *
 * These live in `@bdocs/contracts` rather than being re-declared here, and the
 * split is the point: the runtime reads `base`, `i18n`, `versions` and
 * `collections` off the config and nothing else. `vite`, `aliases` and the
 * plugin interfaces describe the build, not the browser, so the core's own
 * `BoltdocsConfig` extends this one rather than the other way round.
 *
 * The `Boltdocs` global namespace is declared in the contract layer too. It
 * used to be declared here, and that put the engine in a type-only dependency
 * on the browser half: the engine re-exported these types, so it needed the
 * runtime installed to type-check, and the dependency was invisible because a
 * type-only import ships nothing.
 */
import type { ComponentType } from 'react'
import type { BoltdocsConfigContract } from '@bdocs/contracts'

export type {
  BadgeValue,
  BoltdocsCollectionsConfig,
  BoltdocsLocale,
  BoltdocsRoutePath,
  BoltdocsRoutePathWithFallback,
  BoltdocsSocialLink,
  BoltdocsThemeConfig,
  BoltdocsI18nConfig,
  BoltdocsTypes,
  BoltdocsVersion,
  BoltdocsVersionsConfig,
  BoltdocsViewTransitionsConfig,
  ExternalRouteReference,
  RedirectConfig,
  RedirectStatus,
  RouteContributor,
  TransformMdxComponents,
  UnpackMdxComponents,
} from '@bdocs/contracts'

/**
 * The MDX component map, with React's component type.
 *
 * The contract layer owns the shape and cannot name React, so the browser
 * half instantiates its generic with the component type it actually renders.
 */
export type BoltdocsMdxComponents =
  import('@bdocs/contracts').BoltdocsMdxComponents<
    Omit<Record<string, ComponentType<unknown>>, 'Frontmatter'> & {
      Frontmatter: Record<string, ComponentType<unknown>>
    }
  >

/**
 * The configuration as the browser sees it.
 *
 * The core's own config extends this with `theme`, `aliases` and `vite`, so a
 * value produced by the build is assignable here without a cast. Nothing in this
 * package reads those three, and typing them in would let runtime code start
 * reaching for build-time state that does not exist in the browser.
 */
export type BoltdocsConfig = BoltdocsConfigContract<unknown>
