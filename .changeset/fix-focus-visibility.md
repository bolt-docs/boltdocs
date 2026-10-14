---
'boltdocs': patch
---

Give every focusable element a visible keyboard focus indicator.

Components suppress the user-agent ring with `outline-none` and are expected to supply their own `focus-visible:` affordance, but many did not. The banner dismiss button, the navbar links, the language switcher and the code copy button were reachable by keyboard with no visible focus indicator at all, which fails WCAG 2.4.7 Focus Visible. `focus-visible:outline-2` alone was not sufficient either: it emits `outline-style: var(--tw-outline-style)`, a variable only defined by the all-in-one `outline` utility, so the declaration was invalid and nothing was painted.

`reset.css` now declares a layer order and carries a baseline in a new `a11y` layer ordered after `utilities`, since cascade layers outrank selector specificity and a rule in `base` cannot beat the `outline-none` utility. The baseline is a floor rather than a design: components with a deliberate indicator still win, and a theme can replace it from its own stylesheet.
