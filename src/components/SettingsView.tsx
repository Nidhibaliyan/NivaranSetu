import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../sampleData';
import { AppTheme, LanguageCode, AppMode } from '../types';
import {
  Sun,
  Moon,
  Laptop,
  Globe,
  Shield,
  Trash2,
  RotateCcw,
  Check,
  Lock,
  Eye,
  Sparkles,
  Info
} from 'lucide-react';

interface SettingsViewProps {
  onResetSampleData: () => void;
  onClearAllCases: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onResetSampleData,
  onClearAllCases,
}) => {
  const { language, setLanguage, mode, setMode, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);

  const handleReset = () => {
    onResetSampleData();
    setClearedNotice('Sample grievance cases restored successfully.');
    setTimeout(() => setClearedNotice(null), 3000);
  };

  const handleClear = () => {
    onClearAllCases();
    setClearedNotice('All local cases and uploaded mock documents cleared.');
    setTimeout(() => setClearedNotice(null), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 space-y-1">
        <div className="text-xs font-semibold text-[#007FFF] uppercase tracking-wider">
          Preferences & Governance
        </div>
        <h2 data-testid="settings-heading" className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white">
          {t('settings_title')}
        </h2>
        <p className="text-xs text-zinc-500">
          {t('settings_subtitle')}
        </p>
      </div>

      {clearedNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{clearedNotice}</span>
        </div>
      )}

      {/* 1. Theme Preferences */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Interface Appearance
          </h3>
          <p className="text-xs text-zinc-500">
            NivaranSetu features handcrafted dark and light themes optimized for readability and WCAG AA contrast.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'dark', label: 'Dark Mode', desc: 'Jet Black canvas with Charcoal cards', icon: Moon },
            { id: 'light', label: 'Light Mode', desc: 'Pure White canvas with Soft Grey surfaces', icon: Sun },
            { id: 'system', label: 'System Default', desc: 'Syncs automatically with operating system', icon: Laptop },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = theme === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTheme(item.id as AppTheme)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#007FFF] text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#007FFF]" />}
                </div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white">{item.label}</div>
                <div className="text-[11px] text-zinc-500 mt-1 leading-snug">{item.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Reading Experience Mode */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Reading Mode (Accessibility)
          </h3>
          <p className="text-xs text-zinc-500">
            Switch between everyday plain-language explanations and formal statutory citations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setMode('simple')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'simple'
                ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">{t('simple_mode')}</span>
              {mode === 'simple' && <Check className="w-4 h-4 text-[#007FFF]" />}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t('simple_mode_desc')}
            </p>
          </div>

          <div
            onClick={() => setMode('detailed')}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              mode === 'detailed'
                ? 'border-[#007FFF] bg-[#007FFF]/5 dark:bg-[#007FFF]/10'
                : 'border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">{t('detailed_mode')}</span>
              {mode === 'detailed' && <Check className="w-4 h-4 text-[#007FFF]" />}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t('detailed_mode_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Language Selector */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            {t('settings_language_title')}
          </h3>
          <p className="text-xs text-zinc-500">
            {t('settings_language_desc')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                data-testid={`settings-lang-${lang.code}`}
                onClick={() => setLanguage(lang.code)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#007FFF] bg-[#007FFF]/10 text-[#007FFF]'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className="font-semibold text-xs">{lang.nativeLabel}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{lang.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Privacy & Local Storage Controls */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Privacy & Local Session Storage
          </h3>
          <p className="text-xs text-zinc-500">
            Control local mock storage and cache. No personal data or uploaded documents are transmitted to external ad trackers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#007FFF]" />
            <span>Restore Realistic Sample Cases</span>
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Local Cases</span>
          </button>
        </div>
      </div>

      {/* 5. Product Ethics & Limitations */}
      <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#007FFF]" />
          <span>NivaranSetu Architectural Boundaries & Limitations</span>
        </div>
        <p className="leading-relaxed">
          NivaranSetu automates evidence extraction, document organization, timeline continuity, and complaint formulation. We intentionally do not automate OTP verification, CAPTCHAs, or silent submissions to government systems. The citizen always maintains 100% control over the final review and filing on official channels.
        </p>
      </div>

    </div>
  );
};
