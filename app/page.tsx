import Link from "next/link";
import { Brain, Users, Heart, BarChart3, Database, BookOpen, Sparkles, Lightbulb, Zap, Target, Activity, TrendingUp, Shield, Workflow, Check, Star, ArrowRight, Play, Cpu, Network, Bot } from "lucide-react";

// Animated background pattern component
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full animate-float-slow" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-primary/15 rounded-lg rotate-45 animate-float-medium" />
        <div className="absolute bottom-40 left-20 w-12 h-12 bg-primary/20 rounded-full animate-float-fast" />
        <div className="absolute bottom-20 right-10 w-24 h-24 bg-primary/8 rounded-lg animate-float-slow" />
        <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-primary/25 rounded-full animate-float-medium" />
        <div className="absolute top-1/3 right-1/3 w-14 h-14 bg-primary/12 rounded-lg rotate-12 animate-float-fast" />
      </div>
      
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
    </div>
  );
}

// Floating AI icons component
function FloatingIcons() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-1/4 left-1/6 animate-float-slow">
        <Brain className="w-8 h-8 text-primary/30" />
      </div>
      <div className="absolute top-1/3 right-1/4 animate-float-medium delay-1000">
        <Cpu className="w-6 h-6 text-primary/25" />
      </div>
      <div className="absolute bottom-1/3 left-1/3 animate-float-fast delay-2000">
        <Network className="w-7 h-7 text-primary/20" />
      </div>
      <div className="absolute bottom-1/4 right-1/6 animate-float-slow delay-3000">
        <Bot className="w-9 h-9 text-primary/35" />
      </div>
      <div className="absolute top-1/2 right-1/6 animate-float-medium delay-4000">
        <Sparkles className="w-5 h-5 text-primary/30" />
      </div>
    </div>
  );
}

