---
'boltdocs': patch
---

The engine's stylesheet no longer assumes a CSS framework.

`reset.css` was written with Tailwind's `@apply`: seventeen rules that only
compile inside a Tailwind build. That is the one CSS framework assumption
SPEC §2.1 forbids, and it was in the engine.

The declarations are the same ones Tailwind compiled to, written out by hand —
`py-2` is half a rem, `text-[12px]` is twelve pixels, and
`!bg-primary-500/10` is
`color-mix(in oklab, var(--color-primary-500) 10%, transparent)`. A test now
fails if a framework directive or a hardcoded colour comes back.

The evidence that nothing moved: the documentation site's compiled stylesheet
is byte-identical before and after the rewrite — 180,067 bytes either way. The
comparison is between the two builds' CSS; no browser was involved.
