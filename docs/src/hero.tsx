import { Link } from 'boltdocs/primitives'
import { ArrowRight } from 'lucide-react'
import { Grainient } from './grainient'
import { getVersion } from './data/version'

export const Hero = () => {
  return (
    <section className="relative py-20 px-6 w-full overflow-hidden min-h-[80dvh] flex items-center">
      <Grainient
        className="-z-10 inset-0"
        color1="#FF9FFC"
        color2="#5227FF"
        color3="#1a1a2e"
        animated={false}
        blendAngle={45}
        blendSoftness={0.15}
        noiseScale={3}
        zoom={0.8}
        grainAmount={0.05}
        contrast={1.3}
      />

      <div className="max-w-4xl mx-auto text-center relative z-10 w-full">
        <div className="inline-flex items-center gap-3 p-1 pr-4 rounded-full bg-neutral-950/70 border border-neutral-700 hover:border-primary-400/30 transition-all cursor-pointer group mb-10 backdrop-blur-sm">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-black bg-white">
            v{getVersion()}
          </span>
          <span className="text-sm font-bold text-white/70 group-hover:text-white transition-colors flex items-center gap-2">
            Available now!
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter mb-8 leading-tight drop-shadow-lg">
          The modern <br className="hidden md:block" />
          <span className="bg-linear-to-r from-white/90 via-white to-white/90 bg-clip-text text-transparent drop-shadow-sm">
            documentation engine
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base md:text-xl text-white/70 mb-10 leading-relaxed font-medium drop-shadow-sm">
          Building documentation for your project has never been easier. Create
          beautiful, highly customizable, and extremely fast sites out of the
          box.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/docs/guides"
            className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all duration-300 flex items-center justify-center border-0"
          >
            Get Started <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link
            href="/docs/api"
            className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-bold rounded-full border border-white/20 hover:bg-white/20 hover:scale-105 transition-all duration-300 flex items-center justify-center"
          >
            Read the API
          </Link>
        </div>
      </div>
    </section>
  )
}
