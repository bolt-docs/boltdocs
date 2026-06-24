# Satteri Performance Guide

Best practices for maximizing performance when using the Satteri library.

---

## 1. Architecture Performance Characteristics

### Arena Allocation

- All nodes live in contiguous `Vec`s — no per-node heap allocation
- O(1) allocation (`push`), O(1) access (`nodes[id]`)
- Pre-allocation heuristics: `source.len() / 18 + 16` nodes

### Zero-Copy Strings

- `StringRef` (8 bytes) references back into `arena.source`
- No cloning, no separate allocation for string values
- Computed strings (decoded entities) are appended once

### Flat Children Array

- Children stored in single `Vec<u32>` with `(start, count)` indices
- Cache-friendly traversal — no pointer chasing

### Lazy Materialization

- JS objects created on-demand via `lazyProp`/`lazyGroup`
- Fields resolve on first access, then cached
- Keeps memory and GC pressure minimal

---

## 2. Choose the Right Entry Point

### Simple Conversion (Fastest)

Use `parseToHtml` when no plugins are needed:

```ts
import { parseToHtml } from "satteri";

// Fastest path: no handles, no plugins, just parse + render
const html = parseToHtml(source, { gfm: true });
```

### With Plugins (Recommended)

Use `markdownToHtml` or `mdxToJs` for plugin pipelines:

```ts
import { markdownToHtml } from "satteri";

const { html } = markdownToHtml(source, {
  mdastPlugins: [myPlugin],
  hastPlugins: [myHastPlugin],
});
```

### Manual Handle Pipeline (Advanced)

Use handles when you need fine-grained control:

```ts
import {
  createMdastHandle,
  walkMdastHandle,
  convertMdastToHastHandle,
  renderHandle,
  dropHandle,
} from "satteri";

const handle = createMdastHandle(source);
// ... walk, apply commands ...
const hastHandle = convertMdastToHastHandle(handle);
const html = renderHandle(hastHandle);
dropHandle(hastHandle); // Always free handles!
```

---

## 3. Keep Plugins Synchronous

When all plugin visitors are synchronous, `markdownToHtml` and `mdxToJs` return synchronously — no Promise overhead.

```ts
// GOOD: Synchronous visitor
const plugin = defineMdastPlugin({
  name: "sync-plugin",
  text(node, ctx) {
    ctx.setProperty(node, "value", node.value.toUpperCase());
  },
});

// BAD: Unnecessary async
const plugin = defineMdastPlugin({
  name: "async-plugin",
  async text(node, ctx) {
    // Only use async when you actually need to await something
    ctx.setProperty(node, "value", node.value.toUpperCase());
  },
});
```

**Rule:** Only make a visitor async when you must `await` something (fetch, file read, etc.).

---

## 4. Minimize Visitor Subscriptions

Only implement the visitor methods you actually need. The subscription resolution only subscribes to node types your plugin cares about.

```ts
// GOOD: Only subscribe to headings
const plugin = defineMdastPlugin({
  name: "headings-only",
  heading(node, ctx) {
    // Process headings
  },
});

// BAD: Subscribe to everything, only use text
const plugin = defineMdastPlugin({
  name: "wasteful",
  heading(node, ctx) {},
  text(node, ctx) {},
  paragraph(node, ctx) {},
  link(node, ctx) {},
  image(node, ctx) {},
  // ... 20 more empty methods
});
```

---

## 5. Use HAST Filtered Visitors

HAST filtered visitors are more efficient than checking tag names manually:

```ts
// GOOD: Filter at subscription level
const plugin = defineHastPlugin({
  name: "links-only",
  element: {
    filter: ["a"],  // Only called for <a> elements
    visit(node, ctx) {
      // No need to check tagName
    },
  },
});

// BAD: Subscribe to all elements, filter manually
const plugin = defineHastPlugin({
  name: "inefficient",
  element: {
    filter: ["a", "div", "span", "img", "p", "h1", "h2", "h3"],
    visit(node, ctx) {
      if (node.tagName !== "a") return;
      // This wastes calls on non-link elements
    },
  },
});
```

---

## 6. Handle Lifecycle

Always drop handles to free arena memory:

```ts
const handle = createMdastHandle(source);
try {
  // Use the handle...
} finally {
  dropHandle(handle); // Always free!
}
```

**Never** keep handles alive longer than needed. The Rust arena holds the entire parsed tree in memory.

---

## 7. Avoid Unnecessary Materialization

### Don't Materialize When You Can Walk

Walking the arena is faster than materializing the full tree:

```ts
// SLOWER: Full materialization
const reader = new MdastReader(buffer);
const tree = materializeMdastTree(reader);
// Process tree...

// FASTER: Direct walk (if you only need specific nodes)
const reader = new MdastReader(buffer);
reader.walk((nodeId, nodeType) => {
  if (nodeType === 2) { // heading
    // Process heading directly from reader
  }
});
```

### Use `textContent` Instead of Manual Traversal

```ts
// SLOWER: Manual text extraction
function getText(node: MdastNode): string {
  if ("value" in node) return node.value;
  if ("children" in node) return node.children.map(getText).join("");
  return "";
}

// FASTER: Use the built-in method
const text = ctx.textContent(node);
```

