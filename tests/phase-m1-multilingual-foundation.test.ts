/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * NivaranSetu — Phase M1 Multilingual Foundation Test Suite
 *
 * Verifies:
 *   1. Urdu sets document direction to RTL ('rtl') and lang to 'ur'.
 *   2. Switching from Urdu to English restores LTR ('ltr') and cleans up effect attributes properly.
 *   3. GuidedNavigationHeader renders translated labels when language changes (preserving prop overrides).
 *   4. CivicJourneyRoadmap renders translated header and all 5 milestones when language changes.
 *   5. App workspace empty states (navigator, dossier, monitoring) and error banner use selected translations.
 *   6. Module translation dictionaries have complete en/hi entries, avoid duplicating existing keys,
 *      and explicitly track pending translations across the 12 supported languages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

class MockLocalStorage {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

import {
  LanguageProvider,
  syncDocumentLanguageAttributes,
} from '../src/context/LanguageContext';
import { GuidedNavigationHeader } from '../src/components/GuidedNavigationHeader';
import { CivicJourneyRoadmap } from '../src/components/CivicJourneyRoadmap';
import {
  WorkspaceCasesErrorBanner,
  WorkspaceEmptyState,
} from '../src/components/WorkspaceEmptyState';
import {
  APP_TRANSLATIONS,
  LANGUAGE_METADATA,
} from '../src/i18n/appTranslations';
import {
  getModuleTranslationCoverage,
  type ModuleTranslationDictionary,
} from '../src/i18n/moduleTranslation';
import {
  GUIDED_NAVIGATION_COPY,
  getGuidedNavigationTranslation,
} from '../src/i18n/guidedNavigationTranslations';
import {
  CIVIC_ROADMAP_COPY,
  getCivicRoadmapTranslation,
} from '../src/i18n/civicRoadmapTranslations';
import {
  WORKSPACE_EMPTY_STATE_COPY,
  getWorkspaceEmptyStateTranslation,
} from '../src/i18n/workspaceEmptyStateTranslations';
import type { LanguageCode } from '../src/types';

console.log('=== NivaranSetu Phase M1 Multilingual Foundation Test Suite ===\n');

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error('    Error:', err?.stack || err?.message || err);
    failed++;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// 1 & 2. URDU RTL & SWITCHING BACK TO ENGLISH LTR + CLEANUP
// ---------------------------------------------------------------------------
console.log('--- Section 1: Document Direction (RTL/LTR) & Effect Cleanup ---');

runTest('1.1: Urdu sets document direction to rtl and lang to ur', () => {
  const docRoot = { lang: 'en', dir: 'ltr' };
  const cleanup = syncDocumentLanguageAttributes('ur', docRoot);

  assert.strictEqual(docRoot.lang, 'ur');
  assert.strictEqual(docRoot.dir, 'rtl');
  assert.strictEqual(LANGUAGE_METADATA.ur.dir, 'rtl');

  cleanup();
});

runTest('1.2: Switching from Urdu to English restores ltr and lang=en', () => {
  const docRoot = { lang: '', dir: '' };

  // Simulate mount in Urdu
  const cleanupUrdu = syncDocumentLanguageAttributes('ur', docRoot);
  assert.strictEqual(docRoot.lang, 'ur');
  assert.strictEqual(docRoot.dir, 'rtl');

  // Simulate React effect re-run on language switch ur -> en
  cleanupUrdu();
  const cleanupEnglish = syncDocumentLanguageAttributes('en', docRoot);
  assert.strictEqual(docRoot.lang, 'en');
  assert.strictEqual(docRoot.dir, 'ltr');

  // Simulate provider unmount cleanup
  cleanupEnglish();
  assert.strictEqual(docRoot.lang, '');
  assert.strictEqual(docRoot.dir, '');
});

runTest('1.3: Non-Urdu Indic languages (hi, bn, ta, etc.) explicitly apply ltr', () => {
  const docRoot = { lang: 'ur', dir: 'rtl' };
  const cleanupHi = syncDocumentLanguageAttributes('hi', docRoot);
  assert.strictEqual(docRoot.lang, 'hi');
  assert.strictEqual(docRoot.dir, 'ltr');
  cleanupHi();
  assert.strictEqual(docRoot.lang, 'ur');
  assert.strictEqual(docRoot.dir, 'rtl');
});

// ---------------------------------------------------------------------------
// 3. GUIDED NAVIGATION HEADER LOCALIZATION
// ---------------------------------------------------------------------------
console.log('\n--- Section 2: GuidedNavigationHeader Localization ---');

runTest('2.1: GuidedNavigationHeader renders English labels when language is en', () => {
  globalThis.localStorage.setItem('ns_lang', 'en');
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(GuidedNavigationHeader, {
        stepNumber: 2,
        totalSteps: 5,
        stepTitle: 'Case Details',
        instruction: 'Fill in key details.',
        lastAutosaved: '10:30 AM',
        onBack: () => {},
        onContinue: () => {},
        onSaveDraft: () => {},
        onExit: () => {},
      })
    )
  );

