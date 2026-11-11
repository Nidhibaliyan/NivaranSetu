
import React, { useState } from 'react';
import {
  Lightbulb,
  Target,
  Users,
  Wrench,
  Award,
  ArrowRight,
} from 'lucide-react';

export interface MilestoneDef {
  id: string;
  stepNumber: string;
  title: string;
  desc: string;
  targetTab: string;
  colorHex: string;
  bgGradient: string;
  shadowColor: string;
  icon: React.ComponentType<{ className?: string }>;
  isUpper: boolean;
}

export const FIVE_STEP_ROADMAP: MilestoneDef[] = [
  {
    id: 'step-1',
    stepNumber: 'Step 01',
    title: 'Verify & Check',
    desc: 'Pre-screen suspicious UPI handles, phone numbers, or links against public advisories.',
    targetTab: 'trust',
    colorHex: '#00B4D8',
    bgGradient: 'from-[#00C2E8] to-[#0096C7]',
    shadowColor: 'rgba(0,180,216,0.35)',
    icon: Lightbulb,
    isUpper: true,
  },
  {
    id: 'step-2',
    stepNumber: 'Step 02',
    title: 'Structure Incident',
    desc: 'Describe what happened in voice or text. AI organizes facts, dates, entities and claimed loss.',
    targetTab: 'new_case',
    colorHex: '#2563EB',
    bgGradient: 'from-[#3B82F6] to-[#1D4ED8]',
    shadowColor: 'rgba(37,99,235,0.35)',
    icon: Target,
    isUpper: false,
  },
  {
    id: 'step-3',
    stepNumber: 'Step 03',
    title: 'Evidence Vault',
    desc: 'Preserve receipts, invoices and statements with SHA-256 cryptographic custody proof.',
    targetTab: 'evidence',
    colorHex: '#8B5CF6',
    bgGradient: 'from-[#A78BFA] to-[#7C3AED]',
    shadowColor: 'rgba(139,92,246,0.35)',
    icon: Users,
    isUpper: true,
  },
  {
    id: 'step-4',
    stepNumber: 'Step 04',
    title: 'Official Filing',
    desc: 'Side-by-side guided companion matching your case facts into government portal fields.',
    targetTab: 'navigator',
    colorHex: '#EF4444',
    bgGradient: 'from-[#F87171] to-[#DC2626]',
    shadowColor: 'rgba(239,68,68,0.35)',
    icon: Wrench,
    isUpper: false,
  },
  {
    id: 'step-5',
    stepNumber: 'Step 05',
    title: 'Track & Resolve',
    desc: 'Monitor mandatory 30-day response countdown and export your case record.',
    targetTab: 'monitoring',
    colorHex: '#F59E0B',
    bgGradient: 'from-[#FBBF24] to-[#D97706]',
    shadowColor: 'rgba(245,158,11,0.35)',
    icon: Award,
    isUpper: true,
  },
];

interface CivicJourneyRoadmapProps {
  onSelectMilestone: (targetTab: string) => void;
  className?: string;
}

// One continuous, smooth SVG road.
// The road surface and centerline share exactly the same geometry.
const ROAD_PATH = `
  M -40 200
  C 30 200, 65 255, 150 255
  C 235 255, 265 145, 350 145
  C 435 145, 465 255, 550 255
  C 635 255, 665 145, 750 145
  C 835 145, 865 255, 950 255
  C 990 255, 1020 215, 1040 200
`;

export const CivicJourneyRoadmap: React.FC<
  CivicJourneyRoadmapProps
