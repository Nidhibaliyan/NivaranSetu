import React, { useState } from 'react';
import { TrustCheckRecord, TrustCheckStatus } from '../types';
import { SAMPLE_TRUST_CHECK_RECORDS } from '../sampleData';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Info,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Phone,
  CreditCard,
  Globe,
  Mail,
  FileSearch,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Clock,
  Shield,
  ChevronDown
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';

interface TrustCheckProps {
  onNavigateToTab?: (tab: string) => void;
  onContinueToBuilder?: (record: TrustCheckRecord) => void;
}

// Helper: Badge styling adhering strictly to palette rules with riskLevel enum as source of truth
export function getTrustCheckBadgeConfig(
  riskLevel?: TrustCheckRecord['riskLevel'] | string,
  fallbackStatus?: TrustCheckStatus
): {
  text: string;
  badgeClass: string;
  dotClass: string;
  pulseDot: boolean;
} {
  let effectiveLevel: TrustCheckRecord['riskLevel'] = 'low_risk';

  if (
    riskLevel === 'high_risk' ||
    riskLevel === 'suspicious' ||
    riskLevel === 'low_risk' ||
    riskLevel === 'verified'
  ) {
    effectiveLevel = riskLevel;
  } else if (
    riskLevel === 'Verified adverse match' ||
    riskLevel === 'Adverse catalog match' ||
    fallbackStatus === 'Verified adverse match' ||
    fallbackStatus === 'Adverse catalog match'
  ) {
    effectiveLevel = 'high_risk';
  } else if (riskLevel === 'Suspicious indicator' || fallbackStatus === 'Suspicious indicator') {
    effectiveLevel = 'suspicious';
  }

  switch (effectiveLevel) {
    case 'high_risk':
      return {
        text: 'HIGH RISK',
        badgeClass:
          'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400 border border-red-300 dark:border-red-800',
        dotClass: 'bg-red-500',
        pulseDot: true,
      };
    case 'suspicious':
      return {
        text: 'SUSPICIOUS',
        badgeClass:
          'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500',
        pulseDot: false,
      };
    case 'low_risk':
    case 'verified':
    default:
      return {
        text: 'LOW RISK',
        badgeClass:
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500',
        pulseDot: false,
      };
  }
}

// Helper: Truthful source-verification labeling without unverified government claims
export function getTrustCheckSourceLabel(record: TrustCheckRecord): {
  text: string;
  className: string;
} {
  if (record.isAiObservation) {
    return {
      text: 'AI Heuristic Observation',
      className:
        'text-[10px] font-mono font-semibold text-[#FF2E93] bg-[#FF2E93]/10 px-2 py-0.5 rounded-md border border-[#FF2E93]/20',
    };
  }

  if (record.riskLevel === 'low_risk' || record.resultStatus === 'No matching record found') {
    return {
      text: 'Curated Catalog Check',
      className:
        'text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800',
    };
  }

  return {
    text: 'Curated Catalog Match',
    className:
      'text-[10px] font-mono font-semibold text-[#007FFF] bg-[#007FFF]/10 px-2 py-0.5 rounded-md border border-[#007FFF]/20',
  };
}

