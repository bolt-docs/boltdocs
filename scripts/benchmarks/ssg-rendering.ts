import { Bench } from 'tinybench'
import type { BenchmarkConfig, SuiteResult } from './utils/types'
import { collectSuiteResult } from './utils/types'

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benchmark Page</title>
  <link rel="stylesheet" href="/assets/style.css">
  <link rel="preload" href="/assets/main.js" as="script">
</head>
<body>
  <div id="root">
    <nav class="sidebar">
      <ul>
        <li><a href="/docs/intro">Introduction</a></li>
        <li><a href="/docs/getting-started">Getting Started</a></li>
        <li><a href="/docs/api">API Reference</a></li>
      </ul>
    </nav>
    <main class="content">
      <article>
        <h1>Welcome to the Benchmark</h1>
        <p>This is a sample page for benchmarking SSG rendering performance.</p>
        <section>
          <h2>Section One</h2>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          <pre><code class="language-typescript">
interface Page {
  title: string
  content: string
  metadata: Record<string, unknown>
}
          </code></pre>
        </section>
        <section>
          <h2>Section Two</h2>
          <table>
            <thead><tr><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Item A</td><td>100</td></tr>
              <tr><td>Item B</td><td>200</td></tr>
            </tbody>
          </table>
        </section>
      </article>
    </main>
    <aside class="on-this-page">
      <h4>On This Page</h4>
      <ul>
        <li><a href="#section-one">Section One</a></li>
        <li><a href="#section-two">Section Two</a></li>
      </ul>
    </aside>
  </div>
  <script>
    window.__BOLTDOCS_DATA__ = {"routes":[{"path":"/docs/intro","title":"Introduction"}]}
  </script>
</body>
</html>`

const SAMPLE_SCRIPTS = [
  '<script>window.__INITIAL_STATE__ = { page: "intro", locale: "en" }</script>',
  '<script>!function(){var e=document.createElement("script");e.src="/assets/vendor.js";document.body.appendChild(e)}()</script>',
  '<script type="module" src="/assets/app.js"></script>',
]

export async function runSSGRenderingSuite(
  config: BenchmarkConfig,
): Promise<SuiteResult> {
  const { JSDOM } = await import('jsdom')

  const bench = new Bench({
    name: 'SSG Rendering',
    time: config.time,
    iterations: config.iterations,
    warmupIterations: config.warmupIterations,
    warmupTime: config.warmupTime,
  })

  bench.add('JSDOM parse (simple HTML)', () => {
    new JSDOM(SAMPLE_HTML)
  })

  bench.add('JSDOM parse + querySelector', () => {
    const dom = new JSDOM(SAMPLE_HTML)
    const doc = dom.window.document
    doc.querySelector('h1')
    doc.querySelector('article')
    doc.querySelectorAll('section')
    doc.querySelector('.sidebar')
    doc.querySelector('.on-this-page')
  })

  bench.add('JSDOM parse + innerHTML read', () => {
    const dom = new JSDOM(SAMPLE_HTML)
    const doc = dom.window.document
    const article = doc.querySelector('article')
    if (article) {
      article.innerHTML
    }
  })

  bench.add('JSDOM parse + script injection', () => {
    const dom = new JSDOM(SAMPLE_HTML)
    const doc = dom.window.document
    for (const script of SAMPLE_SCRIPTS) {
      const scriptEl = doc.createElement('div')
      scriptEl.innerHTML = script
      doc.body.appendChild(scriptEl)
    }
  })

  bench.add('JSDOM parse + full DOM traversal', () => {
    const dom = new JSDOM(SAMPLE_HTML)
    const doc = dom.window.document
    function walk(node: any): number {
      let count = 1
      for (const child of node.childNodes) {
        if (child.nodeType === 1) count += walk(child)
      }
      return count
    }
    walk(doc.body)
  })

  bench.add('HTML string manipulation (no DOM)', () => {
    let html = SAMPLE_HTML
    html = html.replace(
      '</body>',
      '<script>window.__LOADED__=true</script></body>',
    )
    html = html.replace(
      '<head>',
      '<head><meta name="generator" content="boltdocs">',
    )
    html = html.concat('<!-- rendered by boltdocs -->')
  })

  bench.add('Critical CSS extraction (simulated)', () => {
    const cssRules = [
      '.sidebar { width: 260px; display: flex; flex-direction: column; }',
      '.content { flex: 1; padding: 2rem; max-width: 800px; }',
      '.on-this-page { width: 200px; position: sticky; top: 2rem; }',
      'nav ul { list-style: none; padding: 0; }',
      'nav a { text-decoration: none; color: #333; display: block; padding: 0.5rem; }',
      'nav a:hover { background: #f5f5f5; }',
      'article h1 { font-size: 2rem; margin-bottom: 1rem; }',
      'article h2 { font-size: 1.5rem; margin: 2rem 0 1rem; }',
      'table { border-collapse: collapse; width: 100%; }',
      'th, td { border: 1px solid #ddd; padding: 0.5rem; }',
      'pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 4px; overflow-x: auto; }',
      'code { font-family: "Fira Code", monospace; }',
    ]
    const result: string[] = []
    for (let i = 0; i < cssRules.length; i++) {
      if (Math.random() > 0.3) {
        result.push(cssRules[i])
      }
    }
    const output = '<style>' + result.join('\n') + '</style>'
    return output
  })

  bench.add('Preload links generation', () => {
    const assets = [
      '/assets/app-abc123.js',
      '/assets/vendor-def456.js',
      '/assets/styles-ghi789.css',
      '/assets/fonts/inter-var.woff2',
    ]
    const links = assets.map((asset) => {
      if (asset.endsWith('.js'))
        return `<link rel="modulepreload" href="${asset}">`
      if (asset.endsWith('.css'))
        return `<link rel="stylesheet" href="${asset}">`
      if (asset.endsWith('.woff2'))
        return `<link rel="preload" href="${asset}" as="font" type="font/woff2" crossorigin>`
      return `<link rel="preload" href="${asset}">`
    })
    links.join('\n')
  })

  const start = performance.now()
  await bench.run()
  const duration = performance.now() - start

  return collectSuiteResult('SSG Rendering', bench, duration)
}
