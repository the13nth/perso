import Link from "next/link";
import { Brain, Building2, Users, Globe2, Heart, BarChart3, Database, PieChart, BookOpen, Sparkles, Lightbulb, Zap, Target, Activity, TrendingUp, Shield, Workflow } from "lucide-react";

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
        <p className="text-xl md:text-2xl mb-12 max-w-3xl text-muted-foreground">
          Your intelligent automation platform that ingests multiple contexts to generate personalized actions, recommendations, and interfaces for businesses and individuals
        </p>
      </div>
      
      {/* Business Use Cases Section */}
      <div className="w-full max-w-7xl mb-16">
        <h2 className="text-3xl font-bold mb-8 text-primary">For Businesses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FeatureCard
            title="Workflow Automation"
            description="Automate complex business processes by analyzing documents, emails, and data to trigger intelligent actions"
            href="/chat"
            icon={<Workflow className="w-6 h-6" />}
            delay={1}
          />
          <FeatureCard
            title="Data-Driven Insights"
            description="Generate actionable business intelligence from multiple data sources with contextual recommendations"
            href="/insights"
            icon={<TrendingUp className="w-6 h-6" />}
            delay={2}
          />
          <FeatureCard
            title="Document Intelligence"
            description="Extract insights from contracts, reports, and communications to automate decision-making processes"
            href="/retrieval"
            icon={<Database className="w-6 h-6" />}
            delay={3}
          />
          <FeatureCard
            title="Custom Interfaces"
            description="Generate tailored dashboards and interfaces based on your business context and requirements"
            href="/embeddings"
            icon={<BarChart3 className="w-6 h-6" />}
            delay={4}
          />
        </div>
      </div>

      {/* Individual Use Cases Section */}
      <div className="w-full max-w-7xl mb-16">
        <h2 className="text-3xl font-bold mb-8 text-primary">For Individuals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FeatureCard
            title="Health & Fitness Agent"
            description="Track wellness metrics, analyze patterns, and receive personalized health recommendations based on your data"
            href="/retrieval"
            icon={<Activity className="w-6 h-6" />}
            delay={5}
          />
          <FeatureCard
            title="Mental Wellness Companion"
            description="Monitor mood patterns, stress levels, and mental health indicators with contextual support suggestions"
            href="/chat"
            icon={<Heart className="w-6 h-6" />}
            delay={6}
          />
          <FeatureCard
            title="Study & Research Assistant"
            description="Organize knowledge, generate study plans, and provide intelligent research assistance based on your learning goals"
            href="/structured_output"
            icon={<BookOpen className="w-6 h-6" />}
            delay={7}
          />
          <FeatureCard
            title="Personal Productivity Hub"
            description="Analyze your habits, optimize routines, and automate personal tasks with intelligent recommendations"
            href="/agents"
            icon={<Target className="w-6 h-6" />}
            delay={8}
          />
        </div>
      </div>

      {/* Core Capabilities Section */}
      <div className="w-full max-w-7xl mb-12">
        <h2 className="text-3xl font-bold mb-8 text-primary">Core Capabilities</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            title="Multi-Context Ingestion"
            description="Seamlessly integrate data from documents, APIs, sensors, and user interactions to build comprehensive context"
            href="/embeddings"
            icon={<Zap className="w-6 h-6" />}
            delay={9}
          />
          <FeatureCard
            title="Intelligent Action Generation"
            description="Automatically generate and execute actions based on contextual analysis and learned patterns"
            href="/agents"
            icon={<Sparkles className="w-6 h-6" />}
            delay={10}
          />
          <FeatureCard
            title="Adaptive Interfaces"
            description="Create dynamic, context-aware interfaces that evolve with your needs and preferences"
            href="/streaming"
            icon={<Brain className="w-6 h-6" />}
            delay={11}
          />
          <FeatureCard
            title="Privacy-First Design"
            description="Your data remains secure with local processing options and granular privacy controls"
            href="/chat"
            icon={<Shield className="w-6 h-6" />}
            delay={12}
          />
          <FeatureCard
            title="Contextual Recommendations"
            description="Receive personalized suggestions that consider your unique situation, goals, and constraints"
            href="/insights"
            icon={<Lightbulb className="w-6 h-6" />}
            delay={13}
          />
          <FeatureCard
            title="Cross-Domain Intelligence"
            description="Bridge insights across different areas of your life or business for holistic optimization"
            href="/retrieval"
            icon={<Users className="w-6 h-6" />}
            delay={14}
          />
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4 animate-fade-in-up">
        <p className="text-lg text-muted-foreground max-w-4xl">
          Ubumuntu means 'humanity towards others' in Kinyarwanda. Our platform embodies this philosophy by creating AI that understands your unique context—whether you're running a business or managing your personal life—and intelligently automates tasks, generates insights, and provides recommendations that truly serve your needs.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/retrieval"
            className="group bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105"
          >
            Start Your AI Agent
            <span className="inline-block transition-transform group-hover:translate-x-1 ml-2">
              →
            </span>
          </Link>
          <Link
            href="/embeddings"
            className="group border border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105"
          >
            Explore Capabilities
            <span className="inline-block transition-transform group-hover:translate-x-1 ml-2">
              →
            </span>
          </Link>
        </div>
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

