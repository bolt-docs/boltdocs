import { Braces, Globe, Layers, LayoutPanelLeft, Zap } from "lucide-react";
import type { Feature as FeatureType } from "./list-features";

const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
    const icons = {
        Core: Layers,
        Integrations: Zap,
        CLI: Braces,
        UI: LayoutPanelLeft,
        API: Braces,
        Ecosystem: Globe,
    }
    const Icon = (icons as any)[category] || Layers
    return <Icon className={className} />
}

export function Feature({ feature }: { feature: FeatureType }) {
    return <div
        className="group flex flex-col px-4 pb-4 pt-3 rounded-xl bg-text-body/5 border border-text-body/10"
    >
        <h3 className="text-sm font-bold mt-2 mb-1.5 transition-colors">
            {feature.name}
        </h3>

        <p className="text-xs text-body/50 mb-4 line-clamp-2 leading-relaxed">
            {feature.description}
        </p>

        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                {/* Feature Type Badge */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-body/40 uppercase tracking-wider">
                    <CategoryIcon category={feature.category} className="size-2.5" />
                    {feature.category}
                </div>
            </div>

        </div>
    </div>
}