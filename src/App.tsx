/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { AppLayout } from './components/AppLayout';
import { DashboardOverview } from './components/DashboardOverview';
import { MyCasesView } from './components/MyCasesView';
import { CaseBuilder } from './components/CaseBuilder';
import { TrustCheck } from './components/TrustCheck';
import { ResolutionNavigator } from './components/ResolutionNavigator';
import { CaseDossier } from './components/CaseDossier';
import { SmartCaseMonitoring } from './components/SmartCaseMonitoring';
import { LegalSimplifier } from './components/LegalSimplifier';
import { SettingsView } from './components/SettingsView';
import { GrievanceCase, TrustCheckRecord } from './types';
import { INITIAL_CASES } from './sampleData';
import { loadInitialCases, persistCases } from './utils/caseStorage';

export default function App() {
  // Navigation view: 'landing' | 'auth' | 'app'
  const [view, setView] = useState<'landing' | 'auth' | 'app'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Logged-in citizen profile state
  const [userProfile, setUserProfile] = useState<{ name: string; email: string }>(() => {
    try {
      const saved = localStorage.getItem('ns_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return { name: 'Rajesh Joshi', email: 'rajesh.joshi@example.com' };
  });

  // Application workspace tab
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Grievance cases state with unified storage persistence
  const [cases, setCases] = useState<GrievanceCase[]>(() => {
    return loadInitialCases();
  });

  // Active selected case ID
  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    return cases[0]?.id || INITIAL_CASES[0].id;
  });

  // Prompt passed to case builder
  const [initialBuilderPrompt, setInitialBuilderPrompt] = useState<string>('');

  // Active TrustCheck record passed to case builder
  const [activeTrustRecord, setActiveTrustRecord] = useState<TrustCheckRecord | null>(null);

  // Synchronize cases to storage on update
  useEffect(() => {
    persistCases(cases);
  }, [cases]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0] || INITIAL_CASES[0];

  // Handlers
  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (userData: { name: string; email: string }) => {
    setUserProfile(userData);
    localStorage.setItem('ns_user_profile', JSON.stringify(userData));
    setView('app');
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartCase = () => {
    setInitialBuilderPrompt('');
    setActiveTrustRecord(null);
    setActiveTab('new_case');
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCase = (caseId: string, targetTab = 'builder') => {
    setSelectedCaseId(caseId);
    setActiveTab(targetTab);
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNewCaseFromDashboard = (initialPrompt?: string) => {
    setInitialBuilderPrompt(initialPrompt || '');
    setActiveTrustRecord(null);
    setActiveTab('new_case');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCase = (savedCase: GrievanceCase, proceedToNavigator = false) => {
    setCases((prev) => {
      const exists = prev.findIndex((c) => c.id === savedCase.id);
      if (exists >= 0) {
        const copy = [...prev];
        copy[exists] = savedCase;
        return copy;
      }
      return [savedCase, ...prev];
    });
    setSelectedCaseId(savedCase.id);

    if (proceedToNavigator) {
      setActiveTab('navigator');
    } else {
      setActiveTab('overview');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetSampleData = () => {
    setCases(INITIAL_CASES);
    setSelectedCaseId(INITIAL_CASES[0].id);
    localStorage.removeItem('ns_grievance_cases');
  };

  const handleClearAllCases = () => {
    setCases([]);
    localStorage.setItem('ns_grievance_cases', JSON.stringify([]));
  };

  const handleLogout = () => {
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      <LanguageProvider>
        {view === 'landing' && (
          <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#09090B] flex flex-col">
            <Navbar
              onNavigateToApp={() => setView('app')}
              onOpenAuth={handleOpenAuth}
            />
            <LandingPage
              onStartCase={handleStartCase}
              onOpenAuth={handleOpenAuth}
            />
          </div>
        )}

        {view === 'auth' && (
          <AuthPage
            initialMode={authMode}
            onSuccess={handleAuthSuccess}
            onBackToHome={() => setView('landing')}
          />
        )}

        {view === 'app' && (
          <AppLayout
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onBackToLanding={() => setView('landing')}
            onLogout={handleLogout}
            selectedCase={selectedCase}
            allCases={cases}
            userName={userProfile.name}
            onSelectCaseById={(id) => setSelectedCaseId(id)}
          >
            {activeTab === 'overview' && (
              <DashboardOverview
                cases={cases}
                userName={userProfile.name.split(' ')[0]}
                onSelectCase={handleSelectCase}
                onCreateNewCase={handleCreateNewCaseFromDashboard}
                onNavigateToTab={setActiveTab}
              />
            )}

            {activeTab === 'my_cases' && (
              <MyCasesView
                cases={cases}
                onSelectCase={handleSelectCase}
                onCreateNewCase={() => {
                  setInitialBuilderPrompt('');
                  setActiveTrustRecord(null);
                  setActiveTab('new_case');
                }}
              />
            )}

            {/* Smart Case Builder (Central Intelligence Module) */}
            {(activeTab === 'new_case' ||
              activeTab === 'builder' ||
              activeTab === 'evidence' ||
              activeTab === 'readiness' ||
              activeTab === 'custody') && (
              <CaseBuilder
                initialCase={activeTab === 'new_case' ? undefined : selectedCase}
                initialPrompt={initialBuilderPrompt}
                initialTrustRecord={activeTrustRecord}
                initialStep={
                  activeTab === 'evidence'
                    ? 2
                    : activeTab === 'readiness'
                    ? 3
                    : activeTab === 'custody'
                    ? 5
                    : 1
                }
                onSaveCase={handleSaveCase}
                onCancel={() => setActiveTab('overview')}
              />
            )}

            {/* TrustCheck Module */}
            {activeTab === 'trust' && (
              <TrustCheck
                onNavigateToTab={setActiveTab}
                onContinueToBuilder={(trustRecord) => {
                  setActiveTrustRecord(trustRecord);
                  const initialText = `[TrustCheck Advisory: ${trustRecord.resultStatus || 'Flagged'}]\nSuspicious Identifier: ${trustRecord.input} (${trustRecord.type.toUpperCase()})\nAdvisory Match: ${trustRecord.flagTitle}\nDetails: ${trustRecord.description}`;
                  setInitialBuilderPrompt(initialText);
                  setActiveTab('new_case');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}

            {/* Resolution Navigator Module */}
            {activeTab === 'navigator' && (
              <ResolutionNavigator
                currentCase={selectedCase}
                onNavigateToDossier={() => setActiveTab('dossier')}
                onNavigateBackToBuilder={() => setActiveTab('builder')}
                onNavigateToMonitoring={() => setActiveTab('monitoring')}
                onUpdateCase={handleSaveCase}
              />
            )}

            {/* Case Dossier Module */}
            {activeTab === 'dossier' && (
              <CaseDossier
                currentCase={selectedCase}
                onNavigateBackToNavigator={() => setActiveTab('navigator')}
                onNavigateBackToBuilder={() => setActiveTab('builder')}
                onNavigateToMonitoring={() => setActiveTab('monitoring')}
              />
            )}

            {/* Smart Case Monitoring Module (Connected Post-Submission Workflow) */}
            {activeTab === 'monitoring' && (
              <SmartCaseMonitoring
                currentCase={selectedCase}
                onUpdateCase={(updated) => handleSaveCase(updated)}
                onBackToCases={() => setActiveTab('my_cases')}
                onOpenDossier={() => setActiveTab('dossier')}
                onOpenNavigator={() => setActiveTab('navigator')}
              />
            )}

            {/* Legal Language Simplifier Tool */}
            {activeTab === 'simplifier' && <LegalSimplifier />}

            {/* Settings View */}
            {activeTab === 'settings' && (
              <SettingsView
                onResetSampleData={handleResetSampleData}
                onClearAllCases={handleClearAllCases}
              />
            )}
          </AppLayout>
        )}
      </LanguageProvider>
    </ThemeProvider>
  );
}
