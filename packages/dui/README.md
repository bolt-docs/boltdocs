# @bdocs/dui

**Docs UI** — Terminal output utilities for Boltdocs and related tools.

A lightweight, zero-dependency (well, just `picocolors`) library for consistent terminal output across the Boltdocs ecosystem: boxes, colors, logging, lists, dividers, and more.

## Install

```bash
pnpm add @bdocs/dui
```

## Usage

### Logger

Consistent `[boltdocs]`-prefixed output with semantic log levels.

```ts
import { info, warn, error, success, debug } from '@bdocs/dui'

info('Starting build...')
success('Build completed!')
warn('Deprecated API used')
error('Failed to connect', err)
debug('Verbose trace')        // only shown with DEBUG or BOLTDOCS_DEBUG env
```

### Box

Flexible box builder with three border styles. Width adapts to terminal size by default.

```ts
import { box, double, single, round } from '@bdocs/dui'

// Generic builder
box(['Line 1', 'Line 2'], {
  title: 'Status',
  style: 'double',
})

// Shorthands
double('Title', ['Content'])
single('Title', ['Content'])
round('Title', ['Content'])
```

**Pre-built boxes** for common CLI scenarios:

```ts
import { devServer, previewServer, updateAvailable } from '@bdocs/dui'

// Dev server status
console.log(devServer('http://localhost:5173', null))

// Preview server status
console.log(previewServer('http://localhost:4173', 'http://192.168.1.5:4173'))

// Version update notification
console.log(updateAvailable('1.0.0', '2.0.0'))
```

### Lists

```ts
import { bullet, ordered, tasks } from '@bdocs/dui'

bullet(['Item A', 'Item B'])
// • Item A
// • Item B

ordered(['First', 'Second'])
// 1. First
// 2. Second

tasks([
  { label: 'Install', done: true },
  { label: 'Configure', done: false },
])
// ✔ Install
// ✘ Configure
```

### Divider

```ts
import { divider, dividerLog } from '@bdocs/dui'

divider()          // returns "──────..." (fits terminal)
divider('═', 30)   // returns "══════════════════════════"
dividerLog()       // prints directly
```

### Utilities

```ts
import { padCenter, padLeft, fitWidth, terminalWidth, stripAnsi, visibleLength } from '@bdocs/dui'

padCenter('hello', 11)     // "   hello   "
padLeft('hello', 8)        // "hello   "
fitWidth('hi', 5)          // "hi   "
terminalWidth()            // 80 (or actual terminal cols)
stripAnsi('\x1b[31mred\x1b[0m')  // "red"
visibleLength('\x1b[31mred\x1b[0m') // 3
```

### Colors

Wraps [picocolors](https://github.com/alexeyraspopov/picocolors) for direct access.

```ts
import { colors, colorMap } from '@bdocs/dui'

console.log(colors.red('Error text'))
console.log(colors.bold(colors.green('Success')))
colorMap['cyan']('Info')
```

## API Reference

### Logger

| Function | Prefix color | Stream | Env-gated |
|----------|-------------|--------|-----------|
| `info(msg)` | none | stdout | no |
| `warn(msg)` | yellow | stdout | no |
| `error(msg, err?)` | red | stderr | no |
| `success(msg)` | green | stdout | no |
| `debug(msg)` | dim | stdout | `DEBUG` or `BOLTDOCS_DEBUG` |

### Box

| Function | Returns | Description |
|----------|---------|-------------|
| `box(lines, opts?)` | string | Generic builder with `BoxOptions` |
| `double(title, lines)` | string | Double-lined box `╔═╗` |
| `single(title, lines)` | string | Single-lined box `┏━┓` |
| `round(title, lines)` | string | Rounded box `╭─╮` |
| `devServer(local, network)` | string | Dev server status box |
| `previewServer(local, network)` | string | Preview server status box |
| `updateAvailable(current, latest)` | string | Version update notification box |

**BoxOptions:**

```ts
interface BoxOptions {
  title?: string        // centered bold title
  width?: number        // default: responsive to terminal
  style?: 'single' | 'double' | 'round'
  padding?: number       // inner padding (default: 1)
}
```

### List

| Function | Returns | Description |
|----------|---------|-------------|
| `bullet(items, indent?)` | string | Unordered list with `•` |
| `ordered(items, start?)` | string | Numbered list |
| `tasks(items, indent?)` | string | Check/cross task list |

### Divider

| Function | Returns | Description |
|----------|---------|-------------|
| `divider(char?, len?)` | string | Gray horizontal line |
| `dividerLog(char?, len?)` | void | Prints divider directly |

### Utils

| Function | Returns | Description |
|----------|---------|-------------|
| `padCenter(s, w)` | string | Center-pads string to width |
| `padLeft(s, w)` | string | Right-pads string to width |
| `fitWidth(s, w)` | string | Pads or truncates to exact width |
| `terminalWidth()` | number | Terminal columns (falls back to 80) |
| `stripAnsi(s)` | string | Removes ANSI escape codes |
| `visibleLength(s)` | number | String length excluding ANSI codes |

## License

MIT
