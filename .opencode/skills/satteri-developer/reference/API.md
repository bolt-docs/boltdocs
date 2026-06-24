# Satteri API Reference

Complete reference for every public function, option, and handle in the `satteri` npm package.

---

## 1. Compile Functions

### `markdownToHtml(source, options?)`

Parse Markdown, run MDAST plugins, convert to HAST, run HAST plugins, render to HTML.

```ts
function markdownToHtml<O extends CompileOptions>(
  source: string,
  options?: O,
): ResultFor<O, MarkdownToHtmlResult>;
```

**Parameters:**
- `source: string` — Raw Markdown source text
- `options?: CompileOptions` — Compilation options (plugins, features, etc.)

**Returns:** `MarkdownToHtmlResult` synchronously when all plugins are sync; `Promise<MarkdownToHtmlResult>` when any plugin visitor is async.

**Result shape:**
```ts
interface MarkdownToHtmlResult {
  html: string;
  frontmatter: Frontmatter | null;
  data: Data;
}
```

---

### `mdxToJs(source, options?)`

Parse MDX, run MDAST plugins, convert to HAST, run HAST plugins, compile to JS module source.

```ts
function mdxToJs<O extends MdxCompileOptions>(
  source: string,
  options?: O,
): ResultFor<O, MdxToJsResult>;
```

**Parameters:**
- `source: string` — Raw MDX source text
- `options?: MdxCompileOptions` — Compile options + MDX-specific options

**Returns:** `MdxToJsResult` synchronously when all plugins are sync; `Promise<MdxToJsResult>` otherwise.

**Result shape:**
```ts
interface MdxToJsResult {
  code: string;
  frontmatter: Frontmatter | null;
  data: Data;
}
```

---

### `evaluate(source, options)`

Compile and evaluate MDX in one step. Uses `outputFormat: "function-body"` internally.

```ts
function evaluate(
  source: string,
  options: EvaluateOptions,
): Record<string, unknown> | Promise<Record<string, unknown>>;
```

**Parameters:**
- `source: string` — MDX source
- `options: EvaluateOptions` — Compile options + JSX runtime functions

**Required options (JSX runtime):**
```ts
interface EvaluateOptions extends Omit<MdxCompileOptions, "jsx" | "outputFormat"> {
  Fragment: unknown;
  jsx: (type: unknown, props: unknown, key?: unknown) => unknown;
  jsxs: (type: unknown, props: unknown, key?: unknown) => unknown;
  jsxDEV?: (type: unknown, props: unknown, key: unknown, isStaticChildren: boolean, source: unknown, self: unknown) => unknown;
  useMDXComponents?: () => Record<string, unknown>;
}
```

**Returns:** Module namespace object including `default` (the MDX component).

---

### `markdownToMdast(source, options?)`

Parse Markdown into a fully materialized mdast tree. Always synchronous.

```ts
function markdownToMdast(
  source: string,
  options?: { features?: Features },
): MdastNode;
```

**Returns:** `MdastNode` (standard `mdast.Root`)

---

### `mdxToMdast(source, options?)`

Parse MDX into a fully materialized mdast tree. Always synchronous.

```ts
function mdxToMdast(
  source: string,
  options?: { features?: Features },
): MdastNode;
```

---

### `markdownToHast(source, options?)`

Convert Markdown to a fully materialized hast tree. Always synchronous.

```ts
function markdownToHast(
  source: string,
  options?: { features?: Features },
): HastNode;
```

---

### `mdxToHast(source, options?)`

Convert MDX to a fully materialized hast tree. Always synchronous.

```ts
function mdxToHast(
  source: string,
  options?: { features?: Features },
): HastNode;
```

---

## 2. Compile Options

### `CompileOptions`

```ts
interface CompileOptions {
  mdastPlugins?: MdastPluginInput[];
  hastPlugins?: HastPluginInput[];
  features?: Features;
  fileURL?: URL;
  data?: Data;
}
```

### `MdxCompileOptions`

```ts
interface MdxCompileOptions extends CompileOptions, MdxOnlyOptions {}
```

### `MdxOnlyOptions`

