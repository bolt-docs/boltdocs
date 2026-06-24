# Satteri Architecture

Internal architecture reference for understanding the Rust + TypeScript monorepo.

---

## 1. Crate Dependency Graph

```
satteri (high-level JS API)
  └── satteri-napi (NAPI binding layer)
        ├── satteri-pulldown-cmark (Markdown parser)
        │     ├── satteri-arena (core arena + binary primitives)
        │     ├── satteri-ast (MDAST/HAST types, codecs, conversion)
        │     │     └── satteri-arena
        │     └── [optional] oxc_* (JS/JSX parsing for MDX)
        ├── satteri-ast
        ├── satteri-plugin-api (Rust plugin trait)
        │     ├── satteri-arena
        │     └── satteri-ast
        └── [optional] satteri-mdxjs (MDX to JavaScript compiler)
              ├── satteri-pulldown-cmark
              ├── satteri-ast
              └── oxc_* (AST manipulation + codegen)

satteri-layout-codegen (code generator, standalone binary)
  └── (reads schema.rs, outputs to generated/ folders)
```

---

## 2. Crate Purposes

| Crate | Purpose |
|-------|---------|
| `satteri-arena` | Arena-allocated tree storage, raw binary buffer transfer, string interning |
| `satteri-ast` | MDAST/HAST node types, type_data codecs, conversion, HTML rendering, walk, text content |
| `satteri-pulldown-cmark` | Vendored pulldown-cmark fork with MDX extensions, direct arena build |
| `satteri-mdxjs` | MDX to JavaScript compiler (parse → convert → oxc → codegen) |
| `satteri-plugin-api` | Rust plugin trait, command system, runner |
| `satteri-napi` | Node.js NAPI binding layer — all JS-facing functions |
| `satteri` (JS) | TypeScript public API, visitor pipeline, materializers |
| `satteri-layout-codegen` | Code generator for node type enums, walk serializers, layout assertions |

---

## 3. Arena Allocation System

### Core Data Structures

The arena uses three parallel `Vec`s:

```
Arena {
  nodes: Vec<ArenaNode>      // Fixed 52-byte structs, node ID = index
  children: Vec<u32>         // Flat array of child IDs, indexed by (start, count)
  type_data: Vec<u8>         // Packed variable-length type-specific data
  source: String             // Original Markdown/MDX source
  node_data: FxHashMap<u32, Vec<u8>>  // Per-node JSON blobs (from JS plugins)
  cp_offsets: Vec<(u32, u32)>  // Precomputed code-point offsets (non-ASCII)
}
```

### ArenaNode (52 bytes, `#[repr(C)]`)

```
id: u32               // Node ID (index into nodes array)
node_type: u8         // Tag number (see TYPES.md)
_pad: [u8; 3]
parent: u32           // Parent node ID (0xffffffff at root)
start_offset: u32     // Byte offset into source
end_offset: u32       // Byte offset into source
start_line: u32       // 1-based line number
start_column: u32     // 1-based column number
end_line: u32         // 1-based line number
end_column: u32       // 1-based column number
children_start: u32   // Index into children array
children_count: u32   // Number of children
data_offset: u32      // Index into type_data
data_len: u32         // Length of type-specific data
```

### String Interning

- All strings stored once in `arena.source`
- `StringRef { offset: u32, len: u32 }` — 8-byte handle
- Resolves to `&str` via pointer arithmetic: `&source[offset..offset+len]`
- Computed strings (decoded entities) appended via `alloc_string()`

### Arena Builder

`ArenaBuilder<K>` provides an open/close node pattern:

```
builder.open_node(heading)
builder.add_leaf(text, "Hello")
builder.close_node()
```

Maintains a stack of `(node_id, children_start_in_pending)` and a flat `pending_children` buffer.

---

## 4. Binary AST Wire Format

### Raw Buffer Layout

```
Header (52 bytes):
  magic: u32 = 0x5241444d  ("MDAR" as LE u32)
  kind: u32                 (1=MDAST, 2=HAST)
  node_struct_size: u32 = 52
  node_count: u32
  nodes_offset: u32
  children_count: u32
  children_offset: u32
  type_data_len: u32
  type_data_offset: u32
  source_len: u32
  source_offset: u32
  node_data_count: u32
  node_data_offset: u32

Nodes:     node_count * 52 bytes   (raw ArenaNode structs)
Children:  children_count * 4 bytes (raw u32 child IDs)
TypeData:  type_data_len bytes      (packed codec data)
Source:    source_len bytes         (UTF-8 source text)
NodeData:  variable                 ([node_id: u32][data_len: u32][bytes...] entries)
```

### Key Design Properties

- `#[repr(C)]` nodes with pinned offsets verified by compile-time assertions
- Single `Vec<u8>` — no intermediate allocations
- `unsafe { slice::from_raw_parts }` for nodes and children (zero-copy cast)
- `kind` tag prevents cross-kind decoding errors

