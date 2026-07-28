# Routing & Directory Organization

Boltdocs automatically maps your folder structure inside the `docs/` folder to URL paths and constructs the sidebar tree.

## Page Routing Conventions

Every Markdown (`.md`) or MDX (`.mdx`) file translates directly to a URL route:

| File path | URL path |
|-----------|----------|
| `docs/index.md` | `/docs` (or `/`) |
| `docs/getting-started.mdx` | `/docs/getting-started` |
| `docs/guides/advanced-setup.md` | `/docs/guides/advanced-setup` |
| `docs/api/reference.mdx` | `/docs/api/reference` |
| `docs/[blog]/my-post.md` | `/blog/my-post` |

### Exclusions

- Files and directories starting with `_` are excluded (except `_index.md`/`_index.mdx`)
- Only `.md` and `.mdx` files are crawled

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

### Full Frontmatter Reference

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Overrides the sidebar label and HTML `<title>` tag |
| `description` | `string` | Page SEO meta description |
| `sidebarPosition` | `number` | Integer ordering position (lower = first) |
| `sidebarLabel` | `string` | Alternate label for sidebar only |
| `sidebarHidden` | `boolean` | Hide from sidebar but keep route accessible |
| `badge` | `string \| { text: string, expires?: string }` | Badge next to sidebar item (e.g. 'New', 'Experimental') |
| `icon` | `string` | Lucide icon name or raw SVG |
| `date` | `string \| Date` | Publication date (used in collections) |
| `lastUpdated` | `string \| number \| Date` | Last modified timestamp |
| `groupTitle` | `string` | Title for the sidebar group |
| `groupPosition` | `number` | Ordering position for the group |
| `tags` | `string[]` | Tags for blog posts or taxonomy |
| `author` | `string` | Author identifier (for blog posts) |
| `draft` | `boolean` | Excluded from production builds |
| `excerpt` | `string` | Short summary for list displays and LLM optimization |
| `coverImage` | `string` | Cover image path (for blog posts) |
| `category` | `string` | Category for the page |
| `order` | `number` | Alternative ordering field |
| `seo` | `Record<string, any>` | SEO and Open Graph metadata |
| `featureFlags` | `string[]` | Feature flags required for page visibility |
| `collection` | `string` | Override the collection this page belongs to |

---

## Directory Sidebar Customization (`meta.json`)

To configure folder behaviors in the sidebar (naming, collapsible settings, and icons), place a `meta.json` file inside the folder:

```json title="docs/guides/meta.json"
{
  "title": "Getting Started",
  "order": 1,
  "icon": "Rocket",
  "collapsible": true,
  "collapsed": false
}
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Label rendered for the folder in the sidebar |
| `order` | `number | string[]` | Numeric order or explicit page order array |
| `icon` | `string` | [Lucide icon name](https://lucide.dev/icons) |
| `collapsible` | `boolean` | Whether users can expand/collapse (default: `true`) |
| `collapsed` | `boolean` | Whether section starts collapsed (default: `false`) |

---

## Tab Alignment

If you define top-level horizontal tabs in `boltdocs.config.ts`, align folders at the root of the `docs/` folder to match the tab `id` keys:

```ts title="boltdocs.config.ts"
theme: {
  tabs: [
    { id: 'guides', text: 'Guides', icon: 'BookOpen' },
    { id: 'api', text: 'API', icon: 'Code2' },
  ],
}
```

Directory structure:
```
docs/
  guides/        ← visible under "Guides" tab
    index.md
    getting-started.md
  api/           ← visible under "API" tab
    index.md
    reference.md
```

---

## Collections & Bracket Directories

Directories named `[collection-name]/` create collection routes:

```
docs/
  [blog]/
    my-first-post.md
    release-3.0.md
  [changelog]/
    v2.0.0.md
    v1.0.0.md
```

- Posts within have `collection`, `date`, `tags`, `author`, `coverImage` metadata
- Collections support custom `post.tsx`, `list.tsx`, and `layout.tsx` components
- See the [Collections reference](collections.md) for details

---

## i18n Routing

When `i18n` is configured, routes are prefixed by locale:

```
docs/
  en/
    index.md                → /en/docs
    getting-started.md     → /en/docs/getting-started
  es/
    index.md                → /es/docs
    getting-started.md     → /es/docs/getting-started
```

- Locale prefixes: `/{locale}/docs/...`
- Fallback to default locale when a translation is missing
- Place locale-specific content in `docs/{locale}/...` folders

---

## Versioning Routing

When `versions` is configured, routes include the version prefix:

```
docs/
  latest/
    index.md                → /v/latest/docs
  v2.0/
    index.md                → /v/v2.0/docs
```

- Version prefixes: `/{versionPrefix}/{version}/docs/...`
- Fallback generation for missing version content

---

## Route Sorting

- Ungrouped items come first
- Items sorted by `sidebarPosition` (or `groupPosition` for groups)
- Default position: 999
- Ties broken alphabetically by title

Sorter file: `packages/core/src/node/routes/sorter.ts`
