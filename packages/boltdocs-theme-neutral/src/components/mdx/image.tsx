import { useTheme } from '@bdocs/runtime'
import { cn } from '@bdocs/ui-base'
import { Image as ImagePrimitive } from '@bdocs/ui-base/composition'

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  theme?: 'light' | 'dark'
  figureClassName?: string
  figureInnerClassName?: string
  figcaptionClassName?: string
}

const Image = ({
  src,
  alt,
  title,
  theme,
  className,
  figureClassName,
  figureInnerClassName,
  figcaptionClassName,
  ...props
}: ImageProps) => {
  const { theme: themeContext } = useTheme()
  if (!src) return null
  if (theme !== themeContext) return null

  const caption = title || alt

  return (
    <figure className={cn('bdocs-figure', figureClassName)}>
      <div className={cn('bdocs-figure__frame', figureInnerClassName)}>
        <ImagePrimitive
          src={src}
          alt={alt || ''}
          theme={theme}
          loading="lazy"
          decoding="async"
          className={cn('bdocs-figure__image', className)}
          {...props}
        />
      </div>
      {caption && (
        <figcaption
          className={cn('bdocs-figure__caption', figcaptionClassName)}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export const ImageComponents = {
  img: Image,
  Image,
}
