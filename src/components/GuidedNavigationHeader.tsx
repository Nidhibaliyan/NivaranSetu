/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ChevronLeft,
  ArrowRight,
  Save,
  LogOut,
  CheckCircle2,
  Sparkles,
  Clock
} from 'lucide-react';

interface GuidedNavigationHeaderProps {
  stepNumber?: number;
  totalSteps?: number;
  badgeLabel?: string;
  stepTitle: string;
  instruction: string;
  progressPercent?: number;
  lastAutosaved?: string | null;
  onBack?: () => void;
  backLabel?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  onSaveDraft?: () => void;
  onExit?: () => void;
  exitLabel?: string;
  className?: string;
}

export const GuidedNavigationHeader: React.FC<GuidedNavigationHeaderProps> = ({
  stepNumber,
  totalSteps = 5,
  badgeLabel,
  stepTitle,
  instruction,
  progressPercent,
  lastAutosaved,
  onBack,
  backLabel = 'Back',
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  onSaveDraft,
  onExit,
  exitLabel = 'Save & Exit',
  className = '',
}) => {
  const percent =
    progressPercent !== undefined
      ? progressPercent
      : stepNumber && totalSteps
      ? Math.round((stepNumber / totalSteps) * 100)
      : undefined;

  return (
    <div
      className={`rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-[#18181B]/90 backdrop-blur-md p-4 sm:p-5 shadow-xs space-y-3 ${className}`}
    >
      {/* Top Row: Meta, Step Indicator & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Step Badge & Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {stepNumber && (
              <span className="px-2 py-0.5 rounded-full bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-[11px]">
                Step {stepNumber} of {totalSteps}
              </span>
            )}

            {badgeLabel && (
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] font-semibold">
                {badgeLabel}
              </span>
            )}

            {lastAutosaved && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Autosaved {lastAutosaved}</span>
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white leading-tight">
            {stepTitle}
          </h2>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
            {instruction}
          </p>
        </div>

        {/* Action Controls: Back, Save Draft, Exit, Continue */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{backLabel}</span>
            </button>
          )}

          {onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
              title="Save changes to your local case database"
            >
              <Save className="w-3.5 h-3.5 text-[#007FFF]" />
              <span>Save</span>
            </button>
          )}

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{exitLabel}</span>
            </button>
          )}

          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              disabled={continueDisabled}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <span>{continueLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Progress Line */}
      {percent !== undefined && (
        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#007FFF] to-[#38BDF8] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  );
};
