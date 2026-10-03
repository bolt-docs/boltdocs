---
"boltdocs": patch
---

Drop `isomorphic-dompurify` and jsdom: 8.4 MB and 55 fewer packages, and 25x faster on the frontmatter path.

`isomorphic-dompurify` exists to shim a DOM for Node, so it depends on jsdom. That put 9.2 MB and 63 packages on every install to handle two call sites, and neither needed a DOM.

**Frontmatter.** `title`, `description`, `badge` and `excerpt` were being run through an HTML sanitizer. They are plain text: they reach React as text children, which escape automatically, and as `<meta content>` and `<title>` values, which React also escapes. None of them is an HTML sink — the only three in the client are the Shiki output, the JSON-LD block, and icon markup, and none of those is fed from frontmatter.

That was wrong in three ways at once. It cost jsdom. It was slow: 441µs per value against 17µs for the regex, so ~350ms across a 259-page build. And it double-escaped — a title of `A < B` came back as `A &lt; B` and React escaped the `&` again, so the heading rendered as the literal `A &lt; B`. They are now reduced to plain text by `stripTags`.

`sanitizeHtml` is gone rather than reimplemented. Hand-rolling an HTML sanitizer to keep it would have been the wrong trade: an allowlist parser is exactly the thing that gets bypassed. Nothing needed it, and removing markup is a stronger guarantee for the case that mattered — markup in frontmatter cannot survive at all, instead of surviving as allowed-but-inert HTML.

**Icons.** Sanitizing icon markup *is* a real sink, so it stays, on `dompurify`'s browser build — the browser already has a DOM, and the Node shim was never needed there. It is now memoized by exact markup: `IconRenderer` re-runs on every parent render, and each pass was re-parsing and re-serializing the same SVG. The cache is keyed on the markup and never on an icon name, because the name is the part a caller controls.

Two boundaries worth stating, since they are judgment calls. A bare `<` survives (`if (a<b)` is a comparison, and requiring a `>` terminator is what keeps it intact), and an unterminated raw-text element loses its tags but keeps its body as text, rather than swallowing the rest of the string the way a browser would.

Verified: core 1084 tests across 120 files, ssg 188, plugin-seo 41, contracts 29, docs build 259 pages. The 259-page build contains no double-escaped title.