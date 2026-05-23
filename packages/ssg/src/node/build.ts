/* eslint-disable no-console */
import type { InlineConfig, PluginOption } from 'vite'
import type {
  RouteRecord,
  ViteReactSSGContext,
  ViteReactSSGOptions,
} from '../types'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative } from 'node:path'
import fs from 'fs-extra'
import { JSDOM } from 'jsdom'
import { blue, cyan, dim, gray, green, red, yellow } from 'kolorist'
import {
  createLogger,
  mergeConfig,
  resolveConfig,
  build as viteBuild,
  version as viteVersion,
} from 'vite'
import {
  removeLeadingSlash,
  withLeadingSlash,
  withTrailingSlash,
} from '../utils/path'
import { serializeState } from '../utils/state'
import { collectAssets } from './assets'
import { getBeasties } from './critial'
import crypto from 'node:crypto'
import { detectEntry, renderHTML, SCRIPT_COMMENT_PLACEHOLDER } from './html'
import { renderPreloadLinks } from './preload-links'
import { getAdapter } from './router-adapter'
import { buildLog, getSize, resolveAlias, routesToPaths } from './utils'

const dotVitedir = Number.parseInt(viteVersion) >= 5 ? ['.vite'] : []
function buildBundlerOptions<T extends Record<string, unknown>>(options: T) {
  return Number.parseInt(viteVersion) >= 8
    ? { rolldownOptions: options }
    : { rollupOptions: options }
}

function getFilesRecursively(
  dir: string,
  baseDir: string,
  docsDirName: string,
  outDirName: string,
): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files
  const list = fs.readdirSync(dir)
  for (const file of list) {
    const filePath = join(dir, file)
    const relPath = relative(baseDir, filePath).replace(/\\/g, '/')
    const stat = fs.statSync(filePath)

    // Ignore directories like node_modules, .git, etc., at any depth,
    // and ignore docs/dist only at the root level.
    const parts = relPath.split('/')
    if (
      parts.includes('node_modules') ||
      parts.includes('.git') ||
      parts.includes('.boltdocs') ||
      parts.includes('.turbo') ||
      parts.includes('dist') ||
      parts.includes('coverage')
    ) {
      continue
    }

    if (
      (docsDirName && parts[0] === docsDirName) ||
      (outDirName && parts[0] === outDirName)
    ) {
      continue
    }

    if (stat.isDirectory()) {
      files.push(
        ...getFilesRecursively(filePath, baseDir, docsDirName, outDirName),
      )
    } else {
      files.push(filePath)
    }
  }
  return files
}

function computeClientCodeHash(
  root: string,
  docsDirName: string,
  outDirName: string,
): string {
  try {
    const files = getFilesRecursively(root, root, docsDirName, outDirName)

    // Scan framework packages if running in the workspace to invalidate cache on framework changes
    const workspaceRoot = join(root, '..')
    const packagesDir = join(workspaceRoot, 'packages')
    if (
      fs.existsSync(packagesDir) &&
      fs.existsSync(join(packagesDir, 'core/package.json'))
    ) {
      const frameworkFiles = getFilesRecursively(
        packagesDir,
        packagesDir,
        '',
        '',
      )
      files.push(...frameworkFiles)
    }

    // Sort files to ensure deterministic hash
    files.sort()

    const hasher = crypto.createHash('sha256')
    for (const file of files) {
      const stat = fs.statSync(file)
      const relPath = relative(root, file).replace(/\\/g, '/')
      hasher.update(relPath)
      hasher.update(stat.mtimeMs.toString())
      hasher.update(stat.size.toString())
    }
    return hasher.digest('hex')
  } catch (e) {
    // If anything fails, return a random hash so we force rebuild
    return Math.random().toString(36).substring(2, 12)
  }
}

export type SSRManifest = Record<string, string[]>
export interface ManifestItem {
  css?: string[]
  file: string
  dynamicImports?: string[]
  src: string
  assets?: string[]
}

export type Manifest = Record<string, ManifestItem>

export type StaticLoaderDataManifest = Record<string, string>

export type CreateRootFactory = (
  client: boolean,
  routePath?: string,
) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>

