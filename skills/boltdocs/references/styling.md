# Styling & Theme Customization

Boltdocs is **100% CSS-Framework Agnostic** by design. You can use:

- **Vanilla CSS** and **CSS Modules** (zero-config core support)
- **Tailwind CSS v4** via `@bdocs/plugin-tailwindcss`
- **SASS/SCSS** via `@bdocs/plugin-sass`
- **UnoCSS** via `@bdocs/plugin-unocss`

## Vanilla CSS (Zero-Config Core Support)

Core natively supports standard `.css` files and `.module.css` scoped styling with zero configuration.

```tsx title="docs/layout.tsx"
import './style.css'

export default function Layout({ children }) {
  return <div className="docs-layout">{children}</div>
}
```

### CSS Modules

```css title="button.module.css"
.primaryButton {
  background-color: var(--bdocs-primary);
  color: #ffffff;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.primaryButton:hover {
  opacity: 0.9;
}
```

```tsx title="CustomButton.tsx"
import styles from './button.module.css'

export function CustomButton({ children }) {
  return <button className={styles.primaryButton}>{children}</button>
}
```

---

## Tailwind CSS v4

Add the `@bdocs/plugin-tailwindcss` plugin and `tailwindcss` dependency:

```bash
pnpm add -D @bdocs/plugin-tailwindcss tailwindcss
```

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

export default defineConfig({
  plugins: [
    tailwindcssPlugin(),
  ],
})
```

### Customizing Theme Tokens

Use a `@theme` block in your `index.css` or `global.css`:

```css
@import "tailwindcss";

@theme {
  /* Brand colors */
  --color-primary-50: #fef4f0;
  --color-primary-500: #eb5828;
  --color-primary-900: #5a1503;

  /* Font families */
  --font-sans: "Inter", sans-serif;
  --font-mono: "Fira Code", monospace;

  /* Layout spacing */
  --spacing-sidebar: 18rem;
  --spacing-content-max: 60rem;
}
```

---

## SASS / SCSS

Add the `@bdocs/plugin-sass` plugin and `sass-embedded` dependency:

```bash
pnpm add -D @bdocs/plugin-sass sass-embedded
```

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import sassPlugin from '@bdocs/plugin-sass'

export default defineConfig({
  plugins: [
    sassPlugin({
      additionalData: '@import "variables";',   // Injected into every SCSS file
      api: 'modern',                             // 'modern' | 'legacy'
      includePaths: ['./src/styles'],            // Additional import paths
    }),
  ],
})
```

Then import `.scss` or `.sass` files normally in your components:

```scss title="styles/card.module.scss"
.card {
  background: var(--bdocs-bg-secondary);
  border: 1px solid var(--bdocs-border);
}
```

---

## UnoCSS

Add the `@bdocs/plugin-unocss` plugin and `unocss` dependency:

```bash
pnpm add -D @bdocs/plugin-unocss unocss
```

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import unocssPlugin from '@bdocs/plugin-unocss'

export default defineConfig({
  plugins: [
    unocssPlugin({
      configFile: './uno.config.ts',
    }),
  ],
})
```

Create `uno.config.ts` in your project root:

```ts title="uno.config.ts"
import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
})
```

---

## Semantic Color Tokens

Boltdocs relies on semantic CSS variables for consistent theming:

| Variable | Purpose |
| ---------- | --------- |
| `--color-main` | Primary background |
| `--color-surface` | Card/panel backgrounds |
| `--color-soft` | Container/tab backgrounds |
| `--color-body` | Primary text color |
| `--color-paragraph` | Muted paragraph text |
| `--color-muted` | Helper/muted text |
| `--color-strong` | Strong borders |

### Dark Mode Overrides

Configure dark mode inside `:root[data-theme="dark"]` or `:root.dark`:

```css
:root[data-theme="dark"],
:root.dark {
  --color-main: #141413;
  --color-surface: #1e1e1d;
  --color-body: #f3f3f2;
  --color-paragraph: #d5d5d3;
  --color-strong: #3c3c39;
}
```

---

## Primitive State Styling (data-attributes)

All Boltdocs **primitives** (`Sidebar`, `OnThisPage`, `Navbar`, `Tabs`, `Menu`, …) are **style-neutral**: they render semantic structure and behavior, and expose their **state through `data-*` attributes that are present only when true**. Every visual decision (colors, borders, sizes, transitions) belongs to the site theme via CSS — never bake visuals into a primitive.

| Primitive | State attributes | Notes |
| --------- | --------------- | ----- |
| `Sidebar` | `data-active`, `data-open`, `data-collapsible`, `data-depth`, `data-badge` (+ `aria-current`, `aria-expanded`) | Active link, open groups, depth for indentation, badge text |
| `OnThisPage` | `data-active`, `data-level`, `data-otp-root/content/list/fade/indicator` (+ `aria-current`) | Active heading, level for indentation |
| `Navbar` | `data-open` (mobile drawer, more menu) (+ `aria-expanded`) | `Navbar.Link` has no `data-active` — compute active state in the theme via `useLocalizedTo`/`useLocation` |
| `Tabs` | `data-selected` (+ `aria-selected`) | Style with `data-[selected=true]:` |

Style states with Tailwind v4 variants or plain CSS:

```tsx
// Sidebar.Link — style the active state from your theme
<Sidebar.Link className="data-active:bg-primary-500/10 data-active:text-primary-400" />
```

```css
a[data-active] {
  color: var(--color-primary-500);
  background: color-mix(in oklab, var(--color-primary-500) 10%, transparent);
}
```

Key rules:

- `data-*` attributes are a **stable, documented contract** — theme CSS must not depend on framework-generated class names.
- Attribute **presence** is the state: `[data-active]` (not `[data-active='true']`), except `data-selected`/`data-level` where the **value** matters (`data-[level=3]:pl-3`, `data-[selected=true]:`).
- Defaults from the framework (`ui-base/`) are just the framework's own theme and are fully overridable via `className` slots (`itemClassName`, `linkClassName`, `indicatorClassName`, `fadeClassName`, `contentClassName` where the slot repeats per item).
- RAC-wrapped primitives (Button, Menu, Popover, Tooltip, SearchDialog) additionally pass `isPressed/isHovered/isFocused/isSelected/...` through a render-function `className` and emit their own `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-entering`, `data-exiting`, `data-placement` attributes.

---

## Custom CSS Variants & Biome Compatibility

When writing custom Tailwind v4 variants, **avoid the multiline parentheses shortcut syntax** as it is incompatible with Biome's CSS formatter:

```css
/* ❌ AVOID: Will cause Biome CSS parser errors */
@variant dark
(
&:where(.dark, .dark *));

/* ✅ CORRECT: Standard Tailwind v4 nesting syntax */
@custom-variant dark {
  &:where(.dark, .dark *) {
    @slot;
  }
}
```