  assert.ok(html.includes('Step 2 of 5'));
  assert.ok(html.includes('Autosaved 10:30 AM'));
  assert.ok(html.includes('>Back<'));
  assert.ok(html.includes('>Save<'));
  assert.ok(html.includes('>Save &amp; Exit<'));
  assert.ok(html.includes('>Continue<'));
  assert.ok(html.includes('title="Save changes to your local case database"'));
});

runTest('2.2: GuidedNavigationHeader updates all labels when language changes to hi', () => {
  globalThis.localStorage.setItem('ns_lang', 'hi');
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(GuidedNavigationHeader, {
        stepNumber: 2,
        totalSteps: 5,
        stepTitle: 'Case Details',
        instruction: 'Fill in key details.',
        lastAutosaved: '10:30 AM',
        onBack: () => {},
        onContinue: () => {},
        onSaveDraft: () => {},
        onExit: () => {},
      })
    )
  );

  assert.ok(html.includes('चरण 2 / 5'));
  assert.ok(html.includes('स्वतः सहेजा गया 10:30 AM'));
  assert.ok(html.includes(`>${APP_TRANSLATIONS.hi.back}<`));
  assert.ok(html.includes('>सहेजें<'));
  assert.ok(html.includes('>सहेजें और बाहर निकलें<'));
  assert.ok(html.includes('>आगे बढ़ें<'));
  assert.ok(html.includes('title="अपने स्थानीय केस डेटाबेस में बदलाव सहेजें"'));
});

runTest('2.3: GuidedNavigationHeader reuses existing APP_TRANSLATIONS.back (all 12 languages) and respects explicit prop overrides', () => {
  globalThis.localStorage.setItem('ns_lang', 'ur');
  const defaultUrHtml = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(GuidedNavigationHeader, {
        stepTitle: 'Case Details',
        instruction: 'Details',
        onBack: () => {},
      })
    )
  );
  assert.ok(
    defaultUrHtml.includes(`>${APP_TRANSLATIONS.ur.back}<`),
    'Expected Back button to use APP_TRANSLATIONS.ur.back without duplicating key'
  );

  globalThis.localStorage.setItem('ns_lang', 'hi');
  const overrideHtml = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(GuidedNavigationHeader, {
        stepTitle: 'Case Details',
        instruction: 'Details',
        onBack: () => {},
        backLabel: 'Custom Back',
        onContinue: () => {},
        continueLabel: 'Custom Next',
        onExit: () => {},
        exitLabel: 'Custom Exit',
      })
    )
  );
  assert.ok(overrideHtml.includes('>Custom Back<'));
  assert.ok(overrideHtml.includes('>Custom Next<'));
  assert.ok(overrideHtml.includes('>Custom Exit<'));
});

// ---------------------------------------------------------------------------
// 4. CIVIC JOURNEY ROADMAP LOCALIZATION
// ---------------------------------------------------------------------------
console.log('\n--- Section 3: CivicJourneyRoadmap Localization ---');

runTest('3.1: CivicJourneyRoadmap renders English heading and 5 milestones for en', () => {
  globalThis.localStorage.setItem('ns_lang', 'en');
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(CivicJourneyRoadmap, {
        onSelectMilestone: () => {},
      })
    )
  );

  const escapeHtml = (text: string) => text.replace(/&/g, '&amp;');
  assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.badge)));
  assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.headline)));
  assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.subheadline)));
  for (const stepKey of ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'] as const) {
    assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.steps[stepKey].stepNumber)));
    assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.steps[stepKey].title)));
    assert.ok(html.includes(escapeHtml(CIVIC_ROADMAP_COPY.en.steps[stepKey].desc)));
  }
});

runTest('3.2: CivicJourneyRoadmap updates heading and all 5 milestones when language changes to hi', () => {
  globalThis.localStorage.setItem('ns_lang', 'hi');
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(CivicJourneyRoadmap, {
        onSelectMilestone: () => {},
      })
    )
  );

  assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.badge));
  assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.headline));
  assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.subheadline));
  for (const stepKey of ['step-1', 'step-2', 'step-3', 'step-4', 'step-5'] as const) {
    assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.steps[stepKey].stepNumber));
    assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.steps[stepKey].title));
    assert.ok(html.includes(CIVIC_ROADMAP_COPY.hi.steps[stepKey].desc));
  }
  assert.ok(!html.includes('Verify &amp; Check'));
  assert.ok(!html.includes('Your Journey Begins here !!'));
});

// ---------------------------------------------------------------------------
// 5. APP EMPTY STATES & ERROR BANNER LOCALIZATION
// ---------------------------------------------------------------------------
console.log('\n--- Section 4: App Empty States & Error Banner Localization ---');

