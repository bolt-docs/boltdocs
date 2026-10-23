---
'boltdocs': minor
'@bdocs/contracts': minor
---

The production build stops loading a browser it never renders in.

Every build imported jsdom and constructed a document before it started. The
import alone costs 705 ms, and the window it installs is what react-helmet's
compatibility layer had to defend against: with `window` defined, the library
believed it was running in a browser and skipped the server branch of its
state.

None of it was reachable. A production build renders its pages inside the SSG
worker pool, and those workers never installed a shim — the only jsdom lived on
the main thread, which imports the SSR bundle and hands work to the pool. The
documentation site builds and renders all 260 pages without it, and the output
is byte-identical to the build that had a browser in memory.

| Cold build of the docs site | With jsdom | Without |
| --- | --- | --- |
| Work between resolving the Vite config and the first bundle | 1589 ms | **486 ms** |

That segment is single-threaded, so it is the honest place to look: the rest of
the build competes for the same four cores and buries a one-second change in
the noise. Three cold runs of the whole build spent 66 s of CPU against the
70 s of the previous revision.

A project whose modules read `document` or `window` while they are imported can
ask for the shim back with `ssg.mock: true`. The dev server is unaffected: it
renders in-process, so it keeps the shim unconditionally.
