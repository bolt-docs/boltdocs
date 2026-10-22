---
'boltdocs': minor
'@bdocs/plugin-ssg': minor
'@bdocs/plugin-mermaid': minor
'@bdocs/plugin-math': minor
'@bdocs/plugin-sass': minor
'@bdocs/plugin-tailwindcss': minor
'@bdocs/plugin-unocss': minor
'@bdocs/plugin-ask-ai': minor
'@bdocs/plugin-image-optimizer': minor
'@bdocs/processor-satteri': minor
---

Vite 8.3.5, and only Vite 8.3.

The framework now builds on Vite 8.3.5 and requires it. The peer dependency
range moved from `^8.1.0` to `^8.3.0`, so a site on Vite 8.1 or 8.2 has to
update before it can install the new Boltdocs.

Two version checks went away with it, because the versions they served no
longer exist:

- The build used to choose between `build.rolldownOptions` and
  `build.rollupOptions` depending on the installed Vite. Vite 8 is Rolldown,
  and the two option names are not interchangeable — the options moved with
  the bundler, not with the options — so the check only ever chose the wrong
  one for a Vite it did not support anyway.
- The build used to look for the manifests in the output root on Vite before
  5, which had no `.vite` directory. There is no such Vite left to support.

The output does not change: the documentation site's 260 pages are byte for
byte identical across the two versions, and the client bundle grows by four
bytes.

`@types/node` moved from 22.0.0 to 22.12.0 across the workspace, which is
what Vite 8.3 asks for, and an override pins it so the whole tree resolves
one copy.
