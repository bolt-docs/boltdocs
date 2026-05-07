import { useRef, useState, useEffect } from 'react'

interface VideoProps {
  src?: string
  poster?: string
  alt?: string
  controls?: boolean
  preload?: string
  children?: React.ReactNode
  [key: string]: any
}

export function Video({
  src,
  poster,
  alt,
  children,
  controls,
  preload = 'metadata',
  ...rest
}: VideoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className="my-6 overflow-hidden rounded-xl border border-subtle"
    >
      {isVisible ? (
        <video
          className="block w-full h-auto"
          src={src}
          poster={poster}
          controls={true}
          preload={preload}
          playsInline
          {...rest}
        >
          {children}
          Your browser does not support the video tag.
        </video>
      ) : (
        <div
          className="aspect-video bg-surface animate-pulse"
          role="img"
          aria-label={alt || 'Video'}
        />
      )}
    </div>
  )
}
