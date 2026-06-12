---
name: dui
description: Terminal UI library for Node.js (@bdocs/dui). Use when the project imports from '@bdocs/dui' or when building CLIs with colored output, boxes, tables, spinners, progress bars, interactive prompts, etc.
version: 0.2.0

---

# DUI — Terminal UI Library for Node.js

`@bdocs/dui` is a **zero-dependency** (except `string-width`) library for building rich CLI output. It supports ANSI true-color, bordered boxes, tables, animated spinners, progress bars, interactive prompts, and more.

**Tech stack:** TypeScript, ESM only, Vitest, tsdown, Biome, Turborepo, pnpm.

## Installation

```bash
pnpm add @bdocs/dui
# or
npm install @bdocs/dui
# or
yarn add @bdocs/dui
```

## Imports

All modules are imported from `@bdocs/dui`:

```typescript
import {
  configure, colors, box, table, spinner, input, select,
  info, warn, error, success, debug, createLogger,
  bullet, ordered, tasks, steps, divider, confirm,
  multiselect, tree, animate, createProgressBar,
  stripAnsi, visibleLength, wrapAnsiWord, renderLine,
  renderStatic, terminalWidth, formatLog
} from '@bdocs/dui'
```

## Global configuration

```typescript
import { configure, getConfig, resetConfig } from '@bdocs/dui'

// Call once at CLI entry point
configure({
  prefix: 'my-tool',  // default: 'dui'
  theme: { /* DuiTheme optional */ }
})
```

## Color system

### Chainable API (chalk-like)

```typescript
import { colors } from '@bdocs/dui'

colors.red('text')
colors.bold.underline.blue('important')
colors.bgYellow.black('warning')
colors.dim('secondary')
colors.green.bold('✓ success')

// Available colors:
// fg: black, red, green, yellow, blue, magenta, cyan, white, gray
//      bright-red, bright-green, bright-yellow, bright-blue
//      bright-magenta, bright-cyan, bright-white
// bg: bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite, bgGray
//      bgBright-red, bgBright-green, bgBright-yellow, bgBright-blue
//      bgBright-magenta, bgBright-cyan, bgBright-white
// styles: bold, dim, italic, underline, inverse, hidden, strikethrough
```

### Direct color by name

```typescript
import { colorMap } from '@bdocs/dui'

colorMap.red('error')
colorMap.green('ok')
```

### True-color (hex, rgb, oklch)

```typescript
import { colorize, parseColor, interpolateColor, applyStyle } from '@bdocs/dui'

colorize('hello', '#ff6600', 'fg')        // foreground
colorize('hello', '#ff6600', 'bg')        // background

applyStyle('text', '#ff6600', '#1a1a2e', ['bold', 'underline'])

parseColor('#ff6600')       // → { r: 255, g: 102, b: 0 }
parseColor('rgb(255, 102, 0)')
parseColor('oklch(0.6 0.15 30)')

interpolateColor('#ff0000', '#0000ff', 0.5)  // → halfway color
```

### Raw ANSI sequences

```typescript
import { toAnsiFg, toAnsiBg, toAnsiFgBg } from '@bdocs/dui'

toAnsiFg('#ff6600')   // → '\x1b[38;2;255;102;0m'
toAnsiBg('#1a1a2e')   // → '\x1b[48;2;26;26;46m'
```

### Color control

```typescript
import { isColorSupported, setColorSupported } from '@bdocs/dui'

isColorSupported  // boolean, respects NO_COLOR and TTY
setColorSupported(false)  // force disable (useful in tests)
```

## Semantic logger

```typescript
import { info, warn, error, success, debug } from '@bdocs/dui'

info('Processing files...')
success('Operation completed!')
warn('Deprecated: use the new API')
error('File not found', err)  // err is logged after
debug('Value of x:', { color: { fg: '#888' } })  // only with DEBUG or BOLTDOCS_DEBUG env

// With per-call color override
success('Done', { color: '#00ff00' })
```

### Custom prefix logger

```typescript
import { createLogger } from '@bdocs/dui'

const log = createLogger('build')
log.info('Compiling...')
log.error('Failed')
```

## Box (bordered boxes)

Three styles: `"single"` (┏━┓), `"double"` (╔═╗), `"round"` (╭─╮).

```typescript
import { box, double, single, round } from '@bdocs/dui'

// Basic usage
console.log(double(['Line 1', 'Line 2']))

// With title and options
console.log(single(['Content'], {
  title: 'Title',
  padding: 2,
  color: '#ff6600',
  colors: {
    border: '#888',
    title: { fg: '#fff', bg: '#ff6600' },
  }
}))

// Responsive: uses terminalWidth() capped at 80
const result = round(['Text with auto word-wrap'])
```

