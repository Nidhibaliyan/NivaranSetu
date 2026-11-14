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

export type WorkspaceEmptyStateVariant = 'navigator' | 'dossier' | 'monitoring';

export interface WorkspaceEmptyStateItemCopy {
  title: string;
  description: string;
}

export interface WorkspaceEmptyStateCopy {
  dismiss: string;
  startNewGrievance: string;
  openSettings: string;
  states: Record<WorkspaceEmptyStateVariant, WorkspaceEmptyStateItemCopy>;
}

export const WORKSPACE_EMPTY_STATE_COPY: ModuleTranslationDictionary<WorkspaceEmptyStateCopy> & {
  hi: WorkspaceEmptyStateCopy;
} = {
  en: {
    dismiss: 'Dismiss',
    startNewGrievance: 'Start New Grievance',
    openSettings: 'Open Settings',
    states: {
      navigator: {
        title: 'No Active Grievance Selected',
        description:
          'The Civic Journey Navigator guides you through step-by-step statutory filing for an active grievance. Describe an issue in Smart Case Builder or restore sample cases in Settings.',
      },
      dossier: {
        title: 'No Case Dossier Available',
        description:
          'There are no active grievance cases to compile into an evidence dossier. You can begin a new grievance or restore sample cases in Settings.',
      },
      monitoring: {
        title: 'No Case Under Monitoring',
        description:
          'Smart Case Monitoring tracks 30-day statutory response windows for filed grievances. Create or select a case to track.',
      },
    },
  },
  hi: {
    dismiss: 'बंद करें',
    startNewGrievance: 'नई शिकायत शुरू करें',
    openSettings: 'सेटिंग्स खोलें',
    states: {
      navigator: {
        title: 'कोई सक्रिय शिकायत चयनित नहीं है',
        description:
          'सिविक जर्नी नेविगेटर किसी सक्रिय शिकायत के लिए चरणबद्ध वैधानिक शिकायत दर्ज करने में आपका मार्गदर्शन करता है। स्मार्ट केस बिल्डर में अपनी समस्या लिखें या सेटिंग्स में नमूना मामले पुनर्स्थापित करें।',
      },
      dossier: {
        title: 'कोई केस डॉसियर उपलब्ध नहीं है',
        description:
          'साक्ष्य डॉसियर तैयार करने के लिए कोई सक्रिय शिकायत मामला उपलब्ध नहीं है। आप नई शिकायत शुरू कर सकते हैं या सेटिंग्स में नमूना मामले पुनर्स्थापित कर सकते हैं।',
      },
      monitoring: {
        title: 'निगरानी में कोई मामला नहीं है',
        description:
          'स्मार्ट मामला निगरानी दर्ज की गई शिकायतों की 30-दिवसीय वैधानिक प्रतिक्रिया समयसीमा को ट्रैक करती है। निगरानी के लिए एक मामला बनाएं या चुनें।',
      },
    },
  },
};

export function getWorkspaceEmptyStateTranslation(
  language?: LanguageCode | string | null
): ModuleTranslationResolution<WorkspaceEmptyStateCopy> {
  return resolveModuleTranslation(WORKSPACE_EMPTY_STATE_COPY, language);
}

export function getWorkspaceEmptyStateCopy(
  language?: LanguageCode | string | null
): WorkspaceEmptyStateCopy {
  return getWorkspaceEmptyStateTranslation(language).copy;
}
