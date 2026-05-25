import { useRef } from 'react'
import { useGSAPScroll } from './hooks/useGSAPScroll'
import { Grainient } from './grainient'
import { Link } from 'boltdocs/primitives'
import { Github } from './icons'

export const CTASection = () => {
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(contentRef, {
    animation: 'fade-up',
    delay: 0.2,
    duration: 0.8,
    intensity: 20,
  })

  return (
    <section className="relative overflow-hidden w-full h-[70dvh]">
      <Grainient
        className="-z-10"
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#B497CF"
        timeSpeed={0.25}
        colorBalance={0}
        warpStrength={1}
        warpFrequency={5}
        warpSpeed={2}
        warpAmplitude={50}
        blendAngle={0}
        blendSoftness={0.05}
        rotationAmount={500}
        noiseScale={2}
        grainAmount={0.1}
        grainScale={2}
        grainAnimated={false}
        contrast={1.5}
        gamma={1}
        saturation={1}
        centerX={0}
        centerY={0}
        zoom={0.9}
      />

      {/* CTA Content Area */}
      <div className="relative z-10 pt-20 pb-20 px-6 w-full h-full flex items-center">
        <div
          ref={contentRef}
          className="max-w-3xl mx-auto text-center opacity-0"
        >
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-white border-0 mb-6 leading-[1.2] tracking-tight">
              Start building your docs <br className="hidden md:block" />
              in seconds
            </h2>

            <p className="text-base md:text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed font-medium">
              Create beautiful, performant documentation with zero config. Join
              thousands of developers already using Boltdocs.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link
                href="/docs/guides"
                className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all duration-300 flex items-center justify-center border-0"
              >
                Get Started
              </Link>
              <Link
                href="https://github.com/jesusalcaladev/boltdocs"
                className="px-8 py-4 bg-white/5 backdrop-blur-md text-white font-bold rounded-full border border-white/20 hover:bg-white/10 hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Github /> GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
