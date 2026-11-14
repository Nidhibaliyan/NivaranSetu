/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertCircle, Clock, Compass, Layers } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getWorkspaceEmptyStateCopy,
  WorkspaceEmptyStateVariant,
} from '../i18n/workspaceEmptyStateTranslations';

interface WorkspaceCasesErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export const WorkspaceCasesErrorBanner: React.FC<WorkspaceCasesErrorBannerProps> = ({
  message,
  onDismiss,
}) => {
  const { language } = useLanguage();
  const copy = getWorkspaceEmptyStateCopy(language);

  return (
    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="px-2 py-0.5 rounded text-[11px] font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
      >
        {copy.dismiss}
      </button>
    </div>
  );
};

interface WorkspaceEmptyStateProps {
  variant: WorkspaceEmptyStateVariant;
  onStartNewCase: () => void;
  onOpenSettings: () => void;
}

const VARIANT_ICONS: Record<WorkspaceEmptyStateVariant, React.ComponentType<{ className?: string }>> = {
  navigator: Compass,
  dossier: Layers,
  monitoring: Clock,
};

export const WorkspaceEmptyState: React.FC<WorkspaceEmptyStateProps> = ({
  variant,
  onStartNewCase,
  onOpenSettings,
}) => {
  const { language } = useLanguage();
  const copy = getWorkspaceEmptyStateCopy(language);
  const stateCopy = copy.states[variant];
  const Icon = VARIANT_ICONS[variant];

  return (
    <div className="max-w-xl mx-auto my-12 p-8 text-center rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] space-y-4 shadow-xs">
      <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-[#007FFF]">
        <Icon className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-zinc-950 dark:text-white">
          {stateCopy.title}
        </h3>
        <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
          {stateCopy.description}
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={onStartNewCase}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#007FFF] hover:bg-[#0070e0] rounded-xl transition-colors cursor-pointer"
        >
          {copy.startNewGrievance}
        </button>
        <button
          onClick={onOpenSettings}
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
        >
          {copy.openSettings}
        </button>
      </div>
    </div>
  );
};
