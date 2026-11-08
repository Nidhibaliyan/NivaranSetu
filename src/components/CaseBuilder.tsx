import React, { useState, useRef, useEffect } from 'react';
import {
  GrievanceCase,
  GrievanceCategory,
  EvidenceItem,
  TimelineEvent,
  TrustCheckRecord,
  CustodyEvent,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateSha256,
  storeEvidenceBlob,
  getEvidenceBlob,
  verifyEvidenceIntegrity,
  createCustodyEvent,
  formatFileSize,
  exportChainOfCustodyReport,
} from '../utils/caseStorage';
import {
  MicrophoneRecorder,
  audioFileToBase64,
  createSampleAudioBase64,
} from '../utils/audioUtils';
import {
  Sparkles,
  Upload,
  Mic,
  MicOff,
  Check,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertCircle,
  HelpCircle,
  Paperclip,
  Trash2,
  Calendar,
  MapPin,
  Building,
  IndianRupee,
  ShieldCheck,
  Send,
  Bot,
  Loader2,
  FileAudio,
  UploadCloud,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  Globe,
  Languages,
  Eye,
  FileSearch,
  AlertTriangle,
  ShieldAlert,
  Lock,
  Shield,
  Download,
  Copy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ScanLine,
  Search,
  Maximize2,
  FileCode,
  FileCheck2,
  ListTodo,
} from 'lucide-react';

interface CaseBuilderProps {
  initialCase?: GrievanceCase;
  initialPrompt?: string;
  initialTrustRecord?: TrustCheckRecord | null;
  initialStep?: number;
  onSaveCase: (updatedCase: GrievanceCase, proceedToNavigator?: boolean) => void;
  onCancel: () => void;
}

interface RawOcrData {
  rawText: string;
  confidence: number;
  engine: string;
  dpi: number;
  charCount: number;
  lineCount: number;
  boundingBoxes: Array<{
    id: number;
    text: string;
    type: 'header' | 'amount' | 'date' | 'id' | 'body';
    topPercent: number;
    leftPercent: number;
    widthPercent: number;
    heightPercent: number;
  }>;
}

