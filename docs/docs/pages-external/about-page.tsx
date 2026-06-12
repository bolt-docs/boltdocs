import { cn } from 'boltdocs/client'
import { Link } from 'boltdocs/primitives'
import { useRef } from 'react'
import { useGSAPStaggerIn } from '../../src/hooks/useGSAPScroll'
import { Github } from '../../src/icons'
import { NoiseOverlay } from '../../src/noise-overlay'

export default function AboutPage() {
  const contentRef = useRef<HTMLDivElement>(null)

  // Apply a clean, minimalist vertical fade-up stagger on all child paragraphs/headers
  useGSAPStaggerIn(contentRef, { stagger: 0.04, duration: 0.3, y: 8 })

  return (
    <div className="font-sans antialiased min-h-screen bg-main text-body flex flex-col justify-start relative">
      <NoiseOverlay />
      <div className="max-w-2xl mx-auto px-6 py-28 md:py-36 w-full flex-grow">
        <div ref={contentRef} className="flex flex-col gap-10">
          {/* Header Metadata */}
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-primary-400 block mb-3">
              About the project
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-body tracking-tight leading-tight">
              Boltdocs
            </h1>
            <div className="w-full h-px bg-white/10 mt-8" />
          </div>

          {/* Section: Our Mission */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              Our Mission
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Writing documentation is often treated as an afterthought because
              the tools to build it are either too complex, too slow, or
              visually unappealing by default. We created Boltdocs to provide a
              zero-configuration, edge-ready, and highly customizable engine
              that teams actually enjoy using.
            </p>
          </div>

          {/* Section: Open Source */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              Open Source
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Boltdocs is proudly open source under the MIT License. We believe
              the best tools are built collaboratively, and we welcome
              contributions from developers all around the world.
            </p>
          </div>

          {/* Section: The Developer */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-body">
              The Developer
            </h2>
            <p className="text-body/75 leading-relaxed text-base md:text-lg">
              Boltdocs is built and maintained by{' '}
              <strong className="text-body font-bold">Jesus Alcala</strong>.
              Passionate about enhancing developer productivity, Jesus created
              Boltdocs to solve common documentation pain points and deliver a
              superior writing experience.
            </p>

            <div className="pt-3">
              <Link
                href="https://github.com/jesusalcaladev"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-body font-bold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer text-sm"
              >
                <Github className="w-4.5 h-4.5" /> Follow @jesusalcaladev on
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