## Divider

```typescript
import { divider, dividerLog } from '@bdocs/dui'

divider()                    // → '────' (up to 72 chars or terminalWidth)
divider('═', 40)             // 40 chars of ═
divider('─', 30, { color: '#888' })  // with color
dividerLog()                 // prints directly
```

## Lists

```typescript
import { bullet, ordered, tasks } from '@bdocs/dui'

// Bullet list
console.log(bullet(['First', 'Second', 'Third']))
//   • First
//   • Second

// Ordered list
console.log(ordered(['Step 1', 'Step 2']))
//   1. Step 1
//   2. Step 2

// Task list (checklist)
console.log(tasks([
  { label: 'Install dependencies', done: true },
  { label: 'Configure ESLint', done: false },
]))
//   ✔ Install dependencies
//   ✘ Configure ESLint

// With custom colors
bullet(['Item'], { colors: { bullet: '#ff6600' } })
```

## Table

```typescript
import { table } from '@bdocs/dui'

const headers = ['Name', 'Age', 'City']
const rows = [
  ['Alice', '28', 'Madrid'],
  ['Bob', '35', 'Barcelona'],
]

console.log(table(headers, rows))
// ┏━━━━━━━━┳━━━━━━┳━━━━━━━━━━┓
// ┃ Name   ┃ Age  ┃ City     ┃
// ┣━━━━━━━━╋━━━━━━╋━━━━━━━━━━┫
// ┃ Alice  ┃ 28   ┃ Madrid   ┃
// ┃ Bob    ┃ 35   ┃ Barcelona┃
// ┗━━━━━━━━┻━━━━━━┻━━━━━━━━━━┛

// With options
console.log(table(headers, rows, {
  style: 'double',         // 'single' | 'double' | 'round' | 'none'
  headerSeparator: true,
  padding: 2,
  columns: {
    0: { align: 'left' },
    1: { align: 'center' },
    2: { align: 'right' },
  },
  colors: {
    header: { fg: '#fff', bg: '#333' },
    border: '#888',
  },
}))
```

## Animated spinner

```typescript
import { createSpinner } from '@bdocs/dui'

const spinner = createSpinner('Downloading...')

spinner.start()

// Update message
spinner.update('Processing...')

// Stop with status
spinner.stop('success', 'Download complete!')
spinner.stop('fail', 'Connection error')
spinner.stop('warn', 'Warning')
spinner.stop('info', 'Information')

// With options
const s = createSpinner('Loading', {
  prefix: 'build',
  frames: ['◜', '◝', '◞', '◟'],  // custom frames
  colors: { frame: '#ff6600', success: '#00ff00' }
})

// TTY: inline animation with cursor hidden
// non-TTY: shows "... " static
```

## Progress Bar

```typescript
import { createProgressBar } from '@bdocs/dui'

const bar = createProgressBar({
  width: 30,           // bar width
  barChar: '█',
  emptyChar: '░',
  prefix: '[build]',
  suffix: 'files',
})

bar.start(100)          // optional total (default 100)
bar.update(50, 'Compiling...')  // current, optional message
bar.update(100)
bar.stop('Done!')      // optional final message

// TTY: renders inline with updates every 100ms
// non-TTY: prints one line per update
```

## Animation engine (keyframes)

```typescript
import { animate, lerp } from '@bdocs/dui'

const anim = animate({
  keyframes: [
    { offset: 0, content: '⠋', fg: '#ff0000' },
    { offset: 0.5, content: '⠙', fg: '#00ff00' },
    { offset: 1, content: '⠹', fg: '#0000ff' },
  ],
  duration: 1000,
  loop: true,
  easing: 'ease-in-out',  // 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | ((t) => t)
  onFrame: (frame) => {
    console.log(frame.content, frame.fg, frame.bg)
  },
})

// Stop
anim.stop()

// Completion callback (non-looping only)
anim.then(() => console.log('Animation done'))

// Lerp for number interpolation
lerp(0, 100, 0.5) // → 50
```

## Interactive prompts

### Confirm

```typescript
import { confirm } from '@bdocs/dui'

const answer = await confirm('Do you want to continue?')
// → [dui] Do you want to continue? (Y/n):
// default = true → "(Y/n)", default = false → "(y/N)"
// SIGINT → resolves with default

const yes = await confirm('Are you sure?', true)  // default true
const no = await confirm('Are you sure?', false) // default false
```

### Input

```typescript
import { input } from '@bdocs/dui'

const name = await input('What is your name?')
const email = await input('Email', {
  default: 'user@example.com',
  placeholder: 'your@email.com',
  validate: (v) => v.includes('@') ? true : 'Invalid email',
  colors: {
    message: '#ff0',
    value: '#fff',
    placeholder: { fg: '#888' },
    error: '#f00',
  }
})
// Shortcuts: ← → home end, backspace delete, Ctrl+U clear line, Ctrl+K delete to end
// Escape → reject with Error, Ctrl+C → process.exit(1)
// Non-TTY → uses readline.question with validation
```

