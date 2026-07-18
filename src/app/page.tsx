"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 overflow-x-hidden">
      {/* Background Gradient Effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="text-xl font-bold tracking-tight">IoT Hardware Hub</span>
        </div>
        <div>
          <button 
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
            className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Now supporting Gemini 3.1 Analysis
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 leading-tight">
            Design, Track, and Manage <br /> Your Embedded Hardware.
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            The ultimate project command center for firmware engineers. 
            Document pinouts, track milestones, and audit code structures with AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-3 active:scale-95"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
              Sign In with GitHub
            </button>
            <a 
              href="https://github.com/kongzhuww" 
              target="_blank"
              className="w-full sm:w-auto px-8 py-4 bg-gray-900 border border-gray-800 text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
            >
              Explore Open Source
            </a>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Feature 1 */}
          <div className="group p-8 rounded-3xl bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 transition-all duration-500">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Hardware Pin Registry</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Never lose track of your PA9, PB6, or UART connections again. 
              Document how your hardware is wired for every project in the cloud.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group p-8 rounded-3xl bg-gray-900/50 border border-gray-800 hover:border-purple-500/50 transition-all duration-500">
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">AI Project Audit</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Instantly analyze GitHub repo structures. Identify build systems, 
              detect peripheral drivers, and understand architecture styles automatically.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group p-8 rounded-3xl bg-gray-900/50 border border-gray-800 hover:border-green-500/50 transition-all duration-500">
            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-3">Project Roadmap</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Integrated Todo lists tailored for embedded development. 
              Plan your milestones from bootloader logic to application deployment.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-gray-500 text-sm">
          <p>© 2026 IoT Hardware Hub. Built for makers, by makers.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
