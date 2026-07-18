/**
 * Standalone worker for rendering mermaid diagrams in a child process.
 *
 * Uses a persistent Playwright browser to render diagrams in a real
 * browser environment, avoiding jsdom's incomplete SVG support
 * (missing getBBox, getCTM, etc.) that causes incorrect layout.
 *
 * Protocol:
 *   stdin:  {"chart":"...", "lightTheme":{...}, "darkTheme":{...}}\n
 *   stdout: {"svgLight":"...", "svgDark":"...", "error":"..."}\n
 *
 * The worker exits when stdin is closed.
 */

import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { MermaidThemeVariables } from '../shared/types'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'

// ── Load mermaid source from local node_modules ───────────────
// Read once at startup, inject inline into every render page.
// This avoids CDN dependency (slower, unreliable in CI/Docker).
const pluginDir = fileURLToPath(new URL('../..', import.meta.url))
let mermaidSource: string | null = null

try {
  // Try common paths where mermaid dist might be located
  const paths = [
    `${pluginDir}/node_modules/mermaid/dist/mermaid.min.js`,
    `${pluginDir}/../../node_modules/mermaid/dist/mermaid.min.js`,
  ]
  for (const p of paths) {
    try {
      mermaidSource = readFileSync(p, 'utf-8')
      break
    } catch {}
  }
} catch {
  // mermaid source will be loaded from CDN as fallback
}

// ── Persistent browser (launched once per worker) ─────────────
let browser: Browser | null = null
let context: BrowserContext | null = null

async function ensureContext(): Promise<BrowserContext> {
  if (context) return context

  if (!browser) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      })
    } catch {
      // Chromium not installed — try to install it automatically
      const { execSync } = await import('node:child_process')
      try {
        execSync('npx playwright install chromium', {
          stdio: 'inherit',
          timeout: 120_000,
        })
        // Retry launch after installation
        browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        })
      } catch {
        throw new Error(
          'Failed to launch Playwright Chromium. ' +
            'Run `npx playwright install chromium` manually, ' +
            'or ensure Chromium is available on your system.',
        )
      }
    }
  }

  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  return context
}

/**
 * Build an inline HTML page that renders the chart with Mermaid.
 * Returns the SVG string via a global `__RESULT__` variable.
 */
function buildRenderPage(
  chart: string,
  themeVars: Record<string, string | undefined>,
  darkMode: boolean,
): string {
  const cleanVars: Record<string, string> = {}
  for (const [k, v] of Object.entries(themeVars)) {
    if (v !== undefined) cleanVars[k] = v
  }

  const localScript = mermaidSource
    ? `<script>${mermaidSource}</script>`
    : '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>'

  return `<!DOCTYPE html>
<html>
<head>
  ${localScript}
</head>
<body>
  <div id="graph"></div>
  <script>
    (async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          htmlLabels: false,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          themeVariables: ${JSON.stringify(cleanVars)},
          darkMode: ${JSON.stringify(darkMode)},
          flowchart: { htmlLabels: false, useMaxWidth: true, nodeSpacing: 50, rankSpacing: 60 },
        });
        const { svg } = await mermaid.render('g', ${JSON.stringify(chart)});
        window.__RESULT__ = svg;
      } catch (err) {
        window.__ERROR__ = err instanceof Error ? err.message : String(err);
      }
    })();
  </script>
</body>
</html>`
}

/**
 * Normalize SVG for embedding: only unique IDs to avoid conflicts
 * when multiple diagrams are on the same page.
 */