```ts
interface MdxOnlyOptions {
  optimizeStatic?: OptimizeStaticConfig;
  jsxImportSource?: string;          // Default: "react"
  jsx?: boolean;                     // Default: false
  jsxRuntime?: "automatic" | "classic";
  development?: boolean;             // Default: false
  providerImportSource?: string;
  pragma?: string;                   // Default: "React.createElement"
  pragmaFrag?: string;               // Default: "React.Fragment"
  pragmaImportSource?: string;       // Default: "react"
  outputFormat?: "program" | "function-body";
  elementAttributeNameCase?: "react" | "html";
  stylePropertyNameCase?: "dom" | "css";
}
```

### `Features`

```ts
interface Features {
  gfm?: boolean | GfmOptions;
  frontmatter?: boolean;              // Default: true
  math?: boolean | MathOptions;       // Default: false
  headingAttributes?: boolean;        // Default: false
  directive?: boolean;                // Default: false
  superscript?: boolean;              // Default: false
  subscript?: boolean;                // Default: false
  wikilinks?: boolean;                // Default: false
  smartPunctuation?: boolean | SmartPunctuationOptions;  // Default: false
}
```

### `GfmOptions`

```ts
interface GfmOptions {
  footnotes?: boolean | FootnoteOptions;
}
```

### `FootnoteOptions`

```ts
interface FootnoteOptions {
  label?: string;                                      // Default: "Footnotes"
  backContent?: string | FootnoteBackrefCallback;      // Default: "↩"
  backLabel?: string | FootnoteBackrefCallback;        // Default: "Back to reference {reference}"
}

type FootnoteBackrefCallback = (referenceNumber: number, rerunIndex: number) => string;
```

### `MathOptions`

```ts
interface MathOptions {
  singleDollarTextMath?: boolean;     // Default: true
}
```

### `SmartPunctuationOptions`

```ts
interface SmartPunctuationOptions {
  quotes?: boolean;    // Default: true
  dashes?: boolean;    // Default: true
  ellipses?: boolean;  // Default: true
}
```

### `OptimizeStaticConfig`

```ts
interface OptimizeStaticConfig {
  component: string;       // e.g. "Fragment", "div"
  prop: string;            // e.g. "set:html", "dangerouslySetInnerHTML"
  wrapPropValue?: boolean; // Wrap as { __html: "..." }
  ignoreElements?: string[];
}
```

---

## 3. Handle Functions

Handles represent arena-allocated binary ASTs in Rust memory. They are opaque to JS.

### Creating Handles

```ts
function createMdastHandle(source: string, features?: Features): MdastHandle;
function createMdxMdastHandle(source: string, features?: Features): MdastHandle;
function createHastHandle(source: string, features?: Features, convertOptions?: JsConvertOptions): HastHandle;
function createMdxHastHandle(source: string, features?: Features, convertOptions?: JsConvertOptions): HastHandle;
```

### Handle Operations

```ts
function serializeHandle(handle: AnyHandle): Uint8Array;
function getHandleSource(handle: AnyHandle): string;
function getMdastFrontmatter(handle: MdastHandle): JsFrontmatter | null;
function dropHandle(handle: AnyHandle): void;
```

### Mutation and Conversion

```ts
function applyCommandsToMdastHandle(handle: MdastHandle, commandBuf: Uint8Array): number;
function applyCommandsToHandle(handle: HastHandle, commandBuf: Uint8Array): number;
function convertMdastToHastHandle(handle: MdastHandle, convertOptions?: JsConvertOptions): HastHandle;
function applyCommandsAndConvertToHastHandle(handle: MdastHandle, commandBuf: Uint8Array, convertOptions?: JsConvertOptions): HastHandle;
```

### Rendering and Compilation

```ts
function renderHandle(handle: HastHandle): string;
function compileHandle(handle: HastHandle, options?: JsMdxOptions): string;
function parseToHtml(source: string, features?: Features, convertOptions?: JsConvertOptions): string;
function compileMdx(source: string, options?: JsMdxOptions, features?: Features, convertOptions?: JsConvertOptions): string;
```

### Node Data Access