// Pure evaluator for TrustCheck: categorizes input against curated catalog or truthful heuristic patterns
export function evaluateTrustCheckInput(
  rawInput: string,
  identifierType: TrustCheckRecord['type'] = 'other'
): TrustCheckRecord {
  const val = rawInput.trim();
  const found = SAMPLE_TRUST_CHECK_RECORDS.find(
    (r) => r.input.toLowerCase() === val.toLowerCase()
  );

  if (found) {
    return found;
  }

  const valLower = val.toLowerCase();

  // High risk heuristic: specific severe attack vectors / fraudulent commands / malware payloads
  // Note: 'care' has been intentionally removed from high_risk so that customer-care handles are not flagged as high risk.
  const isAdverse =
    valLower.includes('refund') ||
    valLower.includes('urgent') ||
    valLower.includes('.apk') ||
    valLower.includes('disconnect');

  // Suspicious heuristic: unverified support/care handles, generic URL schemes, anomalous TLDs
  // 'care' is included here so customer care handles (e.g. customer-care-support.xyz) evaluate as suspicious.
  const isSuspicious =
    valLower.includes('care') ||
    valLower.includes('help') ||
    valLower.includes('support') ||
    valLower.startsWith('http') ||
    valLower.includes('.xyz') ||
    valLower.includes('.top');

  const riskLevel: TrustCheckRecord['riskLevel'] = isAdverse
    ? 'high_risk'
    : isSuspicious
    ? 'suspicious'
    : 'low_risk';

  const status: TrustCheckStatus = isAdverse || isSuspicious
    ? 'Suspicious indicator'
    : 'No matching record found';

  const nowFormatted = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id: `tc-${Date.now().toString().slice(-4)}`,
    input: val,
    type: identifierType,
    riskLevel,
    resultStatus: status,
    flagTitle: isAdverse
      ? 'Heuristic Pattern Match: High-Risk Deceptive Pattern Detected'
      : isSuspicious
      ? 'Suspicious Heuristic Indicator Detected'
      : 'No Matching Adverse Record Found in Public Warnings',
    description: isAdverse
      ? `The identifier "${val}" matches heuristic indicators associated with urgent deception or unverified payload distribution. This observation is generated via algorithmic heuristics and is not a verified police or regulatory record.`
      : isSuspicious
      ? `AI heuristic scanner flagged unverified domain registration and non-standard naming patterns for "${val}". This observation is generated via algorithmic heuristics and is not a verified police or regulatory record.`
      : `No adverse records or public advisories were found matching "${val}". Please note that an absence of records does not confirm the entity is authentic.`,
    officialFindings: isAdverse
      ? [
          'Identified via local heuristic pattern analysis matching high-risk keywords.',
          'Algorithmic observation only: No confirmed police complaint or regulatory advisory indexed for this specific identifier.',
        ]
      : isSuspicious
      ? [
          'Identified by heuristic risk scanner matching unverified naming or domain patterns.',
          'Algorithmic observation only: No confirmed police complaint or regulatory advisory indexed for this specific identifier.',
        ]
      : [
          'No negative match in indexed public consumer advisories.',
          'Important: Absence of adverse findings does not confirm that this entity is authentic or safe.',
        ],
    governmentAdvisories: [
      {
        title: 'National Cyber Crime Reporting Portal Citizen Safety Advisory',
        authority: 'I4C / Ministry of Home Affairs',
        url: 'https://cybercrime.gov.in',
      },
      {
        title: 'RBI Sachet Public Caution Notice on Fake Customer Care Handles',
        authority: 'Reserve Bank of India',
        url: 'https://sachet.rbi.org.in',
      },
    ],
    sourceReferences: isAdverse
      ? [
          'Local Heuristic Risk Analysis (High-Risk Keyword Match)',
          'Public Cybercrime Safety Advisory Reference',
        ]
      : isSuspicious
      ? [
          'Local Heuristic Pattern Analysis (Suspicious Domain / Handle Indicator)',
          'Public Cybercrime Safety Advisory Reference',
        ]
      : [
          'Local Pattern Analysis (No Flagged Keywords)',
          'Public Consumer Advisory Reference',
        ],
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    lastChecked: nowFormatted,
    isAiObservation: true,
    recommendedPrecautions: [
      'NEVER enter your UPI PIN to receive money or refunds',
      'Do not install remote assistance apps (AnyDesk, TeamViewer, RustDesk)',
      'Do not open APK or executable attachments from unknown senders',
    ],
    suggestedNextSteps: [
      'If you shared financial details or money was deducted, dial 1930 immediately',
      'Block communication across phone, SMS, and WhatsApp',
      'Continue to Smart Case Builder to organize your incident evidence',
    ],
    recommendedActions: [
      'NEVER enter your UPI PIN to receive funds or refunds',
      'Do not install remote assistance applications',
      'Report the number/UPI on cybercrime.gov.in or dial 1930 immediately',
      'Block communication immediately across all messaging apps',
    ],
  };
}

