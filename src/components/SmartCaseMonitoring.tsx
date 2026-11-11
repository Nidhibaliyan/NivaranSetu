/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  GrievanceCase,
  CaseReminder,
  CaseResponseRecord,
  FollowUpLetterDraft,
  CitizenReportedStatus,
  ResponseClassification,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateSha256,
  createCustodyEvent,
} from '../utils/caseStorage';
import {
  uploadEvidenceBlob,
  downloadEvidenceBlob,
} from '../utils/evidenceStorage';
import {
  evaluateEscalationStatus,
  detectPendingActions,
  generateStatusReminderLetter,
  generateEscalationPetitionLetter,
  STATUTORY_RULES,
} from '../utils/escalationRules';
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  FileText,
  UploadCloud,
  Sparkles,
  Lock,
  Scale,
  Building,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Plus,
  AlertTriangle,
  Loader2,
  FileCheck,
  Shield,
  Download,
  Info
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';
import {
  CHAT_CLIENT_TIMEOUT_MS,
  fetchWithTimeout,
  formatAiErrorMessage,
} from '../utils/aiClientUtils';

interface SmartCaseMonitoringProps {
  currentCase: GrievanceCase;
  onUpdateCase: (updated: GrievanceCase) => Promise<boolean | void> | void;
  onBackToCases: () => void;
  onOpenDossier: () => void;
  onOpenNavigator?: () => void;
}

