# Satteri Utilities Reference

Low-level utilities for arena readers, command buffers, op-writers, and wire format helpers.

---

## 1. MdastReader

Reads the Rust arena binary buffer for MDAST.

### Constructor

```ts
new MdastReader(buffer: ArrayBuffer | Uint8Array)
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `nodeCount` | `number` | Total nodes in the arena |
| `header` | `BufferHeader` | Copy of the parsed header |

### String Access Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSource` | `() => string` | Full source string from the string pool |
| `getString` | `(offset, len) => string` | Read a substring from the string pool |

### Node Access Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getNode` | `(nodeId) => MdastNodeRaw` | Read full raw node struct |
| `getNodeType` | `(nodeId) => number` | Read just the type byte |
| `getParentId` | `(nodeId) => number` | Parent node ID (0xffffffff at root) |
| `getChildIds` | `(nodeId) => number[]` | Child node IDs |
| `pushChildIds` | `(nodeId, stack) => void` | Push children in reverse for depth-first |

### Type-Specific Data Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getTypeData` | `(nodeId) => Uint8Array` | Raw type-specific data bytes |
| `readStringRef` | `(typeData, byteOffset?) => StringRefRaw` | Read offset+len pair |
| `getTextValue` | `(nodeId) => string` | String value for Text/InlineCode/Html/Yaml/Toml |
| `getListData` | `(nodeId) => { ordered, start, spread }` | List node data |
| `getListItemData` | `(nodeId) => { checked, spread }` | List item data |
| `getTableAlign` | `(nodeId) => (string\|null)[]` | Table column alignments |
| `getDirectiveData` | `(nodeId) => { name, attributes }` | Directive data |
| `getMdxJsxElementName` | `(nodeId) => string \| null` | MDX JSX element name |
| `getMdxJsxElementData` | `(nodeId) => { name, attributes }` | Full MDX JSX data |
| `getNodeData` | `(nodeId) => string \| null` | Per-node JSON data blob |

### Traversal Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `walk` | `(visitor, rootId?) => void` | Depth-first walk. Return false to skip children |
| `walkFull` | `(visitor, rootId?) => void` | Depth-first walk with full node objects |

---

## 2. HastReader

Reads the Rust arena binary buffer for HAST. Same constructor pattern as MdastReader.

### Additional Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getPosition` | `(nodeId) => Position \| undefined` | Node position in source |
| `hasPosition` | `(nodeId) => boolean` | Fast check without decoding |
| `getElementData` | `(nodeId) => { tagName, properties }` | Element tag + properties |
| `getMdxJsxElementData` | `(nodeId) => { name, attributes }` | MDX JSX element data |
| `getTextValue` | `(nodeId) => string` | Value for text/comment/raw nodes |

---

## 3. Materializer Functions

Convert binary arena data into lazy JS objects.

### `materializeMdastTree(reader)`

```ts
function materializeMdastTree(reader: MdastReader): Root;
```

Materializes the full MDAST tree. Fields resolve on first access via lazy properties.

### `materializeNode(reader, nodeId)`

```ts
function materializeNode(reader: MdastReader, nodeId: number): MdastNode;
```

Materialize a single node and its subtree.

### `materializeHastTree(reader)`

```ts
function materializeHastTree(reader: HastReader): Root;
```

### `materializeHastNode(reader, nodeId)`

```ts
function materializeHastNode(reader: HastReader, nodeId: number): HastNode;
```

---

## 4. CommandBuffer

Binary buffer for structural mutations. Created by the visitor context.

### Mutation Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `removeNode` | `(nodeId) => void` | Remove a node |
| `setProperty` | `(nodeId, key, value) => void` | Set a property on a node |
| `insertBefore` | `(nodeId, newNode) => void` | Insert before a node |
| `insertAfter` | `(nodeId, newNode) => void` | Insert after a node |
| `prependChild` | `(nodeId, newNode) => void` | Prepend as first child |
| `appendChild` | `(nodeId, newNode) => void` | Append as last child |
| `wrapNode` | `(nodeId, parentNode) => void` | Wrap node in parent |
| `replace` | `(nodeId, newNode) => void` | Replace node entirely |

### Op-Stream Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `replaceOpstream` | `(nodeId, ops) => void` | Replace with op-stream |
| `setChildrenOpstream` | `(nodeId, ops) => void` | Set children via op-stream |
| `insertBeforeOpstream` | `(nodeId, ops) => void` | Insert before via op-stream |
| `insertAfterOpstream` | `(nodeId, ops) => void` | Insert after via op-stream |
| `prependChildOpstream` | `(nodeId, ops) => void` | Prepend child via op-stream |
| `appendChildOpstream` | `(nodeId, ops) => void` | Append child via op-stream |
| `wrapNodeOpstream` | `(nodeId, ops) => void` | Wrap via op-stream |

### Buffer Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getBuffer` | `() => Uint8Array` | Get the serialized command buffer |
| `reset` | `() => void` | Reset the buffer for reuse |

---

## 5. OpWriter

Low-level op-stream writer for building AST fragments.

### Lifecycle Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `begin` | `() => void` | Start a new op-stream |
| `end` | `() => void` | Finalize the op-stream |

### Node Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `open` | `(type: number) => void` | Open a new node of given type |
| `close` | `() => void` | Close the current node |

### Field Writer Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `str` | `(field, s) => void` | Write a string field |
| `u8` | `(field, v) => void` | Write a u8 field |
| `u32` | `(field, v) => void` | Write a u32 field |
| `bool` | `(field, v) => void` | Write a boolean field |
| `data` | `(value) => void` | JSON-serialize node data |
| `prop` | `(name, kind, value) => void` | Write an element property |
| `ref` | `(id) => void` | Reference an existing node by ID |
| `align` | `(codes) => void` | Write table column alignment |
| `keepChildren` | `() => void` | Keep original children when replacing |

