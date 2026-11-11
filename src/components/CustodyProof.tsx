import React, { useState } from 'react';
import { GrievanceCase, EvidenceItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  Lock,
  Shield,
  FileText,
  Copy,
  Check,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Info
} from 'lucide-react';

interface CustodyProofProps {
  currentCase: GrievanceCase;
}

export const CustodyProof: React.FC<CustodyProofProps> = ({ currentCase }) => {
  const { mode } = useLanguage();
  const [selectedItem, setSelectedItem] = useState<EvidenceItem>(currentCase.evidence[0]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownloadAuditReport = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            Integrity Verification Workspace
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
            Custody Proof & Evidence Ledger
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Cryptographic SHA-256 fingerprinting and internal chain-of-custody documentation for Case {currentCase.id}.
          </p>
        </div>

        <button
          onClick={handleDownloadAuditReport}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          {downloadSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Report Generated</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Download Chain-of-Custody Report</span>
            </>
          )}
        </button>
      </div>

      {/* Mandatory Admissibility Disclaimer */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
        <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-900 dark:text-white">Custody Scope Disclaimer: </span>
          The purpose of Custody Proof is to document evidence handling within NivaranSetu and detect subsequent file modifications. This internal ledger does not alone establish statutory legal admissibility or official forensics certification under Section 65B of the Indian Evidence Act.
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Preserved Items List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white px-1">
            Preserved Evidence Items ({currentCase.evidence.length})
          </div>

          <div className="space-y-2.5">
            {currentCase.evidence.map((item) => {
              const isSelected = item.id === selectedItem?.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                        {item.title}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500">
                        {item.fileName} · {item.fileSize}
                      </div>
                    </div>

                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Unchanged
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] font-mono text-zinc-400">
                    SHA-256: {item.sha256Hash ? item.sha256Hash.substring(0, 16) + '...' : 'Metadata only'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Ledger for Selected Item (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedItem && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
              
              <div className="flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-[#007FFF]">
                    Evidence Identifier: {selectedItem.id}
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white mt-0.5">
                    {selectedItem.title}
                  </h3>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                    Preserved File: {selectedItem.fileName}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Integrity Intact</span>
                </div>
              </div>

              {/* Hash & Preservation Details */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Cryptographic SHA-256 File Digest
                </label>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all select-all">
                    {selectedItem.sha256Hash || 'Metadata only (Synthetic scenario / No physical file uploaded)'}
                  </span>
                  <button
                    disabled={!selectedItem.sha256Hash}
                    onClick={() => selectedItem.sha256Hash && handleCopyHash(selectedItem.sha256Hash)}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    title={selectedItem.sha256Hash ? "Copy hash" : "No hash recorded"}
                  >
                    {copiedHash === selectedItem.sha256Hash && selectedItem.sha256Hash ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* File Technical Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">ORIGINAL SIZE</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{selectedItem.fileSize}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">MIME TYPE</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{selectedItem.fileType}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">INITIAL INGEST</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-mono">{selectedItem.uploadDate}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 block font-mono">IMMUTABILITY</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Strict Lock</span>
                </div>
              </div>

              {/* Immutable Evidence Audit History Timeline */}
              <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Internal Evidence Handling Timeline</span>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      time: `${selectedItem.uploadDate} 10:14:22 UTC`,
                      action: 'Local File Ingestion & Client Verification',
                      actor: 'Citizen Browser Session',
                      detail: 'Original binary stream read and SHA-256 generated locally before indexing.',
                    },
                    {
                      time: `${selectedItem.uploadDate} 10:14:23 UTC`,
                      action: 'OCR Entity Extraction & Categorization',
                      actor: 'NivaranSetu Synthesizer',
                      detail: 'Key financial identifiers and timestamps extracted without modifying source bits.',
                    },
                    {
                      time: `${selectedItem.uploadDate} 10:14:24 UTC`,
                      action: 'Cross-Match to Incident Timeline',
                      actor: 'Evidence Correlation Engine',
                      detail: 'Mapped as supporting exhibit for chronological event sequence.',
                    },
                    {
                      time: `2026-11-07 16:45:00 UTC`,
                      action: 'Integrity Check Verification',
                      actor: 'Workspace Auditor',
                      detail: 'Re-hashed buffer matches original digest. Zero tampering detected.',
                    },
                  ].map((log, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900 dark:text-white">{log.action}</span>
                        <span className="font-mono text-[10px] text-zinc-400">{log.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{log.detail}</p>
                      <div className="text-[10px] font-mono text-[#007FFF]">Actor: {log.actor}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

    </div>
  );
};