/**
 * Convert route path to loader data file path with hash
 * @example '/', 'abc123' -> 'static-loader-data/index.abc123.json'
 * @example '/about', 'abc123' -> 'static-loader-data/about.abc123.json'
 * @example '/docs/api', 'abc123' -> 'static-loader-data/docs/api.abc123.json'
 * @example '/docs/', 'abc123' -> 'static-loader-data/docs/index.abc123.json'
 */
function getLoaderDataFilePath(routePath: string, hash: string): string {
  const normalized =
    routePath === '/'
      ? '/index'
      : routePath.endsWith('/')
        ? `${routePath}index`
        : routePath
  return `static-loader-data${withLeadingSlash(normalized)}.${hash}.json`
}

function getNormalizedPathKey(routePath: string, base: string = '/'): string {
  const leading = withLeadingSlash(routePath)
  let full = leading
  if (base !== '/') {
    const prefix = withLeadingSlash(base).replace(/\/$/, '')
    if (!leading.startsWith(prefix + '/') && leading !== prefix) {
      full = `${prefix}${leading}`
    }
  }
  return full !== '/' && full.endsWith('/') ? full.slice(0, -1) : full
}

function DefaultIncludedRoutes(
  paths: string[],
  _routes: Readonly<RouteRecord[]>,
) {
  // ignore dynamic routes
  return paths.filter((i) => !i.includes(':') && !i.includes('*'))
}

