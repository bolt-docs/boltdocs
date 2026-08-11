import { createContext, use } from 'react'
import type { BoltdocsConfig } from '../../shared/types'

/**
 * Context for the global documentation configuration.
 * Using a global singleton pattern to survive dual-package or duplicated-code hazards.
 */
const CONFIG_CONTEXT_SYMBOL = Symbol.for('__BDOCS_CONFIG_CONTEXT__')
const CONFIG_INSTANCE_SYMBOL = Symbol.for('__BDOCS_CONFIG_INSTANCE__')
const globalRegistry = globalThis as Record<PropertyKey, unknown>
const existingConfigContext = globalRegistry[CONFIG_CONTEXT_SYMBOL] as
  | React.Context<BoltdocsConfig | null>
  | undefined

export const ConfigContext =
  existingConfigContext || createContext<BoltdocsConfig | null>(null)

if (!existingConfigContext) {
  globalRegistry[CONFIG_CONTEXT_SYMBOL] = ConfigContext
}

export function ConfigProvider({
  config,
  children,
}: {
  config: BoltdocsConfig
  children: React.ReactNode
}) {
  // Sync with global registry for dual-package fallback
  globalRegistry[CONFIG_INSTANCE_SYMBOL] = config

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  )
}

/**
 * Hook to access the Boltdocs configuration when one is available.
 *
 * Low-level primitives such as icons can also be rendered standalone (for
 * example in a component preview or a unit test), so they must not be forced
 * to mount the full application provider just to render an inline SVG.
 */
export function useOptionalConfig(): BoltdocsConfig | null {
  const context = use(ConfigContext)
  if (context) return context

  // Fallback to global registry if context is missing (dual-package hazard safety net)
  const globalConfig = globalRegistry[CONFIG_INSTANCE_SYMBOL]
  if (globalConfig) {
    return globalConfig as BoltdocsConfig
  }

  return null
}

/**
 * Hook to access the Boltdocs configuration.
 */
export function useConfig() {
  const config = useOptionalConfig()
  if (!config) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return config
}