// FeatureCard component
export default function HomePage() {
  return (
    <div className="relative overflow-hidden w-full min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center w-full">
        <AnimatedBackground />
        <FloatingIcons />
        
        {/* Main Hero Content */}
        <div className="relative z-10 w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Powered by Dumb AI</span>
          </div>
          
          {/* Logo */}
          <div className="w-48 h-48 mx-auto mb-8 animate-fade-in-up">
            <img src="/images/logo.svg" alt="Ubumuntu AI Logo" className="w-full h-full" />
          </div>
          
          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-8 animate-fade-in-up leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">
              Ubumuntu AI
            </span>
          </h1>
          
          {/* Subheading */}
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl mb-8 text-muted-foreground mx-auto animate-fade-in-up delay-200 leading-relaxed max-w-6xl">
            Experience the next evolution of AI automation - Your 
            <span className="text-primary font-semibold"> all-in-one intelligent workspace</span> that 
            <span className="text-primary font-semibold"> learns</span>, 
            <span className="text-primary font-semibold"> adapts</span>, and 
            <span className="text-primary font-semibold"> grows</span> with you
          </p>
          
          {/* Description */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl mb-12 text-muted-foreground/80 mx-auto animate-fade-in-up delay-300 leading-relaxed max-w-5xl">
            Transform your business workflows and personal productivity with AI that understands your unique context
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 sm:mb-16 animate-fade-in-up delay-500">
            <Link
              href="/retrieval"
              className="group bg-primary text-primary-foreground hover:bg-primary/90 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              Start Your AI Agent
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="#demo"
              className="group border-2 border-primary/20 text-primary hover:bg-primary/5 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all duration-300 hover:scale-105 flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </Link>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 lg:gap-16 mx-auto animate-fade-in-up delay-700">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-2">1M+</div>
              <div className="text-base sm:text-lg md:text-xl text-muted-foreground">Documents Processed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-2">50+</div>
              <div className="text-base sm:text-lg md:text-xl text-muted-foreground">AI Workflows</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-base sm:text-lg md:text-xl text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-primary/50 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
             </section>
      
            {/* Main Content Container */}
      <div className="relative z-10 w-full">
        {/* Business Use Cases Section */}
        <section className="w-full py-16 lg:py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12 text-center text-primary">For Businesses</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
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
        </section>

        {/* Individual Use Cases Section */}
        <section className="w-full py-16 lg:py-24 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12 text-center text-primary">For Individuals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
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
        </section>

        {/* Core Capabilities Section */}
        <section className="w-full py-16 lg:py-24 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-12 text-center text-primary">Core Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
        </section>

        {/* Updated Pricing Section */}
        <section className="w-full py-16 lg:py-24 bg-muted/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-center text-primary">Flexible Plans for Every Need</h2>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 text-center max-w-3xl mx-auto">
              Start your AI journey for free and scale as you grow. Transparent pricing with no hidden fees.
            </p>
            </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Free Plan */}
          <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background/50 backdrop-blur-sm">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Explorer</h3>
              <div className="text-3xl font-bold mb-2">Free</div>
              <p className="text-muted-foreground">Perfect for getting started</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>1GB AI processing</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>100 AI chat messages/month</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Basic knowledge base</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>2 AI workflows</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Community support</span>
              </li>
            </ul>
            
            <Link
              href="/sign-up"
              className="w-full block text-center bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Free
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background/50 backdrop-blur-sm">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-2">$29<span className="text-lg text-muted-foreground">/month</span></div>
              <p className="text-muted-foreground">For power users</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>10GB AI processing</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Unlimited AI chat</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Advanced knowledge base</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>10 AI workflows</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Priority email support</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Basic integrations (20+ apps)</span>
              </li>
            </ul>
            
            <Link
              href="/pricing"
              className="w-full block text-center bg-primary/90 hover:bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Upgrade to Pro
            </Link>
          </div>

          {/* Business Plan */}
          <div className="relative p-6 border-2 border-primary rounded-2xl hover:scale-105 transition-all duration-300 bg-primary/5 backdrop-blur-sm">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                <Star className="w-4 h-4" />
                Most Popular
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Business</h3>
              <div className="text-3xl font-bold mb-2">$99<span className="text-lg text-muted-foreground">/month</span></div>
              <p className="text-muted-foreground">For growing teams</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>50GB AI processing</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Unlimited AI features</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Enterprise knowledge base</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Unlimited AI workflows</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Advanced integrations (100+ apps)</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>24/7 priority support</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Custom AI model training</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Advanced analytics</span>
              </li>
            </ul>
            
            <Link
              href="/pricing"
              className="w-full block text-center bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Start Business Plan
            </Link>
          </div>

          {/* Enterprise Plan */}
          <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background/50 backdrop-blur-sm">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="text-3xl font-bold mb-2">Custom</div>
              <p className="text-muted-foreground">For large organizations</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Unlimited AI processing</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Custom deployment options</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Private AI models</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Custom AI development</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Enterprise security</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Dedicated success team</span>
              </li>
              <li className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Custom SLAs</span>
              </li>
            </ul>
            
            <Link
              href="/contact"
              className="w-full block text-center bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
        
        {/* Enhanced Value Props */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6 bg-background/50 backdrop-blur-sm rounded-xl border border-primary/20">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="font-semibold mb-2">Enterprise-Grade Security</h4>
            <p className="text-sm text-muted-foreground">SOC 2 Type II certified with end-to-end encryption and GDPR compliance</p>
          </div>
          
          <div className="text-center p-6 bg-background/50 backdrop-blur-sm rounded-xl border border-primary/20">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h4 className="font-semibold mb-2">Advanced AI Technology</h4>
            <p className="text-sm text-muted-foreground">State-of-the-art AI models with continuous learning and adaptation</p>
          </div>
          
          <div className="text-center p-6 bg-background/50 backdrop-blur-sm rounded-xl border border-primary/20">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-semibold mb-2">Dedicated Support</h4>
            <p className="text-sm text-muted-foreground">Expert AI specialists available 24/7 to ensure your success</p>
          </div>
        </div>

                 {/* Competitive Advantage */}
         <div className="mt-16 p-8 bg-primary/5 rounded-2xl border border-primary/20">
           <h4 className="text-xl font-bold text-primary mb-4 text-center">Why Choose Ubumuntu AI?</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="flex items-start gap-3">
               <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
               <div>
                 <p className="font-medium">More Affordable Than Competitors</p>
                 <p className="text-sm text-muted-foreground">Save up to 70% compared to traditional enterprise solutions</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
               <div>
                 <p className="font-medium">Advanced AI Capabilities</p>
                 <p className="text-sm text-muted-foreground">State-of-the-art models with continuous improvements</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
               <div>
                 <p className="font-medium">Flexible Integration</p>
                 <p className="text-sm text-muted-foreground">Connect with 100+ apps and custom systems</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
               <div>
                 <p className="font-medium">Transparent Pricing</p>
                 <p className="text-sm text-muted-foreground">No hidden fees or long-term contracts required</p>
               </div>
             </div>
           </div>
         </div>
       </section>

      {/* Final CTA Section */}
      <section className="w-full py-16 lg:py-24 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex flex-col items-center space-y-6 animate-fade-in-up">
            <p className="text-lg md:text-xl text-muted-foreground max-w-4xl leading-relaxed">
              Ubumuntu means &apos;humanity towards others&apos; in Kinyarwanda. Our platform embodies this philosophy by creating AI that understands your unique context—whether you&apos;re running a business or managing your personal life—and intelligently automates tasks, generates insights, and provides recommendations that truly serve your needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/retrieval"
                className="group bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
              >
                Start Your AI Agent
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <Link
                href="/embeddings"
                className="group border border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-3 rounded-lg font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
              >
                Explore Capabilities
                <span className="inline-block transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
                   </div>
        </section>
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

