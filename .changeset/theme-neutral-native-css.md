---
'@bdocs/theme-neutral': minor
'boltdocs': patch
---

`@bdocs/theme-neutral` ships native CSS, and the core no longer advertises a stylesheet it never built.

## The stylesheet is now plain CSS

`neutral.css` was a Tailwind v4 `@theme` block. Two things were wrong with that, and the second is the one that mattered:

- A `@theme` block only means anything inside Tailwind's own build. Read the file in a `<link>`, in webpack, or in a plain server and the tokens resolve to nothing.
- **Nothing ever loaded it.** The docs site ran on its own Tailwind tokens, and the neutral theme's stylesheet was compiled, published, and never rendered anywhere. It was a theme whose styling had never been executed.

It is replaced by `src/styles/`, plain CSS with an explicit `@import` chain:

```text
styles/
├── index.css               entry: tokens → base → components
├── tokens.css              every colour, radius, font, shadow, dimension
├── base.css                element defaults, scoped to `.bdocs-root`
└── components/*.css        one file per component
```

Shipped as real files rather than a bundled asset, so the theme behaves the same in a plain `<link>` as in Vite. 7.9 kB total. Accessible at `@bdocs/theme-neutral/css`; `./css` now points there.

Tokens are plain custom properties, with the split made explicit:

- `--bdocs-*` — public. Override these. Never renamed without a major.
- `--_bdocs-*` — private. What the theme's own rules are written against, free to change in any release.

The private layer is what lets a public token be re-derived without asking every site to update. `--bdocs-bg` is what a site sets; `--_bdocs-surface` is what the rules consume. Retuning the theme's internal shades stops being a breaking change.

Dark mode follows `[data-theme='dark']` and `.dark`, and `prefers-reduced-motion` now collapses the motion tokens — previously a site had to override every transition individually.

## Base styles are scoped, not global

`base.css` hangs off `.bdocs-root` instead of styling `body` and `:root` directly. Boltdocs renders inside a host page as often as it is the whole page, and a theme that rewrites the host's body background because it was imported is a theme nobody can install twice or embed. A test asserts no rule targets `html` or `body`.

## Verification

`pnpm --filter @bdocs/theme-neutral verify:styles` loads the **built** stylesheet into a bare page — no bundler, no Tailwind, no build step to read it — and asserts computed values in Chromium. 17 checks across four pages: light, dark, narrow, and reduced motion.

It reads `getComputedStyle` rather than the stylesheet source, because a rule can be present and still lose the cascade, which is exactly the failure this check exists for. Two of the assertions are deliberately not token reads:

- a card surface must **follow** `--bdocs-bg` into dark mode, so a rule that hardcodes its colour fails;
- `--_bdocs-surface` must still **derive** from the public token after an override, so the private layer cannot quietly become a second source of truth.

Both were confirmed to fail when broken, rather than assumed to work. Needs `pnpm exec playwright install chromium` once; it is not wired into CI, to keep a browser download off the default path.

Two bugs surfaced while writing it, both in the check rather than the theme, and both recorded here because they are traps rather than typos:

- reading computed styles straight after flipping `data-theme` returns the **pre-transition** colour, because the cards transition `background-color`. The check waits for `document.getAnimations()`. Without that, a working dark mode looks broken.
- asserting on `<body>` instead of `.bdocs-root` fails by design: the theme deliberately does not restyle the host page.

## `@bdocs/primitives` is unchanged

The primitives stay style-neutral by contract — they own structure, behaviour and state, and expose `data-*` for the theme to style. This change is entirely in the theme layer above them.

## Status of the conversion

**1 of 46 components is converted** (`PageNav`). The rest still use Tailwind utility classes, and until they are converted the theme still needs a Tailwind build. Reporting that plainly rather than implying the port is done.

`packages/theme-neutral/tests/native-styles.test.ts` holds the line in the meantime: a converted component that grows a utility class again fails the suite instead of quietly reintroducing the dependency. The converted list is explicit — globbing would pass on day one and mean nothing while every file still has classes in it.

## Removed

- `boltdocs/theme/neutral.css` — core exported this path, but the file was never built and never existed in `dist`. A consumer importing it got a resolve failure against a subpath the package advertised. The `./theme/neutral.css` export is gone; `./theme/reset.css` is unchanged, since the reset is a common base rather than a theme opinion.
- `packages/core/src/client/base-theme.css` — 78 lines of `--bdocs-*` tokens that nothing imported. Its content now lives in `styles/tokens.css` and is actually shipped.

The docs page on vanilla CSS claimed Boltdocs ships these variables in `base-theme.css`. It now points at `@bdocs/theme-neutral/css`, which is true.