runTest('4.1: App empty states (navigator, dossier, monitoring) and Dismiss banner use selected translations', () => {
  const variants = ['navigator', 'dossier', 'monitoring'] as const;

  for (const variant of variants) {
    globalThis.localStorage.setItem('ns_lang', 'en');
    const enHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(WorkspaceEmptyState, {
          variant,
          onStartNewCase: () => {},
          onOpenSettings: () => {},
        })
      )
    );
    assert.ok(enHtml.includes(WORKSPACE_EMPTY_STATE_COPY.en.states[variant].title));
    assert.ok(enHtml.includes(WORKSPACE_EMPTY_STATE_COPY.en.states[variant].description));
    assert.ok(enHtml.includes(WORKSPACE_EMPTY_STATE_COPY.en.startNewGrievance));
    assert.ok(enHtml.includes(WORKSPACE_EMPTY_STATE_COPY.en.openSettings));

    globalThis.localStorage.setItem('ns_lang', 'hi');
    const hiHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(WorkspaceEmptyState, {
          variant,
          onStartNewCase: () => {},
          onOpenSettings: () => {},
        })
      )
    );
    assert.ok(hiHtml.includes(WORKSPACE_EMPTY_STATE_COPY.hi.states[variant].title));
    assert.ok(hiHtml.includes(WORKSPACE_EMPTY_STATE_COPY.hi.states[variant].description));
    assert.ok(hiHtml.includes(WORKSPACE_EMPTY_STATE_COPY.hi.startNewGrievance));
    assert.ok(hiHtml.includes(WORKSPACE_EMPTY_STATE_COPY.hi.openSettings));
    assert.ok(!hiHtml.includes(WORKSPACE_EMPTY_STATE_COPY.en.states[variant].title));
  }

  globalThis.localStorage.setItem('ns_lang', 'hi');
  const bannerHtml = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(WorkspaceCasesErrorBanner, {
        message: 'Sample sync warning',
        onDismiss: () => {},
      })
    )
  );
  assert.ok(bannerHtml.includes('Sample sync warning'));
  assert.ok(bannerHtml.includes(`>${WORKSPACE_EMPTY_STATE_COPY.hi.dismiss}<`));
});

runTest('4.2: src/App.tsx delegates empty states and error banner to localized workspace components', () => {
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
  assert.ok(appSrc.includes('<WorkspaceEmptyState'));
  assert.ok(appSrc.includes('variant="navigator"'));
  assert.ok(appSrc.includes('variant="dossier"'));
  assert.ok(appSrc.includes('variant="monitoring"'));
  assert.ok(appSrc.includes('<WorkspaceCasesErrorBanner'));
  assert.ok(!appSrc.includes('No Active Grievance Selected'));
  assert.ok(!appSrc.includes('No Case Dossier Available'));
  assert.ok(!appSrc.includes('No Case Under Monitoring'));
});

// ---------------------------------------------------------------------------
// 6. TRANSLATION ARCHITECTURE HONESTY & COVERAGE CHECKS
// ---------------------------------------------------------------------------
console.log('\n--- Section 5: Translation Architecture & Coverage Transparency ---');

runTest('5.1: New module dictionaries cover en/hi completely and honestly report pending languages', () => {
  const all12 = Object.keys(LANGUAGE_METADATA) as LanguageCode[];
  const expectedPending = all12.filter((code) => code !== 'en' && code !== 'hi');

  const dicts: ModuleTranslationDictionary<unknown>[] = [
    GUIDED_NAVIGATION_COPY,
    CIVIC_ROADMAP_COPY,
    WORKSPACE_EMPTY_STATE_COPY,
  ];
  for (const dict of dicts) {
    const coverage = getModuleTranslationCoverage(dict);
    assert.deepStrictEqual(coverage.completeLanguages, ['en', 'hi']);
    assert.deepStrictEqual(coverage.missingLanguages, expectedPending);
  }

  // Fallback resolution must explicitly report isTranslated: false for incomplete languages
  const bnNav = getGuidedNavigationTranslation('bn');
  assert.strictEqual(bnNav.requestedLanguage, 'bn');
  assert.strictEqual(bnNav.resolvedLanguage, 'en');
  assert.strictEqual(bnNav.isTranslated, false);

  const hiRoadmap = getCivicRoadmapTranslation('hi');
  assert.strictEqual(hiRoadmap.isTranslated, true);
  assert.strictEqual(hiRoadmap.resolvedLanguage, 'hi');

  const taEmpty = getWorkspaceEmptyStateTranslation('ta');
  assert.strictEqual(taEmpty.isTranslated, false);
  assert.strictEqual(taEmpty.resolvedLanguage, 'en');
});

runTest('5.2: GuidedNavigationCopy does not duplicate existing APP_TRANSLATIONS.back key', () => {
  assert.strictEqual('back' in GUIDED_NAVIGATION_COPY.en, false);
  assert.strictEqual('backLabel' in GUIDED_NAVIGATION_COPY.en, false);
});

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}
