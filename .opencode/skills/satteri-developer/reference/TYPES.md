# Satteri Type Definitions

Complete reference for all TypeScript types and interfaces in the `satteri` package.

---

## 1. Core AST Node Types

### `MdastNode`

Standard mdast `Nodes` discriminated union, augmented with custom types:

```ts
type MdastNode = mdast.Nodes;
```

### `HastNode`

Standard hast `Nodes` discriminated union, augmented with custom types:

```ts
type HastNode = hast.Nodes;
```

### Internal Arena-Tracked Nodes

```ts
type MdastNodeInternal = MdastStdNodes & { _nodeId: number };
type HastNodeInternal = HastStdNodes & { _nodeId: number };
```

---

## 2. Custom MDAST Node Types

### `Toml`

```ts
interface Toml extends MdastLiteral {
  type: "toml";
  value: string;
}
```

### `MathNode`

```ts
interface MathNode extends MdastLiteral {
  type: "math";
  value: string;
  meta?: string | null;
}
```

### `InlineMath`

```ts
interface InlineMath extends MdastLiteral {
  type: "inlineMath";
  value: string;
}
```

### `Superscript`

```ts
interface Superscript extends MdastParent {
  type: "superscript";
  children: PhrasingContent[];
}
```

### `Subscript`

```ts
interface Subscript extends MdastParent {
  type: "subscript";
  children: PhrasingContent[];
}
```

---

## 3. Custom HAST Node Types

### `HastRaw`

```ts
interface HastRaw extends HastLiteral {
  type: "raw";
  value: string;
}
```

---

## 4. MDX Node Types (MDAST variants)

### `MdxJsxFlowElement`

```ts
interface MdxJsxFlowElement extends MdastParent {
  type: "mdxJsxFlowElement";
  name: string | null;  // null for fragments
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
  children: BlockContent[];
}
```

### `MdxJsxTextElement`

```ts
interface MdxJsxTextElement extends MdastParent {
  type: "mdxJsxTextElement";
  name: string | null;
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
  children: PhrasingContent[];
}
```

### `MdxFlowExpression`

```ts
interface MdxFlowExpression extends MdastLiteral {
  type: "mdxFlowExpression";
  value: string;
}
```

### `MdxTextExpression`

```ts
interface MdxTextExpression extends MdastLiteral {
  type: "mdxTextExpression";
  value: string;
}
```

### `MdxjsEsm`

```ts
interface MdxjsEsm extends MdastLiteral {
  type: "mdxjsEsm";
  value: string;
}
```

### `MdxJsxAttribute`

```ts
interface MdxJsxAttribute extends Node {
  type: "mdxJsxAttribute";
  name: string;
  value?: MdxJsxAttributeValueExpression | string | null;
}
```

### `MdxJsxExpressionAttribute`

```ts
interface MdxJsxExpressionAttribute extends Node {
  type: "mdxJsxExpressionAttribute";
  value: string;
}
```

### `MdxJsxAttributeValueExpression`

```ts
interface MdxJsxAttributeValueExpression extends Node {
  type: "mdxJsxAttributeValueExpression";
  value: string;
}
```

---

## 5. MDX Node Types (HAST variants)

### `MdxJsxFlowElementHast`

```ts
interface MdxJsxFlowElementHast extends HastParent {
  type: "mdxJsxFlowElement";
  name: string | null;
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
  children: ElementContent[];
}
```

### `MdxJsxTextElementHast`

```ts
interface MdxJsxTextElementHast extends HastParent {
  type: "mdxJsxTextElement";
  name: string | null;
  attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
  children: ElementContent[];
}
```

### `MdxFlowExpressionHast`

```ts
interface MdxFlowExpressionHast extends HastLiteral {
  type: "mdxFlowExpression";
  value: string;
  parseExpression(): EstreeProgram | null;
}
```

### `MdxTextExpressionHast`

```ts
interface MdxTextExpressionHast extends HastLiteral {
  type: "mdxTextExpression";
  value: string;
  parseExpression(): EstreeProgram | null;
}
```

