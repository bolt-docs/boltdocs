import type { BoltdocsPlugin, PluginContext } from 'boltdocs'

/**
 * Index a Boltdocs site with Pagefind after the static build.
 *
 * ```ts
 * import pagefindSearch from '@bdocs/plugin-search-pagefind'
 *
 * export default defineConfig({
 *   plugins: [pagefindSearch()],
 * })
 * ```
 *
 * ## Why this engine is different from every other
 *
 * Algolia receives documents: a list of pages with their text. Pagefind
 * receives **the built HTML** and crawls it, which means it indexes exactly what
 * a visitor would see — including prose from MDX components, text inside React
 * output that never touched frontmatter, and headings the route metadata does
 * not list. That is why it is wired to `build:generate` rather than
 * `search:index`: those routes do not exist yet when the metadata hook fires.
 *
 * The cost is a second pass over the output and a Node dependency. Both are paid
 * once, after the render, where the HTML exists.
 *
 * ## The binary
 *
 * Pagefind ships its indexer as a platform binary (`@pagefind/linux-x64`,
 * `@pagefind/darwin-arm64`, …). It is an optional peer rather than a dependency
 * so a site only downloads the binary for its own platform, and so the package
 * installs on a machine whose platform has no build yet.
 */
export interface PagefindOptions {
  /**
   * Directory to index, relative to the build output. Defaults to the whole
   * output directory.
   *
   * Set it when the site has a non-docs area — a marketing page or an admin
   * bundle — that should not be searchable.
   */
  root?: string
  /**
   * Do not index pages whose URL matches. Regular expressions, one per entry.
   *
   * Common uses: a changelog with one entry per release, or a versioned tree
   * where only the current version should answer searches.
   */
  excludeSelectors?: string[]
  /** URL substrings or patterns to skip entirely. */
  excludePatterns?: string[]
  /** Force a specific Pagefind binary instead of resolving by platform. */
  binaryPath?: string
  /** Bundle identifier written into the index. Defaults to `boltdocs`. */
  siteKey?: string
  /** Log Pagefind's own output. Off by default — it is verbose. */
  verbose?: boolean
}

const DEFAULT_SITE_KEY = 'boltdocs'

/**
 * Resolve the Pagefind binary for this platform.
 *
 * `@pagefind/<platform>` is the package naming Pagefind uses; a missing package
 * here means the install skipped optional dependencies, which is a different
 * problem than a broken index and deserves a different message.
 */
function binaryPackage(): string {
  const platform = process.platform
  const arch = process.arch
  if (platform === 'linux') return `@pagefind/linux-${arch}`
  if (platform === 'darwin') return `@pagefind/darwin-${arch}`
  if (platform === 'win32') return `@pagefind/windows-${arch}`
  throw new Error(
    `[pagefind] no official binary for ${platform}/${arch}. ` +
      'Set `binaryPath` to point at a Pagefind binary.',
  )
}

async function resolveBinary(options: PagefindOptions): Promise<string> {
  if (options.binaryPath) return options.binaryPath
  const spec = binaryPackage()
  try {
    const mod = (await import(spec)) as { default?: string } & { path?: string }
    return mod.default ?? mod.path ?? spec
  } catch {
    throw new Error(
      `[pagefind] could not load ${spec}. Install it, or set ` +
        '`binaryPath` in the plugin options.',
    )
  }
}

export default function pagefindSearchPlugin(
  options: PagefindOptions = {},
): BoltdocsPlugin {
  const siteKey = options.siteKey ?? DEFAULT_SITE_KEY

  return {
    name: 'plugin-search-pagefind',
    version: '1.0.0',
    hooks: {
      /**
       * Runs after the static render, when `dist/` holds the HTML to crawl.
       *
       * `build:generate` is the first hook that runs once the output exists,
       * which is the whole requirement here — a search index built from
       * metadata would be missing every word the MDX pipeline rendered.
       */
      async 'build:generate'(
        ctx: PluginContext<{ outDir?: string }>,
      ): Promise<void> {
        const logger = ctx.logger
        const outDir = ctx.config?.outDir ?? ctx.outDir
        if (!outDir) {
          logger.warn(
            '[pagefind] no output directory in the build context; skipping.',
          )
          return
        }

        let binary: string
        try {
          binary = await resolveBinary(options)
        } catch (error) {
          // Not fatal. The site built and every page renders; only the index is
          // missing, and that is a build-time service to configure rather than
          // a reason to fail a deploy.
          logger.warn(
            `[pagefind] ${error instanceof Error ? error.message : String(error)}`,
          )
          return
        }

        const args = [
          '--site',
          options.root ?? '.',
          '--output-path',
          '.',
          '--site-key',
          siteKey,
          '--force-language',
          'en',
        ]
        for (const pattern of options.excludePatterns ?? []) {
          args.push('--exclude-selectors', pattern)
        }

        try {
          const { spawn } = await import('node:child_process')

          await new Promise<void>((resolve, reject) => {
            const child = spawn(binary, [...args, outDir], {
              cwd: outDir,
              stdio: options.verbose ? 'inherit' : 'ignore',
            })
            child.on('error', reject)
            child.on('close', (code) => {
              if (code === 0) resolve()
              else
                reject(
                  new Error(
                    `[pagefind] indexer exited with code ${code}. ` +
                      'Set `verbose: true` to see its output.',
                  ),
                )
            })
          })

          logger.info(`[pagefind] indexed ${outDir} into the Pagefind bundle`)
        } catch (error) {
          logger.warn(
            `[pagefind] indexing failed: ${
              error instanceof Error ? error.message : String(error)
            }. The site is unaffected; only search is missing.`,
          )
        }
      },
    },
  }
}
