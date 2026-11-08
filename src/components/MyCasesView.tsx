import React, { useState } from 'react';
import { GrievanceCase, CaseStage, GrievanceCategory } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  Search,
  Filter,
  Plus,
  ArrowRight,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface MyCasesViewProps {
  cases: GrievanceCase[];
  onSelectCase: (caseId: string, targetTab?: string) => void;
  onCreateNewCase: () => void;
}

export const MyCasesView: React.FC<MyCasesViewProps> = ({
  cases,
  onSelectCase,
  onCreateNewCase,
}) => {
  const { mode } = useLanguage();
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = cases.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.involvedEntity.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === 'all' || c.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            Citizen Case Management
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
            My Grievance Cases
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Track preparation progress, readiness audits, and authority resolution stages.
          </p>
        </div>

        <button
          onClick={onCreateNewCase}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Case</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Stage Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          {[
            { id: 'all', label: `All Cases (${cases.length})` },
            { id: 'drafting', label: 'Drafting' },
            { id: 'evidence_gathering', label: 'Evidence Gathering' },
            { id: 'ready_to_file', label: 'Ready to File' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStageFilter(tab.id)}
              className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer ${
                stageFilter === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case title, entity, or ID..."
            className="text-xs pl-8 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] w-full sm:w-64"
          />
        </div>

      </div>

      {/* Cases Cards Grid */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#18181B]">
            No grievance cases found matching this criteria.
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCase(c.id, 'builder')}
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">{c.id}</span>
                    
                    {c.isSampleData && (
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        DEMO SAMPLE CASE
                      </span>
                    )}

                    <span className="text-zinc-400">·</span>
                    <span className="text-[11px] font-mono uppercase text-zinc-500">{c.category.replace('_', ' ')}</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-[11px] text-zinc-400">{c.incidentLocation}</span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors">
                    {c.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {c.monitoring?.citizenReportedStatus && c.monitoring.citizenReportedStatus !== 'not_submitted' && (
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 uppercase font-mono block">MONITORING</span>
                      <span className="font-mono text-xs font-bold text-[#007FFF] uppercase">
                        {c.monitoring.citizenReportedStatus.replace('_', ' ')}
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono block">READINESS</span>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {c.readinessScore}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                {mode === 'simple' ? c.simpleSummary : c.description}
              </p>

              {/* Bottom metadata strip */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>Involved: <strong className="text-zinc-800 dark:text-zinc-200">{c.involvedEntity}</strong></span>
                  <span>Dispute: <strong className="font-mono text-zinc-800 dark:text-zinc-200">{c.disputedAmount ? `₹${c.disputedAmount.toLocaleString('en-IN')}` : 'Non-monetary'}</strong></span>
                  <span>Exhibits: <strong className="text-zinc-800 dark:text-zinc-200">{c.evidence.length} files</strong></span>
                  {(c.monitoring?.reminders?.filter((r) => r.status === 'pending').length || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[#007FFF] font-semibold text-[11px]">
                      <Clock className="w-3 h-3" />
                      {c.monitoring?.reminders?.filter((r) => r.status === 'pending').length} reminder(s)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelectCase(c.id, 'monitoring')}
                    className="px-3 py-1 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[#007FFF] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Case Monitoring</span>
                  </button>
                  <button
                    onClick={() => onSelectCase(c.id, 'dossier')}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    View Dossier
                  </button>
                  <button
                    onClick={() => onSelectCase(c.id, 'readiness')}
                    className="px-3 py-1 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg transition-colors cursor-pointer"
                  >
                    Readiness Audit →
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
