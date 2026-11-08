import React from 'react';
import { GrievanceCase } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  ListTodo,
  ExternalLink,
  Info
} from 'lucide-react';

interface CaseReadinessProps {
  currentCase: GrievanceCase;
  onNavigateToBuilder: () => void;
  onNavigateToNavigator: () => void;
}

export const CaseReadiness: React.FC<CaseReadinessProps> = ({
  currentCase,
  onNavigateToBuilder,
  onNavigateToNavigator,
}) => {
  const { mode } = useLanguage();
  const score = currentCase.readinessScore;
  const breakdown = currentCase.readinessBreakdown;

  // Determine readiness status tier
  const isHighReadiness = score >= 80;
  const isMediumReadiness = score >= 60 && score < 80;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            Pre-Filing Intelligence
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
            Case Readiness Assessment
          </h2>
          <div className="text-xs text-zinc-500 mt-1">
            Case {currentCase.id}: {currentCase.title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToBuilder}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            Add More Evidence
          </button>
          <button
            onClick={onNavigateToNavigator}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg transition-colors"
          >
            <span>Proceed to Navigator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mandatory Disclaimer Callout */}
      <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3 text-xs text-zinc-700 dark:text-zinc-300">
        <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-zinc-900 dark:text-white">
            Informational Preparation Aid — Not a Legal Guarantee
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            This score evaluates document completeness, timeline chronological clarity, and mandatory statutory prerequisites. It helps identify gaps to avoid administrative rejections, but does not constitute legal advice or guarantee official case acceptance or awards by courts or ombudsmen.
          </p>
        </div>
      </div>

      {/* Score Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Score Radial Visual Card */}
        <div className="md:col-span-5 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-center space-y-4">
          <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
            {/* SVG circle progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                className="text-zinc-100 dark:text-zinc-800"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * score) / 100}
                strokeLinecap="round"
                className={isHighReadiness ? 'text-emerald-500' : isMediumReadiness ? 'text-amber-500' : 'text-red-500'}
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold font-mono tabular-nums text-zinc-950 dark:text-white">
                {score}%
              </span>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Readiness
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {isHighReadiness
                ? 'Strong Grievance Foundation'
                : isMediumReadiness
                ? 'Moderate Readiness — Key Proof Missing'
                : 'Insufficient Evidence for Filing'}
            </h3>
            <p className="text-xs text-zinc-500">
              {isHighReadiness
                ? 'Your evidence chain satisfies primary statutory prerequisites for complaint filing.'
                : 'Adding the recommended documents below will significantly strengthen your case.'}
            </p>
          </div>
        </div>

        {/* 4 Pillars Breakdown */}
        <div className="md:col-span-7 space-y-3.5">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white px-1">
            Four Core Pillars of Grievance Readiness
          </div>

          {/* Pillar 1 */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white">1. Evidence Completeness</span>
              <span className="font-mono tabular-nums font-semibold text-[#007FFF]">{breakdown.evidenceCompleteness}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[#007FFF]" style={{ width: `${breakdown.evidenceCompleteness}%` }} />
            </div>
            <div className="text-[11px] text-zinc-500">
              Tax invoice, transactional debit slips, or official correspondence present.
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white">2. Chronological Timeline Continuity</span>
              <span className="font-mono tabular-nums font-semibold text-[#007FFF]">{breakdown.timelineClarity}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[#007FFF]" style={{ width: `${breakdown.timelineClarity}%` }} />
            </div>
            <div className="text-[11px] text-zinc-500">
              Verified date markers established without gaps in incident sequence.
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white">3. Identity & Consumer Status Proof</span>
              <span className="font-mono tabular-nums font-semibold text-[#007FFF]">{breakdown.identityProof}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[#007FFF]" style={{ width: `${breakdown.identityProof}%` }} />
            </div>
            <div className="text-[11px] text-zinc-500">
              Complainant name matches bank account, booking allotment, or retail invoice.
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-900 dark:text-white">4. Prior Formal Notice to Respondent</span>
              <span className="font-mono tabular-nums font-semibold text-[#007FFF]">{breakdown.formalNoticeSent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-[#007FFF]" style={{ width: `${breakdown.formalNoticeSent}%` }} />
            </div>
            <div className="text-[11px] text-zinc-500">
              Statutory 15-day / 30-day notice served to company prior to external escalation.
            </div>
          </div>

        </div>

      </div>

      {/* Actionable Improvement Checklist */}
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
        <div className="flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-[#007FFF]" />
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Actionable Next Steps to Reach 95%+ Readiness
          </h3>
        </div>

        <div className="space-y-3">
          {currentCase.missingElements.length > 0 ? (
            currentCase.missingElements.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 flex items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">
                    Missing: {item}
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Uploading this proof will elevate your score by approximately +10% and prevent authority queries.
                  </div>
                </div>

                <button
                  onClick={onNavigateToBuilder}
                  className="px-3 py-1.5 text-[11px] font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg shrink-0 transition-colors"
                >
                  Upload File
                </button>
              </div>
            ))
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Congratulations! Your case dossier contains all primary statutory prerequisites. Proceed to the Resolution Navigator to view official filing links.</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
            <span>Recommended Next Action:</span>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {currentCase.recommendedAuthority.name} ({currentCase.recommendedAuthority.portalName})
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
