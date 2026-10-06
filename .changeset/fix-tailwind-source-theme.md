---
'boltdocs': patch
---

Restores UI that Tailwind was never told to generate.

## The bug

Tailwind v4 uses the directory of the CSS entry as its base for automatic source
detection. For this site that is `docs/`, and the theme lives in `packages/` —
outside it. Every utility used only inside a theme component was therefore never
emitted into the stylesheet.

Three were missing, measured rather than assumed:

| Utility | Component | What was missing |
| --- | --- | --- |
| `sm:text-sm` | breadcrumbs | the breadcrumbs rendered at 12px at every width, forever |
| `hover:bg-surface` | sidebar links | no hover state at all |
| `md:flex` | copy buttons | the "Copy Markdown" button never rendered |

The existing `@source "./node_modules/boltdocs/dist"` was the same problem from
before the packages were split: it worked because the client components happened to
be bundled into the core package, and it stopped working the moment the theme
became its own package.

## What changes on screen

Twenty measured boxes move. The navbar grows from 87px to 105px and regains its
two rows of links, the sidebar and navbar link rows go from `0x0` to laid out,
and the "Copy Markdown" control appears. These are restorations: the previous
rendering was the broken one.

## Not fixed here

The `@source` lines use monorepo paths. A site installing the theme from npm needs
`node_modules/@bdocs/theme-neutral/dist`, and the general fix belongs in
`@bdocs/plugin-tailwindcss`, which is the only place the path can be resolved rather
than written by hand into every project's CSS. A site on 4.0 with a Tailwind theme
needs that line until the plugin resolves it.
