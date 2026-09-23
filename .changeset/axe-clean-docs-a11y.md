---
'boltdocs': patch
---

Accessibility: axe-core clean across docs surfaces

- Tabs: the list component accepts an overridable role so link-based
  navigation tabs can opt out of the ARIA `tablist` widget semantics (a
  tablist requires `tab` children and failed automated audits).
- OnThisPage: the active-track indicator moved out of the list element
  (invalid list children), is hidden from assistive tech, and now measures
  against its actual positioning context; the nav landmark gained an
  accessible label.
- Navbar: nav landmarks accept distinguishable labels; the site-title home
  link keeps an accessible name on viewports where the visible title is
  hidden; the mobile nav is labeled.
- Sidebar and page navigation landmarks are labeled by default.
- External (non-docs) pages render their content inside a `<main>` landmark.
- Feedback prompt uses the correct heading level.
- Search trigger exposes an accessible name and raises the visible hint
  text contrast to meet WCAG AA.
- ErrorBoundary primitive accepts `resetKeys` (auto-reset on route change),
  matching what the shell already passed through.
- Shiki adapter: new `codeHighlighting.options.colorReplacements` support so
  sites can raise theme token colors (e.g. github-dark comments) to AA
  contrast. Hex keys are matched case-insensitively, and the cached adapter
  identity now includes this option so configuration changes take effect.
