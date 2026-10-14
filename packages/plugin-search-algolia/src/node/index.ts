import { createHash } from 'node:crypto'
import type { BoltdocsPlugin, SearchIndexParams } from 'boltdocs'
import {
  generateAlgoliaRecords,
  algoliaIndexSettings,
  diffRecords,
  type AlgoliaRecord,
} from './records'

export {
  generateAlgoliaRecords,
  algoliaIndexSettings,
  diffRecords,
  recordFingerprint,
  type AlgoliaRecord,
} from './records'

/**
 * Push Boltdocs search records to an Algolia index at build time.
 *
 * ```ts
 * import algoliaSearch from '@bdocs/plugin-search-algolia'
 *
 * export default defineConfig({
 *   plugins: [
 *     algoliaSearch({
 *       appId: process.env.ALGOLIA_APP_ID!,
 *       adminApiKey: process.env.ALGOLIA_ADMIN_KEY!,
 *       indexName: 'docs',
 *     }),
 *   ],
 * })
 * ```
 *
 * This is the build half of Algolia support. `@bdocs/theme-neutral` could
 * already *query* an Algolia index — reading `hierarchy`, `anchor` and
 * `_snippetResult` off each hit — but nothing ever uploaded anything, so a
 * configured site got an empty result set with no error anywhere. The plugin
 * closes that half.
 *
 * ## Keys
 *
 * `adminApiKey` writes to the index and must never reach the browser. It is read
 * from the environment and the *search-only* key belongs in
 * `integrations.search.algolia.apiKey`, which is what the client already uses.
 * A build-time plugin holding an admin key and a client config holding a
 * search-only key is the only arrangement that keeps both properties.
 */
export interface AlgoliaSearchOptions {
  appId: string
  /** Admin key: write access. Build-time only. */
  adminApiKey: string
  indexName: string
  /**
   * Skip the upload and only report what would be sent.
   *
   * Useful in CI to verify an index config without writing to it, and the only
   * mode that runs without credentials.
   */
  dryRun?: boolean
  /** Record fields to highlight in results. Defaults to `content:20`. */
  snippetLength?: number
  /**
   * Upload only what changed since the last successful push.
   *
   * A full push on every build re-sends every record, which on a 2000-page
   * site is thousands of needless operations and, on a free tier, a quota bill.
   * Comparing a content fingerprint per record makes an incremental build
   * proportional to the edit — the same property the SSG page cache has.
   *
   * Off by default: the fingerprint is kept in memory, so it only survives a
   * process that stays alive across builds. Do not turn it on for a one-shot
   * `boltdocs build`; it would compute fingerprints and always upload anyway.
   */
  incremental?: boolean
}

const DEFAULT_SNIPPET = 20

/**
 * Push records through Algolia's REST API.
 *
 * `fetch` rather than an SDK: the two calls this needs are one settings PUT and
 * one batch POST, and a dependency that exists to make them would be larger than
 * the code it replaced.
 */
export async function upload(
  options: AlgoliaSearchOptions,
  changed: AlgoliaRecord[],
  removed: string[],
  logger: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> {
  const base = `https://${options.appId}.algolia.net/1/indexes/${encodeURIComponent(options.indexName)}`
  const headers = {
    'Content-Type': 'application/json',
    'X-Algolia-API-Key': options.adminApiKey,
    'X-Algolia-Application-Id': options.appId,
  }

  const settings = algoliaIndexSettings()
  if (options.snippetLength !== undefined) {
    ;(settings.attributesToSnippet as string[]) = [
      `content:${options.snippetLength}`,
    ]
  }

  const settingsResponse = await fetch(`${base}/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  })
  if (!settingsResponse.ok) {
    throw new Error(
      `Algolia settings update failed (${settingsResponse.status}): ${await settingsResponse.text()}`,
    )
  }
  logger.info(`[algolia] settings applied to index "${options.indexName}"`)

  // Records that no longer exist upstream. Leaving them in the index means a
  // deleted page keeps answering searches, which is worse than it sounds: the
  // result links to a 404 and the reader cannot tell the search is stale.
  if (removed.length > 0) {
    await sendBatch(
      base,
      headers,
      logger,
      'delete',
      removed.map((objectID) => ({ objectID })),
    )
    logger.info(`[algolia] removed ${removed.length} stale records`)
  }

  // Algolia's batch endpoint caps a request at 1000 operations.
  const CHUNK = 1000
  let uploaded = 0
  for (let offset = 0; offset < changed.length; offset += CHUNK) {
    const chunk = changed.slice(offset, offset + CHUNK)
    await sendBatch(base, headers, logger, 'updateObject', chunk)
    uploaded += chunk.length
    logger.info(`[algolia] uploaded ${uploaded}/${changed.length} records`)
  }

  logger.info(
    `[algolia] ${uploaded} records pushed to "${options.indexName}"${
      removed.length ? `, ${removed.length} removed` : ''
    }`,
  )
}

/** One batch request. Algolia caps a batch at 1000 operations. */
async function sendBatch(
  base: string,
  headers: Record<string, string>,
  logger: { info: (m: string) => void },
  action: 'updateObject' | 'deleteObject',
  bodies: unknown[],
): Promise<void> {
  const response = await fetch(`${base}/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requests: bodies.map((body) => ({ action, body })),
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Algolia batch ${action} failed (${response.status}): ${await response.text()}`,
    )
  }
  void logger
}

export default function algoliaSearchPlugin(
  options: AlgoliaSearchOptions,
): BoltdocsPlugin {
  const { dryRun = false, incremental = false } = options
  // Fingerprints from the last successful push, keyed by objectID. Module
  // scope so a process that builds repeatedly (watch mode, a CI loop) reuses
  // them instead of re-uploading a site whose content did not change.
  let pushed = new Map<string, string>()

  return {
    name: 'plugin-search-algolia',
    version: '1.0.0',
    hooks: {
      async 'search:index'(
        ctx: {
          logger?: { info: (m: string) => void; warn: (m: string) => void }
        },
        params: SearchIndexParams,
      ): Promise<SearchIndexParams | undefined> {
        const logger = ctx.logger ?? console
        const records = generateAlgoliaRecords(params.documents)

        // Without `incremental` every record is "changed", which is the correct
        // behaviour for a one-shot build: the cache below is empty anyway.
        const { changed, removed } = incremental
          ? diffRecords(records, pushed)
          : { changed: records, removed: [] as string[] }

        if (changed.length === 0 && removed.length === 0) {
          logger.info(
            `[algolia] index "${options.indexName}" is already up to date`,
          )
          return undefined
        }

        if (dryRun) {
          logger.info(
            `[algolia] dry run: ${changed.length} records would be pushed and ${removed.length} removed from "${options.indexName}"`,
          )
          return undefined
        }

        try {
          await upload(options, changed, removed, logger)
          if (incremental) {
            pushed = new Map(
              records.map((record) => [
                record.objectID,
                createHash('sha1').update(JSON.stringify(record)).digest('hex'),
              ]),
            )
          }
        } catch (error) {
          // A failed upload must not take the build down: the site is fine and
          // the previous index is still serving. Warn loudly instead.
          logger.warn(
            `[algolia] failed to push records: ${
              error instanceof Error ? error.message : String(error)
            }. The existing index is unchanged.`,
          )
        }

        // No `entries`: this engine owns its index and the runtime
        // `search.json` would be unread by any client configured for Algolia.
        return undefined
      },
    },
  }
}
