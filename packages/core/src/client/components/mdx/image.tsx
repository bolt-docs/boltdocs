import { useTheme } from '../../app/theme-context'
import { cn } from '../../utils/cn'
import { Image as ImagePrimitive } from '../primitives/image'

export interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  theme?: 'light' | 'dark'
}

const Image = ({ src, alt, title, theme, className, ...props }: ImageProps) => {
  const { theme: themeContext } = useTheme()
  if (!src) return null
  if (theme !== themeContext) return null

  const caption = title || alt

  return (
    <figure className="my-6 sm:my-8 flex flex-col items-center justify-center group not-prose">
      <div className="relative w-full overflow-hidden rounded-lg sm:rounded-2xl border border-subtle bg-soft/30 transition-all duration-300 sm:max-w-[85%] lg:max-w-full">
        <ImagePrimitive
          src={src}
          alt={alt || ''}
          theme={theme}
          loading="lazy"
          decoding="async"
          className={cn(
            'w-full h-auto object-contain transition-transform duration-500 group-hover:scale-[1.01] my-0 rounded-md sm:rounded-xl block',
            className,
          )}
          {...props}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 sm:mt-3 text-center text-xs sm:text-sm text-muted font-medium select-none tracking-wide opacity-90 sm:opacity-80 group-hover:opacity-100 transition-opacity duration-300 px-2">
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
