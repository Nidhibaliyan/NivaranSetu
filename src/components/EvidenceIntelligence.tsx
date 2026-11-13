import React, { useState, useEffect } from 'react';
import { GrievanceCase, EvidenceItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  resolveExhibitOcrData,
  hasGenuineOcrContent,
  ExhibitOcrData,
} from '../utils/evidenceOcr';
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  Check,
  Shield,
  Eye,
  FileCheck,
  AlertCircle,
  ScanLine,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Terminal,
  FileCode,
  Sliders,
  CheckSquare,
  Square,
  RefreshCw,
  Maximize2
} from 'lucide-react';

interface EvidenceIntelligenceProps {
  currentCase: GrievanceCase;
  onUpdateCase?: (updated: GrievanceCase) => void;
}

export const EvidenceIntelligence: React.FC<EvidenceIntelligenceProps> = ({
  currentCase,
  onUpdateCase,
}) => {
  const { mode } = useLanguage();
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>(
    currentCase.evidence[0]?.id || ''
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedRawText, setCopiedRawText] = useState(false);

  // View mode within Exhibit detail: 'overview' | 'ocr_preview'
  const [detailTab, setDetailTab] = useState<'ocr_preview' | 'overview'>('ocr_preview');

  // OCR Processing state
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [ocrProgressStep, setOcrProgressStep] = useState<string>('');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [activeHighlightId, setActiveHighlightId] = useState<number | null>(null);
  const [rawTextSearchQuery, setRawTextSearchQuery] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const selectedEvidence = currentCase.evidence.find((e) => e.id === selectedEvidenceId) || currentCase.evidence[0];

  const filteredEvidence = currentCase.evidence.filter((e) => {
    if (filterCategory === 'all') return true;
    return e.category === filterCategory;
  });

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleCopyRawText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRawText(true);
    setTimeout(() => setCopiedRawText(false), 2000);
  };

  const ocrData: ExhibitOcrData = resolveExhibitOcrData(selectedEvidence);

  // Trigger simulated OCR scanning animation ONLY for synthetic demonstration exhibits
  const runSimulatedOcrScan = () => {
    if (!selectedEvidence || selectedEvidence.hasBlob === true || ocrData.status !== 'demo') {
      return;
    }
    setIsOcrProcessing(true);
    setOcrProgressStep('Initializing demo walkthrough view...');

    setTimeout(() => {
      setOcrProgressStep('Refreshing sample exhibit annotations...');
    }, 400);

    setTimeout(() => {
      setOcrProgressStep('Restoring sample extracted fields...');
    }, 850);

    setTimeout(() => {
      setIsOcrProcessing(false);
      setOcrProgressStep('');
    }, 1300);
  };

  // Run initial scan simulation when changing exhibit if OCR tab is open
  useEffect(() => {
    setActiveHighlightId(null);
  }, [selectedEvidenceId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
            <ScanLine className="w-4 h-4" />
            <span>Evidence Intelligence & OCR Studio</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white mt-0.5">
            {currentCase.id}: {currentCase.title}
          </h2>
          <div className="text-xs text-zinc-500 mt-1">
            {currentCase.evidence.length} indexed exhibits · Multimodal OCR Text Extraction & Custody Verification
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-[#007FFF]"
          >
            <option value="all">All Document Types ({currentCase.evidence.length})</option>
            <option value="receipt">Receipts</option>
            <option value="screenshot">Screenshots</option>
            <option value="bank_statement">Bank Statements</option>
            <option value="notice">Notices & Complaints</option>
            <option value="agreement">Agreements</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Left Evidence List (4 Cols) vs Right Detail & Mock OCR Studio (8 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: EVIDENCE INDEX & GAP ALERTS (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Missing Evidence & Contradiction Alerts Box */}
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Evidence Gap & Pre-Filing Alerts</span>
            </div>

            {currentCase.missingElements.length > 0 ? (
              <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1 pl-1">
                {currentCase.missingElements.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero missing documents detected. All critical claims backed by exhibits.</span>
              </div>
            )}
          </div>

          {/* Evidence Cards List */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-zinc-900 dark:text-white px-1 flex items-center justify-between">
              <span>Indexed Exhibits ({filteredEvidence.length})</span>
              <span className="text-[10px] text-zinc-400 font-mono">Select to inspect</span>
            </div>

            {filteredEvidence.map((ev) => {
              const isSelected = ev.id === selectedEvidenceId;
              const evOcr = resolveExhibitOcrData(ev);
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvidenceId(ev.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-sm ring-1 ring-[#007FFF]/40'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#007FFF]" />
                        <span>{ev.title}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {ev.fileName} · {ev.fileSize}
                      </div>
                    </div>

                    <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0 font-semibold">
                      {ev.category}
                    </span>
                  </div>

                  {/* Summary Snippet */}
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
                    {hasGenuineOcrContent(ev)
                      ? ev.ocrExtracted.summary || ev.rawOcrText || 'OCR text recorded'
                      : evOcr.status === 'no_text'
                      ? 'No text detected in this exhibit.'
                      : evOcr.status === 'failed'
                      ? 'OCR scan unavailable.'
                      : 'OCR scan pending — preserved via SHA-256.'}
                  </div>

                  {/* Integrity tag */}
                  <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>Hash: {ev.sha256Hash ? ev.sha256Hash.slice(0, 10) + '...' : 'Metadata'}</span>
                    {evOcr.status === 'demo' || evOcr.status === 'processed' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{evOcr.status === 'demo' ? 'Sample OCR Fixture' : 'OCR Processed'}</span>
                      </span>
                    ) : evOcr.status === 'no_text' ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>No Text Detected</span>
                      </span>
                    ) : evOcr.status === 'failed' ? (
                      <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>OCR Failed</span>
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>OCR Scan Pending</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* RIGHT COLUMN: OCR PREVIEW STUDIO & RAW TEXT EXTRACTION (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {selectedEvidence ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 sm:p-6 space-y-5 shadow-xs">
              
              {/* Exhibit Header with View Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <div className="text-[10px] font-mono font-bold text-[#007FFF] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Exhibit Analysis · {selectedEvidence.category.toUpperCase()}</span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-950 dark:text-white mt-0.5">
                    {selectedEvidence.title}
                  </h3>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">
                    File: {selectedEvidence.fileName} ({selectedEvidence.fileSize})
                  </div>
                </div>

                {/* Sub-tab switcher: Mock OCR Side-by-Side vs Structured Metadata */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 text-xs">
                  <button
                    onClick={() => setDetailTab('ocr_preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                      detailTab === 'ocr_preview'
                        ? 'bg-white dark:bg-zinc-900 text-[#007FFF] shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>OCR Side-by-Side</span>
                  </button>
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-semibold ${
                      detailTab === 'overview'
                        ? 'bg-white dark:bg-zinc-900 text-[#007FFF] shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Extracted Entities</span>
                  </button>
                </div>
              </div>

              {/* =========================================================
                  TAB A: MOCK OCR PROCESSING & SIDE-BY-SIDE RAW TEXT PREVIEW
                 ========================================================= */}
              {detailTab === 'ocr_preview' && (
                <div className="space-y-4">
                  
                  {/* OCR Toolbar: Status indicator, Re-run button, Bounding boxes toggle */}
                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      {ocrData.status === 'demo' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Demo OCR Confidence: {ocrData.confidence}%</span>
                        </span>
                      ) : ocrData.status === 'processed' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-[11px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>OCR Text Recorded</span>
                        </span>
                      ) : ocrData.status === 'no_text' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-mono font-bold text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>No Text Detected</span>
                        </span>
                      ) : ocrData.status === 'failed' ? (
                        <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-mono font-bold text-[11px] flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>OCR Unavailable</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-mono font-bold text-[11px] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>OCR Scan Pending</span>
                        </span>
                      )}

                      <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
                        Engine: {ocrData.engine}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Toggle Bounding Boxes Overlay */}
                      <button
                        onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                        disabled={ocrData.boundingBoxes.length === 0}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          ocrData.boundingBoxes.length === 0
                            ? 'border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed opacity-50'
                            : showBoundingBoxes
                            ? 'border-[#007FFF] bg-[#007FFF]/10 text-[#007FFF] cursor-pointer'
                            : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 cursor-pointer'
                        }`}
                        title={
                          ocrData.boundingBoxes.length === 0
                            ? 'No bounding boxes available for this exhibit'
                            : 'Toggle OCR text bounding boxes on document image'
                        }
                      >
                        {showBoundingBoxes && ocrData.boundingBoxes.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        <span>Bounding Boxes</span>
                      </button>

                      {/* Re-run Simulated Scan (Demo exhibits only) */}
                      {selectedEvidence.hasBlob !== true && ocrData.status === 'demo' ? (
                        <button
                          onClick={runSimulatedOcrScan}
                          disabled={isOcrProcessing}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#007FFF] hover:bg-[#0070e0] disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          title="Replay demo OCR walkthrough"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isOcrProcessing ? 'animate-spin' : ''}`} />
                          <span>{isOcrProcessing ? 'Scanning...' : 'Replay Demo'}</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 text-[11px] font-mono">
                          {ocrData.hasGenuineOcr ? 'Verified OCR Record' : 'Automated OCR Pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scanning Animation Status Toast */}
                  {isOcrProcessing && (
                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-[#007FFF] flex items-center gap-2.5 animate-pulse">
                      <ScanLine className="w-4 h-4 animate-bounce" />
                      <span className="font-mono font-semibold">{ocrProgressStep}</span>
                    </div>
                  )}

                  {/* SIDE-BY-SIDE CONTAINER: Original Document Image (Left) vs Raw Extracted OCR Text (Right) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* LEFT PANE: ORIGINAL DOCUMENT IMAGE PREVIEW */}
                    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/70 overflow-hidden shadow-2xs">
                      
                      {/* Image Header with Controls */}
                      <div className="px-3.5 py-2 bg-zinc-200/70 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                          <Eye className="w-3.5 h-3.5 text-[#007FFF]" />
                          <span>Original Document Source</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-zinc-500">
                          <button
                            onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
                            className="p-1 hover:text-zinc-900 dark:hover:text-white rounded"
                            title="Zoom out"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] font-mono px-1">{zoomLevel}%</span>
                          <button
                            onClick={() => setZoomLevel((z) => Math.min(160, z + 15))}
                            className="p-1 hover:text-zinc-900 dark:hover:text-white rounded"
                            title="Zoom in"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setZoomLevel(100)}
                            className="p-1 hover:text-zinc-900 dark:hover:text-white rounded"
                            title="Reset zoom"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Document Canvas / Image Container */}
                      <div className="relative p-4 flex-1 flex items-center justify-center overflow-auto min-h-[380px] max-h-[480px]">
                        
                        {/* Simulated Original Document Sheet */}
                        <div
                          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                          className="relative w-full max-w-[340px] rounded-lg bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 p-5 shadow-md border border-zinc-300 dark:border-zinc-700 font-mono text-[10px] leading-tight select-none transition-transform duration-200 overflow-hidden"
                        >
                          {/* Animated Scan Bar during OCR process */}
                          {isOcrProcessing && (
                            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#007FFF] to-transparent shadow-[0_0_12px_#007FFF] animate-[scan_1.2s_ease-in-out_infinite] z-20" />
                          )}

                          {/* Watermark / Seal Stamp (Only if genuinely verified original) */}
                          {selectedEvidence.verifiedOriginal && (
                            <div className="absolute right-4 bottom-4 border-2 border-emerald-600/30 rounded-full w-20 h-20 flex items-center justify-center -rotate-12 pointer-events-none text-[8px] font-bold text-emerald-600/40 uppercase tracking-widest text-center leading-none">
                              VERIFIED<br />EXHIBIT
                            </div>
                          )}

                          {/* Visual Content of the Document */}
                          {selectedEvidence.hasBlob === true && !ocrData.hasGenuineOcr ? (
                            <div className="space-y-3 relative z-10">
                              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-[11px] text-zinc-950 dark:text-white uppercase tracking-wider">
                                    {selectedEvidence.title}
                                  </div>
                                  <div className="text-[9px] text-zinc-500">
                                    FILE: {selectedEvidence.fileName}
                                  </div>
                                </div>
                                <div className="text-[8px] text-zinc-400 text-right shrink-0">
                                  UPLOADED: {selectedEvidence.uploadDate}
                                </div>
                              </div>

                              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-700 dark:text-amber-300 space-y-1">
                                <div className="font-bold uppercase tracking-wider">
                                  {ocrData.status === 'no_text'
                                    ? 'No text detected'
                                    : ocrData.status === 'failed'
                                    ? 'OCR scan unavailable'
                                    : 'OCR scan pending'}
                                </div>
                                <p className="leading-snug text-zinc-600 dark:text-zinc-300">
                                  {ocrData.status === 'no_text'
                                    ? 'No readable text was detected in this uploaded binary file. Relevance and extracted facts cannot be inferred from the image.'
                                    : 'Genuine OCR text extraction has not been completed for this uploaded binary file yet.'}
                                </p>
                              </div>

                              <div className="space-y-1 text-[8.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                <div>Format: {selectedEvidence.fileType} · Size: {selectedEvidence.fileSize}</div>
                                <div className="font-mono text-[7.5px] break-all pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                  SHA-256: {selectedEvidence.sha256Hash || 'Pending'}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 relative z-10">
                              {/* Document Header */}
                              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-start justify-between">
                                <div>
                                  <div className="font-bold text-[11px] text-zinc-950 dark:text-white uppercase tracking-wider">
                                    {selectedEvidence.title}
                                  </div>
                                  <div className="text-[9px] text-zinc-400">
                                    REF ID: {selectedEvidence.ocrExtracted.identifiers[0] || 'None extracted'}
                                  </div>
                                </div>
                                <div className="text-[8px] text-zinc-400 text-right">
                                  DATE: {selectedEvidence.ocrExtracted.dates[0] || selectedEvidence.uploadDate}
                                </div>
                              </div>

                              {/* Extracted Metadata Summary */}
                              <div className="space-y-2 text-[9px] text-zinc-700 dark:text-zinc-300">
                                <p className="leading-snug">
                                  {ocrData.status === 'demo'
                                    ? 'SAMPLE DEMONSTRATION EXHIBIT:'
                                    : 'RECORDED EXHIBIT METADATA:'}
                                </p>

                                <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                                  <div className="flex justify-between gap-2">
                                    <span className="font-semibold">PARTY / ENTITY:</span>
                                    <span>{selectedEvidence.ocrExtracted.parties[0] || 'None detected'}</span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="font-semibold">RECORDED SUM:</span>
                                    <span className="font-bold text-[#007FFF]">
                                      {selectedEvidence.ocrExtracted.amounts[0] || 'None detected'}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1 text-[8.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                                  <div>Summary: {selectedEvidence.ocrExtracted.summary || 'None'}</div>
                                  <div className="font-mono text-[7.5px] break-all pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                    DIGITAL SIGNATURE: {selectedEvidence.sha256Hash ? `SHA-256:${selectedEvidence.sha256Hash.slice(0, 32)}...` : 'Metadata only (Demo exhibit)'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* OVERLAY: Interactive Bounding Boxes */}
                          {showBoundingBoxes && ocrData.boundingBoxes.map((box) => {
                            const isFocused = activeHighlightId === box.id;
                            const isSearchMatch = rawTextSearchQuery && box.text.toLowerCase().includes(rawTextSearchQuery.toLowerCase());

                            return (
                              <div
                                key={box.id}
                                onMouseEnter={() => setActiveHighlightId(box.id)}
                                onMouseLeave={() => setActiveHighlightId(null)}
                                style={{
                                  top: `${box.topPercent}%`,
                                  left: `${box.leftPercent}%`,
                                  width: `${box.widthPercent}%`,
                                  height: `${box.heightPercent}%`,
                                }}
                                className={`absolute border transition-all duration-150 cursor-pointer rounded pointer-events-auto ${
                                  isFocused
                                    ? 'border-[#007FFF] bg-[#007FFF]/25 ring-2 ring-[#007FFF] z-30'
                                    : isSearchMatch
                                    ? 'border-amber-500 bg-amber-500/20 ring-1 ring-amber-500 z-20'
                                    : 'border-[#007FFF]/40 bg-[#007FFF]/5 hover:border-[#007FFF] hover:bg-[#007FFF]/15'
                                }`}
                              >
                                <span className="absolute -top-3 left-1 px-1 py-0.2 rounded bg-[#007FFF] text-white text-[8px] font-mono font-bold leading-none shadow-2xs">
                                  #{box.id}
                                </span>
                              </div>
                            );
                          })}

                        </div>

                      </div>

                      {/* Image Footer Note */}
                      <div className="px-3 py-1.5 bg-zinc-200/50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700/60 text-[10px] text-zinc-500 flex items-center justify-between">
                        <span>Hover bounding boxes to trace in raw OCR text</span>
                        <span className="font-mono">300 DPI Original</span>
                      </div>
                    </div>

                    {/* RIGHT PANE: EXTRACTED RAW OCR TEXT */}
                    <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#09090B] text-zinc-100 overflow-hidden shadow-2xs">
                      
                      {/* Raw Text Header */}
                      <div className="px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Terminal className="w-3.5 h-3.5 text-[#007FFF]" />
                          <span className="font-mono text-zinc-300 font-semibold text-[11px]">
                            raw_ocr_stream.txt
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Search within raw text */}
                          <div className="relative">
                            <input
                              type="text"
                              value={rawTextSearchQuery}
                              onChange={(e) => setRawTextSearchQuery(e.target.value)}
                              placeholder="Search OCR text..."
                              className="w-28 sm:w-36 text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-[#007FFF]"
                            />
                          </div>

                          {/* Copy Raw Text Button */}
                          <button
                            onClick={() => handleCopyRawText(ocrData.rawText)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Copy full raw OCR text stream"
                          >
                            {copiedRawText ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Text</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Raw Text Scrollable Terminal Body with Line Numbers */}
                      <div className="p-3.5 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 min-h-[380px] max-h-[480px] text-zinc-300 select-text">
                        {ocrData.rawText.split('\n').map((line, lineIdx) => {
                          const lineNum = lineIdx + 1;
                          const isSearchHit = rawTextSearchQuery && line.toLowerCase().includes(rawTextSearchQuery.toLowerCase());

                          return (
                            <div
                              key={lineIdx}
                              className={`flex items-start gap-3 px-1 py-0.5 rounded transition-colors ${
                                isSearchHit
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'hover:bg-zinc-800/60'
                              }`}
                            >
                              <span className="text-[10px] text-zinc-600 select-none w-5 text-right shrink-0">
                                {lineNum}
                              </span>
                              <span className="break-all whitespace-pre-wrap flex-1">
                                {line}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Raw Text Stream Footer Stats */}
                      <div className="px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                        <span>{ocrData.charCount} Characters · {ocrData.lineCount} Lines</span>
                        <span className="text-[#007FFF]">UTF-8 Raw Output</span>
                      </div>
                    </div>

                  </div>

                  {/* PARSED ENTITY EXTRACTION RESULTS SUMMARY */}
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4 text-emerald-500" />
                        <span>OCR Entity Recognition (NER Pipeline)</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">4 Categories Detected</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {/* Extracted Amounts */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                        <div className="text-[10px] uppercase font-mono font-bold text-[#007FFF]">
                          Monetary Figures
                        </div>
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {selectedEvidence.ocrExtracted.amounts.join(', ') || 'None detected'}
                        </div>
                      </div>

                      {/* Extracted Dates */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                        <div className="text-[10px] uppercase font-mono font-bold text-purple-500">
                          Dates & Timestamps
                        </div>
                        <div className="font-mono text-zinc-900 dark:text-white text-[11px]">
                          {selectedEvidence.ocrExtracted.dates.join(', ') || 'None detected'}
                        </div>
                      </div>

                      {/* Reference IDs */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                        <div className="text-[10px] uppercase font-mono font-bold text-amber-500">
                          Identifiers & UTRs
                        </div>
                        <div className="font-mono text-zinc-900 dark:text-white text-[11px] truncate">
                          {selectedEvidence.ocrExtracted.identifiers.join(', ') || 'None detected'}
                        </div>
                      </div>

                      {/* Named Parties */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 space-y-1">
                        <div className="text-[10px] uppercase font-mono font-bold text-emerald-500">
                          Named Entities
                        </div>
                        <div className="text-zinc-900 dark:text-white truncate">
                          {selectedEvidence.ocrExtracted.parties.join(', ') || 'None detected'}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* =========================================================
                  TAB B: STRUCTURED METADATA & TIMELINE CORRELATION
                 ========================================================= */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Original Document Attributes vs AI Extraction */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Preserved Source File Attributes */}
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Preserved Source File</span>
                      </div>
                      <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                        <div>Format: <span className="font-mono text-zinc-900 dark:text-white">{selectedEvidence.fileType}</span></div>
                        <div>Upload Date: <span className="font-mono text-zinc-900 dark:text-white">{selectedEvidence.uploadDate}</span></div>
                        <div>SHA-256 Digest:</div>
                        <div className="font-mono text-[10px] break-all p-1.5 rounded bg-zinc-200/50 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-300">
                          {selectedEvidence.sha256Hash || 'Metadata only (No physical upload)'}
                        </div>
                      </div>
                    </div>

                    {/* AI Extracted OCR Entities */}
                    <div className="p-4 rounded-xl bg-[#007FFF]/5 dark:bg-[#007FFF]/10 border border-[#007FFF]/20 space-y-2">
                      <div className="text-xs font-semibold text-[#007FFF] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI-Extracted Data (OCR)</span>
                      </div>
                      <div className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                        <div>Extracted Amounts: <span className="font-semibold text-zinc-900 dark:text-white">{selectedEvidence.ocrExtracted.amounts.join(', ') || 'None detected'}</span></div>
                        <div>Extracted Dates: <span className="font-mono text-zinc-900 dark:text-white">{selectedEvidence.ocrExtracted.dates.join(', ') || 'None detected'}</span></div>
                        <div>Reference IDs: <span className="font-mono text-zinc-900 dark:text-white">{selectedEvidence.ocrExtracted.identifiers.join(', ') || 'None detected'}</span></div>
                        <div>Identified Parties: <span className="text-zinc-900 dark:text-white">{selectedEvidence.ocrExtracted.parties.join(', ') || 'None detected'}</span></div>
                      </div>
                    </div>

                  </div>

                  {/* Document Evidentiary Purpose */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                      Document Evidentiary Purpose
                    </label>
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      {selectedEvidence.ocrExtracted.summary ||
                        (ocrData.status === 'no_text'
                          ? 'No text detected in this exhibit.'
                          : 'OCR scan pending — no summary extracted yet.')}
                    </div>
                  </div>

                  {/* Incident Timeline Correlation */}
                  <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-between">
                      <span>Incident Timeline Correlation</span>
                      <span className="text-[11px] text-zinc-400 font-mono">Chronological Sequence</span>
                    </div>

                    <div className="space-y-2">
                      {currentCase.timeline.map((event, idx) => (
                        <div
                          key={event.id}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                            event.evidenceId === selectedEvidence.id
                              ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10'
                              : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900 dark:text-white">{event.title}</span>
                              <span className="font-mono text-[10px] text-zinc-400">{event.date}</span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{event.description}</p>
                            {event.evidenceId === selectedEvidence.id && (
                              <span className="inline-block text-[10px] font-semibold text-[#007FFF] pt-1">
                                ✓ Backed by currently selected exhibit ({selectedEvidence.fileName})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="p-12 text-center text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#18181B]">
              Select an evidence item from the left to view OCR extraction details.
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
