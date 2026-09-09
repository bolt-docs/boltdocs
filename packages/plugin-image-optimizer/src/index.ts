import type { Plugin, ResolvedConfig } from 'vite'
import type {
  PngOptions,
  JpegOptions,
  TiffOptions,
  GifOptions,
  WebpOptions,
  AvifOptions,
} from 'sharp'
import type { Config as SVGOConfig } from 'svgo'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { extname, resolve, sep, basename } from 'node:path'
import { AssetCache } from './cache'
import { ImageWorkerPool } from './worker-pool'
import {
  readAllFiles,
  areFilesMatching,
  logErrors,
  logOptimizationStats,
  deepMerge,
} from './utils'
import {
  VITE_PLUGIN_NAME,
  PLUGIN_VERSION,
  DEFAULT_OPTIONS,
  TEST_REGEX,
} from './constants'

interface Options {
  test?: RegExp
  include?: RegExp | string | string[]
  exclude?: RegExp | string | string[]
  includePublic?: boolean
  logStats?: boolean
  svg?: SVGOConfig
  png?: PngOptions
  jpeg?: JpegOptions
  jpg?: JpegOptions
  tiff?: TiffOptions
  gif?: GifOptions
  webp?: WebpOptions
  avif?: AvifOptions
}

type FormatKey =
  | 'svg'
  | 'png'
  | 'jpeg'
  | 'jpg'
  | 'tiff'
  | 'gif'
  | 'webp'
  | 'avif'

const FORMAT_KEYS: FormatKey[] = [
  'png',
  'jpeg',
  'jpg',
  'tiff',
  'gif',
  'webp',
  'avif',
  'svg',
]

function resolveOptions(userOptions: Options): Required<Options> {
  const base: any = {}
  for (const key of FORMAT_KEYS) {
    const userVal = (userOptions as any)[key]
    const defaultVal = (DEFAULT_OPTIONS as any)[key]
    base[key] =
      userVal !== undefined ? deepMerge({}, defaultVal, userVal) : defaultVal
  }

  return {
    ...base,
    logStats: userOptions.logStats ?? DEFAULT_OPTIONS.logStats,
    includePublic: userOptions.includePublic ?? DEFAULT_OPTIONS.includePublic,
    test: userOptions.test ?? TEST_REGEX,
    include: userOptions.include,
    exclude: userOptions.exclude,
  }
}

function computeOptionsHash(opts: Record<string, unknown>): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(opts))
    .digest('hex')
    .slice(0, 12)
}