### Select

```typescript
import { select } from '@bdocs/dui'

const color = await select('Pick a color', {
  choices: [
    { label: 'Red', value: '#ff0000' },
    { label: 'Green', value: '#00ff00' },
    { label: 'Blue (disabled)', value: '#0000ff', disabled: true },
  ],
  pageSize: 5,  // visible items before scroll
  colors: {
    pointer: '#0ff',
    selected: '#0ff',
    label: '#fff',
    message: '#ff0',
  }
})
// ↑↓ navigate, Enter select, Escape → reject, Ctrl+C → exit
// Non-TTY → numbered list, input by number
```

### Multiselect

```typescript
import { multiselect } from '@bdocs/dui'

const selected = await multiselect('Which options?', {
  choices: [
    { label: 'Option A', value: 'a', checked: true },
    { label: 'Option B', value: 'b' },
    { label: 'Option C (disabled)', value: 'c', disabled: true },
  ],
  pageSize: 10,
  required: true,  // prevents empty submit
  colors: {
    pointer: '#0ff',
    selected: '#0ff',
    checked: '#0f0',
    label: '#fff',
    message: '#ff0',
  }
})
// Space: toggle, Enter: confirm, required prevents empty submission
```

### Tree

```typescript
import { tree } from '@bdocs/dui'

const result = await tree('Navigate and select', {
  tree: [
    {
      label: 'src',
      children: [
        {
          label: 'components',
          children: [
            { label: 'Button.tsx', value: 'src/components/Button.tsx' },
            { label: 'Input.tsx (disabled)', value: '', disabled: true },
          ]
        },
        { label: 'utils.ts', value: 'src/utils.ts' },
      ]
    },
    { label: 'README.md', value: 'README.md' },
  ],
  pageSize: 10,
  initialExpanded: true,  // expand all initially
  colors: {
    pointer: '#0ff',
    selected: '#0ff',
    label: '#fff',
    message: '#ff0',
    branch: '#888',
  }
})
// ← → expand/collapse, ← on leaf → collapse ancestor, Enter select leaf
// Space: toggle expand, Escape → reject, Ctrl+C → exit
```

## Steps

```typescript
import { steps } from '@bdocs/dui'

console.log(steps([
  { label: 'Installing dependencies', status: 'success' },
  { label: 'Compiling...', status: 'running', details: 'src/index.ts → dist/' },
  { label: 'Running tests', status: 'pending' },
  { label: 'Publishing', status: 'error', details: 'Auth error' },
]))
//   ✔  Installing dependencies
//   │
//   ●  Compiling...
//   │  └─ src/index.ts → dist/
//   │
//   ○  Running tests
//   │
//   ✖  Publishing
//      └─ Auth error
```

## Text utilities

```typescript
import {
  stripAnsi, visibleLength, terminalWidth,
  padCenter, padRight, fitWidth,
  wrapAnsiWord, tokenizeAnsi,
  renderLine, renderStatic
} from '@bdocs/dui'

// Strip ANSI codes
stripAnsi('\x1b[31mHello\x1b[0m')  // → 'Hello'

// Visible length (without ANSI codes)
visibleLength('\x1b[31mHello\x1b[0m')  // → 5

// Terminal width
terminalWidth()  // → column count

// ANSI-safe padding
padCenter('hello', 10)    // '  hello   '
padRight('hello', 10)     // 'hello     '
fitWidth('hello', 10)     // 'hello     '

// ANSI-preserving word-wrap
wrapAnsiWord(text, 40)

// Tokenizer for ANSI (useful for custom wrap)
tokenizeAnsi(text)
// → [{ type: 'word' | 'space' | 'ansi' | 'newline', value, width }]

// Inline render (overwrites current line)
renderLine('Loading...')           // stdout
renderLine('Error!', process.stderr)  // stderr

// Final render (with newline)
renderStatic('Done!')
```

## Theme system

### Full DuiTheme

