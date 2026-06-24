# Satteri Examples

Concrete code examples for common use cases.

---

## 1. Basic Markdown to HTML

```ts
import { markdownToHtml } from "satteri";

const { html, frontmatter, data } = markdownToHtml("# Hello World\n\nThis is **bold**.");

console.log(html);
// <h1>Hello World</h1>
// <p>This is <strong>bold</strong>.</p>
```

---

## 2. With GFM Features

```ts
import { markdownToHtml } from "satteri";

const source = `
| Name  | Age |
|-------|-----|
| Alice | 30  |
| Bob   | 25  |

~strikethrough~ and [task lists]:

- [x] Done
- [ ] Todo
`;

const { html } = markdownToHtml(source, {
  features: {
    gfm: {
      footnotes: true,
    },
  },
});
```

---

## 3. With Math

```ts
import { markdownToHtml } from "satteri";

const source = `
Inline math: $E = mc^2$

Block math:

$$
\\int_0^\\infty e^{-x} dx = 1
$$
`;

const { html } = markdownToHtml(source, {
  features: {
    math: {
      singleDollarTextMath: true,
    },
  },
});
```

---

## 4. With Directives

```ts
import { markdownToHtml } from "satteri";

const source = `
:::note
This is a note container.
:::

:::warning{title="Caution"}
This is a warning.
:::

:alert[I am inline text]
`;

const { html } = markdownToHtml(source, {
  features: { directive: true },
});
```

---

## 5. With Smart Punctuation

```ts
import { markdownToHtml } from "satteri";

const source = `"Smart quotes" -- dashes... and ellipses`;

const { html } = markdownToHtml(source, {
  features: {
    smartPunctuation: {
      quotes: true,
      dashes: true,
      ellipses: true,
    },
  },
});
```

---

## 6. MDAST Plugin - Transform Headings

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

const addHeadingIds = defineMdastPlugin({
  name: "add-heading-ids",
  heading(node, ctx) {
    const text = ctx.textContent(node);
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    ctx.setProperty(node, "id", id);
  },
});

const { html } = markdownToHtml("## My Heading\n\nContent", {
  mdastPlugins: [addHeadingIds],
});

console.log(html);
// <h2 id="my-heading">My Heading</h2>
// <p>Content</p>
```

---

## 7. MDAST Plugin - Collect Data

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

const collectImages = defineMdastPlugin({
  name: "collect-images",
  image(node, ctx) {
    const images = (ctx.data.images as string[]) ?? [];
    images.push(node.url);
    ctx.data.images = images;
    // No return = no mutation, just collect data
  },
});

const { html, data } = markdownToHtml(
  "![Logo](logo.png)\n\n![Banner](banner.jpg)",
  { mdastPlugins: [collectImages] },
);

console.log(data.images); // ["logo.png", "banner.jpg"]
```

---

## 8. MDAST Plugin - Replace Nodes

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

const calloutPlugin = defineMdastPlugin({
  name: "callout",
  containerDirective(node, ctx) {
    if (node.name === "callout") {
      const title = node.attributes?.title ?? "Note";
      const className = node.attributes?.type ?? "info";
      return {
        type: "html",
        value: `<div class="callout ${className}"><h4>${title}</h4>`,
        children: node.children,
        // ... complex structure
      };
    }
  },
});
```

---

## 9. HAST Plugin - External Links

```ts
import { markdownToHtml, defineHastPlugin } from "satteri";

const externalLinks = defineHastPlugin({
  name: "external-links",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      const href = node.properties.href;
      if (typeof href === "string" && href.startsWith("http")) {
        ctx.setProperty(node, "target", "_blank");
        ctx.setProperty(node, "rel", "noopener noreferrer");
      }
    },
  },
});

const { html } = markdownToHtml("[Google](https://google.com)", {
  hastPlugins: [externalLinks],
});

console.log(html);
// <a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a>
```

---

## 10. HAST Plugin - Wrap Elements

```ts
import { markdownToHtml, defineHastPlugin } from "satteri";

const responsiveImages = defineHastPlugin({
  name: "responsive-images",
  element: {
    filter: ["img"],
    visit(node, ctx) {
      const wrapper = {
        type: "element" as const,
        tagName: "figure",
        properties: { className: ["responsive-image"] },
        children: [node],
      };
      ctx.replaceNode(node, wrapper);
    },
  },
});

const { html } = markdownToHtml("![Photo](photo.jpg)", {
  hastPlugins: [responsiveImages],
});
```

---

## 11. HAST Plugin - Multiple Filters

```ts
import { markdownToHtml, defineHastPlugin } from "satteri";

const mediaPlugin = defineHastPlugin({
  name: "media",
  element: [
    {
      filter: ["img"],
      visit(node, ctx) {
        ctx.setProperty(node, "loading", "lazy");
      },
    },
    {
      filter: ["video", "source"],
      visit(node, ctx) {
        ctx.setProperty(node, "controls", true);
      },
    },
  ],
});

const { html } = markdownToHtml("![Photo](photo.jpg)", {
  hastPlugins: [mediaPlugin],
});
```

---

## 12. MDX Compilation

```ts
import { mdxToJs } from "satteri";

const source = `
import { Chart } from './components'

# Dashboard

<Chart data={[1, 2, 3]} />

export const metadata = { title: "My Page" }
`;

const { code, frontmatter, data } = mdxToJs(source, {
  jsxImportSource: "react",
  outputFormat: "program",
});

