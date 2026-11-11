import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  FileText,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Languages,
  Upload,
  Copy,
  Check,
  Scale,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { GuidedNavigationHeader } from './GuidedNavigationHeader';
import {
  CHAT_CLIENT_TIMEOUT_MS,
  fetchWithTimeout,
  formatAiErrorMessage,
  parseNoticeCategory,
} from '../utils/aiClientUtils';

export { parseNoticeCategory };

interface NoticeSample {
  id: string;
  title: string;
  category: string;
  originalText: string;
  simpleEnglish: string;
  hindiTranslation: string;
  keyDates: string[];
  mandatoryActions: string[];
}

const SAMPLE_NOTICES: NoticeSample[] = [
  {
    id: 'notice-bank-1',
    title: 'Bank Rejection citing Non-Exhaustion of Tiered Hierarchy',
    category: 'Banking / RBI Ombudsman',
    originalText: `Ref: APEX/PN/DISPUTE/2026/89412
To: Complainant
Sub: Repudiation of claim regarding unconsented electronic transaction

We have reviewed your communication regarding alleged electronic transactions dated 28-10-2026. Pursuant to Clause 17.4 of RBI Master Directions and Section 11 of the Integrated Ombudsman Scheme, this grievance cannot be entertained in limine due to premature lodgement without prior disposal by the Principal Nodal Officer (PNO) within the thirty (30) days statutory window. The customer credentials were authenticated via registered SIM IMSI. Bank disclaims liability under Section 43A of IT Act. You may seek recourse before competent civil court.`,
    simpleEnglish: `What the bank is saying in simple terms:
1. The bank is refusing to return your money right now because you went to the top level too quickly.
2. Under banking rules, you must wait 30 days after writing to their Principal Nodal Officer before the RBI Ombudsman can step in.
3. The bank claims your SIM card was used for the transaction, so they are trying to blame you.
4. IMPORTANT: If you reported the fraud within 3 days, RBI Zero-Liability rules protect you regardless of their claims.`,
    hindiTranslation: `बैंक के इस पत्र का सरल हिंदी अर्थ:
1. बैंक ने आपकी शिकायत यह कहकर खारिज कर दी है कि आपने 30 दिन का समय दिए बिना सीधे उच्च स्तर पर शिकायत कर दी।
2. नियमों के अनुसार, बैंक के मुख्य नोडल अधिकारी (PNO) को लिखित शिकायत देने के बाद 30 दिन तक उनके जवाब का इंतज़ार करना जरूरी होता है।
3. बैंक का दावा है कि आपके रजिस्टर्ड सिम से लेन-देन हुआ था, इसलिए वे ज़िम्मेदारी लेने से बच रहे हैं।
4. महत्वपूर्ण: यदि आपने 3 दिन के भीतर शिकायत दर्ज कराई है, तो RBI की शून्य देयता नीति (Zero Liability) के तहत आपका पैसा सुरक्षित होना चाहिए।`,
    keyDates: [
      '28-10-2026: Date of unauthorized transactions',
      '30 Days: Mandatory waiting period from initial branch complaint before filing with RBI Ombudsman',
      '1 Year: Total statutory deadline to file with RBI Ombudsman after bank refusal',
    ],
    mandatoryActions: [
      'Submit a formal written appeal directly to the Principal Nodal Officer (PNO) of the bank with inward stamp proof.',
      'Mark a copy to the Banking Cyber Fraud cell citing RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18.',
      'Set a calendar reminder for 30 days from inward receipt to escalate directly to the RBI CMS portal.',
    ],
  },
  {
    id: 'notice-rera-2',
    title: 'Builder Demand Notice for Raw Material Escalation Surcharge',
    category: 'Real Estate / RERA',
    originalText: `GREENFIELD INFRASTRUCTURE & PROMOTERS PVT LTD
NOTICE UNDER CLAUSE 19: ESCALATION & STATUTORY CESS DEMAND

Dear Allottee (Flat C-1104),
In reference to Agreement for Sale dated 15-08-2021, notice is hereby given that unprecedented hyperinflation in Portland Pozzolana Cement (PPC) and Fe550 TMT Rebar has caused extraordinary cost overruns constituting statutory force majeure under Section 6 of RERA 2016. An ad-hoc supplementary escalation surcharge of ₹4,80,000/- is debited to your milestone account. Failure to remit within fifteen (15) calendar days shall entail cancellation of allotment under Clause 23 with forfeiture of earnest deposit. Handover remains suspended pending clearance of dues.`,
    simpleEnglish: `What the builder is saying in simple terms:
1. The builder is demanding an extra ₹4.8 Lakhs claiming cement and steel prices went up during the delay.
2. They are threatening to cancel your flat booking if you don't pay within 15 days.
3. This is an illegal demand: under RERA Section 18, builders cannot charge price escalation after their promised delivery date has already passed.
4. The builder has delayed delivery by over 2.5 years and actually owes YOU monthly delay interest.`,
    hindiTranslation: `बिल्डर के इस नोटिस का सरल हिंदी अर्थ:
1. बिल्डर सीमेंट और सरिया महंगा होने का बहाना बनाकर आपसे ₹4.8 लाख अतिरिक्त मांग रहा है।
2. 15 दिन में पैसे न देने पर फ्लैट का आवंटन रद्द करने की धमकी दी जा रही है।
3. यह मांग गैरकानूनी है: RERA की धारा 18 के तहत, तय समय सीमा बीतने के बाद बिल्डर मनमाना अतिरिक्त चार्ज नहीं वसूल सकता।
4. सच यह है कि फ्लैट 2.5 साल देरी से चल रहा है, इसलिए उल्टे बिल्डर को आपको हर महीने का हर्ज़ाना (ब्याज) देना होगा।`,
    keyDates: [
      '15 Days: Unilateral demand deadline imposed by builder (DO NOT PAY without RERA counsel)',
      '31-03-2024: Original contractual possession deadline (Builder in breach for 32 months)',
    ],
    mandatoryActions: [
      'DO NOT pay the demanded ₹4,80,000 without prejudice letter.',
      'Serve a formal legal reply through NivaranSetu stating the demand violates Section 18 RERA.',
      'File an online complaint before State RERA (Form M) seeking stay on cancellation and order for possession interest.',
    ],
  },
];

