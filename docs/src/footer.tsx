import { useRef } from 'react'
import { Link } from 'boltdocs/primitives'
import { useGSAPScroll } from './hooks/useGSAPScroll'

export const Footer = () => {
  const topRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useGSAPScroll(topRef, {
    animation: 'fade-up',
    delay: 0.1,
    duration: 0.8,
    intensity: 20,
  })
  useGSAPScroll(titleRef, {
    animation: 'scale-up',
    delay: 0.2,
    duration: 1,
    intensity: 5,
  })

  return (
    <footer className="w-full bg-surface text-body px-6 md:px-12 pt-20 pb-10 mt-20 border-t border-white/5 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto w-full">
        {/* Top Section */}
        <div
          ref={topRef}
          className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20 opacity-0"
        >
          <h2 className="text-xl md:text-2xl font-medium tracking-tight">
            Experience documentation
          </h2>

          <div className="grid grid-cols-2 gap-x-20 gap-y-3 text-sm font-medium">
            <div className="flex flex-col gap-3">
              <Link
                href="/docs"
                className="hover:text-primary-500 transition-colors"
              >
                Documentation
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs/blob/main/CONTRIBUTING.md"
                className="hover:text-primary-500 transition-colors"
              >
                Contributing
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs/issues"
                className="hover:text-primary-500 transition-colors"
              >
                Issues
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="https://github.com/jesusalcaladev/boltdocs"
                className="hover:text-primary-500 transition-colors"
              >
                GitHub
              </Link>
              <Link
                href="/docs/api"
                className="hover:text-primary-500 transition-colors"
              >
                API Reference
              </Link>
              <Link
                href="/docs/changelog"
                className="hover:text-primary-500 transition-colors"
              >
                Changelog
              </Link>
            </div>
          </div>
        </div>

        {/* Giant Typography Section */}
        <div className="w-full flex justify-center items-center select-none overflow-hidden mb-12">
          <h1
            ref={titleRef}
            className="text-[15vw] leading-[0.8] font-black tracking-tighter text-body opacity-0"
          >
            Boltdocs
          </h1>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6 pt-6 border-t border-body/10">
          <div className="text-xl font-bold tracking-tight">boltdocs.</div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium opacity-70">
            <Link
              href="site:/about"
              className="hover:text-primary-500 transition-colors"
            >
              About Boltdocs
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
