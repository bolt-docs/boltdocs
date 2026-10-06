import type { ImgHTMLAttributes } from 'react'
import { useTheme } from '@bdocs/runtime'
import { cn } from '../../utils/cn'
import { resolvePublicAssetUrl } from '../../utils/path'
import { useConfig } from '@bdocs/runtime'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  theme?: 'light' | 'dark'
}

/**
 * A responsive image component that automatically supports dark and light theme
 * variations via the `theme` prop.
 *
 * A themed image renders only in its own theme, so it returns `null` rather than
 * an element the stylesheet has to hide — an element with a broken `src` in the
 * document is worse than no element.
 */
export function Image({ theme, className, src, alt, ...props }: ImageProps) {
  const { resolvedTheme } = useTheme()
  const config = useConfig()

  if (theme && theme !== resolvedTheme) {
    return null
  }

  return (
    <img
      className={cn('bdocs-image', className)}
      alt={alt ?? ''}
      {...props}
      src={
        typeof src === 'string' ? resolvePublicAssetUrl(src, config.base) : src
      }
    />
  )
}
