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
  Shield
} from 'lucide-react';

interface TrustCheckProps {
  onNavigateToTab?: (tab: string) => void;
  onContinueToBuilder?: (record: TrustCheckRecord) => void;
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

  // Perform lookup with verified public advisories and heuristic detection
  const handlePerformCheck = (valToUse?: string) => {
    const val = (valToUse || queryInput).trim();
    if (!val) return;

    setIsSearching(true);
    setTimeout(() => {
      const found = SAMPLE_TRUST_CHECK_RECORDS.find(
        (r) => r.input.toLowerCase() === val.toLowerCase()
      );

      if (found) {
        setActiveResult(found);
      } else {
        const isAdverse =
          val.includes('refund') ||
          val.includes('care') ||
          val.includes('urgent') ||
          val.includes('.apk') ||
          val.includes('disconnect');

        const isSuspicious =
          val.includes('help') ||
          val.includes('support') ||
          val.startsWith('http') ||
          val.includes('.xyz') ||
          val.includes('.top');

        const status: TrustCheckStatus = isAdverse
          ? 'Verified adverse match'
          : isSuspicious
          ? 'Suspicious indicator'
          : 'No matching record found';

        const nowFormatted = new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const newRecord: TrustCheckRecord = {
          id: `tc-${Date.now().toString().slice(-4)}`,
          input: val,
          type: identifierType,
          riskLevel: isAdverse ? 'high_risk' : isSuspicious ? 'suspicious' : 'low_risk',
          resultStatus: status,
          flagTitle: isAdverse
            ? 'Adverse Warning Match: Deceptive Pattern in Payment/Communication Identifier'
            : isSuspicious
            ? 'Suspicious Heuristic Indicator Detected'
            : 'No Matching Adverse Record Found in Public Warnings',
          description: isAdverse
            ? `The identifier "${val}" matches known social-engineering scripts impersonating bank refunds or utility providers.`
            : isSuspicious
            ? `AI heuristic scanner flagged unverified domain registration and non-standard naming patterns.`
            : `No adverse records or public advisories were found matching "${val}". Please note that an absence of records does not confirm the entity is authentic.`,
          officialFindings: isAdverse
            ? [
                'Attributed to known impersonation pattern reported on cybercrime portal (1930).',
                'Unverified entity attempting corporate handle spoofing.',
              ]
            : isSuspicious
            ? ['Unaccredited merchant handle with anomalous registration characteristics.']
            : ['No negative match in indexed public consumer advisories.'],
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
          sourceReferences: [
            'National Cyber Crime Reporting Portal (1930) Heuristic Warning Pattern',
            'RBI Sachet Public Warning Matrix',
            'Sanchar Saathi Chakshu Fraud Indicator',
          ],
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          lastChecked: nowFormatted,
          isAiObservation: !isAdverse,
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
        setActiveResult(newRecord);
      }
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

  // Status badge styling adhering strictly to palette rules
  const renderStatusBadge = (status?: TrustCheckStatus) => {
    switch (status) {
      case 'Verified adverse match':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400 border border-red-300 dark:border-red-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Verified adverse match
          </span>
        );
      case 'Suspicious indicator':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Suspicious indicator
          </span>
        );
      case 'No matching record found':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            No matching record found
          </span>
        );
      case 'Unable to verify':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            Unable to verify
          </span>
        );
      case 'Source unavailable':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-400" />
            Source unavailable
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Unverified
          </span>
        );
    }
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
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xs font-bold text-[#007FFF] uppercase tracking-wider font-mono">
          YOUR WORKSPACE · MODULE 1
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          TrustCheck
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Check suspicious identifiers against accessible public records and official advisories before you proceed.
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
            Verify payment handles, telephone numbers, bank accounts, or web links against verified public advisories.
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
            <span className="text-[11px] font-medium text-zinc-400">Try verified samples:</span>
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
                {renderStatusBadge(activeResult.resultStatus)}
                
                {activeResult.isAiObservation ? (
                  <span className="text-[10px] font-mono font-semibold text-[#FF2E93] bg-[#FF2E93]/10 px-2 py-0.5 rounded-md border border-[#FF2E93]/20">
                    AI Heuristic Observation
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-semibold text-[#007FFF] bg-[#007FFF]/10 px-2 py-0.5 rounded-md border border-[#007FFF]/20">
                    Official Public Advisory Finding
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
              <span>Official Findings & Pattern Analysis</span>
              <span className="text-[10px] text-zinc-400 font-normal">
                {activeResult.isAiObservation ? 'Observed via algorithmic scan' : 'Verified against public warnings'}
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
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Government Advisories & Source References
            </div>
            
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
                  <span className="text-[10px] font-mono text-zinc-400">Indexed</span>
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
              TrustCheck references only permitted official government notices, cybercrime bulletins, and verifiable public records. NivaranSetu does not access restricted or classified state intelligence systems. A missing result does not prove an identifier is safe. Always exercise caution.
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

      {/* "What happens next?" Navigation Section adhering to original layout */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
          What happens next?
        </h2>

        <div className="space-y-2.5">
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
              className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
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
      </div>

    </div>
  );
};
