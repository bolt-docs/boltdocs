/**
 * Shared Helmet module compatibility helpers.
 *
 * react-helmet-async ships different module shapes depending on whether it is
 * loaded via CJS or ESM. Instead of duplicating the same detection logic in
 * every component that needs Helmet/HelmetProvider, we centralise it here.
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
