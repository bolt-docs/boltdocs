---
'@bdocs/zig-critters': minor
---

The critical-CSS extractor asks the page before it walks the elements.

Matching a rule means trying it against every element of the page, and the
stylesheet of the documentation site has fifteen hundred rules: a page spends
more than a million attempts on a question that is almost always "no". Almost
all of those attempts are hopeless before they start — a rule whose subject
asks for a class the page does not have cannot match, and the page knows it.

The extractor now builds a filter of the names the page has — every tag, class
and id, each kind kept apart — and drops a rule without touching the elements
when the name it needs is not there. The filter is a bitmap of hashes, not a
set: a name that is absent can still be reported as possibly present, which
costs the match it would have cost before. A name that is present is never
reported as absent, so no rule that could match is ever dropped.

| One extraction, 185 kB stylesheet | Before | After |
| --- | --- | --- |
| The documentation page | 53 ms | **12 ms** |
| The home page | 52 ms | **18 ms** |

The output is byte-identical: all 260 pages of the documentation site, against
the stylesheet the build actually produces, come out of both binaries with the
same bytes.

In the build of the documentation site, the critical-CSS extraction went from
111 ms to 69 ms at the median and the finalise queue from 113 ms to 78 ms. The
cold build went from 18.1 s to 17.3 s, measured back to back with three runs
each.

The extractor is Zig compiled to WebAssembly, so the WASM is rebuilt with this
change. The build needs `wasm-ld` on the path — on this machine it lives in
`/usr/lib/llvm21/bin` — and without it the WASM build fails and the previous
binary is used.
