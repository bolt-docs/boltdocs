---
name: core-docs
description: Guide and rules for writing, organizing, and maintaining the core documentation of Boltdocs. Use when asked to "update documentation", "add component docs", "document new features", or "fix outdated docs".
license: MIT
metadata:
  author: boltdocs-agentic-team
  version: "1.1"
---

# Core Documentation Guide (core-docs)

This skill provides guidelines and best practices for creating, updating, and structuring the documentation for **Boltdocs**. Use this skill to keep the user-facing documentation in sync with the codebase's architecture and schema changes.

---

## Directory Structure

All documentation resides in the `docs/` workspace, structured under `docs/docs/` with grouped subdirectories:

| Directory Path | Purpose | File Naming Convention |
| :--- | :--- | :--- |
| `docs/docs/(guides)/` | Broad concepts, architecture, configuration, and integrations. | Nested subfolders, numbered files (e.g., `1.overview/3.configuration.mdx`, `7.integrations/0.index.mdx`). |
| `docs/docs/(components)/` | High-level interactive MDX components (e.g., Banner, Card). | Prefixed numbering (e.g., `0.overview.mdx`, `17.banner.mdx`). |
| `docs/docs/(primitives)/` | Low-level unstyled UI primitives (e.g., PrimitiveTabs). | Prefixed numbering (e.g., `6.tabs.mdx`). |

---

## Documentation Sync Checklist

Before making documentation changes, always verify current exports and schemas in the core package:

1. **Verify Component Exports**:
   Check [packages/core/src/client/index.ts](file:///c:/Users/Admin/Project/boltdocs/packages/core/src/client/index.ts) to verify what MDX components and primitives are active and exported. If a component is removed from here, remove its documentation immediately.
2. **Verify Configuration Schema**:
   Check [packages/core/src/node/schema/config.ts](file:///c:/Users/Admin/Project/boltdocs/packages/core/src/node/schema/config.ts) to verify active schema definitions. If a property is added or removed from `ThemeConfigSchema` or `BoltdocsConfigSchema`, synchronize the API reference in `1.overview/3.configuration.mdx`.
3. **Verify Imports inside MDX**:
   Ensure MDX documentation pages import high-level helpers (like `Card`, `Note`, `Tip`, `Field`) from `'boltdocs/client'`:

   ```tsx
   import { Card, Cards, Note, Tip, Field } from 'boltdocs/client'
   ```

---

## Frontmatter Requirements

Every `.mdx` file must begin with consistent metadata frontmatter:

```markdown
---
title: "Component or Guide Title"
description: "A concise, active-voice summary of what this component or guide accomplishes."
---
```

---

## Formatting Guidelines

### 1. Documenting Props & API Fields

To maintain a premium, consistent visual aesthetic across all API documentation, follow these rules for different data types:

* **React Component Props (Tables)**: Always use the modern `<ComponentProps />` component. Do not use raw markdown tables for component props.
* **Standalone / Individual Props**: Use the `<Field>` component for standalone properties or legacy definitions where a full table is not needed.
* **Hook Return Values & Config Schemas**: Standard markdown tables are encouraged for documenting pure data objects, configuration files, and hook return values.

#### ComponentProps Example (Recommended for React Component tables)

```mdx
<ComponentProps
  props={[
    {
      name: "variant",
      type: "'primary' | 'secondary'",
      defaultValue: "'primary'",
      description: "The visual style of the button component."
    }
  ]}
/>
```

#### Field Example (For standalone/legacy fields)

```mdx
<Field name="disabled" type="boolean" defaultValue="false">
  Disables interaction and styling of the component when set to `true`.
</Field>
```

### 2. Code Block Annotations

Always specify the language and, when applicable, use annotations like `title="..."` for clean code tabs:

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'

export default defineConfig({
  theme: {
    title: 'My Workspace'
  }
})
```

### 3. Highlights & Callouts

Use `<Note>`, `<Tip>`, `<Warning>`, `<Danger>`, or `<Important>` components to direct focus to critical patterns:

```mdx
<Tip>
  Place custom styles in your main `index.css` file to override default theme tokens.
</Tip>
```

---

## Document Structure by Category

Each documentation category has a unique structure and specific sections that must be followed strictly:

### 1. Guides (`docs/docs/(guides)/`)

Guides explain conceptual overviews, setups, and workflows.

* **Structure**:
  1. **Introductory Concept**: Explanation of the feature and its importance.
  2. **Step-by-Step Walkthrough**: Practical sequential steps using ordered lists.
  3. **Implementation Examples**: Complete code examples using `title` parameters.
  4. **Pro-tips**: Highlight best practices using `<Tip>` and `<Note>`.
* **Example Guide Format**:

  ```markdown
  # Page Versioning
  
  Versioning allows you to maintain documentation for multiple versions of your software simultaneously.
  
  ## Setup Instructions
  
  1. Create a directory named after your version (e.g., `v1.0.0`) inside your `docs` folder.
  2. Map the version inside your `boltdocs.config.ts`.
  
  ## Code Example
  
  ```ts title="boltdocs.config.ts"
  export default defineConfig({
    versions: {
      defaultVersion: '2.0.0',
      versions: [{ label: 'v2', path: '2.0.0' }]
    }
  })
  ```

  ```

### 2. APIs (General Reference)

API documentation focuses on function signatures, configurations, schemas, and type-safety references.

* **Structure**:
  1. **API Schema Overview**: Explain what part of the framework this API governs.
  2. **Property Reference Table**: A markdown table describing the structure of parameters, types, and defaults.
  3. **Detailed Property Descriptions**: Utilizing `<Field>` components to go in-depth on complex props.
  4. **TypeScript Types**: Show real exported TS Interfaces for type completeness.
* **Example API Reference**:

  ```markdown
  ### Root Configuration Schema
  
  | Property | Type | Description |
  | :--- | :--- | :--- |
  | `siteUrl` | `string` | The absolute URL of your site. |
  
  <Field name="siteUrl" type="string" required>
    The absolute URL is used to build canonical URLs and generate your XML sitemap automatically.
  </Field>
  ```

### 3. Components (`docs/docs/(components)/` or `docs/docs/(primitives)/`)

Component docs focus on visual components that can be used in MDX files.

* **Structure**:
  1. **Component Import**: Clearly show how to import the component.
  2. **Visual Demo/Preview**: Show usage of the component in MDX, optionally using `<ComponentPreview>` for live components.
  3. **Properties List**: Document all acceptable props using `<ApiReference />` items.
  4. **Usage Scenarios**: Multiple examples (e.g., "Default Use", "Disabled State").
* **Example Component Reference**:

  ```markdown
  # Button
  
  An interactive button component with support for gradients and hover effects.
  
  ```tsx
  import { Button } from 'boltdocs/client'
  ```
  
  ### Properties
  
  <Field name="variant" type="'primary' | 'secondary'" defaultValue="'primary'">
    Determines the background and hover color patterns of the button.
  </Field>
  ```

### 4. Integrations (`docs/docs/(guides)/7.integrations/`)

Integrations focus on connecting third-party analytics, metrics, or scripts.

* **Structure**:
  1. **External Service Setup**: Quick guide on retrieving necessary tokens/IDs from the third-party service dashboard.
  2. **Configuration Block**: Show how to enable and configure the integration in `boltdocs.config.ts`.
  3. **Accessing Features**: Explain how the integration interacts with the client-side app (e.g. automatic page-view tracking).
* **Example Integration Reference**:

  ```markdown
  # Google Analytics 4 (GA4)
  
  Connect your documentation site to Google Analytics 4 to track visitors and interactions.
  
  ## Setup
  
  1. Create a GA4 property in the Google Analytics Console and copy your `Measurement ID` (`G-XXXXXXXXXX`).
  2. Enable the integration in your config:
  
  ```ts title="boltdocs.config.ts"
  export default defineConfig({
    integrations: {
      ga4: { measurementId: 'G-XXXXXXXXXX' }
    }
  })
  ```

  ```

### 5. Plugins (System Extensions)

Plugins document how to extend Boltdocs' build process, Markdown parsing, or asset injection.

* **Structure**:
  1. **Lifecycle Overview**: Explain what hooks the plugin leverages.
  2. **Declared Permissions**: List required plugin permissions (e.g. `mdx:remark`, `vite:config`).
  3. **Creating the Plugin**: Provide a complete code template on how to construct and export the plugin using `createPlugin`.
  4. **Activation**: Show how to wire it up in `boltdocs.config.ts`.
* **Example Plugin Reference**:

  ```markdown
  # Creating a custom MDX Plugin
  
  Plugins allow you to modify the MDX AST during compile-time using Remark or Rehype.
  
  ## Permissions Required
  
  - `mdx:remark`: Required to alter the markdown abstract syntax tree.
  
  ## Example Implementation
  
  ```ts title="plugins/my-plugin.ts"
  import { createPlugin } from 'boltdocs'
  
  export default createPlugin({
    name: 'custom-transform',
    permissions: ['mdx:remark'],
    remarkPlugins: [myRemarkPlugin]
  })
  ```

  ```

---

## Component Overview Registry

When a new MDX Component is added or documented, ensure it is added to the component card registry in `docs/docs/(components)/0.overview.mdx` using the standard `<Card>` format.

---

## Code Quality and Writing Style

* **Tone**: Professional, encouraging, clear, and developer-centric.

* **Precision**: Code blocks must reflect actual type exports and real-world implementations. Avoid placeholders.
* **Navigation**: Keep sidebar group folders clean and align file names with standard sequential numbers (e.g. `0.index.mdx` is always the category home).