function normalizeIds(svg: string): string {
  const id = `m-${Math.random().toString(36).slice(2, 9)}`
  return svg
    .replace(/id="mermaid-[^"]*"/g, `id="${id}"`)
    .replace(/url\(#mermaid-[^)]*\)/g, `url(#${id})`)
}

/**
 * Render a single chart with the given theme.
 * Uses a lightweight page (~10ms to create) and reuses the browser context.
 */
async function renderChart(
  chart: string,
  themeVars: Record<string, string | undefined>,
  darkMode: boolean,
): Promise<string> {
  const ctx = await ensureContext()
  let page: Page | null = null

  try {
    page = await ctx.newPage()

    const html = buildRenderPage(chart, themeVars, darkMode)
    await page.setContent(html, { waitUntil: 'networkidle' })

    // Wait for mermaid to finish (either result or error)
    await page.waitForFunction(
      () =>
        (window as any).__RESULT__ !== undefined ||
        (window as any).__ERROR__ !== undefined,
      { timeout: 10_000 },
    )

    const error = await page.evaluate(() => (window as any).__ERROR__)
    if (error) {
      throw new Error(`Mermaid render error: ${error}`)
    }

    const svg = await page.evaluate(() => (window as any).__RESULT__)
    if (!svg) {
      throw new Error('Mermaid returned empty SVG')
    }

    return normalizeIds(svg)
  } finally {
    if (page) await page.close()
  }
}

// ── Sequential queue (prevents concurrent mermaid renders) ────
let lastRender: Promise<void> = Promise.resolve()

async function sequential<T>(fn: () => Promise<T>): Promise<T> {
  const prev = lastRender
  let release: () => void
  const wait = new Promise<void>((r) => {
    release = r
  })
  lastRender = wait
  await prev.catch(() => {})
  try {
    return await fn()
  } finally {
    release!()
  }
}

// ── Public API ────────────────────────────────────────────────

interface WorkerOutput {
  svgLight?: string
  svgDark?: string
  error?: string
}

/**
 * Render a mermaid diagram for both light & dark themes using a
 * persistent Playwright browser.
 */
export async function renderMermaidBothThemes(
  chart: string,
  lightTheme: MermaidThemeVariables,
  darkTheme: MermaidThemeVariables,
): Promise<WorkerOutput> {
  return sequential(async () => {
    try {
      const [svgLight, svgDark] = await Promise.all([
        renderChart(chart, lightTheme, false),
        renderChart(chart, darkTheme, true),
      ])

      // Cleanup: remove fixed width/height, add overflow:visible,
      // reorder nodes on top of edge labels, make edge labels semi-transparent
      const clean = (svg: string) => {
        let result = svg.replace(/<svg([^>]*)>/i, (_match, attrs: string) => {
          const cleaned = attrs
            .replace(/\s+width\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\s+height\s*=\s*["'][^"']*["']/gi, '')
            .replace(/\s+(min-height|style)\s*=\s*["'][^"']*["']/gi, '')
          return `<svg${cleaned} style="width:100%;height:auto;overflow:visible">`
        })

        // Reorder nodes after edgeLabels for correct z-index
        const edgeLabelsMatch = result.match(
          /<g class="edgeLabels"[^>]*>[\s\S]*?<\/g>\s*(?=<g class="nodes"|<g class="edge"|<g class="clusters")/,
        )
        const nodesMatch = result.match(/<g class="nodes"[^>]*>[\s\S]*?<\/g>/)
        if (edgeLabelsMatch && nodesMatch) {
          const edgeGroup = edgeLabelsMatch[0]
          const nodesGroup = nodesMatch[0]
          const nodesPos = result.indexOf(nodesGroup)
          const edgePos = result.indexOf(edgeGroup)
          if (nodesPos < edgePos) {
            result =
              result.slice(0, nodesPos) +
              result.slice(
                nodesPos + nodesGroup.length,
                edgePos + edgeGroup.length,
              ) +
              nodesGroup +
              result.slice(edgePos + edgeGroup.length)
          }
        }

        // Add semi-transparency to edge label backgrounds
        result = result.replace(
          /<\/style>/,
          '.edgeLabel rect { fill-opacity: 0.85; }\n  </style>',
        )

        return result
      }

      return {
        svgLight: clean(svgLight),
        svgDark: clean(svgDark),
      }
    } catch (e) {
      return { error: String(e) }
    }
  })
}

export function stopRenderer(): void {
  // Cleanup is handled in the process event below
}

// ── Cleanup on worker shutdown ────────────────────────────────
async function cleanup(): Promise<void> {
  if (context) {
    try {
      await context.close()
    } catch {}
    context = null
  }
  if (browser) {
    try {
      await browser.close()
    } catch {}
    browser = null
  }
}

process.on('exit', () => {
  // Synchronous cleanup — fire-and-forget for browser
  // The browser process will be killed when this process exits
})

process.on('SIGINT', () => {
  cleanup().finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  cleanup().finally(() => process.exit(0))
})

// ── Line-based IPC loop ───────────────────────────────────────
// Read one JSON request per line from stdin, write one JSON
// response per line to stdout. Exit cleanly when stdin closes.

interface WorkerInput {
  chart: string
  lightTheme: MermaidThemeVariables
  darkTheme: MermaidThemeVariables
}

const rl = createInterface({ input: process.stdin })

for await (const line of rl) {
  if (!line.trim()) continue
  try {
    const input: WorkerInput = JSON.parse(line)
    const output = await renderMermaidBothThemes(
      input.chart,
      input.lightTheme,
      input.darkTheme,
    )
    process.stdout.write(JSON.stringify(output) + '\n')
  } catch (err) {
    const output: WorkerOutput = { error: String(err) }
    process.stdout.write(JSON.stringify(output) + '\n')
  }
}

// Cleanup after all requests are processed
await cleanup()
