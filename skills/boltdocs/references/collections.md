# Collections System

Boltdocs supports **content collections** (blogs, changelogs, release notes, news) via bracket directory naming. Any directory named `[collection-name]/` is automatically treated as a collection.

## Directory Structure

```
docs/
  [blog]/                  ← Collection directory
    _index.md               ← Collection index page
    my-first-post.md        ← Individual post
    release-v3.md
    layout.tsx              ← Custom layout wrapper (optional)
    list.tsx                ← Custom listing/pagination component (optional)
    post.tsx                ← Custom post component (optional)
  [changelog]/             ← Another collection
    v2.0.0.md
    v1.0.0.md
```

### Naming Convention

- Directories must use square brackets: `[blog]`, `[changelog]`, `[news]`, `[release-notes]`
- The collection `id` is extracted from inside the brackets: `blog`, `changelog`
- Collection routes are accessible at `/{collection-id}/...`:
  - `docs/[blog]/my-post.md` → `/blog/my-post`
  - `docs/[changelog]/v2.0.0.md` → `/changelog/v2.0.0`

---

## Collection Configuration

Configure collections in `boltdocs.config.ts` under the `collections` key:

```ts title="boltdocs.config.ts"
export default defineConfig({
  collections: {
    labels: {
      blog: 'Blog Posts',
      changelog: 'Changelog',
    },
    positions: {
      blog: 1,            // Sidebar ordering for collection groups
      changelog: 2,
    },
    postsPerPage: 10,     // Number of posts per paginated listing page
    defaultCollection: 'blog',   // Default collection ID
    dateFormat: 'MMMM dd, yyyy', // Date display format
    sortBy: 'date',             // Sort field: 'date' | 'title' | 'sidebarPosition'
  },
})
```

---

## Route Metadata for Collection Posts

Individual posts within collections get enhanced route metadata from frontmatter:

| Frontmatter Field | Type | Description |
|-------------------|------|-------------|
| `title` | `string` | Post title |
| `date` | `string \| Date` | Publication date (used for sorting) |
| `tags` | `string[]` | Tags for filtering/taxonomy |
| `author` | `string` | Author identifier |
| `coverImage` | `string` | Cover image path |
| `excerpt` | `string` | Short summary for listing pages |
| `draft` | `boolean` | Exclude from production |
| `collection` | `string` | Override collection ID |

Example:

```markdown
---
title: My Blog Post
date: 2026-07-15
author: johndoe
tags: [react, boltdocs, tutorial]
excerpt: A detailed tutorial on getting started with Boltdocs.
coverImage: /images/blog/cover.png
---

Post content here...
```

---

## Custom Components (`post.tsx`, `list.tsx`, `layout.tsx`)

Each collection can have custom React components for full control over rendering.

### `layout.tsx` — Collection Layout

Wraps the entire collection section (both list and post pages):

```tsx title="docs/[blog]/layout.tsx"
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blog-wrapper">
      <header className="blog-header">Blog</header>
      <main>{children}</main>
      <footer className="blog-footer">Subscribe to RSS</footer>
    </div>
  )
}
```

### `list.tsx` — Post Listing Page

Renders the collection index page with pagination support. Receives collection data as props:

```tsx title="docs/[blog]/list.tsx"
export default function BlogList({ posts, pagination }) {
  return (
    <div className="blog-list">
      {posts.map((post) => (
        <article key={post.path} className="blog-card">
          {post.coverImage && <img src={post.coverImage} alt={post.title} />}
          <h2><a href={post.path}>{post.title}</a></h2>
          <p className="date">{post.date}</p>
          <p className="excerpt">{post.excerpt}</p>
          {post.tags?.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </article>
      ))}
      {pagination.totalPages > 1 && (
        <nav className="pagination">
          {pagination.prev && <a href={pagination.prev}>← Previous</a>}
          {pagination.next && <a href={pagination.next}>Next →</a>}
        </nav>
      )}
    </div>
  )
}
```

### `post.tsx` — Individual Post Page

Renders each individual blog post. Wraps the MDX content:

```tsx title="docs/[blog]/post.tsx"
export default function BlogPost({ children, frontmatter }) {
  return (
    <article className="blog-post">
      {frontmatter.coverImage && (
        <img src={frontmatter.coverImage} alt={frontmatter.title} />
      )}
      <header>
        <h1>{frontmatter.title}</h1>
        <div className="meta">
          <time>{frontmatter.date}</time>
          {frontmatter.author && <span className="author">{frontmatter.author}</span>}
        </div>
        {frontmatter.tags?.length > 0 && (
          <div className="tags">
            {frontmatter.tags.map(tag => <span key={tag}>{tag}</span>)}
          </div>
        )}
      </header>
      <div className="content">
        {children}
      </div>
    </article>
  )
}
```

---

## Default Collection Index (`_index.md`)

Each collection can have a `_index.md` file that serves as the index/landing page. This page is rendered at the collection root URL (e.g., `/blog/`).

---

## Pagination

Collections automatically paginate posts based on `collections.postsPerPage` (default: 10). Pagination is rendered through the `list.tsx` component, which receives:

```typescript
interface PaginationData {
  currentPage: number
  totalPages: number
  totalPosts: number
  prev: string | null        // URL of previous page
  next: string | null        // URL of next page
  pages: Array<{
    number: number
    path: string
    current: boolean
  }>
}
```

---

## i18n for Collections

Collections also support i18n. Place locale-specific collection content in:

```
docs/
  en/
    [blog]/
      post.md
  es/
    [blog]/
      post.md
```
