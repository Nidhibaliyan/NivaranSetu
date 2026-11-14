/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { AppLayout } from './components/AppLayout';
import { DashboardOverview } from './components/DashboardOverview';
import { MyCasesView } from './components/MyCasesView';
import { CaseBuilder } from './components/CaseBuilder';
import {
  TrustCheck,
  getTrustCheckBadgeConfig,
  getTrustCheckSourceLabel,
} from './components/TrustCheck';
import { ResolutionNavigator } from './components/ResolutionNavigator';
import { CaseDossier } from './components/CaseDossier';
import { SmartCaseMonitoring } from './components/SmartCaseMonitoring';
import { LegalSimplifier } from './components/LegalSimplifier';
import { LegalRagPanel } from './components/LegalRagPanel';
import { SettingsView } from './components/SettingsView';
import { BridgeOpeningAnimation } from './components/BridgeOpeningAnimation';
import {
  WorkspaceCasesErrorBanner,
  WorkspaceEmptyState,
} from './components/WorkspaceEmptyState';
import { GrievanceCase, TrustCheckRecord } from './types';
import {
  fetchCases,
  saveCase,
  softDeleteAllCases,
  seedDemoCasesForUser,
} from './utils/caseRepository';
import {
  AuthUser,
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
  hasValidSession,
  getPersistedTab,
  savePersistedTab,
  getPersistedView,
  savePersistedView,
  getSupabaseAuthSession,
  onSupabaseAuthStateChange,
  signOutFromSupabase,
} from './utils/authSession';

