import React, { useState } from 'react';
import { Logo } from './Logo';
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
  AlertCircle
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'register' | 'forgot';
  onSuccess: (userData: { name: string; email: string }) => void;
  onBackToHome: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onBackToHome,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset-sent'>(
    initialMode
  );

  // Form states
  const [fullName, setFullName] = useState('Rajesh Joshi');
  const [email, setEmail] = useState('rajesh.joshi@example.com');
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('••••••••');
  const [confirmPassword, setConfirmPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (authMode === 'register') {
      if (!fullName.trim() || !email.trim()) {
        setErrorMsg('Please enter your full name and email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (!agreeTerms) {
        setErrorMsg('Please accept the terms and privacy policy.');
        return;
      }
      onSuccess({ name: fullName, email });
    } else if (authMode === 'login') {
      if (!email.trim() || !password) {
        setErrorMsg('Please enter both your email and password.');
        return;
      }
      onSuccess({ name: fullName || 'Citizen User', email });
    } else if (authMode === 'forgot') {
      if (!email.trim()) {
        setErrorMsg('Please provide your registered email address.');
        return;
      }
      setAuthMode('reset-sent');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 transition-colors">
      
      {/* LEFT BRAND PANEL (Matches reference image image_73631c71.png) */}
      <div className="lg:w-1/2 bg-[#09090B] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-zinc-800">
        
        {/* Subtle decorative glow with Neon Rose accent */}
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-[#007FFF]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-64 h-64 bg-[#FF2E93]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Back to home */}
        <div className="relative z-10 space-y-6">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to home</span>
          </button>

          <div className="pt-4">
            <Logo size="lg" showSubtitle={false} />
          </div>
        </div>

        {/* Center: Inspirational Pitch & Visual Graphic */}
        <div className="relative z-10 my-12 space-y-8 max-w-md">
          <div className="space-y-3">
            <div className="text-xs font-semibold tracking-wider text-[#007FFF] uppercase">
              A Bridge to Resolution
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              A clearer path starts here.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Create your account and bring your financial concerns and citizen grievances into one organised place.
            </p>
          </div>

          {/* Minimalist Graphic from Reference (Glowing circle + Shield + Subtle pink sparkle) */}
          <div className="relative w-36 h-36 mx-auto lg:mx-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-zinc-800 bg-zinc-950/80 shadow-2xl flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border border-[#007FFF]/30 bg-[#007FFF]/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-[#007FFF]" />
              </div>
            </div>
            {/* Subtle Neon Rose sparkle accent (decorative only) */}
            <div className="absolute -top-1 -right-1 text-[#FF2E93]">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 text-xs text-zinc-500 font-medium">
          Clear guidance. Your decisions. Your control.
        </div>
      </div>

      {/* RIGHT AUTH FORM PANEL */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-16 flex flex-col justify-center max-w-xl mx-auto w-full">
        
        <div className="w-full space-y-6">
          
          {/* Header */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider">
              {authMode === 'register' ? 'Get Started' : authMode === 'login' ? 'Welcome Back' : 'Account Recovery'}
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {authMode === 'register'
                ? 'Create your account'
                : authMode === 'login'
                ? 'Sign in to your workspace'
                : authMode === 'reset-sent'
                ? 'Check your inbox'
                : 'Reset your password'}
            </h2>

            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
              {authMode === 'register'
                ? 'It takes just a moment to get started.'
                : authMode === 'login'
                ? 'Access your saved cases, evidence dossiers, and guidance.'
                : authMode === 'reset-sent'
                ? 'We sent a recovery link to your email address.'
                : 'Enter your registered email address to receive recovery instructions.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {authMode === 'reset-sent' ? (
            <div className="space-y-6 pt-4">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Password Reset Link Dispatched</span>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  A verification message has been simulated for <strong className="text-zinc-900 dark:text-white">{email}</strong>. For this prototype, you can proceed directly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer text-center"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Register: Full Name */}
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                    Full name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Rajesh Joshi"
                      className="w-full text-xs px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-xs px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                    required
                  />
                </div>
              </div>

              {/* Register: Optional Mobile Number */}
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Mobile number
                    </label>
                    <span className="text-[10px] text-zinc-400">Optional (for SMS alerts)</span>
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full text-xs px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              {authMode !== 'forgot' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-medium text-[#007FFF] hover:underline"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Register: Confirm Password */}
              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Confirm password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-[11px] font-medium text-[#007FFF] hover:underline"
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Login Extra Options: Remember me & Forgot Password */}
              {authMode === 'login' && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-zinc-300 text-[#007FFF] focus:ring-[#007FFF]"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setAuthMode('forgot');
                    }}
                    className="text-xs text-[#007FFF] font-medium hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Register Terms acceptance */}
              {authMode === 'register' && (
                <div className="pt-1">
                  <label className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-[#007FFF] focus:ring-[#007FFF]"
                    />
                    <span className="leading-tight">
                      I agree to the Terms of Service and understand NivaranSetu provides informational assistance, not legal representation.
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm shadow-[#007FFF]/25 hover:translate-y-[-1px] cursor-pointer"
                >
                  <span>
                    {authMode === 'register'
                      ? 'Create account'
                      : authMode === 'login'
                      ? 'Sign in'
                      : 'Send recovery link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </form>
          )}

          {/* Switcher links */}
          <div className="text-center text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            {authMode === 'login' && (
              <div>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setAuthMode('register');
                  }}
                  className="text-[#007FFF] font-semibold hover:underline cursor-pointer"
                >
                  Create account
                </button>
              </div>
            )}

            {authMode === 'register' && (
              <div>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setAuthMode('login');
                  }}
                  className="text-[#007FFF] font-semibold hover:underline cursor-pointer"
                >
                  Log in
                </button>
              </div>
            )}

            {authMode === 'forgot' && (
              <div>
                Remember your password?{' '}
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setAuthMode('login');
                  }}
                  className="text-[#007FFF] font-semibold hover:underline cursor-pointer"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>

          {/* Prototype Disclosure Badge */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 pt-2">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Prototype only — authentication is not connected to a secure backend yet.</span>
          </div>

        </div>

      </div>

    </div>
  );
};
