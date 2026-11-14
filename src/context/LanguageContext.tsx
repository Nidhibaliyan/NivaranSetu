import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppMode, LanguageCode } from '../types';
import { getLanguageMeta, normalizeLanguageCode, translateAppKey } from '../i18n/appTranslations';

export interface DocumentLanguageRoot {
  lang: string;
  dir: string;
}

export function syncDocumentLanguageAttributes(
  language: LanguageCode,
  rootElement: DocumentLanguageRoot | null | undefined = typeof document !== 'undefined'
    ? document.documentElement
    : null
): () => void {
  if (!rootElement) {
    return () => {};
  }

  const previousLang = rootElement.lang;
  const previousDir = rootElement.dir;
  const meta = getLanguageMeta(language);

  rootElement.lang = meta.code;
  rootElement.dir = meta.dir;

  return () => {
    rootElement.lang = previousLang;
    rootElement.dir = previousDir;
  };
}

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('ns_lang');
      return normalizeLanguageCode(saved);
    } catch {
      return 'en';
    }
  });

  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const saved = localStorage.getItem('ns_mode');
      return saved === 'detailed' ? 'detailed' : 'simple';
    } catch {
      return 'simple';
    }
  });

  useEffect(() => {
    try {
      return syncDocumentLanguageAttributes(language);
    } catch {
      // Ignore SSR/non-DOM environments
      return undefined;
    }
  }, [language]);

  const setLanguage = (lang: LanguageCode) => {
    const normalized = normalizeLanguageCode(lang);
    setLanguageState(normalized);
    try {
      localStorage.setItem('ns_lang', normalized);
    } catch {
      // Ignore storage failures
    }
  };

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('ns_mode', newMode);
    } catch {
      // Ignore storage failures
    }
  };

  const t = (key: string): string => {
    return translateAppKey(key, language);
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
