import React, { useState } from 'react';
import { Logo } from './Logo';
import { GlobalAssistant } from './GlobalAssistant';
import { GrievanceCase } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../sampleData';
import { LanguageCode } from '../types';
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  ShieldCheck,
  FileText,
  Search,
  CheckCircle2,
  Compass,
  Layers,
  Scale,
  Lock,
  Settings,
  Bell,
  Sun,
  Moon,
  Globe,
  Check,
  Menu,
  X,
  Sparkles,
  ArrowRight,
  LogOut,
  ChevronRight
} from 'lucide-react';

interface AppLayoutProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onBackToLanding: () => void;
  onLogout: () => void;
  selectedCase: GrievanceCase;
  allCases: GrievanceCase[];
  userName?: string;
  onSelectCaseById: (caseId: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  setActiveTab,
  onBackToLanding,
  onLogout,
  selectedCase,
  allCases,
  userName = 'Rajesh Joshi',
  onSelectCaseById,
  children,
}) => {
  const { language, setLanguage, mode, setMode } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  const getBreadcrumbLabel = () => {
    switch (activeTab) {
      case 'overview':
        return 'Dashboard';
      case 'my_cases':
        return 'My Cases';
      case 'new_case':
      case 'builder':
        return 'Smart Case Builder';
      case 'trust':
        return 'TrustCheck';
      case 'evidence':
        return 'Smart Case Builder · Evidence';
      case 'readiness':
        return 'Smart Case Builder · Readiness';
      case 'navigator':
        return 'Resolution Navigator';
      case 'dossier':
        return 'Case Dossier';
      case 'monitoring':
        return 'Smart Case Monitoring';
      case 'simplifier':
        return 'Legal Simplifier';
      case 'custody':
        return 'Digital Custody Proof';
      case 'settings':
        return 'Settings';
      default:
        return 'Workspace';
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 flex transition-colors">
      
      {/* 1. LEFT SIDEBAR (Faithfully matching image_e650191c.png) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#18181B] transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Sidebar Header: Logo */}
        <div className="h-18 flex items-center justify-between px-5 border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-2 cursor-pointer text-left"
            title="Return to Public Landing Page"
          >
            <Logo size="md" showSubtitle={!sidebarCollapsed} />
          </button>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items (Streamlined Unified Structure) */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          
          {/* SECTION 1: CITIZEN WORKFLOW */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-3 mb-2 font-mono">
                WORKFLOW & CASES
              </div>
            )}

            {/* 1. Dashboard */}
            <button
              onClick={() => {
                setActiveTab('overview');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>

            {/* 2. TrustCheck */}
            <button
              onClick={() => {
                setActiveTab('trust');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'trust'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>TrustCheck</span>}
            </button>

            {/* 3. Smart Case Builder */}
            <button
              onClick={() => {
                setActiveTab('builder');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'builder' || activeTab === 'new_case' || activeTab === 'evidence' || activeTab === 'readiness'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Smart Case Builder</span>}
            </button>

            {/* 4. Resolution Navigator */}
            <button
              onClick={() => {
                setActiveTab('navigator');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'navigator'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Resolution Navigator</span>}
            </button>

            {/* 5. Case Dossier */}
            <button
              onClick={() => {
                setActiveTab('dossier');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'dossier'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Case Dossier</span>}
            </button>

            {/* 6. My Cases with count */}
            <button
              onClick={() => {
                setActiveTab('my_cases');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'my_cases'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>My Cases</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-mono flex items-center justify-center font-bold">
                  {allCases.length}
                </span>
              )}
            </button>
          </div>

          {/* SECTION 2: TOOLS & LEGAL */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-3 mb-2 font-mono">
                TOOLS & LEGAL
              </div>
            )}

            {/* 7. Legal Language Simplifier */}
            <button
              onClick={() => {
                setActiveTab('simplifier');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'simplifier'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <Scale className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Legal Simplifier</span>}
            </button>
          </div>

          {/* SECTION 4: ACCOUNT */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-3 mb-2 font-mono">
                ACCOUNT
              </div>
            )}

            <button
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#007FFF]/10 text-[#007FFF]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>
          </div>

        </div>

        {/* Sidebar Bottom Card: "Need a hand?" from reference image image_e650191c.png */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#007FFF]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Need a hand?</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                Ask the assistant how to take the next step.
              </p>
              <button
                onClick={() => {
                  const btn = document.querySelector('button[title="Open NivaranSetu Assistant"]') as HTMLButtonElement;
                  if (btn) btn.click();
                }}
                className="text-[11px] font-semibold text-[#007FFF] hover:underline flex items-center gap-1 pt-0.5 cursor-pointer"
              >
                <span>Chat with assistant</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 2. MAIN APPLICATION CONTENT VIEWPORT */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        
        {/* TOP BAR (Faithfully matching image_e650191c.png) */}
        <header className="sticky top-0 z-30 h-18 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Breadcrumb: "Workspace -> [Tab Name]" */}
          <div className="flex items-center gap-2.5 text-xs text-zinc-500 overflow-hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="font-medium text-zinc-500">Workspace</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-bold text-zinc-950 dark:text-white truncate">
              {getBreadcrumbLabel()}
            </span>
          </div>

          {/* Right Top Bar Controls: Search, Notifications, Theme, Language, Profile */}
          <div className="flex items-center gap-3">
            
            {/* Search Cases Input from image_e650191c.png */}
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search cases..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:border-[#007FFF] w-48 lg:w-64"
              />
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#007FFF]" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-2xl p-3 z-50 text-xs space-y-2">
                  <div className="font-bold text-zinc-900 dark:text-white px-1">Notifications</div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 text-xs">
                    <div className="font-semibold text-zinc-900 dark:text-white">Notice Period Expiring Soon</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">30-day statutory notice for Case NS-2026-0842 completes on Nov 28.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme switcher toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
              title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#007FFF]" />
                <span>{language.toUpperCase()}</span>
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-xl py-1 z-50">
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code as LanguageCode);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer ${
                        language === l.code
                          ? 'bg-[#007FFF]/10 text-[#007FFF] font-semibold'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{l.nativeLabel}</span>
                      {language === l.code && <Check className="w-3.5 h-3.5 text-[#007FFF]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile Avatar with dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#007FFF] to-[#FF2E93] text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:opacity-90"
                title={userName}
              >
                {userName.charAt(0).toUpperCase()}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] shadow-2xl p-2 z-50 text-xs space-y-1">
                  <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="font-bold text-zinc-900 dark:text-white">{userName}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">Citizen Workspace</div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    Settings & Privacy
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>

          </div>

        </header>

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>

      </div>

      {/* 3. GLOBAL AI ASSISTANT (FLOATING AT BOTTOM-RIGHT) */}
      <GlobalAssistant onNavigateToTab={setActiveTab} />

    </div>
  );
};
