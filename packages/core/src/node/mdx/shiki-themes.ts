import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'

/**
 * Collection of bundled Shiki themes.
 * Reduced to only the 2 default themes (github-light, github-dark) to save
 * ~300KB from the app bundle. Users who need additional themes can configure
 * them via the `theme.codeTheme` option, which currently supports:
 * github-dark, github-light, tokyo-night, dracula, nord, one-dark-pro, one-light.
 * To add more themes, re-import them here and add to THEMES_BUILD.
 */
export const THEMES_BUILD: any[] = [
  (githubLight as any).default || githubLight,
  (githubDark as any).default || githubDark,
]

export const THEMES_DEFAULT = {
  light: 'github-light',
  dark: 'github-dark',
}
