import { Codesandbox, GoogleAnalytics } from './icons-integrations'

const INTEGRATIONS = [
  { name: 'Google Analytics 4', icon: <GoogleAnalytics className="w-5 h-5" /> },
  { name: 'Codesandbox', icon: <Codesandbox className="size-7" /> },
]

export const Integrations = () => {
  return (
    <section className="py-24 overflow-hidden border-y border-white/5 dark:bg-black/20 relative">
      <div className="max-w-7xl mx-auto px-6 mb-12 relative z-20">
        <p className="text-center text-lg font-black dark:text-white/30">
          Engineered to Integrate with Industry Standards
        </p>
      </div>

      <div className="relative flex overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap gap-12 items-center py-4">
          {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center flex-col gap-2 px-4 py-4 opacity-70 transition-all group cursor-default"
            >
              <div className="group-hover:text-primary-400 transition-colors">
                {item.icon}
              </div>
              {/* <span className="dark:text-white/60 font-medium">
                {item.name}
              </span> */}
            </div>
          ))}
        </div>

        {/* Gradient overlays for smooth fade */}
        <div className="absolute inset-y-0 left-0 w-40 bg-linear-to-r from-bg-main to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-40 bg-linear-to-l from-bg-main to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  )
}