> = ({ onSelectMilestone, className = '' }) => {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const CircleNode = ({ step }: { step: MilestoneDef }) => {
    const Icon = step.icon;

    return (
      <div className="relative p-2 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-dashed transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110"
          style={{ borderColor: step.colorHex }}
        />

        <div
          className={`relative w-20 h-20 rounded-full bg-gradient-to-tr ${step.bgGradient} flex items-center justify-center text-white transition-transform duration-300 group-hover:scale-105`}
          style={{
            boxShadow: `0 12px 28px -6px ${step.shadowColor}`,
          }}
        >
          <Icon className="w-9 h-9 drop-shadow-sm" />
        </div>
      </div>
    );
  };

  const StepText = ({ step }: { step: MilestoneDef }) => (
    <div className="px-2 text-center max-w-[180px] space-y-1">
      <div
        className="text-sm font-black font-mono tracking-wide"
        style={{ color: step.colorHex }}
      >
        {step.stepNumber}
      </div>

      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white transition-colors group-hover:text-[#007FFF]">
        {step.title}
      </h4>

      <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
        {step.desc}
      </p>
    </div>
  );

  return (
    <div
      className={`relative w-full rounded-3xl bg-white dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-10 shadow-sm select-none ${className}`}
    >
      {/* HEADER */}

      <div className="text-center mb-8 sm:mb-12 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/40 text-[#007FFF] text-[11px] font-mono font-bold tracking-wider uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#007FFF] animate-pulse" />
          Your Journey Begins here !!
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          From confusion to clarity, from grievance to resolution.
        </h2>

        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Navigate smoothly from incident verification to certified dispute resolution.
        </p>
      </div>

      {/* DESKTOP ROADMAP */}

      <div className="hidden md:block py-2">
        <div className="relative w-full h-[400px]">

          {/* ROAD SVG */}

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1000 400"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Black road surface */}

            <path
              d={ROAD_PATH}
              stroke="#27272A"
              strokeWidth="40"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* White dashed centerline */}

            <path
              d={ROAD_PATH}
              stroke="#FFFFFF"
              strokeWidth="2.5"
              strokeDasharray="14 18"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.85"
              vectorEffect="non-scaling-stroke"
            />

            {/* Road exit arrow */}

            <path
              d="M 968 190 L 984 200 L 968 210"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>

          {/* FIVE STEP COLUMNS */}

          <div className="absolute inset-0 grid grid-cols-5 px-1">

            {FIVE_STEP_ROADMAP.map((step) => (
              <div
                key={step.id}
                className="relative flex flex-col items-center justify-between cursor-pointer group"
                onClick={() => onSelectMilestone(step.targetTab)}
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
                role="button"
                tabIndex={0}
                aria-label={`${step.stepNumber}: ${step.title}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectMilestone(step.targetTab);
                  }
                }}
              >
                {/* TOP POSITION */}

                {step.isUpper ? (
                  <div className="pt-2 flex justify-center">
                    <CircleNode step={step} />
                  </div>
                ) : (
                  <div className="relative -top-3 transition-transform duration-200 group-hover:-translate-y-1">
                    <StepText step={step} />
                  </div>
                )}

                {/* BOTTOM POSITION */}

                {step.isUpper ? (
                  <div className="relative top-3 transition-transform duration-200 group-hover:translate-y-1">
                    <StepText step={step} />
                  </div>
                ) : (
                  <div className="pb-2 flex justify-center">
                    <CircleNode step={step} />
                  </div>
                )}

              </div>
            ))}

          </div>
        </div>
      </div>

      {/* MOBILE ROADMAP */}

      <div className="md:hidden">
        <div className="relative pl-6 space-y-5">

          {/* Continuous vertical road */}

          <div className="absolute left-[12px] top-5 bottom-5 w-3 rounded-full bg-[#27272A]" />

          {/* Dashed centerline */}

          <div className="absolute left-[17px] top-7 bottom-7 border-l-2 border-dashed border-white/80" />

          {FIVE_STEP_ROADMAP.map((step) => {
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                onClick={() => onSelectMilestone(step.targetTab)}
                className="relative flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer active:scale-[0.98] transition-all group"
              >
                <div className="relative p-1.5 shrink-0 z-10">
                  <div
                    className="absolute inset-0 rounded-full border border-dashed"
                    style={{ borderColor: step.colorHex }}
                  />

                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-tr ${step.bgGradient} flex items-center justify-center text-white`}
                    style={{
                      boxShadow: `0 4px 12px ${step.shadowColor}`,
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex-1 space-y-0.5">
                  <div
                    className="text-xs font-black font-mono"
                    style={{ color: step.colorHex }}
                  >
                    {step.stepNumber}
                  </div>

                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[#007FFF]">
                    {step.title}
                  </h4>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">
                    {step.desc}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#007FFF] group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default CivicJourneyRoadmap;