---

## 5. Walk Wire Format

Used by `walkMdastHandle` / `walkHandle` for plugin interaction:

```
Match buffer:
  [match_count: u32]

Index (N x 10 bytes each):
  [node_id: u32][sub_index: u8][pad: u8][data_offset: u32]

Data Section (per matched node):
  [node_data_len: u32][node_data JSON bytes]
  [position: 6 x u32 = 24 bytes]
  [child_count: u32][child_ids: u32 each][child_types: u8 each]
  [type-specific tail: generated from registry]
```

The walk builds a `type_subs: [Vec; 256]` lookup table indexed by `node_type` for O(1) subscription matching.

---

## 6. Command Buffer Format

Structural mutations are serialized as a binary command buffer:

| Command | Byte | Description |
|---------|------|-------------|
| `CMD_REMOVE` | 0x01 | Remove a node |
| `CMD_INSERT_BEFORE` | 0x05 | Insert nodes before |
| `CMD_INSERT_AFTER` | 0x06 | Insert nodes after |
| `CMD_PREPEND_CHILD` | 0x07 | Prepend as first child |
| `CMD_APPEND_CHILD` | 0x08 | Append as last child |
| `CMD_WRAP` | 0x09 | Wrap node in parent |
| `CMD_REPLACE` | 0x0b | Replace node |
| `CMD_SET_PROPERTY` | 0x0c | Set a property |
| `CMD_SET_CHILDREN` | 0x0d | Set children |

### Payload Types

| Type | Byte | Description |
|------|------|-------------|
| `PAYLOAD_RAW_MARKDOWN` | 0x10 | Raw Markdown to re-parse |
| `PAYLOAD_RAW_HTML` | 0x11 | Raw HTML passthrough |
| `PAYLOAD_OPSTREAM` | 0x14 | Op-stream encoded AST |

---

## 7. Op-Stream Format

Low-level binary encoding for AST fragments:

| Op | Code | Description |
|----|------|-------------|
| `OP_OPEN` | 0x01 | Open a new node |
| `OP_CLOSE` | 0x02 | Close current node |
| `OP_REF` | 0x03 | Reference existing node by ID |
| `OP_KEEP_CHILDREN` | 0x04 | Keep original children |
| `OP_STR` | 0x05 | Write string field |
| `OP_U8` | 0x06 | Write u8 field |
| `OP_U32` | 0x07 | Write u32 field |
| `OP_BOOL` | 0x08 | Write boolean field |
| `OP_DATA` | 0x09 | Write JSON data |
| `OP_PROP` | 0x0a | Write element property |
| `OP_ALIGN` | 0x0b | Write table alignment |

### Property Value Kinds

| Kind | Byte | Encoding |
|------|------|----------|
| `PROP_STRING` | 0 | UTF-8 string as-is |
| `PROP_BOOL_TRUE` | 1 | Any value → `true` |
| `PROP_BOOL_FALSE` | 2 | Any value → `false` |
| `PROP_SPACE_SEP` | 3 | Split by space → `string[]` |
| `PROP_COMMA_SEP` | 4 | Split by comma → `string[]` |
| `PROP_INT` | 5 | Parse as integer |
| `PROP_NULL` | 6 | `null` |

---

## 8. Pipeline Data Flow

```
Source (string)
  │
  ▼
satteri-pulldown-cmark::parse(source, options)
  │
  ├── First pass: resolve block structure (firstpass.rs)
  ├── Second pass: resolve inline markup (parse.rs)
  ├── arena_build: walk internal Tree → Arena<Mdast>
  └── Post-passes: GFM autolink, MDX mark-and-unravel
  │
  ▼
Arena<Mdast>
  │
  ▼
JS: walkMdastHandle (subscriptions → match buffer)
  │
  ▼
JS: visitor dispatch (decode nodes, call visitor functions)
  │
  ▼
JS: applyCommandsToMdastHandle (binary command buffer → arena rebuild)
  │
  ▼
satteri-ast::hast::mdast_arena_to_hast_arena(arena)
  │
  ├── Resolve link/image references
  ├── Convert MDAST nodes → HAST nodes
  ├── Handle data.hName / data.hProperties overrides
  └── GFM footnotes with ordering + backrefs
  │
  ▼
Arena<Hast>
  │
  ▼
JS: walkHandle (subscriptions → match buffer)
  │
  ▼
JS: visitor dispatch
  │
  ▼
satteri-ast::hast::hast_arena_to_html(arena)  OR  satteri-mdxjs::compile_hast_arena(arena)
  │
  ▼
Result (HTML string or JS module source)
```

---

## 9. Vendored pulldown-cmark

The crate at `crates/satteri-pulldown-cmark/` is a fork of pulldown-cmark with:

### Key Modifications

