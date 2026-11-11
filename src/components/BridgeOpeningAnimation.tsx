/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface BridgeOpeningAnimationProps {
  onComplete?: () => void;
  showSkip?: boolean;
  className?: string;
}

export const BridgeOpeningAnimation: React.FC<BridgeOpeningAnimationProps> = ({
  onComplete,
  showSkip = true,
  className = '',
}) => {
  // Animation choreography phases:
  // 0.0s - 0.7s: Cosmos & Constellation Web Reveal
  // 0.7s - 1.6s: Glowing Suspension Bridge Towers & Cable Net Draw
  // 1.6s - 2.4s: Highway Light Streams Converge at Apex Beacon
  // 2.4s - 3.2s: Brand Title & Tagline Luminous Emerge
  // 3.2s: Auto transition
  const [phase, setPhase] = useState<'cosmic' | 'cables' | 'highway' | 'brand' | 'complete'>('cosmic');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('cables'), 700);
    const t2 = setTimeout(() => setPhase('highway'), 1500);
    const t3 = setTimeout(() => setPhase('brand'), 2300);
    const t4 = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setPhase('complete');
        if (onComplete) onComplete();
      }, 500);
    }, 3400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setPhase('complete');
      if (onComplete) onComplete();
    }, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050B14] text-white select-none overflow-hidden transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${className}`}
    >
      {/* 1. Starry Cosmos & Nebula Atmosphere (Faithfully matching uploaded image) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft cyan & blue ambient nebula glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-b from-[#007FFF]/20 via-[#00D2FF]/10 to-transparent rounded-full blur-[100px]" />
        <div className="absolute bottom-10 left-1/4 w-[400px] h-[250px] bg-gradient-to-tr from-[#38BDF8]/15 via-[#007FFF]/10 to-transparent rounded-full blur-[90px]" />
        
        {/* Starfield Particles */}
        {[
          { top: '12%', left: '15%', size: 2, delay: '0s', opacity: 0.9 },
          { top: '22%', left: '35%', size: 1.5, delay: '0.4s', opacity: 0.7 },
          { top: '18%', left: '72%', size: 2.5, delay: '0.8s', opacity: 1 },
          { top: '30%', left: '85%', size: 1.5, delay: '1.2s', opacity: 0.6 },
          { top: '8%', left: '50%', size: 2, delay: '0.2s', opacity: 0.8 },
          { top: '42%', left: '18%', size: 1, delay: '1.5s', opacity: 0.5 },
          { top: '35%', left: '60%', size: 1.8, delay: '0.6s', opacity: 0.85 },
          { top: '15%', left: '90%', size: 2, delay: '1.1s', opacity: 0.75 },
          { top: '55%', left: '12%', size: 1.5, delay: '0.9s', opacity: 0.65 },
          { top: '65%', left: '88%', size: 2, delay: '0.3s', opacity: 0.7 },
        ].map((star, i) => (
          <div
            key={i}
            style={{
              top: star.top,
              left: star.left,
              width: `${star.size}px`,
              height: `${star.size}px`,
              animationDelay: star.delay,
              opacity: star.opacity,
            }}
            className="absolute rounded-full bg-white shadow-[0_0_6px_#38BDF8] animate-pulse"
          />
        ))}

        {/* Constellation Light Grid Lines (Matching image's neural network web) */}
        <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
          <line x1="15%" y1="12%" x2="35%" y2="22%" stroke="#38BDF8" strokeWidth="0.7" strokeDasharray="3 3" />
          <line x1="35%" y1="22%" x2="50%" y2="8%" stroke="#38BDF8" strokeWidth="0.7" strokeDasharray="3 3" />
          <line x1="50%" y1="8%" x2="72%" y2="18%" stroke="#38BDF8" strokeWidth="0.7" strokeDasharray="3 3" />
          <line x1="72%" y1="18%" x2="85%" y2="30%" stroke="#38BDF8" strokeWidth="0.7" strokeDasharray="3 3" />
          <line x1="18%" y1="42%" x2="12%" y2="55%" stroke="#007FFF" strokeWidth="0.6" strokeDasharray="2 4" />
          <line x1="60%" y1="35%" x2="72%" y2="18%" stroke="#007FFF" strokeWidth="0.6" strokeDasharray="2 4" />
        </svg>
      </div>

      {/* 2. Monumental Glowing Suspension Bridge Vector Illustration (Inspired by User Image) */}
      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
        <div className="relative w-full h-64 sm:h-76 flex items-center justify-center">
          <svg
            viewBox="0 0 600 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_0_35px_rgba(0,180,255,0.45)]"
          >
            <defs>
              {/* Cyan & Ice-Blue Linear Gradients */}
              <linearGradient id="bridgeTowerGrad" x1="300" y1="20" x2="300" y2="280" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="25%" stopColor="#38BDF8" />
                <stop offset="80%" stopColor="#007FFF" />
                <stop offset="100%" stopColor="#0369A1" />
              </linearGradient>

              <linearGradient id="cableGradLeft" x1="50" y1="240" x2="300" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#007FFF" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>

              <linearGradient id="cableGradRight" x1="550" y1="240" x2="300" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#007FFF" stopOpacity="0.2" />
                <stop offset="60%" stopColor="#38BDF8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>

              <linearGradient id="highwayRibbonGrad" x1="40" y1="260" x2="560" y2="260" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#007FFF" stopOpacity="0.1" />
                <stop offset="30%" stopColor="#38BDF8" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#007FFF" stopOpacity="0.1" />
              </linearGradient>

              <filter id="luminousGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* A. Distant Constellation Nodes & City Lights */}
            <g opacity="0.5">
              <circle cx="80" cy="220" r="2.5" fill="#38BDF8" className="animate-ping" style={{ animationDuration: '3s' }} />
              <circle cx="160" cy="235" r="2" fill="#FFFFFF" />
              <circle cx="440" cy="235" r="2" fill="#FFFFFF" />
              <circle cx="520" cy="220" r="2.5" fill="#38BDF8" className="animate-ping" style={{ animationDuration: '2.5s' }} />
              <line x1="80" y1="220" x2="160" y2="235" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
              <line x1="440" y1="235" x2="520" y2="220" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
            </g>

            {/* B. Monumental Central Suspension Tower Pylons */}
            <g filter="url(#luminousGlow)">
              {/* Left Pylon Column */}
              <line x1="282" y1="40" x2="276" y2="280" stroke="url(#bridgeTowerGrad)" strokeWidth="4.5" strokeLinecap="round" />
              {/* Right Pylon Column */}
              <line x1="318" y1="40" x2="324" y2="280" stroke="url(#bridgeTowerGrad)" strokeWidth="4.5" strokeLinecap="round" />
              
              {/* Gothic / Modern Arch Cross Beams */}
              <path d="M 280 90 Q 300 75 320 90" stroke="#38BDF8" strokeWidth="2.5" fill="none" />
              <path d="M 278 145 Q 300 130 322 145" stroke="#38BDF8" strokeWidth="2.5" fill="none" />
              <path d="M 277 200 Q 300 185 323 200" stroke="#38BDF8" strokeWidth="2.5" fill="none" />
              
              {/* Diagonal Cross Struts */}
              <line x1="281" y1="90" x2="322" y2="145" stroke="#007FFF" strokeWidth="1.2" opacity="0.7" />
              <line x1="319" y1="90" x2="278" y2="145" stroke="#007FFF" strokeWidth="1.2" opacity="0.7" />
              <line x1="279" y1="145" x2="323" y2="200" stroke="#007FFF" strokeWidth="1.2" opacity="0.7" />
              <line x1="321" y1="145" x2="277" y2="200" stroke="#007FFF" strokeWidth="1.2" opacity="0.7" />

              {/* Apex Diamond Keystone & Radiant Light Beacon */}
              <polygon points="300,22 309,36 300,48 291,36" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="1.5" />
              <circle cx="300" cy="35" r="4" fill="#FFFFFF" className="animate-pulse" />
              
              {/* Vertical Starlight Ray Shooting from Apex */}
              <line x1="300" y1="35" x2="300" y2="2" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
              <line x1="300" y1="35" x2="300" y2="0" stroke="#38BDF8" strokeWidth="6" strokeLinecap="round" opacity="0.4" filter="url(#luminousGlow)" />
            </g>

            {/* C. Primary Luminous Suspension Cables (Curving Cateneries) */}
            <path
              d="M 40 240 Q 170 170 300 40"
              stroke="url(#cableGradLeft)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className={phase !== 'cosmic' ? 'opacity-100 transition-opacity duration-700' : 'opacity-0'}
            />
            <path
              d="M 560 240 Q 430 170 300 40"
              stroke="url(#cableGradRight)"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              className={phase !== 'cosmic' ? 'opacity-100 transition-opacity duration-700' : 'opacity-0'}
            />

            {/* D. Vertical Stay Hangers / Luminescent Fiber Cables */}
            {phase !== 'cosmic' && (
              <g opacity="0.75">
                {/* Left side vertical hanger lines */}
                {[
                  { x: 90, y1: 228, y2: 245 },
                  { x: 130, y1: 205, y2: 247 },
                  { x: 170, y1: 175, y2: 249 },
                  { x: 210, y1: 135, y2: 251 },
                  { x: 250, y1: 85, y2: 253 },
                ].map((hanger, idx) => (
                  <g key={`hl-${idx}`}>
                    <line x1={hanger.x} y1={hanger.y1} x2={hanger.x} y2={hanger.y2} stroke="#38BDF8" strokeWidth="1.2" opacity="0.85" />
                    <circle cx={hanger.x} cy={hanger.y2} r="2" fill="#FFFFFF" className="animate-ping" style={{ animationDuration: `${2 + idx * 0.3}s` }} />
                  </g>
                ))}

                {/* Right side vertical hanger lines */}
                {[
                  { x: 350, y1: 85, y2: 253 },
                  { x: 390, y1: 135, y2: 251 },
                  { x: 430, y1: 175, y2: 249 },
                  { x: 470, y1: 205, y2: 247 },
                  { x: 510, y1: 228, y2: 245 },
                ].map((hanger, idx) => (
                  <g key={`hr-${idx}`}>
                    <line x1={hanger.x} y1={hanger.y1} x2={hanger.x} y2={hanger.y2} stroke="#38BDF8" strokeWidth="1.2" opacity="0.85" />
                    <circle cx={hanger.x} cy={hanger.y2} r="2" fill="#FFFFFF" className="animate-ping" style={{ animationDuration: `${2 + idx * 0.3}s` }} />
                  </g>
                ))}
              </g>
            )}

            {/* E. Futuristic Sweeping Winding Highway Ribbons (Curving through the Night) */}
            <g filter="url(#luminousGlow)">
              {/* Primary Bridge Deck Truss */}
              <line x1="30" y1="245" x2="570" y2="245" stroke="#007FFF" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="255" x2="570" y2="255" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Truss cross-bracing beneath deck */}
              <path d="M 40 245 L 60 255 L 80 245 L 100 255 L 120 245 L 140 255 L 160 245 L 180 255 L 200 245 L 220 255 L 240 245 L 260 255 L 280 245 L 300 255 L 320 245 L 340 255 L 360 245 L 380 255 L 400 245 L 420 255 L 440 245 L 460 255 L 480 245 L 500 255 L 520 245 L 540 255 L 560 245" stroke="#38BDF8" strokeWidth="1" opacity="0.6" fill="none" />

              {/* Sweeping S-Curve Highway Loop from Image foreground */}
              <path
                d="M 120 310 C 200 280, 240 260, 300 252 C 360 260, 420 285, 520 310"
                stroke="url(#highwayRibbonGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />

              {/* Flowing Data Photon Beacons */}
              <path
                d="M 140 305 C 220 278, 250 258, 300 252 C 350 258, 400 282, 490 305"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeDasharray="12 18"
                fill="none"
                className="animate-pulse"
              />
            </g>
          </svg>
        </div>

        {/* 3. Luminous Brand Reveal (Typography & Tagline) */}
        <div
          className={`text-center space-y-2 mt-4 transition-all duration-700 transform ${
            phase === 'brand' || phase === 'complete'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#007FFF] animate-ping" />
            <span className="font-mono text-xs uppercase tracking-widest text-[#38BDF8] font-bold">
              AI CITIZEN GRIEVANCE ASSISTANCE
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent drop-shadow-[0_2px_15px_rgba(56,189,248,0.5)]">
            NivaranSetu
          </h1>

          <p className="text-xs sm:text-sm font-medium text-slate-300 tracking-wide">
            A Bridge to Resolution.
          </p>
        </div>
      </div>

      {/* 4. Skip / Enter Portal Action (Discreet at Bottom) */}
      {showSkip && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 px-4 py-2 rounded-full border border-sky-500/30 bg-sky-950/40 text-xs font-semibold text-sky-200 hover:text-white hover:border-sky-400 hover:bg-sky-900/60 backdrop-blur-md transition-all cursor-pointer shadow-lg shadow-sky-950/50"
        >
          <span>Enter Portal</span>
          <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
        </button>
      )}
    </div>
  );
};
