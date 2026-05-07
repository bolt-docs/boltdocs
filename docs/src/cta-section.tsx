import { useRef } from 'react'
import { Button } from 'boltdocs/client'
import { useGSAPScroll } from './hooks/useGSAPScroll'
import { Grainient } from './grainient'

export const CTASection = () => {
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(contentRef, {
    animation: 'fade-up',
    delay: 0.2,
    duration: 0.8,
    intensity: 20,
  })

  return (
    <section className="relative overflow-hidden w-full">
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
      <div className="relative z-10 pt-20 pb-20 px-6">
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

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                rounded={'full'}
                size={'lg'}
                href="/docs/guides/overview/introduction"
                className="bg-white text-black "
              >
                Get Started
              </Button>
              <Button
                href="https://github.com/bolt-docs/boltdocs"
                icon={<GithubIcon />}
                rounded={'full'}
                size={'lg'}
                variant={'secondary'}
              >
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const GithubIcon = () => (
  <svg
    className="w-4 h-4 transition-transform group-hover:scale-110"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <title>Github</title>
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      clipRule="evenodd"
    />
  </svg>
)
