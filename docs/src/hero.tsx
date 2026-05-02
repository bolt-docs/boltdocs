import { Button } from "boltdocs/client"
import { ArrowRight } from "lucide-react"
import Orb from "./orb"

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
            v2.6.2
          </span>
          <span className="text-sm font-bold text-text-main/60 group-hover:text-text-main transition-colors flex items-center gap-2">
            Available now!
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-text-main mb-8">
          The documentation engine <br className="hidden md:block" />
          <span className="bg-linear-to-r from-primary-400 via-purple-600 to-purple-200 bg-clip-text text-transparent">
            Modern
          </span>
        </h1>

        <p className="max-w-xl mx-auto text-sm md:text-lg text-text-main/70 mb-10">
          Boltdocs is a high-performance developer documentation, optimized for
          speed, and beautiful by design.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            href="/docs/guides/overview/introduction"
            iconPosition="right"
            icon={<ArrowRight className="size-4" />}
            rounded={"full"}
            className="bg-text-main text-bg-main hover:scale-105 transition-transform"
          >
            Get Started
          </Button>
        </div>

        <div className="mt-16 max-w-4xl mx-auto rounded-3xl overflow-hidden border border-white/5 bg-black/20 backdrop-blur-3xl shadow-2xl relative">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto aspect-video object-cover"
          >
            <source src="/boltdocs-video.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  )
}


