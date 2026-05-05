import React from 'react'
import { Link } from 'boltdocs/client'
import { Flame, ArrowRight, Zap, Shield, Sparkles } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-main selection:bg-primary-500/30">
      {/* Hero Section */}
      <div className="relative pt-16 pb-24 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-purple-500/10 blur-[100px] rounded-full" />
        </div>

        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-badge mb-6 animate-fade-in">
            <Sparkles size={14} className="text-primary-500" />
            <span className="text-xs font-medium">New UI Customization Demo</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-black mb-6 custom-heading tracking-tighter">
            Boltdocs <br /> Glassmorphism
          </h1>
          
          <p className="text-lg md:text-xl text-muted max-w-xl mx-auto mb-10 leading-relaxed">
            A premium, high-performance documentation theme built with React and Tailwind CSS v4. Experience clarity like never before.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/docs/getting-started" 
              className="px-6 py-3 bg-primary-500 text-white rounded-full font-bold text-base flex items-center gap-2 hover:bg-primary-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary-500/20"
            >
              Get Started <ArrowRight size={18} />
            </Link>
            <Link 
              href="https://github.com/bolt-doc/boltdocs" 
              className="px-6 py-3 glass-callout !m-0 !py-3 rounded-full font-bold text-base flex items-center gap-2 hover:bg-white/10 transition-all border border-white/10"
            >
              GitHub Source
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Flame} 
            title="Blazing Fast" 
            description="Powered by Vite and Turborepo, your documentation loads and updates in milliseconds."
          />
          <FeatureCard 
            icon={Zap} 
            title="Modern Stack" 
            description="Built with React 19, Tailwind CSS v4, and MDX for the best developer experience."
          />
          <FeatureCard 
            icon={Shield} 
            title="Type Safe" 
            description="Full TypeScript support ensures your documentation is robust and maintainable."
          />
        </div>
      </div>

      {/* Glass Showcase */}
      <div className="container mx-auto px-6 py-16">
        <div className="glass-callout p-8 md:p-12 rounded-[2rem] relative overflow-hidden group">
           <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
             <div>
               <h2 className="text-3xl font-bold mb-4 text-body">Crystal Clear Aesthetics</h2>
               <p className="text-base text-muted mb-6 leading-relaxed">
                 Our glassmorphism theme uses advanced backdrop filters and multi-layered transparency to create a sense of depth and focus. 
               </p>
               <ul className="space-y-3">
                 {['Gaussian Blur', 'Selective Saturation', 'Vibrant Gradients', 'Micro-interactions'].map((item) => (
                   <li key={item} className="flex items-center gap-3 text-sm text-body font-medium">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                     {item}
                   </li>
                 ))}
               </ul>
             </div>
             <div className="relative">
                <div className="aspect-video bg-gradient-to-br from-primary-500/20 to-purple-500/20 rounded-2xl border border-white/10 backdrop-blur-3xl animate-pulse" />
                <div className="absolute inset-8 bg-white/5 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl flex items-center justify-center">
                   <div className="text-4xl font-black text-white/10 select-none">GLASS</div>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <div className="glass-callout !p-6 rounded-2xl group hover:-translate-y-1 transition-all duration-500 border border-white/10">
      <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
        <Icon className="text-primary-500" size={24} />
      </div>
      <h3 className="text-xl font-bold mb-2 text-body">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">
        {description}
      </p>
    </div>
  )
}
