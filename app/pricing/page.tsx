"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Star, Globe2, Shield, Users, ArrowLeft } from "lucide-react";

export default function PricingPage() {
  const { isSignedIn } = useUser();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="w-full py-12 lg:py-16 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-center text-primary">
            Choose Your AI Plan
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 text-center max-w-3xl mx-auto">
            Start free and scale with AI that grows with you. From personal productivity to enterprise automation.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="w-full py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free Tier */}
            <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Starter</h3>
                <div className="text-3xl font-bold mb-2">Free</div>
                <p className="text-muted-foreground">Perfect for exploring AI</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>500MB document processing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Basic AI chat (50 messages/month)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Personal knowledge base</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>1 AI workflow automation</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Community support</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline" asChild>
                <Link href={isSignedIn ? "/retrieval" : "/sign-up"}>
                  {isSignedIn ? "Get Started" : "Sign Up Free"}
                </Link>
              </Button>
            </div>

            {/* Growth Tier */}
            <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Growth</h3>
                <div className="text-3xl font-bold mb-2">$19<span className="text-lg text-muted-foreground">/month</span></div>
                <p className="text-muted-foreground">For individuals & small teams</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>5GB document processing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Unlimited AI chat</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Health & productivity AI agents</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>5 AI workflow automations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Basic integrations (10 apps)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Email + chat support</span>
                </li>
              </ul>
              
              <Button className="w-full" asChild>
                <Link href={isSignedIn ? "/usage" : "/sign-up"}>
                  {isSignedIn ? "Current Plan" : "Start Growing"}
                </Link>
              </Button>
            </div>

            {/* Scale Tier - Most Popular */}
            <div className="relative p-6 border-2 border-primary rounded-2xl hover:scale-105 transition-all duration-300 bg-primary/5">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Scale</h3>
                <div className="text-3xl font-bold mb-2">$49<span className="text-lg text-muted-foreground">/month</span></div>
                <p className="text-muted-foreground">For growing businesses</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="font-medium">25GB document processing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Unlimited AI chat + voice mode</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>All personal + business AI agents</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Unlimited AI workflow automations</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Advanced integrations (100+ apps)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Custom AI model training</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Priority support & API access</span>
                </li>
              </ul>
              
              <Button className="w-full" asChild>
                <Link href={isSignedIn ? "/usage" : "/sign-up"}>
                  {isSignedIn ? "Upgrade to Scale" : "Scale Your Business"}
                </Link>
              </Button>
            </div>

            {/* Enterprise */}
            <div className="relative p-6 border rounded-2xl hover:border-primary/50 transition-all duration-300 hover:scale-105 bg-background">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                <div className="text-3xl font-bold mb-2">Custom</div>
                <p className="text-muted-foreground">For large organizations</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Everything in Scale</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Unlimited document processing</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>White-label & custom deployment</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Custom AI model development</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Advanced security & compliance</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>24/7 phone support & SLA</span>
                </li>
              </ul>
              
              <Button className="w-full" variant="outline">
                Contact Sales
              </Button>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-6">
              All plans include enterprise-grade security, GDPR compliance, and 99.9% uptime guarantee
            </p>
            
            {/* Value Props */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
                  <Shield className="w-6 h-6" />
                </div>
                <h4 className="font-semibold mb-2">Enterprise Security</h4>
                <p className="text-sm text-muted-foreground">SOC 2 compliant with end-to-end encryption</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
                  <Globe2 className="w-6 h-6" />
                </div>
                <h4 className="font-semibold mb-2">Global Reach</h4>
                <p className="text-sm text-muted-foreground">Available in 50+ countries with local data centers</p>
              </div>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 text-primary rounded-lg mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-semibold mb-2">Expert Support</h4>
                <p className="text-sm text-muted-foreground">Dedicated AI specialists to help you succeed</p>
              </div>
            </div>

            {/* Comparison Note */}
            <div className="mt-12 p-6 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold text-primary mb-2">Why choose Ubumuntu AI over competitors?</h4>
              <p className="text-muted-foreground">
                Unlike HubSpot's expensive tiers ($800+/month) or ActiveCampaign's limited AI features, 
                we provide enterprise-grade AI automation at transparent, affordable pricing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full py-16 lg:py-24 bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>What happens if I exceed my limits?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We'll notify you when you approach your limits. For document processing and API calls, you'll need to upgrade your plan or wait for the next billing cycle. AI chat remains available with temporary rate limiting.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Is there a free trial for paid plans?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! You can try any paid plan free for 14 days. No credit card required. You can also start with our free Starter plan and upgrade when you're ready.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We accept all major credit cards, PayPal, and for Enterprise customers, we can accommodate wire transfers and custom billing arrangements.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
} 