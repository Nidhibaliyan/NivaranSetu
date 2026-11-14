import React, { useState } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../sampleData';
import { Sun, Moon, Laptop, Globe, ArrowRight, Menu, X, Check } from 'lucide-react';
import { LanguageCode } from '../types';

interface NavbarProps {
  onNavigateToApp: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateToApp, onOpenAuth }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.nativeLabel || 'English';

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        
        {/* Left: Brand with animated bridge logo */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="cursor-pointer"
        >
          <Logo size="md" showSubtitle={true} animated={true} />
        </a>

        {/* Center/Right Nav Links (Matching image_9c0f2e08.png) */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('nav_how_it_works')}
          </button>
          <button
            onClick={() => scrollToSection('why-nivaransetu')}
            className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('nav_why')}
          </button>
          <button
            onClick={() => scrollToSection('accessibility')}
            className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('nav_accessibility')}
          </button>
        </nav>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              data-testid="navbar-language-trigger"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800 cursor-pointer"
              title={currentLangLabel}
            >
              <Globe className="w-3.5 h-3.5 text-[#007FFF]" />
              <span>{language.toUpperCase()}</span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
                  {t('settings_language_title')}
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    data-testid={`navbar-lang-${lang.code}`}
                    onClick={() => {
                      setLanguage(lang.code as LanguageCode);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                      language === lang.code
                        ? 'bg-[#007FFF]/10 text-[#007FFF] font-semibold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span>{lang.nativeLabel} <span className="text-[10px] text-zinc-400">({lang.label})</span></span>
                    {language === lang.code && <Check className="w-3.5 h-3.5 text-[#007FFF] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Switcher Toggle (Single moon/sun button matching image_9c0f2e08.png) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
            title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Log in Button */}
          <button
            onClick={() => onOpenAuth('login')}
            className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
          >
            {t('cta_login')}
          </button>

          {/* Get Started Button */}
          <button
            onClick={() => onOpenAuth('register')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-all shadow-sm shadow-[#007FFF]/25 hover:translate-y-[-1px] cursor-pointer"
          >
            <span>{t('cta_get_started')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 px-4 pt-3 pb-6 bg-white dark:bg-[#09090B] space-y-3">
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="block w-full text-left py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {t('nav_how_it_works')}
          </button>
          <button
            onClick={() => scrollToSection('why-nivaransetu')}
            className="block w-full text-left py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {t('nav_why')}
          </button>
          <button
            onClick={() => scrollToSection('accessibility')}
            className="block w-full text-left py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
          >
            {t('nav_accessibility')}
          </button>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('login');
              }}
              className="w-full py-2.5 text-xs font-semibold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl"
            >
              {t('cta_login')}
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAuth('register');
              }}
              className="w-full py-2.5 text-xs font-semibold text-white bg-[#007FFF] rounded-xl flex items-center justify-center gap-1.5"
            >
              <span>{t('cta_get_started')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
