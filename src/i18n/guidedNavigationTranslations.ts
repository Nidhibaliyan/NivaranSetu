/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LanguageCode } from '../types';
import {
  ModuleTranslationDictionary,
  ModuleTranslationResolution,
  resolveModuleTranslation,
} from './moduleTranslation';

export interface GuidedNavigationCopy {
  continueLabel: string;
  exitLabel: string;
  autosaved: string;
  save: string;
  saveTitle: string;
  formatStepOf: (stepNumber: number, totalSteps: number) => string;
}

/**
 * Note: `Back` reuses existing `APP_TRANSLATIONS[lang].back` (complete in all 12 languages)
 * rather than duplicating the key here.
 */
export const GUIDED_NAVIGATION_COPY: ModuleTranslationDictionary<GuidedNavigationCopy> & {
  hi: GuidedNavigationCopy;
} = {
  en: {
    continueLabel: 'Continue',
    exitLabel: 'Save & Exit',
    autosaved: 'Autosaved',
    save: 'Save',
    saveTitle: 'Save changes to your local case database',
    formatStepOf: (stepNumber: number, totalSteps: number) =>
      `Step ${stepNumber} of ${totalSteps}`,
  },
  hi: {
    continueLabel: 'आगे बढ़ें',
    exitLabel: 'सहेजें और बाहर निकलें',
    autosaved: 'स्वतः सहेजा गया',
    save: 'सहेजें',
    saveTitle: 'अपने स्थानीय केस डेटाबेस में बदलाव सहेजें',
    formatStepOf: (stepNumber: number, totalSteps: number) =>
      `चरण ${stepNumber} / ${totalSteps}`,
  },
};

export function getGuidedNavigationTranslation(
  language?: LanguageCode | string | null
): ModuleTranslationResolution<GuidedNavigationCopy> {
  return resolveModuleTranslation(GUIDED_NAVIGATION_COPY, language);
}

export function getGuidedNavigationCopy(
  language?: LanguageCode | string | null
): GuidedNavigationCopy {
  return getGuidedNavigationTranslation(language).copy;
}
