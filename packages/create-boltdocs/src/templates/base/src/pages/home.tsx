import { Card, Cards } from 'boltdocs/client'
import { Route, FileText, Settings, Sparkles } from 'lucide-react'

const features = [
    {
        title: "File-route",
        description: "Generate routes from file structure.",
        Icon: Route
    },
    {
        title: "Markdown",
        description: "Support Markdown for writing documentation.",
        Icon: FileText
    },
    {
        title: "Customizable",
        description: "Customizable to your needs.",
        Icon: Settings
    },
    {
        title: "Secure by design",
        description: "Boltdocs is secure by design.",
        Icon: Sparkles
    }
]

export function HomePage() {
    return (
        <div className='w-full h-[calc(100vh-120px)] flex items-center gap-10'>
            <div className="flex flex-col justify-center py-10">
                <h1 className="text-5xl font-extrabold">Power by <p className="text-purple-500 inline">Boltdocs</p></h1>
                <p className="text-xl mt-4 text-muted">Docs generators for react.</p>
            </div>
            <Cards cols={4}>
                {features.map((feature) => (
                    <Card key={feature.title} title={feature.title} icon={<feature.Icon />}>
                        {feature.description}
                    </Card>
                ))}
            </Cards>
        </div>
    )
}