import React, { useState, useEffect } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'full' | 'mark' | 'horizontal';
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
  variant = 'horizontal',
  animated = false,
}) => {
  const [isAnimating, setIsAnimating] = useState(animated);

  useEffect(() => {
    if (animated) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-xs sm:text-sm',
  };

  // Distinctive vector bridge symbol communicating connection, assistance and resolution
  const renderBridgeSymbol = () => (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl bg-zinc-900 border border-zinc-800/90 shadow-sm overflow-hidden p-1 transition-all duration-300 ${iconSizes[size]} group-hover:border-[#007FFF]/50`}
    >
      {/* Subtle ambient Cerulean glow in background */}
      <div className="absolute inset-0 bg-radial from-[#007FFF]/20 via-transparent to-transparent pointer-events-none opacity-80" />

      {/* SVG Bridge: Two spans converging to a luminous resolution keystone */}
      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10"
      >
        <defs>
          <linearGradient id="ns-left-span" x1="4" y1="32" x2="22" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#007FFF" stopOpacity="0.4" />
            <stop offset="1" stopColor="#007FFF" />
          </linearGradient>

          <linearGradient id="ns-right-span" x1="40" y1="32" x2="22" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#007FFF" stopOpacity="0.4" />
            <stop offset="1" stopColor="#007FFF" />
          </linearGradient>

          <linearGradient id="ns-deck-gradient" x1="4" y1="30" x2="40" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3F3F46" />
            <stop offset="0.5" stopColor="#007FFF" />
            <stop offset="1" stopColor="#3F3F46" />
          </linearGradient>

          <filter id="ns-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Horizontal Roadway Deck (the foundation) */}
        <line
          x1="5"
          y1="31"
          x2="39"
          y2="31"
          stroke="url(#ns-deck-gradient)"
          strokeWidth="2.2"
          strokeLinecap="round"
          className={isAnimating ? 'animate-pulse' : ''}
        />

        {/* Left Pier Foundation */}
        <line x1="8" y1="31" x2="8" y2="38" stroke="#52525B" strokeWidth="2" strokeLinecap="round" />

        {/* Right Pier Foundation */}
        <line x1="36" y1="31" x2="36" y2="38" stroke="#52525B" strokeWidth="2" strokeLinecap="round" />

        {/* Vertical suspension cables linking deck to arch */}
        <line x1="13" y1="30" x2="13" y2="23" stroke="#007FFF" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="1 1" />
        <line x1="17" y1="30" x2="17" y2="18.5" stroke="#007FFF" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="1 1" />
        <line x1="27" y1="30" x2="27" y2="18.5" stroke="#007FFF" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="1 1" />
        <line x1="31" y1="30" x2="31" y2="23" stroke="#007FFF" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="1 1" />

        {/* Left Bridge Arch Span (Citizen side rising toward resolution) */}
        <path
          d="M 6 31 C 9 22, 15 16, 22 16"
          stroke="url(#ns-left-span)"
          strokeWidth="2.8"
          strokeLinecap="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: isAnimating ? 0 : 0,
            animation: isAnimating ? 'bridgeSpanLeft 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          }}
        />

        {/* Right Bridge Arch Span (Resolution authority side extending to meet citizen) */}
        <path
          d="M 38 31 C 35 22, 29 16, 22 16"
          stroke="url(#ns-right-span)"
          strokeWidth="2.8"
          strokeLinecap="round"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: isAnimating ? 0 : 0,
            animation: isAnimating ? 'bridgeSpanRight 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          }}
        />

        {/* Resolution Nexus / Keystone (The point of connection and resolution) */}
        <circle
          cx="22"
          cy="16"
          r="3"
          fill="#007FFF"
          filter="url(#ns-glow)"
          style={{
            animation: isAnimating ? 'keystonePulse 1.6s ease-out forwards' : 'none',
          }}
        />

        {/* Restrained Neon Rose (#FF2E93) Decorative Accent Pip at Apex */}
        <circle
          cx="22"
          cy="13"
          r="1.3"
          fill="#FF2E93"
          className="opacity-90"
        />
      </svg>
    </div>
  );

  if (variant === 'mark') {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        {renderBridgeSymbol()}
      </div>
    );
  }

  return (
    <div className={`group inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      {renderBridgeSymbol()}

      <div className="flex flex-col text-left select-none">
        <div
          className={`font-bold tracking-tight text-zinc-950 dark:text-white leading-none ${textSizes[size]} ${
            isAnimating ? 'animate-fade-in' : ''
          }`}
        >
          <span>Nivaran</span>
          <span className="text-[#007FFF]">Setu</span>
        </div>

        {showSubtitle && (
          <span
            className={`text-zinc-500 dark:text-zinc-400 font-medium tracking-normal mt-0.5 ${subtitleSizes[size]} ${
              isAnimating ? 'animate-fade-in' : ''
            }`}
          >
            A Bridge to Resolution.
          </span>
        )}
      </div>
    </div>
  );
};