---

## 6. Wire Utilities

### Byte Readers

```ts
function ru16(view: DataView, off: number): number;  // Read u16 little-endian
function ru32(view: DataView, off: number): number;  // Read u32 little-endian
function rstr(buf: Uint8Array, off: number, len: number): string;  // Read UTF-8 string
function readPosition(view: DataView, off: number): Position | undefined;
```

### Position Wire Format

24 bytes, 6 x u32 LE: `[startOffset, endOffset, startLine, startColumn, endLine, endColumn]`

A `startLine` of 0 means synthesized node with no source range; `readPosition()` returns `undefined`.

---

## 7. Element Property Decoding

```ts
function decodeElementProp(kind: number, value: string): HastPropertyValue;
```

| Kind Constant | Value | Result |
|---------------|-------|--------|
| `PROP_BOOL_TRUE` (1) | any | `true` |
| `PROP_BOOL_FALSE` (2) | any | `false` |
| `PROP_SPACE_SEP` (3) | string | `string.split(" ")` |
| `PROP_COMMA_SEP` (4) | string | `string.split(",").map(s => s.trim())` |
| `PROP_INT` (5) | string | `Number(value)` |
| `PROP_STRING` (0) / default | string | string as-is |

---

## 8. MDX Attribute Decoding

```ts
function decodeMdxJsxAttr(kind: number, name: string, value: string): MdxJsxAttributeUnion;
```

| Kind Constant | Value | Result |
|---------------|-------|--------|
| `MDX_ATTR_BOOLEAN_PROP` (0) | any | `{ type: "mdxJsxAttribute", name, value: null }` |
| `MDX_ATTR_LITERAL_PROP` (1) | string | `{ type: "mdxJsxAttribute", name, value }` |
| `MDX_ATTR_EXPRESSION_PROP` (2) | string | `{ type: "mdxJsxAttribute", name, value: { type: "mdxJsxAttributeValueExpression", value } }` |
| `MDX_ATTR_SPREAD` (3) | string | `{ type: "mdxJsxExpressionAttribute", value }` |

---

## 9. Column Alignment Decoding

```ts
function decodeColumnAlign(byte: number): string | null;
```

| Byte | Result |
|------|--------|
| 0 | `null` |
| 1 | `"left"` |
| 2 | `"right"` |
| 3 | `"center"` |

---

## 10. Lazy Props

### `lazyProp(key, get)`

```ts
function lazyProp<T>(key: string, get: () => T): PropertyDescriptor;
```

Build a self-caching getter descriptor. The getter runs once, then the value is stored directly on the object.

### `lazyGroup(node, keys, resolve)`

```ts
function lazyGroup(
  node: object,
  keys: readonly string[],
  resolve: () => Record<string, unknown>,
): void;
```

First access to any field in the group resolves all fields from one reader call. More efficient than individual lazy props when multiple fields are always accessed together.

---

## 11. Visitor Shared Utilities

### `asArray(value)`

```ts
function asArray<T>(value: T | T[]): T[];
```

Wrap a single value in an array; pass-through if already an array.

### `makeRequireNid(nid)`

```ts
function makeRequireNid<TNode>(
  nid: (node: TNode) => number | undefined,
): (node: TNode, method: string) => number;
```

Returns a function that throws if a node has no arena ID (e.g., plugin-built nodes that were never added to the arena).

### `mergeAndReset(returnBuffer, ctx)`

```ts
function mergeAndReset(
  returnBuffer: CommandBuffer,
  ctx: { getCommandBuffer(): CommandBuffer },
): { merged: Uint8Array; hasMutations: boolean };
```

Concatenate return-value and context command buffers, reset both.

---

## 12. Phantom Spaces

```ts
function restorePhantomSpaces(value: string): string;
```

Replace `\uF002` sentinels with real spaces. Used in MDX expression values where the parser needs to preserve significant whitespace that would otherwise be collapsed.

---

## 13. Child Stub Utilities

### `stubDescriptors(fields)`

```ts
function stubDescriptors(fields: readonly string[]): PropertyDescriptorMap;
```

Build PropertyDescriptorMap with lazy getters that resolve to materialized node fields. Always includes "position" and "data".

### `flatByTag(table)`

```ts
function flatByTag<T>(table: Readonly<Record<number, T>>): readonly (T | undefined)[];
```

Convert a tag-keyed record to a dense array for O(1) lookup by tag number.

---

## 14. LazyChildResolver

Abstract base class for managing lazy node materialization during visitor passes.

```ts
abstract class LazyChildResolver<TReader, TNode> {
  seal(): void;                          // Mark visitor pass complete
  assertUnsealed(): void;                // Throw if sealed (stale IDs)
  materializeOne(nodeId: number): TNode; // Materialize a single node
  parentIdOf(nodeId: number): number | undefined;
  indexInParent(nodeId: number): number | undefined;
}
```

### `markHandleMutated(handle)`

```ts
function markHandleMutated(handle: AnyHandle): void;
```

Bump the handle's epoch, invalidating stale child stubs from previous visitor passes.

---

## 15. MDX Attribute Helper

### `emitMdxAttr(w, a)`

```ts
function emitMdxAttr(w: OpWriter, a: Record<string, unknown>): void;
```

Emit one MDX JSX attribute as an OP_PROP to the op-stream writer.

---

## 16. `classifyReturn(value)`

```ts
function classifyReturn(value: unknown):
  | "no_change"
  | "raw_markdown"
  | "raw_html"
  | "structured_node";
```

Determines the mutation type from a visitor return value. Used internally by the visitor pipeline to decide how to handle the return.
