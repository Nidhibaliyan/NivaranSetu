import React, { useEffect, useRef, useState } from 'react';
import {
  SuspiciousTransactionAnalysisResult,
  TrustCheckEnhancedRiskLevel,
  TrustCheckRecord,
  TrustCheckScreenshotPayload,
  TrustCheckStatus,
  TrustCheckWarningSign,
  UpiCollectAnalysisResult,
} from '../types';
import { SAMPLE_TRUST_CHECK_RECORDS } from '../sampleData';
import {
  analyzeSuspiciousTransaction,
  analyzeUpiCollectRequest,
  DeterministicFallbackPayload,
  readTrustCheckScreenshotFile,
  TrustCheckApiError,
} from '../utils/trustCheckClient';
import { useLanguage } from '../context/LanguageContext';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Info,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Phone,
  CreditCard,
  Globe,
  Mail,
  FileSearch,
  ChevronRight,
  Clock,
  Shield,
  ChevronDown,
  Lock,
  Image as ImageIcon,
  X,
  ReceiptIndianRupee,
  ScanSearch,
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';

interface TrustCheckProps {
  onNavigateToTab?: (tab: string) => void;
  onContinueToBuilder?: (record: TrustCheckRecord) => void;
}

type TrustCheckTabMode = 'identifier' | 'upi_collect' | 'suspicious_transaction';

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

export function mapEnhancedRiskToLegacy(
  riskLevel: TrustCheckEnhancedRiskLevel
): TrustCheckRecord['riskLevel'] {
  if (riskLevel === 'high') return 'high_risk';
  if (riskLevel === 'medium') return 'suspicious';
  return 'low_risk';
}

export function upiCollectResultToTrustRecord(
  result: UpiCollectAnalysisResult,
  senderUpiId?: string,
  requestedAmount?: string
): TrustCheckRecord {
  const legacyRisk = mapEnhancedRiskToLegacy(result.riskLevel);
  const safeInput =
    senderUpiId?.trim() ||
    (requestedAmount?.trim()
      ? `UPI Collect Request (₹${requestedAmount.trim()})`
      : 'UPI Collect Request Analysis');

  return {
    id: `tc-upi-${Date.now().toString().slice(-5)}`,
    input: safeInput,
    type: senderUpiId?.trim() ? 'upi' : 'other',
    riskLevel: legacyRisk,
    resultStatus: legacyRisk === 'low_risk' ? 'No matching record found' : 'Suspicious indicator',
    flagTitle: `UPI Collect Request Risk Assessment (${result.riskLevel.toUpperCase()} · Score ${result.riskScore}/100)`,
    description: result.summary,
    officialFindings: [
      ...result.observedEvidence,
      ...result.riskIndicators,
    ],
    sourceReferences: [
      `TrustCheck AI + Rule-Based Analysis (${result.modelUsed})`,
    ],
    timestamp: result.analyzedAt,
    isAiObservation: true,
    recommendedPrecautions: [result.pinSafetyNotice, ...result.recommendedImmediateActions],
    suggestedNextSteps: result.safeNextSteps,
    recommendedActions: result.recommendedImmediateActions,
  };
}

export function transactionResultToTrustRecord(
  result: SuspiciousTransactionAnalysisResult,
  amountStr: string,
  upiOrDestination?: string,
  utrOrReferenceId?: string
): TrustCheckRecord {
  const legacyRisk = mapEnhancedRiskToLegacy(result.riskLevel);
  const safeInput =
    upiOrDestination?.trim() ||
    utrOrReferenceId?.trim() ||
    (amountStr.trim() ? `Transaction ₹${amountStr.trim()}` : 'Suspicious Transaction');

  return {
    id: `tc-txn-${Date.now().toString().slice(-5)}`,
    input: safeInput,
    type: upiOrDestination?.includes('@') ? 'upi' : 'other',
    riskLevel: legacyRisk,
    resultStatus: legacyRisk === 'low_risk' ? 'No matching record found' : 'Suspicious indicator',
    flagTitle: `Suspicious Transaction Analysis (${result.riskLevel.toUpperCase()} · ${result.consistencyAssessment.toUpperCase()})`,
    description: `${result.summary} Consistency: ${result.consistencyExplanation}`,
    officialFindings: [
      ...result.observedEvidence,
      ...result.riskIndicators,
    ],
    sourceReferences: [
      `TrustCheck AI + Rule-Based Analysis (${result.modelUsed})`,
    ],
    timestamp: result.analyzedAt,
    isAiObservation: true,
    recommendedPrecautions: result.recommendedImmediateActions,
    suggestedNextSteps: result.suggestedNextSteps,
    recommendedActions: result.recommendedImmediateActions,
  };
}