export const SmartCaseMonitoring: React.FC<SmartCaseMonitoringProps> = ({
  currentCase,
  onUpdateCase,
  onBackToCases,
  onOpenDossier,
  onOpenNavigator,
}) => {
  const { mode } = useLanguage();

  // Ensure monitoring object is present
  const monitoring = currentCase.monitoring || {
    submissionDate: currentCase.filingDetails?.filingDate || currentCase.incidentDate,
    submissionTime: '10:00 AM',
    officialPortal: currentCase.recommendedAuthority.portalName,
    department: currentCase.recommendedAuthority.name,
    docketNumber: currentCase.filingDetails?.referenceNumber || '',
    citizenReportedStatus: (currentCase.stage === 'filed_externally' ? 'submitted' : 'not_submitted') as CitizenReportedStatus,
    statutoryDeadlineDays: STATUTORY_RULES[currentCase.category]?.statutoryWindowDays || 30,
    reminders: [],
    responses: [],
    generatedLetters: [],
  };

  // State for active tab inside monitoring view
  const [activeSubTab, setActiveSubTab] = useState<'tracking' | 'reminders' | 'responses' | 'escalation' | 'letters'>('tracking');

  // State for editing submission info
  const [docketInput, setDocketInput] = useState(monitoring.docketNumber || '');
  const [submissionDateInput, setSubmissionDateInput] = useState(monitoring.submissionDate || currentCase.incidentDate);
  const [portalInput, setPortalInput] = useState(monitoring.officialPortal || currentCase.recommendedAuthority.portalName);
  const [departmentInput, setDepartmentInput] = useState(monitoring.department || currentCase.recommendedAuthority.name);
  const [statusInput, setStatusInput] = useState<CitizenReportedStatus>(monitoring.citizenReportedStatus || 'submitted');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // State for adding a reminder
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [reminderDesc, setReminderDesc] = useState('');

  // State for response recording
  const [showAddResponseModal, setShowAddResponseModal] = useState(false);
  const [responseDate, setResponseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [respondentName, setRespondentName] = useState(currentCase.involvedEntity);
  const [responseText, setResponseText] = useState('');
  const [responseFile, setResponseFile] = useState<File | null>(null);
  const [isAnalyzingResponse, setIsAnalyzingResponse] = useState(false);
  const [uploadedAttachment, setUploadedAttachment] = useState<{
    storageRef: string;
    fileHash: string;
    fileName: string;
  } | null>(null);
  const [responseSaveError, setResponseSaveError] = useState<string | null>(null);
  const [downloadingResponseId, setDownloadingResponseId] = useState<string | null>(null);

  // State for Letter Generator
  const [selectedLetterType, setSelectedLetterType] = useState<'status_reminder' | 'statutory_escalation'>('status_reminder');
  const [letterDraftContent, setLetterDraftContent] = useState<string>(() => {
    return generateStatusReminderLetter(currentCase);
  });
  const [copiedLetter, setCopiedLetter] = useState(false);
  const [letterSaveNotice, setLetterSaveNotice] = useState<string | null>(null);

  // Computed statutory evaluation & pending actions
  const escalation = evaluateEscalationStatus(currentCase);
  const pending = detectPendingActions(currentCase);

  // Handle saving submission details
  const handleSaveSubmissionDetails = () => {
    const subEvent = createCustodyEvent(
      currentCase.id,
      'submission_recorded',
      `Filing Details Updated: Ref ${docketInput || 'Pending'}`,
      'Citizen (Browser Session)',
      `Status: ${statusInput}. Portal: ${portalInput}. Submission Date: ${submissionDateInput}.`
    );

    const updatedCase: GrievanceCase = {
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        docketNumber: docketInput.trim(),
        submissionDate: submissionDateInput,
        officialPortal: portalInput.trim(),
        department: departmentInput.trim(),
        citizenReportedStatus: statusInput,
      },
      filingDetails: {
        ...(currentCase.filingDetails || {}),
        referenceNumber: docketInput.trim(),
        filingDate: submissionDateInput,
        authority: departmentInput.trim(),
      },
      custodyEvents: [...(currentCase.custodyEvents || []), subEvent],
    };

    onUpdateCase(updatedCase);
    setSaveSuccessMsg('Submission tracking details updated and recorded in digital chain-of-custody.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Handle adding a reminder
  const handleAddReminder = () => {
    if (!reminderTitle.trim() || !reminderDueDate) return;

    const newReminder: CaseReminder = {
      id: `rem-${Date.now()}`,
      caseId: currentCase.id,
      title: reminderTitle.trim(),
      dueDate: reminderDueDate,
      description: reminderDesc.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const reminderEvent = createCustodyEvent(
      currentCase.id,
      'reminder_created',
      `Follow-up Reminder Created: ${newReminder.title}`,
      'Citizen (Browser Session)',
      `Due Date: ${newReminder.dueDate}. Target: ${newReminder.description || 'Periodic follow-up'}.`
    );

    const updatedCase: GrievanceCase = {
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        reminders: [...(monitoring.reminders || []), newReminder],
      },
      custodyEvents: [...(currentCase.custodyEvents || []), reminderEvent],
    };

    onUpdateCase(updatedCase);
    setReminderTitle('');
    setReminderDesc('');
    setShowAddReminderModal(false);
  };

  // Handle toggle reminder status
  const handleToggleReminderStatus = (reminderId: string) => {
    const target = (monitoring.reminders || []).find((r) => r.id === reminderId);
    if (!target) return;

    const nextStatus = target.status === 'pending' ? 'completed' : 'pending';
    const updatedReminders = (monitoring.reminders || []).map((r) =>
      r.id === reminderId ? { ...r, status: nextStatus as 'pending' | 'completed' } : r
    );

    const remEvent = createCustodyEvent(
      currentCase.id,
      'reminder_completed',
      `Reminder Status Changed to ${nextStatus.toUpperCase()}: ${target.title}`,
      'Citizen (Browser Session)',
      `Reminder ID: ${target.id}. Due Date: ${target.dueDate}.`
    );

    onUpdateCase({
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        reminders: updatedReminders,
      },
      custodyEvents: [...(currentCase.custodyEvents || []), remEvent],
    });
  };

  // Handle delete reminder
  const handleDeleteReminder = (reminderId: string) => {
    const target = (monitoring.reminders || []).find((r) => r.id === reminderId);
    if (!target) return;

    const updatedReminders = (monitoring.reminders || []).filter((r) => r.id !== reminderId);

    const remEvent = createCustodyEvent(
      currentCase.id,
      'reminder_deleted',
      `Reminder Removed: ${target.title}`,
      'Citizen (Browser Session)',
      `Deleted reminder due on ${target.dueDate}.`
    );

    onUpdateCase({
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        reminders: updatedReminders,
      },
      custodyEvents: [...(currentCase.custodyEvents || []), remEvent],
    });
  };

  // Handle download of official response attachment from private Supabase Storage
  const handleDownloadResponseAttachment = async (resp: CaseResponseRecord) => {
    if (!resp.storageRef) {
      alert('This response record was created locally and does not have a private cloud storage reference.');
      return;
    }
    setDownloadingResponseId(resp.id);
    try {
      const blob = await downloadEvidenceBlob(resp.storageRef);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resp.documentName || `response_${resp.id}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download response document:', err);
      alert(`Could not download response document: ${err?.message || 'Storage download error'}`);
    } finally {
      setDownloadingResponseId(null);
    }
  };

  // Handle response document/text upload and AI analysis
  const handleRecordResponse = async () => {
    if (!responseText.trim() && !responseFile && !uploadedAttachment) {
      alert('Please provide response text or select a response document file.');
      return;
    }

    if (!currentCase.id || !currentCase.id.trim()) {
      alert('Cannot attach response: no active parent case ID found.');
      return;
    }

    setIsAnalyzingResponse(true);
    setResponseSaveError(null);

    let currentUpload = uploadedAttachment;
    const respId = `resp-${Date.now()}`;

    // 1. Upload attachment to private Supabase Storage 'evidence' bucket if not already uploaded
    // Storage path strictly follows 4-segment schema: {userId}/{caseId}/{responseId}/{fileName}
    if (responseFile && !currentUpload) {
      try {
        const uploadRes = await uploadEvidenceBlob({
          caseId: currentCase.id,
          evidenceId: respId,
          file: responseFile,
          fileName: responseFile.name,
        });
        currentUpload = {
          storageRef: uploadRes.storageRef,
          fileHash: uploadRes.sha256Hash,
          fileName: responseFile.name,
        };
        setUploadedAttachment(currentUpload);
      } catch (uploadErr: any) {
        console.error('Storage upload failed:', uploadErr);
        setIsAnalyzingResponse(false);
        setResponseSaveError(`Failed to upload attachment to private cloud storage: ${uploadErr?.message || 'Upload error'}`);
        return; // Abort before attempting any metadata save
      }
    }

    // 2. Classify response with AI service or rule-based parser
    let classification: ResponseClassification = 'requires_human_review';
    let rationale = '';
    const activeFileName = currentUpload?.fileName || '';

    let isRuleBasedFallback = false;

    try {
      const prompt = `Analyze this official government or institutional grievance response:
Response Text: "${(responseText || 'Document attached: ' + activeFileName).slice(0, 7500)}"
Involved Respondent: "${respondentName}"
Original Grievance: "${currentCase.title}"

Classify this official response into exactly ONE of the following 4 categories:
- resolved: The authority/entity has fully admitted the claim and ordered or executed full relief/refund.
- partially_resolved: Some partial relief granted, or grievance transferred to another wing without final award.
- unresolved: The authority/entity has rejected, repudiated, or dismissed the complaint without relief.
- requires_human_review: The response is ambiguous, requests additional evidence, or mentions procedural delays.

Return your analysis in this exact format:
CLASSIFICATION: [resolved | partially_resolved | unresolved | requires_human_review]
RATIONALE: [2-3 sentences explaining the legal and factual basis for this classification]`;

      const aiRes = await fetchWithTimeout(
        '/api/gemini/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', text: prompt }],
            taskType: 'complex',
            requestedModel: 'gemini-4-argon',
          }),
        },
        CHAT_CLIENT_TIMEOUT_MS
      );

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const aiOutput = aiData.text || '';
        if (aiOutput.includes('CLASSIFICATION: resolved')) classification = 'resolved';
        else if (aiOutput.includes('CLASSIFICATION: partially_resolved')) classification = 'partially_resolved';
        else if (aiOutput.includes('CLASSIFICATION: unresolved')) classification = 'unresolved';
        else classification = 'requires_human_review';

        const rationaleMatch = aiOutput.match(/RATIONALE:\s*([\s\S]+)/i);
        rationale = rationaleMatch ? rationaleMatch[1].trim() : aiOutput.trim();
      } else {
        const errJson = await aiRes.json().catch(() => ({}));
        throw new Error(errJson.error || `AI service returned HTTP ${aiRes.status}`);
      }
    } catch (aiErr: any) {
      isRuleBasedFallback = true;
      const formattedReason = formatAiErrorMessage(aiErr, aiErr?.message || 'AI request failed');
      const reason = ` (${formattedReason})`;
      // Fallback rule-based analysis with explicit disclosure
      const lower = (responseText + ' ' + activeFileName).toLowerCase();
      if (lower.includes('reject') || lower.includes('repudiat') || lower.includes('dismiss') || lower.includes('closed without')) {
        classification = 'unresolved';
        rationale = `Rule-based fallback [AI Unavailable${reason}]: Response contains explicit repudiation or closure without relief terms. Grounds for statutory escalation.`;
      } else if (lower.includes('refund processed') || lower.includes('resolved') || lower.includes('credit reversed') || lower.includes('admitted')) {
        classification = 'resolved';
        rationale = `Rule-based fallback [AI Unavailable${reason}]: Response indicates full grievance admission and corrective resolution executed.`;
      } else if (lower.includes('partial') || lower.includes('transferred') || lower.includes('forwarded')) {
        classification = 'partially_resolved';
        rationale = `Rule-based fallback [AI Unavailable${reason}]: Matter has been forwarded or granted partial relief.`;
      } else {
        classification = 'requires_human_review';
        rationale = `Rule-based fallback [AI Unavailable${reason}]: The text provided requires human review by the citizen to confirm whether the terms meet statutory relief requirements.`;
      }
    }

    const newResponseRecord: CaseResponseRecord = {
      id: respId,
      caseId: currentCase.id,
      receivedDate: responseDate,
      respondentName: respondentName.trim(),
      documentName: currentUpload?.fileName || undefined,
      documentHash: currentUpload?.fileHash || undefined,
      storageRef: currentUpload?.storageRef || undefined,
      responseText: responseText.trim(),
      aiClassification: classification,
      classificationRationale: rationale,
      createdAt: new Date().toISOString(),
    };

    const respCustodyEvent = createCustodyEvent(
      currentCase.id,
      'response_received',
      `Official Response Received from ${newResponseRecord.respondentName}`,
      'Citizen (Browser Session)',
      `Classification: ${classification.toUpperCase()} (${isRuleBasedFallback ? 'Rule-Based Fallback' : 'AI-Evaluated'}). Date: ${responseDate}. ${currentUpload?.fileHash ? 'SHA-256: ' + currentUpload.fileHash : 'Text response recorded.'}`
    );

    const updatedCase: GrievanceCase = {
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        citizenReportedStatus: 'response_received',
        responses: [...(monitoring.responses || []), newResponseRecord],
      },
      custodyEvents: [...(currentCase.custodyEvents || []), respCustodyEvent],
    };

    // 3. Persist metadata via onUpdateCase. If database save fails, retain upload reference for safe retry.
    try {
      const saveRes = await onUpdateCase(updatedCase);
      if (saveRes === false) {
        throw new Error('Database refused monitoring record update.');
      }
      // Success: reset form and attachment state, close modal
      setUploadedAttachment(null);
      setResponseText('');
      setResponseFile(null);
      setResponseSaveError(null);
      setShowAddResponseModal(false);
    } catch (err: any) {
      console.error('Error saving response record metadata:', err);
      // DO NOT delete uploaded storage object (Storage deletion forbidden by policy).
      // Keep uploadedAttachment in state so the citizen can retry saving metadata without re-uploading binary.
      setResponseSaveError(
        `Document uploaded to cloud (${currentUpload?.fileName}), but database save failed: ${err?.message || 'Database error'}. Click "Save & Run AI Audit" to retry saving without re-uploading.`
      );
    } finally {
      setIsAnalyzingResponse(false);
    }
  };

  // Switch letter type
  const handleSelectLetterType = (type: 'status_reminder' | 'statutory_escalation') => {
    setSelectedLetterType(type);
    if (type === 'status_reminder') {
      setLetterDraftContent(generateStatusReminderLetter(currentCase));
    } else {
      setLetterDraftContent(generateEscalationPetitionLetter(currentCase));
    }
  };

  // Copy letter draft
  const handleCopyLetter = () => {
    navigator.clipboard.writeText(letterDraftContent);
    setCopiedLetter(true);
    setTimeout(() => setCopiedLetter(false), 2000);
  };

  // Download letter as .txt file
  const handleDownloadLetter = () => {
    const filename = `NivaranSetu_${selectedLetterType.toUpperCase()}_${currentCase.id}.txt`;
    const blob = new Blob([letterDraftContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save generated letter into case history
  const handleSaveLetterToHistory = () => {
    const rule = STATUTORY_RULES[currentCase.category] || STATUTORY_RULES.banking_financial;
    const newLetterDraft: FollowUpLetterDraft = {
      id: `ltr-${Date.now()}`,
      caseId: currentCase.id,
      letterType: selectedLetterType,
      recipientAuthority: selectedLetterType === 'status_reminder' ? rule.initialAuthority : rule.escalationAuthority,
      subject: selectedLetterType === 'status_reminder'
        ? `Status Inquiry: ${monitoring.docketNumber || currentCase.id}`
        : `Statutory Escalation Petition: ${currentCase.title}`,
      body: letterDraftContent,
      statutoryBasis: rule.statutoryCitation,
      generatedAt: new Date().toISOString(),
    };

    const ltrEvent = createCustodyEvent(
      currentCase.id,
      'followup_letter_generated',
      `Follow-Up Letter Prepared: ${selectedLetterType === 'status_reminder' ? 'Type A Reminder' : 'Type B Statutory Escalation'}`,
      'Citizen (Browser Session)',
      `Recipient: ${newLetterDraft.recipientAuthority}. Statutory Basis: ${rule.statutoryCitation}.`
    );

    const updatedCase: GrievanceCase = {
      ...currentCase,
      lastUpdated: new Date().toISOString(),
      monitoring: {
        ...monitoring,
        generatedLetters: [...(monitoring.generatedLetters || []), newLetterDraft],
      },
      custodyEvents: [...(currentCase.custodyEvents || []), ltrEvent],
    };

    onUpdateCase(updatedCase);
    setLetterSaveNotice('Letter saved to case record and logged in digital custody ledger.');
    setTimeout(() => setLetterSaveNotice(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* 0. GUIDED NAVIGATION HEADER */}
      <GuidedNavigationHeader
        badgeLabel={`CASE ${currentCase.id}`}
        stepTitle="Stage 6: Post-Submission Case Monitoring & Escalation"
        instruction="Track official response deadlines, maintain in-app follow-up reminders, record entity replies, and evaluate statutory escalation rights."
        progressPercent={85}
        onBack={onBackToCases}
        backLabel="My Cases"
        onContinue={onOpenDossier}
        continueLabel="View Case Dossier"
        onExit={onOpenNavigator}
        exitLabel={onOpenNavigator ? 'Resolution Navigator' : undefined}
      />

      {/* 1. TOP BREADCRUMB & HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            <span>Post-Submission Case Intelligence & Statutory Audits</span>
          </div>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
              Smart Case Monitoring
            </h2>

            {/* DEMO SAMPLE CASE BADGE */}
            {currentCase.isSampleData && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                DEMO SAMPLE CASE
              </span>
            )}

            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {currentCase.id}
            </span>
          </div>

          <p className="text-xs text-zinc-500 mt-1 max-w-3xl leading-relaxed">
            Connected post-submission lifecycle tracking. Monitor official statutory response deadlines, maintain in-app follow-up reminders, record and analyze departmental replies, and evaluate statutory escalation eligibility.
          </p>
        </div>

        {/* Previous / Next Navigation Buttons */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            onClick={onBackToCases}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>My Cases</span>
          </button>

          <button
            onClick={onOpenDossier}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <span>View Case Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. HONEST CITIZEN-REPORTED STATUS DISCLAIMER BANNER */}
      <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>Citizen-Reported Status (Pending Official Verification)</span>
            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-[#007FFF]">
              Cloud Custody Ledger · SHA-256 Verified
            </span>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
            NivaranSetu does not have direct write-access to government grievance databases. All submission dates, docket numbers, and status updates are citizen-recorded and cryptographically preserved in your cloud custody ledger. Official updates must be tracked on the respective department portal.
          </p>
        </div>
      </div>

      {/* 3. SUB-NAVIGATION TOOLBAR */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
        {[
          { id: 'tracking', label: '1. Submission Tracking & Deadlines' },
          { id: 'reminders', label: `2. Follow-Up Reminders (${monitoring.reminders?.length || 0})` },
          { id: 'responses', label: `3. Response Tracking & AI Audit (${monitoring.responses?.length || 0})` },
          { id: 'escalation', label: `4. Escalation Intelligence (${escalation.isEligible ? 'Eligible' : 'Pending'})` },
          { id: 'letters', label: '5. Follow-Up Letters' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3 py-1.5 font-medium rounded-lg transition-colors cursor-pointer ${
              activeSubTab === tab.id
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saveSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: SUBMISSION TRACKING & STATUTORY DEADLINE                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'tracking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1 & 2: Submission Details Form */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  Official Submission Record
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Record the acknowledgement reference and portal where you filed this grievance.
                </p>
              </div>

              <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {currentCase.category.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Complaint / Docket Reference No.
                </label>
                <input
                  type="text"
                  value={docketInput}
                  onChange={(e) => setDocketInput(e.target.value)}
                  placeholder="e.g. APEX/PN/2026/INW-714 or 2026-MH-94812"
                  className="w-full text-xs font-mono px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Official tracking number generated by the portal.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Filing / Submission Date
                </label>
                <input
                  type="date"
                  value={submissionDateInput}
                  onChange={(e) => setSubmissionDateInput(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Date complaint was stamped or submitted online.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Official Portal / Forum
                </label>
                <input
                  type="text"
                  value={portalInput}
                  onChange={(e) => setPortalInput(e.target.value)}
                  placeholder="e.g. RBI CMS, e-Daakhil, MahaRERA"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Designated Authority / Department
                </label>
                <input
                  type="text"
                  value={departmentInput}
                  onChange={(e) => setDepartmentInput(e.target.value)}
                  placeholder="e.g. Bank Principal Nodal Officer / District Commission"
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                  Citizen-Reported Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as CitizenReportedStatus)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                >
                  <option value="not_submitted">Not Submitted (Drafting Phase)</option>
                  <option value="submitted">Submitted (Awaiting Department Response)</option>
                  <option value="in_progress">In Progress (Department Investigation Underway)</option>
                  <option value="response_received">Response Received (Document / Notice Issued)</option>
                  <option value="resolved">Resolved (Grievance Redressed Satisfactorily)</option>
                  <option value="unresolved">Unresolved (Rejected / Unsatisfactory)</option>
                  <option value="escalated">Escalated to Appellate Authority / Ombudsman</option>
                </select>
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Select your current verified status based on department communications.
                </span>
              </div>

            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                Updating updates the shared case record and appends a custody log.
              </span>
              <button
                onClick={handleSaveSubmissionDetails}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Save Submission Tracking
              </button>
            </div>
          </div>

          {/* Column 3: Statutory Clock & Checklist */}
          <div className="space-y-6">
            
            {/* Statutory Clock Card */}
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  STATUTORY CLOCK
                </span>
                <span className="text-xs font-mono font-bold text-[#007FFF]">
                  {escalation.daysElapsed} / {escalation.statutoryWindowDays} Days
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="w-full h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      escalation.isEligible
                        ? 'bg-amber-500'
                        : 'bg-[#007FFF]'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round((escalation.daysElapsed / escalation.statutoryWindowDays) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>Filed: {escalation.filingDate}</span>
                  <span>{escalation.daysRemaining} days remaining</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs space-y-1">
                <span className="font-semibold text-zinc-900 dark:text-white block">
                  Applicable Statutory Benchmark:
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                  {escalation.statutoryCitation}
                </p>
              </div>

              <div className="text-xs space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                  Official Portal Link:
                </span>
                <a
                  href={escalation.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[#007FFF] hover:underline font-mono"
                >
                  <span>{escalation.portalName}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Pending Action Checklist */}
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">
                  ACTION CHECKLIST
                </h4>
                <span className="text-[11px] font-mono text-zinc-400">
                  {pending.checklistItems.filter((i) => i.completed).length} / {pending.checklistItems.length} Done
                </span>
              </div>

              <div className="space-y-2.5">
                {pending.checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-colors ${
                      item.completed
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                        : item.urgent
                        ? 'bg-amber-500/5 border-amber-500/30 text-amber-900 dark:text-amber-300'
                        : 'bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : item.urgent ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    )}
                    <span className="text-xs leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>

              {pending.missingDocuments.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                  <span className="font-semibold text-amber-800 dark:text-amber-400 block text-[11px]">
                    Recommended Missing Exhibits:
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
                    {pending.missingDocuments.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: IN-APP FOLLOW-UP REMINDERS                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'reminders' && (
        <div className="space-y-6">
          
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B]">
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Scheduled Follow-up Reminders
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Create and track milestones for calling the nodal desk, filing RTI queries, or preparing escalation.
              </p>
            </div>

            <button
              onClick={() => setShowAddReminderModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Reminder</span>
            </button>
          </div>

          {/* Explicit in-app disclaimer */}
          <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 text-xs text-zinc-500">
            <Lock className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>
              <strong>In-App Reminder Disclosure:</strong> Reminders persist in your local case database. NivaranSetu does not send automated background SMS or emails to respect citizen privacy.
            </span>
          </div>

          {/* Reminders List */}
          <div className="space-y-3">
            {(monitoring.reminders || []).length === 0 ? (
              <div className="p-12 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#18181B] space-y-3">
                <Calendar className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-xs">No follow-up reminders scheduled yet.</p>
                <button
                  onClick={() => setShowAddReminderModal(true)}
                  className="px-3 py-1.5 text-xs font-medium text-[#007FFF] hover:underline"
                >
                  Schedule a 7-day status check reminder
                </button>
              </div>
            ) : (
              (monitoring.reminders || []).map((rem) => {
                const isOverdue =
                  rem.status === 'pending' &&
                  new Date(rem.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                return (
                  <div
                    key={rem.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      rem.status === 'completed'
                        ? 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 opacity-70'
                        : isOverdue
                        ? 'bg-red-500/5 border-red-500/30'
                        : 'bg-white dark:bg-[#18181B] border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleReminderStatus(rem.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 cursor-pointer transition-colors ${
                          rem.status === 'completed'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-700 hover:border-[#007FFF]'
                        }`}
                        title={rem.status === 'completed' ? 'Mark pending' : 'Mark completed'}
                      >
                        {rem.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-bold ${
                              rem.status === 'completed'
                                ? 'line-through text-zinc-400'
                                : 'text-zinc-950 dark:text-white'
                            }`}
                          >
                            {rem.title}
                          </span>

                          {isOverdue && (
                            <span className="px-2 py-0.2 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold border border-red-500/20">
                              OVERDUE
                            </span>
                          )}

                          {rem.status === 'completed' && (
                            <span className="px-2 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              COMPLETED
                            </span>
                          )}
                        </div>

                        {rem.description && (
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            {rem.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto shrink-0 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">DUE DATE</span>
                        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                          {rem.dueDate}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteReminder(rem.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Delete reminder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add Reminder Modal */}
          {showAddReminderModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-xl">
                <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                  Schedule In-App Follow-Up Reminder
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Reminder Title
                    </label>
                    <input
                      type="text"
                      value={reminderTitle}
                      onChange={(e) => setReminderTitle(e.target.value)}
                      placeholder="e.g. Call Bank Nodal Officer for investigation update"
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Target Due Date
                    </label>
                    <input
                      type="date"
                      value={reminderDueDate}
                      onChange={(e) => setReminderDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Notes / Action Item Description (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={reminderDesc}
                      onChange={(e) => setReminderDesc(e.target.value)}
                      placeholder="e.g. Check if the 30-day window has expired. Reference docket APEX/PN/2026/INW-714."
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddReminderModal(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddReminder}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer"
                  >
                    Schedule Reminder
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: RESPONSE TRACKING & AI AUDIT                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'responses' && (
        <div className="space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B]">
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Government & Entity Response Tracking
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Upload official reply letters or enter response text. The AI engine classifies whether your grievance has been resolved, rejected, or needs human escalation.
              </p>
            </div>

            <button
              onClick={() => setShowAddResponseModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Record Response</span>
            </button>
          </div>

          {/* Recorded Responses List */}
          <div className="space-y-4">
            {(monitoring.responses || []).length === 0 ? (
              <div className="p-12 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#18181B] space-y-3">
                <FileCheck className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-xs">No response documents or communications recorded yet.</p>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  When you receive an email, letter, or portal update from {currentCase.involvedEntity}, record it here to analyze escalation validity.
                </p>
              </div>
            ) : (
              (monitoring.responses || []).map((resp) => {
                const badgeColor =
                  resp.aiClassification === 'resolved'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : resp.aiClassification === 'unresolved'
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                    : resp.aiClassification === 'partially_resolved'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';

                return (
                  <div
                    key={resp.id}
                    className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          RESPONDENT ENTITY
                        </span>
                        <h4 className="text-sm font-bold text-zinc-950 dark:text-white">
                          {resp.respondentName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-500 font-mono">
                          Received: {resp.receivedDate}
                        </span>
                        {resp.classificationRationale?.toLowerCase().includes('rule-based') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            RULE-BASED
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${badgeColor}`}>
                          {resp.aiClassification.toUpperCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Text preview */}
                    <div className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-mono leading-relaxed whitespace-pre-wrap">
                      {resp.responseText}
                    </div>

                    {/* Document & Hash */}
                    {resp.documentName && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-3.5 h-3.5 text-[#007FFF]" />
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{resp.documentName}</span>
                          {resp.documentHash && (
                            <span className="text-[10px] text-zinc-400">
                              (SHA-256: {resp.documentHash.slice(0, 16)}...)
                            </span>
                          )}
                        </div>
                        {resp.storageRef ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadResponseAttachment(resp)}
                            disabled={downloadingResponseId === resp.id}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[#007FFF] border border-blue-200 dark:border-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{downloadingResponseId === resp.id ? 'Downloading...' : 'Download File'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">
                            (Local legacy record · No cloud copy)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Classification Basis */}
                    {(() => {
                      const isRule = resp.classificationRationale?.toLowerCase().includes('rule-based');
                      return (
                        <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          isRule
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30'
                            : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30'
                        }`}>
                          <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                            isRule ? 'text-amber-700 dark:text-amber-400' : 'text-[#007FFF]'
                          }`}>
                            {isRule ? (
                              <>
                                <Shield className="w-3.5 h-3.5" />
                                <span>Statutory Rule-Based Fallback Rationale (AI Offline):</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI Classification Rationale:</span>
                              </>
                            )}
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed">
                            {resp.classificationRationale}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Response Modal */}
          {showAddResponseModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-zinc-950 dark:text-white">
                    Record Official Entity Response
                  </h4>
                  <button
                    onClick={() => setShowAddResponseModal(false)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Date Response Received
                    </label>
                    <input
                      type="date"
                      value={responseDate}
                      onChange={(e) => setResponseDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Respondent Authority / Officer Name
                    </label>
                    <input
                      type="text"
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      placeholder="e.g. Apex Bank Fraud Dispute Cell"
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Response Content / Letter Text
                    </label>
                    <textarea
                      rows={5}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Paste the official email text or letter excerpt here..."
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Attach Official Document (PDF / Image)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setResponseFile(file);
                        if (file) {
                          setUploadedAttachment(null);
                          setResponseSaveError(null);
                        }
                      }}
                      className="w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#007FFF]/10 file:text-[#007FFF] hover:file:bg-[#007FFF]/20"
                    />
                    {uploadedAttachment ? (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                        <span>✓ Uploaded to storage: <strong>{uploadedAttachment.fileName}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedAttachment(null);
                            setResponseFile(null);
                          }}
                          className="text-[10px] text-zinc-500 hover:text-red-500 underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        SHA-256 digest calculated client-side; uploaded to private cloud storage.
                      </span>
                    )}
                  </div>

                  {responseSaveError && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{responseSaveError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => setShowAddResponseModal(false)}
                    disabled={isAnalyzingResponse}
                    className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRecordResponse}
                    disabled={isAnalyzingResponse}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isAnalyzingResponse ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing Response...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Save & Run AI Audit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: STATUTORY ESCALATION INTELLIGENCE                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'escalation' && (
        <div className="space-y-6">
          
          {/* Eligibility Card */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block font-bold">
                  STATUTORY EVALUATION BENCHMARK
                </span>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  Escalation Eligibility Assessment
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                    escalation.isEligible
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {escalation.isEligible ? 'STATUTORILY ELIGIBLE' : 'WINDOW IN PROGRESS'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                Statutory Determination:
              </span>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {escalation.eligibilityExplanation}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">CURRENT LEVEL</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  {escalation.currentTier}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">STATUTORY DEADLINE</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                  {escalation.statutoryWindowDays} Days ({escalation.daysElapsed} days elapsed)
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-1">
                <span className="text-[10px] text-[#007FFF] uppercase font-mono block">ESCALATION FORUM</span>
                <span className="text-xs font-bold text-[#007FFF] block">
                  {escalation.escalationTier}
                </span>
              </div>
            </div>

            {escalation.isEligible && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-zinc-500">
                  Recommended: Generate a Type B Statutory Escalation Petition and submit via {escalation.portalName}.
                </span>

                <div className="flex items-center gap-2">
                  <a
                    href={escalation.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    <span>Open {escalation.portalName}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => {
                      setSelectedLetterType('statutory_escalation');
                      setLetterDraftContent(generateEscalationPetitionLetter(currentCase));
                      setActiveSubTab('letters');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-lg transition-all"
                  >
                    Draft Escalation Petition →
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 5: FOLLOW-UP LETTER GENERATOR                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'letters' && (
        <div className="space-y-6">
          
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  Follow-Up Letter & Escalation Petition Generator
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Generate legally structured letters to send to bank managers, nodal officers, or statutory ombudsmen.
                </p>
              </div>

              {/* Letter Type Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                <button
                  onClick={() => handleSelectLetterType('status_reminder')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    selectedLetterType === 'status_reminder'
                      ? 'bg-white dark:bg-zinc-800 text-[#007FFF] font-bold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Type A: Status Inquiry Reminder
                </button>
                <button
                  onClick={() => handleSelectLetterType('statutory_escalation')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    selectedLetterType === 'statutory_escalation'
                      ? 'bg-white dark:bg-zinc-800 text-[#007FFF] font-bold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Type B: Statutory Escalation Petition
                </button>
              </div>
            </div>

            {/* Prominent Citizen Review Notice */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Citizen Review Notice:</strong> Review and verify all dates, docket numbers, and facts in this editable text area before delivering it to the official authority.
              </span>
            </div>

            {/* Editable Letter Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 font-mono">
                  EDITABLE LETTER DRAFT:
                </span>
                <span className="text-[11px] text-zinc-400">
                  {selectedLetterType === 'status_reminder'
                    ? 'Target: Grievance Nodal Officer'
                    : 'Target: Hon’ble Statutory Ombudsman / Commission'}
                </span>
              </div>

              <textarea
                rows={16}
                value={letterDraftContent}
                onChange={(e) => setLetterDraftContent(e.target.value)}
                className="w-full text-xs font-mono p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white leading-relaxed focus:outline-none focus:border-[#007FFF]"
              />
            </div>

            {letterSaveNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{letterSaveNotice}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLetter}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {copiedLetter ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLetter ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={handleDownloadLetter}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>
              </div>

              <button
                onClick={handleSaveLetterToHistory}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                Save to Case Record & Log Custody
              </button>
            </div>

          </div>

          {/* Saved Letters History */}
          {(monitoring.generatedLetters || []).length > 0 && (
            <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">
                PREVIOUSLY PREPARED LETTERS ({monitoring.generatedLetters?.length})
              </h4>

              <div className="space-y-2">
                {(monitoring.generatedLetters || []).map((ltr) => (
                  <div
                    key={ltr.id}
                    className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-white block">
                        {ltr.subject}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        Recipient: {ltr.recipientAuthority} · {new Date(ltr.generatedAt).toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <button
                      onClick={() => setLetterDraftContent(ltr.body)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#007FFF] hover:underline self-end sm:self-auto"
                    >
                      Load into Editor →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