### `MdxjsEsmHast`

```ts
interface MdxjsEsmHast extends HastLiteral {
  type: "mdxjsEsm";
  value: string;
  parseExpression(): EstreeProgram | null;
}
```

### Union Types

```ts
type MdxJsxAttributeUnion = MdxJsxAttribute | MdxJsxExpressionAttribute;
```

---

## 6. Directive Node Types

### `ContainerDirective`

```ts
interface ContainerDirective extends MdastParent {
  type: "containerDirective";
  name: string;
  attributes?: DirectiveAttributes | null;
  children: Array<BlockContent | DefinitionContent>;
}
```

### `LeafDirective`

```ts
interface LeafDirective extends MdastParent {
  type: "leafDirective";
  name: string;
  attributes?: DirectiveAttributes | null;
  children: PhrasingContent[];
}
```

### `TextDirective`

```ts
interface TextDirective extends MdastParent {
  type: "textDirective";
  name: string;
  attributes?: DirectiveAttributes | null;
  children: PhrasingContent[];
}
```

### `DirectiveAttributes`

```ts
type DirectiveAttributes = Record<string, string | null | undefined>;
```

---

## 7. Handle Types

```ts
interface MdastHandle { readonly __satteriHandleKind: "mdast"; }
interface HastHandle { readonly __satteriHandleKind: "hast"; }
type AnyHandle = MdastHandle | HastHandle;
```

Handles are opaque. They represent arena-allocated binary ASTs in Rust memory. Never access internal properties.

---

## 8. Position Types

Re-exported from `unist`:

```ts
interface Point {
  line: number;    // 1-based
  column: number;  // 1-based
  offset: number;  // 0-based byte offset
}

interface Position {
  start: Point;
  end: Point;
}
```

---

## 9. Data Types

### `Data`

```ts
type Data = Record<string, unknown> & Partial<DataMap>;
```

### `DataMap`

```ts
interface DataMap {}
```

Extend via module augmentation:

```ts
declare module "satteri" {
  interface DataMap {
    headings: string[];
    tocHtml: string;
    customKey: CustomType;
  }
}
```

---

## 10. Plugin Types

### `MdastPluginDefinition`

```ts
type MdastPluginDefinition = MdastPluginInstance & { name: string };
```

### `HastPluginDefinition`

```ts
type HastPluginDefinition = HastVisitorInstance & { name: string };
```

### `MdastPluginInput`

```ts
type MdastPluginInput = MdastPluginDefinition | (() => MdastPluginDefinition);
```

### `HastPluginInput`

```ts
type HastPluginInput = HastPluginDefinition | (() => HastPluginDefinition);
```

---

## 11. Result Types

### `MarkdownToHtmlResult`

```ts
interface MarkdownToHtmlResult {
  html: string;
  frontmatter: Frontmatter | null;
  data: Data;
}
```

### `MdxToJsResult`

```ts
interface MdxToJsResult {
  code: string;
  frontmatter: Frontmatter | null;
  data: Data;
}
```

### `Frontmatter`

```ts
interface Frontmatter {
  kind: "yaml" | "toml";
  value: string;
}
```

---

## 12. Diagnostic Types

### `MdastDiagnostic`

```ts
interface MdastDiagnostic {
  message: string;
  nodeId?: number | undefined;
  position?: MdastNode["position"] | undefined;
  severity: "error" | "warning" | "info";
}
```

### `HastDiagnostic`

```ts
interface HastDiagnostic {
  message: string;
  nodeId?: number | undefined;
  severity: "error" | "warning" | "info";
}
```

---

## 13. Content Type Aliases

```ts
// MDAST: declarative node, or raw escape hatch
type MdastContent = MdastNode | { raw: string } | { rawHtml: string };

// HAST: always a declarative node (HAST has a native "raw" type)
type HastContent = HastNode;
```

---

## 14. ESTree Type

```ts
type EstreeProgram = Program;  // from "estree-jsx"
```

Available on MDX HAST expression nodes via `parseExpression()`.

---

## 15. Buffer Header

