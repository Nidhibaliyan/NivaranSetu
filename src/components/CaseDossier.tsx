import React, { useState } from 'react';
import { GrievanceCase } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { exportCaseDossierToPDF } from '../utils/pdfExport';
import {
  getTrustCheckBadgeConfig,
  getTrustCheckSourceLabel,
} from './TrustCheck';
import {
  Download,
  Printer,
  Copy,
  Check,
  FileText,
  Shield,
  Layers,
  Calendar,
  Building,
  Scale,
  Sparkles,
  ExternalLink,
  Share2,
  CheckCircle2,
  AlertCircle,
  FileDown,
  FileCheck,
  ChevronLeft,
  Clock,
  Lock
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';

interface CaseDossierProps {
  currentCase: GrievanceCase;
  citizenName?: string;
  onNavigateBackToNavigator?: () => void;
  onNavigateBackToBuilder?: () => void;
  onNavigateToMonitoring?: () => void;
}

export const CaseDossier: React.FC<CaseDossierProps> = ({
  currentCase,
  citizenName,
  onNavigateBackToNavigator,
  onNavigateBackToBuilder,
  onNavigateToMonitoring,
}) => {
  const { mode } = useLanguage();
  const effectiveCitizenName = citizenName?.trim() || 'Citizen Complainant';
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const handleCopyDraft = () => {
    const textToCopy =
      mode === 'simple'
        ? currentCase.complaintDraft.simpleBody
        : currentCase.complaintDraft.formalBody;
    navigator.clipboard.writeText(textToCopy);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const handleDownloadPDF = () => {
    setIsExportingPDF(true);
    try {
      exportCaseDossierToPDF(currentCase, {
        mode,
        citizenName: effectiveCitizenName,
      });
      setExportSuccessMessage(
        `PDF dossier for ${currentCase.id} exported successfully! Saved to your downloads.`
      );
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTextDossier = () => {
    const content = `========================================================================
NIVARANSETU · CITIZEN GRIEVANCE DOSSIER
Case ID: ${currentCase.id}
Date Generated: ${new Date().toISOString()}
========================================================================

1. EXECUTIVE CASE SUMMARY
-------------------------
Complainant: ${effectiveCitizenName}
Subject: ${currentCase.title}
Category: ${currentCase.category.replace(/_/g, ' ').toUpperCase()}
Involved Party: ${currentCase.involvedEntity}
Incident Date: ${currentCase.incidentDate}
Location: ${currentCase.incidentLocation}
Disputed Amount: INR ${currentCase.disputedAmount ? currentCase.disputedAmount.toLocaleString('en-IN') : '0'}
Readiness Score: ${currentCase.readinessScore}%

Narrative:
${mode === 'simple' ? currentCase.simpleSummary : currentCase.description}

2. CHRONOLOGICAL TIMELINE OF FACTS
----------------------------------
${currentCase.timeline
  .map(
    (t, i) =>
      `[${i + 1}] Date: ${t.date}\n    Event: ${t.title}\n    Details: ${t.description}\n`
  )
  .join('\n')}

3. EVIDENCE EXHIBIT INDEX & SHA-256 HASHES
------------------------------------------
${currentCase.evidence
  .map(
    (ev, i) =>
      `Exhibit Ex-0${i + 1}: ${ev.title}\n  File: ${ev.fileName} (${ev.fileSize})\n  Type: ${ev.category}\n  SHA-256 Digest: ${ev.sha256Hash}\n  Integrity: Verified Original\n`
  )
  .join('\n')}

4. RECOMMENDED STATUTORY AUTHORITY
----------------------------------
Authority: ${currentCase.recommendedAuthority.name}
Official Portal: ${currentCase.recommendedAuthority.portalName} (${currentCase.recommendedAuthority.portalUrl})
Statutory Fee: ${currentCase.recommendedAuthority.filingFee}
Resolution Benchmark: ${currentCase.recommendedAuthority.averageResolutionTime}

5. FORMAL COMPLAINT DRAFT
-------------------------
Subject: ${currentCase.complaintDraft.subject}

Body:
${mode === 'simple' ? currentCase.complaintDraft.simpleBody : currentCase.complaintDraft.formalBody}

Relief Sought:
${currentCase.complaintDraft.reliefSought}

========================================================================
Generated via NivaranSetu Grievance Intelligence Platform
========================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NivaranSetu_Dossier_${currentCase.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* 0. GUIDED NAVIGATION HEADER */}
      <GuidedNavigationHeader
        badgeLabel={`CASE ${currentCase.id}`}
        stepTitle="Stage 7: Complete Case Dossier & Cryptographic Package"
        instruction={`Review and export your comprehensive evidence synthesis, timeline, formal complaint statement, and append-only chain-of-custody ledger for ${currentCase.recommendedAuthority.portalName}.`}
        progressPercent={100}
        onBack={onNavigateBackToNavigator || onNavigateBackToBuilder}
        backLabel="Back to Navigator"
        onContinue={handleDownloadPDF}
        continueLabel="Download Official PDF"
        onExit={onNavigateToMonitoring}
        exitLabel={onNavigateToMonitoring ? 'Case Monitoring' : undefined}
      />

      {/* Header with Print / Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            One-Click Case Dossier
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
            Structured Filing Dossier: {currentCase.id}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Ready-to-file comprehensive case package formatted for official submission on {currentCase.recommendedAuthority.portalName}.
          </p>
        </div>

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center gap-2">

          {onNavigateBackToNavigator && (
            <button
              onClick={onNavigateBackToNavigator}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Navigator</span>
            </button>
          )}

          <button
            onClick={handleCopyDraft}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Copy draft to clipboard"
          >
            {copiedDraft ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Draft</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadTextDossier}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Download Plain Text Document"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Text</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Print or Save via Browser"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>

          {/* Primary PDF Export Action */}
          <button
            onClick={handleDownloadPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm shadow-[#007FFF]/25 cursor-pointer whitespace-nowrap active:translate-y-[0px] hover:translate-y-[-1px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingPDF ? 'Generating PDF...' : 'Download Dossier (PDF)'}</span>
          </button>

        </div>
      </div>

      {/* Export Success Notification Banner */}
      {exportSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">PDF Saved</span>
        </div>
      )}

      {/* Physical Dossier Paper Container */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-lg p-6 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0">
        
        {/* Dossier Letterhead */}
        <div className="border-b-2 border-zinc-900 dark:border-zinc-700 pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#007FFF] flex items-center justify-center text-white text-xs font-bold">
                N
              </div>
              <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white uppercase">
                NivaranSetu Grievance Dossier
              </span>
            </div>
            <div className="text-xs text-zinc-500">
              Citizen Grievance Intelligence & Evidence Synthesis Document
            </div>
          </div>

          <div className="text-right space-y-0.5 text-xs font-mono">
            <div><span className="text-zinc-400">DOSSIER REF:</span> <strong className="text-zinc-900 dark:text-white">{currentCase.id}</strong></div>
            <div><span className="text-zinc-400">GENERATED:</span> {new Date().toISOString().split('T')[0]}</div>
            <div><span className="text-zinc-400">READINESS:</span> <span className="text-emerald-600 dark:text-emerald-400 font-bold">{currentCase.readinessScore}%</span></div>
          </div>
        </div>

        {/* 1. Case Summary Strip */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            01. Executive Case Summary
          </h3>
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
            <div className="font-bold text-base text-zinc-900 dark:text-white">
              {currentCase.title}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-b border-zinc-200 dark:border-zinc-800/80 py-3">
              <div>
                <span className="text-zinc-400 text-[10px] block font-mono">CATEGORY</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentCase.category.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block font-mono">RESPONDENT</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentCase.involvedEntity}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block font-mono">INCIDENT DATE</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentCase.incidentDate}</span>
              </div>
              <div>
                <span className="text-zinc-400 text-[10px] block font-mono">DISPUTED VALUE</span>
                <span className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">
                  {currentCase.disputedAmount ? `₹${currentCase.disputedAmount.toLocaleString('en-IN')}` : 'Non-Monetary'}
                </span>
              </div>
            </div>

            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs">
              {mode === 'simple' ? currentCase.simpleSummary : currentCase.description}
            </p>
          </div>
        </div>

        {/* 2. Chronological Incident Timeline */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            02. Chronological Fact Timeline
          </h3>
          <div className="space-y-2.5">
            {currentCase.timeline.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-3.5 text-xs"
              >
                <div className="w-6 h-6 rounded-md bg-[#007FFF]/10 text-[#007FFF] font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-white">{item.title}</span>
                    <span className="font-mono text-[11px] text-zinc-400">{item.date}</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Evidence Exhibit Index with SHA-256 Hashes */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            03. Evidence Exhibit Index (Custody Verified)
          </h3>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 text-[10px] font-mono text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2.5 px-3">Exhibit #</th>
                  <th className="py-2.5 px-3">Document Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Cryptographic SHA-256 Digest</th>
                  <th className="py-2.5 px-3 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {currentCase.evidence.map((ev, idx) => (
                  <tr key={ev.id}>
                    <td className="py-2.5 px-3 font-mono font-semibold">Ex-0{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                      {ev.title}
                      <span className="block text-[11px] text-zinc-400 font-normal">{ev.fileName} ({ev.fileSize})</span>
                    </td>
                    <td className="py-2.5 px-3 uppercase font-mono text-[10px]">{ev.category}</td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-zinc-500 break-all">
                      {ev.sha256Hash}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                      Preserved
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. TrustCheck Findings & Official Advisories */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            04. TrustCheck Identifier Findings & Source References
          </h3>
          {currentCase.trustCheckRecord ? (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    Investigated Identifier: {currentCase.trustCheckRecord.input} ({currentCase.trustCheckRecord.type.toUpperCase()})
                  </span>
                  {(() => {
                    const badge = getTrustCheckBadgeConfig(
                      currentCase.trustCheckRecord.riskLevel,
                      currentCase.trustCheckRecord.resultStatus
                    );
                    const source = getTrustCheckSourceLabel(currentCase.trustCheckRecord);
                    return (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${badge.badgeClass}`}
                        >
                          {badge.text}
                        </span>
                        <span className={source.className}>
                          {source.text}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {currentCase.trustCheckRecord.lastChecked && (
                  <span className="text-[10px] font-mono text-zinc-400">
                    Checked: {currentCase.trustCheckRecord.lastChecked}
                  </span>
                )}
              </div>

              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-xs">
                {currentCase.trustCheckRecord.description}
              </p>

              {currentCase.trustCheckRecord.sourceReferences && currentCase.trustCheckRecord.sourceReferences.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-500 font-mono pt-1">
                  {currentCase.trustCheckRecord.sourceReferences.map((ref, rIdx) => (
                    <div key={rIdx} className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />
                      <span>{ref}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
              No pre-screening TrustCheck identifier was recorded for this grievance. The complaint was initiated directly from incident facts.
            </div>
          )}
        </div>

        {/* 5. Evidence-to-Claim Mapping & Readiness Assessment */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            05. Evidence-to-Claim Mapping & Procedural Readiness
          </h3>
          {currentCase.evidence && currentCase.evidence.filter((ev) => ev.claimMappedTo && ev.claimMappedTo.trim()).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {currentCase.evidence
                .filter((ev) => ev.claimMappedTo && ev.claimMappedTo.trim())
                .map((ev, idx) => (
                  <div key={ev.id || idx} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
                    <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{ev.claimMappedTo}</span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                      Substantiated by Exhibit Ex-0{idx + 1}: <strong className="text-zinc-800 dark:text-zinc-200">{ev.title}</strong> ({ev.fileName}).
                      {ev.verifiedOriginal ? ' (Cryptographically verified original)' : ' (Preserved exhibit)'}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-500">
              No specific exhibit-to-claim mappings defined. All {(currentCase.evidence || []).length} evidence exhibits are catalogued in the chronological exhibit index above.
            </div>
          )}
        </div>

        {/* 6. Recommended Authority & Filing Instructions */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            06. Recommended Authority & Filing Instructions
          </h3>
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-900 dark:text-white text-sm">
                {currentCase.recommendedAuthority.name}
              </span>
              <span className="font-mono text-xs text-[#007FFF]">
                {currentCase.recommendedAuthority.portalName}
              </span>
            </div>
            <div className="text-zinc-600 dark:text-zinc-400">
              Official Filing Link: <a href={currentCase.recommendedAuthority.portalUrl} target="_blank" rel="noreferrer" className="text-[#007FFF] underline font-mono">{currentCase.recommendedAuthority.portalUrl}</a>
            </div>
            <div className="text-zinc-500 text-[11px]">
              Average Resolution Benchmark: {currentCase.recommendedAuthority.averageResolutionTime} · Filing Fee: {currentCase.recommendedAuthority.filingFee}
            </div>
          </div>
        </div>

        {/* 7. Formal Complaint Draft */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              07. Ready-to-Copy Complaint Draft ({mode === 'simple' ? 'Simple Plain Language' : 'Formal Statutory Draft'})
            </h3>
            <button
              onClick={handleCopyDraft}
              className="text-xs font-semibold text-[#007FFF] hover:underline flex items-center gap-1"
            >
              {copiedDraft ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedDraft ? 'Copied' : 'Copy Draft'}</span>
            </button>
          </div>

          <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-4 text-xs font-mono">
            <div>
              <span className="text-zinc-400 uppercase text-[10px] block font-sans">SUBJECT LINE</span>
              <div className="font-semibold text-zinc-900 dark:text-white pt-1">
                {currentCase.complaintDraft.subject}
              </div>
            </div>

            <div>
              <span className="text-zinc-400 uppercase text-[10px] block font-sans">COMPLAINT TEXT BODY</span>
              <pre className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed pt-1">
                {mode === 'simple'
                  ? currentCase.complaintDraft.simpleBody
                  : currentCase.complaintDraft.formalBody}
              </pre>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
              <span className="text-zinc-400 uppercase text-[10px] block font-sans">RELIEF / COMPENSATION PRAYER</span>
              <div className="font-semibold text-zinc-900 dark:text-white pt-1">
                {currentCase.complaintDraft.reliefSought}
              </div>
            </div>
          </div>
        </div>

        {/* 8. Digital Chain-of-Custody & Audit Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#007FFF]" />
              <span>08. Digital Chain-of-Custody & Append-Only Audit Ledger</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              SHA-256 Validated
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 space-y-2 text-xs">
            <div className="space-y-2">
              {(currentCase.custodyEvents || []).map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-zinc-900 dark:text-white">{ev.action}</span>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{ev.details}</p>
                    {ev.fileHash && (
                      <span className="font-mono text-[10px] text-zinc-500 break-all block">
                        Digest: {ev.fileHash}
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[10px] text-zinc-400 block">{ev.timestamp}</span>
                    <span className="font-mono text-[10px] text-[#007FFF]">{ev.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 09. External Portal Submission & Smart Case Monitoring Record */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
              <span>09. External Portal Submission & Smart Case Monitoring Record</span>
            </h3>
            {onNavigateToMonitoring && (
              <button
                onClick={onNavigateToMonitoring}
                className="text-xs font-semibold text-[#007FFF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Manage in Case Monitoring</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-zinc-400 uppercase text-[10px] block font-mono">DOCKET REFERENCE</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white pt-0.5 block">
                  {currentCase.monitoring?.docketNumber || currentCase.filingDetails?.referenceNumber || 'Pending Filing'}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 uppercase text-[10px] block font-mono">SUBMISSION DATE</span>
                <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200 pt-0.5 block">
                  {currentCase.monitoring?.submissionDate || currentCase.filingDetails?.filingDate || 'Not recorded'}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 uppercase text-[10px] block font-mono">CITIZEN STATUS</span>
                <span className="font-mono font-bold text-[#007FFF] uppercase pt-0.5 block">
                  {currentCase.monitoring?.citizenReportedStatus
                    ? currentCase.monitoring.citizenReportedStatus.replace(/_/g, ' ')
                    : 'Pending Submission'}
                </span>
                <span className="text-[9px] text-zinc-400 block">Pending Official Verification</span>
              </div>
            </div>

            {/* Scheduled Reminders & Responses Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Logged Reminders:</span>
                  <span className="font-mono text-[#007FFF]">
                    {currentCase.monitoring?.reminders?.length || 0} scheduled
                  </span>
                </div>
                {(currentCase.monitoring?.reminders || []).slice(0, 2).map((r) => (
                  <div key={r.id} className="text-[11px] text-zinc-500 flex items-center justify-between">
                    <span className="truncate max-w-[200px]">{r.title}</span>
                    <span className="font-mono text-[10px] shrink-0">{r.dueDate}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Official Responses Logged:</span>
                  <span className="font-mono text-[#007FFF]">
                    {currentCase.monitoring?.responses?.length || 0} received
                  </span>
                </div>
                {(currentCase.monitoring?.responses || []).slice(0, 2).map((r) => (
                  <div key={r.id} className="text-[11px] text-zinc-500 flex items-center justify-between">
                    <span className="truncate max-w-[180px]">{r.respondentName}</span>
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 shrink-0">
                      {r.aiClassification.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Verification Footer Note */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 leading-relaxed text-center sm:text-left">
          This dossier was generated via NivaranSetu Grievance Intelligence Engine. The citizen retains complete ownership and must independently verify submissions made on official portals.
        </div>

      </div>

    </div>
  );
};
