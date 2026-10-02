export * from './build'
export * from './config'
export * from './highlighting'
export * from './plugins'
export * from './routes'
export * from './structured-data'

export const CONTRACTS_API_VERSION = 1 as const

export type InvalidationKind =
  | 'content'
  | 'frontmatter'
  | 'dependency'
  | 'style'
  | 'config'
  | 'plugin'
  | 'route'

export interface ModuleIdentity {
  sourceHash: string
  routePath?: string
  clientDeps: readonly string[]
  serverDeps: readonly string[]
  cssDeps: readonly string[]
  pluginDeps: readonly string[]
}

export interface InvalidationEvent {
  kind: InvalidationKind
  filePath?: string
  routePath?: string
  moduleIds: readonly string[]
}
