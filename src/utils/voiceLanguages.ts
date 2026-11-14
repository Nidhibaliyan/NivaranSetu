/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LanguageCode } from '../types.ts';

export interface VoiceLanguageSpec {
  code: LanguageCode;
  bcp47: string;
  label: string;
  nativeLabel: string;
}

export const VOICE_LANGUAGES: Record<LanguageCode, VoiceLanguageSpec> = {
  en: { code: 'en', bcp47: 'en-IN', label: 'English (India)', nativeLabel: 'English' },
  hi: { code: 'hi', bcp47: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी' },
  bn: { code: 'bn', bcp47: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা' },
  mr: { code: 'mr', bcp47: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी' },
  ta: { code: 'ta', bcp47: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ்' },
  te: { code: 'te', bcp47: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు' },
  kn: { code: 'kn', bcp47: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  ml: { code: 'ml', bcp47: 'ml-IN', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  gu: { code: 'gu', bcp47: 'gu-IN', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  pa: { code: 'pa', bcp47: 'pa-IN', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  or: { code: 'or', bcp47: 'or-IN', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
  ur: { code: 'ur', bcp47: 'ur-IN', label: 'Urdu', nativeLabel: 'اردو' },
};

export const VOICE_LANGUAGE_LIST: VoiceLanguageSpec[] = Object.values(VOICE_LANGUAGES);

export function getVoiceLocale(language: LanguageCode | string): string {
  const key = (language in VOICE_LANGUAGES ? language : 'en') as LanguageCode;
  return VOICE_LANGUAGES[key].bcp47;
}

export function getLanguageLabel(language: LanguageCode | string): string {
  const key = (language in VOICE_LANGUAGES ? language : 'en') as LanguageCode;
  return VOICE_LANGUAGES[key].label;
}

export function getLanguageSpecByBcp47(bcp47: string): VoiceLanguageSpec {
  return (
    VOICE_LANGUAGE_LIST.find((spec) => spec.bcp47 === bcp47) || VOICE_LANGUAGES.en
  );
}