---

## 8. Plugin Ordering

Order plugins from most general to most specific:

```ts
const { html } = markdownToHtml(source, {
  mdastPlugins: [
    collectDataPlugin,    // 1. First: collect data (no mutations)
    transformPlugin,      // 2. Then: structural transforms
    cleanupPlugin,        // 3. Last: cleanup/validation
  ],
});
```

**Why:** Later plugins see the mutations of earlier plugins. Structural changes from cleanup plugins can invalidate earlier results.

---

## 9. Batch Mutations

Apply all mutations in a single pass. Don't make multiple round-trips:

```ts
// GOOD: Multiple mutations in one visitor
const plugin = defineMdastPlugin({
  name: "batch",
  heading(node, ctx) {
    // Do all work in one pass
    const text = ctx.textContent(node);
    const id = slugify(text);
    ctx.setProperty(node, "id", id);
    ctx.setProperty(node, "className", ["heading", `depth-${node.depth}`]);
  },
});

// BAD: Multiple plugins for related transforms
const addId = defineMdastPlugin({ name: "add-id", heading(n, c) { /* ... */ } });
const addClass = defineMdastPlugin({ name: "add-class", heading(n, c) { /* ... */ } });
// These run in separate passes, wasting work
```

---

## 10. Use Features Sparingly

Only enable the features you actually need:

```ts
// GOOD: Only enable what you use
const { html } = markdownToHtml(source, {
  features: {
    gfm: true,
    frontmatter: false,  // Don't parse if you don't use it
    math: false,         // Don't parse if you don't use it
  },
});

// BAD: Enable everything
const { html } = markdownToHtml(source, {
  features: {
    gfm: true,
    frontmatter: true,
    math: true,
    headingAttributes: true,
    directive: true,
    superscript: true,
    subscript: true,
    wikilinks: true,
    smartPunctuation: true,
  },
});
```

**Why:** Each feature adds parsing overhead. Disabled features are skipped at the parser level.

---

## 11. Reuse Plugins Across Compilations

Plugins are stateless by default. Create them once and reuse:

```ts
// GOOD: Create once, reuse many times
const myPlugin = defineMdastPlugin({
  name: "my-plugin",
  text(node, ctx) { /* ... */ },
});

for (const doc of documents) {
  const { html } = markdownToHtml(doc, { mdastPlugins: [myPlugin] });
}

// BAD: Recreate for every document
for (const doc of documents) {
  const plugin = defineMdastPlugin({
    name: "my-plugin",
    text(node, ctx) { /* ... */ },
  });
  const { html } = markdownToHtml(doc, { mdastPlugins: [plugin] });
}
```

---

## 12. String Concatenation in Visitors

Avoid creating new strings in hot visitors. Use `ctx.setProperty` to modify in-place:

```ts
// GOOD: Modify existing value
const plugin = defineMdastPlugin({
  name: "optimize",
  text(node, ctx) {
    if (node.value.includes(":emoji:")) {
      ctx.setProperty(node, "value", node.value.replaceAll(":emoji:", "\u2764"));
    }
  },
});

// AVOID: Creating unnecessary intermediate strings
const plugin = defineMdastPlugin({
  name: "wasteful",
  text(node, ctx) {
    const parts = node.value.split("");
    const result = parts.map(p => p.toUpperCase()).join("");
    ctx.setProperty(node, "value", result);
  },
});
```

---

## 13. Performance Benchmarks

Expected performance characteristics (approximate):

| Operation | Throughput |
|-----------|------------|
| `parseToHtml` (no plugins) | ~100MB/s |
| `markdownToHtml` (sync plugins) | ~50-80MB/s |
| `markdownToHtml` (async plugins) | ~10-30MB/s (depends on I/O) |
| `mdxToJs` | ~30-50MB/s |
| Arena allocation | ~200MB/s |
| HTML rendering from HAST | ~150MB/s |

**Note:** Actual performance depends on source complexity, plugin logic, and hardware.

---

## 14. Memory Management

### Handle Memory

- Each handle holds the entire arena in Rust memory
- Arena size is proportional to source length + node count
- Typical: ~100 bytes per node + source string

### JS Object Memory

- Materialized nodes are lazy — only created when accessed
- `ctx.data` bag persists across plugin stages
- Drop handles promptly to free arena memory

### String Memory

- Source strings are stored once in the arena
- All `StringRef` references point into the single source buffer
- Computed strings are appended to the source buffer

---

## 15. Optimization Checklist

- [ ] Use `parseToHtml` when no plugins needed
- [ ] Keep plugin visitors synchronous when possible
- [ ] Only subscribe to node types you actually use
- [ ] Use HAST filtered visitors instead of manual tag checks
- [ ] Always `dropHandle` when done
- [ ] Avoid unnecessary materialization — prefer walking
- [ ] Enable only the features you need
- [ ] Reuse plugins across compilations
- [ ] Batch related mutations in single plugins
- [ ] Order plugins: general → specific → cleanup
