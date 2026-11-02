# Official Plugins

All official `@bdocs/*` plugins use the `createPlugin`/`definePlugin` API and are published on npm.

---

## `@bdocs/plugin-tailwindcss`

**Purpose**: Integrates Tailwind CSS v4 via `@tailwindcss/vite`.

```bash
pnpm add -D @bdocs/plugin-tailwindcss tailwindcss
```

```ts title="boltdocs.config.ts"
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

export default defineConfig({
  plugins: [tailwindcssPlugin()],
})
```

Then use `@import "tailwindcss"` in your `index.css` and customize with `@theme` blocks.

---

## `@bdocs/plugin-sass`

**Purpose**: Provides SASS/SCSS preprocessing support via Vite's CSS preprocessor configuration.

```bash
pnpm add -D @bdocs/plugin-sass sass-embedded
```

```ts title="boltdocs.config.ts"
import sassPlugin from '@bdocs/plugin-sass'

export default defineConfig({
  plugins: [
    sassPlugin({
      additionalData: '@import "variables";',   // Injected into every SCSS file
      api: 'modern',                            // 'modern' | 'legacy'
      includePaths: ['./src/styles'],           // Additional import paths
    }),
  ],
})
```

---

## `@bdocs/plugin-unocss`

**Purpose**: Integrates UnoCSS atomic CSS engine via `@unocss/vite`.

```bash
pnpm add -D @bdocs/plugin-unocss unocss
```

```ts title="boltdocs.config.ts"
import unocssPlugin from '@bdocs/plugin-unocss'

export default defineConfig({
  plugins: [
    unocssPlugin({
      configFile: './uno.config.ts',
      mode: 'global',  // 'global' | 'per-module' | 'vue-scoped' | 'shadow-dom'
    }),
  ],
})
```

Create `uno.config.ts` with your presets.

---

## `@bdocs/plugin-mermaid`

**Purpose**: Automatically transforms standard `mermaid` code blocks into interactive, responsive diagrams that dynamically sync with light/dark theme preferences.

```bash
pnpm add @bdocs/plugin-mermaid
```

```ts title="boltdocs.config.ts"
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  plugins: [
    mermaidPlugin({
      themes: {
        light: 'neutral',   // Mermaid theme for light mode
        dark: 'dark',       // Mermaid theme for dark mode
      },
    }),
  ],
})
```

Then use standard mermaid code blocks:

````markdown
```mermaid
graph TD
    A[Start] --> B[End]
```
````

---

## `@bdocs/plugin-math`

**Purpose**: Integrates KaTeX for rendering LaTeX math equations. Automatically transforms `$...$` (inline) and `$$...$$` (block) delimiters.

```bash
pnpm add @bdocs/plugin-math
```

```ts title="boltdocs.config.ts"
import mathPlugin from '@bdocs/plugin-math'

export default defineConfig({
  plugins: [mathPlugin()],
})
```

Usage in MDX:

```markdown
Inline: $E = mc^2$

Block:
$$ \sum_{i=1}^{n} i = \frac{n(n+1)}{2} $$
```

---

## `@bdocs/plugin-rss`

**Purpose**: Automatically generates RSS 2.0 and Atom feeds from your documentation routes. Supports i18n and collection filtering.

```bash
pnpm add @bdocs/plugin-rss
```

```ts title="boltdocs.config.ts"
import rssPlugin from '@bdocs/plugin-rss'

export default defineConfig({
  plugins: [rssPlugin()],
})
```

Feeds are generated at `dist/rss.xml` and `dist/atom.xml` during production builds.

---

## `@bdocs/plugin-llms-text`

