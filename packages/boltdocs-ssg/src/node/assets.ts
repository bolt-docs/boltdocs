import type {
  RouterRouteRecord,
  MatchRouteBranchWithParams,
} from '../router-contract'
import type { RouteRecord } from '../types'
import type { Manifest, SSRManifest } from './types'

export const DYNAMIC_IMPORT_REGEX = /import\("([^)]+)"\)/g
export enum AssetType {
  style = 'style',
  script = 'script',
  image = 'image',
  font = 'font',
}

interface CollectAssetsOpts {
  routes: RouteRecord[]
  locationArg: string
  base: string
  matchRouteBranchWithParams: MatchRouteBranchWithParams
  serverManifest: Manifest
  manifest: Manifest
  ssrManifest: SSRManifest
}

export interface AssetCollectorOptions
  extends Omit<CollectAssetsOpts, 'locationArg'> {}

export type AssetCollector = (
  locationArg: string,
) => Promise<ReadonlySet<string>>

function collectModulesForEntries(
  manifest: Manifest,
  entries: Set<string> | undefined,
) {
  const mods = new Set<string>()
  if (!entries) return mods

  for (const entry of entries) collectModules(manifest, entry, mods)

  return mods
}

function collectModules(
  manifest: Manifest,
  entry: string | undefined,
  mods = new Set<string>(),
) {
  if (!entry) return mods

  mods.add(entry)
  manifest[entry]?.dynamicImports?.forEach((item) => {
    collectModules(manifest, item, mods)
  })

  return mods
}

function collectAssetsForMatches(
  matches: ReturnType<MatchRouteBranchWithParams>,
  options: AssetCollectorOptions,
  serverManifestEntries: Array<[string, { file: string }]>,
  moduleAssetsCache: Map<string, Set<string>>,
): Set<string> {
  const routeEntries =
    (matches?.map((item) => item.route.entry).filter(Boolean) as string[]) ?? []
  const dynamicImports = new Set<string>()
  matches?.forEach((item) => {
    let lazyStr = ''
    if (item.route.lazy) {
      lazyStr += item.route.lazy.toString()
    }
    // @ts-expect-error lazy
    if (item.route.Component?._payload?._result) {
      // @ts-expect-error lazy
      lazyStr += item.route.Component._payload._result.toString()
    }
    const match = lazyStr.matchAll(DYNAMIC_IMPORT_REGEX)
    for (const m of match) {
      dynamicImports.add(m[1].split('/').at(-1) ?? '')
    }
  })

  const entries = new Set<string>(routeEntries)
  for (const name of dynamicImports) {
    const result = serverManifestEntries.find(([_, value]) =>
      value.file.endsWith(name),
    )
    if (result) entries.add(result[0])
  }

  const assets = new Set<string>()
  for (const entry of entries) {
    let entryAssets = moduleAssetsCache.get(entry)
    if (!entryAssets) {
      const modules = collectModulesForEntries(
        options.manifest,
        new Set([entry]),
      )
      entryAssets = new Set<string>()
      for (const id of modules) {
        for (const file of options.ssrManifest[id] || []) {
          entryAssets.add(file)
        }
      }
      moduleAssetsCache.set(entry, entryAssets)
    }
    for (const asset of entryAssets) assets.add(asset)
  }

  return assets
}

/**
 * Creates a build-scoped collector. The route matcher still runs once per
 * unique location, but manifest entry lookup and module-to-asset traversal are
 * memoized. Promise memoization also prevents duplicate work when render and
 * finalization overlap.
 */
export function createAssetCollector(
  options: AssetCollectorOptions,
): AssetCollector {
  const serverManifestEntries = Object.entries(options.serverManifest)
  const moduleAssetsCache = new Map<string, Set<string>>()
  const routePromises = new Map<string, Promise<ReadonlySet<string>>>()

  return (locationArg: string) => {
    const cached = routePromises.get(locationArg)
    if (cached) return cached

    const promise = Promise.resolve().then(() => {
      const matches = options.matchRouteBranchWithParams(
        [...options.routes] as RouterRouteRecord[],
        locationArg,
        options.base,
      )
      const assets = collectAssetsForMatches(
        matches,
        options,
        serverManifestEntries,
        moduleAssetsCache,
      )
      return new Set(assets) as ReadonlySet<string>
    })
    routePromises.set(locationArg, promise)
    void promise.catch(() => {
      if (routePromises.get(locationArg) === promise) {
        routePromises.delete(locationArg)
      }
    })
    return promise
  }
}

export async function collectAssets(
  options: CollectAssetsOpts,
): Promise<Set<string>> {
  const assets = await createAssetCollector(options)(options.locationArg)
  return new Set(assets)
}
