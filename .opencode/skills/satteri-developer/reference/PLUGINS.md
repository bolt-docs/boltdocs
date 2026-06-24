# Satteri Plugin System

Complete guide to creating and using MDAST and HAST plugins.

---

## 1. Plugin Architecture

Satteri has **two plugin stages** in its pipeline:

1. **MDAST plugins** — Run on the Markdown AST after parsing (analogous to remark plugins)
2. **HAST plugins** — Run on the HTML AST after MDAST-to-HAST conversion (analogous to rehype plugins)

**Execution order:** MDAST plugins run first in array order, then HAST plugins run in array order. Each plugin walks the tree once. Structural mutations are applied between plugins.

---

## 2. Plugin Definition

### `defineMdastPlugin(definition)`

```ts
function defineMdastPlugin<P extends MdastPluginDefinition>(definition: P): P;
```

Validates `name` exists, returns the definition typed. Pure identity function at runtime.

### `defineHastPlugin(definition)`

```ts
function defineHastPlugin<P extends HastPluginDefinition>(definition: P): P;
```

Same pattern for HAST plugins.

### Plugin Definition Shape

```ts
// MDAST plugin
type MdastPluginDefinition = MdastPluginInstance & { name: string };

// HAST plugin
type HastPluginDefinition = HastVisitorInstance & { name: string };
```

### Plugin Inputs (factory functions)

```ts
type MdastPluginInput = MdastPluginDefinition | (() => MdastPluginDefinition);
type HastPluginInput = HastPluginDefinition | (() => HastPluginDefinition);
```

Use factory functions when a plugin needs per-document state or fresh closures per compilation:

```ts
const myPlugin = () => {
  const seen = new Set<string>();
  return defineMdastPlugin({
    name: "dedupe-headings",
    heading(node, ctx) {
      const text = ctx.textContent(node);
      if (seen.has(text)) {
        ctx.removeNode(node);
      } else {
        seen.add(text);
      }
    },
  });
};
```

---

## 3. MDAST Plugins

### Visitor Signature

```ts
type MdastVisitorFn<N extends MdastNode> = (
  node: Readonly<N>,
  context: MdastVisitorContext,
) => MdastVisitorResult | Promise<MdastVisitorResult>;
```

### Return Values

| Return | Effect |
|--------|--------|
| `undefined` / `null` / `void` | Keep node, apply context mutations |
| Same node object | No-op, keep as-is |
| Different `MdastNode` | Replace the visited node |
| `{ raw: string }` | Splice raw Markdown (re-parsed) |
| `{ rawHtml: string }` | Splice raw HTML (passthrough) |

### Available Visitor Keys

| Key | Node Type | Feature Gate |
|-----|-----------|--------------|
| `paragraph` | `Paragraph` | — |
| `heading` | `Heading` | — |
| `thematicBreak` | `ThematicBreak` | — |
| `blockquote` | `Blockquote` | — |
| `list` | `List` | — |
| `listItem` | `ListItem` | — |
| `html` | `Html` | — |
| `code` | `Code` | — |
| `definition` | `Definition` | — |
| `text` | `Text` | — |
| `emphasis` | `Emphasis` | — |
| `strong` | `Strong` | — |
| `inlineCode` | `InlineCode` | — |
| `break` | `Break` | — |
| `link` | `Link` | — |
| `image` | `Image` | — |
| `linkReference` | `LinkReference` | — |
| `imageReference` | `ImageReference` | — |
| `table` | `Table` | `gfm` |
| `tableRow` | `TableRow` | `gfm` |
| `tableCell` | `TableCell` | `gfm` |
| `delete` | `Delete` | `gfm` |
| `footnoteDefinition` | `FootnoteDefinition` | `gfm` |
| `footnoteReference` | `FootnoteReference` | `gfm` |
| `yaml` | `Yaml` | `frontmatter` |
| `toml` | `Toml` | `frontmatter` |
| `math` | `MathNode` | `math` |
| `inlineMath` | `InlineMath` | `math` |
| `containerDirective` | `ContainerDirective` | `directive` |
| `leafDirective` | `LeafDirective` | `directive` |
| `textDirective` | `TextDirective` | `directive` |
| `superscript` | `Superscript` | `superscript` |
| `subscript` | `Subscript` | `subscript` |
| `mdxJsxFlowElement` | `MdxJsxFlowElement` | MDX |
| `mdxJsxTextElement` | `MdxJsxTextElement` | MDX |
| `mdxFlowExpression` | `MdxFlowExpression` | MDX |
| `mdxTextExpression` | `MdxTextExpression` | MDX |
| `mdxjsEsm` | `MdxjsEsm` | MDX |

