import React from 'react';
import { LevelUpOverlay } from '../rpg/LevelUpOverlay';
import { Toast } from '../ui/Toast';
import { useGuildFeedbackStore } from '../../stores/guildFeedbackStore';

// Mounted once above the tabs so a guild toast or level-up shows on any screen.
export function GuildFeedback() {
  const { toast, levelUp, dismissToast, dismissLevelUp } = useGuildFeedbackStore();

  return (
    <>
      {toast ? (
        <Toast
          key={toast.message}
          message={toast.message}
          visible
          onDismiss={dismissToast}
          type={toast.type}
        />
      ) : null}
      <LevelUpOverlay
        visible={!!levelUp}
        level={levelUp?.level ?? 0}
        subtitle={levelUp ? `Your standing in ${levelUp.guildName} grows` : undefined}
        onDismiss={dismissLevelUp}
      />
    </>
  );
}