interface LegalSimplifierProps {
  onNavigateToTab?: (tab: string) => void;
  onStartCaseWithNotice?: (text: string) => void;
}

export const LegalSimplifier: React.FC<LegalSimplifierProps> = ({
  onNavigateToTab,
  onStartCaseWithNotice,
}) => {
  const { language } = useLanguage();
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(SAMPLE_NOTICES[0].id);
  const [pastedNoticeText, setPastedNoticeText] = useState('');
  const [customNoticeData, setCustomNoticeData] = useState<NoticeSample | null>(null);
  const [isAnalyzingNotice, setIsAnalyzingNotice] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [showOriginalNotice, setShowOriginalNotice] = useState(false);

  const isCustom = Boolean(pastedNoticeText.trim());
  const sampleNotice = SAMPLE_NOTICES.find((n) => n.id === selectedNoticeId) || SAMPLE_NOTICES[0];

  const displayedNotice: NoticeSample = isCustom
    ? customNoticeData || {
        id: 'custom-unparsed',
        title: 'Custom Legal Notice (Verbatim Input)',
        category: 'Legal Notice / Order',
        originalText: pastedNoticeText.trim(),
        simpleEnglish: 'Click "Analyze Notice with AI" above to generate a plain-language explanation, key statutory deadlines, and mandatory citizen actions from your custom notice.',
        hindiTranslation: 'कस्टम नोटिस का सरल हिंदी अनुवाद देखने के लिए ऊपर "Analyze Notice with AI" बटन पर क्लिक करें।',
        keyDates: ['Statutory dates will be identified once analyzed.'],
        mandatoryActions: ['Preserve original notice and all postal envelope marks as custody proof.'],
      }
    : sampleNotice;

  const handleToggleReadAloud = () => {
    if (!isReadingAloud) {
      setIsReadingAloud(true);
      setTimeout(() => setIsReadingAloud(false), 5000);
    } else {
      setIsReadingAloud(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleAnalyzeCustomNotice = async () => {
    if (!pastedNoticeText.trim()) return;
    setIsAnalyzingNotice(true);
    setAnalysisError(null);

    const prompt = `You are a legal aid specialist helping an Indian citizen understand an official notice, bank repudiation, or builder demand.
Notice Text:
"""
${pastedNoticeText.trim().slice(0, 7000)}
"""

Please analyze this text and return your response in this exact format:
CATEGORY: [e.g. Banking / Financial, Real Estate / RERA, Insurance, Consumer / E-Commerce, Utilities / Power, or General Legal]
TITLE: [Concise title of this notice, max 10 words]
SIMPLE_ENGLISH:
[2-4 bullet points or sentences explaining in plain everyday language what the issuing entity is claiming or demanding]
HINDI_TRANSLATION:
[The simple explanation in clear everyday Hindi (सरल हिंदी)]
KEY_DATES:
- [Extracted dates or statutory deadlines, one per line with a dash]
MANDATORY_ACTIONS:
- [Specific actions the citizen must take in response, one per line with a dash]`;

    try {
      const res = await fetchWithTimeout(
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

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();
      const outputText = data.text || '';

      const extractedCategory = parseNoticeCategory(outputText);
      const titleMatch = outputText.match(/TITLE:\s*(.+)/i);
      const simpleMatch = outputText.match(/SIMPLE_ENGLISH:\s*([\s\S]*?)(?=HINDI_TRANSLATION:|$)/i);
      const hindiMatch = outputText.match(/HINDI_TRANSLATION:\s*([\s\S]*?)(?=KEY_DATES:|$)/i);
      const datesMatch = outputText.match(/KEY_DATES:\s*([\s\S]*?)(?=MANDATORY_ACTIONS:|$)/i);
      const actionsMatch = outputText.match(/MANDATORY_ACTIONS:\s*([\s\S]*?)$/i);

      const parsedDates = datesMatch
        ? datesMatch[1].split('\n').map((l: string) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
        : [];
      const parsedActions = actionsMatch
        ? actionsMatch[1].split('\n').map((l: string) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
        : [];

      const customParsed: NoticeSample = {
        id: `custom-${Date.now()}`,
        title: titleMatch ? titleMatch[1].trim() : 'Custom Notice Analysis',
        category: extractedCategory || 'Legal / Regulatory',
        originalText: pastedNoticeText.trim(),
        simpleEnglish: simpleMatch ? simpleMatch[1].trim() : outputText.trim(),
        hindiTranslation: hindiMatch ? hindiMatch[1].trim() : 'हिंदी अनुवाद उपलब्ध नहीं है।',
        keyDates: parsedDates.length > 0 ? parsedDates : ['Review original notice document for specific statutory dates.'],
        mandatoryActions: parsedActions.length > 0 ? parsedActions : ['Preserve original notice and all postal envelope marks as custody proof.'],
      };

      setCustomNoticeData(customParsed);
    } catch (err: any) {
      console.error('Notice analysis error:', err);
      const formattedReason = formatAiErrorMessage(err, err?.message || 'Network or service error');
      setAnalysisError(
        `AI analysis could not be completed (${formattedReason}). Your pasted notice is preserved below and can still be carried directly into Smart Case Builder.`
      );
    } finally {
      setIsAnalyzingNotice(false);
    }
  };

  const handleCarryToCaseBuilder = () => {
    if (isCustom) {
      // Citizen entered custom notice text: strictly carry custom text and genuine extraction
      let textToCarry = '';
      if (customNoticeData) {
        textToCarry = `[Legal Notice Translation & Analysis]\nCategory: ${customNoticeData.category}\nTitle: ${customNoticeData.title}\nKey Actions: ${customNoticeData.mandatoryActions.join('; ')}\nSummary: ${customNoticeData.simpleEnglish}\n\nVerbatim Notice:\n${pastedNoticeText.trim()}`;
      } else {
        textToCarry = `[Citizen Legal Notice Document]\nVerbatim Notice:\n${pastedNoticeText.trim()}`;
      }

      if (onStartCaseWithNotice) {
        onStartCaseWithNotice(textToCarry);
      } else if (onNavigateToTab) {
        onNavigateToTab('new_case');
      }
    } else {
      // Citizen selected a sample notice
      const textToCarry = `[Legal Notice Translation & Analysis]\nCategory: ${sampleNotice.category}\nTitle: ${sampleNotice.title}\nKey Actions: ${sampleNotice.mandatoryActions.join('; ')}\nSummary: ${sampleNotice.simpleEnglish}\n\nVerbatim Notice:\n${sampleNotice.originalText}`;
      if (onStartCaseWithNotice) {
        onStartCaseWithNotice(textToCarry);
      } else if (onNavigateToTab) {
        onNavigateToTab('new_case');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Guided Step Navigation Header */}
      <GuidedNavigationHeader
        stepTitle="Legal Language Simplifier"
        instruction="Translate bureaucratic rejection letters, legal clauses, and builder demands into clear citizen action points."
        badgeLabel="Plain Language Companion"
        onBack={onNavigateToTab ? () => onNavigateToTab('overview') : undefined}
        backLabel="Dashboard"
        onContinue={handleCarryToCaseBuilder}
        continueLabel="Carry to Case Builder"
        onExit={onNavigateToTab ? () => onNavigateToTab('overview') : undefined}
        exitLabel="Exit to Dashboard"
      />

      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 space-y-1">
        <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider font-mono">
          LEARN & UNDERSTAND · COMPANION TOOL
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
          Deconstruct Intimidating Bureaucratic Legalese
        </h2>
        <p className="text-xs text-zinc-500">
          Paste government rejection letters, legal notices, or builder demands. We extract statutory timelines and generate clear, citizen-friendly takeaways.
        </p>
      </div>

      {/* Template Chooser or Custom Paste */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white">
            Select a Realistic Notice Scenario or Paste Your Own
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {SAMPLE_NOTICES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedNoticeId(s.id);
                  setPastedNoticeText('');
                  setCustomNoticeData(null);
                  setAnalysisError(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                  selectedNoticeId === s.id && !pastedNoticeText
                    ? 'border-[#007FFF] bg-[#007FFF]/10 text-[#007FFF] font-semibold'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {s.title.split(' ')[0]} {s.title.split(' ')[1]}...
              </button>
            ))}
          </div>
        </div>

        {/* Custom Paste Text Area */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={pastedNoticeText}
            onChange={(e) => {
              setPastedNoticeText(e.target.value);
              setCustomNoticeData(null);
              setAnalysisError(null);
            }}
            placeholder="Or paste custom notice text here (e.g. 'Pursuant to clause 19 of consumer regulations...')"
            className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] font-mono"
          />

          {pastedNoticeText.trim() && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-[11px] text-zinc-500">
                {customNoticeData ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Analysis complete for custom notice.</span>
                  </span>
                ) : (
                  <span>Custom notice loaded. Click button to run plain-language AI extraction.</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleAnalyzeCustomNotice}
                disabled={isAnalyzingNotice || !pastedNoticeText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {isAnalyzingNotice ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Notice...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze Notice with AI</span>
                  </>
                )}
              </button>
            </div>
          )}

          {analysisError && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Audio Simulation Toolbar */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs">
        <div className="flex items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
          <Languages className="w-4 h-4 text-[#007FFF]" />
          <span>Multilingual Speech & Voice Assistance</span>
          {isReadingAloud && (
            <span className="text-[11px] text-[#007FFF] animate-pulse">
              • Synthesizing spoken audio explanation...
            </span>
          )}
        </div>

        <button
          onClick={handleToggleReadAloud}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isReadingAloud
              ? 'bg-red-500 text-white'
              : 'bg-[#007FFF] text-white hover:bg-[#0070e0]'
          }`}
        >
          {isReadingAloud ? (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>Stop Reading</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Explanation Aloud</span>
            </>
          )}
        </button>
      </div>

      {/* 5-PART LEGAL DECONSTRUCTION VIEW WITH PROGRESSIVE DISCLOSURE */}
      <div className="space-y-6">
        
        {/* Section 2: Simple English Translation (Shown Prominently First) */}
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10 p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-3">
            <span className="text-xs font-bold text-[#007FFF] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#007FFF]" />
              <span>1. Simple-Language Plain English Explanation</span>
            </span>
            <button
              onClick={() => handleCopy(displayedNotice.simpleEnglish, 'eng')}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedSection === 'eng' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>Copy</span>
            </button>
          </div>
          <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-white dark:bg-[#18181B] border border-blue-200/50 dark:border-blue-900/30">
            {displayedNotice.simpleEnglish}
          </div>
        </div>

        {/* Section 3: Hindi Translation */}
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10 p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" />
              <span>2. सरल हिंदी अनुवाद (Hindi Regional Translation)</span>
            </span>
            <button
              onClick={() => handleCopy(displayedNotice.hindiTranslation, 'hin')}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedSection === 'hin' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>Copy</span>
            </button>
          </div>
          <div className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-white dark:bg-[#18181B] border border-emerald-200/50 dark:border-emerald-900/30">
            {displayedNotice.hindiTranslation}
          </div>
        </div>

        {/* Section 4 & 5 Grid: Key Dates vs Required Citizen Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section 4: Critical Dates & Time limits */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3 shadow-xs">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#007FFF]" />
              <span>3. Important Dates & Statutory Deadlines</span>
            </div>
            <div className="space-y-2">
              {displayedNotice.keyDates.map((d, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-700 dark:text-zinc-300 font-mono"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Mandatory Actions Citizen Must Take */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3 shadow-xs">
            <div className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>4. Actions You Need to Take Now</span>
            </div>
            <div className="space-y-2">
              {displayedNotice.mandatoryActions.map((action, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 leading-snug flex items-start gap-2"
                >
                  <span className="text-emerald-500 font-bold shrink-0">→</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Progressive Disclosure: Raw Original Notice Text (Collapsed by Default) */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-5 sm:p-6 space-y-3 shadow-xs">
          <button
            type="button"
            onClick={() => setShowOriginalNotice(!showOriginalNotice)}
            className="w-full flex items-center justify-between text-left cursor-pointer group"
          >
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                5. Raw Bureaucratic Notice / Legal Text
              </div>
              <p className="text-xs text-zinc-400">
                {showOriginalNotice ? 'Click to collapse raw legal notice' : 'Click to inspect original verbatim notice text'}
              </p>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-zinc-400 group-hover:text-[#007FFF] transition-transform duration-200 ${
                showOriginalNotice ? 'transform rotate-180' : ''
              }`}
            />
          </button>

          {showOriginalNotice && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2 animate-fade-in">
              <div className="flex justify-end">
                <button
                  onClick={() => handleCopy(displayedNotice.originalText, 'orig')}
                  className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedSection === 'orig' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>Copy Verbatim Text</span>
                </button>
              </div>
              <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                {displayedNotice.originalText}
              </pre>
            </div>
          )}
        </div>

        {/* Carry into Smart Case Builder Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#007FFF]/5 dark:bg-[#007FFF]/10 border border-[#007FFF]/20">
          <div className="space-y-1">
            <div className="text-sm font-bold text-zinc-900 dark:text-white">
              Ready to challenge or appeal this notice?
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Carry this notice and its statutory deadlines directly into Smart Case Builder to organize your complaint.
            </p>
          </div>
          <button
            onClick={handleCarryToCaseBuilder}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#007FFF] hover:bg-[#0070e0] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md shadow-[#007FFF]/20 shrink-0"
          >
            <span>Organize Case in Builder</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
};
