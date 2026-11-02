import fs from 'node:fs'
import path from 'node:path'
import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { resolveRedirects, type ResolvedRedirect } from '../../redirects'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toOutputFile(pathname: string, dirStyle: 'flat' | 'nested'): string {
  const relative = pathname.replace(/^\/+/, '')
  if (!relative) return 'index.html'
  return dirStyle === 'nested'
    ? path.join(relative, 'index.html')
    : `${relative.replace(/\/+$/, '')}.html`
}

/**
 * Emits a static HTML document for every configured redirect.
 *
 * A static host answers `/old` with this file, which redirects the visitor
 * without depending on client-side JavaScript. The document also declares the
 * status semantics through `<link rel="canonical">` so crawlers consolidate the
 * signal, and uses `location.replace` so the redirect never pollutes history.
 */
export function renderRedirectHtml(
  redirect: ResolvedRedirect,
  siteUrl?: string,
): string {
  const target = escapeHtml(redirect.to)
  const canonical = siteUrl
    ? escapeHtml(new URL(redirect.to, siteUrl).toString())
    : target

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex, follow" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <link rel="canonical" href="${canonical}" />
    <title>Redirecting…</title>
  </head>
  <body>
    <p>This page has moved to <a href="${target}">${target}</a>.</p>
    <script>
      window.location.replace(${JSON.stringify(redirect.to)})
    </script>
  </body>
</html>
`
}

export class RedirectsWriteStep implements PipelineStep<BuildContext> {
  name = 'RedirectsWrite'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.config) return

    const outDir = path.resolve(ctx.root, ctx.outDir ?? 'dist')
    const redirects = resolveRedirects({
      config: ctx.config,
      knownPaths: (ctx.routes ?? []).map((route) => route.path),
    })
    if (redirects.length === 0) return

    const dirStyle =
      ctx.viteConfig?.ssgOptions?.dirStyle === 'nested' ? 'nested' : 'flat'

    for (const redirect of redirects) {
      const filePath = path.join(outDir, toOutputFile(redirect.from, dirStyle))
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(
        filePath,
        renderRedirectHtml(redirect, ctx.config.siteUrl),
        'utf-8',
      )
    }

    ctx.timing[this.name] = Date.now()
  }
}