```ts
function getNodeData(handle: AnyHandle, nodeId: number): string | null;
function setNodeData(handle: AnyHandle, nodeId: number, json: Uint8Array): void;
function textContentHandle(handle: HastHandle, nodeId: number): string;
function mdastTextContentHandle(handle: MdastHandle, nodeId: number, options?: JsTextContentOptions): string;
```

### Expression Parsing

```ts
function parseExpression(source: string): string | null;
function parseEsm(source: string): string | null;
```

### Walk (for plugin pipeline)

```ts
function walkMdastHandle(handle: MdastHandle, subscriptions: JsSubscription[]): Uint8Array;
function walkHandle(handle: HastHandle, subscriptions: JsSubscription[]): Uint8Array;
```

---

## 4. Plugin Definition Functions

```ts
function defineMdastPlugin<P extends MdastPluginDefinition>(definition: P): P;
function defineHastPlugin<P extends HastPluginDefinition>(definition: P): P;
```

Both validate that `name` exists and return the definition typed. See `reference/PLUGINS.md` for full details.

---

## 5. Step-by-Step Pipeline Functions

For advanced use cases where you need fine-grained control over the pipeline:

```ts
// Materialize trees from handles
function materializeMdastTree(reader: MdastReader): Root;
function materializeHastTree(reader: HastReader): Root;

// Visitor pipeline
function visitMdastHandle(handle, plugin, subs, source, fileURL, data): MdastVisitResult | Promise<MdastVisitResult>;
function visitHastHandle(handle, plugin, subs, source, fileURL, data): number | Promise<number>;
function resolveMdastSubscriptions(plugin): MdastSubscription[];
function resolveSubscriptions(plugin): ResolvedSubscription[];
```

---

## 6. JsConvertOptions

Options for MDAST→HAST conversion, primarily for footnote customization:

```ts
interface JsConvertOptions {
  footnoteLabel?: string;
  footnoteBackContent?: string | ((referenceNumber: number, rerunIndex: number) => string);
  footnoteBackLabel?: string | ((referenceNumber: number, rerunIndex: number) => string);
}
```

---

## 7. JsFeatures (Rust-side)

Feature flags passed to the Rust parser:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gfm` | `boolean` | `true` | Tables, footnotes, strikethrough, task lists |
| `frontmatter` | `boolean` | `true` | YAML/TOML frontmatter |
| `math` | `boolean` | `false` | Math blocks + inline |
| `headingAttributes` | `boolean` | `false` | `# text { #id .class }` |
| `directive` | `boolean` | `false` | `:::container` blocks |
| `superscript` | `boolean` | `false` | `^super^` |
| `subscript` | `boolean` | `false` | `~sub~` |
| `wikilinks` | `boolean` | `false` | `[[link]]` |
| `smartPunctuation` | `boolean` | `false` | All smart categories |

---

## 8. JsTextContentOptions

```ts
interface JsTextContentOptions {
  includeImageAlt?: boolean;  // Default: true
  includeHtml?: boolean;      // Default: true
}
```

---

## 9. Quick Reference Table

| Function | Input | Output | Sync? |
|----------|-------|--------|-------|
| `markdownToHtml` | string + options | `{ html, frontmatter, data }` | Yes (if all plugins sync) |
| `mdxToJs` | string + options | `{ code, frontmatter, data }` | Yes (if all plugins sync) |
| `evaluate` | string + evaluate options | `Record<string, unknown>` | Yes (if all plugins sync) |
| `markdownToMdast` | string + features | `MdastNode` (Root) | Always |
| `mdxToMdast` | string + features | `MdastNode` (Root) | Always |
| `markdownToHast` | string + features | `HastNode` (Root) | Always |
| `mdxToHast` | string + features | `HastNode` (Root) | Always |
| `parseToHtml` | string + features | `string` (HTML) | Always |
| `compileMdx` | string + options | `string` (JS) | Always |
| `createMdastHandle` | string + features | `MdastHandle` | Always |
| `createHastHandle` | string + features | `HastHandle` | Always |
| `renderHandle` | `HastHandle` | `string` (HTML) | Always |
| `dropHandle` | `AnyHandle` | `void` | Always |