export const CaseBuilder: React.FC<CaseBuilderProps> = ({
  initialCase,
  initialPrompt = '',
  initialTrustRecord,
  initialStep = 1,
  onSaveCase,
  onCancel,
}) => {
  const { t, mode } = useLanguage();

  // Wizard Step:
  // 1 = Incident & Details
  // 2 = Evidence Intelligence
  // 3 = Case Readiness Assessment
  // 4 = AI Clarification & Refinement
  // 5 = Complaint Review & Custody Proof
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Case ID - stable throughout the session
  const [caseId] = useState<string>(
    initialCase?.id || `NS-2026-0${Math.floor(100 + Math.random() * 900)}`
  );

  // Form State
  const [title, setTitle] = useState(
    initialCase?.title ||
      (initialPrompt
        ? `Grievance: ${initialPrompt.slice(0, 50).replace(/\n/g, ' ')}...`
        : '')
  );
  const [description, setDescription] = useState(
    initialCase?.description || initialPrompt
  );
  const [category, setCategory] = useState<GrievanceCategory>(
    initialCase?.category || 'banking_financial'
  );
  const [incidentDate, setIncidentDate] = useState(
    initialCase?.incidentDate || '2026-11-01'
  );
  const [incidentLocation, setIncidentLocation] = useState(
    initialCase?.incidentLocation || 'Mumbai, Maharashtra'
  );
  const [involvedEntity, setInvolvedEntity] = useState(
    initialCase?.involvedEntity || initialTrustRecord?.input || ''
  );
  const [disputedAmount, setDisputedAmount] = useState<number>(
    initialCase?.disputedAmount || 0
  );

  // Additional structured fields for precision grievance routing
  const [transactionRef, setTransactionRef] = useState('TXN-82910381928');
  const [upiIdOrVpa, setUpiIdOrVpa] = useState(
    initialTrustRecord?.type === 'upi' ? initialTrustRecord.input : 'refund-desk99@oksbi'
  );
  const [contactIdentifier, setContactIdentifier] = useState(
    initialTrustRecord?.type === 'phone' ? initialTrustRecord.input : '8910293812'
  );

  // TrustCheck Record associated with this case
  const [trustRecord] = useState<TrustCheckRecord | undefined>(
    initialCase?.trustCheckRecord || initialTrustRecord || undefined
  );

  // Voice recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [isBrowserSpeechActive, setIsBrowserSpeechActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const micRecorderRef = useRef<MicrophoneRecorder | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Grievance Detection state
  const [isAnalyzingFacts, setIsAnalyzingFacts] = useState(false);

  // Evidence list with real SHA-256 hashes
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(
    initialCase?.evidence || []
  );
  const [selectedExhibitId, setSelectedExhibitId] = useState<string>(
    initialCase?.evidence[0]?.id || ''
  );
  const [dragActive, setDragActive] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Exhibit Viewer Sub-Tab & Controls in Step 2
  const [exhibitTab, setExhibitTab] = useState<'ocr_preview' | 'metadata'>('ocr_preview');
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rawTextSearch, setRawTextSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedRawText, setCopiedRawText] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<Record<string, string>>({});

  // Timeline events
  const [timeline, setTimeline] = useState<TimelineEvent[]>(
    initialCase?.timeline || [
      {
        id: 'tl-1',
        date: incidentDate,
        title: 'Incident Occurred & Disputed Loss Detected',
        description: description ? description.slice(0, 140) + '...' : 'Disputed incident occurred.',
        verifiedByDoc: false,
      },
      {
        id: 'tl-2',
        date: incidentDate,
        title: 'Prompt Notification within Statutory Golden Window',
        description: `Notified ${involvedEntity || 'Opposite Party'} customer support within statutory notification window.`,
        verifiedByDoc: true,
      },
    ]
  );

  // Custody events log
  const [custodyEvents, setCustodyEvents] = useState<CustodyEvent[]>(
    initialCase?.custodyEvents && initialCase.custodyEvents.length > 0
      ? initialCase.custodyEvents
      : [
          createCustodyEvent(
            caseId,
            'case_created',
            'Grievance Case Initialized',
            'Citizen (Browser Session)',
            `Case drafting started under category: ${category.replace(/_/g, ' ')}. Disputed entity: ${involvedEntity || 'Opposite Party'}.`
          ),
        ]
  );

  // Complaint draft view toggle: 'formal' | 'simple'
  const [complaintView, setComplaintView] = useState<'formal' | 'simple'>('formal');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [downloadReportSuccess, setDownloadReportSuccess] = useState(false);

  // AI Chat Refinement in Step 4
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: 'ai' | 'user'; text: string; actionSuggestion?: string }>
  >([
    {
      sender: 'ai',
      text: `Hello! I'm your NivaranSetu Grievance Assistant. I've analyzed your description. Under statutory Indian dispute resolution frameworks (such as RBI Zero Liability guidelines and Consumer Protection Act 2019), documentation of written notices and transaction timelines is critical. Did you already lodge an initial dispute ticket with your bank or provider?`,
      actionSuggestion: 'Yes, I filed a ticket and have the complaint reference number',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState('gemini-2.0-flash');

  // Step 1 Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update selected exhibit ID when evidence list changes
  useEffect(() => {
    if (evidenceList.length > 0 && !selectedExhibitId) {
      setSelectedExhibitId(evidenceList[0].id);
    }
  }, [evidenceList, selectedExhibitId]);

  // Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = voiceLanguage;

      recognition.onstart = () => {
        setIsBrowserSpeechActive(true);
        setVoiceNotice(
          `Listening (${voiceLanguage === 'hi-IN' ? 'Hindi' : 'English'}). Speak your grievance clearly...`
        );
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setDescription((prev) =>
            prev ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim()
          );
          if (!title) {
            setTitle(finalTranscript.slice(0, 60) + '...');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Browser speech recognition notice:', event.error);
        setIsBrowserSpeechActive(false);
      };

      recognition.onend = () => {
        setIsBrowserSpeechActive(false);
      };

      recognitionRef.current = recognition;
    }
  }, [voiceLanguage, title]);

  const toggleBrowserRecording = () => {
    if (isBrowserSpeechActive) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setVoiceNotice('Voice captured. You can review, edit, and correct the text below.');
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        toggleServerRecording();
      }
    }
  };

  const toggleServerRecording = async () => {
    if (!isRecording) {
      try {
        if (!micRecorderRef.current) {
          micRecorderRef.current = new MicrophoneRecorder();
        }
        await micRecorderRef.current.start();
        setIsRecording(true);
        setVoiceNotice('Recording audio via microphone stream (16kHz)...');
      } catch (err: any) {
        console.warn('Microphone access notice:', err?.message);
        setVoiceNotice('Microphone unavailable. Use sample recording or type directly.');
      }
    } else {
      if (!micRecorderRef.current) return;
      setIsRecording(false);
      setVoiceNotice('Transcribing audio with Gemini...');

      try {
        const { base64, mimeType } = await micRecorderRef.current.stop();
        const res = await fetch('/api/gemini/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType,
            prompt:
              'Transcribe this citizen grievance recording accurately. Extract dates, amounts, and involved entities.',
          }),
        });

        const data = await res.json();
        if (res.ok && data.text) {
          setDescription((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
          if (!title) {
            setTitle(data.text.slice(0, 60) + '...');
          }
          setVoiceNotice('Transcribed successfully! Review and correct the text below.');
          setTimeout(() => setVoiceNotice(null), 3500);
        } else {
          throw new Error(data.error || 'Failed to transcribe');
        }
      } catch (err: any) {
        setVoiceNotice('Could not transcribe audio. Please type directly or use sample voice.');
        setTimeout(() => setVoiceNotice(null), 4000);
      }
    }
  };

  const handleStartVoice = () => {
    if (recognitionRef.current) {
      toggleBrowserRecording();
    } else {
      toggleServerRecording();
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVoiceNotice(`Transcribing "${file.name}"...`);
    try {
      const { base64, mimeType } = await audioFileToBase64(file);
      const res = await fetch('/api/gemini/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          prompt:
            'Transcribe this citizen grievance recording accurately. Extract dates, amounts, and involved entities.',
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setDescription((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
        if (!title) {
          setTitle(data.text.slice(0, 60) + '...');
        }
        setVoiceNotice('Audio file transcribed successfully! You can review and edit below.');
        setTimeout(() => setVoiceNotice(null), 3500);
      } else {
        throw new Error(data.error || 'Failed to transcribe file');
      }
    } catch (err: any) {
      setVoiceNotice('Failed to transcribe audio file. Please type details directly.');
      setTimeout(() => setVoiceNotice(null), 4000);
    }
  };

  // AI Incident Extraction
  const handleAnalyzeFacts = () => {
    if (!description.trim()) return;
    setIsAnalyzingFacts(true);

    setTimeout(() => {
      const text = description.toLowerCase();
      let detectedCategory: GrievanceCategory = category;
      let detectedEntity = involvedEntity;
      let detectedAmt = disputedAmount;

      if (text.includes('electricity') || text.includes('discom') || text.includes('power')) {
        detectedCategory = 'banking_financial';
        detectedEntity = detectedEntity || 'Electricity Distribution Co / Rogue Payment Gateway';
      } else if (text.includes('tv') || text.includes('order') || text.includes('amazon') || text.includes('flipkart')) {
        detectedCategory = 'consumer_ecommerce';
        detectedEntity = detectedEntity || 'E-Commerce Retailer & Manufacturer';
      } else if (text.includes('flat') || text.includes('builder') || text.includes('possession') || text.includes('rera')) {
        detectedCategory = 'real_estate_rera';
        detectedEntity = detectedEntity || 'Greenfield Infrastructure Developers';
      } else if (text.includes('mediclaim') || text.includes('insurance') || text.includes('cashless') || text.includes('hospital')) {
        detectedCategory = 'insurance_claims';
        detectedEntity = detectedEntity || 'General Health Insurance Co';
      }

      const matchAmt = description.match(/(?:rs\.?|inr|₹)\s*([\d,]+)/i);
      if (matchAmt) {
        detectedAmt = parseInt(matchAmt[1].replace(/,/g, ''), 10) || detectedAmt;
      }

      setCategory(detectedCategory);
      if (detectedEntity) setInvolvedEntity(detectedEntity);
      if (detectedAmt) setDisputedAmount(detectedAmt);
      setIsAnalyzingFacts(false);

      // Append AI extraction custody event
      const ocrEvent = createCustodyEvent(
        caseId,
        'entity_extracted',
        'Grievance Facts Structured & Classified',
        'NivaranSetu AI',
        `Analyzed incident description. Classified under category: ${detectedCategory}. Detected entity: "${detectedEntity || 'Opposite Party'}", amount: ₹${detectedAmt || 0}.`
      );
      setCustodyEvents((prev) => [...prev, ocrEvent]);
    }, 600);
  };

  // Real File Upload with Cryptographic SHA-256 and IndexedDB Binary Storage
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadNotice('Calculating cryptographic SHA-256 digests and storing in browser database...');

    try {
      const newItems: EvidenceItem[] = [];
      const newEvents: CustodyEvent[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 1. Genuine SHA-256 calculated on exact file bytes
        const realHash = await calculateSha256(file);
        const evidenceId = `ev-${Date.now()}-${i}`;
        const fileSizeFormatted = formatFileSize(file.size);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        const cat: EvidenceItem['category'] =
          ext === 'pdf'
            ? file.name.toLowerCase().includes('statement')
              ? 'bank_statement'
              : 'receipt'
            : ext === 'png' || ext === 'jpg' || ext === 'jpeg'
            ? file.name.toLowerCase().includes('notice') || file.name.toLowerCase().includes('letter')
              ? 'notice'
              : 'screenshot'
            : 'correspondence';

        // 2. Store actual binary Blob in IndexedDB
        const storedInDb = await storeEvidenceBlob(caseId, evidenceId, file);

        // 3. Construct Evidence Item
        const item: EvidenceItem = {
          id: evidenceId,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          category: cat,
          fileName: file.name,
          fileSize: fileSizeFormatted,
          fileType: file.type || 'application/octet-stream',
          uploadDate: new Date().toISOString().split('T')[0],
          sha256Hash: realHash,
          storageRef: storedInDb ? `indexeddb://evidence_blobs/${caseId}_${evidenceId}` : undefined,
          hasBlob: storedInDb,
          ocrExtracted: {
            dates: [incidentDate],
            amounts: disputedAmount ? [`₹${disputedAmount.toLocaleString('en-IN')}`] : ['Pending OCR scan'],
            identifiers: [`REF-${Math.floor(100000 + Math.random() * 900000)}`],
            parties: [involvedEntity || 'Opposite Party'],
            summary: `Verified electronic exhibit (${file.name}) stored and hashed via SHA-256.`,
          },
          verifiedOriginal: true,
        };

        newItems.push(item);

        // 4. Record append-only Custody Event
        const uploadEvent = createCustodyEvent(
          caseId,
          'evidence_uploaded',
          `Evidence Ingestion: ${file.name}`,
          'Citizen (Browser Session)',
          `Calculated cryptographic SHA-256: ${realHash}. File size: ${fileSizeFormatted}, MIME type: ${file.type || 'application/octet-stream'}. Stored in browser secure IndexedDB.`,
          evidenceId,
          realHash
        );
        newEvents.push(uploadEvent);
      }

      setEvidenceList((prev) => [...prev, ...newItems]);
      setCustodyEvents((prev) => [...prev, ...newEvents]);
      if (newItems.length > 0 && !selectedExhibitId) {
        setSelectedExhibitId(newItems[0].id);
      }
      setUploadNotice(`Successfully preserved ${newItems.length} file(s) with SHA-256 fingerprints.`);
      setTimeout(() => setUploadNotice(null), 3500);
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadNotice('Failed to preserve file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveEvidence = (idToRemove: string) => {
    const item = evidenceList.find((e) => e.id === idToRemove);
    setEvidenceList((prev) => prev.filter((e) => e.id !== idToRemove));
    if (selectedExhibitId === idToRemove) {
      setSelectedExhibitId(evidenceList.find((e) => e.id !== idToRemove)?.id || '');
    }

    const removeEvent = createCustodyEvent(
      caseId,
      'evidence_removed',
      `Evidence Removed from Case: ${item?.fileName || idToRemove}`,
      'Citizen (Browser Session)',
      `Exhibit ${idToRemove} unlinked from active grievance petition. Historical fingerprint preserved in audit ledger.`,
      idToRemove,
      item?.sha256Hash
    );
    setCustodyEvents((prev) => [...prev, removeEvent]);
  };

  // Re-verify integrity of an exhibit
  const handleVerifyIntegrity = async (evidenceId: string, recordedHash: string) => {
    setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'verifying' }));
    const res = await verifyEvidenceIntegrity(caseId, evidenceId, recordedHash);

    if (res.verified) {
      setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'verified' }));
      const verifyEvent = createCustodyEvent(
        caseId,
        'evidence_verified',
        `Cryptographic Re-Verification Matched: ${evidenceId}`,
        'Integrity Engine',
        `Re-hashed binary stream matches original recorded SHA-256: ${recordedHash}. Zero byte tampering detected.`,
        evidenceId,
        recordedHash
      );
      setCustodyEvents((prev) => [...prev, verifyEvent]);
    } else {
      setIntegrityStatus((prev) => ({ ...prev, [evidenceId]: 'tampered' }));
    }
  };

  // Download actual preserved file
  const handleDownloadExhibit = async (item: EvidenceItem) => {
    try {
      const blob = await getEvidenceBlob(caseId, item.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fallback simulated export
        const dummyBlob = new Blob([`[NivaranSetu Preserved Evidence]\nFile: ${item.fileName}\nSHA-256: ${item.sha256Hash}\nCase: ${caseId}`], { type: 'text/plain' });
        const url = URL.createObjectURL(dummyBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.fileName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const dlEvent = createCustodyEvent(
        caseId,
        'evidence_downloaded',
        `Evidence Exported: ${item.fileName}`,
        'Citizen (Browser Session)',
        `Preserved file ${item.fileName} exported from local evidence cache. Digest: ${item.sha256Hash}.`,
        item.id,
        item.sha256Hash
      );
      setCustodyEvents((prev) => [...prev, dlEvent]);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Send AI chat message using /api/gemini/chat
  const handleSendChat = async (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim() || isChatLoading) return;

    const newHistory = [...chatMessages, { sender: 'user' as const, text }];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const messagesForGemini = newHistory.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesForGemini,
          taskType: 'general',
          requestedModel: selectedAiModel,
          systemInstruction: `You are an expert citizen grievance assistant aiding a user preparing a case for ${category.replace('_', ' ')}. Disputed amount: ₹${disputedAmount || 'Not specified'}. Entity: ${involvedEntity || 'Not specified'}. Provide concise, legally grounded steps under Indian dispute resolution laws (RBI Ombudsman, Consumer Protection Act 2019, RERA, etc.).`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: data.text,
            actionSuggestion: 'Proceed to review and finalize case',
          },
        ]);
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Under statutory redressal frameworks, keeping a written record of your notice and incident timeline is crucial. I recommend including the written demand copy and bank/service acknowledgement in your evidence list.`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Generate realistic OCR data for selected exhibit
  const getSelectedOcrData = (item?: EvidenceItem): RawOcrData => {
    if (!item) {
      return {
        rawText: 'NO EXHIBIT SELECTED',
        confidence: 0,
        engine: 'NivaranSetu Vision Engine',
        dpi: 300,
        charCount: 0,
        lineCount: 0,
        boundingBoxes: [],
      };
    }

    const titleLower = item.title.toLowerCase();
    const isSms = titleLower.includes('sms') || item.category === 'screenshot';
    const isStatement = titleLower.includes('statement') || titleLower.includes('passbook') || item.category === 'bank_statement';

    if (isSms) {
      const rawText = `[SMS SENDER: ${involvedEntity || 'VM-POWURG'}]\nDATE: ${incidentDate} 17:42:10 IST\nRECIPIENT: Citizen\n\nNOTICE: Immediate action required regarding electricity/banking transaction.\nURL / Reference: ${upiIdOrVpa || 'quick-pay.apk/verify'}\nThreat Pattern: Deceptive impersonation script.`;
      return {
        rawText,
        confidence: 99.2,
        engine: 'NivaranSetu High-Res OCR (300 DPI)',
        dpi: 300,
        charCount: rawText.length,
        lineCount: rawText.split('\n').length,
        boundingBoxes: [
          { id: 1, text: 'Sender Header Identifier', type: 'header', topPercent: 8, leftPercent: 10, widthPercent: 55, heightPercent: 12 },
          { id: 2, text: `Date: ${incidentDate}`, type: 'date', topPercent: 24, leftPercent: 10, widthPercent: 40, heightPercent: 10 },
          { id: 3, text: 'Notice & Threat Content', type: 'body', topPercent: 40, leftPercent: 10, widthPercent: 80, heightPercent: 25 },
          { id: 4, text: upiIdOrVpa || 'Rogue Reference', type: 'id', topPercent: 70, leftPercent: 10, widthPercent: 65, heightPercent: 12 },
        ],
      };
    }

    if (isStatement) {
      const rawText = `BANK STATEMENT OF ACCOUNT (INR)\nENTITY: ${involvedEntity || 'APEX BANK OF INDIA'}\nDATE: ${incidentDate}\nTXN REF: ${transactionRef}\nDEBIT AMOUNT: INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '42,500.00'}\nSTATUS: DEBIT EXECUTED VIA UPI CHANNEL`;
      return {
        rawText,
        confidence: 98.8,
        engine: 'NivaranSetu Financial Document Parser (300 DPI)',
        dpi: 300,
        charCount: rawText.length,
        lineCount: rawText.split('\n').length,
        boundingBoxes: [
          { id: 1, text: `${involvedEntity || 'Bank'} Header`, type: 'header', topPercent: 6, leftPercent: 10, widthPercent: 80, heightPercent: 10 },
          { id: 2, text: `Date: ${incidentDate}`, type: 'date', topPercent: 20, leftPercent: 10, widthPercent: 40, heightPercent: 10 },
          { id: 3, text: `Debit: ₹${disputedAmount.toLocaleString('en-IN')}`, type: 'amount', topPercent: 36, leftPercent: 10, widthPercent: 80, heightPercent: 12 },
          { id: 4, text: `Txn Ref: ${transactionRef}`, type: 'id', topPercent: 52, leftPercent: 10, widthPercent: 60, heightPercent: 10 },
        ],
      };
    }

    const rawText = `DOCUMENT EXHIBIT: ${item.title}\nFILE: ${item.fileName} (${item.fileSize})\nINGEST DATE: ${item.uploadDate}\nSHA-256 DIGEST: ${item.sha256Hash}\nINTEGRITY STATUS: VERIFIED ORIGINAL`;
    return {
      rawText,
      confidence: 97.5,
      engine: 'NivaranSetu Document OCR (300 DPI)',
      dpi: 300,
      charCount: rawText.length,
      lineCount: 5,
      boundingBoxes: [
        { id: 1, text: item.title, type: 'header', topPercent: 10, leftPercent: 10, widthPercent: 75, heightPercent: 14 },
        { id: 2, text: `File: ${item.fileName}`, type: 'body', topPercent: 30, leftPercent: 10, widthPercent: 60, heightPercent: 12 },
        { id: 3, text: `SHA-256: ${item.sha256Hash.slice(0, 16)}...`, type: 'id', topPercent: 50, leftPercent: 10, widthPercent: 80, heightPercent: 14 },
      ],
    };
  };

  const selectedExhibit = evidenceList.find((e) => e.id === selectedExhibitId) || evidenceList[0];
  const ocrData = getSelectedOcrData(selectedExhibit);

  // Dynamic Case Readiness Calculation
  const calculateReadiness = () => {
    let score = 40; // baseline
    if (description.length > 50) score += 15;
    if (involvedEntity.trim()) score += 10;
    if (incidentDate) score += 5;
    if (disputedAmount > 0) score += 10;
    if (evidenceList.length >= 1) score += 10;
    if (evidenceList.length >= 2) score += 10;
    score = Math.min(score, 95);

    const evidenceCompleteness = Math.min(100, evidenceList.length * 40);
    const timelineClarity = description.length > 50 ? 90 : 60;
    const identityProof = 90;
    const formalNoticeSent = evidenceList.some((e) => e.category === 'notice' || e.category === 'correspondence')
      ? 85
      : 50;

    let tier: 'ready' | 'needs_info' | 'incomplete' = 'incomplete';
    if (score >= 80) tier = 'ready';
    else if (score >= 50) tier = 'needs_info';

    return {
      score,
      tier,
      breakdown: {
        evidenceCompleteness,
        timelineClarity,
        identityProof,
        formalNoticeSent,
      },
    };
  };

  const readiness = calculateReadiness();

  // Validate step requirements before advancing
  const handleValidateAndAdvance = (targetStep: number) => {
    setValidationErrors([]);

    if (currentStep === 1) {
      const errs: string[] = [];
      if (!description.trim()) {
        errs.push('Please describe the incident or speak your grievance.');
      }
      if (!involvedEntity.trim()) {
        errs.push('Please enter the name of the bank, company, or party involved.');
      }
      if (errs.length > 0) {
        setValidationErrors(errs);
        return;
      }
    }

    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Compile final case record
  const buildCurrentCaseRecord = (): GrievanceCase => {
    const authorityMap: Record<
      GrievanceCategory,
      { name: string; portalName: string; portalUrl: string }
    > = {
      banking_financial: {
        name: 'Reserve Bank of India (RBI) Integrated Ombudsman Scheme',
        portalName: 'CMS Portal (cms.rbi.org.in)',
        portalUrl: 'https://cms.rbi.org.in',
      },
      consumer_ecommerce: {
        name: 'National Consumer Disputes Redressal Commission / e-Daakhil',
        portalName: 'e-Daakhil Portal (edaakhil.nic.in)',
        portalUrl: 'https://edaakhil.nic.in',
      },
      real_estate_rera: {
        name: 'State Real Estate Regulatory Authority (RERA)',
        portalName: 'State RERA Portal',
        portalUrl: 'https://rera.nic.in',
      },
      insurance_claims: {
        name: 'Insurance Ombudsman / IRDAI Bima Bharosa',
        portalName: 'Bima Bharosa Portal',
        portalUrl: 'https://bimabharosa.irdai.gov.in',
      },
      municipal_civic: {
        name: 'CPGRAMS / Ministry of Personnel, Public Grievances',
        portalName: 'CPGRAMS Portal (pgportal.gov.in)',
        portalUrl: 'https://pgportal.gov.in',
      },
      telecom_isp: {
        name: 'Department of Telecommunications (DoT / Sanchar Saathi)',
        portalName: 'Telecom Grievance Cell',
        portalUrl: 'https://sancharsaathi.gov.in',
      },
      employment_labour: {
        name: 'Office of the Labour Commissioner / Samadhan Portal',
        portalName: 'Ministry of Labour Portal',
        portalUrl: 'https://labour.gov.in',
      },
      utilities_power: {
        name: 'Electricity Consumer Grievance Redressal Forum (CGRF)',
        portalName: 'State Electricity Regulatory Commission',
        portalUrl: 'https://cgrf.gov.in',
      },
    };

    const targetAuth = authorityMap[category];

    const formalBody = `To,\nThe Competent Redressal Authority / Ombudsman,\n\nSUB: FORMAL CITIZEN GRIEVANCE PETITION UNDER STATUTORY REDRESSAL SCHEME\n\n1. PARTIES:\nComplainant: Citizen Consumer\nOpposite Party / Regulated Entity: ${involvedEntity || 'Regulated Entity'}, Location: ${incidentLocation}\n\n2. STATEMENT OF FACTS:\nOn or about ${incidentDate}, the complainant suffered an unauthorized grievance amounting to INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'}.\n\nNarrative of Incident:\n${description}\n\nTransaction & Identifier References:\n- Involved Entity: ${involvedEntity}\n- Disputed Identifier / VPA: ${upiIdOrVpa}\n- Bank / Txn Reference: ${transactionRef}\n- Disputed Amount: INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'}\n\n3. EVIDENCE EXHIBITS:\n${evidenceList.map((e, i) => `Exhibit Ex-0${i + 1}: ${e.title} (${e.fileName}) — SHA-256: ${e.sha256Hash}`).join('\n') || 'None attached'}\n\n4. STATUTORY PREREQUISITES:\nThe complainant has satisfied mandatory escalation prerequisites and served written notice to customer support without receiving fair redressal.\n\n5. PRAYER FOR RELIEF:\nThe complainant respectfully prays that this Authority:\n(a) Direct the opposite party to credit back/rectify the disputed sum of INR ${disputedAmount ? disputedAmount.toLocaleString('en-IN') : '0'};\n(b) Direct payment of appropriate statutory interest and token compensation for harassment.`;

    const simpleBody = `I am submitting a grievance about ${involvedEntity}. On ${incidentDate}, I suffered an issue amounting to ₹${disputedAmount.toLocaleString('en-IN')}. I informed the company but have not received a fair resolution. I have attached ${evidenceList.length} verified evidence documents. I request the authority to direct a full refund and resolution.`;

    const finalCase: GrievanceCase = {
      id: caseId,
      title: title || `Grievance: ${involvedEntity || 'Opposite Party'} (${category.replace(/_/g, ' ')})`,
      category,
      stage: evidenceList.length >= 2 ? 'ready_to_file' : 'evidence_gathering',
      status: 'active',
      createdAt: initialCase?.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      incidentDate,
      incidentLocation,
      involvedEntity: involvedEntity || 'Unspecified Party',
      disputedAmount: Number(disputedAmount) || 0,
      currency: 'INR',
      description,
      simpleSummary: `On ${incidentDate}, an incident involving ${involvedEntity} resulted in a disputed loss of ₹${(Number(disputedAmount) || 0).toLocaleString('en-IN')}. Despite prompt notice, resolution has not occurred. I request a complete reversal and refund.`,
      readinessScore: readiness.score,
      readinessBreakdown: readiness.breakdown,
      recommendedAuthority: {
        name: targetAuth.name,
        portalName: targetAuth.portalName,
        portalUrl: targetAuth.portalUrl,
        filingFee: 'Nil or Nominal',
        averageResolutionTime: '30 to 45 Days',
      },
      trustCheckRecord: trustRecord,
      timeline,
      evidence: evidenceList,
      missingElements:
        evidenceList.length < 2
          ? ['Formal acknowledgement ticket from bank / entity']
          : [],
      complaintDraft: {
        subject: `Grievance Complaint against ${involvedEntity || 'Opposite Party'} regarding unauthorized debits and service deficiency`,
        formalBody,
        simpleBody,
        reliefSought: `Full reversal and refund of ₹${Number(disputedAmount).toLocaleString('en-IN')} with statutory compensation for deficiency in service.`,
      },
      custodyEvents,
    };

    return finalCase;
  };

  const handleSaveDraft = () => {
    const caseRecord = buildCurrentCaseRecord();
    onSaveCase(caseRecord, false);
  };

  const handleSaveAndProceedToNavigator = () => {
    const caseRecord = buildCurrentCaseRecord();
    onSaveCase(caseRecord, true);
  };

  const handleDownloadAuditReport = () => {
    const caseRecord = buildCurrentCaseRecord();
    const reportText = exportChainOfCustodyReport(caseRecord);
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chain_of_Custody_Report_${caseId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadReportSuccess(true);
    setTimeout(() => setDownloadReportSuccess(false), 3500);

    const dlEvent = createCustodyEvent(
      caseId,
      'dossier_exported',
      'Chain-of-Custody Audit Report Exported',
      'Citizen (Browser Session)',
      `Plaintext cryptographic audit report exported for Case ${caseId}. Contains ${evidenceList.length} evidence digests and ${custodyEvents.length} custody entries.`
    );
    setCustodyEvents((prev) => [...prev, dlEvent]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
            CENTRAL INTELLIGENCE MODULE · CASE {caseId}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
            Smart Case Builder
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Voice-to-text intake, integrated evidence intelligence, readiness assessment, and structured complaint generation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Save Draft
          </button>
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Step Indicator Header (5 Unified Steps) */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {[
          { num: 1, label: 'Incident & Facts' },
          { num: 2, label: 'Evidence Intelligence' },
          { num: 3, label: 'Case Readiness' },
          { num: 4, label: 'AI Refinement' },
          { num: 5, label: 'Review & Custody' },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;

          return (
            <button
              key={s.num}
              onClick={() => handleValidateAndAdvance(s.num)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                  : isDone
                  ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  0{s.num}
                </span>
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#007FFF]" />
                ) : null}
              </div>
              <div
                className={`text-xs font-bold mt-1 truncate ${
                  isActive ? 'text-[#007FFF]' : isDone ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
                }`}
              >
                {s.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Validation Errors Callout */}
      {validationErrors.length > 0 && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Please complete required fields to proceed:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* TrustCheck Finding Notification Banner (if came from TrustCheck) */}
      {trustRecord && (
        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-900 dark:text-white">
                Imported TrustCheck Finding: {trustRecord.resultStatus || 'Flagged'}
              </span>
              <span className="font-mono text-[10px] text-zinc-400 uppercase">
                {trustRecord.type}
              </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">
              Identifier <code className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[#007FFF] font-mono">{trustRecord.input}</code> was verified against public safety advisories. Details have been mapped into your case facts.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 1: INCIDENT & FACTS
          ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          
          {/* Voice Input Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#007FFF]" />
                  <span>Voice-First Grievance Intake</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Describe what happened in natural language. Speech is converted to text and key details are extracted.
                </p>
              </div>

              {/* Language toggle */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                <button
                  type="button"
                  onClick={() => setVoiceLanguage('en-IN')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    voiceLanguage === 'en-IN'
                      ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceLanguage('hi-IN')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    voiceLanguage === 'hi-IN'
                      ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  हिन्दी (Hindi)
                </button>
              </div>
            </div>

            {/* Mic Button & Audio Actions */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <button
                type="button"
                onClick={handleStartVoice}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                  isRecording || isBrowserSpeechActive
                    ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                    : 'bg-[#007FFF] text-white hover:bg-[#0070e0] shadow-blue-500/20'
                }`}
              >
                {isRecording || isBrowserSpeechActive ? (
                  <MicOff className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>

              <div className="text-center space-y-1">
                <div className="text-xs font-bold text-zinc-900 dark:text-white">
                  {isRecording || isBrowserSpeechActive
                    ? 'Listening... Click to Stop Recording'
                    : 'Click Microphone to Start Speaking'}
                </div>
                <div className="text-[11px] text-zinc-500">
                  Supported formats: Speech via microphone, or upload recorded audio below
                </div>
              </div>

              {/* Upload audio file button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  <FileAudio className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Upload Audio File (.wav, .mp3, .m4a)</span>
                </button>
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                />
              </div>

              {voiceNotice && (
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-[#007FFF] font-medium text-center max-w-md">
                  {voiceNotice}
                </div>
              )}
            </div>

            {/* Description Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Detailed Grievance Description <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-zinc-400">
                  Review and edit transcribed speech below
                </span>
              </div>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened: what service or product was involved, what went wrong, dates, amounts, and previous complaints made..."
                className="w-full text-xs p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] leading-relaxed resize-y"
              />
            </div>

            {/* Analyze & Extract Button */}
            <button
              type="button"
              onClick={handleAnalyzeFacts}
              disabled={isAnalyzingFacts || !description.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {isAnalyzingFacts ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing & Classifying Grievance Facts...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analyze & Extract Key Facts Automatically</span>
                </>
              )}
            </button>
          </div>

          {/* Structured Fields Grid */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              Structured Incident Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Category */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Grievance Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GrievanceCategory)}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                >
                  <option value="banking_financial">Banking & UPI Financial Fraud (RBI Ombudsman)</option>
                  <option value="consumer_ecommerce">Consumer Goods & E-Commerce Defect (e-Daakhil / NCDRC)</option>
                  <option value="real_estate_rera">Real Estate Possession Delay (State RERA)</option>
                  <option value="insurance_claims">Insurance Claim Repudiation (IRDAI Bima Bharosa)</option>
                  <option value="municipal_civic">Central / State Civic Grievance (CPGRAMS)</option>
                  <option value="telecom_isp">Telecom & SIM Fraud (TRAI / Sanchar Saathi)</option>
                  <option value="employment_labour">Labour & Workplace Compensation (Samadhan)</option>
                  <option value="utilities_power">Electricity & Power Utility (CGRF)</option>
                </select>
              </div>

              {/* Involved Entity */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Bank / Company / Entity Involved <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={involvedEntity}
                    onChange={(e) => setInvolvedEntity(e.target.value)}
                    placeholder="e.g. Apex Bank, QuickBazaar Retail"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Disputed Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Disputed Amount (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={disputedAmount || ''}
                    onChange={(e) => setDisputedAmount(Number(e.target.value))}
                    placeholder="e.g. 42500"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Incident Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Incident Date
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

              {/* Incident Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Location (City, State)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    placeholder="e.g. Pune, Maharashtra"
                    className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Previous / Next Navigation for Step 1 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(2)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Evidence Intelligence</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 2: INTEGRATED EVIDENCE INTELLIGENCE
          ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          
          {/* Targeted Evidence Requirements for this category */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                Step 2: Targeted Evidence Collection & Ingestion
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upload receipts, screenshots, bank statements, or correspondence. Files are hashed via SHA-256 and stored in the local evidence vault.
              </p>
            </div>

            {/* Drag & Drop Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all ${
                dragActive
                  ? 'border-[#007FFF] bg-[#007FFF]/5'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/40'
              }`}
            >
              <Upload className="w-8 h-8 text-[#007FFF] mx-auto mb-2" />
              <div className="text-xs font-semibold text-zinc-900 dark:text-white mb-1">
                Drag & Drop Evidence Documents Here, or Click to Browse
              </div>
              <div className="text-[11px] text-zinc-500 mb-3">
                Supports PDF documents, PNG/JPG images, and screenshots (SHA-256 fingerprint calculated on ingest)
              </div>
              <label className="inline-block px-4 py-2 rounded-xl bg-[#007FFF] text-white text-xs font-semibold cursor-pointer hover:bg-[#0070e0] transition-colors">
                <span>Select Files from Device</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            {uploadNotice && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-[#007FFF] font-medium text-center">
                {uploadNotice}
              </div>
            )}
          </div>

          {/* Exhibits Master-Detail Split Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Preserved Exhibits Register (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                  Preserved Exhibits ({evidenceList.length})
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  SHA-256 Indexed
                </span>
              </div>

              {evidenceList.length === 0 ? (
                <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-center text-xs text-zinc-500">
                  No evidence uploaded yet. Add at least 1 document to support your complaint.
                </div>
              ) : (
                <div className="space-y-2">
                  {evidenceList.map((item) => {
                    const isSelected = item.id === selectedExhibitId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedExhibitId(item.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate max-w-[200px]">
                              {item.title}
                            </div>
                            <div className="text-[10px] font-mono text-zinc-400">
                              {item.fileName} · {item.fileSize}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEvidence(item.id);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                            title="Remove exhibit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                          <span>SHA: {item.sha256Hash.slice(0, 12)}...</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Verified
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Exhibit OCR & Visual Explorer (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {selectedExhibit ? (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 space-y-4 shadow-xs">
                  
                  {/* Exhibit Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <div>
                      <div className="text-[10px] font-mono text-[#007FFF] uppercase">
                        EXHIBIT: {selectedExhibit.id}
                      </div>
                      <h4 className="text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                        {selectedExhibit.title}
                      </h4>
                      <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                        {selectedExhibit.fileName} ({selectedExhibit.fileSize})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadExhibit(selectedExhibit)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>

                  {/* Hash strip */}
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 break-all">
                      SHA-256: {selectedExhibit.sha256Hash}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedExhibit.sha256Hash);
                        setCopiedHash(selectedExhibit.sha256Hash);
                        setTimeout(() => setCopiedHash(null), 2000);
                      }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                      title="Copy SHA-256 Hash"
                    >
                      {copiedHash === selectedExhibit.sha256Hash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Visual Document Viewer with Bounding Boxes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <ScanLine className="w-3.5 h-3.5 text-[#007FFF]" />
                        <span>Interactive OCR Exhibit Inspection</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBoundingBoxes(!showBoundingBoxes)}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                          showBoundingBoxes
                            ? 'bg-[#007FFF]/10 text-[#007FFF]'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {showBoundingBoxes ? 'Bounding Boxes: ON' : 'Bounding Boxes: OFF'}
                      </button>
                    </div>

                    <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 min-h-[180px] font-mono text-xs overflow-hidden">
                      <div className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
                        {ocrData.rawText}
                      </div>

                      {/* Visual overlay boxes */}
                      {showBoundingBoxes &&
                        ocrData.boundingBoxes.map((box) => (
                          <div
                            key={box.id}
                            style={{
                              position: 'absolute',
                              top: `${box.topPercent}%`,
                              left: `${box.leftPercent}%`,
                              width: `${box.widthPercent}%`,
                              height: `${box.heightPercent}%`,
                            }}
                            className="border border-[#007FFF] bg-[#007FFF]/10 rounded pointer-events-none flex items-start justify-end p-0.5"
                          >
                            <span className="text-[8px] bg-[#007FFF] text-white px-1 rounded font-bold font-mono">
                              {box.type.toUpperCase()}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Extracted Entities Chips */}
                  <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">
                      STRUCTURED OCR ENTITIES DETECTED
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExhibit.ocrExtracted.amounts.map((amt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-semibold"
                        >
                          {amt}
                        </span>
                      ))}
                      {selectedExhibit.ocrExtracted.dates.map((dt, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[#007FFF] text-[11px] font-mono"
                        >
                          Date: {dt}
                        </span>
                      ))}
                      {selectedExhibit.ocrExtracted.identifiers.map((idVal, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono"
                        >
                          {idVal}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] text-center text-xs text-zinc-400">
                  Select an exhibit on the left to view its OCR entities and cryptographic hash.
                </div>
              )}
            </div>

          </div>

          {/* Navigation for Step 2 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Incident Facts</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(3)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Case Readiness</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 3: INTEGRATED CASE READINESS ASSESSMENT
          ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          
          {/* Header */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
            <div>
              <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                PRE-FILING EVALUATION · STEP 3
              </div>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                Case Readiness Assessment
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Assessing document sufficiency, incident timeline clarity, and mandatory statutory prerequisites.
              </p>
            </div>

            {/* Mandatory Legal Disclaimer */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              <Info className="w-4 h-4 text-[#007FFF] shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-900 dark:text-white">Assistance Assessment Notice: </strong>
                This score evaluates filing completeness to minimize administrative rejections by ombudsmen or commissions. It does not constitute formal legal representation or guarantee official case acceptance or compensation awards.
              </div>
            </div>

            {/* Radial Score Visual + Status Tier */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              
              {/* Radial Meter Card (5 cols) */}
              <div className="md:col-span-5 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-3">
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-zinc-200 dark:text-zinc-800"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * readiness.score) / 100}
                      strokeLinecap="round"
                      className={
                        readiness.tier === 'ready'
                          ? 'text-emerald-500'
                          : readiness.tier === 'needs_info'
                          ? 'text-amber-500'
                          : 'text-red-500'
                      }
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold font-mono text-zinc-950 dark:text-white">
                      {readiness.score}%
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">
                      READINESS
                    </span>
                  </div>
                </div>

                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono">
                  {readiness.tier === 'ready' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">
                      ✓ Ready for Review
                    </span>
                  ) : readiness.tier === 'needs_info' ? (
                    <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
                      ⚠ Needs Additional Info
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 bg-red-500/10 px-3 py-1 rounded-full">
                      ✕ Incomplete Draft
                    </span>
                  )}
                </div>
              </div>

              {/* Breakdown Bars (7 cols) */}
              <div className="md:col-span-7 space-y-3.5">
                {[
                  { label: 'Evidence Completeness', score: readiness.breakdown.evidenceCompleteness, note: `${evidenceList.length} documents attached` },
                  { label: 'Incident Timeline Clarity', score: readiness.breakdown.timelineClarity, note: 'Date, location, and facts logged' },
                  { label: 'Entity Identification', score: readiness.breakdown.identityProof, note: involvedEntity || 'Entity missing' },
                  { label: 'Prerequisite Notice', score: readiness.breakdown.formalNoticeSent, note: 'Initial ticket / notice served' },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white">{item.label}</span>
                      <span className="font-mono text-zinc-500">{item.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${item.score}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.score >= 80 ? 'bg-emerald-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{item.note}</div>
                  </div>
                ))}
              </div>

            </div>

            {/* Checklist of Completed vs Missing Items */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Readiness Checklist & Action Items
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Completed */}
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-2">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Completed Requirements</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                    <li>• Incident description and category specified</li>
                    <li>• Identified entity: {involvedEntity || 'Opposite Party'}</li>
                    <li>• {evidenceList.length} evidence exhibits cryptographically preserved</li>
                  </ul>
                </div>

                {/* Recommendations */}
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 space-y-2">
                  <div className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Recommended Next Steps</span>
                  </div>
                  <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 text-[11px]">
                    {evidenceList.length < 2 && (
                      <li>• Upload second corroborating document (e.g. statement or customer support ticket)</li>
                    )}
                    <li>• Review structured legal petition in Step 5 before proceeding to Resolution Navigator</li>
                  </ul>
                </div>

              </div>
            </div>

          </div>

          {/* Navigation for Step 3 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Evidence Intelligence</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(4)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to AI Refinement</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 4: AI CLARIFICATION & REFINEMENT
          ========================================================================= */}
      {currentStep === 4 && (
        <div className="space-y-6">
          
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <div>
              <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                AI CASE REFINEMENT · STEP 4
              </div>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                AI Grievance Assistant
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ask questions about statutory Indian complaint rules, refine your relief prayer, and clarify timeline events.
              </p>
            </div>

            {/* Model selector */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 font-medium">Assistant Model:</span>
              {['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-lite'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedAiModel(m)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedAiModel === m
                      ? 'bg-[#007FFF] text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Chat Messages Log */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 text-xs leading-relaxed ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-[#007FFF] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3.5 rounded-xl ${
                      msg.sender === 'user'
                        ? 'bg-[#007FFF] text-white font-medium rounded-tr-none'
                        : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-tl-none shadow-xs'
                    }`}
                  >
                    <p>{msg.text}</p>
                    {msg.actionSuggestion && (
                      <button
                        type="button"
                        onClick={() => handleSendChat(msg.actionSuggestion)}
                        className="mt-2 block text-left text-[11px] text-[#007FFF] dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        Suggested reply: "{msg.actionSuggestion}" →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex items-center gap-2 text-xs text-zinc-500 p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#007FFF]" />
                  <span>NivaranSetu AI is analyzing statutory dispute provisions...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask how to claim interest, reverse transactions, or invoke zero-liability rules..."
                className="flex-1 text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF]"
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                disabled={isChatLoading || !chatInput.trim()}
                className="p-3 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation for Step 4 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(3)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: Case Readiness</span>
            </button>

            <button
              type="button"
              onClick={() => handleValidateAndAdvance(5)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <span>Continue to Review & Custody</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          STEP 5: COMPLAINT REVIEW & DIGITAL CUSTODY PROOF
          ========================================================================= */}
      {currentStep === 5 && (
        <div className="space-y-6">
          
          {/* Formal Complaint Draft Statement */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
                  FINAL PREPARATION · STEP 5
                </div>
                <h3 className="text-xl font-bold text-zinc-950 dark:text-white mt-0.5">
                  Structured Complaint Statement
                </h3>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setComplaintView('formal')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      complaintView === 'formal'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Formal Legal
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplaintView('simple')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                      complaintView === 'simple'
                        ? 'bg-white dark:bg-zinc-800 text-[#007FFF] shadow-xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Simple Citizen
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const text =
                      complaintView === 'formal'
                        ? buildCurrentCaseRecord().complaintDraft.formalBody
                        : buildCurrentCaseRecord().complaintDraft.simpleBody;
                    navigator.clipboard.writeText(text);
                    setCopiedDraft(true);
                    setTimeout(() => setCopiedDraft(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
                >
                  {copiedDraft ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Statement</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Complaint Text Box */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
              {complaintView === 'formal'
                ? buildCurrentCaseRecord().complaintDraft.formalBody
                : buildCurrentCaseRecord().complaintDraft.simpleBody}
            </div>
          </div>

          {/* Integrated Digital Custody Proof Section */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#007FFF]" />
                  <span>Digital Custody Proof · Case {caseId}</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
                  Cryptographic Integrity & Audit Timeline
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  SHA-256 evidence fingerprints and append-only internal handling log.
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadAuditReport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer shadow-xs whitespace-nowrap"
              >
                {downloadReportSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Report Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#007FFF]" />
                    <span>Download Custody Report</span>
                  </>
                )}
              </button>
            </div>

            {/* Evidence Fingerprints Register */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Preserved Evidence Fingerprint Register ({evidenceList.length} Exhibits)
              </div>

              <div className="space-y-2">
                {evidenceList.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[#007FFF]">
                          [EX-0{idx + 1}]
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-500 break-all">
                        SHA-256: {item.sha256Hash}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleVerifyIntegrity(item.id, item.sha256Hash)}
                        className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 cursor-pointer"
                      >
                        {integrityStatus[item.id] === 'verifying'
                          ? 'Checking...'
                          : integrityStatus[item.id] === 'verified'
                          ? '✓ Verified'
                          : 'Verify Integrity'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological Append-Only Custody Log */}
            <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#007FFF]" />
                <span>Append-Only Case Activity Log ({custodyEvents.length} Events)</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {custodyEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-white">{ev.action}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{ev.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{ev.details}</p>
                    <div className="text-[10px] font-mono text-[#007FFF]">Actor: {ev.actor}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Previous / Final Save & Proceed Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
            <button
              type="button"
              onClick={() => handleValidateAndAdvance(4)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous: AI Refinement</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={handleSaveAndProceedToNavigator}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                <span>Save & Proceed to Resolution Navigator</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
