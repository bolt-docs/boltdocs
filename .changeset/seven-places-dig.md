---
'boltdocs': major
---

Restructure integrations config into sections (breaking change)

The `integrations` configuration has been reorganized into logical sections:
`analytics`, `search`, and `feedback` to improve clarity and extensibility.

**Migration guide:**

```diff
 integrations: {
-  ga4: { measurementId: 'G-XXXXX' },
-  gtm: { tagId: 'GTM-XXXXX' },
-  algolia: { appId: '...' },
-  feedback: { custom: { ... }, giscus: { ... } },
+  analytics: {
+    ga4: { measurementId: 'G-XXXXX' },
+    gtm: { tagId: 'GTM-XXXXX' },
+    vercel: { analytics: true, speedInsights: true },
+  },
+  search: {
+    algolia: { appId: '...' },
+  },
+  feedback: {
+    custom: { ... },
+    giscus: { ... },
+  },
 }
```

**New features included:**
- Vercel Analytics & Speed Insights support (`integrations.analytics.vercel`)
- Giscus comments component (`integrations.feedback.giscus`)

**Fixes included:**
- External pages (e.g. `/showcase`, `/about`) are now included in
  `link-tree.json` and `types.d.ts` route path generation
- Link primitive `href` props now use `BoltdocsRoutePathWithFallback`
  for TypeScript autocompletion of known routes