1. **Direct arena build** — `arena_build.rs` replaces Event-based output
2. **MDX extensions** — JSX element/expression scanning, ESM detection (~2524 lines)
3. **GFM autolink literal post-pass** — Bare URLs → Link nodes
4. **MDX mark-and-unravel post-pass** — Clean up MDX-only nodes
5. **Text merging** — Adjacent Text nodes merged during construction
6. **LineIndex integration** — O(1) amortized offset-to-position conversion
7. **Directive support** — Container, leaf, and text directives
8. **Definition list support** — `<dl>`, `<dt>`, `<dd>` mapping

### Important: Do Not Update to Match Upstream

The vendored fork intentionally diverges from upstream pulldown-cmark. Do not "update" it without explicit instruction.

---

## 10. Code Generation

`satteri-layout-codegen` reads `crates/satteri-layout-codegen/src/schema.rs` (the single source of truth) and generates:

### Generated Files

| File | Contents |
|------|----------|
| `generated/node_types.rs` | `MdastNodeType` / `HastNodeType` enums |
| `generated/walk_type_data.rs` | Walk serializers |
| `generated/assert_layouts.rs` | Compile-time layout assertions |
| `generated/layout.rs` | Arena header offsets |
| `generated/wire-constants.ts` | Op codes, field IDs, payload types |
| `generated/arena-layout.ts` | Arena header offsets (TS) |
| `generated/mdast/node-types.ts` | MDAST node type enum |
| `generated/hast/node-types.ts` | HAST node type enum |

### After Editing Schema

Run `pnpm codegen` and commit the result. CI fails if generated files are stale.

---

## 11. MDX Compilation Pipeline

```
MDX Source
  │
  ▼
satteri-pulldown-cmark::parse (MDX options enabled)
  │
  ▼
Arena<Mdast>
  │
  ▼
mdast_arena_to_hast_arena
  │
  ▼
Arena<Hast>
  │
  ▼
hast_util_to_oxc (HAST → OXC AST)
  │
  ▼
recma_document (wrap in document)
  │
  ▼
recma_jsx_rewrite (rewrite JSX to function calls)
  │
  ▼
build_jsx (JSX → function calls)
  │
  ▼
oxc codegen → JavaScript string
```

### Key MDXJS Functions

| Function | Purpose |
|----------|---------|
| `compile(source, options)` | Full pipeline |
| `compile_hast_arena(arena, options)` | From pre-built HAST arena |
| `simplify_plain_mdx_nodes(arena, ignore)` | Optimize static elements |
| `parse_expression_to_estree_json(source)` | Parse JS expression |
| `parse_esm_to_estree_json(source)` | Parse ESM |

---

## 12. NAPI Binding Architecture

### Handle-Based API

```
Arena<Mdast>  ←→  External<Mutex<Arena<Mdast>>>  ←→  MdastHandle (opaque JS object)
Arena<Hast>   ←→  External<Mutex<Arena<Hast>>>   ←→  HastHandle (opaque JS object)
```

- Arenas live in Rust memory
- JS receives opaque handles
- All operations lock the mutex, do work in Rust, return primitives or buffers
- No buffer copies unless caller explicitly serializes

### Two External Types

`MdastHandle` and `HastHandle` catch kind mismatches at runtime via NAPI External TypeId checks.

---

## 13. Plugin System (Rust)

### `Plugin` Trait

```rust
pub trait Plugin: Send + Sync {
    fn meta(&self) -> PluginMeta;
    fn init(&mut self) {}
    fn before(&mut self, arena: &Arena<Mdast>, ctx: &mut PluginContext) {}
    fn after(&mut self, arena: &Arena<Mdast>, ctx: &mut PluginContext) {}
    fn visit_heading(&mut self, node: &Heading, ctx: &mut PluginContext) -> VisitResult;
    fn visit_paragraph(&mut self, ...) -> VisitResult;
    // ... more visitors
    fn transform_root(&mut self, arena, ctx) -> Option<Arena<Mdast>> { None }
}
```

### `VisitResult` Enum

```rust
pub enum VisitResult {
    NoChange,           // No structural change
    Replace(NewNode),   // Replace this node
    Remove,             // Remove this node
}
```

### Plugin Runner

```
For each plugin:
  1. plugin.before(arena, ctx)
  2. Walk nodes by ID, dispatch to typed visitors
  3. Collect commands
  4. plugin.after(arena, ctx)
  5. If commands issued, rebuild arena
```

---

## 14. Key Design Principles

1. **Zero-copy where possible** — StringRef, flat arrays, `#[repr(C)]`
2. **Arena allocation** — No per-node heap allocation, cache-friendly layout
3. **Lazy materialization** — JS objects created on-demand
4. **Subscription-based walk** — Only visit nodes plugins care about
5. **Batch mutations** — Commands collected and applied in single rebuild
6. **Type safety** — Arena kind markers catch cross-kind misuse at compile time
7. **Sync-first API** — Return types narrow to sync when no async plugins
