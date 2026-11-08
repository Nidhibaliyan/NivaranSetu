import React, { useState } from 'react';
import { GrievanceCase } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  FileText,
  Search,
  Scale,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FolderOpen,
  Sparkles,
  Info
} from 'lucide-react';

interface DashboardOverviewProps {
  cases: GrievanceCase[];
  userName?: string;
  onSelectCase: (caseId: string, targetTab?: string) => void;
  onCreateNewCase: (initialDescription?: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  cases,
  userName = 'Rajesh',
  onSelectCase,
  onCreateNewCase,
  onNavigateToTab,
}) => {
  const { mode, t } = useLanguage();
  const [filterQuery, setFilterQuery] = useState('');

  const filteredCases = cases.filter(
    (c) =>
      c.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
      c.involvedEntity.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* 1. WELCOME AREA (Prompt requirements: "Hello, [User Name]!", "What would you like help with today?") */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          Hello, {userName}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          What would you like help with today?
        </p>
      </div>

      {/* 2. THREE PRIORITIZED MAIN ACTIONS (Prompt requirements: 1. Report a Problem, 2. Organise My Evidence, 3. Understand a Notice) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Action 1: Report a Problem */}
        <div
          onClick={() => onCreateNewCase()}
          className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-[#007FFF] transition-all cursor-pointer group shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center transition-transform group-hover:scale-105">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors">
                Report a Problem
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Describe an incident in everyday language. Build a structured grievance draft step by step.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-[#007FFF]">
            <span>Start Case Builder</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Action 2: Organise My Evidence */}
        <div
          onClick={() => onNavigateToTab('evidence')}
          className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-[#007FFF] transition-all cursor-pointer group shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center transition-transform group-hover:scale-105">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors">
                Organise My Evidence
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Index receipts, bank passbooks, and chat records. Connect facts to evidence exhibits.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-[#007FFF]">
            <span>Open Evidence Workspace</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Action 3: Understand a Notice */}
        <div
          onClick={() => onNavigateToTab('simplifier')}
          className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-[#007FFF] transition-all cursor-pointer group shadow-xs hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center transition-transform group-hover:scale-105">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors">
                Understand a Notice
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Translate intimidating legal notices or bank rejection letters into 5 clear takeaways in English & Hindi.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-[#007FFF]">
            <span>Open Legal Simplifier</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>

      {/* 3. HELPFUL PENDING ACTION REMINDER */}
      <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-zinc-900 dark:text-white">
              Action Required: Bank 30-Day Window Notice
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 leading-snug">
              For Case NS-2026-0842, ensure you retain the branch inward stamp copy. Once 30 days lapse without satisfactory redressal, you can file directly with the RBI Ombudsman.
            </p>
          </div>
        </div>

        <button
          onClick={() => onSelectCase('NS-2026-0842', 'dossier')}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-[#007FFF] bg-white dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 hover:bg-blue-50 transition-colors whitespace-nowrap cursor-pointer"
        >
          Check Case Status →
        </button>
      </div>

      {/* 4. MY RECENT CASES (Compact, scannable, clear status indicators) */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs">
        
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
              My Recent Cases
            </h2>
            <p className="text-xs text-zinc-500">
              Active grievances in preparation and awaiting official filing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search cases..."
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] w-48 sm:w-56"
            />
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredCases.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No cases found. Click "Report a Problem" to start your first case.
            </div>
          ) : (
            filteredCases.map((c) => {
              const stageBadge =
                c.stage === 'ready_to_file'
                  ? { label: 'Ready to file', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900' }
                  : c.stage === 'evidence_gathering'
                  ? { label: 'Evidence indexing', color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900' }
                  : { label: 'Drafting', color: 'text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700' };

              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCase(c.id, 'builder')}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">{c.id}</span>
                      {c.isSampleData && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          DEMO
                        </span>
                      )}
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-[11px] font-mono uppercase text-zinc-500">{c.category.replace(/_/g, ' ')}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">·</span>
                      <span className="text-[11px] text-zinc-400">{c.incidentLocation}</span>
                    </div>

                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors line-clamp-1">
                      {c.title}
                    </h3>

                    <div className="text-xs text-zinc-500 line-clamp-1">
                      Next action: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{c.recommendedAuthority.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${stageBadge.color}`}>
                      {stageBadge.label}
                    </span>

                    <button
                      onClick={() => onSelectCase(c.id, 'monitoring')}
                      className="px-2.5 py-1.5 text-xs font-semibold text-[#007FFF] bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer border border-blue-200 dark:border-blue-900/60"
                      title="Post-submission Smart Case Monitoring"
                    >
                      Monitoring
                    </button>

                    <button
                      onClick={() => onSelectCase(c.id, 'dossier')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg transition-colors cursor-pointer"
                    >
                      View Dossier
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

    </div>
  );
};
