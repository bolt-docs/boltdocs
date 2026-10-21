---
'boltdocs': major
'@bdocs/theme-neutral': minor
---

The engine ships no stylesheet. The reset is the theme's.

`boltdocs/theme/reset.css` was the engine's stylesheet: the page reset, the
code-block rules and the accessibility baseline. The engine does not have a look
any more — the theme does — so the stylesheet moved with it.

```diff
- @import "boltdocs/theme/reset.css";
+ @import "@bdocs/theme-neutral/reset";
```

`boltdocs migrate` rewrites the import, in a site's stylesheets as well as in
its code.

The values did not change. The reset now reads the theme's own tokens
(`--bdocs-canvas`, `--bdocs-ink`, `--bdocs-primary`) where it used to read the
host's (`--color-main`, `--color-body`, `--color-primary-500`), and a site that
overrode those tokens overrides them in one place. Two tokens were added for
the cases the old file had no name for: `--bdocs-diff-add`, the green a diff
addition uses — which was Tailwind's `emerald-500` and not the theme's
`--bdocs-success` — and the page-level fonts, `--bdocs-page-font` and
`--bdocs-code-font`, which the document uses and the components do not.

**Two rules that the build was dropping now apply.**

Comparing the two builds' stylesheets — by their resolved declarations, not by
their text — leaves ten differences, and nine of them are the same value
written two ways. The tenth is two rules the framework's own compiler was
discarding:

- The line highlight's coloured bar was compiled to `:after`, a pseudo-class,
  where the source said `::after`. The browser discards a rule with an invalid
  pseudo-class, so the bar never rendered.
- The line-number gutter's `display` and `width` were lost because two rules
  shared a selector and the compiler kept only the last one's declarations.

Both are written out by hand now, and both render.
