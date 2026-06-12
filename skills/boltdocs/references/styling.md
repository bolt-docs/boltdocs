# Styling & Custom CSS

Boltdocs uses **Tailwind CSS v4** to style layout items. If you want to customize colors, fonts, margins, or responsive behaviors, you can override theme tokens in your project's custom CSS stylesheets.

## Customizing Theme Tokens

You can adjust standard CSS variables inside a `@theme` block in your main stylesheet (e.g. `index.css` or `global.css`):

```css
@theme {
  /* Customize brand primary colors */
  --color-primary-50: #fef4f0;
  --color-primary-500: #eb5828; /* Core brand color */
  --color-primary-900: #5a1503;

  /* Customize font families */
  --font-sans: "Inter", sans-serif;
  --font-mono: "Fira Code", monospace;

  /* Customize container boundaries */
  --spacing-sidebar: 18rem;
  --spacing-content-max: 60rem;
}
```

---

## Semantic Color Mappings

Boltdocs relies on semantic color tokens to dynamically adjust theme structures between light and dark modes:

- `--color-main`: Primary background color (e.g. light parchment or deep warm black).
- `--color-surface`: Background color for cards, panels, and floating segments.
- `--color-soft`: Background color for containers and tabs.
- `--color-body`: Primary body text color.
- `--color-paragraph`: Muted paragraph text color.
- `--color-muted`: Muted helper text color.
- `--color-strong`: Color applied to strong borders.

### Dark Mode Color Overrides

Configure dark mode overrides under standard CSS dark theme class selectors:

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

## Custom CSS Variants & Biome Compatibility

If you are writing custom CSS rules and need to declare a custom theme variant, **avoid using the multiline parentheses shortcut syntax**, as it is incompatible with standard CSS formatters and will fail the workspace's Biome checks:

```css
/* ❌ AVOID: Will cause Biome CSS parser errors */
@variant dark 
(
&:where(.dark, .dark *));

/*  USE: Standard Tailwind v4 nesting syntax */
@custom-variant dark {
  &:where(.dark, .dark *) {
    @slot;
  }
}
```
