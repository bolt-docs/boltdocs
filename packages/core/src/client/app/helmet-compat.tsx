/**
 * Shared Helmet module compatibility helpers.
 *
 * react-helmet-async ships different module shapes depending on whether it is
 * loaded via CJS or ESM. Instead of duplicating the same detection logic in
 * every component that needs Helmet/HelmetProvider, we centralise it here.
 *
 * During SSG, `@bdocs/ssg`'s remix adapter uses `require('react-helmet-async')`
 * which loads a SEPARATE CJS module instance from the bundled ESM version.
 * To ensure both share the same React context, we store the HelmetProvider on
 * `globalThis` so the runtime-loaded remix adapter can use the same instance.
 */
import type { ComponentType, ReactNode } from 'react'
import * as ReactHelmetAsync from 'react-helmet-async'

type HelmetModule = {
  Helmet?: ComponentType<{ children?: ReactNode }>
  HelmetProvider?: ComponentType<{ children?: ReactNode }>
  default?: {
    Helmet?: ComponentType<{ children?: ReactNode }>
    HelmetProvider?: ComponentType<{ children?: ReactNode }>
  }
}

const mod = ReactHelmetAsync as unknown as HelmetModule

/**
 * The `<Helmet>` component, resolved across CJS/ESM module shapes.
 * Falls back to a transparent fragment wrapper if the module cannot be resolved.
 */
export const Helmet: ComponentType<{ children?: ReactNode }> =
  mod.Helmet || mod.default?.Helmet || (({ children }) => <>{children}</>)

/**
 * The `<HelmetProvider>` component, resolved across CJS/ESM module shapes.
 * Falls back to a transparent fragment wrapper if the module cannot be resolved.
 */
export const HelmetProvider: ComponentType<{ children?: ReactNode }> =
  mod.HelmetProvider ||
  mod.default?.HelmetProvider ||
  (({ children }) => <>{children}</>)

// Force canUseDOM = false only during SSG rendering. In the SSG build, jsdom
// may be active (making `window` available), which causes react-helmet-async's
// `isDocument` check to return true. This makes HelmetData skip setting
// helmetContext.helmet and emitChange() use client-side handlers instead of
// server-side state mapping, resulting in null helmet data.
//
// The flag __BOLTDOCS_SSG_RENDERING__ is set by the SSG adapter (remix.tsx)
// before renderStaticApp() and cleared immediately after. Without this guard,
// the `canUseDOM = false` would also execute in the browser, preventing
// Helmet from updating `document.title` on client-side navigation.
if (
  typeof globalThis !== 'undefined' &&
  (globalThis as any).__BOLTDOCS_SSG_RENDERING__
) {
  const hp = HelmetProvider as any
  if (hp && typeof hp === 'function' && hp.canUseDOM) {
    hp.canUseDOM = false
  }
}

// Bridge for SSG: store HelmetProvider on globalThis so @bdocs/ssg's remix
// adapter (loaded at runtime from a separate CJS module instance) can use it.
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__BOLTDOCS_HELMET_PROVIDER__ = HelmetProvider
  ;(globalThis as any).__BOLTDOCS_HELMET__ = Helmet
}
