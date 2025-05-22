import Link from "next/link";
import { Brain, Building2, Users, Globe2, Heart, BarChart3, Database, PieChart, BookOpen, Sparkles, Lightbulb } from "lucide-react";

// Imigongo-inspired pattern SVG component
function ImigongoPattern() {
  return (
    <div className="absolute inset-0 -z-10 opacity-10">
      <svg width="100%" height="100%" className="animate-[pulse_8s_ease-in-out_infinite]">
        <pattern id="imigongo" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 0L20 20L40 0L20 -20Z" fill="currentColor" />
          <path d="M0 40L20 20L40 40L20 60Z" fill="currentColor" />
          <path d="M-20 20L0 0L20 20L0 40Z" fill="currentColor" />
          <path d="M20 20L40 0L60 20L40 40Z" fill="currentColor" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#imigongo)" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 text-center overflow-hidden">
      <ImigongoPattern />
      
      <div className="animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
          Welcome to Ubumuntu AI
        </h1>
        <p className="text-xl md:text-2xl mb-12 max-w-2xl text-muted-foreground">
          Your context-aware personal and business assistant, integrating diverse knowledge sources with advanced visualization
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl w-full mb-12">
        <FeatureCard
          title="Interactive Visualization"
          description="Explore document embeddings through our interactive 3D visualization with multi-category filtering"
          href="/embeddings"
          icon={<BarChart3 className="w-6 h-6" />}
          delay={1}
        />
        <FeatureCard
          title="Contextual Intelligence"
          description="Personalized assistance that adapts to your unique context and needs"
          href="/chat"
          icon={<Sparkles className="w-6 h-6" />}
          delay={2}
        />
        <FeatureCard
          title="Community Knowledge"
          description="Tap into collective intelligence from diverse communities and cultural perspectives"
          href="/retrieval"
          icon={<Users className="w-6 h-6" />}
          delay={3}
        />
        <FeatureCard
          title="Traditional Wisdom"
          description="Access oral traditions and indigenous knowledge systems previously excluded from digital platforms"
          href="/chat"
          icon={<BookOpen className="w-6 h-6" />}
          delay={4}
        />
        <FeatureCard
          title="Cultural Understanding"
          description="Built on Ubuntu philosophy - 'I am because we are' - for deeper cultural relevance"
          href="/structured_output"
          icon={<Heart className="w-6 h-6" />}
          delay={5}
        />
        <FeatureCard
          title="Multi-Category Analysis"
          description="Analyze documents across business, education, health, technology and more with advanced filtering"
          href="/embeddings"
          icon={<PieChart className="w-6 h-6" />}
          delay={6}
        />
        <FeatureCard
          title="Category Insights"
          description="Generate AI-powered insights from your document embeddings organized by category"
          href="/insights"
          icon={<Lightbulb className="w-6 h-6" />}
          delay={7}
        />
      </div>

      <div className="flex flex-col items-center space-y-4 animate-fade-in-up">
        <p className="text-lg text-muted-foreground max-w-xl">
          Ubumuntu means 'humanity towards others' in Kinyarwanda. We're building AI that bridges traditional wisdom with modern technology to serve the global community.
        </p>
        <Link
          href="/embeddings"
          className="group bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105"
        >
          Explore Embeddings
          <span className="inline-block transition-transform group-hover:translate-x-1 ml-2">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  href,
  icon,
  delay,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <Link
      href={href}
      className="group p-6 border rounded-xl hover:border-primary transition-all duration-300 hover:scale-105 animate-fade-in-up"
      style={{ animationDelay: `${delay * 100}ms` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
          {title}
        </h3>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </Link>
  );
}

