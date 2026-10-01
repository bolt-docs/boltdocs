---
'boltdocs': patch
---

Make server-rendered dates deterministic and fix theme-dependent assets

Three classes of hydration mismatch, all caused by the server and the browser
computing different markup for the same content.

**Dates.** `toLocaleDateString` without a locale resolves against the runtime
default, which is not the same in Node and in a browser: the server rendered
"26 de septiembre de 2026" from an `es` system locale while the client produced
"September 26, 2026". The time zone had to be pinned for the same reason, since
a frontmatter date such as `2026-09-27` parses as UTC midnight and any zone
behind UTC renders the previous day. All call sites now share one helper
(`formatDate` / `formatDeterministicDate`, both exported) with an explicit
locale and zone.

**Logo.** `useNavbar` resolved `theme.logo` to a single source based on the
resolved theme, which the server cannot know. That changed the `<img src>` and,
with it, the `href` of the preload React hoists for `fetchPriority="high"`, so
the client never claimed the node the server had emitted. The hook now returns
both variants and CSS selects the visible one, keyed off the `dark` class that a
blocking script sets on `<html>` before first paint. That also removes the
wrong-logo flash.

**Cover images.** `post.coverImage` from frontmatter is site-root-relative, and
a site served under a sub-path needs the base prefixed. Skipping it produced a
404 in the browser while the server-rendered markup still looked correct.

**React Aria ids.** `BoltdocsShell` now mounts `SSRProvider` as its outermost
layer. Without it React Aria derives element ids from a module-level counter
that starts from a different value on the server and in the browser, and pages
containing an interactive widget fail hydration.
