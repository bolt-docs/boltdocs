---
'@bdocs/theme-neutral': minor
---

Removes four components from the theme and makes the page widgets opt-in.

## Deleted

`Skeleton` and `Timeline` are gone.

`Timeline` was built for release notes and changelogs, which is a job a
documentation site rarely has, and it carried its own badge and variant vocabulary
that had to be maintained alongside everything else. It had no consumer inside the
repository: it was reachable only as a public export and from the docs page
documenting it.

`Skeleton` had one export and no consumer. The loading states it was written for
are covered by the skeleton the navbar already renders while the repository
stars resolve.

Their documentation pages are removed in both locales, along with the rows in the
component index. The 3.2.0 release post used `<Timeline>` to demonstrate the
component it announced; that section is now a note saying it was removed in 4.0,
because leaving a post rendering an unknown component would break the build.

## Made optional

`Feedback` and `LastUpdated` are no longer part of the default theme.

Neither has a right answer for a site that has not configured one. A feedback
widget needs a destination — Vercel, Netlify, AWS Lambda, or an endpoint of the
site's own — and the theme cannot pick it. A "last updated" line needs a policy:
the frontmatter's `lastUpdated` may be a date, a commit time, or absent, and
whether it appears at all is the site's call. Shipping them by default meant every
site either configured integrations to silence them or rendered a widget pointing
at nothing.

`DocPage` now renders `LastUpdated` only when one is present, so a site or plugin
supplies it through `mdx-components.tsx`. The previous code destructured it
unconditionally, which would have thrown for every site that opts out.

`useFeedback` stays. It is exported from `boltdocs/client` and is the hook a
site's own widget is built on; only the theme's default UI is removed. The
server-side adapters were already in the core and are untouched.

## Not in this change

The plugins that own these widgets are not written yet. The theme no longer
depends on them, which is the half that had to happen first, but
`@bdocs/plugin-feedback` does not exist. Until it does, a site that wants either
widget provides the component itself.