function getEnhancedRiskBadgeConfig(riskLevel: TrustCheckEnhancedRiskLevel): {
  label: string;
  badgeClass: string;
} {
  if (riskLevel === 'high') {
    return {
      label: 'HIGH RISK',
      badgeClass:
        'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-400 border-red-300 dark:border-red-800',
    };
  }
  if (riskLevel === 'medium') {
    return {
      label: 'MEDIUM RISK',
      badgeClass:
        'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border-amber-300 dark:border-amber-800',
    };
  }
  return {
    label: 'LOW RISK',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
  };
}

export const TrustCheck: React.FC<TrustCheckProps> = ({
  onNavigateToTab,
  onContinueToBuilder,
}) => {
  const { mode } = useLanguage();
  void mode;
  const [activeTabMode, setActiveTabMode] = useState<TrustCheckTabMode>('identifier');

  // --- Tab 1: Existing Identifier & Link Check State ---
  const [identifierType, setIdentifierType] = useState<
    'upi' | 'phone' | 'bank_account' | 'url' | 'email' | 'other'
  >('upi');
  const [queryInput, setQueryInput] = useState('');
  const [activeResult, setActiveResult] = useState<TrustCheckRecord | null>(SAMPLE_TRUST_CHECK_RECORDS[1]);
  const [isSearching, setIsSearching] = useState(false);
  const [showNextStepsHelp, setShowNextStepsHelp] = useState(false);

  // --- Tab 2: Fake UPI Collect Request Detection State ---
  const [collectMessage, setCollectMessage] = useState('');
  const [collectAmount, setCollectAmount] = useState('');
  const [collectSenderUpi, setCollectSenderUpi] = useState('');
  const [collectScreenshot, setCollectScreenshot] = useState<TrustCheckScreenshotPayload | null>(null);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectFallback, setCollectFallback] = useState<DeterministicFallbackPayload | null>(null);
  const [collectResult, setCollectResult] = useState<UpiCollectAnalysisResult | null>(null);
  const [isAnalyzingCollect, setIsAnalyzingCollect] = useState(false);
  const collectFileInputRef = useRef<HTMLInputElement | null>(null);
  const collectAbortRef = useRef<AbortController | null>(null);

  // --- Tab 3: Suspicious Transaction Analysis State ---
  const [txnAmount, setTxnAmount] = useState('');
  const [txnDateTime, setTxnDateTime] = useState('');
  const [txnCounterparty, setTxnCounterparty] = useState('');
  const [txnDestination, setTxnDestination] = useState('');
  const [txnUtr, setTxnUtr] = useState('');
  const [txnDescription, setTxnDescription] = useState('');
  const [txnRecognizes, setTxnRecognizes] = useState<boolean | null>(null);
  const [txnAuthorized, setTxnAuthorized] = useState<boolean | null>(null);
  const [txnScreenshot, setTxnScreenshot] = useState<TrustCheckScreenshotPayload | null>(null);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [txnFallback, setTxnFallback] = useState<DeterministicFallbackPayload | null>(null);
  const [txnResult, setTxnResult] = useState<SuspiciousTransactionAnalysisResult | null>(null);
  const [isAnalyzingTxn, setIsAnalyzingTxn] = useState(false);
  const txnFileInputRef = useRef<HTMLInputElement | null>(null);
  const txnAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      collectAbortRef.current?.abort();
      txnAbortRef.current?.abort();
    };
  }, []);

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

  const hasCurrentResult =
    activeTabMode === 'identifier'
      ? Boolean(activeResult)
      : activeTabMode === 'upi_collect'
      ? Boolean(collectResult)
      : Boolean(txnResult);

  const handleContinueToSmartCaseBuilder = () => {
    let recordToForward: TrustCheckRecord | null = null;
    if (activeTabMode === 'identifier') {
      recordToForward = activeResult;
    } else if (activeTabMode === 'upi_collect' && collectResult) {
      recordToForward = upiCollectResultToTrustRecord(collectResult, collectSenderUpi, collectAmount);
    } else if (activeTabMode === 'suspicious_transaction' && txnResult) {
      recordToForward = transactionResultToTrustRecord(txnResult, txnAmount, txnDestination, txnUtr);
    }

    if (!recordToForward) return;
    if (onContinueToBuilder) {
      onContinueToBuilder(recordToForward);
    } else if (onNavigateToTab) {
      onNavigateToTab('new_case');
    }
  };

  const handleCollectScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCollectError(null);
    try {
      const payload = await readTrustCheckScreenshotFile(file);
      setCollectScreenshot(payload);
    } catch (err: any) {
      setCollectScreenshot(null);
      setCollectError(err?.message || 'Unable to load the selected screenshot.');
    } finally {
      if (collectFileInputRef.current) collectFileInputRef.current.value = '';
    }
  };

  const handleTxnScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTxnError(null);
    try {
      const payload = await readTrustCheckScreenshotFile(file);
      setTxnScreenshot(payload);
    } catch (err: any) {
      setTxnScreenshot(null);
      setTxnError(err?.message || 'Unable to load the selected screenshot.');
    } finally {
      if (txnFileInputRef.current) txnFileInputRef.current.value = '';
    }
  };

  const handleAnalyzeUpiCollect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnalyzingCollect) return;

    setCollectError(null);
    setCollectFallback(null);

    const trimmedMsg = collectMessage.trim();
    const trimmedUpi = collectSenderUpi.trim();
    if (!trimmedMsg && !collectScreenshot) {
      setCollectError('Please paste the UPI collect-request message or attach a screenshot to analyze.');
      return;
    }

    let numericAmount: number | null = null;
    if (collectAmount.trim()) {
      const parsed = Number(collectAmount.replace(/[,₹\s]/g, ''));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000_000) {
        setCollectError('Requested amount must be a valid positive number (or leave it blank).');
        return;
      }
      numericAmount = parsed;
    }

    if (trimmedUpi && !/^[a-zA-Z0-9._-]{1,64}@[a-zA-Z0-9.-]{2,40}$/.test(trimmedUpi)) {
      setCollectError('Sender UPI ID format appears invalid. Expected format like name@bankhandle (or leave blank).');
      return;
    }

    collectAbortRef.current?.abort();
    const controller = new AbortController();
    collectAbortRef.current = controller;

    setIsAnalyzingCollect(true);
    try {
      const result = await analyzeUpiCollectRequest(
        {
          message: trimmedMsg,
          requestedAmount: numericAmount,
          senderUpiId: trimmedUpi || undefined,
          screenshot: collectScreenshot,
        },
        { signal: controller.signal }
      );
      setCollectResult(result);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setCollectResult(null);
      if (err instanceof TrustCheckApiError) {
        setCollectError(err.message);
        if (err.deterministicObservations) {
          setCollectFallback(err.deterministicObservations);
        }
      } else {
        setCollectError(err?.message || 'Failed to analyze the UPI collect request.');
      }
    } finally {
      setIsAnalyzingCollect(false);
    }
  };

  const handleAnalyzeTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAnalyzingTxn) return;

    setTxnError(null);
    setTxnFallback(null);

    const cleanedAmt = txnAmount.replace(/[,₹\s]/g, '');
    const numericAmount = Number(cleanedAmt);
    if (!cleanedAmt || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100_000_000) {
      setTxnError('Please enter a valid positive transaction amount in ₹.');
      return;
    }

    if (!txnDateTime.trim() || Number.isNaN(Date.parse(txnDateTime.trim()))) {
      setTxnError('Please provide a valid transaction date and time.');
      return;
    }

    if (txnRecognizes === null) {
      setTxnError('Please select Yes or No for whether you recognize this transaction.');
      return;
    }

    if (txnAuthorized === null) {
      setTxnError('Please select Yes or No for whether you personally authorized this transaction.');
      return;
    }

    txnAbortRef.current?.abort();
    const controller = new AbortController();
    txnAbortRef.current = controller;

    setIsAnalyzingTxn(true);
    try {
      const result = await analyzeSuspiciousTransaction(
        {
          amount: numericAmount,
          dateTime: txnDateTime.trim(),
          counterpartyName: txnCounterparty.trim() || undefined,
          upiOrDestination: txnDestination.trim() || undefined,
          utrOrReferenceId: txnUtr.trim() || undefined,
          descriptionOrSms: txnDescription.trim() || undefined,
          recognizesTransaction: txnRecognizes,
          personallyAuthorized: txnAuthorized,
          screenshot: txnScreenshot,
        },
        { signal: controller.signal }
      );
      setTxnResult(result);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setTxnResult(null);
      if (err instanceof TrustCheckApiError) {
        setTxnError(err.message);
        if (err.deterministicObservations) {
          setTxnFallback(err.deterministicObservations);
        }
      } else {
        setTxnError(err?.message || 'Failed to analyze the transaction.');
      }
    } finally {
      setIsAnalyzingTxn(false);
    }
  };

  const renderWarningSignList = (signs: TrustCheckWarningSign[]) => (
    <div className="space-y-2.5">
      {signs.map((sign, idx) => {
        const isRule = sign.source === 'rule_based';
        return (
          <div
            key={`${sign.indicator}-${idx}`}
            className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{sign.indicator}</span>
              </div>
              <span
                className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                  isRule
                    ? 'bg-[#007FFF]/10 text-[#007FFF] border-[#007FFF]/25'
                    : 'bg-[#FF2E93]/10 text-[#FF2E93] border-[#FF2E93]/25'
                }`}
              >
                {isRule ? 'Rule-Based Check' : 'Gemini AI Assessment'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pl-5">
              {sign.explanation}
            </p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Guided Step Navigation Header */}
      <GuidedNavigationHeader
        stepNumber={1}
        totalSteps={7}
        badgeLabel="Stage 1 · Pre-Screening"
        stepTitle="TrustCheck Safety & Fraud Screening"
        instruction="Check suspicious identifiers, analyze unexpected UPI collect requests, or screen unfamiliar debit transactions before building your case."
        progressPercent={14}
        onBack={onNavigateToTab ? () => onNavigateToTab('overview') : undefined}
        backLabel="Dashboard"
        onContinue={hasCurrentResult ? handleContinueToSmartCaseBuilder : undefined}
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
          Pre-screen identifiers, fake UPI collect requests, and suspicious transactions with rule-based checks and Gemini AI analysis.
        </p>
      </div>

      {/* Capability Mode Switcher */}
      <div
        role="tablist"
        aria-label="TrustCheck Screening Tools"
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70"
      >
        {[
          {
            id: 'identifier' as const,
            label: 'Identifier & Link Check',
            icon: Search,
          },
          {
            id: 'upi_collect' as const,
            label: 'Fake UPI Collect Request Detection',
            icon: ScanSearch,
          },
          {
            id: 'suspicious_transaction' as const,
            label: 'Suspicious Transaction Analysis',
            icon: ReceiptIndianRupee,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTabMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`trustcheck-tab-${tab.id}`}
              onClick={() => setActiveTabMode(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'bg-[#007FFF] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-white/70 dark:hover:bg-zinc-800/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTabMode === 'identifier' && (
        <>
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
        </>
      )}

      {/* ================================================================= */}
      {/* TAB 2: FAKE UPI COLLECT REQUEST DETECTION                         */}
      {/* ================================================================= */}
      {activeTabMode === 'upi_collect' && (
        <div className="space-y-6">
          {/* Mandatory UPI PIN Safety Reminder */}
          <div className="p-4 sm:p-5 rounded-2xl border border-amber-300/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/25 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-zinc-950 dark:text-white">
                UPI PIN Golden Rule
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Entering your UPI PIN <strong>always sends (debits) money</strong> from your bank account. You never need to enter a UPI PIN or approve a collect request to receive a refund, cashback, prize, or OLX payment.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAnalyzeUpiCollect}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-5 shadow-xs"
          >
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Fake UPI Collect Request Detection
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste the collect-request text, SMS, WhatsApp prompt, or attach a screenshot before you click Approve or enter a PIN. Never paste your actual PIN, OTP, or bank password.
              </p>
            </div>

            {/* Preset Samples */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Try example scenario:
              </span>
              <button
                type="button"
                onClick={() => {
                  setCollectMessage(
                    'Congratulations! Your ₹4,500 cashback refund is approved. Tap Approve on the UPI collect request and enter your UPI PIN to receive money immediately before it expires in 5 minutes.'
                  );
                  setCollectAmount('4500');
                  setCollectSenderUpi('refund-desk99@oksbi');
                  setCollectError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                PIN-to-receive refund lure
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollectMessage(
                    'OLX buyer sent a UPI AutoPay mandate collect request for ₹12,000. Accept request to receive advance payment into your account.'
                  );
                  setCollectAmount('12000');
                  setCollectSenderUpi('buyer-payment@ybl');
                  setCollectError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                Unexpected AutoPay / OLX collect
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollectMessage(
                    'Payment request for grocery order #4821 placed 5 minutes ago at Neighborhood Kirana Store.'
                  );
                  setCollectAmount('640');
                  setCollectSenderUpi('rahul.localstore@okaxis');
                  setCollectError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                Ordinary merchant collect
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="upi-collect-message"
                className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
              >
                Collect Request Message or Description
              </label>
              <textarea
                id="upi-collect-message"
                rows={4}
                value={collectMessage}
                onChange={(e) => setCollectMessage(e.target.value)}
                placeholder="Paste the collect-request note, WhatsApp/SMS message, or explain why someone asked you to approve a UPI request..."
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="upi-collect-amount"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  Requested Amount in ₹ (Optional)
                </label>
                <input
                  id="upi-collect-amount"
                  type="text"
                  inputMode="decimal"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  placeholder="e.g., 4500"
                  className="w-full px-3.5 py-2.5 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upi-collect-sender"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  Sender / Payee UPI ID (Optional)
                </label>
                <input
                  id="upi-collect-sender"
                  type="text"
                  value={collectSenderUpi}
                  onChange={(e) => setCollectSenderUpi(e.target.value)}
                  placeholder="e.g., refund-desk99@oksbi"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>
            </div>

            {/* Optional Screenshot Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Attach UPI App Collect Screenshot (Optional · PNG, JPEG, WebP up to 5 MB)
                </label>
                {collectScreenshot && (
                  <button
                    type="button"
                    onClick={() => setCollectScreenshot(null)}
                    className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <input
                ref={collectFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleCollectScreenshotUpload}
                className="hidden"
              />

              {!collectScreenshot ? (
                <button
                  type="button"
                  onClick={() => collectFileInputRef.current?.click()}
                  className="w-full p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-[#007FFF] hover:bg-[#007FFF]/5 transition-colors flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#007FFF]" />
                  <span>Upload screenshot of UPI collect request or SMS (optional)</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`data:${collectScreenshot.mimeType};base64,${collectScreenshot.dataBase64}`}
                      alt="Uploaded UPI collect request screenshot preview"
                      className="w-12 h-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {collectScreenshot.fileName || 'Screenshot attached'}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 tabular-nums">
                        {collectScreenshot.mimeType} · {Math.max(1, Math.round((collectScreenshot.fileSizeBytes ?? 0) / 1024))} KB
                      </div>
                    </div>
                  </div>
                  <ImageIcon className="w-4 h-4 text-[#007FFF] shrink-0" />
                </div>
              )}
            </div>

            {collectError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/35 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{collectError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Any accidental PIN, OTP, CVV, password, or card digits are masked before analysis.
              </span>
              <button
                type="submit"
                disabled={isAnalyzingCollect}
                className="px-5 py-2.5 bg-[#007FFF] hover:bg-[#0070e0] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs whitespace-nowrap shrink-0"
              >
                {isAnalyzingCollect ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-4 h-4" />
                    <span>Analyze UPI Collect Request</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Honest Fallback Panel when Gemini is unavailable/errors */}
          {collectFallback && !collectResult && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#18181B] p-6 sm:p-7 space-y-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                    RULE-BASED PRE-CHECK FALLBACK · AI ASSESSMENT UNAVAILABLE
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                    Deterministic Safety Observations
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${getEnhancedRiskBadgeConfig(collectFallback.minRiskLevel).badgeClass}`}
                >
                  {getEnhancedRiskBadgeConfig(collectFallback.minRiskLevel).label}
                </span>
              </div>

              {collectFallback.pinSafetyNotice && (
                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-zinc-800 dark:text-zinc-200">
                  <strong>UPI PIN Safety Notice: </strong>
                  {collectFallback.pinSafetyNotice}
                </div>
              )}

              {collectFallback.warningSigns.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Rule-Based Warning Signs
                  </div>
                  {renderWarningSignList(collectFallback.warningSigns)}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Recommended Immediate Actions
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  {collectFallback.recommendedImmediateActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Full Structured UPI Collect Result */}
          {collectResult && (
            <div
              data-testid="upi-collect-result"
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${getEnhancedRiskBadgeConfig(collectResult.riskLevel).badgeClass}`}
                    >
                      {getEnhancedRiskBadgeConfig(collectResult.riskLevel).label}
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      Risk Score: {collectResult.riskScore}/100
                    </span>
                    <span className="text-xs text-zinc-400" aria-hidden="true">·</span>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      Gemini AI + Rule-Based Check ({collectResult.modelUsed})
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                    UPI Collect Request Risk Assessment
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleContinueToSmartCaseBuilder}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>Continue to Smart Case Builder</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {collectResult.sensitiveDataRedacted && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sensitive credential digits detected in your input were automatically redacted before sending to Gemini AI.
                  </span>
                </div>
              )}

              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
                {collectResult.summary}
              </p>

              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-950 dark:text-white">UPI PIN Safety Reminder: </strong>
                  {collectResult.pinSafetyNotice}
                </div>
              </div>

              {/* Observed Evidence vs Risk Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Observed Evidence (Submitted Facts)
                  </div>
                  <div className="space-y-1.5">
                    {collectResult.observedEvidence.map((obs, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Potential Risk Indicators
                  </div>
                  <div className="space-y-1.5">
                    {collectResult.riskIndicators.length > 0 ? (
                      collectResult.riskIndicators.map((ind, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/15 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{ind}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                        No strong deceptive risk indicators matched the provided message. Still verify the merchant personally before approving any debit.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning Signs with Rule vs AI Source */}
              {collectResult.warningSigns.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Detected Warning Signs & Explanations
                  </div>
                  {renderWarningSignList(collectResult.warningSigns)}
                </div>
              )}

              {/* Actions & Safe Next Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Recommended Immediate Actions
                  </div>
                  <div className="space-y-1.5">
                    {collectResult.recommendedImmediateActions.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Safe Next Steps
                  </div>
                  <div className="space-y-1.5">
                    {collectResult.safeNextSteps.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex items-start gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
                <span>{collectResult.aiDisclaimer}</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#007FFF]/5 border border-[#007FFF]/20">
                <div className="text-xs text-zinc-700 dark:text-zinc-300">
                  Already lost money or want to prepare a complaint dossier from this collect request?
                </div>
                <button
                  type="button"
                  onClick={handleContinueToSmartCaseBuilder}
                  className="px-4 py-2 bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-xs"
                >
                  Carry into Smart Case Builder →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: SUSPICIOUS TRANSACTION ANALYSIS                            */}
      {/* ================================================================= */}
      {activeTabMode === 'suspicious_transaction' && (
        <div className="space-y-6">
          <div className="p-4 sm:p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-[#007FFF]/10 text-[#007FFF] flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-zinc-950 dark:text-white">
                Privacy & Assessment Notice
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                This tool provides an AI-assisted safety review — <strong>not confirmation from your bank or NPCI</strong>. Never enter your UPI PIN, OTP, CVV, netbanking password, or full card/bank account number.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleAnalyzeTransaction}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-5 shadow-xs"
          >
            <div className="space-y-1">
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Suspicious Transaction Analysis
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Enter the debit details you observed in your SMS or statement and answer whether you recognize and authorized it.
              </p>
            </div>

            {/* Preset Examples */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Try example scenario:
              </span>
              <button
                type="button"
                onClick={() => {
                  setTxnAmount('18500');
                  setTxnDateTime('2026-03-10T22:15');
                  setTxnCounterparty('Unknown Payee');
                  setTxnDestination('kyc-helpdesk@ybl');
                  setTxnUtr('UTR606918273645');
                  setTxnDescription(
                    'Rs 18,500 debited via UPI. SMS says account will be blocked if KYC link http://verify-bank-kyc.xyz is not opened.'
                  );
                  setTxnRecognizes(false);
                  setTxnAuthorized(false);
                  setTxnError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                Unauthorized debit + phishing SMS
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxnAmount('1299');
                  setTxnDateTime('2026-03-12T14:20');
                  setTxnCounterparty('Metro Transit Recharge');
                  setTxnDestination('metrorecharge@okicici');
                  setTxnUtr('UTR607118273991');
                  setTxnDescription('Charged twice for the same metro smart card recharge within 2 minutes.');
                  setTxnRecognizes(true);
                  setTxnAuthorized(true);
                  setTxnError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                Duplicate / double debit
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxnAmount('480');
                  setTxnDateTime('2026-03-14T18:05');
                  setTxnCounterparty('City Pharmacy');
                  setTxnDestination('citypharmacy@okaxis');
                  setTxnUtr('UTR607318274110');
                  setTxnDescription('Paid at counter after purchasing medicines.');
                  setTxnRecognizes(true);
                  setTxnAuthorized(true);
                  setTxnError(null);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] transition-colors cursor-pointer"
              >
                Recognized payment
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="txn-amount"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  Transaction Amount in ₹ <span className="text-red-500">*</span>
                </label>
                <input
                  id="txn-amount"
                  type="text"
                  inputMode="decimal"
                  required
                  value={txnAmount}
                  onChange={(e) => setTxnAmount(e.target.value)}
                  placeholder="e.g., 18500"
                  className="w-full px-3.5 py-2.5 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="txn-datetime"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  id="txn-datetime"
                  type="datetime-local"
                  required
                  value={txnDateTime}
                  onChange={(e) => setTxnDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs tabular-nums bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="txn-counterparty"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  Recipient / Sender Name (Optional)
                </label>
                <input
                  id="txn-counterparty"
                  type="text"
                  value={txnCounterparty}
                  onChange={(e) => setTxnCounterparty(e.target.value)}
                  placeholder="e.g., Metro Store"
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="txn-destination"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  UPI ID / Destination (Optional)
                </label>
                <input
                  id="txn-destination"
                  type="text"
                  value={txnDestination}
                  onChange={(e) => setTxnDestination(e.target.value)}
                  placeholder="e.g., merchant@okaxis"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="txn-utr"
                  className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
                >
                  UTR / Reference ID (Optional)
                </label>
                <input
                  id="txn-utr"
                  type="text"
                  value={txnUtr}
                  onChange={(e) => setTxnUtr(e.target.value)}
                  placeholder="e.g., 606918273645"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                />
              </div>
            </div>

            {/* Recognition & Personal Authorization Yes/No Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-2.5">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Do you recognize this transaction? <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="txn-recognizes-yes"
                    onClick={() => setTxnRecognizes(true)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      txnRecognizes === true
                        ? 'bg-[#007FFF] text-white border-[#007FFF]'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    Yes, I recognize it
                  </button>
                  <button
                    type="button"
                    data-testid="txn-recognizes-no"
                    onClick={() => setTxnRecognizes(false)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      txnRecognizes === false
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    No, unfamiliar
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-2.5">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Did you personally authorize this transaction? <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="txn-authorized-yes"
                    onClick={() => setTxnAuthorized(true)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      txnAuthorized === true
                        ? 'bg-[#007FFF] text-white border-[#007FFF]'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    Yes, I authorized it
                  </button>
                  <button
                    type="button"
                    data-testid="txn-authorized-no"
                    onClick={() => setTxnAuthorized(false)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      txnAuthorized === false
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    No, unauthorized
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="txn-description"
                className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
              >
                Transaction Description or Related Bank SMS (Optional)
              </label>
              <textarea
                id="txn-description"
                rows={3}
                value={txnDescription}
                onChange={(e) => setTxnDescription(e.target.value)}
                placeholder="Paste bank alert SMS wording or describe context (e.g., duplicate charge, unrecognized midnight debit, suspicious link). Do NOT enter full card/account numbers, OTP, or PIN."
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#007FFF] focus:ring-1 focus:ring-[#007FFF] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
              />
            </div>

            {/* Optional Screenshot Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Attach Bank SMS / Receipt Screenshot (Optional · PNG, JPEG, WebP up to 5 MB)
                </label>
                {txnScreenshot && (
                  <button
                    type="button"
                    onClick={() => setTxnScreenshot(null)}
                    className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <input
                ref={txnFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleTxnScreenshotUpload}
                className="hidden"
              />

              {!txnScreenshot ? (
                <button
                  type="button"
                  onClick={() => txnFileInputRef.current?.click()}
                  className="w-full p-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/40 hover:border-[#007FFF] hover:bg-[#007FFF]/5 transition-colors flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#007FFF]" />
                  <span>Upload screenshot of transaction alert or statement entry (optional)</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`data:${txnScreenshot.mimeType};base64,${txnScreenshot.dataBase64}`}
                      alt="Uploaded transaction screenshot preview"
                      className="w-12 h-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {txnScreenshot.fileName || 'Screenshot attached'}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 tabular-nums">
                        {txnScreenshot.mimeType} · {Math.max(1, Math.round((txnScreenshot.fileSizeBytes ?? 0) / 1024))} KB
                      </div>
                    </div>
                  </div>
                  <ImageIcon className="w-4 h-4 text-[#007FFF] shrink-0" />
                </div>
              )}
            </div>

            {txnError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/35 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{txnError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Sensitive credential values (PIN, OTP, CVV, passwords, full card/account numbers) are automatically masked.
              </span>
              <button
                type="submit"
                disabled={isAnalyzingTxn}
                className="px-5 py-2.5 bg-[#007FFF] hover:bg-[#0070e0] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-xs whitespace-nowrap shrink-0"
              >
                {isAnalyzingTxn ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <ReceiptIndianRupee className="w-4 h-4" />
                    <span>Analyze Transaction</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Honest Fallback Panel when Gemini fails or is unconfigured */}
          {txnFallback && !txnResult && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#18181B] p-6 sm:p-7 space-y-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                    RULE-BASED PRE-CHECK FALLBACK · AI ASSESSMENT UNAVAILABLE
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                    Deterministic Transaction Safety Observations
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${getEnhancedRiskBadgeConfig(txnFallback.minRiskLevel).badgeClass}`}
                >
                  {getEnhancedRiskBadgeConfig(txnFallback.minRiskLevel).label}
                </span>
              </div>

              {txnFallback.warningSigns.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Rule-Based Warning Signs
                  </div>
                  {renderWarningSignList(txnFallback.warningSigns)}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Recommended Immediate Actions
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                  {txnFallback.recommendedImmediateActions.map((act, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Full Structured Suspicious Transaction Result */}
          {txnResult && (
            <div
              data-testid="suspicious-transaction-result"
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border ${getEnhancedRiskBadgeConfig(txnResult.riskLevel).badgeClass}`}
                    >
                      {getEnhancedRiskBadgeConfig(txnResult.riskLevel).label}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                        txnResult.consistencyAssessment === 'inconsistent'
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800'
                          : txnResult.consistencyAssessment === 'uncertain'
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      Consistency: {txnResult.consistencyAssessment.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      Risk Score: {txnResult.riskScore}/100
                    </span>
                    <span className="text-xs text-zinc-400" aria-hidden="true">·</span>
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      Gemini AI + Rule-Based Check ({txnResult.modelUsed})
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
                    Suspicious Transaction Assessment
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleContinueToSmartCaseBuilder}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>Continue to Smart Case Builder</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {txnResult.sensitiveDataRedacted && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sensitive credential digits detected in your input were automatically redacted before sending to Gemini AI.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
                  {txnResult.summary}
                </p>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/30 text-xs text-zinc-700 dark:text-zinc-300">
                  <strong className="text-zinc-950 dark:text-white">Consistency Review: </strong>
                  {txnResult.consistencyExplanation}
                </div>
              </div>

              {/* Observed Evidence vs Risk Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Observed Evidence (Submitted Facts)
                  </div>
                  <div className="space-y-1.5">
                    {txnResult.observedEvidence.map((obs, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                        <span>{obs}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Potential Risk Indicators
                  </div>
                  <div className="space-y-1.5">
                    {txnResult.riskIndicators.length > 0 ? (
                      txnResult.riskIndicators.map((ind, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/15 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{ind}</span>
                        </div>
                      ))
                    ) : (
                      <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                        No risk indicators flagged beyond your submitted transaction details. Verify your bank statement directly if anything still feels unfamiliar.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning Signs with Rule vs AI Source */}
              {txnResult.warningSigns.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Detected Warning Signs & Explanations
                  </div>
                  {renderWarningSignList(txnResult.warningSigns)}
                </div>
              )}

              {/* Actions & Next Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Recommended Immediate Actions
                  </div>
                  <div className="space-y-1.5">
                    {txnResult.recommendedImmediateActions.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Suggested Next Steps
                  </div>
                  <div className="space-y-1.5">
                    {txnResult.suggestedNextSteps.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 text-xs text-zinc-800 dark:text-zinc-200 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#007FFF] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 flex items-start gap-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
                <span>{txnResult.aiDisclaimer}</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-[#007FFF]/5 border border-[#007FFF]/20">
                <div className="text-xs text-zinc-700 dark:text-zinc-300">
                  Need to file a bank dispute, 1930 cybercrime complaint, or RBI Ombudsman escalation?
                </div>
                <button
                  type="button"
                  onClick={handleContinueToSmartCaseBuilder}
                  className="px-4 py-2 bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-xs"
                >
                  Carry into Smart Case Builder →
                </button>
              </div>
            </div>
          )}
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