export async function build(
  ssgOptions: Partial<ViteReactSSGOptions> = {},
  viteConfig: InlineConfig = {},
) {
  const mode =
    process.env.MODE || process.env.NODE_ENV || ssgOptions.mode || 'production'
  const config = await resolveConfig(viteConfig, 'build', mode, mode)
  const cwd = process.cwd()
  const root = config.root || cwd
  let outDir = config.build.outDir || 'dist'
  const configBase = config.base

  const mergedOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)
  const {
    script = 'sync',
    mock = false,
    htmlEntry = 'index.html',
    entry = await detectEntry(root, htmlEntry),
    formatting = 'none',
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,
    format = 'esm',
    concurrency = 20,
    rootContainerId = 'root',
    routeToSourceFileMap = {},
    cacheDir = '.boltdocs',
  }: ViteReactSSGOptions = mergedOptions

  const beastiesOptions = mergedOptions.beastiesOptions ?? {}

  let docsDirName = 'docs'
  const sourceFiles = Object.values(routeToSourceFileMap)
  if (sourceFiles.length > 0) {
    const firstFile = sourceFiles[0]
    const relativeFirst = relative(root, firstFile).replace(/\\/g, '/')
    const parts = relativeFirst.split('/')
    if (parts.length > 0) {
      docsDirName = parts[0]
    }
  }

  const out = isAbsolute(outDir) ? outDir : join(root, outDir)
  const currentClientHash = computeClientCodeHash(root, docsDirName, outDir)
  const hash = currentClientHash.substring(0, 12)
  const ssgOut = join(root, '.vite-react-ssg-temp', hash)

  if (fs.existsSync(ssgOut)) await fs.remove(ssgOut)

  const finalCacheDir = isAbsolute(cacheDir) ? cacheDir : join(root, cacheDir)
  const hashFile = join(finalCacheDir, 'client-hash.txt')
  const templateHtmlFile = join(finalCacheDir, 'template-index.html')

  let canBypassClientBuild = false
  try {
    if (
      fs.existsSync(hashFile) &&
      fs.existsSync(templateHtmlFile) &&
      fs.existsSync(out) &&
      fs.existsSync(join(out, 'assets'))
    ) {
      const savedHash = await fs.readFile(hashFile, 'utf-8')
      if (savedHash.trim() === currentClientHash) {
        canBypassClientBuild = true
      }
    }
  } catch (e) {
    // Ignore and run full client build
  }

  const clientLogger = createLogger()
  const loggerWarn = clientLogger.warn
  clientLogger.warn = (msg: string, options) => {
    if (
      msg.includes('vite:resolve') &&
      msg.includes('externalized for browser compatibility')
    ) {
      return
    }
    loggerWarn(msg, options)
  }

  if (canBypassClientBuild) {
    buildLog('Client code unchanged. Bypassing client build...')
    await fs.ensureDir(out)
    await fs.copy(templateHtmlFile, join(out, htmlEntry))
  } else {
    // client
    buildLog('Build for client...')
    await viteBuild(
      mergeConfig(viteConfig, {
        build: {
          manifest: true,
          ssrManifest: true,
          ...buildBundlerOptions({
            input: {
              app: join(root, htmlEntry || './index.html'),
            },
            // @ts-expect-error rollup type
            onLog(level, log, handler) {
              if (log.message.includes('react-helmet-async')) return
              handler(level, log)
            },
          }),
        },
        customLogger: clientLogger,
        mode: config.mode,
        plugins: [
          {
            name: 'vite-react-ssg:get-oup-dir',
            configResolved(resolvedConfig) {
              outDir = resolvedConfig.build.outDir || 'dist'
            },
          } as PluginOption,
        ],
      }),
    )

    // Save the template index.html to cache
    await fs.ensureDir(finalCacheDir)
    await fs.copy(join(out, htmlEntry), templateHtmlFile)
    await fs.writeFile(hashFile, currentClientHash, 'utf-8')
  }

  let unmock = () => {}
  if (mock) {
    const { jsdomGlobal }: { jsdomGlobal: () => () => void } =
      // @ts-expect-error allow js
      await import('./jsdomGlobal.mjs')
    unmock = jsdomGlobal()
  }

  // server
  buildLog('Build for server...')
  process.env.VITE_SSG = 'true'
  const ssrEntry = await resolveAlias(config, entry)
  await viteBuild(
    mergeConfig(viteConfig, {
      build: {
        ssr: ssrEntry,
        manifest: true,
        outDir: ssgOut,
        minify: false,
        cssCodeSplit: false,
        ...buildBundlerOptions({
          output:
            format === 'esm'
              ? {
                  entryFileNames: '[name].mjs',
                  format: 'esm',
                }
              : {
                  entryFileNames: '[name].cjs',
                  format: 'cjs',
                },
          // @ts-expect-error rollup type
          onLog(level, log, handler) {
            if (log.message.includes('react-helmet-async')) return
            handler(level, log)
          },
        }),
      },
      mode: config.mode,
    }),
  )

  const prefix =
    format === 'esm' && process.platform === 'win32' ? 'file://' : ''
  const ext = format === 'esm' ? '.mjs' : '.cjs'
  /**
   * `join('file://')` will be equal to `'file:\'`, which is not the correct file protocol and will fail to be parsed under bun.
   * It is changed to '+' splicing here.
   */
  const safeEntryName = ssrEntry
    .replace(/\0/g, '')
    .replace('virtual:', '')
    .replace(/[^a-zA-Z0-9-]/g, '_')

  // If the SSR entry points to an absolute path, Vite/Rolldown 8 typically uses the basename
  // without drive letters or full path mangling for its chunk name.
  // We strip any existing extension (like .tsx) to avoid double extensions like .tsx.mjs
  const entryBasename =
    ssrEntry.includes('/') || ssrEntry.includes('\\')
      ? ssrEntry
          .split(/[/\\]/)
          .pop()!
          .replace(/\.[^/.]+$/, '')
          .replace(ext, '')
      : safeEntryName

  const serverEntry =
    prefix + join(ssgOut, entryBasename + ext).replace(/\\/g, '/')
  const serverManifest: Manifest = JSON.parse(
    await fs.readFile(join(ssgOut, ...dotVitedir, 'manifest.json'), 'utf-8'),
  )

  const _require =
    typeof require !== 'undefined' ? require : createRequire(import.meta.url)

  const {
    createRoot,
    includedRoutes: serverEntryIncludedRoutes,
  }: {
    createRoot: CreateRootFactory
    includedRoutes: ViteReactSSGOptions['includedRoutes']
  } = format === 'esm' ? await import(serverEntry) : _require(serverEntry)
  const includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes
  const { routes } = await createRoot(false)

  const { paths } = await routesToPaths(routes)

  let routesPaths = includeAllRoutes
    ? paths
    : await includedRoutes(paths, routes || [])

  routesPaths = DefaultIncludedRoutes(routesPaths, routes || [])

  routesPaths = Array.from(new Set(routesPaths))

  buildLog('Rendering Pages...', routesPaths.length)

  const beasties =
    beastiesOptions !== false
      ? await getBeasties(outDir, {
          publicPath: configBase,
          ...beastiesOptions,
        })
      : undefined
  if (beasties) {
    console.log(
      `${gray('[vite-react-ssg]')} ${blue('Critical CSS generation enabled via `beasties`')}`,
    )
  }

  const ssrManifest: SSRManifest = JSON.parse(
    await fs.readFile(join(out, ...dotVitedir, 'ssr-manifest.json'), 'utf-8'),
  )
  const manifest: Manifest = JSON.parse(
    await fs.readFile(join(out, ...dotVitedir, 'manifest.json'), 'utf-8'),
  )
  let indexHTML = await fs.readFile(join(out, htmlEntry), 'utf-8')
  fs.rmSync(join(out, htmlEntry))
  indexHTML = rewriteScripts(indexHTML, script)

  const PQueue = (await import('p-queue')).default || (await import('p-queue'))
  const queue = new PQueue({ concurrency })
  const crittersQueue = new PQueue({ concurrency: 1 })

  const staticLoaderDataManifest: StaticLoaderDataManifest = {}
  let loaderDataFileCount = 0

  // Load the previous SSG cache metadata
  const cachePath = join(finalCacheDir, 'ssg-cache.json')
  const ssgPagesDir = join(finalCacheDir, 'ssg-pages')

  let ssgCache: Record<string, { mtime: number; loaderDataFilePath?: string }> =
    {}
  try {
    if (fs.existsSync(cachePath)) {
      ssgCache = await fs.readJson(cachePath)
    }
  } catch (e) {
    // Ignore cache errors
  }
  const newSsgCache: Record<
    string,
    { mtime: number; loaderDataFilePath?: string }
  > = { ...ssgCache }

  for (const path of routesPaths) {
    const pathHash = crypto.createHash('md5').update(path).digest('hex')
    const cachedHtmlFile = join(ssgPagesDir, `${pathHash}.html`)
    const cachedLoaderFile = join(ssgPagesDir, `${pathHash}.json`)

    const relativeRouteFile = `${(
      path.endsWith('/') ? `${path}index` : path
    ).replace(/^\//g, '')}.html`

    const filename =
      dirStyle === 'nested'
        ? join(path.replace(/^\//g, ''), 'index.html')
        : relativeRouteFile

    const finalOutFile = join(out, filename)
    const normalizedKey = withLeadingSlash(path).replace(/\/$/, '')
    const sourceFile =
      routeToSourceFileMap[normalizedKey] || routeToSourceFileMap[path]

    let isCached = false
    let sourceMtime = 0
    if (canBypassClientBuild && sourceFile && fs.existsSync(sourceFile)) {
      try {
        sourceMtime = Math.round(fs.statSync(sourceFile).mtimeMs)
        if (fs.existsSync(cachedHtmlFile)) {
          const cachedItem = ssgCache[normalizedKey] || ssgCache[path]
          if (cachedItem && Math.round(cachedItem.mtime) === sourceMtime) {
            isCached = true
          }
        }
      } catch (e) {}
    }

    if (isCached) {
      queue.add(async () => {
        try {
          await fs.ensureDir(dirname(finalOutFile))
          await fs.copy(cachedHtmlFile, finalOutFile)

          // Copy loader data if exists
          const cachedItem = ssgCache[normalizedKey] || ssgCache[path]
          if (
            cachedItem?.loaderDataFilePath &&
            fs.existsSync(cachedLoaderFile)
          ) {
            const loaderDataFilePath = cachedItem.loaderDataFilePath
            await fs.ensureDir(join(out, dirname(loaderDataFilePath)))
            await fs.copy(cachedLoaderFile, join(out, loaderDataFilePath))
            staticLoaderDataManifest[getNormalizedPathKey(path, configBase)] =
              loaderDataFilePath
            loaderDataFileCount++
          }

          config.logger.info(
            `${dim(`${outDir}/`)}${cyan(filename.padEnd(15, ' '))}  ${green('(cached)')}`,
          )
        } catch (err: any) {
          throw new Error(
            `${gray('[vite-react-ssg]')} Error on cached page: ${cyan(path)}\n${err.stack}`,
          )
        }
      })
      continue
    }

    queue.add(async () => {
      try {
        const appCtx = (await createRoot(
          false,
          path,
        )) as ViteReactSSGContext<true>
        const {
          base,
          routes,
          triggerOnSSRAppRendered,
          transformState = serializeState,
          app,
          routerType,
        } = appCtx

        const transformedIndexHTML =
          (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML

        const fetchUrl = `${withTrailingSlash(base)}${removeLeadingSlash(path)}`

        const adapter = getAdapter(appCtx)
        const assets =
          !app && routerType === 'remix'
            ? await collectAssets({
                routes: [...routes],
                locationArg: fetchUrl,
                base,
                serverManifest,
                manifest,
                ssrManifest,
              })
            : new Set<string>()

        const {
          appHTML,
          bodyAttributes,
          htmlAttributes,
          metaAttributes,
          styleTag,
          routerContext,
        } = await adapter.render(path)

        // Write loader data to separate file if exists
        const loaderData = routerContext?.loaderData as
          | Record<string, unknown>
          | undefined
        let writtenLoaderDataPath: string | undefined = undefined

        if (loaderData && Object.keys(loaderData).length > 0) {
          const loaderDataFilePath = getLoaderDataFilePath(path, hash)
          writtenLoaderDataPath = loaderDataFilePath
          await fs.ensureDir(join(out, dirname(loaderDataFilePath)))
          await fs.writeFile(
            join(out, loaderDataFilePath),
            JSON.stringify(loaderData),
          )
          staticLoaderDataManifest[getNormalizedPathKey(path, configBase)] = loaderDataFilePath
          loaderDataFileCount++
        }

        await triggerOnSSRAppRendered?.(path, appHTML, appCtx)

        const renderedHTML = await renderHTML({
          rootContainerId,
          appHTML,
          indexHTML: transformedIndexHTML,
          metaAttributes,
          bodyAttributes,
          htmlAttributes,
          initialState: null,
        })

        const jsdom = new JSDOM(renderedHTML)

        renderPreloadLinks(jsdom.window.document, assets)

        const doc = jsdom.window.document
        const scriptTags = doc.querySelectorAll('script')
        let hydrationScriptContent = ''
        for (const script of scriptTags) {
          if (script.textContent?.includes('window.__staticRouterHydrationData')) {
            hydrationScriptContent = script.textContent
            script.remove()
            break
          }
        }

        const html = jsdom.serialize()
        jsdom.window.close()
        let transformed = (await onPageRendered?.(path, html, appCtx)) || html
        let loaderDataScript = ''
        if (loaderData && Object.keys(loaderData).length > 0) {
          const safeLoaderDataJSON = JSON.stringify(loaderData).replace(/</g, '\\u003c')
          loaderDataScript = `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = { '${getNormalizedPathKey(path, configBase)}': ${safeLoaderDataJSON} };`
        }
        const headerScript = `<script>window.__VITE_REACT_SSG_HASH__ = '${hash}';${loaderDataScript}${hydrationScriptContent}</script>`
        transformed = transformed.replace('<head>', `<head>${headerScript}`)
        // Clean up the script placeholder
        transformed = transformed.replace(
          `<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`,
          '',
        )
        if (beasties) {
          transformed = (await crittersQueue.add(() =>
            beasties.process(transformed),
          ))!
          transformed = transformed.replace(
            /<link\srel="stylesheet"/g,
            '<link rel="stylesheet" crossorigin',
          )
        }

        if (styleTag)
          transformed = transformed.replace('<head>', `<head>${styleTag}`)

        const formatted = await formatHtml(transformed, formatting)

        await fs.ensureDir(join(out, dirname(filename)))
        await fs.writeFile(join(out, filename), formatted, 'utf-8')

        // Save generated page and loader data to the SSG cache folder
        if (sourceFile && fs.existsSync(sourceFile)) {
          await fs.ensureDir(ssgPagesDir)
          await fs.writeFile(cachedHtmlFile, formatted, 'utf-8')

          const normalizedKey = withLeadingSlash(path).replace(/\/$/, '')
          const mtimeRounded = Math.round(sourceMtime)

          if (
            loaderData &&
            Object.keys(loaderData).length > 0 &&
            writtenLoaderDataPath
          ) {
            await fs.writeFile(
              cachedLoaderFile,
              JSON.stringify(loaderData),
              'utf-8',
            )
            newSsgCache[normalizedKey] = {
              mtime: mtimeRounded,
              loaderDataFilePath: writtenLoaderDataPath,
            }
          } else {
            newSsgCache[normalizedKey] = {
              mtime: mtimeRounded,
            }
          }
        }

        config.logger.info(
          `${dim(`${outDir}/`)}${cyan(filename.padEnd(15, ' '))}  ${dim(getSize(formatted))}`,
        )
      } catch (err: any) {
        throw new Error(
          `${gray('[vite-react-ssg]')} ${red(`Error on page: ${cyan(path)}`)}\n${err.stack}`,
        )
      }
    })
  }

  await queue.start().onIdle()

  // Save the updated cache index
  try {
    await fs.ensureDir(dirname(cachePath))
    await fs.writeJson(cachePath, newSsgCache)

    // Garbage collect unused cached HTML and JSON loader files in ssg-pages
    if (fs.existsSync(ssgPagesDir)) {
      const cachedFiles = await fs.readdir(ssgPagesDir)
      const activeHashes = new Set<string>()
      for (const route of Object.keys(newSsgCache)) {
        const pathHash = crypto.createHash('md5').update(route).digest('hex')
        activeHashes.add(`${pathHash}.html`)
        activeHashes.add(`${pathHash}.json`)
      }
      let prunedCount = 0
      for (const file of cachedFiles) {
        if (file.endsWith('.html') || file.endsWith('.json')) {
          if (!activeHashes.has(file)) {
            await fs.remove(join(ssgPagesDir, file))
            prunedCount++
          }
        }
      }
      if (prunedCount > 0) {
        buildLog(`Pruned ${prunedCount} obsolete files from SSG cache.`)
      }
    }
  } catch (e) {
    // Ignore cache and pruning errors
  }

  buildLog('Generating static loader data...', loaderDataFileCount)
  const staticLoaderDataManifestString = JSON.stringify(
    staticLoaderDataManifest,
    null,
    0,
  )
  await fs.writeFile(
    join(out, `static-loader-data-manifest-${hash}.json`),
    staticLoaderDataManifestString,
  )
  config.logger.info(
    `${dim(`${outDir}/`)}${cyan(`static-loader-data-manifest-${hash}.json`.padEnd(15, ' '))}  ${dim(getSize(staticLoaderDataManifestString))}`,
  )

  await fs.remove(join(root, '.vite-react-ssg-temp'))

  unmock()
  const pwaPlugin: { disabled: boolean; generateSW: () => Promise<unknown> } =
    config.plugins.find((i) => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    buildLog('Regenerate PWA...')
    await pwaPlugin.generateSW()
  }

  console.log(`\n${gray('[vite-react-ssg]')} ${green('Build finished.')}`)

  await onFinished?.(outDir)

  const waitInSeconds = 15
  const timeout = setTimeout(() => {
    console.log(
      `${gray('[vite-react-ssg]')} ${yellow(`Build process still running after ${waitInSeconds}s`)}.  There might be something misconfigured in your setup. Force exit.`,
    )
    process.exit(0)
  }, waitInSeconds * 1000)
  timeout.unref()
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync') return indexHTML
  return indexHTML.replace(
    /<script type="module" /g,
    `<script type="module" ${mode} `,
  )
}

async function formatHtml(
  html: string,
  formatting: ViteReactSSGOptions['formatting'],
) {
  if (formatting === 'prettify') {
    try {
      // @ts-expect-error dynamic import
      const prettier = (await import('prettier/esm/standalone.mjs')).default
      // @ts-expect-error dynamic import
      const parserHTML = (await import('prettier/esm/parser-html.mjs')).default

      return prettier.format(html, {
        semi: false,
        parser: 'html',
        plugins: [parserHTML],
      })
    } catch (e: any) {
      console.error(
        `${gray('[vite-react-ssg]')} ${red(`Error formatting html: ${e?.message}`)}`,
      )
      return html
    }
  }
  return html
}
