# @bdocs/dui

**Docs UI** — Terminal output utilities for CLI tools.

A lightweight, zero-dependency (well, just `picocolors`) library for consistent terminal
output: boxes, colors, logging, lists, dividers, and more.
Built for the Boltdocs ecosystem but fully configurable for any tool.

## Install

```bash
pnpm add @bdocs/dui
```

## Configuration

Call `configure()` **once at your CLI entry point** to set your tool's identity.
All modules read from this config at call time, so it takes effect immediately.

```ts
import { configure } from '@bdocs/dui'

configure({
  prefix: 'mytool',                         // shown as [mytool] in every log
  devServerTitle: 'mytool dev server',      // title of the devServer() box
  previewServerTitle: 'mytool preview',     // title of the previewServer() box
  updateCommand: 'pnpm add mytool@latest',  // shown in updateAvailable()
})
```

**DuiConfig fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `prefix` | `string` | `'dui'` | Prefix in log lines, e.g. `[mytool]` |
| `devServerTitle` | `string` | `'dev server'` | Title of the dev-server box |
| `previewServerTitle` | `string` | `'preview server'` | Title of the preview-server box |
| `updateCommand` | `string` | `'npm install dui@latest'` | Update command in the notification box |

You can also read back the current config:

```ts
import { getConfig } from '@bdocs/dui'

const cfg = getConfig()
console.log(cfg.prefix) // 'mytool'
```

---

## Usage

### Logger

Consistent `[prefix]`-prefixed output with semantic log levels.

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

**Pre-built boxes** (titles and commands pulled from `configure()` at call time):

```ts
import { devServer, previewServer, updateAvailable } from '@bdocs/dui'

// Dev server status — uses devServerTitle from config
console.log(devServer('http://localhost:5173', null))

// Preview server status — uses previewServerTitle from config
console.log(previewServer('http://localhost:4173', 'http://192.168.1.5:4173'))

// Version update notification — uses updateCommand from config
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
import { padCenter, padRight, fitWidth, terminalWidth, stripAnsi, visibleLength } from '@bdocs/dui'

padCenter('hello', 11)                    // "   hello   "
padRight('hello', 8)                      // "hello   "
fitWidth('hi', 5)                         // "hi   "
terminalWidth()                           // 80 (or actual terminal cols)
stripAnsi('\x1b[31mred\x1b[0m')           // "red"
stripAnsi('\x1b]8;;https://x.com\x07a\x1b]8;;\x07') // "a" — OSC hyperlinks too
visibleLength('\x1b[31mred\x1b[0m')       // 3
```

### Colors

Wraps [picocolors](https://github.com/alexeyraspopov/picocolors) for direct access.

```ts
import { colors, colorMap } from '@bdocs/dui'

console.log(colors.red('Error text'))
console.log(colors.bold(colors.green('Success')))
colorMap['cyan']('Info')
```

---

## API Reference

### Configuration

| Function | Description |
|---|---|
| `configure(opts)` | Override one or more config values. Merges with existing config. |
| `getConfig()` | Returns a read-only snapshot of the current config. |

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
| `devServer(local, network)` | string | Dev server status box (title from config) |
| `previewServer(local, network)` | string | Preview server status box (title from config) |
| `updateAvailable(current, latest)` | string | Update notification (command from config) |

**BoxOptions:**

```ts
interface BoxOptions {
  title?: string        // bold title in top border
  width?: number        // default: responsive to terminal
  style?: 'single' | 'double' | 'round'
  padding?: number      // inner horizontal padding (default: 1)
}
```

### List

| Function | Returns | Description |
|----------|---------|-------------|
| `bullet(items)` | string | Unordered list with `•` |
| `ordered(items)` | string | Numbered list |
| `tasks(items)` | string | Check/cross task list |

### Divider

| Function | Returns | Description |
|----------|---------|-------------|
| `divider(char?, len?)` | string | Gray horizontal line |
| `dividerLog(char?, len?)` | void | Prints divider directly |

### Utils

| Function | Returns | Description |
|----------|---------|-------------|
| `padCenter(s, w)` | string | Center-pads string to visible width (ANSI-aware) |
| `padRight(s, w)` | string | Right-pads string to visible width (ANSI-aware) |
| `fitWidth(s, w)` | string | Pads to exact visible width (ANSI-aware) |
| `terminalWidth()` | number | Terminal columns (falls back to 80) |
| `stripAnsi(s)` | string | Removes all ANSI escape sequences (SGR + OSC + Fe) |
| `visibleLength(s)` | number | String length excluding ANSI codes |

## License

MIT