```typescript
import type { ColorStyle, DuiTheme } from '@bdocs/dui'

const theme: DuiTheme = {
  // Global colors (fallback for components)
  success: '#00ff00',
  error: '#ff0000',
  warning: '#ffff00',
  info: '#00ffff',
  muted: '#888888',
  accent: '#ff6600',

  // Logger
  logger: {
    info: '#888',
    warn: '#ff0',
    error: '#f00',
    success: '#0f0',
    debug: '#888',
  },

  // Box
  box: {
    border: '#888',
    title: { fg: '#fff', bg: '#333' },
    arrow: '#0f0',
    url: '#0ff',
    hint: '#888',
    label: '#fff',
    value: '#fff',
  },

  // Spinner
  spinner: {
    frame: '#0ff',
    success: '#0f0',
    fail: '#f00',
    warn: '#ff0',
    info: '#00f',
  },

  // Lists
  list: {
    bullet: '#888',
    number: '#888',
    check: '#0f0',
    cross: '#f00',
  },

  // Steps
  steps: {
    success: '#0f0',
    error: '#f00',
    running: '#0ff',
    pending: '#888',
    detail: '#888',
    connector: '#888',
  },

  // Divider
  divider: { line: '#888' },

  // Prompts
  prompt: { message: '#ff0', suffix: '#888' },
  input: {
    message: '#ff0',
    value: '#fff',
    placeholder: '#888',
    error: '#f00',
  },
  select: {
    pointer: '#0ff',
    selected: '#0ff',
    label: '#fff',
    message: '#ff0',
  },
  multiselect: {
    pointer: '#0ff',
    selected: '#0ff',
    checked: '#0f0',
    label: '#fff',
    message: '#ff0',
  },
  tree: {
    pointer: '#0ff',
    selected: '#0ff',
    label: '#fff',
    message: '#ff0',
    branch: '#888',
  },

  // Progress
  progress: { bar: '#0ff' },

  // Table
  table: { header: 'bold', border: '#888' },
}
```

### ColorStyle

```typescript
type ColorStyle = string | { fg?: string; bg?: string }
// string → foreground color (hex, rgb(), oklch())
// { fg: '#ff0', bg: '#333' } → foreground and background
```

### Color resolution order

The resolution order for a color slot is:
1. Override passed directly in the call (e.g. `info('msg', { color: '#f00' })`)
2. Component theme (e.g. `theme.logger.error`)
3. Global color (e.g. `theme.error`)
4. Slot default (e.g. `logger.error` → red)

## Best practices

### 1. Configure at startup

```typescript
import { configure } from '@bdocs/dui'

// In your CLI entry point
configure({
  prefix: 'my-cli',
  theme: myTheme,
})
```

### 2. TTY vs non-TTY detection

DUI handles TTY vs non-TTY automatically:
- **Spinner:** TTY → inline animation; non-TTY → static `...`
- **Progress:** TTY → inline update; non-TTY → new line per update
- **Prompts:** TTY → interactive raw mode; non-TTY → readline.question

### 3. Respect NO_COLOR

DUI respects `NO_COLOR` and disables colors if stdout is not TTY. Use `setColorSupported()` in tests to force.

### 4. Use themes for consistency

Define a global theme and avoid passing `colors` on every call. Use overrides only for exceptions.

### 5. Error handling in prompts

All prompts (`input`, `select`, `multiselect`, `tree`) reject with `Error('Cancelled')` on Escape. Handle with try/catch:

```typescript
try {
  const result = await select('Option:', { choices })
  // use result
} catch {
  // user cancelled
}
```

### 6. Use formatLog for manual logging

```typescript
import { formatLog } from '@bdocs/dui'

console.log(formatLog('custom message', 'info'))
console.log(formatLog('critical', 'error'))
```

### 7. Tests

Run tests:
```bash
pnpm --filter @bdocs/dui test
pnpm --filter @bdocs/dui test:coverage  # with coverage
```

Lint and format:
```bash
pnpm exec biome lint --write .
pnpm exec biome format --write .
```

### 8. Key project files

| Path | Purpose |
|---|---|
| `packages/dui/src/index.ts` | Barrel / Public API |
| `packages/dui/src/config.ts` | Global config (prefix, theme) |
| `packages/dui/src/color.ts` | ANSI color engine |
| `packages/dui/src/theme.ts` | Theme system |
| `packages/dui/src/logger.ts` | Semantic logger |
| `packages/dui/src/box.ts` | Bordered boxes |
| `packages/dui/src/table.ts` | Tables |
| `packages/dui/src/spinner.ts` | Animated spinner |
| `packages/dui/src/progress.ts` | Progress bar |
| `packages/dui/src/animation.ts` | Keyframe engine |
| `packages/dui/src/prompt.ts` | Confirm prompt |
| `packages/dui/src/input.ts` | Interactive input |
| `packages/dui/src/select.ts` | Interactive select |
| `packages/dui/src/multiselect.ts` | Interactive multiselect |
| `packages/dui/src/tree.ts` | Tree navigation |
| `packages/dui/src/steps.ts` | Step indicators |
| `packages/dui/src/utils.ts` | Utilities (wrap, strip, render) |
| `packages/dui/src/divider.ts` | Dividers |