```ts
interface BufferHeader {
  nodeStructSize: number;
  nodeCount: number;
  nodesOffset: number;
  childrenCount: number;
  childrenOffset: number;
  typeDataLen: number;
  typeDataOffset: number;
  sourceLen: number;
  sourceOffset: number;
  nodeDataCount: number;
  nodeDataOffset: number;
}
```

---

## 16. HAST Property

```ts
interface HastProperty {
  name: string;
  value: string | number | boolean | string[];
}
```

---

## 17. Node Type Tags (Numeric)

### MDAST Tags

| Tag | Name | Children | Type Data |
|-----|------|----------|-----------|
| 0 | `root` | yes | — |
| 1 | `paragraph` | yes | — |
| 2 | `heading` | yes | `depth: u8` |
| 3 | `thematicBreak` | no | — |
| 4 | `blockquote` | yes | — |
| 5 | `list` | yes | `start, ordered, spread` |
| 6 | `listItem` | yes | `checked, spread` |
| 7 | `html` | no | `value: string` |
| 8 | `code` | no | `lang, meta, value` |
| 9 | `definition` | no | `url, title, identifier, label` |
| 10 | `text` | no | `value: string` |
| 11 | `emphasis` | yes | — |
| 12 | `strong` | yes | — |
| 13 | `inlineCode` | no | `value: string` |
| 14 | `break` | no | — |
| 15 | `link` | yes | `url, title` |
| 16 | `image` | no | `url, alt, title` |
| 17 | `linkReference` | yes | `identifier, label, referenceType` |
| 18 | `imageReference` | no | `identifier, label, referenceType, alt` |
| 19 | `footnoteDefinition` | yes | `identifier, label` |
| 20 | `footnoteReference` | no | `identifier, label` |
| 21 | `table` | yes | `align: (string\|null)[]` |
| 22 | `tableRow` | yes | — |
| 23 | `tableCell` | yes | — |
| 24 | `delete` | yes | — |
| 25 | `yaml` | no | `value: string` |
| 26 | `toml` | no | `value: string` |
| 27 | `math` | no | `meta, value` |
| 28 | `inlineMath` | no | `value: string` |
| 30 | `containerDirective` | yes | `name, attributes` |
| 31 | `leafDirective` | yes | `name, attributes` |
| 32 | `textDirective` | yes | `name, attributes` |
| 33 | `superscript` | yes | — |
| 34 | `subscript` | yes | — |
| 100 | `mdxJsxFlowElement` | yes | `name, attributes` |
| 101 | `mdxJsxTextElement` | yes | `name, attributes` |
| 102 | `mdxFlowExpression` | no | `value: string` |
| 103 | `mdxTextExpression` | no | `value: string` |
| 104 | `mdxjsEsm` | no | `value: string` |

### HAST Tags

| Tag | Name | Children | Type Data |
|-----|------|----------|-----------|
| 0 | `root` | yes | — |
| 1 | `element` | yes | `tagName, properties` |
| 2 | `text` | no | `value: string` |
| 3 | `comment` | no | `value: string` |
| 4 | `doctype` | no | — |
| 5 | `raw` | no | `value: string` |
| 10 | `mdxJsxFlowElement` | yes | `name, attributes` |
| 11 | `mdxJsxTextElement` | yes | `name, attributes` |
| 12 | `mdxFlowExpression` | no | `value: string` |
| 13 | `mdxjsEsm` | no | `value: string` |
| 14 | `mdxTextExpression` | no | `value: string` |

**Note:** `root` (tag 0) is excluded from visitor subscriptions.

---

## 18. Severity Type

```ts
type Severity = "error" | "warning" | "info";
```

---

## 19. Structural Op Type

```ts
type StructuralOp = "replace" | "insertBefore" | "insertAfter" | "prependChild" | "appendChild" | "wrapNode";
```

---

## 20. JsSubscription (Wire)

```ts
interface JsSubscription {
  nodeType: number;
  tagFilter: string[];
}
```

Used by the walk API to specify which nodes to visit.