export default function App() {
  // Session checking loading state to prevent flash of login/landing on startup
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  // Authenticated state derived from active session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => hasValidSession());

  // Logged-in citizen profile state
  const [userProfile, setUserProfile] = useState<AuthUser | null>(() => {
    const session = getAuthSession();
    return session ? session.user : null;
  });

  // Navigation view: 'landing' | 'auth' | 'app'
  const [view, setView] = useState<'landing' | 'auth' | 'app'>(() => {
    const session = getAuthSession();
    if (session) return 'app';
    const persistedView = getPersistedView();
    if (persistedView === 'auth') return 'auth';
    return 'landing';
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Application workspace tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return getPersistedTab();
  });

  // Opening bridge animation state (runs before opening website for first-time visitors)
  const [showOpeningAnimation, setShowOpeningAnimation] = useState<boolean>(() => {
    try {
      if (hasValidSession()) return false;
      return !sessionStorage.getItem('ns_intro_seen');
    } catch {
      return true;
    }
  });

  const handleOpeningComplete = () => {
    setShowOpeningAnimation(false);
    try {
      sessionStorage.setItem('ns_intro_seen', 'true');
    } catch (e) {
      console.error(e);
    }
  };

  // Restore and validate authentic Supabase session on startup, and listen for auth state changes
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const { user } = await getSupabaseAuthSession();
        if (!isMounted) return;

        if (user) {
          setUserProfile(user);
          setIsAuthenticated(true);
          setView('app');
          savePersistedView('app');
          try {
            sessionStorage.setItem('ns_intro_seen', 'true');
          } catch {}
        } else {
          setIsAuthenticated(false);
          setUserProfile(null);
          const lastView = getPersistedView();
          if (lastView === 'auth') {
            setView('auth');
            setAuthMode('login');
          } else if (lastView === 'app') {
            // Attempted to view app without active session -> prompt login
            setView('auth');
            setAuthMode('login');
            savePersistedView('auth');
          } else {
            setView('landing');
          }
        }
      } catch (err) {
        console.error('Session restoration error:', err);
        clearAuthSession();
        if (isMounted) {
          setIsAuthenticated(false);
          setUserProfile(null);
          setView('auth');
          setAuthMode('login');
        }
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    restoreSession();

    // Subscribe to genuine Supabase Auth lifecycle events
    const { unsubscribe } = onSupabaseAuthStateChange((event, authUser) => {
      if (!isMounted) return;
      if (authUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        setUserProfile(authUser);
        setIsAuthenticated(true);
        setView('app');
        savePersistedView('app');
      } else if (event === 'SIGNED_OUT') {
        currentRequestIdRef.current++;
        activeUserUuidRef.current = null;
        setUserProfile(null);
        setIsAuthenticated(false);
        setCases([]);
        setCasesError(null);
        setEditingExistingCaseId(null);
        setSelectedCaseId('');
        setView('auth');
        savePersistedView('auth');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Persist active tab when authenticated
  useEffect(() => {
    if (isAuthenticated && view === 'app') {
      savePersistedTab(activeTab);
    }
  }, [activeTab, isAuthenticated, view]);

  // Grievance cases state - populated exclusively via authenticated asynchronous fetch
  const [cases, setCases] = useState<GrievanceCase[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  // Guard refs to prevent race conditions during account switches, logouts, or in-flight saves
  const activeUserUuidRef = useRef<string | null>(null);
  const currentRequestIdRef = useRef<number>(0);

  // Active selected case ID (explicit selection only; empty by default)
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Track if an existing case was explicitly opened by the user to view/edit
  const [editingExistingCaseId, setEditingExistingCaseId] = useState<string | null>(null);

  // Unique session ID to key fresh CaseBuilder instances on new complaint creation
  const [newCaseSessionId, setNewCaseSessionId] = useState<string>(() => Date.now().toString());

  // Prompt passed to case builder
  const [initialBuilderPrompt, setInitialBuilderPrompt] = useState<string>('');

  // Active TrustCheck record passed to case builder
  const [activeTrustRecord, setActiveTrustRecord] = useState<TrustCheckRecord | null>(null);

  // Asynchronously load active cases from Supabase when user authenticates or account changes
  useEffect(() => {
    let isCancelled = false;
    const currentReqId = ++currentRequestIdRef.current;

    if (!isAuthenticated || !userProfile?.id || isCheckingSession) {
      if (!isCheckingSession) {
        activeUserUuidRef.current = null;
        setCases([]);
        setSelectedCaseId('');
        setEditingExistingCaseId(null);
        setIsLoadingCases(false);
        setCasesError(null);
      }
      return;
    }

    // Immediately reset in-memory cases when user changes to prevent cross-account display
    if (activeUserUuidRef.current !== userProfile.id) {
      setCases([]);
      setSelectedCaseId('');
      setEditingExistingCaseId(null);
    }

    activeUserUuidRef.current = userProfile.id;
    setIsLoadingCases(true);
    setCasesError(null);

    fetchCases()
      .then((loadedCases) => {
        if (isCancelled || currentRequestIdRef.current !== currentReqId) return;
        if (activeUserUuidRef.current !== userProfile.id) return;
        setCases(loadedCases);
        setIsLoadingCases(false);
      })
      .catch((err) => {
        if (isCancelled || currentRequestIdRef.current !== currentReqId) return;
        console.error('Failed to load user cases from Supabase:', err);
        setCasesError(err?.message || 'Unable to load cases from database.');
        setIsLoadingCases(false);
        setCases([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, userProfile?.id, isCheckingSession]);

  // DEF-07: Explicit case selection only; returns null when no case is selected or ID is invalid
  const selectedCase = selectedCaseId
    ? cases.find((c) => c.id === selectedCaseId) || null
    : null;

  const existingCaseToEdit =
    activeTab !== 'new_case' && editingExistingCaseId
      ? cases.find((c) => c.id === editingExistingCaseId)
      : undefined;

  // Centralized handler for starting a genuinely new complaint
  const handleStartNewCase = (initialPrompt = '', trustRecord: TrustCheckRecord | null = null) => {
    setSelectedCaseId('');
    setEditingExistingCaseId(null);
    setNewCaseSessionId(Date.now().toString());
    setInitialBuilderPrompt(initialPrompt);
    setActiveTrustRecord(trustRecord);
    setActiveTab('new_case');
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToTab = (tab: string) => {
    if (tab === 'new_case') {
      handleStartNewCase();
    } else if (tab === 'builder') {
      // DEF-07: Preserve active editing session if set; do not silently convert selectedCaseId into an edit session
      setActiveTab('builder');
    } else if (tab === 'evidence') {
      // DEF-07: Attach to active editing case or selected case; if neither, start a new case
      const targetCase = editingExistingCaseId
        ? cases.find((c) => c.id === editingExistingCaseId)
        : selectedCaseId
        ? cases.find((c) => c.id === selectedCaseId)
        : undefined;

      if (targetCase) {
        setSelectedCaseId(targetCase.id);
        setEditingExistingCaseId(targetCase.id);
        setActiveTab('evidence');
      } else {
        // No case exists or selected: guide citizen by starting a new case
        handleStartNewCase();
      }
    } else {
      setActiveTab(tab);
    }
  };

  // Handlers
  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setView('auth');
    savePersistedView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (userData: AuthUser, rememberMe = true) => {
    const session = saveAuthSession(userData, rememberMe);
    setUserProfile(session.user);
    setIsAuthenticated(true);
    setView('app');
    savePersistedView('app');
    try {
      sessionStorage.setItem('ns_intro_seen', 'true');
    } catch {}
    const targetTab = getPersistedTab();
    setActiveTab(targetTab || 'overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartCase = () => {
    if (isAuthenticated) {
      handleStartNewCase();
    } else {
      handleOpenAuth('register');
    }
  };

  const handleSelectCase = (caseId: string, targetTab = 'builder') => {
    setSelectedCaseId(caseId);
    setEditingExistingCaseId(caseId);
    setActiveTab(targetTab);
    setView('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNewCaseFromDashboard = (initialPrompt?: string) => {
    handleStartNewCase(initialPrompt || '');
  };

  const handleSaveCase = async (savedCase: GrievanceCase, proceedToNavigator = false): Promise<boolean> => {
    const currentUserId = userProfile?.id;
    if (!isAuthenticated || !currentUserId) {
      setCasesError('Authentication required to save grievance.');
      return false;
    }

    const saveReqId = currentRequestIdRef.current;

    try {
      // Optimistic in-memory update so citizen form inputs are preserved without data loss
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
      setEditingExistingCaseId(savedCase.id);

      // Persist to Supabase
      await saveCase(savedCase);

      // Verify that user did not switch or log out while save was in flight
      if (currentRequestIdRef.current !== saveReqId || activeUserUuidRef.current !== currentUserId) {
        return false;
      }

      setCasesError(null);

      // Proceed to Navigator strictly after successful persistence
      if (proceedToNavigator) {
        setActiveTab('navigator');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return true;
    } catch (err: any) {
      console.error('Failed to persist case to Supabase:', err);
      if (activeUserUuidRef.current === currentUserId) {
        setCasesError(`Unable to save case to database: ${err?.message || 'Network or database error'}`);
      }
      // Strictly prevent navigation on failed save
      return false;
    }
  };

  const handleResetSampleData = async () => {
    if (!isAuthenticated || !userProfile?.id) {
      setCasesError('Authentication required to restore sample cases.');
      return;
    }
    const currentUserId = userProfile.id;
    try {
      setIsLoadingCases(true);
      setCasesError(null);
      await seedDemoCasesForUser();
      if (activeUserUuidRef.current !== currentUserId) return;
      const reloadedCases = await fetchCases();
      if (activeUserUuidRef.current !== currentUserId) return;
      setCases(reloadedCases);
      if (reloadedCases.length > 0) {
        setSelectedCaseId(reloadedCases[0].id);
        setEditingExistingCaseId(reloadedCases[0].id);
      }
    } catch (err: any) {
      console.error('Failed to seed demo cases:', err);
      if (activeUserUuidRef.current === currentUserId) {
        setCasesError(`Failed to restore sample cases: ${err?.message || 'Database error'}`);
      }
    } finally {
      if (activeUserUuidRef.current === currentUserId) {
        setIsLoadingCases(false);
      }
    }
  };

  const handleClearAllCases = async () => {
    if (!isAuthenticated || !userProfile?.id) {
      setCases([]);
      setSelectedCaseId('');
      setEditingExistingCaseId(null);
      return;
    }
    const currentUserId = userProfile.id;
    try {
      setIsLoadingCases(true);
      setCasesError(null);
      await softDeleteAllCases();
      if (activeUserUuidRef.current !== currentUserId) return;
      setCases([]);
      setSelectedCaseId('');
      setEditingExistingCaseId(null);
    } catch (err: any) {
      console.error('Failed to clear cases:', err);
      if (activeUserUuidRef.current === currentUserId) {
        setCasesError(`Failed to clear cases from database: ${err?.message || 'Database error'}`);
      }
    } finally {
      if (activeUserUuidRef.current === currentUserId) {
        setIsLoadingCases(false);
      }
    }
  };

  const handleLogout = async () => {
    // Invalidate in-flight requests and clear active user reference
    currentRequestIdRef.current++;
    activeUserUuidRef.current = null;

    try {
      await signOutFromSupabase();
    } catch (e) {
      console.warn('SignOut error:', e);
    }
    clearAuthSession();
    setUserProfile(null);
    setIsAuthenticated(false);
    setCases([]); // Immediately purge in-memory cases to prevent cross-account display
    setCasesError(null);
    setEditingExistingCaseId(null);
    setInitialBuilderPrompt('');
    setActiveTrustRecord(null);
    setSelectedCaseId('');
    setActiveTab('overview');
    savePersistedTab('overview');
    setNewCaseSessionId(Date.now().toString());
    setAuthMode('login');
    setView('auth');
    savePersistedView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Prevent flash of unauthenticated screens while validating session on startup
  if (isCheckingSession) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-white dark:bg-[#09090B] flex flex-col items-center justify-center text-zinc-900 dark:text-white transition-colors">
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-blue-200 dark:border-blue-900 border-t-[#007FFF] rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-[#007FFF]" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold tracking-wide text-zinc-900 dark:text-zinc-200">
                NivaranSetu
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Restoring secure session...
              </p>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        {showOpeningAnimation && (
          <BridgeOpeningAnimation onComplete={handleOpeningComplete} showSkip={true} />
        )}

        {view === 'landing' && (
          <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#09090B] flex flex-col">
            <Navbar
              onNavigateToApp={() => {
                if (hasValidSession()) {
                  setView('app');
                  savePersistedView('app');
                } else {
                  handleOpenAuth('login');
                }
              }}
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
            onBackToHome={() => {
              setView('landing');
              savePersistedView('landing');
            }}
          />
        )}

        {view === 'app' && (
          <AppLayout
            activeTab={activeTab}
            setActiveTab={handleNavigateToTab}
            onBackToLanding={() => {
              setView('landing');
              savePersistedView('landing');
            }}
            onLogout={handleLogout}
            selectedCase={selectedCase}
            allCases={cases}
            userName={userProfile?.name || 'Citizen User'}
            onSelectCaseById={(id) => {
              setSelectedCaseId(id);
              setEditingExistingCaseId(id);
            }}
          >
            {casesError && (
              <WorkspaceCasesErrorBanner
                message={casesError}
                onDismiss={() => setCasesError(null)}
              />
            )}

            {activeTab === 'overview' && (
              <DashboardOverview
                cases={cases}
                userName={(userProfile?.name || 'Citizen').split(' ')[0]}
                onSelectCase={handleSelectCase}
                onCreateNewCase={handleCreateNewCaseFromDashboard}
                onNavigateToTab={handleNavigateToTab}
              />
            )}

            {activeTab === 'my_cases' && (
              <MyCasesView
                cases={cases}
                onSelectCase={handleSelectCase}
                onCreateNewCase={() => handleStartNewCase()}
              />
            )}

            {/* Smart Case Builder (Central Intelligence Module) */}
            {(activeTab === 'new_case' ||
              activeTab === 'builder' ||
              activeTab === 'evidence' ||
              activeTab === 'readiness' ||
              activeTab === 'custody') && (
              <CaseBuilder
                key={existingCaseToEdit ? existingCaseToEdit.id : `new-${newCaseSessionId}`}
                initialCase={existingCaseToEdit}
                initialPrompt={existingCaseToEdit ? '' : initialBuilderPrompt}
                initialTrustRecord={existingCaseToEdit ? null : activeTrustRecord}
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
                onStartNewCase={() => handleStartNewCase()}
              />
            )}

            {/* TrustCheck Module */}
            {activeTab === 'trust' && (
              <TrustCheck
                onNavigateToTab={handleNavigateToTab}
                onContinueToBuilder={(trustRecord) => {
                  const badge = getTrustCheckBadgeConfig(trustRecord.riskLevel, trustRecord.resultStatus);
                  const source = getTrustCheckSourceLabel(trustRecord);
                  const initialText = `[TrustCheck Advisory: ${badge.text} — ${source.text}]\nSuspicious Identifier: ${trustRecord.input} (${trustRecord.type.toUpperCase()})\nAdvisory Match: ${trustRecord.flagTitle}\nDetails: ${trustRecord.description}`;
                  handleStartNewCase(initialText, trustRecord);
                }}
              />
            )}

            {/* Resolution Navigator Module */}
            {activeTab === 'navigator' && (
              selectedCase ? (
                <ResolutionNavigator
                  key={selectedCase.id}
                  currentCase={selectedCase}
                  citizenName={userProfile?.name || 'Citizen User'}
                  onNavigateToDossier={() => setActiveTab('dossier')}
                  onNavigateBackToBuilder={() => {
                    if (selectedCase) {
                      setEditingExistingCaseId(selectedCase.id);
                    }
                    setActiveTab('builder');
                  }}
                  onNavigateToMonitoring={() => setActiveTab('monitoring')}
                  onUpdateCase={handleSaveCase}
                />
              ) : (
                <WorkspaceEmptyState
                  variant="navigator"
                  onStartNewCase={() => handleStartNewCase()}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              )
            )}

            {/* Case Dossier Module */}
            {activeTab === 'dossier' && (
              selectedCase ? (
                <CaseDossier
                  key={selectedCase.id}
                  currentCase={selectedCase}
                  citizenName={userProfile?.name || 'Citizen User'}
                  onNavigateBackToNavigator={() => setActiveTab('navigator')}
                  onNavigateBackToBuilder={() => {
                    if (selectedCase) {
                      setEditingExistingCaseId(selectedCase.id);
                    }
                    setActiveTab('builder');
                  }}
                  onNavigateToMonitoring={() => setActiveTab('monitoring')}
                />
              ) : (
                <WorkspaceEmptyState
                  variant="dossier"
                  onStartNewCase={() => handleStartNewCase()}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              )
            )}

            {/* Smart Case Monitoring Module (Connected Post-Submission Workflow) */}
            {activeTab === 'monitoring' && (
              selectedCase ? (
                <SmartCaseMonitoring
                  currentCase={selectedCase}
                  onUpdateCase={(updated) => handleSaveCase(updated)}
                  onBackToCases={() => setActiveTab('my_cases')}
                  onOpenDossier={() => setActiveTab('dossier')}
                  onOpenNavigator={() => setActiveTab('navigator')}
                />
              ) : (
                <WorkspaceEmptyState
                  variant="monitoring"
                  onStartNewCase={() => handleStartNewCase()}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              )
            )}

            {/* Legal Language Simplifier Tool */}
            {activeTab === 'simplifier' && (
              <LegalSimplifier
                onNavigateToTab={handleNavigateToTab}
                onStartCaseWithNotice={(text) => {
                  handleStartNewCase(text);
                }}
              />
            )}

            {/* Legal Knowledge Base (RAG) */}
            {activeTab === 'legal_rag' && <LegalRagPanel />}

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