### `MdastVisitorContext` Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `source` | `get source(): string` | Original Markdown source (lazy, cached) |
| `fileURL` | `readonly fileURL: URL \| undefined` | Document URL from options |
| `data` | `readonly data: Data` | Document-level data bag |
| `removeNode` | `(node) => void` | Remove node from tree |
| `insertBefore` | `(node, newNode \| newNode[]) => void` | Insert sibling before |
| `insertAfter` | `(node, newNode \| newNode[]) => void` | Insert sibling after |
| `wrapNode` | `(node, parentNode) => void` | Wrap node inside parent |
| `prependChild` | `(node, childNode \| childNode[]) => void` | Insert as first child |
| `appendChild` | `(node, childNode \| childNode[]) => void` | Insert as last child |
| `insertChildAt` | `(node, index, childNode \| childNode[]) => void` | Insert at specific index |
| `removeChildAt` | `(node, index) => void` | Remove child at index |
| `replaceNode` | `(node, newNode) => void` | Replace node entirely |
| `setProperty` | `(node, key, value) => void` | Set a property on the node |
| `textContent` | `(node, options?) => string` | Concatenated text of descendants |
| `parent` | `(node) => parent \| undefined` | Get parent node |
| `indexOf` | `(node) => number \| undefined` | Index in parent's children |
| `report` | `(opts) => void` | Record a diagnostic |
| `getCommandBuffer` | `() => CommandBuffer` | Get raw command buffer |
| `getDiagnostics` | `() => MdastDiagnostic[]` | Get accumulated diagnostics |

### `textContent` Options

```ts
ctx.textContent(node, {
  includeImageAlt?: boolean,  // Default: true
  includeHtml?: boolean,      // Default: true
});
```

### Content Type for Mutations

```ts
type MdastContent = MdastNode | { raw: string } | { rawHtml: string };
```

### MDAST Plugin Example

```ts
import { markdownToHtml, defineMdastPlugin } from "satteri";

const emojiPlugin = defineMdastPlugin({
  name: "emoji-extended",
  text(node, ctx) {
    let value = node.value;
    value = value.replaceAll(":wave:", "\u{1F44B}");
    value = value.replaceAll(":rocket:", "\u{1F680}");
    value = value.replaceAll(":check:", "\u{2705}");
    ctx.setProperty(node, "value", value);
  },
});

const { html } = markdownToHtml("Hi :wave:", { mdastPlugins: [emojiPlugin] });
```

---

## 4. HAST Plugins

### Two Visitor Shapes

**Filtered visitors** (for `element`, `mdxJsxFlowElement`, `mdxJsxTextElement`):

```ts
interface HastFilteredVisitor<N extends HastNode = HastNode> {
  filter: string[];  // Tag/component names to match
  visit(node: Readonly<N>, ctx: HastVisitorContext): HastNode | void | Promise<HastNode | void>;
}
```

**Bare visitors** (for `text`, `comment`, `raw`, `doctype`, MDX expression types):

```ts
type HastVisitorFn<N> = (
  node: Readonly<N>,
  ctx: HastVisitorContext,
) => HastNode | void | Promise<HastNode | void>;
```

### Available Visitor Keys

| Key | Type | Feature Gate |
|-----|------|--------------|
| `element` | Filtered by `tagName` | — |
| `mdxJsxFlowElement` | Filtered by `name` | MDX |
| `mdxJsxTextElement` | Filtered by `name` | MDX |
| `text` | Bare function | — |
| `comment` | Bare function | — |
| `raw` | Bare function | — |
| `doctype` | Bare function | — |
| `mdxFlowExpression` | Bare function (has `parseExpression()`) | MDX |
| `mdxTextExpression` | Bare function (has `parseExpression()`) | MDX |
| `mdxjsEsm` | Bare function (has `parseExpression()`) | MDX |

### HAST Visitor Context

Same methods as MDAST context but operates on `HastNode` types:

| Method | Signature |
|--------|-----------|
| `removeNode` | `(node: HastNode) => void` |
| `replaceNode` | `(node: HastNode, newNode: HastContent) => void` |
| `insertBefore` | `(node, newNode \| newNode[]) => void` |
| `insertAfter` | `(node, newNode \| newNode[]) => void` |
| `wrapNode` | `(node, parentNode) => void` |
| `prependChild` | `(node, childNode \| childNode[]) => void` |
| `appendChild` | `(node, childNode \| childNode[]) => void` |
| `insertChildAt` | `(node, index, childNode \| childNode[]) => void` |
| `removeChildAt` | `(node, index) => void` |
| `setProperty` | `(node, key, value) => void` |
| `textContent` | `(node) => string` |
| `parent` | `(node) => parent \| undefined` |
| `indexOf` | `(node) => number \| undefined` |
| `report` | `(opts) => void` |

### HAST Content Type

```ts
type HastContent = HastNode;  // Unlike MDAST, HAST has a "raw" node type
```

### HAST Plugin Example

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

const { html } = markdownToHtml(source, { hastPlugins: [externalLinks] });
```

### Multiple Filter Entries

You can provide an array of filtered visitors for the same node type:

```ts
const plugin = defineHastPlugin({
  name: "multi-filter",
  element: [
    {
      filter: ["a"],
      visit(node, ctx) { /* handle links */ },
    },
    {
      filter: ["img", "video"],
      visit(node, ctx) { /* handle media */ },
    },
  ],
});
```

---

## 5. Data Sharing

The `ctx.data` object is a document-scoped bag shared across all plugins. It survives the MDAST-to-HAST boundary.

### Basic Usage

```ts
// Plugin 1: MDAST stage — collect headings
const collectHeadings = defineMdastPlugin({
  name: "collect-headings",
  heading(node, ctx) {
    const list = (ctx.data.headings as string[]) ?? [];
    const first = node.children[0];
    if (first && "value" in first) list.push(first.value as string);
    ctx.data.headings = list;
  },
});