function ViteImageOptimizer(optionsParam: Options = {}): Plugin {
  const resolved = resolveOptions(optionsParam)

  let outputPath: string
  let publicDir: string
  let rootConfig: ResolvedConfig
  let assetCache: AssetCache | null = null
  let pool: ImageWorkerPool | null = null

  const sizesMap = new Map<
    string,
    {
      size: number
      oldSize: number
      ratio: number
      skipWrite: boolean
      isCached: boolean
    }
  >()
  const mtimeCache = new Map<string, number>()
  const errorsMap = new Map<string, string>()
  const bundleContentCache = new Map<string, Buffer>()

  const getFormatOpts = (filePath: string) => {
    const ext = extname(filePath).replace('.', '').toLowerCase()
    return ((resolved as any)[ext] || {}) as Record<string, unknown>
  }

  const processFile = async (filePath: string, buffer: Buffer) => {
    try {
      const contentHash = crypto.createHash('md5').update(buffer).digest('hex')
      const formatOpts = getFormatOpts(filePath)
      const optionsHash = computeOptionsHash(formatOpts)
      const memoryKey = `${optionsHash}-${contentHash}`

      const cachedInMemory = bundleContentCache.get(memoryKey)
      if (cachedInMemory) {
        const newSize = cachedInMemory.byteLength
        const oldSize = buffer.byteLength
        const skipWrite = newSize >= oldSize
        sizesMap.set(filePath, {
          size: newSize / 1024,
          oldSize: oldSize / 1024,
          ratio: Math.floor(100 * (newSize / oldSize - 1)),
          skipWrite,
          isCached: true,
        })
        return { content: cachedInMemory, skipWrite }
      }

      let newBuffer: Buffer
      if (pool) {
        newBuffer = await pool.optimize({
          filePath,
          buffer,
          formatOptions: formatOpts,
          svgOptions: resolved.svg,
        })
      } else {
        // Fallback: process inline if pool isn't available
        const { optimize } = await import('svgo')
        const sharp = (await import('sharp')).default
        if (/\.svg$/.test(filePath)) {
          newBuffer = Buffer.from(
            optimize(buffer.toString(), {
              path: filePath,
              ...resolved.svg,
            }).data,
          )
        } else {
          const ext = extname(filePath).replace('.', '').toLowerCase()
          newBuffer = await sharp(buffer, { animated: ext === 'gif' })
            .toFormat(ext as any, formatOpts)
            .toBuffer()
        }
      }

      const newSize = newBuffer.byteLength
      const oldSize = buffer.byteLength
      const skipWrite = newSize >= oldSize

      if (!skipWrite) {
        bundleContentCache.set(memoryKey, newBuffer)
      }

      sizesMap.set(filePath, {
        size: newSize / 1024,
        oldSize: oldSize / 1024,
        ratio: Math.floor(100 * (newSize / oldSize - 1)),
        skipWrite,
        isCached: false,
      })

      return { content: newBuffer, skipWrite }
    } catch (error: any) {
      errorsMap.set(filePath, error.message)
      return {}
    }
  }

  const getFilesToProcess = (
    allFiles: string[],
    getFileName: (path: string) => string,
  ) => {
    if (resolved.include) {
      return allFiles.reduce((acc, filePath) => {
        const fileName: string = getFileName(filePath)
        if (areFilesMatching(fileName, filePath, resolved.include)) {
          acc.push(filePath)
        }
        return acc
      }, [] as string[])
    }

    return allFiles.reduce((acc, filePath) => {
      if (resolved.test?.test(filePath)) {
        const fileName: string = getFileName(filePath)
        if (!areFilesMatching(fileName, filePath, resolved.exclude)) {
          acc.push(filePath)
        }
      }
      return acc
    }, [] as string[])
  }

  return {
    name: VITE_PLUGIN_NAME,
    apply: 'build',
    enforce: 'post',
    configResolved(c) {
      rootConfig = c
      outputPath = c.build.outDir
      if (typeof c.publicDir === 'string') {
        publicDir = c.publicDir.replace(/\\/g, '/')
      }
      assetCache = new AssetCache()
      pool = new ImageWorkerPool()
    },
    generateBundle: async (_, bundler) => {
      const allFiles: string[] = Object.keys(bundler)
      const files: string[] = getFilesToProcess(
        allFiles,
        (path: string) => (bundler[path] as any).name,
      )

      if (files.length > 0) {
        const handles = files.map(async (filePath: string) => {
          const source = (bundler[filePath] as any).source
          const { content, skipWrite } = await processFile(filePath, source)
          if (content && content.length > 0 && !skipWrite) {
            ;(bundler[filePath] as any).source = content
          }
        })
        await Promise.all(handles)
      }
    },
    async closeBundle() {
      if (
        publicDir &&
        resolved.includePublic &&
        process.env.VITE_SSG !== 'true'
      ) {
        const allFiles: string[] = readAllFiles(publicDir)
        const files: string[] = getFilesToProcess(allFiles, (path: string) =>
          basename(path),
        )

        const validCacheFilenames = new Set<string>()

        if (files.length > 0) {
          const handles = files.map(async (publicFilePath: string) => {
            const relativePath: string = publicFilePath.replace(
              publicDir + sep,
              '',
            )
            const fullFilePath: string = resolve(
              rootConfig.root,
              outputPath,
              relativePath,
            )

            if (!fs.existsSync(fullFilePath)) return

            const { mtimeMs } = await fsp.stat(fullFilePath)
            if (mtimeMs <= (mtimeCache.get(relativePath) || 0)) return

            const buffer: Buffer = await fsp.readFile(fullFilePath)
            const formatOpts = getFormatOpts(relativePath)
            const optionsHash = computeOptionsHash(formatOpts)

            if (assetCache) {
              const sourceHash = await assetCache.getFileHash(publicFilePath)
              const ext = extname(publicFilePath)
              const name = basename(publicFilePath, ext)
              const safeKey = `${PLUGIN_VERSION}-${optionsHash}-${sourceHash}`
                .replace(/[^a-z0-9]/gi, '-')
                .toLowerCase()
              validCacheFilenames.add(`${name}.${safeKey}${ext}`)

              const cachedPath = await assetCache.get(
                publicFilePath,
                `${PLUGIN_VERSION}-${optionsHash}`,
              )
              if (cachedPath) {
                const cached = await fsp.readFile(cachedPath)
                const { content, skipWrite } = await processFile(
                  relativePath,
                  cached,
                )
                if (content && content?.length > 0 && !skipWrite) {
                  await fsp.writeFile(fullFilePath, content)
                  mtimeCache.set(relativePath, Date.now())
                }
                return
              }
            }

            const { content, skipWrite } = await processFile(
              relativePath,
              buffer,
            )
            if (content && content?.length > 0 && !skipWrite) {
              await fsp.writeFile(fullFilePath, content)
              mtimeCache.set(relativePath, Date.now())
              if (assetCache) {
                const sourceHash = await assetCache.getFileHash(publicFilePath)
                assetCache.set(
                  publicFilePath,
                  `${PLUGIN_VERSION}-${optionsHash}`,
                  content,
                  sourceHash,
                )
              }
            }
          })
          await Promise.all(handles)
        }

        if (assetCache) {
          await assetCache.flush()
          await assetCache.pruneStale(validCacheFilenames)
          await assetCache.enforceSizeLimit()
        }
      }
      if (
        sizesMap.size > 0 &&
        resolved.logStats &&
        process.env.VITE_SSG !== 'true'
      ) {
        logOptimizationStats(sizesMap)
      }
      if (errorsMap.size > 0) {
        logErrors(errorsMap)
      }
      await assetCache?.flush()
      await pool?.terminate()
    },
  }
}

export { ViteImageOptimizer }
