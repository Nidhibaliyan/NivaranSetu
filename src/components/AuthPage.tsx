/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Logo } from './Logo';
import {
  signInWithSupabase,
  signUpWithSupabase,
  resetSupabasePassword,
  DEMO_CITIZEN_PASSWORD,
} from '../utils/authSession';
import { AuthUser } from '../types';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Play,
  RotateCcw,
  KeyRound,
  Check,
  Loader2,
} from 'lucide-react';

export interface QuickCitizenProfile {
  name: string;
  email: string;
  location: string;
  caseSummary: string;
}

export const QUICK_CITIZENS: QuickCitizenProfile[] = [
  { name: 'Rajesh Joshi', email: 'rajesh.joshi@example.com', location: 'Pune, Maharashtra', caseSummary: 'UPI Debit Dispute (₹42,500)' },
  { name: 'Anita Sharma', email: 'anita.sharma@example.com', location: 'Bengaluru, Karnataka', caseSummary: 'Consumer Appliance Defect' },
];

export interface QuickLoginCallbacks {
  setErrorMsg: (msg: string | null) => void;
  setSuccessNotice: (msg: string | null) => void;
  setIsSubmitting: (submitting: boolean) => void;
  setFullName: (name: string) => void;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  onSuccess: (userData: AuthUser, rememberMe?: boolean) => void;
}

/**
 * Executes demo login for pre-seeded demo citizen accounts.
 * Strictly calls signInWithSupabase and never attempts registration fallback,
 * preventing email rate limit exhaustion.
 */
