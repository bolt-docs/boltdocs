# Configuration Guide (`boltdocs.config.ts`)

Boltdocs is configured via a single `boltdocs.config.ts` file located at the root of your project. This config file is the single source of truth; you do **not** need a `vite.config.ts` file since Boltdocs generates the Vite pipeline internally.

## Basic Structure

Always use `defineConfig` to gain TypeScript autocomplete and validate configuration parameters:

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  siteUrl: 'https://docs.example.com',
  base: '/',
  theme: {
    title: 'My Docs',
    githubRepo: 'user/repo',
    logo: {
      light: '/logo-dark.svg',
      dark: '/logo-light.svg',
      alt: 'Project Logo',
    },
    tabs: [
      { id: 'guides', text: 'Guides', icon: 'BookOpen' },
      { id: 'api', text: 'API Reference', icon: 'Code2' },
    ],
  },
  plugins: [
    tailwindcssPlugin(),
    mermaidPlugin(),
  ],
})
```

---

## Top-Level Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `siteUrl` | `string` | — | Production domain URL. Used for sitemap.xml, RSS feeds, canonical headers, llms.txt |
| `base` | `string` | `'/'` | Sub-path where the website is served (e.g. `'/docs/'`) |
| `docsDir` | `string` | `'./docs'` | Relative path to the folder containing Markdown/MDX content |
| `plugins` | `BoltdocsPlugin[]` | `[]` | Array of active plugins |

---

## Theme Configuration (`theme`)

```ts
theme: {
  title: 'My Docs',                              // Browser tab title
  description: 'Documentation for My Project',   // SEO meta description
  logo: {
    light: '/logo-light.svg',                    // Light mode logo (public/)
    dark: '/logo-dark.svg',                      // Dark mode logo (public/)
    alt: 'Logo',
    width: 32,
    height: 32,
  },
  githubRepo: 'user/repo',                       // Auto-enables GitHub icon in navbar
  favicon: '/favicon.ico',                       // Custom favicon
  navbar: [                                      // Custom navbar items
    {
      label: 'Guides',
      href: '/docs/guides',
      items: [                                   // Dropdown items
        { label: 'Getting Started', href: '/docs/guides/getting-started' },
      ],
    },
  ],
  sidebar: {                                     // Custom sidebar groups overrides
    'guides': [{ text: 'Overview', link: '/docs/guides' }],
  },
  sidebarGroups: {                               // Sidebar group configuration
    'guides': { title: 'Guides', icon: 'BookOpen' },
  },
  socialLinks: [                                 // Social media links in navbar
    { icon: 'github', link: 'https://github.com/user/repo' },
    { icon: 'discord', link: 'https://discord.gg/invite' },
    { icon: 'x', link: 'https://x.com/user' },
    { icon: 'bluesky', link: 'https://bsky.app/profile/user' },
  ],
  tabs: [                                        // Top-level category tabs
    { id: 'guides', text: 'Guides', icon: 'BookOpen' },
    { id: 'api', text: 'API Reference', icon: 'Code2' },
  ],
  editLink: 'https://github.com/user/repo/edit/main/docs/:path',
  communityHelp: 'https://discord.gg/invite',
  codeTheme: 'github-dark',                     // Shiki code theme
  // Or per-mode themes:
  codeTheme: { light: 'github-light', dark: 'github-dark' },
  version: '3.0.0',                             // Current version badge
}
```

### Theme Title (i18n)
Use a `Record<string, string>` for locale-aware titles:

```ts
theme: {
  title: { en: 'Documentation', es: 'Documentación' },
  description: { en: 'Getting started guide', es: 'Guía de inicio' },
}
```

---

## Internationalization (`i18n`)

```ts
i18n: {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr'],           // Array of locale codes
  // Or with labels:
  locales: { en: 'English', es: 'Español', fr: 'Français' },
  localeConfigs: {
    en: { label: 'English', direction: 'ltr', htmlLang: 'en-US' },
    ar: { label: 'العربية', direction: 'rtl', htmlLang: 'ar-SA' },
  },
}
```

- Routes with locale prefix: `/{locale}/docs/...`
- Fallback to default locale when a translation is missing
- Place translations in `docs/{locale}/...` folders

---

## Versioning (`versions`)

```ts
versions: {
  defaultVersion: 'latest',
  prefix: 'v',                           // URL prefix (e.g. /v2/docs/)
  versions: [
    { label: 'Latest', path: 'latest' },
    { label: 'v2.0', path: 'v2.0' },
    { label: 'v1.0', path: 'v1.0' },
  ],
}
```

- Routes with version prefix: `/{version}/docs/...`
- Unversioned routes default to `defaultVersion`

---

## MDX Processor (`mdx`)

```ts
mdx: {
  processor: 'satteri',       // Default: Sätteri Rust-based compiler
  // Standard MDX: omit processor field
}
```

- `'satteri'` (default): Uses the Rust-based Sätteri MDX compiler for faster builds
- Omit the field for standard MDX processor via `@mdx-js/mdx`

---

## SSG Configuration (`ssg`)

```ts
ssg: {
  criticalCss: 'zig-critters',  // Default: WASM-based critical CSS
  // 'beasties' — JS-based critical CSS (opt-in, slower)
  // 'none' — skip critical CSS entirely
}
```

---

## Collections (`collections`)

```ts
collections: {
  labels: {
    blog: 'Blog Posts',                         // Display label for [blog] directory
    changelog: 'Changelog',                     // Display label for [changelog]
  },
  positions: {
    blog: 1,                                     // Order in sidebar
    changelog: 2,
  },
  postsPerPage: 10,                             // Pagination limit
  defaultCollection: 'blog',                    // Default collection ID
  dateFormat: 'MMMM dd, yyyy',                  // Date format
  sortBy: 'date',                                // Sort field: 'date' | 'title' | 'sidebarPosition'
}
```

---

## SEO Configuration (`seo`)

```ts
seo: {
  metatags: {                                    // Custom meta tags
    'twitter:card': 'summary_large_image',
  },
  indexing: 'all',                               // 'all' | 'public'
  thumbnails: {
    background: '#1a1a2e',                       // OG image background color
  },
  verification: {
    google: 'google-site-verification-code',
    bing: 'bing-verification-code',
  },
}
```

---

## Security (`security`)

```ts
security: {
  headers: {                                     // Custom HTTP headers
    'X-Frame-Options': 'DENY',
  },
  enableCSP: true,                               // Enable Content Security Policy
  customHeaders: {                                // Additional headers
    'Permissions-Policy': 'camera=()',
  },
}
```

---

## Integrations (`integrations`)

```ts
integrations: {
  analytics: {
    ga4: {                                       // Google Analytics 4
      measurementId: 'G-XXXXXXXXXX',
      debug: false,
      anonymizeIp: true,
      sendPageView: true,
      autoTrack: { pageViews: true, downloads: true, externalLinks: true },
    },
    gtm: {                                       // Google Tag Manager
      tagId: 'GTM-XXXXXXX',
    },
    vercel: {                                    // Vercel Analytics
      analytics: true,
      speedInsights: true,
    },
    posthog: {                                   // PostHog
      apiKey: 'phc_XXXXX',
      host: 'https://app.posthog.com',
      capturePageview: true,
      sessionRecording: true,
    },
  },
  search: {
    algolia: {                                   // Algolia DocSearch
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_API_KEY',
      indexName: 'docs',
    },
  },
  feedback: {
    giscus: {                                    // Giscus comments
      repo: 'user/repo',
      repoId: 'R_kgXXXXXXXX',
      category: 'Docs Feedback',
      mapping: 'pathname',
    },
    custom: {                                    // GitHub Discussions feedback
      enabled: true,
      owner: 'user',
      repo: 'repo',
      categorySlug: 'docs-feedback',
    },
  },
}
```

---

## Drafts (`drafts`)

```ts
drafts: {
  visible: false,                                // Show drafts in all environments
  environments: ['development', 'staging'],      // Envs where drafts are visible
}
```

---

## Feature Flags (`featureFlags`)

```ts
featureFlags: {
  betaFeature: true,                             // Feature flag for conditional content
  experimentalAPI: 'v2',
}
```

---

## Robots (`robots`)

```ts
robots: {
  rules: [
    { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/'] },
  ],
  sitemaps: ['https://docs.example.com/sitemap.xml'],
}
// Or simply a string:
robots: 'User-agent: *\nAllow: /'
```

---

## Vite Override (`vite`)

```ts
vite: {
  // Override any Vite configuration
  server: {
    cors: true,
  },
  build: {
    chunkSizeWarningLimit: 3000,
  },
}
```

---

## Practical Checklist for AI Assistants

- Always use `defineConfig` — it provides TypeScript autocomplete and validation
- Preserve existing import paths and plugin array registrations when editing
- Never suggest writing `vite.config.ts` — Boltdocs generates the Vite pipeline internally
- Use `vite` object parameter only when specifically overriding internal Vite config
- For i18n sites, configure `i18n.defaultLocale` and place content in `docs/{locale}/...` folders
- For blog/collection support, use bracket directories (`[blog]/`) and configure `collections`
- Validate that plugin versions match the Boltdocs version (`boltdocsVersion` field)
