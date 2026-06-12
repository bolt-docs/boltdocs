# Routing & Directory Organization

Boltdocs automatically maps your folder structure inside the `docs/` folder to URL paths and constructs the sidebar tree.

## Page Routing Conventions

Every Markdown (`.md`) or MDX (`.mdx`) file translates directly to a URL route:

- `docs/index.md` ➔ `/docs` (or `/` depending on configuration)
- `docs/getting-started.mdx` ➔ `/docs/getting-started`
- `docs/guides/advanced-setup.md` ➔ `/docs/guides/advanced-setup`

---

## Frontmatter Settings

Control metadata per page using YAML frontmatter at the top of your files:

```markdown
---
title: My Page Title
description: A short description for search engines.
sidebarPosition: 2
---
```

- **`title`**: Overrides the sidebar label and HTML `<title>` tag (defaults to the first `<h1>` header).
- **`sidebarPosition`**: Integer ordering position of the page inside its category folder (lower numbers appear first).
- **`description`**: Used for page SEO meta descriptions.

---

## Directory Sidebar Customization (`meta.json`)

To configure folder behaviors in the sidebar (such as naming, collapsible settings, and icons), place a `meta.json` file inside the folder:

```json
{
  "title": "Getting Started",
  "order": 1,
  "icon": "Rocket",
  "collapsible": true,
  "collapsed": false
}
```

### Parameters

- **`title`**: Label rendered for the category folder in the sidebar.
- **`order`**:
  - `number`: Numeric order of this folder group relative to sibling items.
  - `string[]`: Explicit page order array. Example: `["installation", "configuration", "file-routing"]`.
- **`icon`**: The name of any [Lucide Icon](https://lucide.dev/icons) to display alongside the folder name (e.g. `"Settings"`, `"Code"`, `"BookOpen"`).
- **`collapsible`**: Toggle whether users can expand/collapse this section (default: `true`).
- **`collapsed`**: Set whether the section starts collapsed by default (default: `false`).

---

## Tab Alignment

If you define top-level horizontal tabs in `boltdocs.config.ts`, align folders at the root of the `docs/` folder to match the tab `id` keys:

```ts
// boltdocs.config.ts
tabs: [
  { id: 'guides', text: 'Guides' },
  { id: 'api', text: 'API' }
]
```

- Put guides documentation inside: `docs/guides/...`
- Put API documentation inside: `docs/api/...`
- Boltdocs filters the sidebar automatically to only show directories belonging to the active category tab.
