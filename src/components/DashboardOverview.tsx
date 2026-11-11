/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GrievanceCase } from '../types';
import { CivicJourneyRoadmap } from './CivicJourneyRoadmap';
import { Plus, ArrowRight } from 'lucide-react';

interface DashboardOverviewProps {
  cases: GrievanceCase[];
  userName?: string;
  onSelectCase?: (caseId: string, targetTab?: string) => void;
  onCreateNewCase: (initialDescription?: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  cases = [],
  userName,
  onSelectCase,
  onCreateNewCase,
  onNavigateToTab,
}) => {
  const activeList = (cases || []).filter((c) => c.status !== 'resolved');
  const primaryCase = activeList[0] || (cases && cases[0]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2 pb-16">
      
      {/* 1. GREETING AT THE TOP + 2. COMPACT REPORT A CASE BUTTON */}
      <div className="flex items-center justify-between gap-4">
        {/* Simple, welcoming "Hello! 👋" - personalized if userName is present */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Hello{userName ? `, ${userName}` : ''}! 👋
        </h1>

        {/* Prominent but compact "Report a Case" button near greeting */}
        <button
          onClick={() => onCreateNewCase()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Report a Case</span>
        </button>
      </div>

      {/* 2. RESUME ACTIVE CASE BANNER OR EMPTY CASE STATE */}
      {primaryCase ? (
        <div className="p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/40 via-white to-blue-50/20 dark:from-blue-950/20 dark:via-[#18181B] dark:to-blue-950/10 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#007FFF]/10 text-[#007FFF]">
                Active Grievance · {primaryCase.id}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {primaryCase.category.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white line-clamp-1">
              {primaryCase.title}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
              Respondent: <strong className="text-zinc-800 dark:text-zinc-200">{primaryCase.involvedEntity}</strong> · Readiness: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{primaryCase.readinessScore}%</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {cases.length > 1 && (
              <button
                type="button"
                onClick={() => onNavigateToTab('my_cases')}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                All Cases ({cases.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectCase ? onSelectCase(primaryCase.id, 'builder') : onNavigateToTab('builder')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span>Resume Case</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
          No active grievances yet. Click <strong className="text-zinc-700 dark:text-zinc-300">"Report a Case"</strong> above or explore the civic journey roadmap below to get started.
        </div>
      )}

      {/* 3. INTERACTIVE ROADMAP - The Main Visual Element */}
      <CivicJourneyRoadmap onSelectMilestone={onNavigateToTab} />

      {/* 4. ONE SMALL BUTTON AT THE BOTTOM */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => onNavigateToTab('trust')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-blue-200/80 dark:border-zinc-700 hover:border-[#007FFF] text-[#007FFF] dark:text-[#38BDF8] text-xs font-semibold hover:bg-[#007FFF]/5 transition-all shadow-xs cursor-pointer group"
        >
          <span>Start Your Journey</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

    </div>
  );
};