console.log(code);
// Compiled JavaScript module
```

---

## 13. MDX with OptimizeStatic

```ts
import { mdxToJs } from "satteri";

const source = `
<div set:html="<p>Static content</p>" />
`;

const { code } = mdxToJs(source, {
  optimizeStatic: {
    component: "Fragment",
    prop: "set:html",
    wrapPropValue: true, // Wraps as { __html: "..." }
    ignoreElements: ["script"],
  },
});
```

---

## 14. Using Evaluate

```ts
import { evaluate } from "satteri";
import { createElement } from "react";

const source = `
import { Button } from './ui'

# Welcome

<Button type="primary">Click me</Button>

export const count = 42;
`;

const exports = evaluate(source, {
  Fragment: ({ children }) => createElement("div", null, children),
  jsx: createElement,
  jsxs: createElement,
});

console.log(exports.default); // The MDX component
console.log(exports.count);   // 42
```

---

## 15. Factory Function Plugin

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

// Factory function: creates fresh closure per compilation
const createLimitPlugin = (maxWords: number) => {
  const seen = new Set<string>();
  return defineMdastPlugin({
    name: "word-limit",
    paragraph(node, ctx) {
      const text = ctx.textContent(node);
      const words = text.split(/\s+/).length;
      if (words > maxWords) {
        ctx.report({
          message: `Paragraph exceeds ${maxWords} words (${words} found)`,
          node,
          severity: "warning",
        });
      }
    },
  });
};

const { html } = markdownToHtml("Long paragraph...", {
  mdastPlugins: [createLimitPlugin(100)],
});
```

---

## 16. Data Sharing Between Plugins

```ts
import { markdownToHtml, defineMdastPlugin, defineHastPlugin } from "satteri";
import type { Data } from "satteri";

declare module "satteri" {
  interface DataMap {
    toc: Array<{ level: number; text: string; id: string }>;
  }
}

// MDAST: collect headings for TOC
const collectToc = defineMdastPlugin({
  name: "collect-toc",
  heading(node, ctx) {
    const text = ctx.textContent(node);
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const toc = ctx.data.toc ?? [];
    toc.push({ level: node.depth, text, id });
    ctx.data.toc = toc;
    ctx.setProperty(node, "id", id);
  },
});

// HAST: inject TOC into a placeholder
const injectToc = defineHastPlugin({
  name: "inject-toc",
  element: {
    filter: ["div"],
    visit(node, ctx) {
      if (node.properties.dataToc !== undefined) {
        const toc = (ctx.data.toc ?? [])
          .map((entry) => {
            const indent = "  ".repeat(entry.level - 1);
            return `${indent}<li><a href="#${entry.id}">${entry.text}</a></li>`;
          })
          .join("\n");
        const list = {
          type: "element" as const,
          tagName: "ul",
          properties: { className: ["toc"] },
          children: [{ type: "text" as const, value: toc }],
        };
        ctx.replaceNode(node, list);
      }
    },
  },
});

const source = `
<div data-toc></div>

## Section 1

Content

## Section 2

More content
`;

const { html } = markdownToHtml(source, {
  mdastPlugins: [collectToc],
  hastPlugins: [injectToc],
});
```

---

## 17. Frontmatter Extraction

```ts
import { markdownToHtml } from "satteri";

const source = `
---
title: My Post
date: 2024-01-15
tags: [rust, typescript]
---

# Content here
`;

const { html, frontmatter } = markdownToHtml(source);

console.log(frontmatter);
// { kind: "yaml", value: "title: My Post\ndate: 2024-01-15\ntags: [rust, typescript]" }
```

---

## 18. One-Shot Parse to HTML (No Plugins)

```ts
import { parseToHtml } from "satteri";

// Fastest path: no handles, no plugins, just parse and render
const html = parseToHtml("# Hello\n\nWorld", {
  gfm: true,
  frontmatter: true,
});
```

---

## 19. Handle Pipeline (Manual Control)

```ts
import {
  createMdastHandle,
  walkMdastHandle,
  applyCommandsToMdastHandle,
  convertMdastToHastHandle,
  renderHandle,
  dropHandle,
  defineMdastPlugin,
  resolveMdastSubscriptions,
} from "satteri";

const plugin = defineMdastPlugin({
  name: "my-plugin",
  text(node, ctx) {
    if (node.value.includes("secret")) {
      ctx.setProperty(node, "value", "[REDACTED]");
    }
  },
});

// Create handle
const handle = createMdastHandle("# Hello secret world");

// Resolve subscriptions
const subs = resolveMdastSubscriptions(plugin);

// Walk the arena
const matchBuffer = walkMdastHandle(handle, subs);

// Apply mutations (would need to run visitors first in real usage)
// applyCommandsToMdastHandle(handle, commandBuffer);

// Convert to HAST
const hastHandle = convertMdastToHastHandle(handle);

// Render
const html = renderHandle(hastHandle);

// Cleanup
dropHandle(hastHandle);
```

---

## 20. Wikilinks

```ts
import { markdownToHtml } from "satteri";

const source = `
See also [[Other Page]] and [[Another Page|custom text]].
`;

const { html } = markdownToHtml(source, {
  features: { wikilinks: true },
});
```

---

## 21. Heading Attributes

```ts
import { markdownToHtml } from "satteri";

const source = `
# My Heading {#custom-id .highlight}
`;

const { html } = markdownToHtml(source, {
  features: { headingAttributes: true },
});
```
