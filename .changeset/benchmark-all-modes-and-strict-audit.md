---
'boltdocs': patch
---

Close the remaining SPEC §2.2/§2.3 gaps:

- The regression gate now covers all three modes (`cold`, `warm`/dev startup,
  `incremental`) with committed baselines and CI jobs for each.
- Plugin audit now blocks build and dev on warning- and high-severity findings,
  not just high. Sites can accept specific plugins through
  `security.auditAllowWarnings`; the docs site uses it for Mermaid's reviewed
  local render worker. Low-severity metadata findings still only warn.
