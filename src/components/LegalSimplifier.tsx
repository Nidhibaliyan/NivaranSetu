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
  Scale
} from 'lucide-react';

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

export const LegalSimplifier: React.FC = () => {
  const { language } = useLanguage();
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(SAMPLE_NOTICES[0].id);
  const [pastedNoticeText, setPastedNoticeText] = useState('');
  const [isReadingAloud, setIsReadingAloud] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const activeNotice = SAMPLE_NOTICES.find((n) => n.id === selectedNoticeId) || SAMPLE_NOTICES[0];

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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 space-y-1">
        <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
          Learn & Understand
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
          Legal Language Simplifier
        </h2>
        <p className="text-xs text-zinc-500">
          Paste intimidating government rejection letters, legal notices, or builder demands. We translate bureaucratic legalese into 5 clear, actionable takeaways.
        </p>
      </div>

      {/* Template Chooser or Custom Paste */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white">
            Select a Realistic Notice Scenario or Paste Your Own
          </div>
          <div className="flex items-center gap-2">
            {SAMPLE_NOTICES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedNoticeId(s.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                  selectedNoticeId === s.id
                    ? 'border-[#007FFF] bg-[#007FFF]/10 text-[#007FFF]'
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
            onChange={(e) => setPastedNoticeText(e.target.value)}
            placeholder="Or paste custom notice text here (e.g. 'Pursuant to clause 19 of consumer regulations...')"
            className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] font-mono"
          />
          {pastedNoticeText && (
            <div className="text-[11px] text-[#007FFF] font-medium">
              Custom notice loaded. AI synthesis active.
            </div>
          )}
        </div>
      </div>

      {/* 5-PART LEGAL DECONSTRUCTION VIEW */}
      <div className="space-y-6">
        
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

        {/* Section 1: Original Official Text */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              1. Original Bureaucratic / Legal Notice Text
            </span>
            <button
              onClick={() => handleCopy(activeNotice.originalText, 'orig')}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center gap-1"
            >
              {copiedSection === 'orig' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>Copy</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {pastedNoticeText || activeNotice.originalText}
          </pre>
        </div>

        {/* Section 2: Simple English Translation */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <span className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>2. Simple-Language Plain English Explanation</span>
            </span>
          </div>
          <div className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-[#007FFF]/5 dark:bg-[#007FFF]/10 border border-[#007FFF]/20">
            {activeNotice.simpleEnglish}
          </div>
        </div>

        {/* Section 3: Hindi Translation */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" />
              <span>3. सरल हिंदी अनुवाद (Hindi Regional Translation)</span>
            </span>
          </div>
          <div className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            {activeNotice.hindiTranslation}
          </div>
        </div>

        {/* Section 4 & 5 Grid: Key Dates vs Required Citizen Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Section 4: Critical Dates & Time limits */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#007FFF]" />
              <span>4. Important Dates & Statutory Deadlines</span>
            </div>
            <div className="space-y-2">
              {activeNotice.keyDates.map((d, idx) => (
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
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-3">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>5. Actions You Need to Take Now</span>
            </div>
            <div className="space-y-2">
              {activeNotice.mandatoryActions.map((action, idx) => (
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

      </div>

    </div>
  );
};