export async function executeQuickLogin(
  citizen: QuickCitizenProfile,
  callbacks: QuickLoginCallbacks
): Promise<void> {
  callbacks.setErrorMsg(null);
  callbacks.setSuccessNotice(null);
  callbacks.setIsSubmitting(true);
  callbacks.setFullName(citizen.name);
  callbacks.setEmail(citizen.email);
  callbacks.setPassword(DEMO_CITIZEN_PASSWORD);

  try {
    const loginRes = await signInWithSupabase(citizen.email, DEMO_CITIZEN_PASSWORD, true);
    if (loginRes.user) {
      callbacks.onSuccess(loginRes.user, true);
      return;
    }

    callbacks.setErrorMsg(
      loginRes.error ||
        'Demo account credentials invalid or user not found. Please ensure this demo user exists in Supabase Auth.'
    );
  } catch (err: any) {
    callbacks.setErrorMsg(err?.message || 'Authentication request failed.');
  } finally {
    callbacks.setIsSubmitting(false);
  }
}

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'forgot';
  onSuccess: (
    userData: AuthUser,
    rememberMe?: boolean
  ) => void;
  onBackToHome: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onBackToHome,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(
    initialMode === 'register' ? 'register' : 'login'
  );

  // Form states
  const [fullName, setFullName] = useState('Rajesh Joshi');
  const [email, setEmail] = useState('rajesh.joshi@example.com');
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState(DEMO_CITIZEN_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Quick Citizen Demo Profiles
  const quickCitizens = QUICK_CITIZENS;

  const handleQuickLogin = async (citizen: QuickCitizenProfile) => {
    await executeQuickLogin(citizen, {
      setErrorMsg,
      setSuccessNotice,
      setIsSubmitting,
      setFullName,
      setEmail,
      setPassword,
      onSuccess,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (tab === 'register') {
      if (!fullName.trim() || !email.trim()) {
        setErrorMsg('Please enter your full name and email address.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await signUpWithSupabase(
          email,
          password,
          {
            fullName,
            phone,
          },
          rememberMe
        );

        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.requiresEmailConfirmation) {
          setSuccessNotice(
            'Account registration submitted! A confirmation link has been sent to your email. Please verify your email before logging in, or disable "Confirm email" in Supabase Auth Settings.'
          );
        } else if (res.user) {
          onSuccess(res.user, rememberMe);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Registration request failed.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!email.trim()) {
        setErrorMsg('Please enter your email address.');
        return;
      }
      if (!password) {
        setErrorMsg('Please enter your password.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await signInWithSupabase(email, password, rememberMe);
        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.user) {
          onSuccess(res.user, rememberMe);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Login request failed.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setErrorMsg(null);
    try {
      const res = await resetSupabasePassword(forgotEmail);
      if (res.success) {
        setForgotSent(true);
        setTimeout(() => {
          setForgotOpen(false);
          setForgotSent(false);
        }, 4000);
      } else {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send password recovery link.');
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-blue-50/70 via-white to-sky-50/40 dark:from-[#09090B] dark:via-[#0c1220] dark:to-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* 1. AMBIENT BLUE/WHITE GLOWS IN BACKGROUND */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-[#007FFF]/15 via-[#007FFF]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#007FFF]/10 dark:bg-[#007FFF]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-[#FF2E93]/8 dark:bg-[#FF2E93]/5 rounded-full blur-3xl pointer-events-none" />

      {/* 2. TOP BAR */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-zinc-800/60 border border-transparent hover:border-zinc-200 dark:border-zinc-800"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </button>
      </header>

      {/* 3. CENTER CONTENT AREA: MINIMAL CITIZEN-FRIENDLY INTERFACE */}
      <main className="relative z-10 w-full max-w-md mx-auto px-5 py-4 flex flex-col items-center">
        
        {/* Animated Brand Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-block transform hover:scale-105 transition-transform">
            <Logo size="lg" showSubtitle={false} animated={true} />
          </div>

          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            A Bridge to Resolution · Guided Grievance Portal
          </p>
        </div>

        {/* Minimal Auth Card with Glassmorphic Accent */}
        <div className="w-full rounded-2xl bg-white/90 dark:bg-[#18181B]/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-xl shadow-blue-500/5 p-6 sm:p-7 space-y-5 transition-all">
          
          {/* Pill Tab Switcher: Sign In vs Create Account */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/60 dark:border-zinc-800/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                tab === 'login'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-bold text-[#007FFF]'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                tab === 'register'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-bold text-[#007FFF]'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Quick Demo Access Pills */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
              <span>EXPLORE WITH CITIZEN ACCOUNT:</span>
              <span className="text-[10px] text-[#007FFF]">One-Click Login</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickCitizens.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleQuickLogin(c)}
                  className="p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/30 text-left transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-[#007FFF] transition-colors truncate">
                    {c.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {c.location}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            <span className="absolute bg-white dark:bg-[#18181B] px-3 text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              Or with credentials
            </span>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Notice */}
          {successNotice && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Registration-only fields */}
            {tab === 'register' && (
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Password
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => setForgotOpen(!forgotOpen)}
                    className="text-[11px] text-[#007FFF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-9 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Progressive Disclosure: Inline Forgot Password */}
            {forgotOpen && (
              <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 space-y-2 text-xs">
                <span className="font-semibold text-zinc-900 dark:text-white block text-[11px]">
                  Password Recovery:
                </span>
                <p className="text-[11px] text-zinc-500">
                  Enter your email to receive a secure login link.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter registered email"
                    className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleForgotSubmit}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg cursor-pointer"
                  >
                    {forgotSent ? 'Sent!' : 'Send Link'}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-[#007FFF] hover:bg-[#0070e0] transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2 group mt-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{tab === 'login' ? 'Enter NivaranSetu' : 'Complete Registration'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Privacy & Progressive Disclosure Note */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <details className="group cursor-pointer">
              <summary className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center gap-1 list-none">
                <Shield className="w-3 h-3 text-[#007FFF]" />
                <span>Citizen Privacy & Local Storage Assurance</span>
              </summary>
              <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed text-left bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                Your grievance evidence, personal identifiers, and complaints are secured on your browser device with cryptographic SHA-256 digests. NivaranSetu does not sell or share citizen data with advertisers.
              </p>
            </details>
          </div>

        </div>

        {/* Bottom Tagline */}
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center mt-6">
          Clear guidance. Your decisions. Your control.
        </p>
      </main>

      {/* 4. FOOTER */}
      <footer className="relative z-10 py-4 text-center text-[10px] text-zinc-400">
        NivaranSetu Citizen Grievance Intelligence Platform · Free Public Utility
      </footer>
    </div>
  );
};
