"use client";

import Link from "next/link";
import { MoveRight, LayoutTemplate, Layers, Share2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const examplePrompts = [
    "Carousel for parents about why kids forget what they learn. Explain the forgetting curve.",
    "LinkedIn post about the future of AI in education, highlighting personalized learning.",
    "Instagram story sequence for a new coding bootcamp targeting high schoolers.",
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 p-6 overscroll-none overflow-x-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      <main className="max-w-5xl w-full z-10 flex flex-col items-center text-center space-y-12 py-20">
        <div className="space-y-6">
          <div className="inline-block px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium mb-4">
            <Sparkles className="inline-block w-4 h-4 mr-2" />
            AI-Powered Social Media Creation
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Create Engaging Social Content <br className="hidden md:block"/> in Seconds.
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Social Media Studio turns a simple idea into ready-to-publish posts, carousels, and stories with AI-generated copy and visuals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Link href="/studio">
            <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/25 transition-all">
              Open Studio <MoveRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-16 text-left">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <LayoutTemplate className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Multiple Formats</h3>
            <p className="text-gray-600 dark:text-gray-400">Instantly format for Instagram, LinkedIn, X, and TikTok with perfect aspect ratios.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <Layers className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Automated Carousels</h3>
            <p className="text-gray-600 dark:text-gray-400">AI automatically breaks down complex topics into engaging, swipeable slides.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm">
            <Share2 className="w-8 h-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Export Anywhere</h3>
            <p className="text-gray-600 dark:text-gray-400">Download high-quality PNGs or PDFs ready to be published to your audience.</p>
          </div>
        </div>

        <div className="w-full max-w-2xl mt-12 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-gray-100 dark:border-zinc-800 shadow-xl shadow-gray-200/50 dark:shadow-none text-left">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
            <Wand2 className="w-4 h-4 mr-2" /> Try these prompts
          </h3>
          <div className="space-y-3">
            {examplePrompts.map((p, i) => (
              <div key={i} className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-950 text-gray-700 dark:text-gray-300 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 transition-colors cursor-pointer border border-transparent hover:border-blue-100 dark:hover:border-blue-900/50">
                &quot;{p}&quot;
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