export const TrustCheck: React.FC<TrustCheckProps> = ({
  onNavigateToTab,
  onContinueToBuilder,
}) => {
  const { mode } = useLanguage();
  const [identifierType, setIdentifierType] = useState<
    'upi' | 'phone' | 'bank_account' | 'url' | 'email' | 'other'
  >('upi');
  const [queryInput, setQueryInput] = useState('');
  const [activeResult, setActiveResult] = useState<TrustCheckRecord | null>(SAMPLE_TRUST_CHECK_RECORDS[1]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showNextStepsHelp, setShowNextStepsHelp] = useState(false);

  // Perform lookup with verified public advisories and heuristic detection
  const handlePerformCheck = (valToUse?: string) => {
    const val = (valToUse || queryInput).trim();
    if (!val) return;

    setIsSearching(true);
    setTimeout(() => {
      const result = evaluateTrustCheckInput(val, identifierType);
      setActiveResult(result);
      setIsSearching(false);
    }, 400);
  };

  const loadSample = (sample: TrustCheckRecord) => {
    setQueryInput(sample.input);
    setIdentifierType(
      sample.type === 'phone'
        ? 'phone'
        : sample.type === 'upi'
        ? 'upi'
        : sample.type === 'url'
        ? 'url'
        : sample.type === 'email'
        ? 'email'
        : sample.type === 'bank_account'
        ? 'bank_account'
        : 'other'
    );
    setActiveResult(sample);
  };

  // Status badge styling adhering strictly to palette rules with riskLevel enum as source of truth
  const renderStatusBadge = (riskLevel?: TrustCheckRecord['riskLevel'], status?: TrustCheckStatus) => {
    const config = getTrustCheckBadgeConfig(riskLevel, status);
    return (
      <span
        data-testid="trustcheck-badge"
        data-risk-level={riskLevel || 'low_risk'}
        className={`px-3 py-1 rounded-full text-xs font-bold font-mono border flex items-center gap-1.5 ${config.badgeClass}`}
      >
        <span
          className={`w-2 h-2 rounded-full ${config.dotClass} ${config.pulseDot ? 'animate-pulse' : ''}`}
        />
        {config.text}
      </span>
    );
  };

  const handleContinueToSmartCaseBuilder = () => {
    if (!activeResult) return;
    if (onContinueToBuilder) {
      onContinueToBuilder(activeResult);
    } else if (onNavigateToTab) {
      onNavigateToTab('new_case');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Guided Step Navigation Header */}
      <GuidedNavigationHeader
        stepNumber={1}
        totalSteps={7}
        badgeLabel="Stage 1 · Pre-Screening"
        stepTitle="Verify & Check Suspicious Identifier"
        instruction="Check payment handles, telephone numbers, bank accounts, or web links against curated fraud pattern catalogs and public safety indicators before building your case."
        progressPercent={14}
        onBack={onNavigateToTab ? () => onNavigateToTab('overview') : undefined}
        backLabel="Dashboard"
        onContinue={activeResult ? handleContinueToSmartCaseBuilder : undefined}
        continueLabel="Continue to Case Builder"
        onExit={onNavigateToTab ? () => onNavigateToTab('overview') : undefined}
        exitLabel="Exit to Dashboard"
      />
      
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider font-mono">
          YOUR WORKSPACE · MODULE 1
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          TrustCheck
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Check suspicious identifiers against curated pattern catalogs and safety indicators before you proceed.
        </p>
      </div>

      {/* Start with TrustCheck Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-bold text-zinc-950 dark:text-white">
            Start with TrustCheck
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Check mobile numbers, UPI IDs, bank accounts, website URLs, and email addresses. If you have been targeted or suffered a loss, carry your findings directly into Smart Case Builder.
          </p>
        </div>
      </div>

      {/* Main Suspicious Identifier Check Form */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs">
        
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-950 dark:text-white">
            Suspicious identifier check
          </h2>
          <p className="text-xs text-zinc-500">
            Verify payment handles, telephone numbers, bank accounts, or web links against curated pattern catalogs and public safety indicators.
          </p>
        </div>

        {/* Identifier Type Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { id: 'upi', label: 'UPI ID / VPA', icon: CreditCard },
            { id: 'phone', label: 'Mobile Number', icon: Phone },
            { id: 'bank_account', label: 'Bank Account / IFSC', icon: Shield },
            { id: 'url', label: 'Website URL', icon: Globe },
            { id: 'email', label: 'Email Address', icon: Mail },
            { id: 'other', label: 'Other Identifier', icon: FileSearch },
          ].map((type) => {
            const Icon = type.icon;
            const isSelected = identifierType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setIdentifierType(type.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#007FFF] text-white border-[#007FFF] shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Input Bar */}
        <div className="space-y-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePerformCheck()}
              placeholder={
                identifierType === 'upi'
                  ? 'Enter UPI ID (e.g., refund-desk99@oksbi)'
                  : identifierType === 'phone'
                  ? 'Enter 10-digit mobile number (e.g., 8910293812)'
                  : identifierType === 'bank_account'
                  ? 'Enter Account Number or IFSC code'
                  : identifierType === 'url'
                  ? 'Enter website URL (e.g., https://fast-ebill-update.xyz/pay.apk)'
                  : identifierType === 'email'
                  ? 'Enter email address (e.g., support-claims@refunds-portal.in)'
                  : 'Enter suspicious entity or registration number'
              }
              className="w-full pl-4 pr-28 py-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 transition-colors"
            />
            <button
              onClick={() => handlePerformCheck()}
              disabled={isSearching || !queryInput.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-[#007FFF] hover:bg-[#0070e0] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Check</span>
                </>
              )}
            </button>
          </div>

          {/* Quick preset samples */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-zinc-500">
            <span className="text-[11px] font-medium text-zinc-400">Try illustrative test patterns:</span>
            {SAMPLE_TRUST_CHECK_RECORDS.map((rec) => (
              <button
                key={rec.id}
                onClick={() => loadSample(rec)}
                className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] dark:hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                {rec.input}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Structured TrustCheck Report */}
      {activeResult && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-sm animate-fade-in">
          
          {/* Top Report Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {renderStatusBadge(activeResult.riskLevel, activeResult.resultStatus)}
                
                {(() => {
                  const sourceConfig = getTrustCheckSourceLabel(activeResult);
                  return (
                    <span className={sourceConfig.className}>
                      {sourceConfig.text}
                    </span>
                  );
                })()}

                {!activeResult.isAiObservation && (
                  <span className="text-[10px] font-mono font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                    Offline Catalog Reference · Not a live police or government DB lookup
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-zinc-950 dark:text-white pt-1">
                {activeResult.flagTitle}
              </h3>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500">
                <span>
                  Identifier Checked: <strong className="text-zinc-900 dark:text-white">{activeResult.input}</strong>
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <Clock className="w-3 h-3" />
                  Last checked: {activeResult.lastChecked || activeResult.timestamp}
                </span>
              </div>
            </div>

            {/* Carry Findings to Case Action Button */}
            <button
              onClick={handleContinueToSmartCaseBuilder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-md shadow-[#007FFF]/20 cursor-pointer shrink-0"
            >
              <span>Continue to Smart Case Builder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Official Findings & Pattern Assessment */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Pattern & Advisory Analysis</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {activeResult.isAiObservation ? 'Observed via algorithmic scan' : 'Curated catalog pattern reference'}
              </span>
            </div>

            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
              {activeResult.description}
            </p>

            {activeResult.officialFindings && activeResult.officialFindings.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {activeResult.officialFindings.map((finding, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400 p-2.5 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Government Advisories & Source References */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Public Safety Portals (General Guidance & Awareness)</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                General guidance links & catalog references
              </span>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              These links provide general guidance and public safety resources. Reference to a public safety portal does not establish that this specific identifier or URL was investigated or blacklisted by the authority.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeResult.governmentAdvisories?.map((adv, i) => (
                <a
                  key={i}
                  href={adv.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 hover:border-[#007FFF]/50 hover:bg-[#007FFF]/5 transition-all group"
                >
                  <div className="space-y-0.5 pr-2">
                    <div className="font-semibold text-zinc-900 dark:text-white group-hover:text-[#007FFF] transition-colors">
                      {adv.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{adv.authority}</div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#007FFF] shrink-0" />
                </a>
              ))}

              {activeResult.sourceReferences.map((ref, i) => (
                <div
                  key={`ref-${i}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#007FFF]" />
                    <span>{ref}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Reference</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Recommended Precautions & Next Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            
            {/* Recommended Precautions */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Recommended Precautions</span>
              </div>
              <div className="space-y-1.5">
                {(activeResult.recommendedPrecautions || activeResult.recommendedActions).map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Next Steps */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Suggested Next Steps</span>
              </div>
              <div className="space-y-1.5">
                {(activeResult.suggestedNextSteps || activeResult.recommendedActions).map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Mandatory Public Data Disclaimer */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex items-start gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-700 dark:text-zinc-300">Public Advisory Transparency Notice: </strong>
              TrustCheck references accessible official government awareness notices, cybercrime bulletins, and curated pattern references. Linked government portals provide general regulatory information and do not confirm that an authority has independently investigated or verified a specific submitted identifier. A missing adverse result does not prove an identifier is authentic or safe. Always exercise caution.
            </div>
          </div>

          {/* Direct CTA carrying findings into case builder */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#007FFF]/5 border border-[#007FFF]/20">
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              Did you lose money or receive unauthorized demands from this identifier?
            </div>
            <button
              onClick={handleContinueToSmartCaseBuilder}
              className="px-4 py-2 bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-xs"
            >
              Carry into Smart Case Builder →
            </button>
          </div>

        </div>
      )}

      {/* "What happens next?" Progressive Disclosure Section */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 sm:p-6 space-y-4 shadow-xs">
        <button
          type="button"
          onClick={() => setShowNextStepsHelp(!showNextStepsHelp)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
        >
          <div>
            <h2 className="text-sm font-bold text-zinc-950 dark:text-white group-hover:text-[#007FFF] transition-colors">
              What happens next after checking?
            </h2>
            <p className="text-xs text-zinc-500">
              {showNextStepsHelp ? 'Hide guided pipeline details' : 'Click to preview the remaining steps to resolution'}
            </p>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-zinc-400 group-hover:text-[#007FFF] transition-transform duration-200 ${
              showNextStepsHelp ? 'transform rotate-180' : ''
            }`}
          />
        </button>

        {showNextStepsHelp && (
          <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 animate-fade-in">
            {[
              {
                step: '2',
                tab: 'builder',
                title: 'Smart Case Builder',
                desc: 'Turn an incident description into a structured case.',
              },
              {
                step: '3',
                tab: 'evidence',
                title: 'Evidence Intelligence',
                desc: 'Organize files, facts, sources and timeline.',
              },
              {
                step: '4',
                tab: 'readiness',
                title: 'Case Readiness',
                desc: 'See what is present and what is still missing.',
              },
            ].map((item) => (
              <div
                key={item.step}
                onClick={() => onNavigateToTab && onNavigateToTab(item.tab)}
                className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-4 cursor-pointer group bg-zinc-50/50 dark:bg-zinc-900/40"
              >
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs font-bold text-zinc-400 mt-0.5">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-[#007FFF] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#007FFF] transform group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
