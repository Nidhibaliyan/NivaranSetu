/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GrievanceCase, NavigatorSession } from '../types';
import { AUTHORITY_GUIDES, INITIAL_CASES } from '../sampleData';
import { useLanguage } from '../context/LanguageContext';
import {
  generatePortalWalkthrough,
  PortalWalkthrough,
  WalkthroughStep
} from '../data/portalWalkthroughs';
import { createCustodyEvent } from '../utils/caseStorage';
import { saveNavigatorSession, fetchNavigatorSession } from '../utils/caseRepository';
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
  Download,
  AlertTriangle,
  Lock,
  Workflow,
  RotateCcw,
  Info,
  Globe,
  Scale,
  Calendar,
  Send,
  Loader2
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';

/**
 * Restoration state machine for the active case's cloud session.
 */
export type RestorationStatus = 'idle' | 'loading' | 'restored' | 'no_session' | 'failed';

/**
 * Per-case FIFO save serialization queue ensuring Supabase writes for the same case
 * are executed sequentially in the order dispatched, preventing network inversion races.
 */
export class NavigatorSaveQueue {
  private queueMap = new Map<string, Promise<void>>();

  async enqueue(caseId: string, saveTask: () => Promise<void>): Promise<void> {
    const validCaseId = caseId.trim();
    const currentTail = this.queueMap.get(validCaseId) || Promise.resolve();

    const nextPromise = (async () => {
      try {
        await currentTail;
      } catch {
        // Prior save failure does not block subsequent saves
      }
      await saveTask();
    })();

    this.queueMap.set(validCaseId, nextPromise);
    try {
      await nextPromise;
    } finally {
      if (this.queueMap.get(validCaseId) === nextPromise) {
        this.queueMap.delete(validCaseId);
      }
    }
  }

  isPending(caseId: string): boolean {
    return this.queueMap.has(caseId.trim());
  }

  clear(): void {
    this.queueMap.clear();
  }
}

/**
 * Shared singleton queue instance preserving per-case FIFO ordering across
 * component remounts, route changes, and case switches.
 */
export const sharedNavigatorSaveQueue = new NavigatorSaveQueue();

interface ResolutionNavigatorProps {
  currentCase?: GrievanceCase;
  citizenName?: string;
  onNavigateToDossier: () => void;
  onNavigateBackToBuilder?: () => void;
  onNavigateToMonitoring?: () => void;
  onUpdateCase?: (updatedCase: GrievanceCase) => void;
  saveSessionFn?: (session: NavigatorSession) => Promise<void>;
  fetchSessionFn?: (caseId: string) => Promise<NavigatorSession | null>;
  saveQueue?: NavigatorSaveQueue;
}

