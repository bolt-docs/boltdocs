import dracula from './themes/dracula.mjs'
import githubDark from './themes/github-dark.mjs'
import githubLight from './themes/github-light.mjs'
import nord from './themes/nord.mjs'
import oneDarkPro from './themes/one-dark-pro.mjs'
import oneLight from './themes/one-light.mjs'
import tokyoNight from './themes/tokyo-night.mjs'

/**
 * Themes bundled with the framework.
 *
 * These are vendored from `@shikijs/themes` rather than imported from it. That
 * package ships 66 themes for 1.8 MB installed; the seven registered below cost
 * 196 KB. Vendoring keeps every theme the documentation promises while dropping
 * the other 59.
 *
 * All seven are registered, not just the two defaults. Registering only
 * `github-light` and `github-dark` meant `theme.codeTheme: 'dracula'` — a value
 * the type accepts and the previous comment here documented as supported —
 * reached Shiki unloaded and threw `Theme 'dracula' not found`, failing the
 * build. `themes.test.ts` now covers each name.
 *
 * To add a theme, drop its definition in `./themes` and add it here. Themes from
 * the upstream project carry no attribution requirement beyond its license.
 */
export const THEMES_BUILD: any[] = [
  (githubLight as any).default || githubLight,
  (githubDark as any).default || githubDark,
  (tokyoNight as any).default || tokyoNight,
  (dracula as any).default || dracula,
  (nord as any).default || nord,
  (oneDarkPro as any).default || oneDarkPro,
  (oneLight as any).default || oneLight,
]

export const THEMES_DEFAULT = {
  light: 'github-light',
  dark: 'github-dark',
}

/**
 * Theme names accepted by `theme.codeTheme`.
 *
 * `CodeTheme` is an open string, so this list is advisory rather than
 * enforced by the type. Shiki throws on a name it has not loaded, which
 * surfaces as a build failure — worth the extra tests over a compile error.
 */
export const THEMES_SUPPORTED = [
  'github-light',
  'github-dark',
  'tokyo-night',
  'dracula',
  'nord',
  'one-dark-pro',
  'one-light',
] as const

export type SupportedCodeTheme = (typeof THEMES_SUPPORTED)[number]
