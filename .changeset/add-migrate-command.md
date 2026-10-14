---
'boltdocs': major
---

Add `boltdocs migrate`, which reports and fixes the 3.x patterns that 4.0 changed.

```bash
npx boltdocs migrate            # dry run: reports, writes nothing
npx boltdocs migrate --apply    # applies every fixable finding
```

Slice 7 of the 4.0 roadmap was migration tooling: codemods, compatibility adapters, diagnostics and an upgrade guide. This is the codemods and the diagnostics. The upgrade guide is [the 4.0 upgrade page](https://boltdocs.com/docs/guides/operations/upgrading-4-0).

### What it fixes

| Finding | Change |
| --- | --- |
| `react-aria/import` | `react-aria-components` → `@bdocs/primitives` |
| `theme/subpath` | `@bdocs/theme-neutral/components/primitives` → `/composition`, `/client` and `/mdx` → the package root |
| `seo/plugin-missing` | Adds `@bdocs/plugin-seo` when `siteUrl`, `robots` or `seo` are configured without it |
| `deps/react-aria` | Removes the stale `react-aria-components` entry |
| `deps/primitives` | Declares `@bdocs/primitives` when react-aria was referenced |

### What it refuses to fix

`onPress`, `isSelected` and `<SSRProvider>` are reported with their replacements, never rewritten. `onPress` becomes `onAction` on a menu item, but the new handler also receives the intent (`press` or `close`) — renaming the prop mechanically produces code that type-checks and does the wrong thing at runtime, which is worse than a line in a report.

The same applies to a `plugins` array it cannot read: a shorthand (`plugins,`), an array built from a variable, or a single-line array is reported rather than edited. Appending to an array the tool cannot see into would produce a config that loads fine and silently drops every plugin.

### Why it is hand-written rather than TypeScript-based

`typescript` is a devDependency of `boltdocs`, not a runtime one, so a published command cannot import its compiler — and it should not: this runs against projects whose build is already broken, and a compiler that fails to load would fail the one command whose job is fixing a broken tree. The scanner in `migrate/source.ts` is anchored so it matches module specifiers and nothing that merely resembles one, and skips specifiers inside comments — `trimmed.indexOf(' from ')` has exactly the shape of an import clause.

### Exit codes

`0` when there are no blocking findings, `1` when there are. The blocking findings are the two that produce silent regressions: a missing `@bdocs/plugin-seo` costs you `sitemap.xml` and `robots.txt`, and the core only warns about it during the build.