**Purpose**: Generates an `llms.txt` file following the [llmstxt.org](https://llmstxt.org/) specification. Provides a standardized plain-text index of documentation optimized for Large Language Models and AI agents.

```bash
pnpm add @bdocs/plugin-llms-text
```

```ts title="boltdocs.config.ts"
import llmsTextPlugin from '@bdocs/plugin-llms-text'

export default defineConfig({
  plugins: [
    llmsTextPlugin({
      title: 'My Project',               // H1 heading (defaults to site title)
      description: 'Project docs',        // Blockquote summary
      bodyText: 'Additional LLM context', // Optional markdown body
      sortBy: 'sidebarPosition',          // 'path' | 'title' | 'sidebarPosition'
      maxLinksPerSection: 50,
      includeDrafts: false,
      devMode: false,                     // Generate in dev mode
      addLinkTag: true,                   // Add <link rel="llms-txt"> to HTML
      sections: [                         // Custom sections (optional)
        { title: 'Core', pathPrefix: '/docs/core', description: 'Core docs' },
        { title: 'Blog', pathPrefix: '/blog', description: 'Blog posts', optional: true },
      ],
    }),
  ],
})
```

Generated file: `dist/llms.txt`

---

## `@bdocs/plugin-image-optimizer`

**Purpose**: Optimizes images using Sharp and SVGO during the build process.

```bash
pnpm add @bdocs/plugin-image-optimizer
```

---

## `@bdocs/plugin-ask-ai`

**Purpose**: Provides a context-aware AI assistant querying interface for your documentation. Lets users ask questions about your docs.

```bash
pnpm add @bdocs/plugin-ask-ai
```

---

## `@bdocs/plugin-seo`

**Purpose**: Resolves `canonical`, `og:url` and `og:image` on every route, then writes `sitemap.xml` and `robots.txt`. **Until 4.0 the core did this itself and needed no configuration** — a 4.0 site that installs nothing loses its sitemap and its canonical tags.

```bash
pnpm add @bdocs/plugin-seo
```

```ts title="boltdocs.config.ts"
import seo from '@bdocs/plugin-seo'

export default defineConfig({
  siteUrl: 'https://example.com',
  plugins: [seo()],
})
```

Two hooks, because SEO has two jobs at different points in the build: route metadata runs before the SSG render (the client `Head` reads it), while `sitemap.xml` and `robots.txt` need the output directory to exist.

---

## `@bdocs/plugin-search`

**Purpose**: Builds `search.json` — the offline index the default search dialog reads. Registered through the core's search registry on `build:routes`, so `virtual:boltdocs-search` has data before it is resolved.

```bash
pnpm add @bdocs/plugin-search
```

```ts title="boltdocs.config.ts"
import search from '@bdocs/plugin-search'

export default defineConfig({
  plugins: [search()],
})
```

`{ enabled: false }` keeps the plugin configured but skips generation — for a site that builds the index in a separate step.

---

## `@bdocs/plugin-search-algolia`

**Purpose**: Pushes the same search records to an Algolia index at build time.

```bash
pnpm add @bdocs/plugin-search-algolia
```

| Option | Meaning |
| --- | --- |
| `appId`, `indexName` | Algolia application and target index |
| `adminApiKey` | **Write** key. Build-time only — read it from the environment |
| `dryRun` | Report what would be sent without uploading; the only mode that runs without credentials |
| `snippetLength` | Highlight width in results (default `content:20`) |
| `incremental` | Upload only records whose fingerprint changed (in-memory, so useless for a one-shot build) |

The **admin** key stays at build time; the **search-only** key belongs in `integrations.search.algolia.apiKey`, which is what the client uses.

---

## `@bdocs/plugin-search-pagefind`

**Purpose**: Indexes the static output with Pagefind after the build.

```bash
pnpm add @bdocs/plugin-search-pagefind
```

Pagefind ships its indexer as a platform binary (an optional peer), so only the binary for the build machine is installed. Options include `root` (narrow what gets indexed), `excludeSelectors`, `excludePatterns`, `siteKey` and `binaryPath`.

---

## `@bdocs/plugin-git-meta`

**Purpose**: Derives page metadata from git history instead of frontmatter. Two independent plugins share one cached `git log` scan:

| Plugin | Adds |
| --- | --- |
| `lastUpdatedPlugin()` | `route.lastUpdated` — last non-merge commit touching the page |
| `contributorsPlugin()` | `route.contributors` — authors of every non-merge commit touching the page |

```bash
pnpm add @bdocs/plugin-git-meta
```

```ts title="boltdocs.config.ts"
import { contributorsPlugin, lastUpdatedPlugin } from '@bdocs/plugin-git-meta'

export default defineConfig({
  plugins: [lastUpdatedPlugin(), contributorsPlugin()],
})
```

Both run on `routes:resolved`, so the data reaches the SSG route table as well as the client route module. Contributor emails are never sent to the client unless you opt in.

---

## `@bdocs/unist-utils`

**Purpose**: Strictly-typed AST utilities for unist/mdast/hast used by Boltdocs core and every official plugin. Exports visitors, AST builders, h-properties helpers, class-list mutation, and meta string parsing helpers.

Used as a dependency by core — available to plugins:

```ts
import { visit, builders, hProperties, classList, parseMeta } from '@bdocs/unist-utils'
```

---

## Plugin Compatibility

All plugins specify a `boltdocsVersion` field for version compatibility. The plugin validator checks this at load time:

```ts
// Plugin validation throws PluginCompatibilityError on mismatch
boltdocsVersion: '>=3.0.0'
```
