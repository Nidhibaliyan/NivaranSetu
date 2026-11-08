import React, { useState, useEffect } from 'react';
import { GrievanceCase } from '../types';
import { AUTHORITY_GUIDES, INITIAL_CASES } from '../sampleData';
import { useLanguage } from '../context/LanguageContext';
import {
  generatePortalWalkthrough,
  PortalWalkthrough,
  WalkthroughStep,
  PortalFieldMapping
} from '../data/portalWalkthroughs';
import { createCustodyEvent } from '../utils/caseStorage';
import {
  Compass,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Shield,
  FileText,
  Building,
  HelpCircle,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Eye,
  Maximize2,
  Download,
  AlertTriangle,
  Lock,
  Workflow,
  CheckSquare,
  Square,
  RefreshCw,
  Info,
  Globe
} from 'lucide-react';

interface ResolutionNavigatorProps {
  currentCase?: GrievanceCase;
  onNavigateToDossier: () => void;
  onNavigateBackToBuilder?: () => void;
  onNavigateToMonitoring?: () => void;
  onUpdateCase?: (updatedCase: GrievanceCase) => void;
}

export const ResolutionNavigator: React.FC<ResolutionNavigatorProps> = ({
  currentCase,
  onNavigateToDossier,
  onNavigateBackToBuilder,
  onNavigateToMonitoring,
  onUpdateCase,
}) => {
  const { language } = useLanguage();
  const effectiveCase = currentCase || INITIAL_CASES[0];

  // Active Authority Guide
  const [selectedGuideId, setSelectedGuideId] = useState<string>(
    effectiveCase
      ? AUTHORITY_GUIDES.find((g) => g.category === effectiveCase.category)?.id || AUTHORITY_GUIDES[0].id
      : AUTHORITY_GUIDES[0].id
  );

  // Active View Mode: 'walkthrough' (AI Visual Side-by-Side Walkthrough) | 'flowchart' (Full Stepper) | 'rules' (Statutory & Escalation)
  const [viewMode, setViewMode] = useState<'walkthrough' | 'flowchart' | 'rules'>('walkthrough');

  // Active Step in Walkthrough
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Completed steps tracking (step IDs)
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Active highlighted field badge in the visual portal wireframe
  const [highlightedBadge, setHighlightedBadge] = useState<number | null>(null);

  // Copy tracking states (fieldId -> boolean)
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);

  // Final acknowledgement state
  const [ackNumber, setAckNumber] = useState<string>('');
  const [ackFilingDate, setAckFilingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ackSavedSuccess, setAckSavedSuccess] = useState<boolean>(false);

  // Inline edited values for missing fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Interactive Flowchart expanded node ID (defaults to first step)
  const [expandedFlowchartStepId, setExpandedFlowchartStepId] = useState<string | null>(null);
  const [expandAllNodes, setExpandAllNodes] = useState<boolean>(false);
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  // Generate verified portal walkthrough data for active authority and case
  const walkthrough: PortalWalkthrough = generatePortalWalkthrough(
    selectedGuideId,
    effectiveCase,
    language as 'en' | 'hi'
  );

  // Pause filing session
  const handlePauseSession = () => {
    try {
      const session = {
        guideId: selectedGuideId,
        activeStepIndex,
        completedSteps,
        customFieldValues,
        pausedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem(`ns_session_${effectiveCase.id}`, JSON.stringify(session));
      setSessionToast('Filing session paused and saved. You can safely return anytime.');
      setTimeout(() => setSessionToast(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  // Resume filing session
  const handleResumeSession = () => {
    try {
      const saved = localStorage.getItem(`ns_session_${effectiveCase.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeStepIndex !== undefined) setActiveStepIndex(parsed.activeStepIndex);
        if (parsed.completedSteps) setCompletedSteps(parsed.completedSteps);
        if (parsed.customFieldValues) setCustomFieldValues(parsed.customFieldValues);
        setSessionToast(`Resumed session at step ${parsed.activeStepIndex + 1}!`);
        setTimeout(() => setSessionToast(null), 3000);
      } else {
        setSessionToast('No saved session found for this case.');
        setTimeout(() => setSessionToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeGuide = AUTHORITY_GUIDES.find((g) => g.id === selectedGuideId) || AUTHORITY_GUIDES[0];
  const activeStep: WalkthroughStep = walkthrough.steps[activeStepIndex] || walkthrough.steps[0];

  // Reset step index if authority changes
  useEffect(() => {
    setActiveStepIndex(0);
    setHighlightedBadge(null);
  }, [selectedGuideId]);

  // Handle field copy
  const handleCopyText = (fieldId: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedFieldId(fieldId);
    setTimeout(() => setCopiedFieldId(null), 2200);
  };

  // Toggle step completion
  const toggleStepCompleted = (stepId: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Mark step complete and advance
  const handleCompleteAndNext = () => {
    setCompletedSteps((prev) => ({
      ...prev,
      [activeStep.id]: true,
    }));
    if (activeStepIndex < walkthrough.steps.length - 1) {
      setActiveStepIndex(activeStepIndex + 1);
      setHighlightedBadge(null);
    }
  };

  // Save official acknowledgement and update case
  const handleSaveAcknowledgement = () => {
    if (!ackNumber.trim()) return;

    if (onUpdateCase && effectiveCase) {
      const filingEvent = createCustodyEvent(
        effectiveCase.id,
        'filing_ref_recorded',
        `External Portal Filing Recorded: ${activeGuide.authorityName}`,
        'Citizen (Browser Session)',
        `Official submission acknowledgement reference: ${ackNumber}. Filing date: ${ackFilingDate}. Portal: ${activeGuide.officialPortal}.`
      );

      const updated: GrievanceCase = {
        ...effectiveCase,
        stage: 'filed_externally',
        status: 'ready',
        lastUpdated: new Date().toISOString(),
        filingDetails: {
          referenceNumber: ackNumber,
          authority: activeGuide.authorityName,
          filingDate: ackFilingDate,
          officialAckUrl: activeGuide.portalUrl,
        },
        monitoring: {
          ...(effectiveCase.monitoring || {
            reminders: [],
            responses: [],
            generatedLetters: [],
          }),
          docketNumber: ackNumber,
          submissionDate: ackFilingDate,
          officialPortal: activeGuide.officialPortal,
          department: activeGuide.authorityName,
          citizenReportedStatus: 'submitted',
          statutoryDeadlineDays: 30,
        },
        timeline: [
          ...effectiveCase.timeline,
          {
            id: `tl-ack-${Date.now()}`,
            date: `${ackFilingDate} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            title: `Complaint Filed with ${activeGuide.authorityName}`,
            description: `Official Acknowledgement / Docket Reference Number: ${ackNumber}. 30-day statutory resolution clock initiated.`,
            verifiedByDoc: true,
          },
        ],
        custodyEvents: [
          ...(effectiveCase.custodyEvents || []),
          filingEvent,
        ],
      };
      onUpdateCase(updated);
    }

    setAckSavedSuccess(true);
    setCompletedSteps((prev) => ({
      ...prev,
      [activeStep.id]: true,
    }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* 1. TOP HEADER & AUTHORITY SWITCHER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Website Inspection & Walkthrough</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white mt-0.5">
            Resolution Navigator
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Side-by-side guided filing companion matching your approved case facts to official portal fields.
          </p>
        </div>

        {/* View mode toggle & Case Dossier Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 flex items-center gap-1 text-xs font-medium">
            <button
              onClick={() => setViewMode('walkthrough')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'walkthrough'
                  ? 'bg-white dark:bg-zinc-900 text-[#007FFF] font-semibold shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Interactive Walkthrough
            </button>
            <button
              onClick={() => setViewMode('flowchart')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'flowchart'
                  ? 'bg-white dark:bg-zinc-900 text-[#007FFF] font-semibold shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Filing Flowchart
            </button>
            <button
              onClick={() => setViewMode('rules')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'rules'
                  ? 'bg-white dark:bg-zinc-900 text-[#007FFF] font-semibold shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Rules & Escalation
            </button>
          </div>

          {onNavigateBackToBuilder && (
            <button
              onClick={onNavigateBackToBuilder}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Case Builder</span>
            </button>
          )}

          <button
            onClick={onNavigateToDossier}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <span>View Case Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. STATUTORY AUTHORITY SELECTOR STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {AUTHORITY_GUIDES.map((guide) => {
          const isSelected = guide.id === selectedGuideId;
          const isCaseMatch = guide.category === effectiveCase.category;

          return (
            <button
              key={guide.id}
              onClick={() => setSelectedGuideId(guide.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs ring-1 ring-[#007FFF]/30'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              {isCaseMatch && (
                <span className="absolute top-0 right-0 bg-[#007FFF] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg font-mono">
                  CASE MATCH
                </span>
              )}
              <div className="text-[10px] uppercase font-mono text-zinc-400">
                {guide.category.replace('_', ' ')}
              </div>
              <div className="text-xs font-bold text-zinc-900 dark:text-white mt-1 line-clamp-1">
                {guide.authorityName}
              </div>
              <div className="text-[11px] text-[#007FFF] mt-1.5 font-mono truncate">
                {guide.officialPortal}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. AI WEBSITE INSPECTION BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-white to-blue-50/40 dark:from-blue-950/20 dark:via-zinc-900/40 dark:to-blue-950/10 border border-blue-200 dark:border-blue-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3" />
              <span>{walkthrough.verificationBadge}</span>
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              Inspected URL: <strong className="text-zinc-800 dark:text-zinc-200">{walkthrough.portalUrl}</strong> (Date: {walkthrough.verifiedDate})
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            NivaranSetu inspected this portal's multi-step page sequence, field labels, and document upload constraints. Every field below maps directly to your approved case facts.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={walkthrough.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-xs"
            title="Open real government portal in a side window"
          >
            <span>Open Official Portal ↗</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4. CITIZEN SOVEREIGN CONTROL GUARANTEE */}
      <div className="px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px]">
          <Lock className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />
          <span>
            <strong className="text-zinc-900 dark:text-white">Citizen Sovereignty Guarantee:</strong> OTP, CAPTCHA, sensitive declarations, and final submission remain under your sole control. NivaranSetu provides intelligence and field-by-field guidance.
          </span>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
          Side-by-Side Companion
        </span>
      </div>

      {/* =========================================================================
          VIEW MODE 1: INTERACTIVE SIDE-BY-SIDE WALKTHROUGH (Main Special Requirement)
         ========================================================================= */}
      {viewMode === 'walkthrough' && (
        <div className="space-y-6">
          
          {/* Step Progress Stepper Bar */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Workflow className="w-4 h-4 text-[#007FFF]" />
                <span>Portal Filing Sequence: Step {activeStep.stepNumber} of {walkthrough.steps.length}</span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {Object.values(completedSteps).filter(Boolean).length}/{walkthrough.steps.length} Steps Completed
              </div>
            </div>

            {/* Stepper Node Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {walkthrough.steps.map((st, idx) => {
                const isActive = idx === activeStepIndex;
                const isDone = completedSteps[st.id];

                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setActiveStepIndex(idx);
                      setHighlightedBadge(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      isActive
                        ? 'border-[#007FFF] bg-[#007FFF]/10 text-[#007FFF] font-bold shadow-xs ring-1 ring-[#007FFF]/40'
                        : isDone
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span>STEP 0{st.stepNumber}</span>
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : isActive ? (
                        <span className="w-2 h-2 rounded-full bg-[#007FFF] animate-pulse" />
                      ) : null}
                    </div>
                    <div className="text-[11px] font-semibold truncate mt-1">
                      {st.title.split('&')[0]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DUAL PANE COMPANION WORKSPACE (7 Cols Left Field Copier vs 5 Cols Right Visual Portal Guide) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT PANE: FIELD-BY-FIELD INSTRUCTION CARDS (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Step Summary Card */}
              <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#007FFF] text-white font-mono font-bold text-xs flex items-center justify-center">
                      {activeStep.stepNumber}
                    </span>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                      {activeStep.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => toggleStepCompleted(activeStep.id)}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium cursor-pointer"
                  >
                    {completedSteps[activeStep.id] ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Completed</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        <span>Mark as Done</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {activeStep.shortDescription}
                </p>

                {/* Specific Citizen Instructions */}
                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Official Page Instructions:
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                    {activeStep.citizenInstructions.map((inst, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Individual Field Mapping Cards */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#007FFF]" />
                    <span>Portal Form Fields & Mapped Information ({activeStep.fields.length})</span>
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Click copy on each card to paste into the official portal
                  </span>
                </div>

                {activeStep.fields.map((field, fieldIdx) => {
                  const badgeNum = fieldIdx + 1;
                  const isHighlighted = highlightedBadge === badgeNum;
                  const isCopied = copiedFieldId === field.id;
                  const displayValue = customFieldValues[field.id] || field.caseValue;

                  return (
                    <div
                      key={field.id}
                      onMouseEnter={() => setHighlightedBadge(badgeNum)}
                      onMouseLeave={() => setHighlightedBadge(null)}
                      className={`p-4 rounded-2xl border transition-all ${
                        isHighlighted
                          ? 'border-[#007FFF] bg-blue-50/20 dark:bg-blue-950/20 shadow-sm ring-1 ring-[#007FFF]/40'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      {/* Field Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                            {badgeNum}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                              <span>{field.officialFieldName}</span>
                              {field.fieldType === 'file' && (
                                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-semibold">
                                  Document Upload
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              {field.fieldRequirement}
                            </div>
                          </div>
                        </div>

                        {/* Individual Copy Button */}
                        {field.fieldType !== 'file' && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(field.id, displayValue)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs ${
                              isCopied
                                ? 'bg-emerald-500 text-white'
                                : 'bg-[#007FFF] hover:bg-[#0070e0] text-white'
                            }`}
                            title="Copy exact text to paste into official website"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Explanation in Selected Language */}
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2.5 pl-7">
                        {language === 'hi' ? field.explanation.hi : field.explanation.en}
                      </p>

                      {/* Value Box or Document Box */}
                      <div className="pl-7 space-y-2">
                        {field.fieldType === 'file' ? (
                          /* Document upload matching box */
                          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-900 dark:text-white">
                                <FileText className="w-4 h-4 text-[#007FFF]" />
                                <span className="truncate max-w-[260px]">{field.matchedEvidenceName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyText(field.id, field.matchedEvidenceName || '')}
                                className="text-[11px] text-[#007FFF] hover:underline font-mono flex items-center gap-1 cursor-pointer"
                              >
                                {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                <span>{isCopied ? 'Copied' : 'Copy Filename'}</span>
                              </button>
                            </div>

                            <div className="text-[11px] text-zinc-500 font-mono">
                              Matched from Evidence Item: <strong className="text-zinc-800 dark:text-zinc-200">{field.matchedEvidenceId}</strong>
                            </div>

                            {field.portalUploadHint && (
                              <div className="text-[11px] text-[#007FFF] bg-[#007FFF]/5 p-2 rounded-lg border border-[#007FFF]/20">
                                <strong>Where to click: </strong>{field.portalUploadHint}
                              </div>
                            )}
                          </div>
                        ) : field.fieldType === 'textarea' ? (
                          /* Textarea copy box */
                          <div className="relative">
                            <textarea
                              readOnly
                              rows={4}
                              value={displayValue}
                              className="w-full text-xs p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none leading-relaxed"
                            />
                          </div>
                        ) : (
                          /* Text value copy box */
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            <span className="truncate pr-2 font-semibold">{displayValue}</span>
                            <span className="text-[10px] text-zinc-400 uppercase font-sans shrink-0">
                              {field.fieldType}
                            </span>
                          </div>
                        )}

                        {/* Source of Information tag */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1">
                          <span>Source: {field.sourceInCase}</span>
                          {field.isMissing && (
                            <span className="text-amber-500 font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Missing details in case</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step Navigation Actions */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeStepIndex === 0}
                  onClick={() => {
                    setActiveStepIndex(Math.max(0, activeStepIndex - 1));
                    setHighlightedBadge(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Step</span>
                </button>

                {activeStepIndex < walkthrough.steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleCompleteAndNext}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white transition-all shadow-xs cursor-pointer"
                  >
                    <span>Mark Done & Next Step</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Final Walkthrough Step</span>
                  </span>
                )}
              </div>

              {/* FINAL STEP: SAVE ACKNOWLEDGEMENT & DOCKET REFERENCE */}
              {activeStep.requiresCitizenAction === 'save_ack' && (
                <div className="p-5 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                        Record Your Official Portal Acknowledgement Reference
                      </h4>
                      <p className="text-[11px] text-zinc-500">
                        Enter the complaint or docket reference number generated by {activeGuide.authorityName}.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Official Complaint Reference Number:
                      </label>
                      <input
                        type="text"
                        value={ackNumber}
                        onChange={(e) => setAckNumber(e.target.value)}
                        placeholder="e.g. 202627008194821 or CC/2026/8812"
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Date of Submission:
                      </label>
                      <input
                        type="date"
                        value={ackFilingDate}
                        onChange={(e) => setAckFilingDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleSaveAcknowledgement}
                      disabled={!ackNumber.trim()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Mark Case as Filed Externally</span>
                    </button>

                    {ackSavedSuccess && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          ✓ Case Status Updated to Filed!
                        </span>
                        {onNavigateToMonitoring && (
                          <button
                            type="button"
                            onClick={onNavigateToMonitoring}
                            className="px-3.5 py-1.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                          >
                            <span>Track in Smart Case Monitoring</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT PANE: OFFICIAL PORTAL VISUAL WIREFRAME GUIDE (5 Cols) */}
            <div className="lg:col-span-5 sticky top-20 space-y-4">
              
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-md overflow-hidden">
                
                {/* Browser-like simulated window chrome */}
                <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[180px]">
                      {activeStep.officialUrl}
                    </span>
                  </div>

                  <a
                    href={activeStep.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#007FFF] hover:underline font-mono flex items-center gap-1"
                    title="Open live portal in companion tab"
                  >
                    <span>Open Live</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Simulated Portal Page Visual Mockup */}
                <div className="p-4 bg-zinc-50/60 dark:bg-zinc-950/60 space-y-4 text-xs">
                  
                  {/* Government / Institutional Portal Header */}
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 shadow-2xs">
                    <div className="text-[9px] uppercase tracking-wider font-mono text-[#007FFF] font-bold">
                      {activeStep.visualWireframe.portalHeader}
                    </div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">
                      {activeStep.visualWireframe.pageTitle}
                    </div>
                  </div>

                  {/* Highlighted Section Prompt */}
                  <div className="p-2.5 rounded-xl bg-[#007FFF]/10 border border-[#007FFF]/20 text-[11px] text-[#007FFF] flex items-center gap-2 font-medium">
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>{activeStep.visualWireframe.actionPrompt}</span>
                  </div>

                  {/* Wireframe Mock Fields with Numbered Badges */}
                  <div className="space-y-2.5 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Portal Form Layout (Fields 1 - {activeStep.visualWireframe.mockFields.length}):
                    </div>

                    {activeStep.visualWireframe.mockFields.map((mf) => {
                      const isFocused = highlightedBadge === mf.badgeNumber;

                      return (
                        <div
                          key={mf.badgeNumber}
                          onMouseEnter={() => setHighlightedBadge(mf.badgeNumber)}
                          onMouseLeave={() => setHighlightedBadge(null)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isFocused
                              ? 'border-[#007FFF] bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-[#007FFF]/30'
                              : mf.isHighlighted
                              ? 'border-[#007FFF]/60 bg-[#007FFF]/5 dark:bg-[#007FFF]/5'
                              : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-[#007FFF] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                                {mf.badgeNumber}
                              </span>
                              <span>{mf.label}</span>
                            </span>
                            <span className="text-[9px] uppercase font-mono text-zinc-400">
                              {mf.type}
                            </span>
                          </div>

                          <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800/80 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 truncate">
                            {mf.valuePlaceholder}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Visual Walkthrough Note */}
                  <div className="p-3 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 space-y-1">
                    <div className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-[#007FFF]" />
                      <span>How to use side-by-side mode:</span>
                    </div>
                    <p className="leading-snug">
                      Open your official browser window on half your screen and keep NivaranSetu on the other half. Click Copy on each field card on the left to quickly paste and complete the real form.
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: INTERACTIVE VERTICAL FILING FLOWCHART
         ========================================================================= */}
      {viewMode === 'flowchart' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          
          {/* Header & Flowchart Controls */}
          <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#007FFF] uppercase tracking-wider font-mono">
                  <Workflow className="w-3.5 h-3.5" />
                  <span>Interactive Field-by-Field Filing Flowchart</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                  Official Filing Process ({activeGuide.authorityName})
                </h3>
                <p className="text-xs text-zinc-500">
                  Connected vertical filing graph. Click any node to open its detailed field instructions and copy values.
                </p>
              </div>

              {/* Pause, Resume & Expand Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePauseSession}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-[#007FFF] text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  title="Pause and save current filing state to resume later"
                >
                  <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Pause & Save</span>
                </button>

                <button
                  type="button"
                  onClick={handleResumeSession}
                  className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-[#007FFF] text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  title="Resume previously paused session"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Resume</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpandAllNodes(!expandAllNodes)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:text-[#007FFF] transition-colors cursor-pointer"
                >
                  {expandAllNodes ? 'Collapse Nodes' : 'Expand All Nodes'}
                </button>
              </div>
            </div>

            {/* Session saved alert notification */}
            {sessionToast && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{sessionToast}</span>
              </div>
            )}

            {/* Overall Stepper Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Filing Progress: {Object.values(completedSteps).filter(Boolean).length} of {walkthrough.steps.length} steps completed
                </span>
                <span className="font-mono text-zinc-500">
                  {Math.round((Object.values(completedSteps).filter(Boolean).length / walkthrough.steps.length) * 100)}% Complete
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[#007FFF] rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((Object.values(completedSteps).filter(Boolean).length / walkthrough.steps.length) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* START NODE */}
          <div className="flex flex-col items-center">
            <div className="px-6 py-2 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>START: Open Official Portal</span>
            </div>
            <div className="w-0.5 h-7 bg-zinc-300 dark:bg-zinc-700" />
          </div>

          {/* Connected Vertical Flowchart Graph */}
          <div className="space-y-0 max-w-3xl mx-auto">
            {walkthrough.steps.map((st, i) => {
              const isDone = completedSteps[st.id];
              const isCurrent = i === activeStepIndex;
              const isExpanded = expandAllNodes || expandedFlowchartStepId === st.id || (expandedFlowchartStepId === null && i === 0);

              return (
                <div key={st.id} className="flex flex-col items-center w-full">
                  
                  {/* Flowchart Step Card */}
                  <div
                    className={`w-full rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isCurrent
                        ? 'border-[#007FFF] bg-white dark:bg-[#18181B] shadow-md ring-2 ring-[#007FFF]/20'
                        : isDone
                        ? 'border-emerald-500/40 bg-white dark:bg-[#18181B]'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B]'
                    }`}
                  >
                    {/* Node Header Row */}
                    <div
                      onClick={() => {
                        setExpandedFlowchartStepId(isExpanded && !expandAllNodes ? null : st.id);
                        setActiveStepIndex(i);
                      }}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`w-8 h-8 rounded-xl font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                            isDone
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : isCurrent
                              ? 'bg-[#007FFF] text-white shadow-xs'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {isDone ? '✓' : `0${st.stepNumber}`}
                        </span>

                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-950 dark:text-white">
                              {st.title}
                            </span>
                            {isDone && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 font-semibold">
                                Completed
                              </span>
                            )}
                            {isCurrent && !isDone && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#007FFF]/10 text-[#007FFF] font-semibold">
                                Active Step
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {st.shortDescription}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono mt-1">
                            <span>Page: <strong className="text-zinc-600 dark:text-zinc-300">{st.pageName}</strong></span>
                            <span>•</span>
                            <span>{st.fields.length} Mapped Fields</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="text-xs text-[#007FFF] font-semibold hover:underline hidden sm:inline"
                        >
                          {isExpanded ? 'Hide Details' : 'Open Instructions'}
                        </button>
                        <ChevronRight
                          className={`w-4 h-4 text-zinc-400 transform transition-transform ${
                            isExpanded ? 'rotate-90 text-[#007FFF]' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* DETAILED INSTRUCTION PANEL (Opens when node is clicked) */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-5 sm:p-6 space-y-5 animate-fade-in text-left">
                        
                        {/* Page Link & Quick Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-[#007FFF]" />
                              <span>Official URL: {st.officialUrl}</span>
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              Verified Portal Step: {st.stepNumber} of {walkthrough.steps.length}
                            </div>
                          </div>

                          <a
                            href={st.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shrink-0 shadow-xs cursor-pointer"
                          >
                            <span>Open in Companion Window ↗</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Citizen Instructions for this Step */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
                            Citizen Instructions:
                          </div>
                          <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                            {st.citizenInstructions.map((inst, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                                <span className="leading-relaxed">{inst}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Field Cards for this Step */}
                        <div className="space-y-3">
                          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono flex items-center justify-between">
                            <span>Field-by-Field Prepared Values ({st.fields.length} Fields)</span>
                            <span className="text-[10px] text-zinc-400 font-normal">
                              Copy each value into the portal
                            </span>
                          </div>

                          <div className="space-y-3">
                            {st.fields.map((f, fIdx) => {
                              const badgeNo = fIdx + 1;
                              const isCopied = copiedFieldId === f.id;
                              const val = customFieldValues[f.id] || f.caseValue;

                              return (
                                <div
                                  key={f.id}
                                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-2.5"
                                >
                                  {/* Field Header */}
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                      <span className="w-5 h-5 rounded-md bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                        {badgeNo}
                                      </span>
                                      <div>
                                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                          <span>{f.officialFieldName}</span>
                                          {f.fieldType === 'file' && (
                                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 font-mono font-bold">
                                              File Upload
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-zinc-500">
                                          {f.fieldRequirement}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Copy Button */}
                                    {f.fieldType !== 'file' && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopyText(f.id, val)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs ${
                                          isCopied
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-[#007FFF] hover:bg-[#0070e0] text-white'
                                        }`}
                                        title="Copy exact text to paste into official portal"
                                      >
                                        {isCopied ? (
                                          <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Copied!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Simple Language Explanation */}
                                  <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-7 leading-relaxed">
                                    {language === 'hi' ? f.explanation.hi : f.explanation.en}
                                  </p>

                                  {/* Value Box or Document Upload Box */}
                                  <div className="pl-7 space-y-2">
                                    {f.fieldType === 'file' ? (
                                      <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2 font-mono font-semibold text-zinc-900 dark:text-white">
                                            <FileText className="w-4 h-4 text-[#007FFF]" />
                                            <span className="truncate max-w-[280px]">{f.matchedEvidenceName}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(f.id, f.matchedEvidenceName || '')}
                                            className="text-[11px] text-[#007FFF] hover:underline font-mono flex items-center gap-1 cursor-pointer"
                                          >
                                            {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                            <span>{isCopied ? 'Copied' : 'Copy Filename'}</span>
                                          </button>
                                        </div>

                                        <div className="text-[11px] text-zinc-500 font-mono">
                                          Matched Evidence ID: <strong className="text-zinc-800 dark:text-zinc-200">{f.matchedEvidenceId}</strong>
                                        </div>

                                        {f.portalUploadHint && (
                                          <div className="text-[11px] text-[#007FFF] bg-[#007FFF]/5 p-2 rounded-lg border border-[#007FFF]/20">
                                            <strong>Where to click on portal: </strong>{f.portalUploadHint}
                                          </div>
                                        )}
                                      </div>
                                    ) : f.fieldType === 'textarea' ? (
                                      <textarea
                                        readOnly
                                        rows={4}
                                        value={val}
                                        className="w-full text-xs p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none resize-none leading-relaxed"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                                        <span className="truncate pr-2 font-semibold">{val}</span>
                                        <span className="text-[10px] text-zinc-400 uppercase font-sans shrink-0">
                                          {f.fieldType}
                                        </span>
                                      </div>
                                    )}

                                    {/* Source in case */}
                                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-0.5">
                                      <span>Source: {f.sourceInCase}</span>
                                      {f.isMissing && (
                                        <span className="text-amber-500 font-semibold flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>Missing in case facts</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Special Acknowledgement Entry if Last Step */}
                        {st.requiresCitizenAction === 'save_ack' && (
                          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span>Official Acknowledgement / Docket Recording</span>
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              Once you click Submit on the official portal, copy the generated reference docket number below to track the 30-day resolution deadline:
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                              <input
                                type="text"
                                value={ackNumber}
                                onChange={(e) => setAckNumber(e.target.value)}
                                placeholder="e.g. CMS/2026/0891238"
                                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-[#007FFF]"
                              />
                              <input
                                type="date"
                                value={ackFilingDate}
                                onChange={(e) => setAckFilingDate(e.target.value)}
                                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-[#007FFF]"
                              />
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <button
                                type="button"
                                onClick={handleSaveAcknowledgement}
                                disabled={!ackNumber.trim()}
                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
                              >
                                {ackSavedSuccess ? 'Acknowledgement Saved to Timeline ✓' : 'Save Docket Number to Case'}
                              </button>

                              {ackSavedSuccess && onNavigateToMonitoring && (
                                <button
                                  type="button"
                                  onClick={onNavigateToMonitoring}
                                  className="px-4 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                                >
                                  <span>Track in Case Monitoring</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Step Completion Footer Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                          <button
                            type="button"
                            onClick={() => toggleStepCompleted(st.id)}
                            className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer"
                          >
                            {isDone ? (
                              <>
                                <CheckSquare className="w-4 h-4 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Step Marked as Completed</span>
                              </>
                            ) : (
                              <>
                                <Square className="w-4 h-4 text-zinc-400" />
                                <span>Mark this step as completed</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setViewMode('walkthrough')}
                              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-[#007FFF] text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Open in Dual-Pane Walkthrough →
                            </button>

                            {i < walkthrough.steps.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCompletedSteps((prev) => ({ ...prev, [st.id]: true }));
                                  setExpandedFlowchartStepId(walkthrough.steps[i + 1].id);
                                  setActiveStepIndex(i + 1);
                                }}
                                className="px-4 py-1.5 rounded-lg bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                              >
                                Next Step ↓
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Flowchart Vertical Connector Line */}
                  {i < walkthrough.steps.length - 1 && (
                    <div className="flex flex-col items-center my-0.5">
                      <div className="w-0.5 h-6 bg-zinc-300 dark:bg-zinc-700" />
                      <div className="w-2 h-2 rounded-full bg-[#007FFF]/40 -my-1" />
                      <div className="w-0.5 h-6 bg-zinc-300 dark:bg-zinc-700" />
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* END NODE */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-7 bg-zinc-300 dark:bg-zinc-700" />
            <div className="px-6 py-2 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white font-mono text-xs font-bold shadow-md flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>END: Official Docket Saved & Statutory 30-Day Tracking</span>
            </div>
            
            <div className="pt-4">
              <button
                type="button"
                onClick={onNavigateToDossier}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-md shadow-[#007FFF]/20 cursor-pointer"
              >
                <span>View Complete Case Dossier</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW MODE 3: STATUTORY RULES & ESCALATION LADDER
         ========================================================================= */}
      {viewMode === 'rules' && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-8 shadow-xs">
          
          <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              Statutory Jurisdiction, Deadlines & Multi-Tier Escalation
            </h3>
            <p className="text-xs text-zinc-500">
              Legal prerequisites and hierarchical remedies under Indian administrative law.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Eligibility & Pre-requisites */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Jurisdictional Eligibility Criteria</span>
              </div>

              <div className="space-y-2">
                {activeGuide.eligibility.map((el, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2.5"
                  >
                    <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                    <span>{el}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Documentation */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#007FFF]" />
                <span>Mandatory Documentation Exhibits</span>
              </div>

              <div className="space-y-2">
                {activeGuide.requiredDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2.5"
                  >
                    <span className="text-[#007FFF] font-bold mt-0.5">•</span>
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Statutory Deadlines callout */}
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Statutory Time Limits & Legal Limitation Windows</span>
            </div>
            <p className="text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed">
              {activeGuide.statutoryDeadlines}
            </p>
          </div>

          {/* Multi-Tier Escalation Ladder */}
          <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#007FFF]" />
              <span>Multi-Tiered Escalation Ladder</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activeGuide.escalationLadder.map((tier) => (
                <div
                  key={tier.level}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#007FFF]">Tier 0{tier.level}</span>
                    <span className="font-mono text-[10px] text-zinc-400">{tier.timeline}</span>
                  </div>
                  <div className="font-bold text-xs text-zinc-900 dark:text-white">
                    {tier.tier}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    {tier.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
