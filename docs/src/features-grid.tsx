import { Fragment, useRef } from 'react'
import { useGSAPScroll } from './hooks/useGSAPScroll'
import { Grainient } from './grainient'
import { NoiseOverlay } from './noise-overlay'

interface Feature {
  title: string
  description: string
  code: string
  delay: number
  colors: { color1: string; color2: string; color3: string }
}

const JS_KEYWORDS = new Set([
  'export',
  'default',
  'const',
  'import',
  'from',
  'function',
  'var',
  'let',
  'return',
  'if',
  'else',
  'for',
  'while',
  'true',
  'false',
  'null',
  'undefined',
  'new',
  'try',
  'catch',
  'async',
  'await',
  'type',
  'interface',
])

function highlightLine(line: string) {
  if (line.trimStart().startsWith('//') || line.trimStart().startsWith('#')) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic">{line}</span>
    )
  }

  const tokens: React.ReactNode[] = []
  let i = 0

  while (i < line.length) {
    const rest = line.slice(i)

    const strMatch = rest.match(/^(["'`])(?:(?!\1|\\).|\\.)*\1/)
    if (strMatch) {
      tokens.push(
        <span key={i} className="text-orange-600 dark:text-orange-300">
          {strMatch[0]}
        </span>,
      )
      i += strMatch[0].length
      continue
    }

    const wordMatch = rest.match(/^[\p{L}_$][\p{L}\d_$]*/u)
    if (wordMatch) {
      const word = wordMatch[0]
      if (JS_KEYWORDS.has(word)) {
        tokens.push(
          <span key={i} className="text-red-600 dark:text-red-400">
            {word}
          </span>,
        )
      } else {
        tokens.push(word)
      }
      i += word.length
      continue
    }

    const numMatch = rest.match(/^\d+(\.\d+)?/)
    if (numMatch) {
      tokens.push(
        <span key={i} className="text-blue-600 dark:text-blue-400">
          {numMatch[0]}
        </span>,
      )
      i += numMatch[0].length
      continue
    }

    if (rest[0] === '{' || rest[0] === '}') {
      tokens.push(
        <span key={i} className="text-gray-500 dark:text-gray-400">
          {rest[0]}
        </span>,
      )
      i++
      continue
    }

    tokens.push(rest[0])
    i++
  }

  return <>{tokens}</>
}

function highlightCode(code: string) {
  const lines = code.split('\n')
  return lines.map((line, idx) => (
    <Fragment key={idx}>
      {idx > 0 && '\n'}
      {highlightLine(line)}
    </Fragment>
  ))
}

const FEATURES: Feature[] = [
  {
    title: 'Instant Hot Reload',
    description:
      'Every save triggers an instant, surgical update — no full-page reload, no state loss. Your docs refresh faster than you can alt-tab.',
    code: `⡿ src/docs/guides/getting-started.mdx changed
  ⠋ Rebuilding route...
  ✔ Route updated in 12ms
  ⠋ Hot-module replacing...
  ✔ HMR applied (0.3ms)
→ Ready at http://localhost:4321`,
    delay: 0,
    colors: { color1: '#7C3AED', color2: '#2D1B69', color3: '#0f0f1a' },
  },
  {
    title: 'Lightning Builds',
    description:
      'From cold start to deploy-ready HTML in under 200ms per page. Powered by Vite and aggressive caching at every layer.',
    code: `⚡ boltdocs build — v2.9.0
  [1/3] Resolving routes    ✔  84 routes
  [2/3] Bundling pages      ✔  6.2 MB (2.1s)
  [3/3] Generating static   ✔  78 pages
  ╭────────────┬────────╮
  │ Build Time │ 2.1s   │
  │ Pages      │ 78     │
  │ JavaScript │ 6.2 MB │
  │ CSS        │ 93 kB  │
  ╰────────────┴────────╯
  ✔ Build complete — dist/ ready`,
    delay: 0.15,
    colors: { color1: '#4F46E5', color2: '#1E1B4B', color3: '#0f0f1a' },
  },
  {
    title: 'Full SEO Control',
    description:
      'Automatic Open Graph images, sitemaps, structured data, and meta tags — no plugins, no extra config. Every page is SEO-ready from line one.',
    code: `export default defineConfig({
  siteUrl: 'https://example.com',
  seo: {
    indexing: 'all',
    thumbnails: {
      background: '/og-image.webp',
    },
  },
  robots: {
    rules: [{ userAgent: '*', allow: '/' }],
  },
})`,
    delay: 0.3,
    colors: { color1: '#8B5CF6', color2: '#2E1065', color3: '#0f0f1a' },
  },
  {
    title: 'Built-in Search',
    description:
      'Typo-tolerant, instant search that works offline. FlexSearch powered out of the box — no Algolia key, no third-party service required.',
    code: `🔍 Searching "instalation"…
  Did you mean "installation"?
    docs/guides/getting-started/installation.mdx
    └─ Getting Started — Installation
    └─ pnpm create boltdocs@latest

  instalation
    └─ No results found

  ◉ Fuzzy match enabled (threshold: 0.6)
  ◉ 12 results in 0.8ms`,
    delay: 0.45,
    colors: { color1: '#6366F1', color2: '#1E1B4B', color3: '#0f0f1a' },
  },
  {
    title: 'Secure by Default',
    description:
      'Automated dependency auditing, hardened build pipelines, and CSP headers baked into every deployment. Security is not an afterthought.',
    code: `🔒 Security Audit — boltdocs v2.9.0
  ✓ Dependencies scanned: 1,284
  ✓ Known vulnerabilities: 0
  ╭──────────────────────┬──────╮
  │ Package              │ Risk │
  ├──────────────────────┼──────┤
  │ esbuild              │ low  │
  │ postcss              │ none │
  │ typescript           │ none │
  ╰──────────────────────┴──────╯
  → Run pnpm audit for full report`,
    delay: 0.6,
    colors: { color1: '#9333EA', color2: '#3B0764', color3: '#0f0f1a' },
  },
]

function FeatureRow({ feature, index }: { feature: Feature; index: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isReversed = index % 2 !== 0

  useGSAPScroll(containerRef, {
    animation: 'fade-up',
    delay: feature.delay,
    duration: 0.6,
    intensity: 30,
  })

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} gap-6 md:gap-10 items-center opacity-0`}
    >
      {/* Preview */}
      <div className="relative w-full md:w-1/2 h-[26rem] rounded-2xl overflow-hidden border border-white/10 shadow-xl">
        <Grainient
          className="absolute inset-0"
          color1={feature.colors.color1}
          color2={feature.colors.color2}
          color3={feature.colors.color3}
          animated={false}
          blendAngle={45}
          blendSoftness={0.15}
          noiseScale={3}
          zoom={0.9}
          grainAmount={0.04}
          contrast={1.3}
        />
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative h-full p-6">
          <div className="h-full rounded-xl bg-neutral-950 dark:bg-neutral-50 p-4 border border-white/5 overflow-x-auto">
            <code className="font-mono text-xs leading-snug whitespace-pre text-neutral-100 dark:text-neutral-900 min-w-0">
              {highlightCode(feature.code)}
            </code>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="w-full md:w-1/2 space-y-3">
        <h3 className="text-xl md:text-2xl font-bold tracking-tight text-body">
          {feature.title}
        </h3>
        <p className="text-body/70 leading-relaxed text-base">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

export const FeaturesGrid = () => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)

  useGSAPScroll(titleRef, { animation: 'fade-up', delay: 0, duration: 0.6 })
  useGSAPScroll(subtitleRef, {
    animation: 'fade-up',
    delay: 0.1,
    duration: 0.6,
  })

  return (
    <section className="py-20 px-6 overflow-hidden bg-main/40 relative">
      <NoiseOverlay />
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2
            ref={titleRef}
            className="text-2xl md:text-4xl font-black tracking-tighter border-0 text-body mb-6 opacity-0"
          >
            Powerful Features
          </h2>
          <p
            ref={subtitleRef}
            className="max-w-2xl mx-auto text-lg leading-relaxed opacity-0 text-body/70"
          >
            Everything you need to ship world-class technical documentation.
          </p>
        </div>

        <div className="flex flex-col gap-16">
          {FEATURES.map((feature, i) => (
            <FeatureRow key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
