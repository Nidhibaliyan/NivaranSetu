import React, { createContext, useContext, useState } from 'react';
import { AppMode, LanguageCode } from '../types';
import { SUPPORTED_LANGUAGES } from '../sampleData';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  t: (key: string) => string;
}

const DICTIONARY: Record<string, Record<'en' | 'hi', string>> = {
  // Brand & Taglines
  brand_name: { en: 'NivaranSetu', hi: 'निवारणसेतु' },
  tagline: { en: 'A Bridge to Resolution.', hi: 'समाधान का एक सेतु।' },
  hero_title: {
    en: 'Your Problem Deserves a Clear Path to Resolution.',
    hi: 'आपकी समस्या को समाधान का एक स्पष्ट मार्ग मिलना चाहिए।',
  },
  hero_desc: {
    en: 'From organising evidence to preparing complaints and navigating government grievance channels, NivaranSetu helps you take the right next step with confidence.',
    hi: 'सबूत व्यवस्थित करने से लेकर शिकायत तैयार करने और सरकारी शिकायत निवारण चैनलों में मार्गदर्शन तक, निवारणसेतु आपको आत्मविश्वास के साथ सही अगला कदम उठाने में मदद करता है।',
  },
  cta_start_case: { en: 'Start Your Case', hi: 'अपना मामला शुरू करें' },
  cta_explore_how: { en: 'Explore How It Works', hi: 'देखें यह कैसे काम करता है' },
  cta_get_started: { en: 'Get Started', hi: 'आरंभ करें' },
  cta_open_dashboard: { en: 'Open Citizen Dashboard', hi: 'नागरिक डैशबोर्ड खोलें' },

  // Navigation
  nav_home: { en: 'Home', hi: 'होम' },
  nav_features: { en: 'Features', hi: 'विशेषताएं' },
  nav_how_it_works: { en: 'How It Works', hi: 'कार्यप्रणाली' },
  nav_about: { en: 'About', hi: 'परिचय' },
  nav_overview: { en: 'Overview', hi: 'अवलोकन' },
  nav_my_cases: { en: 'My Cases', hi: 'मेरे मामले' },
  nav_new_case: { en: 'Create New Case', hi: 'नया मामला बनाएं' },
  nav_case_builder: { en: 'Smart Case Builder', hi: 'स्मार्ट केस बिल्डर' },
  nav_evidence_intel: { en: 'Evidence Intelligence', hi: 'सबूत विश्लेषण' },
  nav_trust_check: { en: 'TrustCheck', hi: 'ट्रस्टचेक' },
  nav_resolution_nav: { en: 'Resolution Navigator', hi: 'समाधान मार्गदर्शक' },
  nav_case_dossier: { en: 'Case Dossier', hi: 'केस डॉसियर' },
  nav_custody_proof: { en: 'Custody Proof', hi: 'कस्टडी प्रमाण' },
  nav_learn_understand: { en: 'Legal Simplifier', hi: 'कानूनी भाषा सरलीकारक' },
  nav_settings: { en: 'Settings', hi: 'सेटिंग्स' },

  // Modes
  simple_mode: { en: 'Simple Mode', hi: 'सरल भाषा मोड' },
  detailed_mode: { en: 'Detailed Mode', hi: 'विस्तृत कानूनी मोड' },
  simple_mode_desc: { en: 'Everyday words and step-by-step guidance', hi: 'रोज़मर्रा की आसान भाषा और चरणबद्ध मार्गदर्शन' },
  detailed_mode_desc: { en: 'Formal legal terminology and statutory sections', hi: 'औपचारिक कानूनी धाराएं और प्रक्रियाएं' },

  // Metric cards
  total_cases: { en: 'Total Grievances', hi: 'कुल शिकायतें' },
  in_preparation: { en: 'In Preparation', hi: 'तैयारी जारी' },
  awaiting_action: { en: 'Awaiting Action', hi: 'कार्रवाई प्रतीक्षित' },
  follow_up_due: { en: 'Follow-Up Due', hi: 'अनुवर्ती देय' },

  // Common UI
  search_placeholder: { en: 'Search cases, documents, or authorities...', hi: 'मामले, दस्तावेज़ या प्राधिकरण खोजें...' },
  filter: { en: 'Filter', hi: 'फ़िल्टर' },
  status: { en: 'Status', hi: 'स्थिति' },
  category: { en: 'Category', hi: 'श्रेणी' },
  last_updated: { en: 'Last Updated', hi: 'अंतिम अपडेट' },
  actions: { en: 'Actions', hi: 'कार्रवाई' },
  view_details: { en: 'View Details', hi: 'विवरण देखें' },
  download_dossier: { en: 'Download Dossier', hi: 'डॉसियर डाउनलोड करें' },
  back: { en: 'Back', hi: 'वापस' },
  next: { en: 'Next', hi: 'आगे' },
  save_continue: { en: 'Save & Continue', hi: 'सहेजें और आगे बढ़ें' },
  cancel: { en: 'Cancel', hi: 'रद्द करें' },
  disclaimer_legal: {
    en: 'NivaranSetu is an informational intelligence tool designed to organize evidence and structure citizen complaints. It does not provide legal advice or guarantee official outcomes.',
    hi: 'निवारणसेतु सबूतों को व्यवस्थित करने और नागरिक शिकायतों को प्रारूपित करने का एक सूचनात्मक उपकरण है। यह कानूनी सलाह या सरकारी गारंटी नहीं देता है।',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('ns_lang') as LanguageCode;
    return saved || 'en';
  });

  const [mode, setModeState] = useState<AppMode>(() => {
    const saved = localStorage.getItem('ns_mode') as AppMode;
    return saved || 'simple';
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('ns_lang', lang);
  };

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('ns_mode', newMode);
  };

  const t = (key: string): string => {
    const entry = DICTIONARY[key];
    if (!entry) return key;
    if (language === 'hi') {
      return entry.hi || entry.en || key;
    }
    return entry.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, mode, setMode, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
