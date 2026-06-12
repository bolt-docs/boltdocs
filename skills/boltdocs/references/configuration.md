# Configuration Guide (`boltdocs.config.ts`)

Boltdocs is configured via a single `boltdocs.config.ts` file located at the root of the project. This config file is the single source of truth; you do not need a `vite.config.ts` file since Boltdocs generates the Vite pipeline internally.

## Basic Structure

Always use `defineConfig` to gain TypeScript autocomplete and validate configuration parameters:

```ts
import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  siteUrl: 'https://my-docs-site.com',
  base: '/',
  theme: {
    title: 'My Project Docs',
    githubRepo: 'my-username/my-repo',
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
    mermaidPlugin(),
  ],
})
```

---

## Core Options Reference

### Top-Level Parameters

- **`siteUrl`**: `string` - The production domain where your documentation is hosted. Used for building `sitemap.xml` and canonical HTML headers.
- **`base`**: `string` - The sub-path where the website is served (e.g. `'/docs/'`). Defaults to `'/'`.
- **`docsDir`**: `string` - Relative path to the folder containing your Markdown and MDX content (defaults to `'./docs'`).
- **`plugins`**: `BoltdocsPlugin[]` - Array of active plugins to extend rendering or inject components.

### Theme Configurations (`theme`)

- **`title`**: `string` - The main title rendered in navbars and browser tab names.
- **`description`**: `string` - Default description injected in SEO meta tags.
- **`logo`**: Object with paths relative to the `public/` directory:
  - `light`: Logo shown on light backgrounds.
  - `dark`: Logo shown in dark mode.
  - `alt`: Alternate accessibility text.
- **`githubRepo`**: `string` - Repository path in `owner/name` format. Auto-enables the GitHub icon link in the navbar.
- **`navbar`**: Array of items displayed in the top navbar (supports dropdowns).
- **`tabs`**: Configures top-level category tabs displayed above the sidebar:
  ```ts
  tabs: [
    { id: 'guides', text: 'User Guides', icon: 'BookOpen' },
  ]
  ```
  *(Tabs align with folder hierarchies inside your `docs/` folder).*

---

## Practical Checklist for AI Assistants
- When editing `boltdocs.config.ts`, always preserve existing import paths and plugin array registrations.
- Never suggest writing `vite.config.ts` to extend the compiler unless specifically overriding the internal configuration using the config's `vite` object parameter.
