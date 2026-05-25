import { Link } from 'boltdocs/primitives'
import { ArrowRight } from 'lucide-react'
import Orb from './orb'
import { getVersion } from './data/version'

export const Hero = () => {
  return (
    <section className="relative py-20 px-6 w-full overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-400/20 via-bg-main to-bg-main" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]">
          <Orb hue={0} hoverIntensity={0.15} backgroundColor="#000000" />
        </div>
      </div>

      <div className="w-full mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-3 p-1 pr-4 rounded-full bg-white/5 border border-white/10 hover:border-primary-400/30 transition-all cursor-pointer group mb-10 backdrop-blur-sm">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-black bg-white">
            v{getVersion()}
          </span>
          <span className="text-sm font-bold text-body/60 group-hover:text-body transition-colors flex items-center gap-2">
            Available now!
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-body tracking-tighter mb-8 leading-tight">
          The modern <br className="hidden md:block" />
          <span className="bg-linear-to-r from-primary-400 via-primary-500 to-purple-500 bg-clip-text text-transparent drop-shadow-sm">
            documentation engine
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base md:text-xl text-body/70 mb-10 leading-relaxed font-medium">
          Building documentation for your project has never been easier. Create
          beautiful, highly customizable, and extremely fast sites out of the
          box.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/docs/guides"
            className="px-8 py-4 bg-primary-500 text-white font-bold rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(235,88,40,0.4)] transition-all duration-300 flex items-center justify-center border-0"
          >
            Get Started <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link
            href="/docs/api"
            className="px-8 py-4 bg-transparent backdrop-blur-md text-body font-bold rounded-full border border-white/10 hover:bg-white/5 hover:scale-105 transition-all duration-300 flex items-center justify-center"
          >
            Read the API
          </Link>
        </div>
      </div>
    </section>
  )
}
