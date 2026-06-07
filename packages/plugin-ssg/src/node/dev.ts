import type { InlineConfig, ViteDevServer } from 'vite'
import type { ViteReactSSGOptions } from '../types'
import { join } from 'node:path'
import fs from 'node:fs/promises'
import { colors, error } from '@bdocs/dui'
import {
  createServer as createViteServer,
  resolveConfig,
  version as viteVersion,
} from 'vite'
import { detectEntry } from './html'
import { resolveAlias, version } from './utils'
import { ssrServerPlugin } from './vite-plugin'

// Extend the global namespace to properly type custom global instrumentation.
declare global {
  var __ssr_start_time: number | undefined
}

/**
 * Creates a customized Vite development server for SSG.
 */
export async function createServer(
  viteConfig: InlineConfig = {},
  ssgOptions: Partial<ViteReactSSGOptions> = {},
): Promise<ViteDevServer> {
  try {
    const mode = process.env.NODE_ENV || ssgOptions.mode || 'development'
    const config = await resolveConfig(viteConfig, 'serve', mode, mode)
    const cwd = process.cwd()
    const root = config.root || cwd

    // Merge options efficiently using object spread operator
    const merged = {
      ...config.ssgOptions,
      ...ssgOptions,
    }

    const {
      htmlEntry = 'index.html',
      onBeforePageRender,
      onPageRendered,
      rootContainerId = 'root',
      mock = false,
    } = merged

    // Wait for the entry detection to allow building concurrent resolutions
    const entry = merged.entry || (await detectEntry(root, htmlEntry))

    // Parallelize file reads and alias resolutions
    const [ssrEntry, template] = await Promise.all([
      resolveAlias(config, entry),
      fs.readFile(join(root, htmlEntry), 'utf-8'),
    ])

    process.env.__DEV_MODE_SSR = 'true'

    if (mock) {
      // @ts-expect-error dynamic mjs import
      const { jsdomGlobal }: { jsdomGlobal: () => void } = await import(
        './jsdomGlobal.mjs'
      )
      jsdomGlobal()
    }

    // Create the final server without redundant empty mergeConfig calls
    const viteServer = await createViteServer({
      ...viteConfig,
      plugins: [
        ...(viteConfig.plugins ?? []),
        ssrServerPlugin({
          template,
          ssrEntry,
          onBeforePageRender,
          onPageRendered,
          entry,
          rootContainerId,
        }),
      ],
    })

    return viteServer
  } catch (error) {
    throw new Error(
      `[vite-react-ssg] Failed to create dev server: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  }
}

/**
 * Top-level dev function that starts server and sets up interaction loop.
 */
export async function dev(
  ssgOptions: Partial<ViteReactSSGOptions> = {},
  viteConfig: InlineConfig = {},
  customOptions?: unknown,
) {
  // Proper use of typed globalThis
  globalThis.__ssr_start_time = performance.now()

  try {
    const server = await createServer(viteConfig, ssgOptions)
    await server.listen()
    printServerInfo(server, !!customOptions)
    server.bindCLIShortcuts({ print: true })
    return server
  } catch (err: any) {
    error(`failed to start server: ${err?.message ?? err}`)
    process.exit(1)
  }
}

/**
 * Synchronous-capable diagnostics printer.
 */
export function printServerInfo(server: ViteDevServer, onlyUrl = false): void {
  if (onlyUrl) {
    server.printUrls()
    return
  }

  const info = server.config.logger.info
  let ssrReadyMessage = ' -- SSR'

  if (globalThis.__ssr_start_time) {
    const elapsed = Math.round(performance.now() - globalThis.__ssr_start_time)
    ssrReadyMessage += ` ready in ${colors.reset(colors.bold(`${elapsed}ms`))}`
  }

  info(`\n ${colors.cyan(` VITE-REACT-SSG v${version} `)}`, {
    clear: !server.config.logger.hasWarned,
  })
  info(
    `${colors.cyan(`\n  VITE v${viteVersion}`) + colors.dim(ssrReadyMessage)}\n`,
  )
  info(colors.green('  dev server running at:'))

  server.printUrls()
}
