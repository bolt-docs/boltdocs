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
 *
 * When `skipResolveConfig` is set in ssgOptions, the expensive Vite
 * `resolveConfig()` call is skipped — the caller is responsible for
 * providing a fully-formed `InlineConfig`.  Entry path resolution is
 * performed manually (simple `join(root, entry)`) instead of going
 * through Vite's resolver, which shaves ~100-200 ms off dev startup.
 */
export async function createServer(
  viteConfig: InlineConfig = {},
  ssgOptions: Partial<ViteReactSSGOptions> & {
    skipResolveConfig?: boolean
  } = {},
): Promise<ViteDevServer> {
  try {
    const mode = process.env.NODE_ENV || ssgOptions.mode || 'development'
    const { skipResolveConfig: skipResolve, ...ssgOptionsRest } = ssgOptions

    const cwd = process.cwd()
    let root: string
    let merged: Partial<ViteReactSSGOptions>
    let ssrEntry: string
    let template: string

    if (skipResolve) {
      // Fast path: skip Vite's resolveConfig entirely.
      // The caller (Boltdocs CLI) already built a complete InlineConfig.
      root = viteConfig.root || cwd
      merged = {
        ...(viteConfig as any).ssgOptions,
        ...ssgOptionsRest,
      }

      const { htmlEntry = 'index.html' } = merged

      const entry = merged.entry || (await detectEntry(root, htmlEntry))

      // Resolve entry manually — join with root for simple relative paths.
      // Virtual / boltdocs entries pass through unchanged.
      if (
        entry.startsWith('virtual:') ||
        entry.includes('\0') ||
        entry.includes('boltdocs/entry') ||
        entry.includes('boltdocs-entry')
      ) {
        ssrEntry = entry
      } else {
        ssrEntry = join(root, entry)
      }

      template = await fs.readFile(join(root, htmlEntry), 'utf-8')
    } else {
      // Legacy path: full Vite resolveConfig (backward compatible).
      const config = await resolveConfig(viteConfig, 'serve', mode, mode)
      root = config.root || cwd

      merged = {
        ...(config as any).ssgOptions,
        ...ssgOptionsRest,
      }

      const { htmlEntry = 'index.html' } = merged

      const entry = merged.entry || (await detectEntry(root, htmlEntry))

      const [resolvedEntry, htmlTemplate] = await Promise.all([
        resolveAlias(config, entry),
        fs.readFile(join(root, htmlEntry), 'utf-8'),
      ])
      ssrEntry = resolvedEntry
      template = htmlTemplate
    }

    const {
      onBeforePageRender,
      onPageRendered,
      rootContainerId = 'root',
      mock = false,
    } = merged

    process.env.__DEV_MODE_SSR = 'true'

    if (mock) {
      const { jsdomGlobal } = (await import('./jsdomGlobal.mjs')) as {
        jsdomGlobal: (
          html?: string,
          options?: import('jsdom').ConstructorOptions,
        ) => () => void
      }
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
          entry: merged.entry || 'src/main.ts',
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
    ssrReadyMessage += ` ready in ${colors.bold(`${elapsed}ms`)}`
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
