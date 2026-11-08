import React, { useState } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowRight,
  Shield,
  FileText,
  Lock,
  Globe,
  CheckCircle2,
  Check,
  ChevronRight,
  Sparkles,
  Wallet,
  Mic,
  Languages,
  Scale,
  Compass,
  Layers,
  FileCheck2,
  ExternalLink,
  IndianRupee,
  HelpCircle
} from 'lucide-react';

interface LandingPageProps {
  onStartCase: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartCase, onOpenAuth }) => {
  const { language, t } = useLanguage();

  return (
    <div className="w-full bg-[#FFFFFF] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* 1. HERO SECTION (Faithfully matching image_9c0f2e08.png) */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden border-b border-zinc-200/70 dark:border-zinc-800/80">
        
        {/* Subtle ambient decorative gradient with Neon Rose (#FF2E93) and Cerulean Blue (#007FFF) */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#007FFF]/10 via-transparent to-[#FF2E93]/10 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Kicker & Animated Bridge Identity before Login */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 shadow-2xs">
                  <Logo size="sm" showSubtitle={false} animated={true} />
                  <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                    A Bridge to Resolution.
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-[#FF2E93]" />
                  <span className="text-[#007FFF]">Financial Clarity. A Clearer Way Forward.</span>
                </div>
              </div>

              {/* Bold Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.12]">
                Your Problem Deserves a <span className="text-[#007FFF]">Clear Path</span> to Resolution.
              </h1>

              {/* Description from prompt */}
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                Understand your rights, organise your evidence and navigate grievance resolution with an intelligent assistant that speaks your language.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={onStartCase}
                  className="flex items-center gap-2 px-6 py-3.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-md shadow-[#007FFF]/25 hover:translate-y-[-1px] cursor-pointer"
                >
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById('how-it-works');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-5 py-3.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 transition-all cursor-pointer"
                >
                  <span>See how it works</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Micro Subtext from reference: icons + "Clear guidance. Organised evidence. You stay in control." */}
              <div className="flex items-center gap-2.5 text-xs text-zinc-400 pt-2 font-medium">
                <div className="flex items-center gap-1 text-[#007FFF]">
                  <IndianRupee className="w-3.5 h-3.5" />
                  <Shield className="w-3.5 h-3.5" />
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span>Clear guidance. Organised evidence. You stay in control.</span>
              </div>

            </div>

            {/* Right Column: "YOUR RESOLUTION SPACE" INTERACTIVE MOCKUP (Exact replica from image_9c0f2e08.png) */}
            <div className="lg:col-span-5 relative">
              
              {/* Outer Window Container */}
              <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-2xl p-6 sm:p-7 space-y-5">
                
                {/* Window header with dots and title */}
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  </div>
                  <div className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
                    YOUR RESOLUTION SPACE
                  </div>
                  <div className="text-zinc-300 dark:text-zinc-700 text-xs font-mono">•••</div>
                </div>

                {/* Floating pill badge top right: "Evidence organised" */}
                <div className="absolute -top-3.5 right-6 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-md text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Evidence organised</span>
                </div>

                {/* Case Subject Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-950 dark:text-white">
                        UPI payment issue
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Case NS-2026-0142
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-[#007FFF] bg-[#007FFF]/10 px-2 py-0.5 rounded-md">
                    In progress
                  </span>
                </div>

                {/* Transaction Amount Block */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-semibold">
                    TRANSACTION AMOUNT
                  </div>
                  <div className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
                    ₹2,450.00
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Details organised</span>
                  </div>
                </div>

                {/* Checklist Steps */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-white">Problem described</span>
                      <span className="text-zinc-400 ml-1.5 text-[11px]">· 06 Nov · Case created</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-900 dark:text-white">Evidence organised</span>
                      <span className="text-zinc-400 ml-1.5 text-[11px]">· 2 documents added</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="w-4 h-4 rounded-full border-2 border-[#007FFF] flex items-center justify-center shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#007FFF]">Resolution guidance</span>
                      <div className="text-zinc-500 text-[11px]">Review recommended next steps</div>
                    </div>
                  </div>
                </div>

                {/* Floating Bottom AI Card from Reference */}
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#007FFF] shrink-0" />
                    <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
                      <strong className="text-[#007FFF]">AI-assisted guidance: </strong>
                      Keep bank reference handy while contacting nodal desk.
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* Bottom Trust Strip (Matching image_9c0f2e08.png) */}
        <div className="max-w-5xl mx-auto px-4 mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-around gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#007FFF]" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Your information stays yours</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">•</span>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-[#007FFF]" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Built for multiple languages</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">•</span>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#007FFF]" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">You remain in control</span>
          </div>
        </div>

      </section>

      {/* 2. HOW IT WORKS (FOUR CLEAR STEPS) */}
      <section id="how-it-works" className="py-20 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#09090B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider">
              Step-by-Step Flow
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white">
              How NivaranSetu Works
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Transforming scattered information into an organised, evidence-backed case in four steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-xs flex items-center justify-center">
                01
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Tell us your problem.
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Describe what happened in plain Hindi or English. Speak or write naturally without confusing legal terms.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-xs flex items-center justify-center">
                02
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Organise your evidence.
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Drop in screenshots, receipts, notices, or transaction IDs. We extract dates and map them to a verified timeline.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-xs flex items-center justify-center">
                03
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Prepare your complaint.
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Receive a structured complaint draft and readiness audit highlighting any missing documents before filing.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-xs flex items-center justify-center">
                04
              </div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                Navigate towards resolution.
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Get direct instructions for the exact official government portal (RBI CMS, e-Daakhil, CPGRAMS, RERA) and escalation tiers.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 3. THREE CORE BENEFITS (UNDERSTAND, PREPARE, NAVIGATE) */}
      <section id="why-nivaransetu" className="py-20 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider">
              Core Principles
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white">
              Why NivaranSetu?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              Not just another complaint box. We bridge the gap from confusion to resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Benefit 1: Understand */}
            <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                Understand
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Demystify confusing bank rejection notices, builder demand letters, and complex government rules. Simple Mode translates bureaucratic legalese into clear, actionable advice.
              </p>
            </div>

            {/* Benefit 2: Prepare */}
            <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                Prepare
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Synthesize messy chat screenshots, PDFs, and passbooks into a professionally structured Case Dossier complete with SHA-256 custody proof and ready-to-copy complaint drafts.
              </p>
            </div>

            {/* Benefit 3: Navigate */}
            <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <div className="w-12 h-12 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                Navigate
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Know exactly where to file—whether it is the RBI Ombudsman for UPI frauds, e-Daakhil for consumer defects, or RERA for builder delays. Avoid procedural rejections before you begin.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. ACCESSIBILITY SECTION (MULTILINGUAL, SIMPLE LANGUAGE, VOICE) */}
      <section id="accessibility" className="py-20 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#09090B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider">
                Built for Every Citizen
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white leading-tight">
                Grievance Resolution Without Language Barriers
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Government and legal processes should not require a law degree or fluency in formal English. NivaranSetu puts accessibility first.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0 mt-0.5">
                    <Languages className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white">Multilingual Assistance</h4>
                    <p className="text-xs text-zinc-500">Fully implemented in English and Hindi, with architectural support for Bengali, Marathi, Tamil, Telugu, and 8 more Indian languages.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white">Simple-Language First</h4>
                    <p className="text-xs text-zinc-500">Simple Mode is enabled by default to explain things in everyday words, with an optional Detailed Mode for formal legal citations.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0 mt-0.5">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-950 dark:text-white">Voice & Speech Support</h4>
                    <p className="text-xs text-zinc-500">Describe your grievance by voice using browser speech recognition, and listen to explanations read aloud.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => onOpenAuth('register')}
                  className="px-6 py-3 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm shadow-[#007FFF]/25 cursor-pointer"
                >
                  Start Your Case Free
                </button>
              </div>
            </div>

            {/* Visual Comparison Box */}
            <div className="lg:col-span-6">
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4 shadow-lg">
                <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                  LEGAL LANGUAGE SIMPLIFIER PREVIEW
                </div>

                {/* Complex Notice */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Official Notice Text</div>
                  <p className="text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                    "Pursuant to Clause 17.4 of master directions, representation cannot be entertained in limine due to non-exhaustion of internal tiered grievance hierarchy..."
                  </p>
                </div>

                {/* Simple Translation */}
                <div className="p-3.5 rounded-xl bg-[#007FFF]/5 border border-[#007FFF]/20 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[#007FFF]">NivaranSetu Simple Translation</div>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed">
                    "The Ombudsman cannot look at your complaint yet because you haven't sent a formal letter to your bank branch first. Give them 30 days to reply; if they refuse, NivaranSetu will automatically generate your filing."
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. MINIMAL CLEAN FOOTER */}
      <footer className="py-12 border-t border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-950 dark:text-white">NivaranSetu</span>
              <span className="text-zinc-400">· A Bridge to Resolution</span>
            </div>

            <div className="flex items-center gap-6 font-medium">
              <a href="#how-it-works" className="hover:text-zinc-900 dark:hover:text-white transition-colors">About</a>
              <a href="#accessibility" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Accessibility</a>
              <button onClick={() => onOpenAuth('login')} className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer">Login</button>
              <button onClick={() => onOpenAuth('register')} className="text-[#007FFF] hover:underline cursor-pointer">Get Started</button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800/60 text-center sm:text-left text-[11px] text-zinc-400 leading-relaxed">
            NivaranSetu is an informational intelligence platform. It does not provide legal representation, official government decisions, or guarantee statutory outcomes. Citizens submit final complaints with their own verification on official government channels.
          </div>
        </div>
      </footer>

    </div>
  );
};