// Plugin 2: HAST stage — use collected headings
const tocRenderer = defineHastPlugin({
  name: "toc-renderer",
  element: {
    filter: ["body"],
    visit(node, ctx) {
      const headings = (ctx.data.headings as string[]) ?? [];
      // Use headings to generate TOC...
    },
  },
});

const { html, data } = markdownToHtml("# A\n\n# B", {
  mdastPlugins: [collectHeadings],
  hastPlugins: [tocRenderer],
});
console.log(data.headings); // ["A", "B"]
```

### Type-Safe Data (Module Augmentation)

```ts
import { Data } from "satteri";

declare module "satteri" {
  interface DataMap {
    headings: string[];
    tocHtml: string;
  }
}

// Now ctx.data is typed:
const plugin = defineMdastPlugin({
  name: "typed-data",
  heading(node, ctx) {
    const list = ctx.data.headings ?? [];  // TypeScript knows it's string[]
    list.push(ctx.textContent(node));
    ctx.data.headings = list;
  },
});
```

### Seeding Data

Pass initial data via compile options:

```ts
const { html, data } = markdownToHtml(source, {
  data: { customKey: "initial value" },
});
```

---

## 6. Async Plugins

Any visitor may return a `Promise`. When any visitor is async, `markdownToHtml` and `mdxToJs` return a `Promise`.

```ts
const asyncPlugin = defineMdastPlugin({
  name: "async-plugin",
  async text(node, ctx) {
    const result = await fetch("https://api.example.com/transform", {
      method: "POST",
      body: node.value,
    });
    const transformed = await result.text();
    ctx.setProperty(node, "value", transformed);
  },
});
// markdownToHtml returns Promise<MarkdownToHtmlResult> here
```

**Best practice:** Keep plugins synchronous whenever possible. Async visitors add overhead and prevent synchronous return types.

---

## 7. Diagnostics

Report warnings and errors from plugins:

```ts
const validatePlugin = defineMdastPlugin({
  name: "validate",
  link(node, ctx) {
    if (!node.url) {
      ctx.report({
        message: "Link missing URL",
        node,
        severity: "warning",
      });
    }
  },
});

const { html } = markdownToHtml(source, { mdastPlugins: [validatePlugin] });
// Diagnostics available via the visitor result or compilation
```

### Diagnostic Severity Levels

```ts
type Severity = "error" | "warning" | "info";
```

---

## 8. Raw Content Injection

### Raw Markdown

Return `{ raw: string }` from an MDAST visitor to inject raw Markdown that will be re-parsed:

```ts
const plugin = defineMdastPlugin({
  name: "inject-md",
  paragraph(node, ctx) {
    if (someCondition) {
      return { raw: "**Bold** and _italic_" };
    }
  },
});
```

### Raw HTML

Return `{ rawHtml: string }` to inject raw HTML that passes through:

```ts
const plugin = defineMdastPlugin({
  name: "inject-html",
  paragraph(node, ctx) {
    return { rawHtml: '<div class="custom">Content</div>' };
  },
});
```

---

## 9. Plugin Execution Details

1. Plugins run in **array order** (first plugin runs first)
2. Each plugin walks the tree **once** (single-pass)
3. After a plugin finishes, its structural mutations are applied before the next plugin runs
4. A plugin's freshly-built nodes are **not** re-walked by the same plugin
5. The MDAST-to-HAST conversion runs after all MDAST plugins complete
6. HAST plugins run after conversion

---

## 10. Common Patterns

### Pattern: Transform Specific Nodes

```ts
const plugin = defineMdastPlugin({
  name: "transform-code",
  code(node, ctx) {
    if (node.lang === "mermaid") {
      // Transform mermaid code blocks into diagrams
      return { rawHtml: `<div class="mermaid">${node.value}</div>` };
    }
  },
});
```

### Pattern: Collect Data Without Mutating

```ts
const plugin = defineMdastPlugin({
  name: "collect-images",
  image(node, ctx) {
    const images = (ctx.data.images as string[]) ?? [];
    images.push(node.url);
    ctx.data.images = images;
    // No return = no mutation
  },
});
```

### Pattern: Wrap Nodes

```ts
const plugin = defineHastPlugin({
  name: "wrap-callouts",
  element: {
    filter: ["blockquote"],
    visit(node, ctx) {
      const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["callout"] },
        children: [node],
      };
      ctx.replaceNode(node, wrapper);
    },
  },
});
```

### Pattern: Remove Nodes

```ts
const plugin = defineMdastPlugin({
  name: "remove-comments",
  html(node) {
    if (node.value.includes("<!--")) {
      return undefined; // keep
    }
  },
});
```
