/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LanguageCode } from '../types';
import { LANGUAGE_METADATA, normalizeLanguageCode } from './appTranslations';

export type ModuleTranslationDictionary<T> = Partial<Record<LanguageCode, T>> & {
  en: T;
};

export interface ModuleTranslationResolution<T> {
  copy: T;
  requestedLanguage: LanguageCode;
  resolvedLanguage: LanguageCode;
  isTranslated: boolean;
}

export interface ModuleTranslationCoverage {
  completeLanguages: LanguageCode[];
  missingLanguages: LanguageCode[];
}

const ALL_LANGUAGE_CODES = Object.keys(LANGUAGE_METADATA) as LanguageCode[];

/**
 * Resolves a module-specific translation dictionary for the active language.
 * Falls back to English at runtime when a non-English locale has not yet been
 * translated, while explicitly reporting `isTranslated: false` so incomplete
 * translations are never misrepresented as complete.
 */
export function resolveModuleTranslation<T>(
  dictionary: ModuleTranslationDictionary<T>,
  language?: string | null
): ModuleTranslationResolution<T> {
  const requestedLanguage = normalizeLanguageCode(language);
  const localizedCopy = dictionary[requestedLanguage];
  if (localizedCopy !== undefined) {
    return {
      copy: localizedCopy,
      requestedLanguage,
      resolvedLanguage: requestedLanguage,
      isTranslated: true,
    };
  }

  return {
    copy: dictionary.en,
    requestedLanguage,
    resolvedLanguage: 'en',
    isTranslated: false,
  };
}

/**
 * Computes explicit language coverage for a module-specific dictionary across
 * all 12 supported NivaranSetu languages.
 */
export function getModuleTranslationCoverage<T>(
  dictionary: ModuleTranslationDictionary<T>
): ModuleTranslationCoverage {
  const completeLanguages: LanguageCode[] = [];
  const missingLanguages: LanguageCode[] = [];

  for (const code of ALL_LANGUAGE_CODES) {
    if (dictionary[code] !== undefined) {
      completeLanguages.push(code);
    } else {
      missingLanguages.push(code);
    }
  }

  return { completeLanguages, missingLanguages };
}
