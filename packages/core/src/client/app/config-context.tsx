/**
 * Re-exported from `@bdocs/runtime`: the global configuration.
 *
 * The implementation moved so the browser half of Boltdocs could be consumed
 * without the build engine. This file keeps the path every existing import in
 * core already uses, and re-exports exactly the four names that path exported
 * rather than the whole runtime.
 */
export {
  ConfigContext,
  ConfigProvider,
  useConfig,
  useOptionalConfig,
} from '@bdocs/runtime'
