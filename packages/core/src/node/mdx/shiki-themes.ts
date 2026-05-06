import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'
import tokyoNight from '@shikijs/themes/tokyo-night'
import dracula from '@shikijs/themes/dracula'
import nord from '@shikijs/themes/nord'
import oneDarkPro from '@shikijs/themes/one-dark-pro'
import oneLight from '@shikijs/themes/one-light'

/**
 * Collection of bundled Shiki themes.
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
