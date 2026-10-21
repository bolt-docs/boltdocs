---
'@bdocs/zig-critters': minor
---

The critical-CSS extractor parses the stylesheet once.

It parsed the stylesheet on every page. Parsing is the expensive half: on a
180 kB stylesheet it costs 91 ms, and matching it against one page costs
44 ms. The stylesheet is the same for every page of a build, so the parse
belonged to the build and the matching to the page.

The stylesheet is now parsed once per extractor instance, and the tokenised
selectors — which were also rebuilt per page — are shared with it.

| | Before | After |
| --- | --- | --- |
| One extraction, 180 kB stylesheet | 138 ms | **23 ms** |
| The output | 23,950 bytes | **23,950 bytes** |

The output is byte-identical: the same page extracted through both paths
produces the same bytes.

The cold build of the documentation site went from 24.7 s to 22.1 s, measured
back to back on the same machine with three runs each.

The extractor is Zig compiled to WebAssembly, so the WASM is rebuilt with this
change. The build needs `wasm-ld` on the path — on this machine it lives in
`/usr/lib/llvm21/bin` — and without it the WASM build fails and the previous
binary is used.
