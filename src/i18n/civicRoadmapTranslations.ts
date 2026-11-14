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

export interface CivicRoadmapMilestoneCopy {
  stepNumber: string;
  title: string;
  desc: string;
}

export interface CivicRoadmapCopy {
  badge: string;
  headline: string;
  subheadline: string;
  steps: Record<'step-1' | 'step-2' | 'step-3' | 'step-4' | 'step-5', CivicRoadmapMilestoneCopy>;
}

export const CIVIC_ROADMAP_COPY: ModuleTranslationDictionary<CivicRoadmapCopy> & {
  hi: CivicRoadmapCopy;
} = {
  en: {
    badge: 'Your Journey Begins here !!',
    headline: 'From confusion to clarity, from grievance to resolution.',
    subheadline: 'Navigate smoothly from incident verification to certified dispute resolution.',
    steps: {
      'step-1': {
        stepNumber: 'Step 01',
        title: 'Verify & Check',
        desc: 'Pre-screen suspicious UPI handles, phone numbers, or links against public advisories.',
      },
      'step-2': {
        stepNumber: 'Step 02',
        title: 'Structure Incident',
        desc: 'Describe what happened in voice or text. AI organizes facts, dates, entities and claimed loss.',
      },
      'step-3': {
        stepNumber: 'Step 03',
        title: 'Evidence Vault',
        desc: 'Preserve receipts, invoices and statements with SHA-256 cryptographic custody proof.',
      },
      'step-4': {
        stepNumber: 'Step 04',
        title: 'Official Filing',
        desc: 'Side-by-side guided companion matching your case facts into government portal fields.',
      },
      'step-5': {
        stepNumber: 'Step 05',
        title: 'Track & Resolve',
        desc: 'Monitor mandatory 30-day response countdown and export your case record.',
      },
    },
  },
  hi: {
    badge: 'आपकी यात्रा यहाँ से शुरू होती है!',
    headline: 'भ्रम से स्पष्टता तक, शिकायत से समाधान तक।',
    subheadline: 'घटना के सत्यापन से लेकर प्रमाणित विवाद समाधान तक सहजता से आगे बढ़ें।',
    steps: {
      'step-1': {
        stepNumber: 'चरण 01',
        title: 'सत्यापित करें और जांचें',
        desc: 'संदिग्ध UPI हैंडल, फ़ोन नंबर या लिंक की सार्वजनिक चेतावनियों के आधार पर प्रारंभिक जांच करें।',
      },
      'step-2': {
        stepNumber: 'चरण 02',
        title: 'घटना का विवरण बनाएं',
        desc: 'आवाज़ या टेक्स्ट में बताएं कि क्या हुआ। AI तथ्यों, तिथियों, पक्षों और दावे के नुकसान को व्यवस्थित करता है।',
      },
      'step-3': {
        stepNumber: 'चरण 03',
        title: 'साक्ष्य तिजोरी',
        desc: 'SHA-256 क्रिप्टोग्राफ़िक कस्टडी प्रमाण के साथ रसीदें, चालान और विवरण सुरक्षित रखें।',
      },
      'step-4': {
        stepNumber: 'चरण 04',
        title: 'आधिकारिक शिकायत दर्ज करें',
        desc: 'आपके मामले के तथ्यों को सरकारी पोर्टल के फ़ील्ड से मिलाने वाला साथ-साथ मार्गदर्शक।',
      },
      'step-5': {
        stepNumber: 'चरण 05',
        title: 'निगरानी और समाधान',
        desc: 'अनिवार्य 30-दिवसीय प्रतिक्रिया समयसीमा की निगरानी करें और अपना केस रिकॉर्ड निर्यात करें।',
      },
    },
  },
};

export function getCivicRoadmapTranslation(
  language?: LanguageCode | string | null
): ModuleTranslationResolution<CivicRoadmapCopy> {
  return resolveModuleTranslation(CIVIC_ROADMAP_COPY, language);
}

export function getCivicRoadmapCopy(
  language?: LanguageCode | string | null
): CivicRoadmapCopy {
  return getCivicRoadmapTranslation(language).copy;
}