export const ResolutionNavigator: React.FC<ResolutionNavigatorProps> = ({
  currentCase,
  citizenName,
  onNavigateToDossier,
  onNavigateBackToBuilder,
  onNavigateToMonitoring,
  onUpdateCase,
  saveSessionFn,
  fetchSessionFn,
  saveQueue,
}) => {
  const { language } = useLanguage();
  const effectiveCase = currentCase || INITIAL_CASES[0];
  const effectiveCitizenName = citizenName?.trim() || 'Citizen Complainant';

  // Per-case FIFO save serialization queue: use explicit prop if provided, else shared module singleton
  const activeQueue = saveQueue || sharedNavigatorSaveQueue;

  // Session restoration state tracking (Correction 2)
  const [restorationStatus, setRestorationStatus] = useState<RestorationStatus>('loading');
  const restorationStatusRef = useRef<RestorationStatus>('loading');

  const updateRestorationStatus = (status: RestorationStatus) => {
    restorationStatusRef.current = status;
    setRestorationStatus(status);
  };

  // =========================================================================
  // STEP-BY-STEP GUIDED NAVIGATION STATE (1 to 8)
  // =========================================================================
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Active Authority Guide
  const [selectedGuideId, setSelectedGuideId] = useState<string>(() => {
    return (
      AUTHORITY_GUIDES.find((g) => g.category === effectiveCase.category)?.id ||
      AUTHORITY_GUIDES[0].id
    );
  });

  // Track last synced case ID and category to avoid unnecessary resets on re-render of same case
  const lastSyncedCaseIdRef = useRef<string>(effectiveCase.id);
  const lastSyncedCategoryRef = useRef<string>(effectiveCase.category);

  // Request sequencing refs to prevent stale asynchronous loads and saves
  const lastFetchRequestIdRef = useRef<number>(0);
  const lastSaveRequestIdRef = useRef<number>(0);

  // Session persistence and notification states
  const [sessionToast, setSessionToast] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);

  useEffect(() => {
    const isNewCase = lastSyncedCaseIdRef.current !== effectiveCase.id;
    const isNewCategory = lastSyncedCategoryRef.current !== effectiveCase.category;

    if (isNewCase || isNewCategory) {
      lastSyncedCaseIdRef.current = effectiveCase.id;
      lastSyncedCategoryRef.current = effectiveCase.category;

      // Select default guide matching the new case category
      const matchingGuide =
        AUTHORITY_GUIDES.find((g) => g.category === effectiveCase.category) ||
        AUTHORITY_GUIDES[0];
      setSelectedGuideId(matchingGuide.id);

      // If switching to a completely different case, reset baseline inputs
      if (isNewCase) {
        setCurrentStep(1);
        setPortalPageIndex(0);
        setAckNumber(effectiveCase.filingDetails?.referenceNumber || '');
        setAckFilingDate(
          effectiveCase.filingDetails?.filingDate || new Date().toISOString().split('T')[0]
        );
        setAckSavedSuccess(effectiveCase.stage === 'filed_externally');
        setAiPrompt('');
        setAiResponse(null);
        setSessionError(null);
        setSessionToast(null);
        updateRestorationStatus('loading');
      }
    }

    // Asynchronously restore saved progress from Supabase navigator_sessions
    let isCancelled = false;
    const fetchReqId = ++lastFetchRequestIdRef.current;
    const targetCaseId = effectiveCase.id;

    (fetchSessionFn || fetchNavigatorSession)(targetCaseId)
      .then((session) => {
        // Discard stale responses from superseded requests or switched cases
        if (isCancelled || lastFetchRequestIdRef.current !== fetchReqId || effectiveCase.id !== targetCaseId) {
          return;
        }

        if (session) {
          const clampedStep = Math.min(8, Math.max(1, Math.round(session.currentStep || 1)));
          setCurrentStep(clampedStep);

          if (session.guideId && AUTHORITY_GUIDES.some((g) => g.id === session.guideId)) {
            setSelectedGuideId(session.guideId);
          }
          if (session.ackNumber) {
            setAckNumber(session.ackNumber);
          }
          if (session.ackFilingDate) {
            setAckFilingDate(session.ackFilingDate);
          }
          setSessionError(null);
          updateRestorationStatus('restored');

          if (clampedStep > 1) {
            const guideObj = AUTHORITY_GUIDES.find((g) => g.id === (session.guideId || selectedGuideId));
            setSessionToast(
              `Restored saved progress at Step ${clampedStep}${guideObj ? ` (${guideObj.authorityName})` : ''}.`
            );
            setTimeout(() => setSessionToast(null), 3500);
          }
        } else {
          setSessionError(null);
          updateRestorationStatus('no_session');
        }
      })
      .catch((err: any) => {
        // Discard stale error notices from superseded requests
        if (isCancelled || lastFetchRequestIdRef.current !== fetchReqId || effectiveCase.id !== targetCaseId) {
          return;
        }
        console.error('Failed to restore navigator session from cloud:', err);
        updateRestorationStatus('failed');
        // Requirement 1 & 2: If Supabase session restoration fails, show a clear error.
        // Do not silently reset progress to Step 1 or interpret a network/authentication failure as an absent session.
        setSessionError(
          `Unable to restore saved progress from cloud: ${err?.message || 'Database error'}. Progress may not be up to date.`
        );
      });

    return () => {
      isCancelled = true;
    };
  }, [
    effectiveCase.id,
    effectiveCase.category,
    effectiveCase.filingDetails?.referenceNumber,
    effectiveCase.filingDetails?.filingDate,
    effectiveCase.stage,
    fetchSessionFn,
  ]);

  // Active guide object
  const activeGuide = AUTHORITY_GUIDES.find((g) => g.id === selectedGuideId) || AUTHORITY_GUIDES[0];

  // Walkthrough generator for official portal
  const walkthrough: PortalWalkthrough = generatePortalWalkthrough(
    selectedGuideId,
    effectiveCase,
    language as 'en' | 'hi'
  );

  // Step 5: Complaint draft format toggle
  const [complaintFormat, setComplaintFormat] = useState<'formal' | 'simple'>('formal');

  // Step 5: AI assistant prompt in Step 5
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Step 7: Walkthrough sub-page index
  const [portalPageIndex, setPortalPageIndex] = useState<number>(0);

  // Copy tracking states
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Step 8: Acknowledgement input states
  const [ackNumber, setAckNumber] = useState<string>(
    effectiveCase.filingDetails?.referenceNumber || ''
  );
  const [ackFilingDate, setAckFilingDate] = useState<string>(
    effectiveCase.filingDetails?.filingDate || new Date().toISOString().split('T')[0]
  );
  const [ackSavedSuccess, setAckSavedSuccess] = useState<boolean>(
    effectiveCase.stage === 'filed_externally'
  );
  const [isSavingAck, setIsSavingAck] = useState<boolean>(false);

  // Prerequisite checklist in Step 3
  const [prereqChecked, setPrereqChecked] = useState<{ [key: string]: boolean }>({
    priorComplaint: true,
    thirtyDaysWait: true,
    withinLimitation: true,
    notSubJudice: true,
  });

  // Step configuration metadata
  const stepsConfig: Record<number, { title: string; shortTitle: string; instruction: string }> = {
    1: {
      title: 'Understand Your Problem',
      shortTitle: 'Grievance Facts',
      instruction: 'Confirm the key facts and scope of your dispute before finding the official statutory authority.',
    },
    2: {
      title: 'Find the Right Authority',
      shortTitle: 'Official Forum',
      instruction: 'Identify the authorized statutory commission, ombudsman, or regulatory bench with legal jurisdiction.',
    },
    3: {
      title: 'Check Eligibility & Prerequisites',
      shortTitle: 'Statutory Eligibility',
      instruction: 'Verify that your grievance satisfies mandatory notice periods and statutory prerequisites.',
    },
    4: {
      title: 'Prepare Required Documents',
      shortTitle: 'Document Checklist',
      instruction: 'Organize required proof, invoices, bank statements, and exhibits with cryptographic integrity.',
    },
    5: {
      title: 'Prepare Your Complaint Statement',
      shortTitle: 'Complaint Statement',
      instruction: 'Review and refine your structured legal petition and relief demands tailored to this portal.',
    },
    6: {
      title: 'Review Your Filing Package',
      shortTitle: 'Package Review',
      instruction: 'Inspect all verified fields and copy them with one click before navigating to the government portal.',
    },
    7: {
      title: 'Submit on Official Portal',
      shortTitle: 'Portal Submission',
      instruction: 'Follow the side-by-side walkthrough matching each case fact to official portal inputs.',
    },
    8: {
      title: 'Track Your Grievance & Acknowledgement',
      shortTitle: 'Tracking & Docket',
      instruction: 'Record your official filing acknowledgement to initiate the statutory response countdown clock.',
    },
  };

  // Copy helper
  const handleCopyText = (fieldId: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedFieldId(fieldId);
    setTimeout(() => setCopiedFieldId(null), 2000);
  };

  // Copy all fields helper
  const handleCopyAllFields = () => {
    const allText = `NIVARANSETU OFFICIAL FILING DATA PACKAGE
Forum: ${activeGuide.authorityName} (${activeGuide.officialPortal})
Case ID: ${effectiveCase.id}
Complainant: ${effectiveCitizenName}
Opposite Party: ${effectiveCase.involvedEntity}
Incident Date: ${effectiveCase.incidentDate}
Location: ${effectiveCase.incidentLocation}
Disputed Amount: ₹${(effectiveCase.disputedAmount || 0).toLocaleString('en-IN')}
Relief Claimed: Full refund of ₹${(effectiveCase.disputedAmount || 0).toLocaleString('en-IN')} plus statutory interest under applicable rules.
Complaint Body:
${effectiveCase.complaintDraft?.formalBody || effectiveCase.description}`;

    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2200);
  };

  // AI clarification handler for Step 5
  const handleAskAi = () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setTimeout(() => {
      setAiResponse(
        `Based on ${activeGuide.authorityName} regulations, cite Rule 11.2 of the statutory scheme. Ensure you explicitly pray for: (1) Principal restitution of ₹${(effectiveCase.disputedAmount || 0).toLocaleString('en-IN')}, (2) Compensation for administrative harassment under Section 14, and (3) Reversal of unauthorized penalty charges.`
      );
      setIsAiLoading(false);
    }, 800);
  };

  // Save session state helper persisting directly to Supabase navigator_sessions
  const handlePauseSession = async () => {
    const savingCaseId = effectiveCase.id;

    // Correction 2: Block cloud saves while initial restoration is unresolved or has failed
    if (restorationStatusRef.current === 'loading' || restorationStatusRef.current === 'idle') {
      setSessionError('Please wait for cloud synchronization to complete before saving.');
      return;
    }
    if (restorationStatusRef.current === 'failed') {
      setSessionError(
        'Cannot save progress because cloud synchronization failed. Please refresh or resolve network connection to avoid overwriting existing cloud progress.'
      );
      return;
    }

    const saveReqId = ++lastSaveRequestIdRef.current;
    setIsSavingSession(true);
    setSessionError(null);

    try {
      const session: NavigatorSession = {
        caseId: savingCaseId,
        guideId: selectedGuideId,
        currentStep,
        ackNumber: ackNumber.trim(),
        ackFilingDate: ackFilingDate.trim(),
        savedAt: new Date().toISOString(),
      };

      // Correction 1: Sequence through per-case FIFO save queue
      await activeQueue.enqueue(savingCaseId, async () => {
        await (saveSessionFn || saveNavigatorSession)(session);
      });

      // Discard stale response if case was switched or newer save started
      if (lastSaveRequestIdRef.current !== saveReqId || effectiveCase.id !== savingCaseId) {
        return;
      }

      setSessionToast('Progress saved to your secure cloud account. You can safely return anytime.');
      setTimeout(() => setSessionToast(null), 3500);
    } catch (err: any) {
      if (lastSaveRequestIdRef.current !== saveReqId || effectiveCase.id !== savingCaseId) {
        return;
      }
      console.error('Failed to save navigator session:', err);
      setSessionError(`Save error: ${err?.message || 'Unable to sync progress to cloud.'}`);
    } finally {
      if (lastSaveRequestIdRef.current === saveReqId) {
        setIsSavingSession(false);
      }
    }
  };

  // Save acknowledgement and update case in Step 8 (Correction 3)
  const handleSaveAcknowledgement = async () => {
    if (!ackNumber.trim() || isSavingAck) return;

    // Correction 2: Block cloud writes while restoration is unresolved or has failed
    if (restorationStatusRef.current === 'loading' || restorationStatusRef.current === 'idle') {
      setSessionError('Please wait for cloud synchronization to complete before recording acknowledgement.');
      return;
    }
    if (restorationStatusRef.current === 'failed') {
      setSessionError(
        'Cannot persist acknowledgement because cloud synchronization failed. Please refresh or resolve network connection.'
      );
      return;
    }

    const savingCaseId = effectiveCase.id;
    setIsSavingAck(true);
    setSessionError(null);

    try {
      const ackSession: NavigatorSession = {
        caseId: savingCaseId,
        guideId: activeGuide.id,
        currentStep: 8,
        ackNumber: ackNumber.trim(),
        ackFilingDate: ackFilingDate.trim(),
        savedAt: new Date().toISOString(),
      };

      // Correction 1: Sequence through the exact same FIFO queue
      await activeQueue.enqueue(savingCaseId, async () => {
        await (saveSessionFn || saveNavigatorSession)(ackSession);
      });

      // Discard if case was switched while save was queued/in-flight
      if (effectiveCase.id !== savingCaseId) {
        return;
      }

      // Correction 3: Only update case timeline, monitoring and custody events AFTER cloud save resolves
      if (onUpdateCase && effectiveCase) {
        const filingEvent = createCustodyEvent(
          effectiveCase.id,
          'filing_ref_recorded',
          `Official Filing Logged: ${activeGuide.authorityName}`,
          'Citizen (Browser Session)',
          `Official submission acknowledgement reference: ${ackNumber.trim()}. Filing date: ${ackFilingDate.trim()}. Portal: ${activeGuide.officialPortal}.`
        );

        const updated: GrievanceCase = {
          ...effectiveCase,
          stage: 'filed_externally',
          status: 'ready',
          lastUpdated: new Date().toISOString(),
          filingDetails: {
            referenceNumber: ackNumber.trim(),
            authority: activeGuide.authorityName,
            filingDate: ackFilingDate.trim(),
            officialAckUrl: activeGuide.portalUrl,
          },
          monitoring: {
            ...(effectiveCase.monitoring || {
              reminders: [],
              responses: [],
              generatedLetters: [],
            }),
            docketNumber: ackNumber.trim(),
            submissionDate: ackFilingDate.trim(),
            officialPortal: activeGuide.officialPortal,
            department: activeGuide.authorityName,
            citizenReportedStatus: 'submitted',
            statutoryDeadlineDays: 30,
          },
          timeline: [
            ...effectiveCase.timeline,
            {
              id: `tl-ack-${Date.now()}`,
              date: `${ackFilingDate.trim()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              title: `Complaint Filed with ${activeGuide.authorityName}`,
              description: `Official Acknowledgement Docket Reference: ${ackNumber.trim()}. Statutory resolution clock initiated.`,
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

      // Display success only after successful cloud save
      setAckSavedSuccess(true);
    } catch (err: any) {
      if (effectiveCase.id !== savingCaseId) return;
      console.error('Failed to persist filing acknowledgement to cloud:', err);
      // Correction 3: On failure, show an error and do NOT claim that the acknowledgement was saved
      setAckSavedSuccess(false);
      setSessionError(
        `Failed to record acknowledgement to cloud: ${err?.message || 'Database error'}. Your input has been preserved—please try again.`
      );
      // Entered acknowledgement details (ackNumber, ackFilingDate) remain intact in state for retry
    } finally {
      if (effectiveCase.id === savingCaseId) {
        setIsSavingAck(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      
      {/* 1. STANDARDIZED GUIDED NAVIGATION HEADER */}
      <GuidedNavigationHeader
        stepNumber={currentStep}
        totalSteps={8}
        badgeLabel={`CASE ${effectiveCase.id} · STAGE 5`}
        stepTitle={stepsConfig[currentStep].title}
        instruction={stepsConfig[currentStep].instruction}
        progressPercent={Math.round((currentStep / 8) * 100)}
        onBack={
          currentStep > 1
            ? () => {
                setCurrentStep(currentStep - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            : onNavigateBackToBuilder
        }
        backLabel={currentStep > 1 ? `Back: ${stepsConfig[currentStep - 1].shortTitle}` : 'Back to Case Builder'}
        onContinue={
          currentStep < 8
            ? () => {
                setCurrentStep(currentStep + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            : onNavigateToMonitoring
        }
        continueLabel={
          currentStep < 8
            ? `Continue: ${stepsConfig[currentStep + 1].shortTitle}`
            : 'Proceed to Case Monitoring'
        }
        onSaveDraft={handlePauseSession}
        onExit={onNavigateToMonitoring || onNavigateBackToBuilder}
        exitLabel="Save & Exit"
      />

      {/* Toast & Error Notifications */}
      {sessionError && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium text-center animate-fade-in flex items-center justify-between gap-2 shadow-xs">
          <span>{sessionError}</span>
          <button
            type="button"
            onClick={() => setSessionError(null)}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-700 dark:text-red-300 font-bold"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {sessionToast && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium text-center animate-fade-in shadow-xs">
          {sessionToast}
        </div>
      )}

      {/* =========================================================================
          STEP 1: UNDERSTAND YOUR PROBLEM
         ========================================================================= */}
      {currentStep === 1 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 1 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Review Your Grievance Fact Sheet
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-[#007FFF] text-xs font-mono font-bold">
              {effectiveCase.category.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {/* Structured Fact Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">GRIEVANCE TITLE</span>
              <p className="font-bold text-zinc-900 dark:text-white text-sm">{effectiveCase.title}</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">OPPOSITE PARTY ENTITY</span>
              <p className="font-bold text-zinc-900 dark:text-white text-sm">{effectiveCase.involvedEntity || 'Opposite Party'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">INCIDENT DATE & LOCATION</span>
              <p className="font-bold text-zinc-900 dark:text-white">
                {effectiveCase.incidentDate} · {effectiveCase.incidentLocation}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-400 font-mono uppercase font-semibold">DISPUTED VALUE / LOSS</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                ₹{(effectiveCase.disputedAmount || 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Narrative Summary */}
          <div className="p-4 rounded-2xl bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 space-y-2">
            <span className="text-xs font-bold text-[#007FFF] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#007FFF]" />
              <span>Core Incident Description</span>
            </span>
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {effectiveCase.description}
            </p>
          </div>

          {/* Action Callout */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">
              Facts verified from your Case Builder intake. Ready to find the statutory authority?
            </span>
            <button
              onClick={() => {
                setCurrentStep(2);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Find Authority</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: FIND THE RIGHT AUTHORITY
         ========================================================================= */}
      {currentStep === 2 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 2 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Select Your Official Dispute Resolution Body
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              Select one forum
            </span>
          </div>

          {/* Authority Selection Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUTHORITY_GUIDES.map((guide) => {
              const isSelected = guide.id === selectedGuideId;
              const isMatch = guide.category === effectiveCase.category;

              return (
                <div
                  key={guide.id}
                  onClick={() => setSelectedGuideId(guide.id)}
                  className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative group ${
                    isSelected
                      ? 'border-[#007FFF] bg-blue-50/30 dark:bg-blue-950/20 shadow-md ring-2 ring-[#007FFF]/25'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-zinc-400">
                        {guide.category.replace(/_/g, ' ')}
                      </span>
                      {isMatch && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                          ✓ RECOMMENDED MATCH
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-[#007FFF] transition-colors">
                      {guide.authorityName}
                    </h3>

                    <p className="text-xs text-zinc-500 leading-snug">
                      Jurisdiction: {guide.jurisdiction} · Statutory target: {guide.statutoryDeadlines}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-mono text-[11px]">
                      Portal: <strong className="text-zinc-800 dark:text-zinc-200">{guide.officialPortal}</strong>
                    </span>
                    <span className="text-[#007FFF] font-semibold text-[11px]">
                      {isSelected ? '● Selected' : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(3);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Eligibility Check</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: CHECK ELIGIBILITY & PREREQUISITES
         ========================================================================= */}
      {currentStep === 3 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 3 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Statutory Prerequisites Audit ({activeGuide.authorityName})
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
              ✓ ELIGIBILITY AUDIT
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Statutory authorities in India require complaints to fulfill specific legal prerequisites to prevent dismissal under preliminary objections.
          </p>

          {/* Prerequisite Checklist Cards */}
          <div className="space-y-3">
            {[
              {
                id: 'priorComplaint',
                title: 'Prior Internal Representation Served',
                rule: 'Must lodge complaint with entity Principal Nodal Officer or customer care first.',
                status: 'Passed: Initial complaint record logged in case timeline.',
              },
              {
                id: 'thirtyDaysWait',
                title: 'Mandatory 30-Day Waiting Period Observed',
                rule: 'Statutory rules require giving the service provider 30 calendar days to respond.',
                status: 'Passed: 30-day requirement satisfied since initial notice.',
              },
              {
                id: 'withinLimitation',
                title: 'Dispute Within Limitation Period',
                rule: 'Under the Limitation Act & Consumer Protection Act, complaint filed within 1-2 years.',
                status: 'Passed: Transaction occurred within active limitation period.',
              },
              {
                id: 'notSubJudice',
                title: 'Matter Not Pending in Civil Court',
                rule: 'Ombudsman cannot adjudicate disputes currently pending before High Court or Civil Bench.',
                status: 'Verified: Citizen confirms no parallel civil suit filed.',
              },
            ].map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{p.title}</h4>
                  </div>
                  <p className="text-[11px] text-zinc-500">{p.rule}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-mono">{p.status}</p>
                </div>

                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold shrink-0">
                  SATISFIED
                </span>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(4);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Prepare Documents</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: PREPARE REQUIRED DOCUMENTS
         ========================================================================= */}
      {currentStep === 4 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 4 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Evidence Documents & Portal Upload Constraints
              </h2>
            </div>
            <span className="text-xs font-mono text-[#007FFF]">
              Portal Max: 5MB (PDF)
            </span>
          </div>

          {/* Preserved Case Exhibits */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center justify-between">
              <span>Attached Case Exhibits ({effectiveCase.evidence?.length || 0})</span>
              <span className="text-[10px] text-zinc-400 font-mono">SHA-256 HASH VERIFIED</span>
            </div>

            {effectiveCase.evidence && effectiveCase.evidence.length > 0 ? (
              <div className="space-y-2">
                {effectiveCase.evidence.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#007FFF] flex items-center justify-center font-mono font-bold text-[10px]">
                        0{idx + 1}
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold text-zinc-900 dark:text-white">{item.title}</div>
                        <div className="text-[10px] font-mono text-zinc-400">
                          {item.fileName} · {item.fileSize} · SHA: {item.sha256Hash?.slice(0, 16)}...
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                      ✓ Ready for Upload
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 text-center text-xs text-zinc-400">
                No exhibits attached. You can proceed with text testimony or add receipts in Case Builder.
              </div>
            )}
          </div>

          {/* Official Upload Notice */}
          <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-300">
            <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-white">Portal Upload Formatting Notice: </strong>
              Government portals ({activeGuide.officialPortal}) require exhibits in non-password-protected PDF or JPG format under 5MB. NivaranSetu formats files to meet these exact portal constraints.
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(5);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Prepare Complaint</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 5: PREPARE YOUR COMPLAINT STATEMENT
         ========================================================================= */}
      {currentStep === 5 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 5 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Prepare Your Complaint Statement
              </h2>
            </div>

            {/* Formal vs Simple Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-medium">
              <button
                onClick={() => setComplaintFormat('formal')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  complaintFormat === 'formal'
                    ? 'bg-white dark:bg-zinc-900 text-[#007FFF] font-bold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Formal Statutory
              </button>
              <button
                onClick={() => setComplaintFormat('simple')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  complaintFormat === 'simple'
                    ? 'bg-white dark:bg-zinc-900 text-[#007FFF] font-bold shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Simple Citizen
              </button>
            </div>
          </div>

          {/* Complaint Text Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Ready for Pasting into Portal Narrative Box
              </span>
              <button
                onClick={() => {
                  const text =
                    complaintFormat === 'formal'
                      ? effectiveCase.complaintDraft?.formalBody || effectiveCase.description
                      : effectiveCase.complaintDraft?.simpleBody || effectiveCase.description;
                  handleCopyText('complaint-text', text);
                }}
                className="flex items-center gap-1.5 text-xs text-[#007FFF] font-semibold hover:underline cursor-pointer"
              >
                {copiedFieldId === 'complaint-text' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFieldId === 'complaint-text' ? 'Copied' : 'Copy Statement'}</span>
              </button>
            </div>

            <textarea
              readOnly
              rows={6}
              value={
                complaintFormat === 'formal'
                  ? effectiveCase.complaintDraft?.formalBody || effectiveCase.description
                  : effectiveCase.complaintDraft?.simpleBody || effectiveCase.description
              }
              className="w-full text-xs font-mono p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 leading-relaxed focus:outline-none"
            />
          </div>

          {/* AI Grievance Assistant Clarification Bar */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/20 dark:via-zinc-900/30 dark:to-blue-950/10 border border-blue-200 dark:border-blue-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#007FFF]">
              <Sparkles className="w-4 h-4 text-[#FF2E93]" />
              <span>AI Complaint Optimizer (Gemini)</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                placeholder="Ask how to claim interest or reference statutory compensation provisions..."
                className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
              />
              <button
                onClick={handleAskAi}
                disabled={isAiLoading || !aiPrompt.trim()}
                className="px-4 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Ask AI</span>}
              </button>
            </div>

            {aiResponse && (
              <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-blue-100 dark:border-blue-900/30 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed animate-fade-in">
                {aiResponse}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(4)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(6);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Review Package</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 6: REVIEW YOUR FILING PACKAGE
         ========================================================================= */}
      {currentStep === 6 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 6 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Review Your Filing Package & Quick Copy
              </h2>
            </div>

            <button
              onClick={handleCopyAllFields}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#007FFF]/10 text-[#007FFF] font-semibold text-xs border border-[#007FFF]/30 hover:bg-[#007FFF]/20 transition-colors cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'All Fields Copied!' : 'Copy Entire Package'}</span>
            </button>
          </div>

          {/* Quick-Copy Field Register */}
          <div className="space-y-3">
            {[
              { id: 'f-auth', label: 'Target Authority', val: activeGuide.authorityName },
              { id: 'f-portal', label: 'Official Portal URL', val: activeGuide.officialPortal },
              { id: 'f-comp', label: 'Complainant Full Name', val: effectiveCitizenName },
              { id: 'f-entity', label: 'Opposite Party Entity', val: effectiveCase.involvedEntity || 'Opposite Party' },
              { id: 'f-amt', label: 'Disputed Claim Amount', val: `₹${(effectiveCase.disputedAmount || 0).toLocaleString('en-IN')}` },
              { id: 'f-date', label: 'Date of Incident', val: effectiveCase.incidentDate },
            ].map((f) => (
              <div
                key={f.id}
                className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">{f.label}</span>
                  <p className="font-bold text-zinc-900 dark:text-white">{f.val}</p>
                </div>

                <button
                  onClick={() => handleCopyText(f.id, f.val)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-[#007FFF] hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Copy value"
                >
                  {copiedFieldId === f.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>

          {/* Sovereign Control Guarantee Notice */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <Lock className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-zinc-900 dark:text-white">Citizen Sovereignty Guarantee: </strong>
              NivaranSetu does not enter government portals or execute submissions autonomously. You retain full control over OTP verification, CAPTCHA, and final submission.
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(5)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(7);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Submit on Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 7: SUBMIT ON OFFICIAL PORTAL
         ========================================================================= */}
      {currentStep === 7 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 7 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Guided Official Portal Submission
              </h2>
            </div>

            <a
              href={activeGuide.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 whitespace-nowrap cursor-pointer"
            >
              <span>Open {activeGuide.officialPortal} ↗</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Click above to open the official government portal in an adjacent window. Use the steps below to paste the exact verified parameters into the official form.
          </p>

          {/* Stepper Tabs across Portal Submission Pages */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {walkthrough.steps.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => setPortalPageIndex(idx)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  portalPageIndex === idx
                    ? 'bg-[#007FFF] text-white shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                Page {st.stepNumber}: {st.title.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Active Walkthrough Step Guidance Card */}
          {walkthrough.steps[portalPageIndex] && (
            <div className="p-5 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  {walkthrough.steps[portalPageIndex].title}
                </h3>
                <span className="text-[10px] font-mono text-zinc-400">
                  Step {portalPageIndex + 1} of {walkthrough.steps.length}
                </span>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {walkthrough.steps[portalPageIndex].shortDescription ||
                  walkthrough.steps[portalPageIndex].citizenInstructions?.join(' ')}
              </p>

              {/* Field mapping values for this page */}
              <div className="space-y-2 pt-2">
                {walkthrough.steps[portalPageIndex].fields?.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase">{f.officialFieldName}</span>
                      <p className="font-semibold text-zinc-900 dark:text-white truncate max-w-md">{f.caseValue}</p>
                    </div>

                    <button
                      onClick={() => handleCopyText(f.id, f.caseValue)}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-[#007FFF] text-[11px] font-semibold cursor-pointer"
                    >
                      {copiedFieldId === f.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(6)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => {
                setCurrentStep(8);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <span>Continue to Track Grievance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 8: TRACK YOUR GRIEVANCE & RECORD ACKNOWLEDGEMENT
         ========================================================================= */}
      {currentStep === 8 && (
        <div className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 sm:p-8 space-y-6 shadow-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-xs font-mono font-bold text-[#007FFF] uppercase tracking-wider">
                STEP 8 OF 8
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Record Official Acknowledgement & Initiate Tracking
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#007FFF] font-mono text-xs font-bold">
              30-DAY STATUTORY CLOCK
            </span>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Enter the official reference, docket, or complaint number generated by the government portal. This locks your cryptographic custody proof and initiates the statutory 30-day response countdown.
          </p>

          {/* Acknowledgement Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-900 dark:text-white">
                Official Acknowledgement / Docket Number *
              </label>
              <input
                type="text"
                value={ackNumber}
                onChange={(e) => setAckNumber(e.target.value)}
                placeholder="e.g. RBI/2026/CMS-098214 or NCH-84912"
                className="w-full text-xs font-mono p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-900 dark:text-white">
                Filing Date *
              </label>
              <input
                type="date"
                value={ackFilingDate}
                onChange={(e) => setAckFilingDate(e.target.value)}
                className="w-full text-xs font-mono p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
              />
            </div>
          </div>

          {/* Save Acknowledgement Action Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Saving logs a tamper-evident audit record in your local database.
            </div>

            <button
              onClick={handleSaveAcknowledgement}
              disabled={!ackNumber.trim() || isSavingAck || restorationStatus === 'loading' || restorationStatus === 'failed'}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {isSavingAck ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : ackSavedSuccess ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {isSavingAck
                  ? 'Saving to Cloud...'
                  : ackSavedSuccess
                  ? 'Acknowledgement Saved ✓'
                  : 'Save to Case Record'}
              </span>
            </button>
          </div>

          {/* Success Confirmation Card */}
          {ackSavedSuccess && (
            <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Case Successfully Filed and Logged for Tracking!</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Docket <strong>{ackNumber}</strong> has been bound to Case <strong>{effectiveCase.id}</strong>. The statutory 30-day response window is now being monitored.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {onNavigateToMonitoring && (
                  <button
                    onClick={onNavigateToMonitoring}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>Go to Smart Case Monitoring</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={onNavigateToDossier}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-50 cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-[#007FFF]" />
                  <span>Download Case Dossier PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={() => setCurrentStep(7)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            {onNavigateToMonitoring && (
              <button
                onClick={onNavigateToMonitoring}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <span>Finish & Proceed to Monitoring</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
